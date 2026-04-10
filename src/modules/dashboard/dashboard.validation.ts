import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const userListQuerySchema = z.object({
  page: z.preprocess((val) => Number(val) || 1, z.number().min(1)).optional(),
  limit: z.preprocess((val) => Number(val) || 10, z.number().min(1).max(100)).optional(),
  search: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "suspended", "deleted"]).optional(),
  batch: z.string().trim().optional(),
});

export const validateUserListQuery = validationInput(userListQuerySchema, "query");
