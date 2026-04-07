import { prisma } from "../../config/prisma.config.js";
import type { ActivitySource, ActivityType } from "../../generated/prisma/enums.js";

interface LogActivityOptions {
  userId: string;
  postId: string;
  type: ActivityType;
  source?: ActivitySource;
  durationSec?: number;
  metadata?: Record<string, any>;
}

export const logActivityService = async ({
  userId,
  postId,
  type,
  source = "feed",
  durationSec,
  metadata,
}: LogActivityOptions) => {
  return prisma.userActivity.create({
    data: {
      userId,
      postId,
      type,
      source,
      durationSec: durationSec ?? 0,
      metadata: metadata ?? "none",
    },
  });
};

export const getUserActivityService = async (
  userId: string,
  page: number,
  limit: number
) => {
  const skip = (page - 1) * limit;

  const [activities, total] = await Promise.all([
    prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        type: true,
        source: true,
        durationSec: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            postType: true,
            images: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
                isVerified: true,
              },
            },
          },
        },
      },
    }),
    prisma.userActivity.count({ where: { userId } }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + activities.length < total,
    },
  };
};

export const getPostActivityStatsService = async (postId: string) => {
  const stats = await prisma.userActivity.groupBy({
    by: ["type"],
    where: { postId },
    _count: { type: true },
  });

  // shape into { view: 10, like: 5, ... }
  return stats.reduce(
    (acc, s) => ({ ...acc, [s.type]: s._count.type }),
    {} as Record<ActivityType, number>
  );
};

export const getActivitySummaryService = async (userId: string) => {
  const [byType, bySource, recentPosts] = await Promise.all([
    // breakdown by activity type
    prisma.userActivity.groupBy({
      by: ["type"],
      where: { userId },
      _count: { type: true },
    }),

    // breakdown by source
    prisma.userActivity.groupBy({
      by: ["source"],
      where: { userId },
      _count: { source: true },
    }),

    // last 5 distinct posts interacted with
    prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      distinct: ["postId"],
      take: 5,
      select: {
        type: true,
        source: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            content: true,
            postType: true,
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    byType: byType.reduce(
      (acc, s) => ({ ...acc, [s.type]: s._count.type }),
      {} as Record<string, number>
    ),
    bySource: bySource.reduce(
      (acc, s) => ({ ...acc, [s.source]: s._count.source }),
      {} as Record<string, number>
    ),
    recentPosts,
  };
};