import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const SearchTypeEnum = z.enum(["foryou", "account", "trending", "tags", "posts"]);

const searchSchema = z.object({
  q: z
    .string()
    .min(1, "Query is required")
    .max(100, "Query cannot exceed 100 characters")
    .optional(), // Query is optional for trending or default foryou feed
  type: SearchTypeEnum.default("foryou"),
  page: z.string().regex(/^\d+$/, "Page must be a number").transform(Number).default(1),
  limit: z.string().regex(/^\d+$/, "Limit must be a number").transform(Number).default(20),
});

const recentSearchHistorySchema = z.object({
  limit: z.string().regex(/^\d+$/, "Limit must be a number").transform(Number).default(20),
});

const removeRecentSearchSchema = z.object({
  id: z.uuid("Invalid search history ID"),
});

export const validateSearchQuery = validationInput(searchSchema, "query");
export const validateRecentSearchQuery = validationInput(recentSearchHistorySchema, "query");
export const validateRemoveRecentSearchParams = validationInput(removeRecentSearchSchema, "params");
