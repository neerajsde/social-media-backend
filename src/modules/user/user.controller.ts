import axios from "axios";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";
import { redisClient, REDIS_KEYS } from "../../config/redis.config.js";
import { generateOTP, verifyOTP, generateToken } from "../../utils/core.js";
import {
  getClientIp,
  hashValue,
  isReservedUsername,
} from "../auth/auth.service.js";
import bcrypt from "bcryptjs";
import { generateUploadURL, deleteFile } from "../../services/aws.js";
import { ENV } from "../../config/env.js";
import logger from "../../utils/logger.js";
import {
  sendChangeEmailOtp,
  sendChangePasswordOtp,
} from "../../mails/email-producer.js";

export const generatePresignedUrl = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { mimeType } = req.body;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!mimeType) {
    throw new ApiError(400, "mimeType is required");
  }

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new ApiError(400, "Unsupported file type");
  }

  const { url, key } = await generateUploadURL(mimeType);
  const ip = getClientIp(req);
  await prisma.awsUploads.create({
    data: {
      userId,
      mimeType,
      fileKey: key,
      uploadUrl: url,
      ipAddress: ip,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Presigned URL generated",
    uploadUrl: url,
    fileKey: key,
  });
});

export const userProfile = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(404, "User id not found");
  }

  const usercache = await redisClient.get(REDIS_KEYS.userdata(userId));
  if (usercache) {
    const user = await JSON.parse(usercache);
    return res.status(200).json({
      success: true,
      message: "Fetched user data",
      user: user,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      isVerified: true,
      status: true,
      batch: true,
      isPremium: true,
      premiumEnds: true,
      createdAt: true,

      profile: {
        select: {
          gender: true,
          birthdate: true,
          location: true,
          websiteUrl: true,
          socialTwitter: true,
          socialFacebook: true,
          socialLinkedin: true,
          socialInstagram: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const [followerCount, followingCount] = await prisma.$transaction([
    prisma.follow.count({
      where: { followingId: userId },
    }),

    prisma.follow.count({
      where: { followerId: userId },
    }),
  ]);

  (user as any).follower = followerCount;
  (user as any).following = followingCount;

  await redisClient.set(REDIS_KEYS.userdata(userId), JSON.stringify(user), {
    EX: 300,
  });

  return res.status(200).json({
    success: true,
    message: "Fetched user data",
    user: user,
  });
});

export const updateAvatarUrl = asyncHandler(async (req, res) => {
  const { fileKey } = req.body as { fileKey?: string };
  const session = req.session;
  const userId = session?.userId;
  const ipAddress = session?.ipAddress;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!fileKey || typeof fileKey !== "string" || fileKey.length > 256) {
    throw new ApiError(400, "Invalid file key");
  }

  const [upload, user] = await Promise.all([
    prisma.awsUploads.findFirst({
      where: { fileKey, userId },
    }),

    prisma.user.findUnique({
      where: { id: userId },
    }),
  ]);

  if (!upload) {
    throw new ApiError(400, "Invalid file key");
  }

  if (upload.ipAddress !== ipAddress) {
    throw new ApiError(400, "Invalid session");
  }

  if (upload.status !== "CREATED") {
    throw new ApiError(409, `File is already ${upload.status}`);
  }

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - upload.createdAt.getTime() > maxAgeMs) {
    throw new ApiError(400, "Upload link expired");
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  const imgUrl = `${ENV.AWS_CDN_URL}/${fileKey}`;

  try {
    const headRes = await axios.head(imgUrl, {
      timeout: 3000,
      maxRedirects: 0,
      validateStatus: (status) => status === 200,
    });

    if (headRes.status !== 200) {
      throw new Error("Not found");
    }
  } catch {
    throw new ApiError(400, "File not found in storage");
  }

  // Atomic DB updates
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: imgUrl },
  });

  const updatedUpload = await prisma.awsUploads.update({
    where: { id: upload.id },
    data: { status: "USED" },
  });

  if (user.avatarUrl) {
    const oldKey = user.avatarUrl.replace(`${ENV.AWS_CDN_URL}/`, "");

    try {
      await deleteFile(oldKey, userId);
    } catch (err) {
      logger.error(
        `Failed to mark old avatar as DELETED for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  redisClient.del(REDIS_KEYS.userdata(userId)).catch(() => null);

  return res.status(200).json({
    success: true,
    message: "User avatar updated",
    avatarUrl: updatedUser.avatarUrl,
  });
});

export const updateBannerUrl = asyncHandler(async (req, res) => {
  const { fileKey } = req.body as { fileKey?: string };
  const session = req.session;
  const userId = session?.userId;
  const ipAddress = session?.ipAddress;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!fileKey || typeof fileKey !== "string" || fileKey.length > 256) {
    throw new ApiError(400, "Invalid file key");
  }

  const [upload, user] = await Promise.all([
    prisma.awsUploads.findFirst({
      where: { fileKey, userId },
    }),

    prisma.user.findUnique({
      where: { id: userId },
    }),
  ]);

  if (!upload) {
    throw new ApiError(400, "Invalid file key");
  }

  if (upload.ipAddress !== ipAddress) {
    throw new ApiError(400, "Invalid session");
  }

  if (upload.status !== "CREATED") {
    throw new ApiError(409, `File is already ${upload.status}`);
  }

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - upload.createdAt.getTime() > maxAgeMs) {
    throw new ApiError(400, "Upload link expired");
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  const imgUrl = `${ENV.AWS_CDN_URL}/${fileKey}`;

  try {
    const headRes = await axios.head(imgUrl, {
      timeout: 3000,
      maxRedirects: 0,
      validateStatus: (status) => status === 200,
    });

    if (headRes.status !== 200) {
      throw new Error("Not found");
    }
  } catch {
    throw new ApiError(400, "File not found in storage");
  }

  // Atomic DB updates
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { bannerUrl: imgUrl },
  });

  const updatedUpload = await prisma.awsUploads.update({
    where: { id: upload.id },
    data: { status: "USED" },
  });

  if (user.bannerUrl) {
    const oldKey = user.bannerUrl.replace(`${ENV.AWS_CDN_URL}/`, "");

    try {
      await deleteFile(oldKey, userId);
    } catch (err) {
      logger.error(
        `Failed to mark old banner as DELETED for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  redisClient.del(REDIS_KEYS.userdata(userId)).catch(() => null);

  return res.status(200).json({
    success: true,
    message: "User banner updated",
    bannerUrl: updatedUser.bannerUrl,
  });
});

export const userProfileUpdate = asyncHandler(async (req, res) => {
  const {
    first_name,
    last_name,
    bio,
    avatarUrl,
    bannerUrl,
    gender,
    birthdate,
    location,
  } = req.body;
  let { username } = req.body;

  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  if (currentUser.status !== "active") {
    throw new ApiError(403, `Account is ${currentUser.status}`);
  }

  if (username) {
    username = username.trim().toLowerCase();

    if (username !== currentUser.username) {
      if (isReservedUsername(username)) {
        throw new ApiError(400, "Username is reserved");
      }

      const redisKey = REDIS_KEYS.usernameAvailability(username);
      const cached = await redisClient.get(redisKey);

      if (cached === "0") {
        throw new ApiError(409, "Username already exists");
      }

      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: userId },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ApiError(409, "Username already exists");
      }

      await redisClient.del(
        REDIS_KEYS.usernameAvailability(currentUser.username),
      );
      await redisClient.del(REDIS_KEYS.usernameAvailability(username));
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(username && { username }),
      ...(first_name && { first_name }),
      ...(last_name && { last_name }),
      ...(bio && { bio }),
      ...(avatarUrl && { avatarUrl }),
      ...(bannerUrl && { bannerUrl }),
    },
  });

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      ...(gender && { gender }),
      ...(birthdate && { birthdate: new Date(birthdate) }),
      ...(location && { location }),
    },
    create: {
      userId,
      ...(gender && { gender }),
      ...(birthdate && { birthdate: new Date(birthdate) }),
      ...(location && { location }),
    },
  });

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      first_name: true,
      last_name: true,
      bio: true,
      avatarUrl: true,
      bannerUrl: true,
      profile: true,
    },
  });

  await redisClient.del(REDIS_KEYS.userdata(userId));

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedUser,
  });
});

