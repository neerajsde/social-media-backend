import express from "express";
import {
  createPost,
  deletePost,
  rePost,
  generatePresignedUrl,
  updatePost,
  bookmarkPost,
  likePost,
  dislikePost,
  commentOnPost,
  editComment,
  deleteComment,
  replyOnComment,
  likeComment,
  sharePostInApp,
  sharePostExternally,
  getFeedPosts,
  getPost,
  getPostComments,
} from "./post.controller.js";
import {
  createPostValidation,
  presignedUrlValidation,
  postIdValidation,
  repostValidation,
  updateValidation,
  commentValidation,
  deleteCommentValidation,
  commentReplyValidation,
  editCommentValidation,
} from "./post.validation.js";
import { createVerifyToken } from "../../middlewares/auth.js";

const router = express.Router();
router.use(createVerifyToken("user"));

/**
 * @swagger
 * /api/v1/post/presigned-url:
 *   post:
 *     summary: Generate presigned upload URL(s) for post media
 *     description: |
 *       Generate AWS S3 presigned URL(s) before creating image/video/reel posts.
 *
 *       - For `image`, send `mimeTypes` as an array of image MIME types.
 *       - For `video` or `reel`, send `mimeTypes` as a single video MIME type string.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postType
 *               - mimeTypes
 *             properties:
 *               postType:
 *                 type: string
 *                 enum: [image, video, reel]
 *                 example: image
 *               mimeTypes:
 *                 oneOf:
 *                   - type: string
 *                     enum: [video/mp4, video/webm]
 *                     example: video/mp4
 *                   - type: array
 *                     items:
 *                       type: string
 *                       enum: [image/jpeg, image/png, image/webp, image/gif]
 *                     minItems: 1
 *                     example: [image/jpeg, image/png]
 *     responses:
 *       200:
 *         description: Presigned URL(s) generated successfully
 *       400:
 *         description: Invalid postType or mimeTypes
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.post("/presigned-url", presignedUrlValidation, generatePresignedUrl);

/**
 * @swagger
 * /api/v1/post/:
 *   post:
 *     summary: Create a post
 *     description: |
 *       Create a post for the authenticated user.
 *
 *       Shared request rules:
 *       - `visibility` is required for all post types and must be one of `public`, `private`, or `followers`
 *       - `status` is required for all post types and must be one of `active`, `archived`, or `draft`
 *       - `content` is optional for `image`, `video`, and `reel`, but required for `text`
 *       - `tags` is optional, supports up to 20 entries, and each tag must be 1 to 100 characters
 *
 *       Type-specific rules:
 *       - `text`: requires `content`
 *       - `image`: requires `images` with 1 to 10 uploaded image file keys
 *       - `video`: requires `mediaUrl`; `thumbnailUrl` is optional
 *       - `reel`: requires `mediaUrl`, `musicName`, and a valid `musicUrl`; `thumbnailUrl` is optional
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             discriminator:
 *               propertyName: postType
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - postType
 *                   - content
 *                   - visibility
 *                   - status
 *                 properties:
 *                   postType:
 *                     type: string
 *                     enum: [text]
 *                   content:
 *                     type: string
 *                     maxLength: 1000
 *                   visibility:
 *                     type: string
 *                     enum: [public, private, followers]
 *                   status:
 *                     type: string
 *                     enum: [active, archived, draft]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     maxItems: 20
 *                 example:
 *                   postType: text
 *                   content: Hello everyone
 *                   visibility: public
 *                   status: active
 *                   tags: [intro, update]
 *               - type: object
 *                 required:
 *                   - postType
 *                   - images
 *                   - visibility
 *                   - status
 *                 properties:
 *                   postType:
 *                     type: string
 *                     enum: [image]
 *                   content:
 *                     type: string
 *                     maxLength: 1000
 *                   images:
 *                     type: array
 *                     items:
 *                       type: string
 *                     minItems: 1
 *                     maxItems: 10
 *                   visibility:
 *                     type: string
 *                     enum: [public, private, followers]
 *                   status:
 *                     type: string
 *                     enum: [active, archived, draft]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     maxItems: 20
 *                 example:
 *                   postType: image
 *                   content: Behind the scenes
 *                   images: [uploads/post/image-1.webp, uploads/post/image-2.webp]
 *                   visibility: followers
 *                   status: active
 *                   tags: [bts, photoshoot]
 *               - type: object
 *                 required:
 *                   - postType
 *                   - mediaUrl
 *                   - visibility
 *                   - status
 *                 properties:
 *                   postType:
 *                     type: string
 *                     enum: [video]
 *                   content:
 *                     type: string
 *                     maxLength: 1000
 *                   mediaUrl:
 *                     type: string
 *                   thumbnailUrl:
 *                     type: string
 *                   visibility:
 *                     type: string
 *                     enum: [public, private, followers]
 *                   status:
 *                     type: string
 *                     enum: [active, archived, draft]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     maxItems: 20
 *                 example:
 *                   postType: video
 *                   content: New teaser clip
 *                   mediaUrl: uploads/post/video-1.mp4
 *                   thumbnailUrl: uploads/post/video-1-thumb.webp
 *                   visibility: public
 *                   status: draft
 *                   tags: [teaser]
 *               - type: object
 *                 required:
 *                   - postType
 *                   - mediaUrl
 *                   - visibility
 *                   - status
 *                   - musicName
 *                   - musicUrl
 *                 properties:
 *                   postType:
 *                     type: string
 *                     enum: [reel]
 *                   content:
 *                     type: string
 *                     maxLength: 1000
 *                   mediaUrl:
 *                     type: string
 *                   thumbnailUrl:
 *                     type: string
 *                   musicName:
 *                     type: string
 *                   musicUrl:
 *                     type: string
 *                     format: uri
 *                   visibility:
 *                     type: string
 *                     enum: [public, private, followers]
 *                   status:
 *                     type: string
 *                     enum: [active, archived, draft]
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     maxItems: 20
 *                 example:
 *                   postType: reel
 *                   content: Weekend reel
 *                   mediaUrl: uploads/post/reel-1.mp4
 *                   thumbnailUrl: uploads/post/reel-1-thumb.webp
 *                   musicName: Summer Vibes
 *                   musicUrl: https://example.com/audio/summer-vibes
 *                   visibility: public
 *                   status: active
 *                   tags: [reel, trending]
 *     responses:
 *       200:
 *         description: Post created successfully
 *       400:
 *         description: Invalid input, file verification failed, user not found, or account/post-limit restriction
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       500:
 *         description: Reel file verification failed
 */
