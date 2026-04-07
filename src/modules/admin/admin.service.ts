import { prisma } from "../../config/prisma.config.js";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../../types/jwt.types.js";
import { ENV } from "../../config/env.js";
import crypto from "crypto";
import { ApiError } from "../../utils/api-error.js";
import type { Response } from "express";

export const hashValue = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const signAccessToken = (payload: JwtPayload) => {
  const token = jwt.sign(payload as object, ENV.JWT_ADMIN_ACCESS_SECRET, {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);

  return {
    token,
    hash: hashValue(token),
  };
};

export const signRefreshToken = (payload: JwtPayload) => {
  const token = jwt.sign(payload as object, ENV.JWT_ADMIN_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);

  return {
    token,
    hash: hashValue(token),
  };
};

type Role = "user" | "admin" | "superadmin" | "moderator" | "support";
type UserLogin = {
  adminId: string;
  ip: string;
  role: Role;
  device: {
    name: string;
    type: string;
    os: string;
    browser: string;
  };
};

export async function loginTokens(
  data: UserLogin,
): Promise<{ accessToken: string; refreshToken: string }> {
  const refresh = signRefreshToken({ sessionId: data.adminId, role: data.role });

  const adminSession = await prisma.adminSession.create({
    data: {
      adminId: data.adminId,
      refreshTokenHash: refresh.hash,
      deviceName: data.device.name,
      deviceType: data.device.type,
      os: data.device.os,
      browser: data.device.browser,
      ipAddress: data.ip,

      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 1000),
    },
  });

  if (!adminSession) {
    throw new ApiError(500, "Faild to login");
  }

  const access = signAccessToken({ sessionId: adminSession.id, role: data.role });

  return { accessToken: access.token, refreshToken: refresh.token };
}

export function setAuthCookie(res: Response, token: String) {
  const isProd = ENV.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const requireSuperAdmin = async (adminId: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      role: true,
      isApproved: true,
      status: true,
    },
  });

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  if (admin.role !== "superadmin") {
    throw new ApiError(403, "Forbidden");
  }

  if (!admin.isApproved) {
    throw new ApiError(403, "Unauthorized");
  }

  if (admin.status !== "active") {
    throw new ApiError(403, `Admin account is ${admin.status}`);
  }

  return admin;
};

export const findAdminByIdOrUserId = async (id: string) => {
  return prisma.admin.findFirst({
    where: {
      OR: [{ id }, { userId: id }],
    },
  });
};
