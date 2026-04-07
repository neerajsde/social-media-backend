import { z } from "zod";
import { validationInput } from "../../utils/validation.js";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidSchema = z.object({
  postId: z.string().regex(uuidRegex, "Invalid UUID format"),
});

const presignedUrlSchema = z.object({
  postType: z.enum(["image", "video", "reel"], {
    message: "Invalid post type",
  }),
  mimeTypes: z.union([z.string(), z.array(z.string())]),
});

const basePostFields = {
  content: z.string().max(1000, "Maximum 1000 characters").optional(),

  tags: z
    .array(
      z.string().min(1, "Tag cannot be empty").max(100, "Maximum 100 tags"),
    )
    .max(20, "Maximum 20 tags allowed")
    .optional(),
  visibility: z.enum(["public", "private", "followers"]),
  status: z.enum(["active", "archived", "draft"]),
};

const postSchema = z.discriminatedUnion("postType", [
  // Text Post
  z.object({
    postType: z.literal("text"),
    ...basePostFields,
    content: z.string().max(1000, "Maximum 1000 characters"),
  }),

  // Image Post
  z.object({
    postType: z.literal("image"),
    ...basePostFields,
    images: z
      .array(z.string("Invalid image URL"))
      .max(10, "Maximum 10 images allowed")
      .min(1, "At least one image is required"),
  }),

  // Video Post
  z.object({
    postType: z.literal("video"),
    ...basePostFields,
    mediaUrl: z.string("Invalid video URL"),
    thumbnailUrl: z.string("Invalid thumbnail URL").optional(),
  }),

  // reel post
  z.object({
    postType: z.literal("reel"),
    ...basePostFields,
    mediaUrl: z.string("Invalid video URL"),
    thumbnailUrl: z.string("Invalid thumbnail URL").optional(),
    musicName: z.string("Music name is required"),
    musicUrl: z.url("music url is required"),
  }),
]);

const repostFields = uuidSchema.extend({
  content: z.string().max(1000, "Maximum 1000 characters").optional(),
  visibility: z.enum(["public", "private", "followers"]),
});

const updatePostFields = uuidSchema.extend({
  content: z.string().max(1000, "Maximum 1000 characters").optional(),
  visibility: z.enum(["public", "private", "followers"]),
  status: z.enum(["active", "archived", "draft"]),
});

const postComment = z.object({
  postId: z.string().regex(uuidRegex, "Invalid UUID format"),
  content: z.string().max(1000, "Maximum 1000 characters"),
  imageKey: z.string("Invaild Image url").max(500, "Invaild url").optional(),
});

const deleteComment = z.object({
  postId: z.string().regex(uuidRegex, "Invalid UUID format"),
  commentId: z.string().regex(uuidRegex, "Invalid UUID format"),
});

const commentReply = z.object({
  commentId: z.string().regex(uuidRegex, "Invalid UUID format"),
  content: z.string().max(1000, "Maximum 1000 characters"),
});

const editComment = z.object({
  commentId: z.string().regex(uuidRegex, "Invalid UUID format"),
  content: z.string().max(1000, "Maximum 1000 characters"),
});

const likeComment = z.object({
  commentId: z.string().regex(uuidRegex, "Invalid Comment Id."),
  postId: z.string().regex(uuidRegex, "Invalid Post Id."),
  userId: z.string().regex(uuidRegex, "Invalid User Id."),
});

export const createPostValidation = validationInput(postSchema);
export const presignedUrlValidation = validationInput(presignedUrlSchema);
export const postIdValidation = validationInput(uuidSchema, "params");
export const repostValidation = validationInput(repostFields);
export const updateValidation = validationInput(updatePostFields);
export const commentValidation = validationInput(postComment);
export const deleteCommentValidation = validationInput(deleteComment, "params");
export const commentReplyValidation = validationInput(commentReply);
export const editCommentValidation = validationInput(editComment);
export const likeCommentValidation = validationInput(likeComment);