export const updateSocialMedia = asyncHandler(async (req, res) => {
  const {
    websiteUrl,
    socialTwitter,
    socialFacebook,
    socialLinkedin,
    socialInstagram,
  } = req.body;

  const userId = req.session?.userId;

  if (
    !websiteUrl &&
    !socialTwitter &&
    !socialFacebook &&
    !socialLinkedin &&
    !socialInstagram
  ) {
    throw new ApiError(400, "No social media fields provided for update");
  }

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      ...(websiteUrl && { websiteUrl }),
      ...(socialTwitter && { socialTwitter }),
      ...(socialFacebook && { socialFacebook }),
      ...(socialLinkedin && { socialLinkedin }),
      ...(socialInstagram && { socialInstagram }),
    },
    create: {
      userId,
      ...(websiteUrl && { websiteUrl }),
      ...(socialTwitter && { socialTwitter }),
      ...(socialFacebook && { socialFacebook }),
      ...(socialLinkedin && { socialLinkedin }),
      ...(socialInstagram && { socialInstagram }),
    },
  });

  await redisClient.del(REDIS_KEYS.userdata(userId));

  return res.status(200).json({
    success: true,
    message: "User social media links updated successfully",
  });
});

export const changeMailStep1 = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  let { email } = req.body;
  const ip = getClientIp(req);

  if (!email) throw new ApiError(400, "Invalid email");

  email = email.trim().toLowerCase();

  if (!userId) throw new ApiError(401, "Unauthorized");

  if (await redisClient.get(REDIS_KEYS.changeEmail(userId))) {
    throw new ApiError(429, "Email change already in progress");
  }

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [existingEmail, user, recentUpdate] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.emailUpdatesHistory.findFirst({
      where: { userId, updatedAt: { gte: last24Hours } },
    }),
  ]);
  if (recentUpdate) {
    throw new ApiError(429, "You can only change email once every 24 hours");
  }

  if (existingEmail) throw new ApiError(409, "Someone use this email");
  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "active")
    throw new ApiError(403, `Account ${user.status}`);
  if (user.email === email)
    throw new ApiError(409, "New email cannot be same as current");

  const { otp, otpHash } = generateOTP();
  const { token, tokenHash } = generateToken();

  sendChangeEmailOtp({ email, otp });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await Promise.all([
    prisma.userOtp.create({
      data: {
        userId,
        purpose: "CHANGE_EMAIL_NEW",
        codeHash: otpHash,
        expiresAt,
      },
    }),

    prisma.tokenHash.create({
      data: {
        userId,
        token,
        tokenHash,
        userIp: ip,
        expiresAt,
      },
    }),

    redisClient.set(REDIS_KEYS.changeEmail(userId), email, { EX: 10 * 60 }),
  ]);

  return res.status(200).json({
    success: true,
    message: "OTP sent to new email",
    token,
  });
});

