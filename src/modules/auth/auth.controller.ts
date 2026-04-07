import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";
import { redisClient, REDIS_KEYS } from "../../config/redis.config.js";
import bcrypt from "bcryptjs";
import {
  AUTH_OTP,
  MAXIMUM_LOGGEDIN_DEVICE,
} from "../../constants/auth.constants.js";
import {
  generateOTP,
  verifyOTP,
  generateToken,
  verifyToken,
} from "../../utils/core.js";
import {
  sendLoginOtp,
  sendRegisterOTP,
  sendWelcomeEmail,
  sendResendOTP,
  sendDeleteAccount,
  sendAccountRecoveryEmail,
  sendEnable2FAEmail,
  sendEnable2FAEmailOTP,
  resetPasswordOtp
} from "../../mails/email-producer.js";
import {
  getClientIp,
  getDeviceInfo,
  saveLoginAttempts,
  verifyUserLoginAttempts,
  actualLogin,
  invalidateOtp,
  hashValue,
  verifyRefreshToken,
  signRefreshToken,
  signAccessToken,
  isReservedUsername,
  generateUniqueUsername,
} from "./auth.service.js";
import type { LoginAttempts } from "../../types/auth.types.js";
import { addDays } from "date-fns";
import { ACCOUNT_DELETION_GRACE_DAYS } from "../../constants/user.constants.js";
import { formatUTCDate } from "../../utils/core.js";
import { ENV } from "../../config/env.js";

export const registerViaTrinityNetwork = asyncHandler(async(req, res) => {
  let {
    full_name,
    email,
    password,
    country_code,
    mobile_no,
    apiKey
  } = req.body;

  const ip = getClientIp(req);
  if(ip !== ENV.TRINITY_BACKEND_IP || apiKey !== ENV.TRINITY_NETWORK_AUTH_KEY){
    throw new ApiError(400, "Invaild request");
  }

  email = email.trim().toLowerCase();

  const existinguser = await prisma.user.findFirst({
    where: {email: email}
  });

  if(existinguser){
    await prisma.trinityUserAuthenticate.create({
      data: {
        userId: existinguser.id,
        logs: "already exits this user"
      }
    });

    return res.status(200).json({
      success: true,
      message: "User already exits. We don't need to create"
    });
  }

  const username = await generateUniqueUsername(full_name);
  const first_name = full_name.trim().split(" ").at(0);
  const last_name = full_name.trim().split(" ").at(1) || "";

  const new_user = await prisma.user.create({
    data:{
      username,
      email,
      password,
      first_name,
      last_name,
      countryCode: country_code,
      phoneNumber: mobile_no
    }
  });

  if(!new_user){
    throw new ApiError(500, "Something went wrong");
  }

  await prisma.trinityUserAuthenticate.create({
    data: {
      userId: new_user.id,
      logs: "Authenticated to trinity network app"
    }
  });

  const joinDate = formatUTCDate(new_user.createdAt);
  sendWelcomeEmail({email: new_user.email, name: full_name, username: new_user.username, joinDate});

  return res.status(200).json({
    success: true,
    message: "New user created successfully"
  });
});

export const loginViaTrinityNetwork = asyncHandler(async(req, res) => {
  let { email, apiKey } = req.body;

  const ip = getClientIp(req);
  if(ip !== ENV.TRINITY_BACKEND_IP || apiKey !== ENV.TRINITY_NETWORK_AUTH_KEY){
    throw new ApiError(400, "Invaild request");
  }

  email = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {email: email}
  });

  if(!user){
    throw new ApiError(404, "user not found");
  }

  if(user.status !== "active"){
    throw new ApiError(400, `Account is ${user.status}`);
  }

  const device = getDeviceInfo(req);

  const { accessToken, refreshToken } = await actualLogin(
    user.id,
    "Login Via Trinity Network",
    device,
    ip,
  );

  return res.status(200).json({
    success: true,
    message: "Logged in succesfully",
    accessToken: accessToken,
    refreshToken: refreshToken,
  });
});

