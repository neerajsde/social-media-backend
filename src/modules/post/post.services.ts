import { prisma } from "../../config/prisma.config.js"
import { ApiError } from "../../utils/api-error.js";
import { ENV } from "../../config/env.js";
import axios from "axios";

export async function verifyFileKey(userId: string, fileKey: string, ipAddress: string): Promise<boolean>{
    try{
        const upload = await prisma.awsUploads.findFirst({
            where: { fileKey, userId, ipAddress }
        });

        if (!upload) {
            return false;
        }

        if (upload.ipAddress !== ipAddress) {
            return false;
        }

        if (upload.status !== "CREATED") {
            return false;
        }

        const maxAgeMs = 10 * 60 * 1000;
        if (Date.now() - upload.createdAt.getTime() > maxAgeMs) {
            return false;
        }

        const fileUrl = `${ENV.AWS_CDN_URL}/${fileKey}`;

        try {
            const headRes = await axios.head(fileUrl, {
                timeout: 3000,
                maxRedirects: 0,
                validateStatus: (status) => status === 200,
            });

            if (headRes.status !== 200) {
                return false;
            }
        } catch {
            return false;
        }

        return true;
    } catch(err){
        return false;
    }
}

export async function verifyFileKeys(
    userId: string,
    fileKeys: string[],
    ipAddress: string
): Promise<boolean> {
    try {
        if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
            throw new ApiError(400, "fileKeys must be a non-empty array");
        }

        const results = await Promise.all(
            fileKeys.map((key) =>
                verifyFileKey(userId, key, ipAddress)
            )
        );

        return results.every((res) => res === true);

    } catch (err) {
        return false;
    }
}