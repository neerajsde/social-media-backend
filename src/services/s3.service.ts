import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { s3 } from "./aws.js";
import { ENV } from "../config/env.js";

export const uploadToS3 = async (
  filePath: string,
  key: string,
  contentType = "video/mp4"
): Promise<string> => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    const fileStream = fs.createReadStream(filePath);
    const stats = fs.statSync(filePath);

    const command = new PutObjectCommand({
      Bucket: ENV.S3_BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: contentType,

      //  Important for CDN + performance
      ContentLength: stats.size,
      CacheControl: "public, max-age=31536000, immutable",

      //  optional but good practice
      ACL: "private",

      Metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(filePath),
      },
    });

    await s3.send(command);

    return `${key}`;

  } catch (err: any) {
    console.error("S3 Upload Error:", err.message);
    throw new Error("S3 upload failed");
  }
};