export const registerStep1 = asyncHandler(
  async (
    req: Request<{}, {}, { username: string; email: string; password: string }>,
    res: Response,
  ) => {
    let { username, email, password } = req.body;
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();
    const ip = getClientIp(req);

    if (isReservedUsername(username)) {
      throw new ApiError(400, "Username is not allowed");
    }

    const isAvailable = await redisClient.get(
      REDIS_KEYS.usernameAvailability(username),
    );
    if (isAvailable === "0") {
      throw new ApiError(409, "Username already exists");
    }

    const registerAttemptKey = `rate_limit:register:${ip}`;
    const attempts = await redisClient.incr(registerAttemptKey);
    if (attempts === 1) await redisClient.expire(registerAttemptKey, 3600); // 1 hour
    if (attempts > 10)
      throw new ApiError(429, "Too many registration attempts");

    // Optimize: use select to only check existence
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { id: true },
    });

    if (existingUser) {
      throw new ApiError(409, "Username or email already exists");
    }

    const { otp, otpHash } = generateOTP();
    const { token, tokenHash } = generateToken();
    const passwordHash = await bcrypt.hash(password, 14);

    const userPayload = { username, email, password: passwordHash };
    const EXPIRES_IN = AUTH_OTP.EXPIRES_IN;

    // Batch operations: use Promise.all for non-dependent writes
    await Promise.all([
      redisClient.set(
        REDIS_KEYS.userTemp(tokenHash),
        JSON.stringify(userPayload),
        { EX: EXPIRES_IN },
      ),
      redisClient.set(REDIS_KEYS.registerOtp(token), otpHash, {
        EX: EXPIRES_IN,
      }),
      prisma.tokenHash.create({
        data: { token, tokenHash, userIp: ip },
      }),
    ]);

    if(!await sendRegisterOTP({ email, otp })){
      throw new ApiError(500, "Something went wrong. Please try again later");
    }

    await redisClient.set(REDIS_KEYS.usernameAvailability(username), "0", {
      EX: 600,
      NX: true,
    });

    res.status(200).json({
      success: true,
      message: "OTP Sent Successfully",
      token,
    });
  },
);

export const registerStep2 = asyncHandler(
  async (
    req: Request<{}, {}, { token: string; otp: string }>,
    res: Response,
  ) => {
    const { token, otp } = req.body;
    const ip = getClientIp(req);

    const checkTime = new Date(Date.now() - AUTH_OTP.EXPIRES_IN * 1000);
    const tokenhash = await prisma.tokenHash.findFirst({
      where: {
        AND: [{ token: token }, { createdAt: { gte: checkTime } }],
      },
    });

    if (
      !tokenhash ||
      tokenhash.userIp !== ip ||
      !verifyToken(token, tokenhash.tokenHash)
    ) {
      throw new ApiError(400, "OTP expired or invalid");
    }

    // Verify OTP attempts rate limit (brute force protection)
    const verifyLimitKey = `rate_limit:otp_verify:${tokenhash.tokenHash}`;
    const attempts = await redisClient.incr(verifyLimitKey);
    if (attempts === 1) await redisClient.expire(verifyLimitKey, 600);
    if (attempts > 5) {
      await Promise.all([
        redisClient.del(REDIS_KEYS.registerOtp(token)),
        redisClient.del(REDIS_KEYS.userTemp(tokenhash.tokenHash)),
        prisma.tokenHash.deleteMany({ where: { token } }),
      ]);
      throw new ApiError(
        429,
        "Too many failed attempts. Please restart registration.",
      );
    }

    const [userData, otpHashed] = await Promise.all([
      redisClient.get(REDIS_KEYS.userTemp(tokenhash.tokenHash)),
      redisClient.get(REDIS_KEYS.registerOtp(token)),
    ]);

    if (!userData || !otpHashed || !verifyOTP(otp, otpHashed)) {
      throw new ApiError(400, "Invalid OTP");
    }

    const user = JSON.parse(userData);

    // Final check for collision before create (race condition handling)
    const collisionParams = {
      where: { OR: [{ username: user.username }, { email: user.email }] },
      select: { id: true },
    };
    if (await prisma.user.findFirst(collisionParams as any)) {
      throw new ApiError(409, "User already registered");
    }

    const newUser = await prisma.user.create({
      data: {
        username: user.username,
        email: user.email,
        password: user.password,
      },
    });

    const userprofile = await prisma.userProfile.create({
      data: {
        userId: newUser.id,
      },
    });

    const { password: _, ...userWithoutPassword } = newUser;
    const joinDate = formatUTCDate(newUser.createdAt);
    sendWelcomeEmail({email: user.email, name: user.name, username: newUser.username, joinDate});

    await Promise.all([
      redisClient.del(REDIS_KEYS.registerOtp(token)),
      redisClient.del(REDIS_KEYS.userTemp(tokenhash.tokenHash)),
      redisClient.del(verifyLimitKey),
      prisma.tokenHash.deleteMany({ where: { token } }),
      redisClient.del(REDIS_KEYS.usernameAvailability(newUser.username)),
    ]);

    res.status(201).json({
      success: true,
      message: "User Registered Successfully",
      user: userWithoutPassword,
    });
  },
);

