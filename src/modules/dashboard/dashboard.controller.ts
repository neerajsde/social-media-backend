import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import * as dashboardService from "./dashboard.service.js";

export const getUserAnalyticsStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await dashboardService.getUserStats();
  
  return res.status(200).json({
    success: true,
    message: "User analytics stats retrieved successfully",
    data: stats,
  });
});

export const getUserAnalyticsList = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, status, batch } = req.query as any;
  
  const result = await dashboardService.getUserList({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: search as string,
    status,
    batch,
  });

  return res.status(200).json({
    success: true,
    message: "User list retrieved successfully",
    ...result,
  });
});

export const getUserAnalyticsGrowth = asyncHandler(async (req: Request, res: Response) => {
  const growth = await dashboardService.getUserGrowth();

  return res.status(200).json({
    success: true,
    message: "User growth data retrieved successfully",
    data: growth,
  });
});
