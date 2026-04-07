import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload as JwtLibPayload } from "jsonwebtoken";

import type { JwtPayload } from "../types/jwt.types.js";
import type { AuthSession } from "../types/auth.types.js";

import { ENV } from "../config/env.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { REDIS_KEYS, redisClient } from "../config/redis.config.js";
import { prisma } from "../config/prisma.config.js";
import { getClientIp } from "../modules/auth/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      session?: AuthSession;
    }
  }
}

type Role = "user" | "admin" | "superadmin" | "moderator" | "support";
type AuthType = Role;

const ADMIN_ROLES: Role[] = ["admin", "superadmin", "moderator", "support"];

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  support: 1,
  moderator: 2,
  admin: 3,
  superadmin: 4,
};

const isRole = (value: string): value is Role =>
  (["user", "admin", "superadmin", "moderator", "support"] as const).includes(
    value as Role,
  );

export const requireRoles = (...roles: Role[]) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const role = req.session?.role;

    if (!role) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!roles.includes(role)) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  });

export const requireMinRole = (minRole: Role) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const role = req.session?.role;

    if (!role) {
      throw new ApiError(401, "Unauthorized");
    }

    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      throw new ApiError(403, "Forbidden");
    }

    next();
  });

export const createVerifyToken = (type: AuthType | AuthType[]) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const allowedTypes = Array.isArray(type) ? type : [type];
    const isUserRoute = allowedTypes.length === 1 && allowedTypes[0] === "user";

    /* ========== AUTH HEADER ========== */
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;

    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (cookieToken) {
      token = String(cookieToken).trim();
    }

    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }

    /* ========== BLACKLIST ========== */
    const isBlacklisted = await redisClient.get(
      REDIS_KEYS.blacklistToken(token),
    );

    if (isBlacklisted) {
      throw new ApiError(401, "Token revoked");
    }

    /* ========== JWT VERIFY ========== */
    const secret = isUserRoute
      ? ENV.JWT_ACCESS_SECRET
      : ENV.JWT_ADMIN_ACCESS_SECRET;

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, secret) as JwtPayload & JwtLibPayload;
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, "Token expired");
      }

      throw new ApiError(401, "Invalid token");
    }

    if (!decoded?.sessionId || !decoded?.role || !isRole(decoded.role)) {
      throw new ApiError(401, "Invalid token payload");
    }

    /* ========== FETCH SESSION ========== */
    let sessionDb: any;

    if (isUserRoute) {
      if (decoded.role !== "user") {
        throw new ApiError(401, "Invalid token payload");
      }

      sessionDb = await prisma.userSession.findUnique({
        where: { id: decoded.sessionId },
        select: {
          id: true,
          userId: true,
          deviceName: true,
          deviceType: true,
          os: true,
          browser: true,
          ipAddress: true,
          revokedAt: true,
          expiresAt: true,
        },
      });
    } else {
      if (!ADMIN_ROLES.includes(decoded.role)) {
        throw new ApiError(401, "Invalid token payload");
      }

      sessionDb = await prisma.adminSession.findUnique({
        where: { id: decoded.sessionId },
        select: {
          id: true,
          adminId: true,
          deviceName: true,
          deviceType: true,
          os: true,
          browser: true,
          ipAddress: true,
          revokedAt: true,
          expiresAt: true,
        },
      });
    }

    /* ========== VALIDATE SESSION ========== */
    if (!sessionDb || sessionDb.revokedAt || sessionDb.expiresAt < new Date()) {
      throw new ApiError(401, "Session expired");
    }

    /* ========== IP CHECK ========== */
    const ip = getClientIp(req);

    if (!ip || sessionDb.ipAddress !== ip) {
      throw new ApiError(401, "Session validation failed. Please login again.");
    }

    /* ========== ADMIN STATUS CHECK ========== */
    let effectiveRole: Role = decoded.role;

    if (!isUserRoute) {
      const adminRecord = await prisma.admin.findUnique({
        where: { id: sessionDb.adminId },
        select: {
          role: true,
          isApproved: true,
          status: true,
        },
      });

      if (!adminRecord) {
        throw new ApiError(403, "Admin not allowed");
      }

      if (!adminRecord.isApproved || adminRecord.status !== "active") {
        throw new ApiError(403, "Admin not allowed");
      }

      effectiveRole = adminRecord.role as Role;

      if (!allowedTypes.includes(effectiveRole)) {
        throw new ApiError(403, "Forbidden");
      }
    }

    /* ========== ATTACH SESSION ========== */

    const session: AuthSession = {
      id: sessionDb.id,
      userId: isUserRoute ? sessionDb.userId : sessionDb.adminId,
      deviceName: sessionDb.deviceName,
      deviceType: sessionDb.deviceType,
      os: sessionDb.os,
      browser: sessionDb.browser,
      ipAddress: sessionDb.ipAddress,
      role: effectiveRole,
      token,
    };

    req.session = session;

    next();
  });