export const resendRegisterOTP = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const ip = getClientIp(req);

  if(!token){
    throw new ApiError(400, "Inavild Request");
  }

  // Rate limit resends globally by IP to prevent spammy triggers
  const resendLimitKey = `rate_limit:resend_otp:${ip}`;
  const attempts = await redisClient.incr(resendLimitKey);
  if (attempts === 1) await redisClient.expire(resendLimitKey, 600); // 10 mins
  if (attempts > 3)
    throw new ApiError(429, "Too many resend requests. Try again later.");

  const checkTime = new Date(Date.now() - AUTH_OTP.EXPIRES_IN * 1000);
  const tokenhash = await prisma.tokenHash.findFirst({
    where: {
      AND: [{ token: token }, { createdAt: { gte: checkTime } }],
    },
  });

  if (
    !tokenhash ||
    tokenhash.userIp !== ip ||
    !verifyToken(token, tokenhash.tokenHash)
  ) {
    throw new ApiError(400, "OTP expired or invalid");
  }

  const userData = await redisClient.get(
    REDIS_KEYS.userTemp(tokenhash.tokenHash),
  );
  if (!userData) {
    throw new ApiError(400, "Registration session expired");
  }

  // Generate new OTP
  const user = JSON.parse(userData);
  const { otp, otpHash } = generateOTP();
  const EXPIRES_IN = AUTH_OTP.EXPIRES_IN;

  await Promise.all([
    redisClient.set(REDIS_KEYS.registerOtp(token), otpHash, { EX: EXPIRES_IN }),
    // Refresh user temp data expiry too so they have time to enter
    redisClient.expire(REDIS_KEYS.userTemp(tokenhash.tokenHash), EXPIRES_IN),
  ]);

  sendResendOTP({ email: user.email, otp });

  res.status(200).json({
    success: true,
    message: "OTP Resend Successfully",
  });
});

