import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";
import { s3 } from "../aws.js";
import { ENV } from "../../config/env.js";
import { validateVideo } from "./compress.service.js";

// ─────────────────────────────────────────────────────────────
// Wait until the local file stops growing (fully flushed)
// ─────────────────────────────────────────────────────────────
async function waitForFileStable(file: string, timeout = 10_000): Promise<number> {
  const start = Date.now();
  let lastSize = -1;

  while (true) {
    try {
      const stats = await fsPromises.stat(file);
      if (stats.size > 1000 && stats.size === lastSize) return stats.size;
      lastSize = stats.size;
    } catch {}

    if (Date.now() - start > timeout) {
      throw new Error("File not stable after download");
    }

    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─────────────────────────────────────────────────────────────
// Wait until S3 object is fully committed and large enough
//
// Fixes the race condition where the scan job completes and
// queues processVideo before the client finishes uploading.
// In production the upload travels over the internet; locally
// it is instant. HeadObject returns ContentLength=0 or
// NoSuchKey while a multipart upload is still in-flight.
// ─────────────────────────────────────────────────────────────
async function waitForS3Object(
  key: string,
  minBytes = 10_000,
  timeout = 30_000
): Promise<number> {
  const start = Date.now();

  while (true) {
    try {
      const head = await s3.send(
        new HeadObjectCommand({ Bucket: ENV.S3_BUCKET_NAME, Key: key })
      );

      const size = head.ContentLength ?? 0;

      if (size >= minBytes) {
        console.log(`[download] S3 object ready — key=${key} size=${size}`);
        return size;
      }

      console.warn(`[download] S3 object too small (${size} bytes), waiting…`);
    } catch (err: any) {
      // NoSuchKey = multipart upload not yet committed
      console.warn(`[download] S3 object not visible yet (${err.name}), waiting…`);
    }

    if (Date.now() - start > timeout) {
      throw new Error(`S3 object not ready after ${timeout}ms: ${key}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

// ─────────────────────────────────────────────────────────────
// Guard against /tmp being full mid-download
//
// We need at least 3× the object size:
//   1× original download
//   1× re-encoded copy (convertToRekognitionFormat)
//   1× HLS segments
// ─────────────────────────────────────────────────────────────
async function assertDiskSpace(requiredBytes: number): Promise<void> {
  try {
    const out      = execSync("df -k /tmp").toString();
    const lines    = out.trim().split("\n");
    const dataLine = lines[1];

    if (!dataLine) {
      console.warn("[download] Could not parse df output, skipping disk check");
      return;
    }

    const parts   = dataLine.trim().split(/\s+/);
    const availKb = parseInt(parts[3] ?? "0");

    if (isNaN(availKb) || availKb === 0) {
      console.warn("[download] Could not read available disk space, skipping check");
      return;
    }

    const available = availKb * 1024; // 1K blocks → bytes

    console.log(`[download] /tmp available: ${Math.round(available / 1024 / 1024)} MB, need: ${Math.round(requiredBytes / 1024 / 1024)} MB`);

    if (available < requiredBytes) {
      throw new Error(
        `Insufficient /tmp space: need ${Math.round(requiredBytes / 1_048_576)} MB, ` +
        `have ${Math.round(available / 1_048_576)} MB. ` +
        `Set TMPDIR env var to a larger volume.`
      );
    }
  } catch (err: any) {
    if (err.message.startsWith("Insufficient")) throw err;
    // df not available in some containers — warn and continue
    console.warn("[download] Could not check disk space:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Main download function
// ─────────────────────────────────────────────────────────────
export async function downloadVideo(key: string): Promise<string> {
  const tempDir  = process.env.TMPDIR ?? "/tmp";
  const fileName = `${Date.now()}-${path.basename(key)}`;
  const tempPath = path.join(tempDir, fileName);

  await fsPromises.mkdir(tempDir, { recursive: true });

  // 1. Block until S3 object is fully committed
  //    (guards against upload race condition in production)
  const s3Size = await waitForS3Object(key);

  // 2. Ensure /tmp has room for download + re-encode + HLS
  await assertDiskSpace(s3Size * 3);

  // 3. Stream from S3 to disk
  const response = await s3.send(
    new GetObjectCommand({ Bucket: ENV.S3_BUCKET_NAME, Key: key })
  );

  if (!response.Body) {
    throw new Error("Empty S3 response body");
  }

  const writeStream = fs.createWriteStream(tempPath);
  await pipeline(response.Body as NodeJS.ReadableStream, writeStream);

  // 4. Wait for OS to flush all bytes to disk
  const writtenSize = await waitForFileStable(tempPath);

  // 5. Confirm written size matches what S3 reported
  //    A mismatch means the stream was cut short (network drop or disk full)
  if (writtenSize < s3Size * 0.99) {
    await fsPromises.unlink(tempPath).catch(() => {});
    throw new Error(
      `Download truncated: expected ${s3Size} bytes, got ${writtenSize}. ` +
      `Possible disk full or network interruption.`
    );
  }

  console.log(`✅ Downloaded: ${tempPath} — written=${writtenSize} s3=${s3Size}`);

  // 6. Validate container with ffprobe
  const isValid = await validateVideo(tempPath);
  if (!isValid) {
    await fsPromises.unlink(tempPath).catch(() => {});
    throw new Error("Downloaded video is corrupted");
  }

  return tempPath;
}