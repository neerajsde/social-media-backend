import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../config/prisma.config.js";
import { ENV } from "../config/env.js";

interface SearchJobData {
  userId: string;
  query: string;
  normalizedQuery: string;
  type: "foryou" | "account" | "trending" | "tags" | "posts";
  resultCount: number;
}

const connection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
});

async function processSearchJob(job: Job<SearchJobData>) {
  const { userId, query, normalizedQuery, type, resultCount } = job.data;

  try {
    // Determine targetUserId if type is account and exactly one result matches perfectly
    // This is optional and simple for now. ML service / Advanced ES will handle this better.
    let targetUserId = null;
    if (type === "account") {
      const match = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: normalizedQuery, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (match) {
        targetUserId = match.id;
      }
    }

    // Insert to DB using Prisma
    await prisma.searchHistory.create({
      data: {
        userId,
        query,
        queryNormalized: normalizedQuery,
        type,
        resultCount,
        targetUserId,
        clickedResult: false,
        metadata: { source: "api_search" }, // Basic metadata for now
      },
    });

    if (ENV.NODE_ENV === "development") {
      console.log(
        `Recorded search history for User: ${userId}, Query: ${query}`
      );
    }
  } catch (error) {
    console.error("Error processing search job:", error);
    throw error; // Re-throw to let BullMQ handle retries
  }
}

export default new Worker<SearchJobData>("search-worker", processSearchJob, {
  connection: connection as any,
});
