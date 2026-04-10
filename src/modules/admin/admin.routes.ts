import express from "express";
import { authRateLimit } from "../../middlewares/ratelimit.js";
import { createVerifyToken } from "../../middlewares/auth.js";
import { 
    adminLogin, 
    adminLoginOtpVerify,
    assignAdmin,
    activateAdmin,
    approveAdmin, 
    getAdminDetails,
    listAdmins,
    updateAdmin,
    deleteAdmin,
    refreshToken,
    logout,
    logoutAllDevices,
    getAdminSessions,
} from "./admin.controller.js";

import { 
    loginValidation,
    loginOTPVerificationVal,
    assignAdminValidation,
    activateAdminValidation,
    approveAdminValidation,
    listAdminsValidation,
    updateAdminValidation,
    deleteAdminValidation,
} from "./admin.validation.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/admin/login:
 *   post:
 *     summary: Admin login
 *     description: |
 *       Authenticate an admin user using email/username and password.
 *       Returns access and refresh tokens on success.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Email or username of the admin
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Admin account password
 *     responses:
 *       200:
 *         description: Authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Missing or invalid input
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests (rate limited)
 */
router.post("/login", authRateLimit, loginValidation, adminLogin);

/**
 * @swagger
 * /api/v1/admin/login/otp-verify:
 *   post:
 *     summary: Verify admin login OTP
 *     description: |
 *       Verify the OTP sent during admin login when MFA/OTP is required.
 *       Accepts a temporary token (from initial login) and the OTP code.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - otp
 *             properties:
 *               token:
 *                 type: string
 *                 description: Temporary token from initial login step
 *               otp:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 8
 *                 description: One-time password sent to admin
 *     responses:
 *       200:
 *         description: OTP verified, authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Missing or invalid input
 *       401:
 *         description: Invalid or expired OTP/token
 *       429:
 *         description: Too many attempts
 */
router.post("/login/otp-verify", authRateLimit, loginOTPVerificationVal, adminLoginOtpVerify);

/**
 * @swagger
 * /api/v1/admin/refresh-token:
 *   post:
 *     summary: Refresh admin access token
 *     description: |
 *       Exchange a valid refresh token for a new access token and refresh token.
 *       Requires an existing admin session and matching device/IP.
 *     tags: [Admin]
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
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: New tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Invalid request or token
 *       401:
 *         description: Unauthorized or expired token
 *       429:
 *         description: Too many requests (rate limited)
 */
router.post("/refresh-token", authRateLimit, refreshToken);

/**
 * @swagger
 * /api/v1/admin/profile:
 *   get:
 *     summary: Get admin profile
 *     description: |
 *       Retrieve the authenticated admin's profile details and permissions.
 *       Data is cached in Redis for 5 minutes for performance optimization.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         avatarUrl:
 *                           type: string
 *                           format: uri
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Account is not approved, inactive, or user details missing
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       404:
 *         description: Admin not found
 */
router.get("/profile", createVerifyToken(["moderator", "admin", "superadmin", "support"]), getAdminDetails);

/**
 * @swagger
 * /api/v1/admin/logout:
 *   post:
 *     summary: Logout admin
 *     description: |
 *       Logout the current admin session and revoke the current access token.
 *     tags: [Admin]
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
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid logout request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Session mismatch
 */
router.post("/logout", createVerifyToken(["moderator", "admin", "superadmin", "support"]), logout);

/**
 * @swagger
 * /api/v1/admin/logout/all:
 *   post:
 *     summary: Logout admin from all devices
 *     description: |
 *       Logout the admin from all active sessions and revoke the current access token.
 *     tags: [Admin]
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
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid logout request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Invalid admin
 */
router.post("/logout/all", createVerifyToken(["moderator", "admin", "superadmin", "support"]), logoutAllDevices);
router.get("/sessions", createVerifyToken(["moderator", "admin", "superadmin", "support"]), getAdminSessions);

router.use(createVerifyToken("superadmin"));
/**
 * @swagger
 * /api/v1/admin/assign:
 *   post:
 *     summary: Assign a user as admin
 *     description: |
 *       Creates an admin record for a user. Only superadmins can assign admins.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - role
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User id to assign as admin
 *               role:
 *                 type: string
 *                 enum: [admin, moderator, support, user]
 *                 description: Admin role for the user
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [manage_users, manage_content, view_reports, manage_settings]
 *                 description: Optional permissions list
 *     responses:
 *       200:
 *         description: Admin assigned successfully
 *       400:
 *         description: Missing or invalid input
 *       403:
 *         description: Forbidden
 *       409:
 *         description: User already admin
 */
router.post("/assign", authRateLimit, assignAdminValidation, assignAdmin);

/**
 * @swagger
 * /api/v1/admin/activate:
 *   post:
 *     summary: Activate an admin
 *     description: |
 *       Activates an approved admin account. Only superadmins can activate admins.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceAdminId
 *             properties:
 *               sourceAdminId:
 *                 type: string
 *                 description: Admin id or user id to activate
 *     responses:
 *       200:
 *         description: Admin activated successfully
 *       400:
 *         description: Missing or invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin not found
 */
router.post("/activate", authRateLimit, activateAdminValidation, activateAdmin);

/**
 * @swagger
 * /api/v1/admin/approve:
 *   post:
 *     summary: Approve an admin
 *     description: |
 *       Approves an admin account. Only superadmins can approve admins.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceAdminId
 *             properties:
 *               sourceAdminId:
 *                 type: string
 *                 description: Admin id or user id to approve
 *     responses:
 *       200:
 *         description: Admin approved successfully
 *       400:
 *         description: Missing or invalid input
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Admin not found
 *       409:
 *         description: Admin already approved
 */
router.post("/approve", authRateLimit, approveAdminValidation, approveAdmin);

router.get("/manage", listAdminsValidation, listAdmins);
router.patch("/manage", authRateLimit, updateAdminValidation, updateAdmin);
router.delete("/manage", authRateLimit, deleteAdminValidation, deleteAdmin);

export default router;
