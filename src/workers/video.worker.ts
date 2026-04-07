import { Job, Worker, UnrecoverableError } from "bullmq";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { Redis } from "ioredis";
import { ENV } from "../config/env.js";
import { downloadVideo } from "../services/video/download.service.js";
import { convertToRekognitionFormat, scanVideoUnsafe } from "../services/video/moderation.service.js";
import {
  transcodeToHLS,
  generateThumbnail,
  getVideoDuration,
  validateVideo,
  DEFAULT_QUALITIES,
} from "../services/video/compress.service.js";
import { uploadToS3 } from "../services/s3.service.js";
import { deleteFile } from "../services/aws.js";
import { prisma } from "../config/prisma.config.js";
import { addVideoJob, backoffDelay, attachQueueEvents } from "../queues/video.queue.js";
import { sendContentReport } from "../mails/email-producer.js";

const CPU_COUNT = os.cpus().length;
const TMP_DIR   = "/tmp";

const connection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
});

// ─────────────────────────────────────────────────────────────
// Error classification
//
// Some failures are permanent — no point retrying them.
// Throwing UnrecoverableError tells BullMQ to skip remaining
// attempts and move the job straight to failed.
// ─────────────────────────────────────────────────────────────
function classifyError(err: any): never {
  const msg: string = err?.message ?? String(err);

  const unrecoverable = [
    "Invalid/corrupted video file",   // bad upload — will never transcode
    "Downloaded video is corrupted",  // S3 object is broken
    "Invalid input file",             // file too small / zero bytes
    "Empty S3 response body",         // key doesn't exist in S3
  ];

  if (unrecoverable.some(pattern => msg.includes(pattern))) {
    throw new UnrecoverableError(msg); // BullMQ skips retries immediately
  }

  throw err; // transient — BullMQ will retry with backoff
}

// ─────────────────────────────────────────────────────────────
// Safe delete (file or directory)
// ─────────────────────────────────────────────────────────────
async function safeDelete(target?: string) {
  if (!target) return;
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      await fs.rm(target, { recursive: true, force: true });
    } else {
      await fs.unlink(target);
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────
// Upload entire HLS directory to S3
// ─────────────────────────────────────────────────────────────
async function uploadHLSDirectory(hlsDir: string, s3Prefix: string): Promise<string> {
  const walk = async (dir: string): Promise<string[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...(await walk(full)));
      else files.push(full);
    }
    return files;
  };

  const allFiles = await walk(hlsDir);

  await Promise.all(
    allFiles.map(async (absPath) => {
      const rel      = path.relative(hlsDir, absPath);
      const s3Key    = `${s3Prefix}/${rel}`;
      const mimeType = absPath.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t";
      await uploadToS3(absPath, s3Key, mimeType);
    })
  );

  return `${s3Prefix}/index.m3u8`;
}

