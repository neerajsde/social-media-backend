import { Job, Worker, UnrecoverableError } from "bullmq";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { Redis } from "ioredis";
import { ENV } from "../config/env.js";
import { downloadVideo } from "../services/video/download.service.js";

import {
  generateThumbnail,
  getVideoDuration,
  validateVideo,
} from "../services/video/compress.service.js";
import { createMediaConvertJob, getMediaConvertJob } from "../services/video/mediaconvert.service.js";
import { uploadToS3 } from "../services/s3.service.js";
import { deleteFile } from "../services/aws.js";
import { prisma } from "../config/prisma.config.js";
import { backoffDelay, attachQueueEvents } from "../queues/video.queue.js";
import { bulkNotificationQueue } from "../queues/messaging.queue.js";

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

function normalizeS3Path(value: string): string {
  return value.replace(/\\/g, '/');
}

function toS3Key(...parts: string[]): string {
  return parts
    .map(part => normalizeS3Path(String(part)))
    .join('/')
    .replace(/\/+/g, '/');
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
      const s3Key    = toS3Key(s3Prefix, rel);
      const mimeType = absPath.endsWith(".m3u8")
        ? "application/vnd.apple.mpegurl"
        : "video/mp2t";
        
      console.log(`Uploading HLS file:\n${s3Key}`);
      await uploadToS3(absPath, s3Key, mimeType);
    })
  );

  return toS3Key(s3Prefix, "index.m3u8");
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
    inputPath      = downloadedPath;

    const isValid = await validateVideo(inputPath);
    if (!isValid) throw new Error("Invalid/corrupted video file");

    const emitProgress = (progress: number, statusOverride?: string) => {
      job.updateProgress(progress).catch(() => {});
      connection.publish("video_progress", JSON.stringify({ postId, progress, status: statusOverride || "processing" })).catch(() => {});
    };

    const filename = path.parse(inputPath).name;
    emitProgress(10);

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

    emitProgress(20);

    const duration = await getVideoDuration(inputPath);

    await prisma.video.update({
      where: { postId },
      data: { status: "TRANSCODING", durationSec: duration || 0 },
    });

    job.updateProgress(25);

    const s3Prefix  = `videos/${filename}/hls`;
    
    // Submit job to AWS MediaConvert
    console.log(`[process] Submitting to AWS MediaConvert: input=${key}, output=${s3Prefix}`);
    const mcJobId = await createMediaConvertJob(key, s3Prefix);
    
    // Polling loop with smooth fake progress
    let isComplete = false;
    let fakeProgress = 25;
    
    const progressInterval = setInterval(() => {
      if (fakeProgress < 78) {
        fakeProgress += 1;
        emitProgress(fakeProgress);
      }
    }, 1500); // Tick 1% every 1.5 seconds

    try {
      while (!isComplete) {
        await new Promise(r => setTimeout(r, 15000)); // Poll AWS every 15s
        const statusObj = await getMediaConvertJob(mcJobId);
        
        const status = statusObj?.Status;
        if (status === "COMPLETE") {
          isComplete = true;
        } else if (status === "ERROR") {
          throw new Error(`MediaConvert Job Failed: ${statusObj?.ErrorMessage}`);
        } else if (status === "PROGRESSING") {
          const percent = statusObj?.JobPercentComplete || 0;
          const mappedProgress = Math.floor(25 + (percent * 0.55));
          if (mappedProgress > fakeProgress) {
            fakeProgress = mappedProgress;
            emitProgress(fakeProgress);
          }
        }
      }
    } finally {
      clearInterval(progressInterval);
    }

    emitProgress(80);
    const masterKey = `${s3Prefix}/index.m3u8`;

    emitProgress(95);

    await prisma.video.update({
      where: { postId },
      data: {
        hlsMasterKey: masterKey,
        status:       "COMPLETED",
        durationSec:  duration,
      },
    });

    const videoPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (videoPost) {
      await bulkNotificationQueue.add("Post-Notification", {
        postId: postId,
        userId: videoPost.userId,
      });
    }

    emitProgress(100, "completed");
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



new Worker("video-processing", processVideo, {
  connection: connection as any,
  concurrency: 10,

  limiter: { max: 5, duration: 1000 },

  stalledInterval: 60_000, 
  maxStalledCount: 1,      

  settings: {
    backoffStrategy: backoffDelay,
  },
});

attachQueueEvents();