export const changeMailStep2 = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;
  const userId = req.session?.userId;

  if (!token || !otp) throw new ApiError(400, "Token and OTP required");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const checkToken = await prisma.tokenHash.findFirst({
    where: {
      userId,
      tokenHash: hashValue(token),
      expiresAt: { gte: new Date() },
    },
  });

  if (!checkToken) throw new ApiError(400, "Invalid or expired token");

  const checkOtp = await prisma.userOtp.findFirst({
    where: {
      userId,
      purpose: "CHANGE_EMAIL_NEW",
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!checkOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (!checkOtp || !verifyOTP(otp, checkOtp.codeHash)) {
    await prisma.userOtp.update({
      where: { id: checkOtp.id },
      data: { attempts: { increment: 1 } },
    });

    if (checkOtp.attempts >= 5) {
      await prisma.userOtp.delete({ where: { id: checkOtp.id } });
      throw new ApiError(429, "Too many invalid attempts");
    }

    throw new ApiError(400, "Invalid or expired OTP");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "active") {
    throw new ApiError(403, "Account not active");
  }

  const { otp: newOtp, otpHash: newOtpHash } = generateOTP();
  const { token: newToken, tokenHash: newTokenHash } = generateToken();

  sendChangeEmailOtp({ email: user.email, otp: newOtp });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Promise.all([
    prisma.userOtp.update({
      where: { id: checkOtp.id },
      data: {
        purpose: "CHANGE_EMAIL_OLD",
        codeHash: newOtpHash,
        expiresAt,
      },
    }),

    prisma.tokenHash.update({
      where: { id: checkToken.id },
      data: {
        tokenHash: newTokenHash,
        expiresAt,
      },
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "OTP sent to old email",
    token: newToken,
  });
});

export const changeMailStep3 = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;
  const userId = req.session?.userId;

  if (!token || !otp) throw new ApiError(400, "Token and OTP required");
  if (!userId) throw new ApiError(401, "Unauthorized");

  const checkToken = await prisma.tokenHash.findFirst({
    where: {
      userId,
      tokenHash: hashValue(token),
      expiresAt: { gte: new Date() },
    },
  });

  if (!checkToken) throw new ApiError(400, "Invalid or expired token");

  const checkOtp = await prisma.userOtp.findFirst({
    where: {
      userId,
      purpose: "CHANGE_EMAIL_OLD",
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!checkOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (!checkOtp || !verifyOTP(otp, checkOtp.codeHash)) {
    await prisma.userOtp.update({
      where: { id: checkOtp.id },
      data: { attempts: { increment: 1 } },
    });

    if (checkOtp.attempts >= 5) {
      await prisma.userOtp.delete({ where: { id: checkOtp.id } });
      throw new ApiError(429, "Too many invalid attempts");
    }

    throw new ApiError(400, "Invalid or expired OTP");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "active") {
    throw new ApiError(403, "Account not active");
  }

  const newEmail = await redisClient.get(REDIS_KEYS.changeEmail(userId));
  if (!newEmail) throw new ApiError(400, "Email change session expired");

  await prisma.$transaction([
    prisma.emailUpdatesHistory.create({
      data: {
        userId,
        previousEmail: user.email,
        newEmail,
      },
    }),

    prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
    }),

    prisma.userOtp.delete({ where: { id: checkOtp.id } }),
    prisma.tokenHash.delete({ where: { id: checkToken.id } }),
  ]);

  await redisClient.del(REDIS_KEYS.changeEmail(userId));
  await redisClient.del(REDIS_KEYS.userdata(userId));

  return res.status(200).json({
    success: true,
    message: "Email updated successfully",
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.session?.userId;

  if (!userId) throw new ApiError(401, "Unauthorized");

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old and new password are required");
  }

  if (oldPassword === newPassword) {
    throw new ApiError(400, "Choose a different password");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const activeOtp = await redisClient.get(REDIS_KEYS.changePassword(userId));
  if (activeOtp) {
    throw new ApiError(429, "OTP already sent. Please wait.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  const validOld = await bcrypt.compare(oldPassword, user.password);
  if (!validOld) {
    throw new ApiError(400, "Invalid credentials");
  }

  const twoFA = await prisma.userTotp.findFirst({
    where: { userId },
    select: { enabled: true },
  });

  const hashPassword = await bcrypt.hash(newPassword, 14);
  if (!twoFA?.enabled) {
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashPassword },
    });

    return res.status(200).json({
      success: true,
      message: "Password has been changed",
    });
  }

  // 🛡 If 2FA is enabled → OTP challenge
  const { otp, otpHash } = generateOTP();
  const { token, tokenHash } = generateToken();

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const ip = getClientIp(req);

  await prisma.$transaction([
    prisma.userOtp.create({
      data: {
        userId,
        purpose: "CHANGE_PASSWORD",
        codeHash: otpHash,
        expiresAt,
      },
    }),

    prisma.tokenHash.create({
      data: {
        userId,
        token,
        tokenHash,
        userIp: ip,
        expiresAt,
      },
    }),
  ]);

  sendChangePasswordOtp({ email: user.email, otp });

  await redisClient.set(REDIS_KEYS.changePassword(userId), hashPassword, {
    EX: 5 * 60,
  });

  return res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    token,
  });
});

export const changePasswordVerifyOTP = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;
  const userId = req.session?.userId;

  if (!userId) throw new ApiError(401, "Unauthorized");
  if (!token || !otp) throw new ApiError(400, "Token and OTP are required");

  const newPasswordHash = await redisClient.get(
    REDIS_KEYS.changePassword(userId),
  );

  if (!newPasswordHash) {
    throw new ApiError(400, "Password change session expired");
  }

  const checkToken = await prisma.tokenHash.findFirst({
    where: {
      userId,
      tokenHash: hashValue(token),
      expiresAt: { gte: new Date() },
    },
  });

  if (!checkToken) {
    throw new ApiError(400, "Invalid or expired token");
  }

  const checkOtp = await prisma.userOtp.findFirst({
    where: {
      userId,
      purpose: "CHANGE_PASSWORD",
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!checkOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  if (!checkOtp || !verifyOTP(otp, checkOtp.codeHash)) {
    await prisma.userOtp.update({
      where: { id: checkOtp.id },
      data: { attempts: { increment: 1 } },
    });

    if (checkOtp.attempts >= 5) {
      await prisma.userOtp.delete({ where: { id: checkOtp.id } });
      throw new ApiError(429, "Too many invalid attempts");
    }

    throw new ApiError(400, "Invalid or expired OTP");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash },
    }),

    prisma.userOtp.delete({ where: { id: checkOtp.id } }),

    prisma.tokenHash.delete({ where: { id: checkToken.id } }),
  ]);

  await redisClient.del(REDIS_KEYS.changePassword(userId));
  await redisClient.del(REDIS_KEYS.userdata(userId));

  return res.status(200).json({
    success: true,
    message: "Password has been changed",
  });
});