export const login = asyncHandler(
  async (
    req: Request<{}, {}, { usernameOrEmail: string; password: string }>,
    res: Response,
  ) => {
    const { usernameOrEmail, password } = req.body;
    const ip = getClientIp(req);
    const device = getDeviceInfo(req);

    const attempt: LoginAttempts = {
      identifier: usernameOrEmail,
      ipAddress: ip,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      os: device.os,
      browser: device.browser,
      success: false,
      message: "Invalid credentials",
    };

    if (!(await verifyUserLoginAttempts(attempt))) {
      throw new ApiError(429, "Too many requests");
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await saveLoginAttempts(attempt);
      throw new ApiError(403, "Invalid credentials");
    }

    if (user.status !== "active") {
      await saveLoginAttempts({ ...attempt, message: user.status });
      throw new ApiError(403, `Account ${user.status}`);
    }

    // Check if this device already has an active session
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
      const devices = await tx.userSession.findMany({
        where: {
          userId: user.id,
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
        await saveLoginAttempts({
          ...attempt,
          message: "Logged in too many devices",
        });

        throw new ApiError(429, "Maximum device limit reached (5)");
      }
    });

    const Enabled2FA = await prisma.userTotp.findFirst({
      where: { userId: user.id },
      select: { enabled: true },
    });

    if (!Enabled2FA || !Enabled2FA.enabled) {
      const { accessToken, refreshToken } = await actualLogin(
        user.id,
        usernameOrEmail,
        device,
        ip,
      );

      return res.status(200).json({
        success: true,
        message: "Logged in succesfully",
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
    }

    const { otp, otpHash } = generateOTP();
    const { token, tokenHash } = generateToken();

    await Promise.all([
      // BINDING TOKEN TO USER ID HERE
      prisma.tokenHash.create({
        data: {
          token,
          tokenHash,
          userIp: ip,
          userId: user.id, // Bind to user
        },
      }),
      redisClient.set(REDIS_KEYS.loginOtp(tokenHash), otpHash, {
        EX: AUTH_OTP.EXPIRES_IN,
      }),
      redisClient.set(REDIS_KEYS.identifier(tokenHash), usernameOrEmail, {
        EX: AUTH_OTP.EXPIRES_IN,
      }),
    ]);

    sendLoginOtp({ email: user.email, otp });

    // Mark identifier as processing login
    await redisClient.set(
      REDIS_KEYS.identifierHash(hashValue(usernameOrEmail)),
      "1",
      { EX: AUTH_OTP.EXPIRES_IN },
    );
    await saveLoginAttempts({ ...attempt, success: true, message: "OTP sent" });

    res.status(202).json({
      success: true,
      message:
        "Two-factor authentication is now enabled. We've sent an OTP to your registered email.",
      authentication: true,
      token,
    });
  },
);

export const loginOTPVerify = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;
  const ip = getClientIp(req);
  const device = getDeviceInfo(req);

  const tokenHash = hashValue(token);

  const dbToken = await prisma.tokenHash.findFirst({
    where: {
      tokenHash,
      createdAt: { gte: new Date(Date.now() - AUTH_OTP.EXPIRES_IN * 1000) },
    },
    include: { user: true }, // Include user to check binding
  });

  if (!dbToken || dbToken.userIp !== ip) {
    throw new ApiError(400, "OTP expired or invalid");
  }

  // Brute force protection on OTP verification
  const verifyKey = `rate_limit:otp_verify:${tokenHash}`;
  const attempts = await redisClient.incr(verifyKey);

  if (attempts === 1) {
    await redisClient.expire(verifyKey, AUTH_OTP.EXPIRES_IN);
  }

  if (attempts > 5) {
    await invalidateOtp(tokenHash);
    await prisma.tokenHash.delete({ where: { id: dbToken.id } });
    throw new ApiError(429, "Too many failed attempts. Login restarted.");
  }

  const storedOtpHash = await redisClient.get(REDIS_KEYS.loginOtp(tokenHash));

  if (!storedOtpHash || !verifyOTP(otp, storedOtpHash)) {
    throw new ApiError(400, "Invalid OTP");
  }

  // Check Binding
  if (!dbToken.userId) {
    throw new ApiError(400, "Invalid token binding");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: dbToken.userId,
    },
    select: { id: true, status: true, email: true, username: true },
  });

  if (!user || user.status !== "active") {
    throw new ApiError(403, "Inactive or invalid user");
  }

  await Promise.all([
    prisma.tokenHash.delete({ where: { id: dbToken.id } }),
    invalidateOtp(tokenHash),
    redisClient.del(verifyKey),
  ]);

  const { accessToken, refreshToken } = await actualLogin(
    user.id,
    user.email,
    device,
    ip,
  );

  res.status(200).json({
    success: true,
    accessToken: accessToken,
    refreshToken: refreshToken,
  });
});

