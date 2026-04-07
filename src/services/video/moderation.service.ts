// moderation.service.ts

import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";
import { ENV } from "../../config/env.js";
import { downloadVideo } from "./download.service.js";

// Use static binaries (important for VPS)
ffmpeg.setFfmpegPath(String(ffmpegPath));
ffmpeg.setFfprobePath(ffprobePath.path);

const rekognition = new RekognitionClient({
  region: ENV.AWS_REGION,
});

// ─────────────────────────────────────────────────────────────
// ✅ Convert video → Fast + Rekognition-safe format
// ─────────────────────────────────────────────────────────────
export async function convertToRekognitionFormat(input: string): Promise<string> {
  const output = input.replace(/\.[^/.]+$/, "-fixed.mp4");

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        "-y",

        // 🔥 SPEED + SIZE OPTIMIZATION
        "-preset", "ultrafast",
        "-crf", "28",

        // reduce resolution (huge speed boost)
        "-vf", "scale=1280:-2",

        // codecs
        "-c:v", "libx264",

        // ✅ IMPORTANT: never copy audio
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",

        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p",
      ])
      .on("start", (cmd) => console.log("[ffmpeg] start:", cmd))
      .on("end", () => {
        console.log("[ffmpeg] done:", output);
        resolve(output);
      })
      .on("error", (err) => {
        console.error("[ffmpeg] error:", err.message);
        reject(err);
      })
      .save(output);
  });
}

// ─────────────────────────────────────────────────────────────
// ✅ Extract frames (1 frame every 3 seconds)
// ─────────────────────────────────────────────────────────────
async function extractFrames(input: string, outputDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        "-vf", "fps=1/3", // every 3 sec
      ])
      .output(`${outputDir}/frame-%03d.jpg`)
      .on("end", () => {
        console.log("[frames] extracted");
        resolve();
      })
      .on("error", (err) => {
        console.error("[frames] error:", err.message);
        reject(err);
      })
      .run();
  });
}

// ─────────────────────────────────────────────────────────────
// ✅ Moderate frames using Rekognition (FAST + CHEAP)
// ─────────────────────────────────────────────────────────────
async function moderateFrames(dir: string): Promise<boolean> {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const image = fs.readFileSync(filePath);

    const res = await rekognition.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: image },
        MinConfidence: 70,
      })
    );

    const unsafe = (res.ModerationLabels ?? []).some((label) =>
      ["Explicit Nudity", "Violence", "Suggestive"].includes(label.Name ?? "")
    );

    if (unsafe) {
      console.log("[moderation] unsafe content detected in frame:", file);
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// ✅ Optional: Check if video already valid (skip conversion)
// ─────────────────────────────────────────────────────────────
async function isValidFormat(input: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(input, (err, data) => {
      if (err) return resolve(false);

      const video = data.streams.find((s) => s.codec_type === "video");
      const audio = data.streams.find((s) => s.codec_type === "audio");

      resolve(
        video?.codec_name === "h264" &&
        audio?.codec_name === "aac"
      );
    });
  });
}

// ─────────────────────────────────────────────────────────────
// 🚀 MAIN FUNCTION (FINAL OPTIMIZED)
// ─────────────────────────────────────────────────────────────
export async function scanVideoUnsafe(key: string): Promise<boolean> {
  let localPath: string | null = null;
  let processedPath: string | null = null;

  const framesDir = `/tmp/frames-${Date.now()}`;

  try {
    console.log("[moderation] start:", key);

    // ✅ 1. Download once
    localPath = await downloadVideo(key);

    // ✅ 2. Check format
    const isValid = await isValidFormat(localPath);

    if (isValid) {
      console.log("[moderation] skipping conversion (already valid)");
      processedPath = localPath;
    } else {
      console.log("[moderation] converting video...");
      processedPath = await convertToRekognitionFormat(localPath);
    }

    // ✅ 3. Extract frames
    fs.mkdirSync(framesDir, { recursive: true });
    await extractFrames(processedPath, framesDir);

    // ✅ 4. Moderate frames
    const isUnsafe = await moderateFrames(framesDir);

    console.log("[moderation] result:", isUnsafe ? "UNSAFE" : "SAFE");

    return isUnsafe;

  } catch (err: any) {
    console.error("[moderation] failed:", err.message);
    return true; // fail-safe

  } finally {
    // 🧹 Cleanup
    try {
      if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);

      if (
        processedPath &&
        processedPath !== localPath &&
        fs.existsSync(processedPath)
      ) {
        fs.unlinkSync(processedPath);
      }

      if (fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
      }
    } catch (cleanupErr: any) {
      console.warn("[cleanup] error:", cleanupErr.message);
    }
  }
}