import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidSchema = z.object({
  postId: z.string().regex(uuidRegex, "Invalid Post Id"),
});

const logActivitySchema = uuidSchema.extend({
    type: z.enum(["view", "like", "unlike", "comment", "share", "bookmark", "unbookmark", "repost"]), 
    source: z.enum(["feed", "explore", "random", "profile", "serach", "direct"]), 
    durationSec: z.number().min(0, "Invaild duration in sec").optional(), 
    metadata: z.json().optional()
});


export const logActivityValidation = validationInput(logActivitySchema);
export const getPostActivityStatsValidation = validationInput(uuidSchema, "params");