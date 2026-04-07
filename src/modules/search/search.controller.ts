import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import * as searchService from "./search.service.js";

const search = asyncHandler(async (req: Request, res: Response) => {
  const { q, type, page, limit } = req.query as any;
  const userId = req.session!.userId as string;

  const results = await searchService.executeSearch({
    userId,
    query: q || "",
    type,
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    message: "Search results fetched successfully",
    data: results,
  });
});

const getRecentSearches = asyncHandler(async (req: Request, res: Response) => {
  const { limit } = req.query as any;
  const userId = req.session!.userId as string;

  const recentSearches = await searchService.getRecentSearches(userId, limit);

  res.status(200).json({
    success: true,
    message: "Recent searches fetched successfully",
    data: recentSearches,
  });
});

const removeRecentSearch = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = req.session!.userId as string;

  await searchService.removeRecentSearch(userId, id);

  res.status(200).json({
    success: true,
    message: "Search history item removed successfully",
  });
});

export const searchController = {
  search,
  getRecentSearches,
  removeRecentSearch,
};
