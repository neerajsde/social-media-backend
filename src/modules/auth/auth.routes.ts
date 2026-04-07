import express from "express";
import {
  registerStep1,
  registerStep2,
  resendRegisterOTP,
  login,
  loginOTPVerify,
  enableOTPbasedLogin,
  verify2FAOTP,
  disableOTPbasedLogin,
  resendLoginOTP,
  refreshTokenHandler,
  resetPasswordStep1,
  resetPasswordStep2,
  resetPasswordStep3,
  logout,
  logoutAllDevices,
  activeSessions,
  deleteAccount,
  recoverAccount,
  registerViaTrinityNetwork,
  loginViaTrinityNetwork,
} from "./auth.controller.js";
import {
  registerValidation,
  authVerify,
  loginValidate,
  tokenValidate,
  verify2FAValidate,
  resetPasswordValidate1,
  resetPasswordValidate2,
  resetPasswordValidate3,
  disable2FAValidation,
  accountValidation,
  registerViaTNValidation,
  loginViaTNValidation
} from "./auth.validation.js";
import { authRateLimit } from "../../middlewares/ratelimit.js";

import { createVerifyToken } from "../../middlewares/auth.js";

const router = express.Router();

router.post("/register/via/trinity-network-app", registerViaTNValidation, registerViaTrinityNetwork);
router.post("/login/via/trinity-network-app", loginViaTNValidation, loginViaTrinityNetwork);

/**
 * @swagger
 * /api/v1/auth/register/otp:
 *   post:
 *     summary: Register step 1 - Request OTP
 *     description: User provides email and password to initiate registration. An OTP is sent to the provided email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               username:
 *                 type: string
 *                 format: username
 *                 example: username
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: OTP sent successfully to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Temporary token for OTP verification
 *       400:
 *         description: Invalid input or email already registered
 *       429:
 *         description: Too many requests - rate limited
 */
router.post("/register/otp", authRateLimit, registerValidation, registerStep1);

/**
 * @swagger
 * /api/v1/auth/register/verify:
 *   post:
 *     summary: Register step 2 - Verify OTP and create account
 *     description: User verifies the OTP sent to their email and account is created
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *               - token
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               token:
 *                 type: string
 *                 description: Temporary token received from register/otp endpoint
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 email:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Invalid OTP or token
 */
router.post("/register/verify", authVerify, registerStep2);

/**
 * @swagger
 * /api/v1/auth/register/otp/resend/{token}:
 *   post:
 *     summary: Resend registration OTP
 *     description: Request a new OTP to be sent to the registered email
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary token from register/otp endpoint
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid or expired token
 *       429:
 *         description: Too many resend attempts
 */
router.post("/register/otp/resend/:token", tokenValidate, resendRegisterOTP);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login step 1 - Request OTP
 *     description: User provides email and password to initiate login. If 2FA Enabled then a OTP is sent to their email otherwise logged In.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usernameOrEmail
 *               - password
 *             properties:
 *               usernameOrEmail:
 *                 type: string
 *                 format: usernameOrEmail
 *                 example: user@example.com or username
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       202:
 *         description: OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: Temporary token for OTP verification
 *       200:
 *         description: Logged in succesfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Invalid credentials
 *       401:
 *         description: Invalid email or password
 *       429:
 *         description: Too many login attempts - rate limited
 */
router.post("/login", authRateLimit, loginValidate, login);

/**
 * @swagger
 * /api/v1/auth/login/otp-verify:
 *   post:
 *     summary: Login step 2 - Verify OTP
 *     description: User verifies the OTP sent during login to complete authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *               - token
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               token:
 *                 type: string
 *                 description: Temporary token from login endpoint
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Invalid OTP or token
 */
router.post("/login/otp-verify", authVerify, loginOTPVerify);

/**
 * @swagger
 * /api/v1/auth/login/otp/resend/{token}:
 *   post:
 *     summary: Resend login OTP
 *     description: Request a new OTP to be sent to the user's email
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary token from login endpoint
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid or expired token
 *       429:
 *         description: Too many resend attempts
 */
router.post("/login/otp/resend/:token", tokenValidate, resendLoginOTP);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Generate a new access token using the refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token received during login
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 *       429:
 *         description: Too many requests
 */
router.post("/refresh-token", authRateLimit, refreshTokenHandler);

/**
 * @swagger
 * /api/v1/auth/reset-password/request:
 *   post:
 *     summary: Reset password step 1 - Request OTP
 *     description: User provides email or username to initiate password reset. An OTP is sent to the email.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emailOrUsername
 *             properties:
 *               emailOrUsername:
 *                 type: string
 *                 format: emailOrUsername
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many requests
 */
router.post(
  "/reset-password/request",
  authRateLimit,
  resetPasswordValidate1,
  resetPasswordStep1,
);

/**
 * @swagger
 * /api/v1/auth/reset-password/verify:
 *   post:
 *     summary: Reset password step 2 - Verify OTP
 *     description: User verifies the OTP sent during password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *               - token
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid OTP or token
 */
