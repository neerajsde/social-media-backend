import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import type {
  ObjectIdentifier,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
import { invalidateCache } from "./aws-cloudfront.js";
import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.config.js";

export const s3 = new S3Client({
  region: ENV.AWS_REGION,
  credentials: {
    accessKeyId: ENV.AWS_ACCESS_KEY_ID,
    secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
  },
});

const bucket = ENV.S3_BUCKET_NAME;

// -------------------
// GENERATE UPLOAD URL
// -------------------
export async function generateUploadURL(
  contentType: string,
  filename: string | null = null
): Promise<{ url: string; key: string, contentType: string }> {
  const ext = contentType.split("/")[1] ?? "bin";
  const fileKey = filename ? `${filename}.${ext}` : `${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { url, key: fileKey, contentType };
}

export async function generateMultipleUploadURLs(
  contentTypes: string[] = []
): Promise<Array<{ url: string; key: string, contentType: string }>> {
  const uploads: Array<{ url: string; key: string, contentType: string }> = [];

  for (const type of contentTypes) {
    const upload = await generateUploadURL(type);
    uploads.push(upload);
  }

  return uploads;
}

// ---------------
// DELETE ONE FILE
// ---------------
export async function deleteFile(key: string, userId: string | null = null): Promise<boolean> {
  try {
    const cmd = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    // Invalidate CloudFront cache first (non-blocking is also an option)
    await invalidateCache([`/${key}`]);

    if(userId){
      await prisma.awsUploads.updateMany({
          where: {
              fileKey: key,
              userId
          },
          data: {
              status: "DELETED"
          }
      });
    }

    await s3.send(cmd);
    return true;
  } catch (err: unknown) {
    const error = err as Error;
    console.error("S3 Delete Error:", error.message);
    return false;
  }
}

// ----------------
// DELETE MULTIPLE
// ----------------
export async function deleteFiles(keys: string[] = [], userId: string | null = null): Promise<boolean> {
  try {
    if (!keys.length) return false;

    const objects: ObjectIdentifier[] = keys.map((k) => ({ Key: k }));

    const cmd = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: objects,
      },
    });

    // Invalidate CloudFront cache
    await invalidateCache(keys.map((key) => `/${key}`));

    if(userId){
      await prisma.awsUploads.updateMany({
        where: {
            fileKey: {
                in: keys
            },
            userId
        },
        data: {
            status: "DELETED"
        }
      });
    }

    await s3.send(cmd);
    return true;
  } catch (err: unknown) {
    const error = err as Error;
    console.error("S3 Bulk Delete Error:", error.message);
    return false;
  }
}

// ----------------
// LIST ALL FILE KEYS
// ----------------
export async function getAllKeys(): Promise<string[]> {
  try {
    const keys: string[] = [];
    let continuationToken: string | undefined = undefined;

    // loop because S3 returns max 1000 objects per request
    do {
      const cmd: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });

      const res = await s3.send(cmd);

      if (res.Contents?.length) {
        keys.push(
          ...res.Contents
            .map((obj) => obj.Key)
            .filter((key): key is string => Boolean(key))
        );
      }

      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  } catch (err: unknown) {
    const error = err as Error;
    console.error("S3 List Error:", error.message);
    return [];
  }
}