router.post("/", createPostValidation, createPost);

/**
 * @swagger
 * /api/v1/post/update:
 *   put:
 *     summary: Update a post
 *     description: Update content, visibility, or status of a post owned by the authenticated user.
 *     tags: [Post]
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
 *               - visibility
 *               - status
 *             properties:
 *               postId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *               visibility:
 *                 type: string
 *                 enum: [public, private, followers]
 *               status:
 *                 type: string
 *                 enum: [active, archived, draft]
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       400:
 *         description: Invalid request or post not found
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - post does not belong to authenticated user
 */
router.put("/update", updateValidation, updatePost);

/**
 * @swagger
 * /api/v1/post/{postId}:
 *   delete:
 *     summary: Delete a post
 *     description: Delete a post owned by the authenticated user.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       400:
 *         description: Invalid post id or bad request
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - post does not belong to authenticated user
 */
router.delete("/:postId", postIdValidation, deletePost);

/**
 * @swagger
 * /api/v1/post/repost:
 *   post:
 *     summary: Repost a post
 *     description: Create a repost of an existing post for the authenticated user.
 *     tags: [Post]
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
 *               - visibility
 *             properties:
 *               postId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *               visibility:
 *                 type: string
 *                 enum: [public, private, followers]
 *     responses:
 *       200:
 *         description: Post reposted successfully
 *       400:
 *         description: Invalid request, repost limit reached, or duplicate repost
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - cannot repost this post
 *       404:
 *         description: Post not found
 */
router.post("/repost", repostValidation, rePost);

/**
 * @swagger
 * /api/v1/post/bookmark/{postId}:
 *   post:
 *     summary: Bookmark a post
 *     description: Add a post to the authenticated user's bookmarks.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post bookmarked successfully
 *       400:
 *         description: Invalid request, post inactive, or already bookmarked
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - account is not active
 *       404:
 *         description: User or post not found
 */
router.post("/bookmark/:postId", postIdValidation, bookmarkPost);

/**
 * @swagger
 * /api/v1/post/like/{postId}:
 *   patch:
 *     summary: Like a post
 *     description: Add a like to an active post for the authenticated user.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post liked successfully
 *       400:
 *         description: Invalid request, post inactive, or already liked
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - account is not active
 *       404:
 *         description: User or post not found
 */
router.patch("/like/:postId", postIdValidation, likePost);

/**
 * @swagger
 * /api/v1/post/dislike/{postId}:
 *   patch:
 *     summary: Dislike a post
 *     description: Remove the authenticated user's like from an active post.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post disliked successfully
 *       400:
 *         description: Invalid request or post inactive
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - account is not active
 *       404:
 *         description: User or post not found
 */
router.patch("/dislike/:postId", postIdValidation, dislikePost);

/**
 * @swagger
 * /api/v1/post/comment:
 *   post:
 *     summary: Comment on a post
 *     description: Add a comment to an active post as the authenticated user, with optional image attachment.
 *     tags: [Post]
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
 *               - content
 *             properties:
 *               postId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *               imageKey:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional uploaded image file key
 *     responses:
 *       200:
 *         description: Comment created successfully
 *       400:
 *         description: Invalid request, inactive post, invalid image key, or comment limit reached
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - account is not active
 *       404:
 *         description: User or post not found
 */
router.post("/comment", commentValidation, commentOnPost);