export const resendLoginOTP = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const ip = getClientIp(req);

  if(!token){
    throw new ApiError(400, "Invaild request");
  }

  // Rate limit resends
  const resendLimitKey = `rate_limit:resend_otp:${ip}`;
  const attempts = await redisClient.incr(resendLimitKey);
  if (attempts === 1) await redisClient.expire(resendLimitKey, 600);
  if (attempts > 3) throw new ApiError(429, "Too many resend requests");

  const tokenHash = hashValue(token);
  const dbToken = await prisma.tokenHash.findFirst({
    where: {
      tokenHash,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });

  if (!dbToken || dbToken.userIp !== ip) {
    throw new ApiError(403, "Invalid request");
  }

  if (!dbToken.userId) {
    throw new ApiError(403, "Invalid token state");
  }

  const user = await prisma.user.findUnique({
    where: { id: dbToken.userId },
    select: { email: true, status: true },
  });

  if (!user || user.status !== "active") {
    throw new ApiError(403, "Inactive or invalid user");
  }

  const { otp, otpHash } = generateOTP();
  await redisClient.set(REDIS_KEYS.loginOtp(tokenHash), otpHash, {
    EX: AUTH_OTP.EXPIRES_IN,
  });

  sendResendOTP({ email: user.email, otp });

  return res.status(200).json({
    success: true,
    message: "OTP Resend Successfully",
  });
});

