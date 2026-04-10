import { prisma } from "../../config/prisma.config.js";
import { redisClient, REDIS_KEYS } from "../../config/redis.config.js";

export const getUserStats = async () => {
  const cacheKey = REDIS_KEYS.dashboardStats();
  const cachedStats = await redisClient.get(cacheKey);

  if (cachedStats) {
    return JSON.parse(cachedStats);
  }

  const [total, active, verified, premium, newUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const stats = {
    total,
    active,
    verified,
    premium,
    newUsers,
  };

  await redisClient.setEx(cacheKey, 3600, JSON.stringify(stats)); // Cache for 1 hour

  return stats;
};

export const getUserList = async (params: {
  page: number;
  limit: number;
  search?: string;
  status?: any;
  batch?: any;
}) => {
  const { page, limit, search, status, batch } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
  };

  if (search && search.trim()) {
    where.OR = [
      { username: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
      { first_name: { contains: search.trim(), mode: "insensitive" } },
      { last_name: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  if (status && status.trim()) {
    where.status = status.trim();
  }

  if (batch && batch.trim()) {
    where.batch = batch.trim();
  }

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        first_name: true,
        last_name: true,
        avatarUrl: true,
        isVerified: true,
        status: true,
        batch: true,
        isPremium: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const getUserGrowth = async () => {
  const cacheKey = REDIS_KEYS.dashboardGrowth();
  const cachedGrowth = await redisClient.get(cacheKey);

  if (cachedGrowth) {
    return JSON.parse(cachedGrowth);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // High-performance aggregation using PostgreSQL core functions
  const growthResults: any[] = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('day', "createdAt") as date,
      COUNT(*)::int as count
    FROM "User"
    WHERE "createdAt" >= ${thirtyDaysAgo} AND "deletedAt" IS NULL
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC
  `;

  const formattedGrowth = growthResults.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    count: row.count,
  }));

  await redisClient.setEx(cacheKey, 3600, JSON.stringify(formattedGrowth)); // Cache for 1 hour

  return formattedGrowth;
};
