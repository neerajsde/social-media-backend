import { Queue, QueueEvents } from "bullmq";
import { ENV } from "../config/env.js";

const connection = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
};

type Data = {
  key: string;
  postId: string;
};

// ─────────────────────────────────────────────────────────────
// Shared backoff strategy
//
// Exponential backoff with jitter so retries don't thunderherd:
//   attempt 1 → 10 s
//   attempt 2 → 20 s
//   attempt 3 → 40 s
//   attempt 4 → 80 s  (scan stops here)
//   attempt 5 → 160 s (process stops here)
// ─────────────────────────────────────────────────────────────
function backoffDelay(attemptsMade: number): number {
  const base = 10_000; // 10 s
  const jitter = Math.random() * 2000; // ±2 s jitter
  return Math.min(base * Math.pow(2, attemptsMade - 1) + jitter, 300_000);
}

// ─────────────────────────────────────────────────────────────
// SCAN queue
// Fast jobs — 4 attempts, short backoff
// ─────────────────────────────────────────────────────────────
export const scanVideoQueue = new Queue("scan-video", {
  connection,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: "custom", // handled in worker opts below
    },
    removeOnComplete: { count: 100 },   // keep last 100 for audit
    removeOnFail: { count: 500 },       // keep last 500 failed for debugging
  },
});

export const addScanVideoJob = async (data: Data) => {
  await scanVideoQueue.add("scan-video", data, {
    jobId: `scan-${data.postId}`,        // idempotent — won't double-queue
  });
  console.log(`[Queue] scan job added for postId=${data.postId}`);
};

// ─────────────────────────────────────────────────────────────
// PROCESS queue
// Heavy jobs — 5 attempts, longer backoff (ffmpeg can OOM transiently)
// ─────────────────────────────────────────────────────────────
export const videoQueue = new Queue("video-processing", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "custom",
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const addVideoJob = async (data: Data) => {
  await videoQueue.add("process-video", data, {
    jobId: `process-${data.postId}`,     // idempotent
  });
  console.log(`[Queue] process job added for postId=${data.postId}`);
};

// ─────────────────────────────────────────────────────────────
// Queue event listeners — log every retry and final failure
// Attach once at startup (not per-job)
// ─────────────────────────────────────────────────────────────
export function attachQueueEvents() {
  const scanEvents    = new QueueEvents("scan-video",       { connection });
  const processEvents = new QueueEvents("video-processing", { connection });

  for (const [events, name] of [
    [scanEvents,    "scan-video"],
    [processEvents, "video-processing"],
  ] as const) {
    events.on("failed", ({ jobId, failedReason }) => {
      console.error(`[${name}] job ${jobId} FAILED: ${failedReason}`);
    });

    events.on("retries-exhausted", ({ jobId }) => {
      // This fires only after ALL attempts are used up
      console.error(
        `[${name}] job ${jobId} exhausted all retries. ` +
        `Final error: Moving to dead-letter.`
      );
      // TODO: send to Sentry / PagerDuty / Slack here
    });

    events.on("stalled", ({ jobId }) => {
      console.warn(`[${name}] job ${jobId} stalled — worker may have crashed`);
    });
  }
}

export { backoffDelay };