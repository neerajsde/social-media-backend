import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

ffmpeg.setFfmpegPath(String(ffmpegPath));
ffmpeg.setFfprobePath(ffprobePath.path);

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

async function validateInput(file: string) {
  try {
    const stats = await fs.stat(file);
    if (!stats || stats.size < 1000) {
      throw new Error(`Invalid input file: ${file}`);
    }
  } catch {
    throw new Error(`Input file does not exist: ${file}`);
  }
}

async function waitForFile(file: string, timeout = 8000) {
  const start = Date.now();
  let lastSize = -1;

  while (true) {
    try {
      const stats = await fs.stat(file);
      if (stats.size > 1000 && stats.size === lastSize) return;
      lastSize = stats.size;
    } catch {}

    if (Date.now() - start > timeout) {
      throw new Error(`File not ready: ${file}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─────────────────────────────────────────────
// HLS segmented transcode (replaces compressVideo)
//
// Produces:
//   <outDir>/
//     index.m3u8          ← master playlist
//     360p/
//       playlist.m3u8
//       seg000.ts  seg001.ts  …
//     720p/
//       playlist.m3u8  …
//     1080p/
//       playlist.m3u8  …
//     1440p/
//       playlist.m3u8  …
// ─────────────────────────────────────────────

export type HlsQuality = {
  name: string;
  width: number;
  crf: number;
  maxrate: string; // e.g. "1500k"
  bufsize: string; // e.g. "3000k"
  audioBitrate: string; // e.g. "128k"
};

export const DEFAULT_QUALITIES: HlsQuality[] = [
  { name: "360p",  width: 480,  crf: 27, maxrate: "800k",  bufsize: "1600k", audioBitrate: "96k"  },
  { name: "720p",  width: 1280, crf: 23, maxrate: "2800k", bufsize: "5600k", audioBitrate: "128k" },
  { name: "1080p", width: 1920, crf: 20, maxrate: "5000k", bufsize: "10000k",audioBitrate: "192k" },
  { name: "1440p", width: 2560, crf: 18, maxrate: "8000k", bufsize: "16000k",audioBitrate: "192k" },
];

export async function transcodeToHLS(
  input: string,
  outDir: string,
  qualities: HlsQuality[] = DEFAULT_QUALITIES,
  segmentDuration = 6 // seconds — 6 s is the Apple-recommended default
): Promise<string> {
  await validateInput(input);
  await waitForFile(input);
  await fs.mkdir(outDir, { recursive: true });

  // Transcode each quality into its own sub-folder
  for (const q of qualities) {
    const qDir = path.join(outDir, q.name);
    await fs.mkdir(qDir, { recursive: true });

    const segPattern = path.join(qDir, "seg%03d.ts");
    const playlist   = path.join(qDir, "playlist.m3u8");

    await new Promise<void>((resolve, reject) => {
      ffmpeg(input)
        .outputOptions([
          // Input resilience
          "-fflags +genpts",
          "-err_detect ignore_err",

          // Video
          "-vf",        `scale=${q.width}:-2`,
          "-r",         "30",
          "-c:v",       "libx264",
          "-preset",    "slow",
          "-crf",       String(q.crf),
          "-maxrate",   q.maxrate,
          "-bufsize",   q.bufsize,
          "-pix_fmt",   "yuv420p",   // broad device compatibility
          "-profile:v", "high",
          "-level",     "4.1",

          // Audio
          "-c:a",       "aac",
          "-b:a",       q.audioBitrate,
          "-ac",        "2",

          // HLS muxer
          "-f",              "hls",
          "-hls_time",       String(segmentDuration),
          "-hls_list_size",  "0",                    // keep all segments in playlist
          "-hls_flags",      "independent_segments",  // each segment decodable standalone
          "-hls_segment_type", "mpegts",
          "-hls_segment_filename", segPattern,
        ])
        .on("start", (cmd) => console.log(`🚀 HLS [${q.name}]:`, cmd))
        .on("stderr", (line) => console.log(`📢 [${q.name}]:`, line))
        .on("end",   () => { console.log(`✅ [${q.name}] done`); resolve(); })
        .on("error", (err) => { console.error(`❌ [${q.name}] error:`, err); reject(err); })
        .save(playlist);
    });
  }

  // Write EXT-X-STREAM-INF master playlist
  const masterPath = path.join(outDir, "index.m3u8");
  const masterLines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3", ""];

  const bandwidthMap: Record<string, number> = {
    "360p":  800_000,
    "720p":  2_800_000,
    "1080p": 5_000_000,
    "1440p": 8_000_000,
  };

  const resolutionMap: Record<string, string> = {
    "360p":  "480x270",
    "720p":  "1280x720",
    "1080p": "1920x1080",
    "1440p": "2560x1440",
  };

  for (const q of qualities) {
    const bw  = bandwidthMap[q.name]  ?? 2_000_000;
    const res = resolutionMap[q.name] ?? "";
    masterLines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${res},CODECS="avc1.640028,mp4a.40.2",NAME="${q.name}"`,
      `${q.name}/playlist.m3u8`,
      ""
    );
  }

  await fs.writeFile(masterPath, masterLines.join("\n"), "utf8");
  console.log("📄 Master playlist written:", masterPath);

  return masterPath; // callers upload this + the whole outDir
}

// ─────────────────────────────────────────────
// Thumbnail
// ─────────────────────────────────────────────

export function generateThumbnail(
  input: string,
  output: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    validateInput(input).catch(reject);

    const folder   = path.dirname(output);
    const filename = path.basename(output);

    ffmpeg(input)
      .on("start", (cmd) => console.log("🎬 Thumbnail cmd:", cmd))
      .on("end",   ()    => { console.log("🖼️ Thumbnail:", output); resolve(output); })
      .on("error", (err) => { console.error("❌ Thumbnail error:", err); reject(err); })
      .screenshots({
        timestamps: ["2"],
        filename,
        folder,
        size: "640x360",
      });
  });
}

// ─────────────────────────────────────────────
// Duration probe
// ─────────────────────────────────────────────

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    validateInput(filePath).catch(reject);

    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata?.format?.duration;
      if (!duration) return reject(new Error("Invalid duration"));
      resolve(Math.floor(duration));
    });
  });
}

// ─────────────────────────────────────────────
// Normalize (fixes corrupt container)
// ─────────────────────────────────────────────

export async function normalizeVideo(input: string): Promise<string> {
  const output = input.replace(".mp4", "-fixed.mp4");

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions(["-fflags +genpts", "-err_detect ignore_err"])
      .outputOptions([
        "-r 30", "-vsync 1",
        "-c:v libx264", "-preset ultrafast",
        "-c:a aac",
        "-movflags +faststart",
      ])
      .on("end",   async () => {
        try { await waitForFile(output, 10000); resolve(output); }
        catch (err) { reject(err); }
      })
      .on("error", reject)
      .save(output);
  });
}

// ─────────────────────────────────────────────
// Quick validation via ffprobe
//
// Fixes for VPS:
//   1. Uses ffprobe-static path — system ffprobe may not exist in $PATH
//   2. fluent-ffmpeg.ffprobe() uses the registered static binary
//   3. Checks duration > 0 so zero-length files are also rejected
// ─────────────────────────────────────────────

export async function validateVideo(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) {
        console.error("[validateVideo] ffprobe error:", err.message);
        resolve(false);
        return;
      }

      const duration = metadata?.format?.duration ?? 0;
      const size     = metadata?.format?.size     ?? 0;

      if (duration <= 0 || size < 1000) {
        console.error(`[validateVideo] invalid media — duration=${duration} size=${size}`);
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}