router.post(
  "/reset-password/verify",
  resetPasswordValidate2,
  resetPasswordStep2,
);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password step 3 - Set new password
 *     description: User sets a new password after OTP verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmPassword
 *               - token
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePass123!
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePass123!
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or weak password
 */
router.post("/reset-password", resetPasswordValidate3, resetPasswordStep3);

router.use(createVerifyToken("user"));
/**
 * @swagger
 * /api/v1/auth/enable/2fa/otp:
 *   post:
 *     summary: Enable 2FA OTP based login
 *     description: Enable two-factor authentication using OTP for enhanced security
 *     tags: [Authentication, 2FA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         description: JWT Bearer access token
 *     responses:
 *       200:
 *         description: 2FA OTP enabled successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.post("/enable/2fa/otp", enableOTPbasedLogin);

/**
 * @swagger
 * /api/v1/auth/enable/2fa/verify/{token}:
 *   post:
 *     summary: Verify 2FA OTP
 *     description: Verify the OTP for two-factor authentication
 *     tags: [Authentication, 2FA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         description: JWT Bearer access token
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Temporary token from 2FA setup
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otp
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA verified successfully
 *       400:
 *         description: Invalid OTP or token
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/enable/2fa/verify/:token",
  tokenValidate,
  verify2FAValidate,
  verify2FAOTP,
);

/**
 * @swagger
 * /api/v1/auth/2fa/disable:
 *   post:
 *     summary: Disable 2FA OTP based login
 *     description: Disable two-factor authentication for the authenticated user. Password verification required for security.
 *     tags: [Authentication, 2FA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         description: JWT Bearer access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's current password for verification
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: 2FA OTP disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: OTP-based login disabled successfully
 *       400:
 *         description: Invalid password or 2FA not enabled
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Account not active
 *       404:
 *         description: User not found
 */
router.post("/2fa/disable", disable2FAValidation, disableOTPbasedLogin);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout from current device
 *     description: Logout the user from the current device and invalidate the current session
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.post("/logout", logout);

/**
 * @swagger
 * /api/v1/auth/logout/all-devices:
 *   post:
 *     summary: Logout from all devices
 *     description: Logout the user from all devices and invalidate all active sessions
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logged out from all devices successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.post("/logout/all-devices", logoutAllDevices);

/**
 * @swagger
 * /api/v1/auth/sessions:
 *   get:
 *     summary: Get all active sessions
 *     description: |
 *       Retrieve a list of all active sessions for the authenticated user.
 *       Shows device information, IP addresses, login times, and session expiration times.
 *       Useful for security monitoring and managing multiple logins.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: Session ID
 *                       deviceName:
 *                         type: string
 *                         description: Device name or model (e.g., iPhone 12, Dell XPS)
 *                       userAgent:
 *                         type: string
 *                         description: Device type (e.g., mobile, tablet, desktop)
 *                       ipAddress:
 *                         type: string
 *                         format: ipv4
 *                         description: IP address of the device
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Session creation timestamp
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                         description: Session expiration timestamp
 *                       isCurrent:
 *                         type: boolean
 *                         description: Indicates if this is the current session
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       404:
 *         description: User not found
 */
router.get("/sessions", activeSessions);

/**
 * @swagger
 * /api/v1/auth/user/delete/account:
 *   delete:
 *     summary: Delete user account
 *     description: |
 *       Permanently delete the authenticated user's account and all associated data.
 *       This is an irreversible action that will:
 *       - Remove all user data from the database
 *       - Invalidate all active sessions
 *       - Remove all user-generated content and records
 *       - Password verification required for security confirmation
 *     tags: [Authentication, Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         description: JWT Bearer access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - reason
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's current password for verification (required for security)
 *                 example: SecurePass123!
 *               reason:
 *                 type: string
 *                 description: Reason for account deletion (feedback for improvement)
 *                 example: No longer using the platform
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       400:
 *         description: Invalid password or missing required fields
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Account not active
 *       404:
 *         description: User not found
 */
router.delete("/user/delete/account", accountValidation, deleteAccount);

/**
 * @swagger
 * /api/v1/auth/user/recover/account:
 *   delete:
 *     summary: Recover deleted user account
 *     description: |
 *       Recover a previously deleted account within the recovery window (typically 30 days).
 *       This action will:
 *       - Restore the user account to active status
 *       - Recover associated user data
 *       - Re-enable access to all account features
 *       - Password verification required for security confirmation
 *       
 *       **Note:** Account recovery is only possible within a limited time window after deletion.
 *     tags: [Authentication, Account]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         description: JWT Bearer access token (if user still has valid token)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - reason
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's current password for verification (required for security)
 *                 example: SecurePass123!
 *               reason:
 *                 type: string
 *                 description: Reason for account recovery (feedback for improvement)
 *                 example: No longer using the platform
 *     responses:
 *       200:
 *         description: Account recovered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Account recovered successfully
 *       400:
 *         description: Invalid credentials or recovery window expired
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       404:
 *         description: Account not found or already permanently deleted
 *       410:
 *         description: Recovery period expired - account cannot be recovered
 */
router.delete("/user/recover/account", accountValidation, recoverAccount);

export default router;