// ─────────────────────────────────────────────────────────────
// SCAN worker
// ─────────────────────────────────────────────────────────────
async function scanVideo(job: Job) {
  const { key, postId } = job.data;

  console.log(`[scan] attempt ${job.attemptsMade + 1} for postId=${postId}`);

  try {
    await prisma.video.update({
      where: { postId },
      data: { status: "SCANNING" },
    });

    const unsafe = await scanVideoUnsafe(key);

    if (unsafe) {
      const post = await prisma.$transaction(async (tx) => {
        const post = await tx.post.findUnique({
          where: { id: postId },
          include: {
            user: { select: { first_name: true, username: true, email: true } },
          },
        });
        await tx.video.delete({ where: { postId } });
        await tx.post.update({ where: { id: postId }, data: { status: "deleted" } });
        return post;
      });

      await deleteFile(key);

      if (post) {
        await sendContentReport({
          email: post.user.email,
          name: post.user.first_name || `@${post.user.username}`,
          caption: post.content || "No caption",
        });
      }
      return;
    }

    await addVideoJob(job.data);
    await prisma.video.update({
      where: { postId },
      data: { status: "QUEUED" },
    });

  } catch (err: any) {
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 4);

    console.error(
      `[scan] error on attempt ${job.attemptsMade + 1} for postId=${postId}: ${err.message}`
    );

    if (isLastAttempt) {
      await prisma.video.update({
        where: { postId },
        data: { status: "FAILED" },
      }).catch(() => {});

      console.error(`[scan] all retries exhausted for postId=${postId}`);
    }

    classifyError(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PROCESS worker
// ─────────────────────────────────────────────────────────────
async function processVideo(job: Job) {
  const { key, postId } = job.data;

  let downloadedPath: string | null = null;
  let inputPath:      string | null = null;
  let thumbPath:      string | null = null;
  let hlsDir:         string | null = null;

  console.log(`[process] attempt ${job.attemptsMade + 1} for postId=${postId}`);

  try {
    await fs.mkdir(TMP_DIR, { recursive: true });

    await prisma.video.update({
      where: { postId },
      data: { status: "PROCESSING" },
    });

    downloadedPath = await downloadVideo(key);
    inputPath      = await convertToRekognitionFormat(downloadedPath);

    const isValid = await validateVideo(inputPath);
    if (!isValid) throw new Error("Invalid/corrupted video file");

    const filename = path.parse(inputPath).name;
    job.updateProgress(10);

    const video = await prisma.video.findUnique({
      where: { postId },
      select: { thumbnail: true },
    });

    if (!video?.thumbnail) {
      thumbPath = path.join(TMP_DIR, `${filename}_thumb.jpg`);
      await generateThumbnail(inputPath, thumbPath);
      const thumbnailKey = `videos/${filename}/thumb.jpg`;
      await uploadToS3(thumbPath, thumbnailKey, "image/jpeg");
      await prisma.video.update({
        where: { postId },
        data: { thumbnail: thumbnailKey },
      });
    }

    job.updateProgress(20);

    const duration = await getVideoDuration(inputPath);

    await prisma.video.update({
      where: { postId },
      data: { status: "TRANSCODING", durationSec: duration || 0 },
    });

    job.updateProgress(25);

    hlsDir = path.join(TMP_DIR, `${filename}_hls`);
    await transcodeToHLS(inputPath, hlsDir, DEFAULT_QUALITIES, 6);

    job.updateProgress(80);

    const s3Prefix  = `videos/${filename}/hls`;
    const masterKey = await uploadHLSDirectory(hlsDir, s3Prefix);

    job.updateProgress(95);

    await prisma.video.update({
      where: { postId },
      data: {
        hlsMasterKey: masterKey,
        status:       "COMPLETED",
        durationSec:  duration,
      },
    });

    job.updateProgress(100);
    return { success: true, masterKey };

  } catch (err: any) {
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 5);

    console.error(
      `[process] error on attempt ${job.attemptsMade + 1} for postId=${postId}: ${err.message}`
    );

    if (isLastAttempt) {
      await prisma.video.update({
        where: { postId },
        data: { status: "FAILED" },
      }).catch(() => {});

      console.error(`[process] all retries exhausted for postId=${postId}`);
    }

    classifyError(err);

  } finally {
    await safeDelete(downloadedPath ?? undefined);
    await safeDelete(inputPath      ?? undefined);
    await safeDelete(thumbPath      ?? undefined);
    await safeDelete(hlsDir         ?? undefined);
  }
}

// ─────────────────────────────────────────────────────────────
// Workers
// ─────────────────────────────────────────────────────────────
new Worker("scan-video", scanVideo, {
  connection: connection as any,
  concurrency: Math.max(1, Math.floor(CPU_COUNT / 2)),

  limiter: { max: 5, duration: 1000 },

  stalledInterval: 30_000,
  maxStalledCount: 2,

  settings: {
    backoffStrategy: backoffDelay,
  },
});

new Worker("video-processing", processVideo, {
  connection: connection as any,
  concurrency: Math.max(1, Math.floor(CPU_COUNT / 2)),

  limiter: { max: 5, duration: 1000 },

  stalledInterval: 60_000, 
  maxStalledCount: 1,      

  settings: {
    backoffStrategy: backoffDelay,
  },
});

attachQueueEvents();