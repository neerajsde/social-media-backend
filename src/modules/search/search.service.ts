import { prisma } from "../../config/prisma.config.js";
import { redisClient, REDIS_KEYS } from "../../config/redis.config.js";
import { searchQueue } from "../../queues/search.queue.js";
import { ApiError } from "../../utils/api-error.js";

// Helper for sending generic results based on DB queries
const searchUsers = async (query: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query, mode: "insensitive" } },
        { first_name: { contains: query, mode: "insensitive" } },
        { last_name: { contains: query, mode: "insensitive" } },
      ],
      status: "active",
    },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      avatarUrl: true,
      isVerified: true,
      batch: true,
    },
    skip,
    take: limit,
  });

  return users;
};

const searchTags = async (query: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const tags = await prisma.hashtag.findMany({
    where: {
      tag: { contains: query.replace("#", ""), mode: "insensitive" },
    },
    select: {
      id: true,
      tag: true,
      _count: {
        select: { posts: true },
      },
    },
    orderBy: {
      posts: { _count: "desc" },
    },
    skip,
    take: limit,
  });

  return tags;
};

const searchExploreFeed = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const cacheKey = `globals:explore_feed:page_${page}:limit_${limit}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("Explore Feed Cache Read Error:", err);
  }

  const posts = await prisma.post.findMany({
    where: {
      postType: { in: ["image", "video", "reel"] },
      status: "active",
      visibility: "public",
    },
    select: {
      id: true,
      postType: true,
      images: true,
      video: {
        select: {
          originalVideo: true,
          hlsMasterKey: true,
          thumbnail: true,
        },
      },
      likeCount: true,
      commentCount: true,
      viewCount: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { viewCount: "desc" },
      { likeCount: "desc" },
      { createdAt: "desc" },
    ],
    skip,
    take: limit,
  });

  const formattedFeed = posts.map((post) => ({
    id: post.id,
    type: post.postType,
    mediaUrl:
      post.postType === "image"
        ? post.images[0]
        : post.video?.hlsMasterKey || post.video?.originalVideo,
    thumbnail:
      post.video?.thumbnail ||
      (post.postType === "image" ? post.images[0] : null),
    images: post.images, // If it's a carousel
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: Number(post.viewCount), // Cast BigInt so it can be serialized
    author: post.user,
  }));

  try {
    // Cache for 5 minutes (300 seconds)
    await redisClient.set(cacheKey, JSON.stringify(formattedFeed), { EX: 300 });
  } catch (err) {
    console.error("Explore Feed Cache Write Error:", err);
  }

  return formattedFeed;
};

export const getTrendingSearches = async (limit: number) => {
  // Fetch trending from Redis ZSET
  const trending = await redisClient.zRangeWithScores(
    "globals:trending_searches",
    0,
    limit - 1,
    {
      REV: true,
    }
  );

  return trending.map((item) => ({
    query: item.value,
    score: item.score,
  }));
};

const searchPosts = async (query: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const keyword = query.trim();

  const posts = await prisma.post.findMany({
    where: {
      status: "active",
      visibility: "public",
      OR: [
        { content: { contains: keyword, mode: "insensitive" } },
        {
          hashtags: {
            some: {
              hashtag: {
                tag: { contains: keyword.replace("#", ""), mode: "insensitive" },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      postType: true,
      content: true,
      images: true,
      video: {
        select: {
          originalVideo: true,
          hlsMasterKey: true,
          thumbnail: true,
        },
      },
      likeCount: true,
      commentCount: true,
      viewCount: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      hashtags: {
        select: {
          hashtag: {
            select: {
              tag: true,
            },
          },
        },
      },
    },
    orderBy: [
      { likeCount: "desc" },
      { viewCount: "desc" },
      { createdAt: "desc" },
    ],
    skip,
    take: limit,
  });

  return posts.map((post) => ({
    id: post.id,
    type: post.postType,
    content: post.content,
    mediaUrl:
      post.postType === "image"
        ? post.images[0]
        : post.video?.hlsMasterKey || post.video?.originalVideo,
    thumbnail:
      post.video?.thumbnail ||
      (post.postType === "image" ? post.images[0] : null),
    images: post.images,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: Number(post.viewCount),
    createdAt: post.createdAt,
    tags: post.hashtags.map((h) => h.hashtag.tag),
    author: post.user,
  }));
};

export const executeSearch = async ({
  userId,
  query,
  type,
  page,
  limit,
}: {
  userId: string;
  query: string;
  type: string;
  page: number;
  limit: number;
}) => {
  const normalizedQuery = query.trim().toLowerCase();
  let results: any = [];

  // TODO: Replace with Elasticsearch when available
  switch (type) {
    case "foryou":
      if (normalizedQuery === "default") {
        results = await searchExploreFeed(page, limit);
      } else {
        results = await searchUsers(query, page, limit);
      }
      break;
    case "account":
      results = await searchUsers(query, page, limit);
      break;
    case "tags":
      results = await searchTags(query, page, limit);
      break;
    case "posts":
      results = await searchPosts(query, page, limit);
      break;
    case "trending":
      results = await getTrendingSearches(limit);
      break;
    default:
      results = await searchUsers(query, page, limit);
  }

  // Push event to BullMQ if it's a real query string
  if (normalizedQuery && normalizedQuery !== "default" && type !== "trending") {
    await searchQueue.add(
      "record_search",
      {
        userId,
        query: query.trim(),
        normalizedQuery,
        type,
        resultCount: results.length,
        timestamp: new Date().toISOString(),
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  }

  return results;
};

export const getRecentSearches = async (userId: string, limit: number) => {
  const key = `recent_searches:${userId}`;

  // 1. Fetch from Redis Cache
  const cachedSearches = await redisClient.zRangeWithScores(
    key,
    0,
    limit - 1,
    {
      REV: true,
    }
  );

  if (cachedSearches.length > 0) {
    return cachedSearches.map((item) => {
      try {
        const parsed = JSON.parse(item.value);
        return {
          id: parsed.id,
          query: parsed.query,
          type: parsed.type,
          createdAt: new Date(parsed.createdAt),
          timestamp: new Date(item.score).toISOString(),
        };
      } catch (e) {
        // Fallback for old plain-text cache strings
        return {
          id: undefined,
          query: item.value,
          type: "search",
          createdAt: new Date(item.score),
          timestamp: new Date(item.score).toISOString(),
        };
      }
    });
  }

  // 2. Cache Miss - Fallback to Database
  const history = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    distinct: ["queryNormalized"], // Ensure distinct queries
  });

  // 3. Re-populate Cache
  if (history.length > 0) {
    Promise.all(
      history.map((item) =>
        redisClient.zAdd(key, {
          score: item.createdAt.getTime(),
          value: JSON.stringify({
            id: item.id,
            query: item.query,
            type: item.type,
            createdAt: item.createdAt,
          }),
        })
      )
    )
      .then(() => redisClient.expire(key, 60))
      .catch((e) => console.error("Redis Cache Error", e));
  }

  return history.map((item) => ({
    id: item.id,
    query: item.query,
    type: item.type,
    createdAt: item.createdAt,
    timestamp: item.createdAt.toISOString(),
  }));
};

export const removeRecentSearch = async (userId: string, historyId: string) => {
  const historyItem = await prisma.searchHistory.findFirst({
    where: { id: historyId, userId },
  });

  if (!historyItem) {
    throw new ApiError(404, "Search history not found");
  }

  const key = `recent_searches:${userId}`;

  // Remove from both Redis and Database concurrently
  await Promise.all([
    redisClient.del(key),
    prisma.searchHistory.delete({ where: { id: historyId } }),
  ]);
};