const USERNAME_CACHE_TTL_TAKEN = 60 * 60 * 24; // 24 hours
const USERNAME_CACHE_TTL_AVAILABLE = 60 * 10; // 10 minutes
const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,29}$/;

export const checkUsernameAvailability = asyncHandler(async (req, res) => {
  let { username } = req.query as { username?: string };

  if (!username || typeof username !== "string") {
    throw new ApiError(400, "Invalid username");
  }

  username = username.trim().toLowerCase();

  if (!username) {
    throw new ApiError(400, "Invalid username");
  }

  if (!USERNAME_REGEX.test(username)) {
    throw new ApiError(
      400,
      "Username must start with a letter and contain only letters, numbers, and underscores (3–30 chars)",
    );
  }

  if (isReservedUsername(username)) {
    throw new ApiError(400, "Username is reserved");
  }

  const redisKey = REDIS_KEYS.usernameAvailability(username);

  const cached = await redisClient.get(redisKey);
  if (cached !== null) {
    return res.status(200).json({
      success: true,
      message: cached === "1" ? "Username is available" : "Username is taken",
      available: cached === "1",
      cached: true,
    });
  }

  const existing = await prisma.user.findFirst({
    where: { username },
    select: { id: true },
  });

  const available = !existing;

  await redisClient.set(redisKey, available ? "1" : "0", {
    EX: available ? USERNAME_CACHE_TTL_AVAILABLE : USERNAME_CACHE_TTL_TAKEN,
    NX: true,
  });

  return res.status(200).json({
    success: true,
    message: available ? "Username is available" : "Username is taken",
    available,
    cached: false,
  });
});

