import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  logActivityService,
  getUserActivityService,
  getPostActivityStatsService,
  getActivitySummaryService,
} from "./activity.service.js";

// POST /activity
export const logActivity = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { postId, type, source, durationSec, metadata } = req.body;

  const activity = await logActivityService({
    userId,
    postId,
    type,
    source,
    durationSec,
    metadata,
  });

  return res.status(201).json({ success: true, data: activity });
});

// GET /activity
export const getUserActivity = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

  const result = await getUserActivityService(userId, page, limit);

  return res.status(200).json({ success: true, ...result });
});

// GET /activity/summary
export const getActivitySummary = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const result = await getActivitySummaryService(userId);

  return res.status(200).json({ success: true, data: result });
});

// GET /activity/post/:postId
export const getPostActivityStats = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const { postId } = req.params;
  if (!postId) throw new ApiError(400, "postId is required");

  const stats = await getPostActivityStatsService(postId);

  return res.status(200).json({ success: true, data: stats });
});