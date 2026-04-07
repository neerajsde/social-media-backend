import { Router } from "express";
import {
  logActivity,
  getUserActivity,
  getActivitySummary,
  getPostActivityStats,
} from "./activity.controller.js";
import { createVerifyToken } from "../../middlewares/auth.js";
import {
  logActivityValidation,
  getPostActivityStatsValidation
} from "./activity.validation.js";

const router = Router();
router.use(createVerifyToken("user"));

/**
 * @swagger
 * /api/v1/activity/:
 *   post:
 *     summary: Log a post activity
 *     description: |
 *       Record an interaction made by the authenticated user on a post.
 *
 *       Supported activity types:
 *       - `view`
 *       - `like`
 *       - `unlike`
 *       - `comment`
 *       - `share`
 *       - `bookmark`
 *       - `unbookmark`
 *       - `repost`
 *
 *       Supported activity sources:
 *       - `feed`
 *       - `explore`
 *       - `random`
 *       - `profile`
 *       - `search`
 *       - `direct`
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - type
 *             properties:
 *               postId:
 *                 type: string
 *                 example: clx123post456
 *               type:
 *                 type: string
 *                 enum: [view, like, unlike, comment, share, bookmark, unbookmark, repost]
 *                 example: view
 *               source:
 *                 type: string
 *                 enum: [feed, explore, random, profile, search, direct]
 *                 example: feed
 *               durationSec:
 *                 type: integer
 *                 minimum: 0
 *                 example: 18
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 example:
 *                   sessionId: sess_123
 *                   positionSec: 42
 *     responses:
 *       201:
 *         description: Activity logged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     postId:
 *                       type: string
 *                     type:
 *                       type: string
 *                     source:
 *                       type: string
 *                     durationSec:
 *                       type: integer
 *                     metadata:
 *                       oneOf:
 *                         - type: object
 *                           additionalProperties: true
 *                         - type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields or invalid type/source
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.post("/", logActivityValidation, logActivity);              // log an activity

/**
 * @swagger
 * /api/v1/activity/:
 *   get:
 *     summary: Get authenticated user activity history
 *     description: Retrieve paginated activity records for the authenticated user, ordered from most recent to oldest.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: Activity history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       source:
 *                         type: string
 *                       durationSec:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       post:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           content:
 *                             type: string
 *                             nullable: true
 *                           postType:
 *                             type: string
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               avatarUrl:
 *                                 type: string
 *                                 nullable: true
 *                               isVerified:
 *                                 type: boolean
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.get("/", getUserActivity);           // get my activity history

/**
 * @swagger
 * /api/v1/activity/summary:
 *   get:
 *     summary: Get authenticated user activity summary
 *     description: Return aggregated activity counts by type and source, along with the user's most recently interacted posts.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activity summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     byType:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         view: 12
 *                         like: 4
 *                         share: 1
 *                     bySource:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         feed: 10
 *                         explore: 5
 *                     recentPosts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           source:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           post:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               content:
 *                                 type: string
 *                                 nullable: true
 *                               postType:
 *                                 type: string
 *                               user:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: string
 *                                   username:
 *                                     type: string
 *                                   avatarUrl:
 *                                     type: string
 *                                     nullable: true
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.get("/summary", getActivitySummary); // get my activity summary

/**
 * @swagger
 * /api/v1/activity/post/{postId}:
 *   get:
 *     summary: Get aggregated activity stats for a post
 *     description: Return grouped counts of all recorded activity types for the specified post.
 *     tags: [Activity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post identifier
 *     responses:
 *       200:
 *         description: Post activity stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                   example:
 *                     view: 24
 *                     like: 7
 *                     comment: 2
 *                     share: 1
 *       400:
 *         description: postId is required
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.get("/post/:postId", getPostActivityStatsValidation, getPostActivityStats); // get stats for a post

export default router;