export const followUser = asyncHandler(async (req, res) => {
  const followerId = req.session?.userId;
  const followingId = req.params.userId;

  if (!followerId || !followingId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (followerId === followingId) {
    throw new ApiError(400, "You cannot follow yourself");
  }

  const userExists = await prisma.user.findUnique({
    where: { id: followingId },
    select: { id: true },
  });

  if (!userExists) {
    throw new ApiError(404, "User not found");
  }

  const alreadyFollowing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  if (alreadyFollowing) {
    throw new ApiError(409, "Already following this user");
  }

  await prisma.follow.create({
    data: {
      followerId,
      followingId,
    },
  });

  await redisClient.del(REDIS_KEYS.userdata(followingId));
  await redisClient.del(REDIS_KEYS.userdata(followerId));

  return res.status(200).json({
    success: true,
    message: "User followed successfully",
  });
});

export const unfollowUser = asyncHandler(async (req, res) => {
  const followerId = req.session?.userId;
  const followingId = req.params.userId;

  if (!followerId || !followingId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (followerId === followingId) {
    throw new ApiError(400, "You cannot unfollow yourself");
  }

  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  if (!follow) {
    throw new ApiError(404, "You are not following this user");
  }

  await prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  await redisClient.del(REDIS_KEYS.userdata(followingId));
  await redisClient.del(REDIS_KEYS.userdata(followerId));

  return res.status(200).json({
    success: true,
    message: "User unfollowed successfully",
  });
});

export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  if(!userId){
    throw new ApiError(401, "Unautherized");
  }

  const [followers, totalCount] = await prisma.$transaction([
    prisma.follow.findMany({
      where: { followingId: userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        follower: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    }),

    prisma.follow.count({
      where: { followingId: userId },
    }),
  ]);

  const data = followers.map((f: any) => f.follower);

  res.status(200).json({
    success: true,
    message: "Followers fetched",
    meta: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    followers: data,
  });
});

export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  if(!userId){
    throw new ApiError(401, "Unautherized");
  }

  const [followings, totalCount] = await prisma.$transaction([
    prisma.follow.findMany({
      where: { followerId: userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        following: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    }),

    prisma.follow.count({
      where: { followerId: userId },
    }),
  ]);

  const data = followings.map((f: any) => f.following);

  res.status(200).json({
    success: true,
    message: "Following list fetched",
    meta: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
    following: data,
  });
});

export const isFollowing = asyncHandler(async (req, res) => {
  const followerId = req.session?.userId;
  const followingId = req.params.userId;

  if (!followerId || !followingId) {
    throw new ApiError(401, "Unauthorized");
  }

  const follow = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
  });

  return res.status(200).json({
    success: true,
    message: "Status fetched",
    isFollowing: !!follow,
  });
});
