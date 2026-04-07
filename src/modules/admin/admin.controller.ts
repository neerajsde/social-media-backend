import jwt from "jsonwebtoken";
import type { JwtPayload as JwtLibPayload } from "jsonwebtoken";
import type { JwtPayload } from "../../types/jwt.types.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";
import bcrypt from "bcryptjs";
import { generateOTP, generateToken, verifyOTP } from "../../utils/core.js";
import { getClientIp, getDeviceInfo } from "../auth/auth.service.js";
import { hashValue, loginTokens, signAccessToken, signRefreshToken } from "./admin.service.js";
import { setAuthCookie } from "./admin.service.js";
import { requireSuperAdmin, findAdminByIdOrUserId } from "./admin.service.js";
import { redisClient, REDIS_KEYS } from "../../config/redis.config.js";
import { ENV } from "../../config/env.js";
import { sendAdminLoginOtp } from "../../mails/email-producer.js";

const MAXIMUM_LOGGEDIN_DEVICE = 5;

export const adminLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
    include: {
      admin: true,
    },
  });

  if (!user || !user.admin) {
    throw new ApiError(403, "Invalid credentials");
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new ApiError(403, "Invalid credentials");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Account ${user.status}`);
  }

  if (!user.admin.isApproved || user.admin.status !== "active") {
    throw new ApiError(403, "Admin not allowed");
  }

  const admin = user.admin;
  const ip = getClientIp(req);

  const device = getDeviceInfo(req);

  await prisma.$transaction(async (tx) => {
    // 1️⃣ Check if device already exists
    const existingDevice = await tx.userSession.findFirst({
      where: {
        userId: user.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        os: device.os,
        expiresAt: { gt: new Date() },
      },
    });

    // If same device already logged in → allow
    if (existingDevice) {
      return;
    }

    // 2️⃣ Count unique active devices
    const devices = await tx.adminSession.findMany({
      where: {
        adminId: user.id,
        expiresAt: { gt: new Date() },
      },
      distinct: ["deviceName", "deviceType", "os"],
      select: {
        deviceName: true,
        deviceType: true,
        os: true,
      },
    });

    if (devices.length >= MAXIMUM_LOGGEDIN_DEVICE) {
      throw new ApiError(429, "Maximum device limit reached (5)");
    }
  });

  const totp = await prisma.adminTotp.findFirst({
    where: { adminId: admin.id },
    select: { enabled: true },
  });

  if (!totp?.enabled) {
    const tokens = await loginTokens({
      adminId: admin.id,
      role: admin.role,
      ip,
      device: {
        name: device.deviceName,
        type: device.deviceType,
        os: device.os,
        browser: device.browser,
      },
    });

    setAuthCookie(res, tokens.accessToken);

    return res.json({
      success: true,
      message: "Admin logged in",
      refreshToken: tokens.refreshToken,
    });
  }

  const activeOtp = await prisma.adminOtp.findFirst({
    where: {
      adminId: admin.id,
      purpose: "ADMIN_LOGIN",
      expiresAt: { gt: new Date() },
    },
  });

  if (activeOtp) {
    throw new ApiError(429, "OTP already sent. Try later.");
  }

  const { otp, otpHash } = generateOTP();
  const { token, tokenHash } = generateToken();

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.$transaction([
    prisma.adminOtp.create({
      data: {
        adminId: admin.id,
        purpose: "ADMIN_LOGIN",
        codeHash: otpHash,
        expiresAt,
      },
    }),

    prisma.adminTokenHash.create({
      data: {
        tokenHash,
        userIp: ip,
        adminId: admin.id,
        expiresAt,
      },
    }),
  ]);

  sendAdminLoginOtp({
    email: user.email,
    otp
  });

  return res.json({
    success: true,
    authentication: true,
    message: "OTP sent to your email",
    token,
  });
});

export const adminLoginOtpVerify = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;

  const ip = getClientIp(req);
  const tokenHash = hashValue(token);

  const storedToken = await prisma.adminTokenHash.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken || storedToken.userIp !== ip) {
    throw new ApiError(400, "Invalid or expired token");
  }

  const storedOtp = await prisma.adminOtp.findFirst({
    where: {
      adminId: storedToken.adminId,
      purpose: "ADMIN_LOGIN",
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedOtp) {
    throw new ApiError(400, "OTP expired");
  }

  const isValidOtp = verifyOTP(otp, storedOtp.codeHash);
  if (!isValidOtp) {
    throw new ApiError(400, "Invalid OTP");
  }

  await prisma.$transaction([
    prisma.adminOtp.delete({ where: { id: storedOtp.id } }),
    prisma.adminTokenHash.delete({ where: { id: storedToken.id } }),
  ]);

  const device = getDeviceInfo(req);
  const admin = await prisma.admin.findUnique({
    where: { id: storedOtp.adminId },
  });
  if (!admin) {
    throw new ApiError(400, "Admin not found");
  }

  const tokens = await loginTokens({
    adminId: storedOtp.adminId,
    role: admin.role,
    ip,
    device: {
      name: device.deviceName,
      type: device.deviceType,
      os: device.os,
      browser: device.browser,
    },
  });

  setAuthCookie(res, tokens.accessToken);

  return res.json({
    success: true,
    message: "Admin logged in",
    refreshToken: tokens.refreshToken,
  });
});

export const assignAdmin = asyncHandler(async (req, res) => {
  const adminId = req.session?.userId;
  const { userId, role, permissions = [] } = req.body;

  if (!adminId) {
    throw new ApiError(400, "Admin id is required");
  }

  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  if (!role) {
    throw new ApiError(400, "Role is required");
  }

  if (!Array.isArray(permissions)) {
    throw new ApiError(400, "Permissions must be an array");
  }

  const admin = await requireSuperAdmin(adminId);

  const existingAdmin = await prisma.admin.findUnique({
    where: { userId: userId },
  });

  if (existingAdmin) {
    throw new ApiError(409, "This user already exists");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(400, `user account is ${user.status}`);
  }

  const createAdmin = await prisma.admin.create({
    data: {
      userId: user.id,
      role: role,
      status: "inactive",
      permissions: permissions,
      createdBy: admin.id,
    },
  });

  if (!createAdmin) throw new ApiError(500, "Failed to add admin");

  return res.status(200).json({
    success: true,
    message: "New admin added",
  });
});

export const activateAdmin = asyncHandler(async (req, res) => {
  const { sourceAdminId } = req.body;
  const adminId = req.session?.userId;

  if (!adminId) {
    throw new ApiError(400, "Admin id is required");
  }

  if (!sourceAdminId) {
    throw new ApiError(400, "Target admin id is required");
  }

  await requireSuperAdmin(adminId);

  const existingAdmin = await findAdminByIdOrUserId(sourceAdminId);

  if (!existingAdmin) {
    throw new ApiError(404, "Invalid admin");
  }

  if (!existingAdmin.isApproved) {
    throw new ApiError(400, "User account unapproved");
  }

  if (existingAdmin.status !== "inactive") {
    throw new ApiError(400, `User account ${existingAdmin.status}`);
  }

  await prisma.admin.update({
    where: { id: existingAdmin.id },
    data: {
      status: "active",
      activitedAt: new Date(Date.now()),
      activatedBy: adminId,
    },
  });

  return res.status(200).json({
    success: true,
    message: "This admin activated",
  });
});

export const approveAdmin = asyncHandler(async (req, res) => {
  const { sourceAdminId } = req.body;
  const adminId = req.session?.userId;

  if (!adminId) {
    throw new ApiError(400, "Admin id is required");
  }

  if (!sourceAdminId) {
    throw new ApiError(400, "Target admin id is required");
  }

  await requireSuperAdmin(adminId);

  const existingAdmin = await findAdminByIdOrUserId(sourceAdminId);

  if (!existingAdmin) {
    throw new ApiError(404, "Invalid admin");
  }

  if (existingAdmin.isApproved) {
    throw new ApiError(409, "Admin already approved");
  }

  await prisma.admin.update({
    where: { id: existingAdmin.id },
    data: {
      isApproved: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Admin approved",
  });
});

export const getAdminDetails = asyncHandler(async (req, res) => {
  const adminId = req.session?.userId;

  if (!adminId) {
    throw new ApiError(401, "Unautherized");
  }

  const cache = await redisClient.get(REDIS_KEYS.adminData(adminId));
  if (cache) {
    return res.status(200).json({
      success: true,
      message: "Fetched admin details",
      data: JSON.parse(cache),
    });
  }

  const admin = await prisma.admin.findFirst({
    where: { id: adminId },
    select: {
      id: true,
      userId: true,
      isApproved: true,
      status: true,
      permissions: true,
      role: true,
      user: {
        select: {
          username: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!admin) {
    throw new ApiError(404, "Not Found");
  }

  if (!admin.isApproved) {
    throw new ApiError(400, "Your account is not approved");
  }

  if (admin.status !== "active") {
    throw new ApiError(400, `Account is ${admin.status}`);
  }

  if (!admin.user) {
    throw new ApiError(400, "User details not found");
  }

  const data = {
    admin: admin.user,
    permissions: admin.permissions,
    role: admin.role,
  };

  await redisClient.set(REDIS_KEYS.adminData(admin.id), JSON.stringify(data), {
    EX: 5 * 60,
  });

  return res.status(200).json({
    success: true,
    message: "Fetched admin details",
    data,
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, "Invalid token");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, ENV.JWT_ADMIN_REFRESH_SECRET) as JwtPayload & JwtLibPayload;
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Token expired");
    }

    throw new ApiError(401, "Invalid token");
  }

  const hashToken = hashValue(token);
  const sessionDB = await prisma.adminSession.findFirst({
    where: {
      adminId: decoded.sessionId,
      refreshTokenHash: hashToken,
      expiresAt: { gte: new Date() },
    },
    include:{
      admin: true,
    }
  });

  if (!sessionDB) {
    throw new ApiError(400, "Invalid or expired token");
  }

  const ip = getClientIp(req);
  const device = getDeviceInfo(req);

  if (
    sessionDB.ipAddress !== ip ||
    sessionDB.os !== device.os ||
    sessionDB.deviceType !== device.deviceType
  ) {
    throw new ApiError(400, "Invalid request");
  }

  if(!sessionDB.admin.isApproved){
    throw new ApiError(400, "Account anapproved");
  }

  if(sessionDB.admin.status !== "active"){
    throw new ApiError(400, `Account is ${sessionDB.admin.status}`);
  }

  const access = signAccessToken({sessionId: sessionDB.id, role: sessionDB.admin.role});
  const refresh = signRefreshToken({sessionId: sessionDB.admin.id, role: sessionDB.admin.role});

  await prisma.adminSession.update({
    where: {id: sessionDB.id},
    data:{
      previousTokenHash: hashToken,
      refreshTokenHash: refresh.hash,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
  });

  setAuthCookie(res, access.token);

  return res.status(200).json({
    success: true,
    message: "New Token",
    refreshToken: refresh.token
  });

});

export const logout = asyncHandler(async (req, res) => {
  const session = req.session;
  const token = session?.token;
  const adminId = session?.userId;
  const sessionId = session?.id;

  if (!adminId || !sessionId || !token) {
    throw new ApiError(400, "Invalid logout request");
  }

  const sessionDb = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    select: { id: true, adminId: true },
  });

  if (!sessionDb || sessionDb.adminId !== adminId) {
    throw new ApiError(403, "Session mismatch");
  }

  await Promise.all([
    prisma.adminSession.deleteMany({
      where: { id: sessionId, adminId: adminId },
    }),
    redisClient.set(REDIS_KEYS.blacklistToken(token), "1", {
      EX: 60 * 60 * 24 * 7,
    }), // 7 days
    redisClient.del(REDIS_KEYS.adminData(adminId)),
  ]);

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const logoutAllDevices = asyncHandler(async (req, res) => {
  const session = req.session;
  const token = session?.token;
  const adminId = session?.userId;

  if (!adminId || !token) {
    throw new ApiError(400, "Invalid logout request");
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, isApproved: true, status: true },
  });

  if (!admin || !admin.isApproved || admin.status !== "active") {
    throw new ApiError(403, "Invalid admin");
  }

  await Promise.all([
    prisma.adminSession.deleteMany({
      where: { adminId: adminId },
    }),
    redisClient.set(REDIS_KEYS.blacklistToken(token), "1", {
      EX: 60 * 60 * 24 * 7,
    }), // 7 days
    redisClient.del(REDIS_KEYS.adminData(adminId)),
  ]);

  res.status(200).json({
    success: true,
    message: "Logged out from all devices successfully",
  });
});