export const enableOTPbasedLogin = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(400, "Invalid userId");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, email: true },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Account ${user.status}`);
  }

  const alreadyEnabled = await prisma.userTotp.findFirst({
    where: { userId, enabled: true },
    select: { userId: true },
  });

  if (alreadyEnabled) {
    throw new ApiError(409, "OTP-based login already enabled");
  }

  const { otp, otpHash } = generateOTP();
  const { token, tokenHash } = generateToken();

  const ip = getClientIp(req);
  const EXPIRE_TIME = AUTH_OTP.EXPIRES_IN * 1000;

  await prisma.$transaction([
    prisma.userTotp.upsert({
      where: { userId },
      update: { secret: tokenHash },
      create: {
        userId,
        secret: tokenHash,
        enabled: false,
      },
    }),

    prisma.userOtp.create({
      data: {
        userId,
        purpose: "ENABLE_2FA",
        codeHash: otpHash,
        expiresAt: new Date(Date.now() + EXPIRE_TIME),
      },
    }),

    prisma.tokenHash.create({
      data: {
        token: token,
        tokenHash,
        userIp: ip,
        userId: userId,
        expiresAt: new Date(Date.now() + EXPIRE_TIME),
      },
    }),
  ]);

  sendEnable2FAEmailOTP({
    email: user.email,
    otp,
  });

  res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    token,
  });
});

export const verify2FAOTP = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { otp } = req.body;
  const userId = req.session?.userId;

  const ip = getClientIp(req);
  const device = getDeviceInfo(req);

  if(!token || !userId){
    throw new ApiError(400, "Invaild request");
  }

  const tokenEntry = await prisma.tokenHash.findFirst({
    where: {
      tokenHash: hashValue(token),
      userIp: ip,
      expiresAt: { gt: new Date() },
    },
  });

  if (!tokenEntry || tokenEntry.userId !== userId) {
    // Check Binding
    throw new ApiError(400, "Invalid or expired token");
  }

  // Brute force check
  const verifyLimiter = `rate_limit:2fa_verify:${userId}`;
  const attempts = await redisClient.incr(verifyLimiter);
  if (attempts === 1) await redisClient.expire(verifyLimiter, 300);
  if (attempts > 5) throw new ApiError(429, "Too many failed 2FA attempts");

  const userOTP = await prisma.userOtp.findFirst({
    where: {
      userId: userId,
      purpose: "ENABLE_2FA",
      expiresAt: { gt: new Date() },
    },
  });

  if (!userOTP) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const isValidOtp = verifyOTP(otp, userOTP.codeHash);

  if (!isValidOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  await prisma.$transaction([
    prisma.userTotp.update({
      where: { userId: userOTP.userId },
      data: {
        enabled: true,
        verifiedAt: new Date(),
      },
    }),

    prisma.userOtp.deleteMany({
      where: { userId: userOTP.userId },
    }),

    prisma.tokenHash.deleteMany({
      where: { tokenHash: tokenEntry.tokenHash },
    }),
  ]);

  await redisClient.del(verifyLimiter);

  const user = await prisma.user.findUnique({
    where: { id: userOTP.userId },
    select: { email: true },
  });

  sendEnable2FAEmail({
    email: user!.email,
    device: device.deviceName || device.deviceType,
  });

  res.status(200).json({
    success: true,
    message: "OTP-based login enabled successfully",
  });
});

export const disableOTPbasedLogin = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { password } = req.body;

  if (!userId) {
    throw new ApiError(400, "Invalid userId");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(404, "user not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  if (!(await bcrypt.compare(password, user.password))) {
    throw new ApiError(400, "Invaild Credentials");
  }

  await prisma.userTotp.updateMany({
    where: { userId },
    data: { enabled: false },
  });
  res.status(200).json({
    success: true,
    message: "OTP-based login disabled successfully",
  });
});

export const refreshTokenHandler = asyncHandler(async (req, res) => {
  const { token: refreshToken } = req.body;
  const ip = getClientIp(req);

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token required");
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }

  const refreshHash = hashValue(refreshToken);

  const session = await prisma.userSession.findFirst({
    where: {
      refreshTokenHash: refreshHash,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: { id: true, status: true, email: true },
      },
    },
  });

  if (!session) {
    throw new ApiError(401, "Session expired or invalid");
  }

  if (session.user.status !== "active") {
    throw new ApiError(403, `Account ${session.user.status}`);
  }

  /** ROTATE refresh token (BEST PRACTICE) */
  const { token: newRefreshToken, hash: newRefreshHash } = signRefreshToken({
    sessionId: session.userId,
    role: "user",
  });

  await prisma.$transaction([
    prisma.userSession.update({
      where: { id: session.id },
      data: {
        ipAddress: ip,
        refreshTokenHash: newRefreshHash,
        previousTokenHash: refreshHash, // Store hash, not plaintext
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  const newAccessToken = signAccessToken({
    sessionId: session.id,
    role: "user",
  });

  res.status(200).json({
    success: true,
    accessToken: newAccessToken.token,
    refreshToken: newRefreshToken,
  });
});

export const resetPasswordStep1 = asyncHandler(async (req, res) => {
  const { emailOrUsername } = req.body;
  const ip = getClientIp(req);

  // Add rate limiting per user/email per hour (3 attempts max)
  const resetAttemptKey = `rate_limit:reset_password:${emailOrUsername}:${ip}`;
  const attempts = await redisClient.incr(resetAttemptKey);
  if (attempts === 1) await redisClient.expire(resetAttemptKey, 3600); // 1 hour
  if (attempts > 3)
    throw new ApiError(
      429,
      "Too many password reset attempts. Try again later.",
    );

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
    },
    select: { id: true, email: true, status: true },
  });

  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "active")
    throw new ApiError(403, `Account ${user.status}`);

  const existingOtp = await prisma.userOtp.findFirst({
    where: {
      userId: user.id,
      purpose: "RESET_PASSWORD",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (existingOtp) {
    throw new ApiError(429, "Please wait before requesting another OTP");
  }

  const { otp, otpHash } = generateOTP();
  const { token, tokenHash } = generateToken();

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const device = getDeviceInfo(req);
  const requestedAt = new Date().toLocaleString();

  const deviceLabel = `${device.deviceName} ${device.deviceType}, ${device.browser}, ${device.os}`;

  resetPasswordOtp({
    email: user.email,
    otp,
    requestedAt,
    device: deviceLabel,
  });

  await prisma.$transaction([
    prisma.userOtp.create({
      data: {
        userId: user.id,
        purpose: "RESET_PASSWORD",
        codeHash: otpHash,
        expiresAt,
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  // Store token only (no IP binding)
  await redisClient.set(REDIS_KEYS.resetPassword(token), user.id.toString(), {
    EX: 5 * 60,
  });

  return res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    token,
  });
});

export const resetPasswordStep2 = asyncHandler(async (req, res) => {
  const { token, otp } = req.body;

  const redisUserId = await redisClient.get(REDIS_KEYS.resetPassword(token));
  if (!redisUserId) throw new ApiError(400, "Invalid or expired token");

  const tokenHash = hashValue(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) throw new ApiError(400, "Invalid or expired token");

  const otpRecord = await prisma.userOtp.findFirst({
    where: {
      userId: resetToken.userId,
      purpose: "RESET_PASSWORD",
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord || !verifyOTP(otp, otpRecord.codeHash)) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const { token: newToken, tokenHash: newTokenHash } = generateToken();

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: {
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours
      },
    }),
    prisma.userOtp.delete({ where: { id: otpRecord.id } }),
  ]);

  await Promise.all([
    redisClient.del(REDIS_KEYS.resetPassword(token)),
    redisClient.set(
      REDIS_KEYS.resetPassword(newToken),
      resetToken.userId.toString(),
      { EX: 5 * 60 * 60 },
    ),
  ]);

  return res.status(200).json({
    success: true,
    message: "OTP verified",
    token: newToken,
  });
});

export const resetPasswordStep3 = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const redisUserId = await redisClient.get(REDIS_KEYS.resetPassword(token));
  if (!redisUserId) throw new ApiError(400, "Invalid or expired token");

  const tokenHash = hashValue(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) throw new ApiError(400, "Invalid or expired token");

  const user = await prisma.user.findUnique({
    where: { id: resetToken.userId },
  });

  if (!user) throw new ApiError(404, "User not found");
  if (user.status !== "active")
    throw new ApiError(403, `Account ${user.status}`);

  if (await bcrypt.compare(password, user.password)) {
    throw new ApiError(400, "Choose different password");
  }

  const newPasswordHash = await bcrypt.hash(password, 14);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: newPasswordHash },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  await redisClient.del(REDIS_KEYS.resetPassword(token));

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});

export const logout = asyncHandler(async (req, res) => {
  const session = req.session;
  const token = session?.token;
  const userId = session?.userId;
  const sessionId = session?.id;

  if (!userId || !sessionId || !token) {
    throw new ApiError(400, "Invalid logout request");
  }

  // Verify session exists before deleting
  const existingSession = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  });

  if (!existingSession || existingSession.userId !== userId) {
    throw new ApiError(403, "Session mismatch");
  }

  await Promise.all([
    prisma.userSession.deleteMany({
      where: { id: sessionId, userId: userId },
    }),
    redisClient.set(REDIS_KEYS.blacklistToken(token), "1", {
      EX: 60 * 60 * 24 * 7,
    }), // 7 days
    redisClient.del(REDIS_KEYS.userdata(userId)),
  ]);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const logoutAllDevices = asyncHandler(async (req, res) => {
  const session = req.session;
  const token = session?.token;
  const userId = session?.userId;

  if (!userId || !token) {
    throw new ApiError(400, "Invalid logout request");
  }

  // Verify user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user || user.status !== "active") {
    throw new ApiError(403, "Invalid user");
  }

  // Delete all sessions for this user
  await prisma.userSession.deleteMany({
    where: { userId: userId },
  });

  // Blacklist current token
  await Promise.all([
    redisClient.set(REDIS_KEYS.blacklistToken(token), "1", {
      EX: 60 * 60 * 24 * 7,
    }), // 7 days
    redisClient.del(REDIS_KEYS.userdata(userId)),
  ]);

  res.status(200).json({
    success: true,
    message: "Logged out from all devices successfully",
  });
});

export const activeSessions = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(400, "Invalid request");
  }

  const sessions = await prisma.userSession.findMany({
    where: {
      userId: userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      ipAddress: true,
      deviceName: true,
      deviceType: true,
      os: true,
      browser: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const resultSessions = sessions.map((session: any) => ({
    ...session,
    thisDevice: session.id === req.session?.id,
  }));

  res.status(200).json({
    success: true,
    sessions: resultSessions,
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const session = req.session;
  const userId = session?.userId;
  const token = session?.token;
  const { password, reason } = req.body;

  if (!userId || !token) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!password || typeof password !== "string") {
    throw new ApiError(400, "Password is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const ACCOUNT_DELETE_COOLDOWN_HOURS = 24; // 24 hours
  const accountAgeMs = Date.now() - user.createdAt.getTime();
  const hoursSinceCreation = accountAgeMs / (1000 * 60 * 60);

  if (hoursSinceCreation < ACCOUNT_DELETE_COOLDOWN_HOURS) {
    throw new ApiError(
      403,
      "Account deletion is allowed only after 24 hours of account creation",
    );
  }

  if (user.status === "deleted") {
    throw new ApiError(400, "Account already deleted");
  }

  // 🔹 Verify password (prevents deletion from stolen session)
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid password");
  }

  // 🔹 Check if deletion already scheduled
  const existingSchedule = await prisma.deletionSchedule.findUnique({
    where: { userId },
  });

  if (existingSchedule?.status === "PENDING") {
    throw new ApiError(400, "Account deletion is already in progress");
  }

  const scheduledAt = addDays(new Date(), ACCOUNT_DELETION_GRACE_DAYS);

  // 🔹 Create or update deletion schedule
  await prisma.deletionSchedule.upsert({
    where: { userId },
    update: {
      status: "PENDING",
      requestedAt: new Date(),
      scheduledAt,
      recoveredAt: null,
      deletedAt: null,
      reason: reason || null,
    },
    create: {
      userId,
      status: "PENDING",
      scheduledAt,
      reason: reason || null,
    },
  });

  await Promise.all([
    // Invalidate all sessions
    prisma.userSession.deleteMany({
      where: { userId },
    }),

    // Clear cached user data
    redisClient.del(REDIS_KEYS.userdata(userId)),
  ]);

  const device = getDeviceInfo(req);

  sendDeleteAccount({
    email: user.email,
    requestedAt: formatUTCDate(new Date()),
    device: {
      name: device.deviceName ?? "Unknown device",
      type: device.deviceType ?? "Unknown type",
      os: device.os ?? "Unknown OS",
      browser: device.browser ?? "Unknown browser",
    },
  });

  return res.status(200).json({
    success: true,
    message:
      "Your account is scheduled for deletion. You can recover it within 30 days by logging back in.",
    scheduledAt,
  });
});

export const recoverAccount = asyncHandler(async (req, res) => {
  const session = req.session;
  const userId = session?.userId;
  const { password, reason } = req.body;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      password: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!(await bcrypt.compare(password, user.password))) {
    throw new ApiError(400, "Invaild Password");
  }

  if (user.status !== "active") {
    throw new ApiError(400, `Account is ${user.status}`);
  }

  const deletionSchedule = await prisma.deletionSchedule.findUnique({
    where: { userId },
  });

  if (!deletionSchedule || deletionSchedule.status !== "PENDING") {
    throw new ApiError(400, "No active deletion schedule found");
  }

  const device = getDeviceInfo(req);

  await Promise.all([
    prisma.deletionSchedule.update({
      where: { userId },
      data: {
        status: "RECOVERED",
        recoveredAt: new Date(),
        reason: reason,
      },
    }),

    prisma.userSession.deleteMany({
      where: { userId },
    }),

    redisClient.del(REDIS_KEYS.userdata(userId)),
  ]);

  sendAccountRecoveryEmail({
    email: user.email,
    device: {
      name: device.deviceName ?? "Unknown device",
      type: device.deviceType ?? "Unknown type",
      os: device.os ?? "Unknown OS",
      browser: device.browser ?? "Unknown browser",
    },
    recoveredAt: formatUTCDate(new Date())
  });

  return res.status(200).json({
    success: true,
    message: "Your account has been successfully recovered",
  });
});
