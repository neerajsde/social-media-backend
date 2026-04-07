import express from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import postRoutes from "../modules/post/post.routes.js";
import activityRoutes from "../modules/activity/activity.routes.js";
import searchRouter from "../modules/search/search.routes.js";
import marketPlaceRouter from "../modules/marketplace/marketplace.routers.js";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: |
 *       Authentication endpoints for user registration, login, and password management.
 *       - **Registration Flow**: Email OTP → Verify OTP → Account Created
 *       - **Login Flow**: Email OTP → Verify OTP → JWT Tokens
 *       - **Password Reset**: Request OTP → Verify OTP → Set New Password
 *   - name: User
 *     description: |
 *       User profile management endpoints.
 *       - View and update profile information
 *       - Manage social media links
 *       - Change email and password with verification
 *   - name: "2FA"
 *     description: |
 *       Two-factor authentication endpoints for enhanced security.
 *       - Enable 2FA with OTP
 *       - Verify 2FA tokens
 *   - name: "Admin"
 *     description: |
 *       Authentication endpoints for user registration, login, and password management.
 *       - Login
 *   - name: Post
 *     description: |
 *       Post creation and media upload preparation endpoints.
 *       - Generate presigned URLs for image/video/reel uploads
 *       - Create text, image, video, and reel posts
 *   - name: Activity
 *     description: |
 *       Activity tracking endpoints for authenticated users.
 *       - Log post interactions such as views, likes, comments, and shares
 *       - Fetch personal activity history and summary insights
 *       - Inspect aggregated activity stats for a specific post
 */

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/post', postRoutes);
router.use('/activity', activityRoutes);
router.use('/search', searchRouter);
router.use('/marketPlace', marketPlaceRouter);

export default router;
