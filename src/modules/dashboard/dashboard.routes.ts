import express from "express";
import { createVerifyToken } from "../../middlewares/auth.js";
import * as dashboardController from "./dashboard.controller.js";
import { validateUserListQuery } from "./dashboard.validation.js";

const router = express.Router();

// Apply admin verification to all dashboard routes
router.use(createVerifyToken(["admin", "superadmin"]));

/**
 * @swagger
 * /api/v1/dashboard/stats:
 *   get:
 *     summary: Get user analytics statistics
 *     description: |
 *       Retrieve aggregated counts for user-related metrics:
 *       - Total number of registered users
 *       - Count of active users
 *       - Count of verified users
 *       - Count of premium subscribers
 *       - Count of new users registered in the last 24 hours
 *       Results are cached for 1 hour for optimal performance.
 *     tags: [Dashboard]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: User analytics statistics retrieved successfully
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
 *                     total:
 *                       type: integer
 *                       example: 1000000
 *                     active:
 *                       type: integer
 *                       example: 950000
 *                     verified:
 *                       type: integer
 *                       example: 50000
 *                     premium:
 *                       type: integer
 *                       example: 15000
 *                     newUsers:
 *                       type: integer
 *                       example: 1200
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - insufficient permissions
 */
router.get("/stats", dashboardController.getUserAnalyticsStats);

/**
 * @swagger
 * /api/v1/dashboard/users:
 *   get:
 *     summary: Get paginated user list with filters
 *     description: |
 *       Retrieve a list of users with pagination and various filtering options.
 *       Supports searching by username, email, or name, and filtering by status or user batch.
 *     tags: [Dashboard]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username, email, first name, or last name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, blocked, deleted]
 *         description: Filter users by status
 *       - in: query
 *         name: batch
 *         schema:
 *           type: string
 *           enum: [NONE, STAR_1, STAR_2, STAR_3, STAR_4, STAR_5]
 *         description: Filter users by their batch classification
 *     responses:
 *       200:
 *         description: User list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       first_name:
 *                         type: string
 *                       last_name:
 *                         type: string
 *                       avatarUrl:
 *                         type: string
 *                       isVerified:
 *                         type: boolean
 *                       status:
 *                         type: string
 *                       batch:
 *                         type: string
 *                       isPremium:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastSeenAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/users", validateUserListQuery, dashboardController.getUserAnalyticsList);

/**
 * @swagger
 * /api/v1/dashboard/growth:
 *   get:
 *     summary: Get user registration growth trends
 *     description: |
 *       Retrieve daily user registration counts for the last 30 days.
 *       Used for building growth charts and visualizing user acquisition trends.
 *       Data is cached for 1 hour.
 *     tags: [Dashboard]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: User growth data retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                         example: "2024-03-21"
 *                       count:
 *                         type: integer
 *                         example: 150
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get("/growth", dashboardController.getUserAnalyticsGrowth);

export default router;