/**
 * @swagger
 * /api/v1/post/comment:
 *   put:
 *     summary: Edit a comment
 *     description: Update the authenticated user's existing comment on an active post.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commentId
 *               - content
 *             properties:
 *               commentId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid request or post is not active
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - account is not active or comment does not belong to user
 *       404:
 *         description: User or comment not found
 */
router.put("/comment", editCommentValidation, editComment);

/**
 * @swagger
 * /api/v1/post/comment/reply:
 *   post:
 *     summary: Reply to a comment
 *     description: Add a reply to an existing comment on an active post.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commentId
 *               - content
 *             properties:
 *               commentId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Reply added successfully
 *       400:
 *         description: Missing/invalid input or inactive post/account
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       404:
 *         description: Comment not found
 */
router.post("/comment/reply", commentReplyValidation, replyOnComment);

/**
 * @swagger
 * /api/v1/post/comment/{postId}/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     description: Delete the authenticated user's comment from an active post.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       400:
 *         description: Invalid request or post/account is not active
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       404:
 *         description: Post not found or invalid comment id
 */
router.delete(
  "/comment/:postId/:commentId",
  deleteCommentValidation,
  deleteComment,
);

/**
 * @swagger
 * /api/v1/post/like-unlike-comment/{commentId}/{postId}:
 *   post:
 *     summary: Toggle like on a comment
 *     description: Add or remove the authenticated user's like on a comment for a specific post.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Comment like state toggled successfully
 *       400:
 *         description: User, post, or comment was not found, or the account is not active
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       404:
 *         description: Missing comment id or post id
 */
router.post("/like-unlike-comment/:commentId/:postId", likeComment);

/**
 * @swagger
 * /api/v1/post/share-post-in-app/{postId}/{receiverId}:
 *   post:
 *     summary: Share a post in app
 *     description: Send an active post from the authenticated user to another active user inside the app.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: receiverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Post shared in app successfully
 *       400:
 *         description: Missing input, receiver account inactive, or post is not available
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Sender account is not active
 *       404:
 *         description: Sender, receiver, or post not found
 */
router.post('/share-post-in-app/:postId/:receiverId', sharePostInApp)

/**
 * @swagger
 * /api/v1/post/share-post-externally/{postId}:
 *   post:
 *     summary: Share a post externally
 *     description: |
 *       Record an external post share by the authenticated user.
 *
 *       The request body must include the destination `source`.
 *       The current controller also expects a `link` route parameter, but the route only defines `postId`.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - source
 *             properties:
 *               source:
 *                 type: string
 *                 enum: [whatsapp, instgram, facebook, twitter, inApp]
 *                 example: whatsapp
 *     responses:
 *       201:
 *         description: Post shared externally successfully
 *       400:
 *         description: Missing input or post is not available
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Sender account is not active
 *       404:
 *         description: Source missing or sender/post not found
 */
router.post('/share-post-externally/:postId', sharePostExternally);

/**
 * @swagger
 * /api/v1/post/feed:
 *   get:
 *     summary: Get feed posts
 *     description: |
 *       Return paginated feed posts for the authenticated user.
 *
 *       The feed includes:
 *       - the authenticated user's own active posts
 *       - active posts from accounts the user follows
 *       - only posts with `public` or `followers` visibility
 *       - reposts with normalized parent post details when available
 *
 *       Pagination is currently read from query parameters.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of feed posts to return per page
 *     responses:
 *       200:
 *         description: Feed posts fetched successfully
 *       401:
 *         description: Unauthorized - missing or invalid token
 */
router.get('/feed', getFeedPosts);

/**
 * @swagger
 * /api/v1/post/{postId}:
 *   get:
 *     summary: Get a single post
 *     description: |
 *       Return a single active post by its ID.
 *
 *       Access rules:
 *       - `public` posts are visible to everyone
 *       - `private` posts are only visible to the post owner
 *       - `followers` posts are visible to the owner and followers of the author
 *
 *       When the requester is authenticated, the response also includes viewer-specific
 *       state such as whether the post is liked, bookmarked, owned by the viewer, and
 *       whether the viewer follows the author.
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the post to fetch
 *     responses:
 *       200:
 *         description: Post fetched successfully
 *       400:
 *         description: Post ID missing or post is not active
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: The post is private or restricted to followers
 *       404:
 *         description: Post not found
 */
router.get('/:postId', getPost);

/**
 * @swagger
 * /api/v1/post/{postId}/comments:
 *   get:
 *     summary: Get comments for a post
 *     description: |
 *       Return paginated top-level comments for a single active post.
 *
 *       Access follows the same visibility rules as the parent post:
 *       - `public` posts are visible to everyone
 *       - `private` posts are only visible to the post owner
 *       - `followers` posts are visible to the owner and followers of the author
 *     tags: [Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the post whose comments should be fetched
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for comment pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of comments to return per page
 *     responses:
 *       200:
 *         description: Comments fetched successfully
 *       400:
 *         description: Post ID missing
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: The post is private or restricted to followers
 *       404:
 *         description: Post not found or inactive
 */
router.get('/:postId/comments', getPostComments);
export default router;
