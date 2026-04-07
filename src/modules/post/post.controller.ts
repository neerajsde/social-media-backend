import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";
import { bulkNotificationQueue } from "../../queues/messaging.queue.js";
import {
  deleteFile,
  deleteFiles,
  generateMultipleUploadURLs,
  generateUploadURL,
} from "../../services/aws.js";
import { getClientIp } from "../auth/auth.service.js";
import { verifyFileKey, verifyFileKeys } from "./post.services.js";
import { addScanVideoJob } from "../../queues/video.queue.js";

export const generatePresignedUrl = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { mimeTypes, postType } = req.body;

  if (!userId) {
    throw new ApiError(401, "unauthorized");
  }

  const ip = getClientIp(req);

  if (postType === "image") {
    if (!Array.isArray(mimeTypes) || mimeTypes.length === 0) {
      throw new ApiError(400, "mimeTypes must be a non-empty array");
    }

    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/heif",
    ];

    // Validate all mime types
    const invalidType = mimeTypes.find(
      (type) => !allowedMimeTypes.includes(type),
    );

    if (invalidType) {
      throw new ApiError(400, `Unsupported file type: ${invalidType}`);
    }

    // Generate URLs
    const payload = await generateMultipleUploadURLs(mimeTypes);

    // Prepare bulk insert
    const uploadRecords = payload.map((item) => ({
      userId,
      mimeType: item.contentType,
      fileKey: item.key,
      uploadUrl: item.url,
      ipAddress: ip,
    }));

    await prisma.awsUploads.createMany({
      data: uploadRecords,
    });

    return res.status(200).json({
      success: true,
      data: payload,
    });
  }

  if (postType === "reel" || postType === "video") {
    if (!mimeTypes) {
      throw new ApiError(400, "mimeType is required");
    }

    const allowedMimeTypes = ["video/mp4", "video/webm", "video/mov"];

    if (!allowedMimeTypes.includes(mimeTypes)) {
      throw new ApiError(400, "Unsupported file type");
    }

    const { url, key } = await generateUploadURL(mimeTypes);

    await prisma.awsUploads.create({
      data: {
        userId,
        mimeType: mimeTypes,
        fileKey: key,
        uploadUrl: url,
        ipAddress: ip,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Presigned URL generated",
      uploadUrl: url,
      fileKey: key,
    });
  }

  throw new ApiError(400, "Invalid postType");
});

export const createPost = asyncHandler(async (req, res) => {
  const { postType, tags = [], visibility, status } = req.body;
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(401, "unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ApiError(400, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(400, `Account is ${user.status}`);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const postLimit = await prisma.post.findMany({
    where: {
      userId,
      createdAt: {
        gte: startOfToday,
      },
    },
  });

  if (postLimit.length > 10) {
    throw new ApiError(400, "Post limit reached of today");
  }

  const ip = getClientIp(req);

  let post = null;
  if (postType === "text") {
    const { content } = req.body;
    if (!content) {
      throw new ApiError(400, "content is required");
    }

    post = await prisma.post.create({
      data: {
        userId,
        content,
        postType,
        visibility,
        status,
      },
    });
  } else if (postType === "image") {
    let { content, images = [] } = req.body;
    if (images.length === 0) {
      throw new ApiError(400, "images is required");
    }

    images = [...new Set(images)];

    // verify images urls
    const isVerified = await verifyFileKeys(userId, images, ip);
    if (!isVerified) {
      throw new ApiError(400, "Invaild Images");
    }

    post = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          userId,
          content,
          postType,
          images,
          visibility,
          status,
        },
      });

      await tx.awsUploads.updateMany({
        where: {
          fileKey: {
            in: images,
          },
          userId,
          ipAddress: ip,
        },
        data: {
          status: "USED",
        },
      });

      return post;
    });
  } else if (postType === "video") {
    const { content, mediaUrl, thumbnailUrl } = req.body;

    const isVerified = await verifyFileKey(userId, mediaUrl, ip);
    if (!isVerified) {
      throw new ApiError(400, "Invaild Video");
    }

    post = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          userId,
          content,
          postType,
          visibility,
          status,
        },
      });

      await tx.video.create({
        data: {
          postId: post.id,
          originalVideo: mediaUrl,
          thumbnail: thumbnailUrl,
        },
      });

      await tx.awsUploads.updateMany({
        where: {
          fileKey: mediaUrl,
          userId,
          ipAddress: ip,
        },
        data: {
          status: "USED",
        },
      });

      return post;
    });

    await addScanVideoJob({
      key: mediaUrl,
      postId: post.id
    });
    console.log("Addded to queue");
  } else if (postType === "reel") {
    const { content, mediaUrl, musicName, musicUrl } = req.body;

    const isVerified = await verifyFileKey(userId, mediaUrl, ip);
    if (!isVerified) {
      throw new ApiError(500, "Invaild reel");
    }

    post = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          userId,
          content,
          postType,
          visibility,
          status,
        },
      });

      await tx.video.create({
        data: {
          postId: post.id,
          originalVideo: mediaUrl,
        },
      });

      await tx.reel.create({
        data: {
          postId: post.id,
          musicName,
          musicUrl,
        },
      });

      await tx.awsUploads.updateMany({
        where: {
          fileKey: mediaUrl,
          userId,
          ipAddress: ip,
        },
        data: {
          status: "USED",
        },
      });

      return post;
    });

    await addScanVideoJob({
      key: mediaUrl,
      postId: post.id,
    });
  }

  if (!post) {
    throw new ApiError(400, "Something went wrong");
  }

  await prisma.hashtag.createMany({
    data: tags.map((tag: string) => ({
      tag,
      createdBy: userId,
    })),
    skipDuplicates: true,
  });

  const savedTags = await prisma.hashtag.findMany({
    where: {
      tag: { in: tags },
      createdBy: userId,
    },
  });

  await prisma.postHashtag.createMany({
    data: savedTags.map((tag: any) => ({
      postId: post.id,
      hashtagId: tag.id,
    })),
    skipDuplicates: true,
  });

  // notify to all followers
  await bulkNotificationQueue.add("Post-Notification", {
    postId: post.id,
    userId: userId,
  });

  return res.status(200).json({
    success: true,
    message: "New post created.",
  });
});

export const updatePost = asyncHandler(async (req, res) => {
  const { postId, content, visibility, status } = req.body;
  const userId = req.session?.userId;

  if (!userId || !postId) {
    throw new ApiError(400, "Invaild request");
  }

  const post = await prisma.post.findFirst({
    where: { id: postId },
    include: {
      user: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!post) {
    throw new ApiError(400, "Post not found");
  }

  if (post.userId !== userId) {
    throw new ApiError(403, "Forbidden");
  }

  if (!post.user) {
    throw new ApiError(400, "user not found");
  }

  if (post.user.status !== "active") {
    throw new ApiError(400, `Your account is ${post.user.status}`);
  }

  const isUpdated = await prisma.post.update({
    where: { id: postId },
    data: {
      content,
      status,
      visibility,
    },
  });

  if (!isUpdated) {
    throw new ApiError(400, "Something went wrong, Please try again later.");
  }

  return res.status(200).json({
    success: true,
    message: "Post updated successfully",
  });
});

export const deletePost = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { postId } = req.params;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!postId) {
    throw new ApiError(400, "Post id is required");
  }

  const post = await prisma.post.findFirst({
    where: { id: postId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          status: true,
        },
      },
    },
  });

  if (!post) {
    throw new ApiError(400, "Invaild post id");
  }

  if (post.user.id !== userId) {
    throw new ApiError(403, "Forbiden");
  }

  if (post.user.status !== "active") {
    throw new ApiError(400, `Your account is ${post.user.status}`);
  }

  if (post.postType === "image") {
    const fileKeys = post.images;
    await deleteFiles(fileKeys, userId);
  }

  // TODO:
  // if (post.postType === "video" || post.postType === "reel") {
  //   if (post.mediaUrl) await deleteFile(post.mediaUrl, userId);
  //   if (post.thumbnailUrl) await deleteFile(post.thumbnailUrl, userId);
  // }

  if (post.postType === "reel") {
    await prisma.reel.delete({
      where: { postId: postId },
    });
  }

  await prisma.$transaction([
    prisma.postHashtag.deleteMany({
      where: { postId: post.id },
    }),

    prisma.post.delete({
      where: { id: postId },
    }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Post deleted sucessfully",
  });
});

export const rePost = asyncHandler(async (req, res) => {
  const { postId, content, visibility } = req.body;
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(401, "unauthorized");
  }

  if (!postId) {
    throw new ApiError(400, "Post_id is required");
  }

  const parent_post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!parent_post) {
    throw new ApiError(404, "Post not found");
  }

  if (parent_post.status !== "active") {
    throw new ApiError(400, `Post is ${parent_post.status}`);
  }

  if (parent_post.visibility === "private") {
    throw new ApiError(403, "You can't respost this post");
  }

  const alreadyReposted = await prisma.post.findFirst({
    where: {
      userId: userId,
      parentPostId: parent_post.id,
    },
  });

  if (alreadyReposted) {
    throw new ApiError(400, "You already reposted this.");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const postLimit = await prisma.post.findMany({
    where: {
      userId,
      postType: "repost",
      createdAt: {
        gte: startOfToday,
      },
    },
  });

  if (postLimit.length > 10) {
    throw new ApiError(400, "Post limit reached of today");
  }

  const newPost = await prisma.post.create({
    data: {
      userId,
      content,
      postType: "repost",
      isReply: true,
      parentPostId: parent_post.id,
      visibility,
    },
  });

  if (!newPost) {
    throw new ApiError(400, "something went wrong please try later.");
  }

  return res.status(200).json({
    success: true,
    message: "Post reposted",
  });
});

export const bookmarkPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.session?.userId;

  if (!userId || !postId) {
    throw new ApiError(400, "Invalid request");
  }

  const [user, post] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    }),

    prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Your account is ${user.status}`);
  }

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, `Post is ${post.status}`);
  }

  try {
    await prisma.bookmark.create({
      data: {
        userId,
        postId,
      },
    });
  } catch (error: any) {
    // Handle duplicate bookmark
    if (error.code === "P2002") {
      throw new ApiError(400, "You have already bookmarked this post");
    }

    throw new ApiError(500, "Something went wrong");
  }

  return res.status(200).json({
    success: true,
    message: "Post bookmarked successfully",
  });
});

export const likePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.session?.userId;

  if (!userId || !postId) {
    throw new ApiError(400, "Invalid request");
  }

  const [user, post] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    }),

    prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, likeCount: true },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Your account is ${user.status}`);
  }

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, `Post is ${post.status}`);
  }

  try {
    await prisma.postLike.create({
      data: {
        userId,
        postId,
        isLiked: true,
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new ApiError(400, "You have already liked this post");
    }

    throw new ApiError(500, "Something went wrong");
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      likeCount: {
        increment: 1,
      },
    },
  });

  return res.status(200).json({
    success: true,
    message: "Post Liked",
  });
});

export const dislikePost = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { postId } = req.params;

  if (!userId || !postId) {
    throw new ApiError(400, "Invalid request");
  }

  const [user, post] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    }),

    prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, likeCount: true },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Your account is ${user.status}`);
  }

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, `Post is ${post.status}`);
  }

  const alreadyLiked = await prisma.postLike.findFirst({
    where: { userId, postId },
  });

  if (!alreadyLiked) {
    return res.status(200).json({
      success: true,
      message: "Post disliked",
    });
  }

  await prisma.postLike.deleteMany({
    where: {
      userId,
      postId,
    },
  });

  await prisma.post.update({
    where: { id: postId },
    data: {
      likeCount: {
        decrement: 1,
      },
    },
  });

  return res.status(200).json({
    success: true,
    message: "Post disliked",
  });
});

export const commentOnPost = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { postId, content, imageKey } = req.body;

  if (!userId || !postId) {
    throw new ApiError(400, "Invalid request");
  }

  const [user, post, lastComments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
      },
    }),

    prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: true,
      },
    }),

    prisma.comment.findMany({
      where: { userId, postId, parentId: null },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Your account is ${user.status}`);
  }

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, `Post is ${post.status}`);
  }

  if (lastComments && lastComments.length > 10) {
    throw new ApiError(400, "Limit reached, Can't comment on this post");
  }

  const ip = getClientIp(req);
  if (imageKey) {
    if (!(await verifyFileKey(userId, imageKey, ip))) {
      throw new ApiError(400, "Invaild Image Key");
    }
  }

  let newComment = await prisma.comment.create({
    data: {
      userId,
      postId,
      content: content.trim(),
      image: imageKey,
    },
  });

  if (!newComment) {
    throw new ApiError(500, "Can't comment on this post");
  }

  if (post.user.id === userId) {
    newComment = await prisma.comment.update({
      where: { id: newComment.id },
      data: {
        pin: true,
      },
    });
  }

  await prisma.awsUploads.updateMany({
    where: {
      fileKey: imageKey,
      ipAddress: ip,
      userId,
    },
    data: {
      status: "USED",
    },
  });

  return res.status(200).json({
    success: true,
    message: "Comment successfully",
    newComment,
  });
});

export const editComment = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { commentId, content } = req.body;

  if (!userId || !commentId || !content?.trim()) {
    throw new ApiError(400, "Invalid request");
  }

  const [user, comment] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
      },
    }),

    prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: true,
      },
    }),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(403, `Your account is ${user.status}`);
  }

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.userId !== userId) {
    throw new ApiError(403, "You are not allowed to edit this comment");
  }

  const EDIT_LIMIT = 15 * 60 * 1000;
  if (Date.now() - new Date(comment.createdAt).getTime() > EDIT_LIMIT) {
    throw new ApiError(403, "Edit time expired");
  }

  if (comment.post.status !== "active") {
    throw new ApiError(400, `Post is ${comment.post.status}`);
  }

  if (comment.content === content.trim()) {
    throw new ApiError(400, "No changes detected");
  }

  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: {
      content: content.trim(),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully",
    updatedComment,
  });
});

export const deleteComment = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { postId, commentId } = req.params;

  if (!postId || !userId || !commentId) {
    throw new ApiError(400, "Invaild request");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      status: true,
      user: {
        select: { status: true },
      },
    },
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (!post.user || post.user.status !== "active") {
    throw new ApiError(400, `Your account is ${post.user?.status}`);
  }

  if (post.status !== "active") {
    throw new ApiError(400, `Post is ${post.status}`);
  }

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      postId,
      userId,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!comment) {
    throw new ApiError(404, "Invalid comment id");
  }

  if (comment.image) {
    await deleteFile(comment.image, userId);
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully",
  });
});

export const replyOnComment = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { commentId, content } = req.body;

  if (!userId) {
    throw new ApiError(401, "Unautherized");
  }

  if (!commentId || !content?.trim()) {
    throw new ApiError(400, "commentId and content are required");
  }

  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      postId: true,
      post: {
        select: {
          status: true,
          user: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!parentComment) {
    throw new ApiError(404, "Comment not found");
  }

  if (!parentComment.post.user || parentComment.post.user.status !== "active") {
    throw new ApiError(
      400,
      `Your account is ${parentComment.post.user?.status}`,
    );
  }

  if (parentComment.post.status !== "active") {
    throw new ApiError(400, `Post is ${parentComment.post.status}`);
  }

  const reply = await prisma.comment.create({
    data: {
      userId,
      postId: parentComment.postId,
      parentId: parentComment.id,
      content: content.trim(),
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      parentId: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message: "Reply added successfully",
    reply,
  });
});

export const likeComment = asyncHandler(async (req, res) => {
  console.log("TOGGLE BUTTON TO LIKE OR DISLIKE COMMENT.");
  const { commentId, postId } = req.params;
  const userId = req.session?.userId;

  if (!commentId) {
    console.log("Comment not found.");
    throw new ApiError(404, "Comment not found.");
  }

  if (!postId) {
    console.log("Post not found.");
    throw new ApiError(404, "Post not found.");
  }

  if (!userId) {
    console.log("User not found.");
    throw new ApiError(404, "unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    console.log("user not found.");
    throw new ApiError(400, "User not found");
  }

  if (user.status !== "active") {
    throw new ApiError(400, `Account is ${user.status}`);
  }

  //check if post exist
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post) {
    throw new ApiError(400, "Post not found.");
  }

  //check if comment exist
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });
  if (!comment) {
    throw new ApiError(400, "Comment not found.");
  }

  const existingLike = await prisma.commentLike.findFirst({
    where: {
      userId,
      postId,
      commentId: comment.id,
    },
  });

  if (existingLike) {
    await prisma.commentLike.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Comment Unliked successfully.",
    });
  } else {
    await prisma.commentLike.create({
      data: {
        userId,
        postId,
        commentId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Comment Liked successfully.",
    });
  }
});

export const sharePostInApp = asyncHandler(async (req, res) => {
  console.log("SHARING POST");

  const { postId, receiverId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!postId) {
    throw new ApiError(400, "Post id is required");
  }

  if (!receiverId) {
    throw new ApiError(400, "Receiver id is required");
  }

  const sender = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!sender) {
    throw new ApiError(404, "Sender not found");
  }

  if (sender.status !== "active") {
    throw new ApiError(403, `Account is ${sender.status}`);
  }

  // ---------------- RECEIVER ----------------
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
  });

  if (!receiver) {
    throw new ApiError(404, "Receiver not found");
  }

  if (receiver.status !== "active") {
    throw new ApiError(400, "Receiver account is not active");
  }

  // ---------------- POST ----------------
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, "Post is not available.");
  }

  await prisma.sharePost.create({
    data: {
      senderId: userId,
      receiverId,
      postId,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Post sent successfully.",
  });
});

export const sharePostExternally = asyncHandler(async (req, res) => {
  const { postId, link } = req.params;
  const { source } = req.body;

  if (!source) {
    throw new ApiError(
      404,
      "Please mention source where you are sending your post.",
    );
  }

  const userId = req.session?.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!postId || !link) {
    throw new ApiError(400, "Post id is required");
  }

  const sender = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!sender) {
    throw new ApiError(404, "Sender not found");
  }

  if (sender.status !== "active") {
    throw new ApiError(403, `Account is ${sender.status}`);
  }

  // ---------------- POST ----------------
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  if (post.status !== "active") {
    throw new ApiError(400, "Post is not available.");
  }

  const createdPost = await prisma.sharePost.create({
    data: {
      senderId: userId,
      postId: postId,
      link: link,
      source: source,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Post sent successfully.",
    data: createdPost,
  });
});

export const getFeedPosts = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  // ── Follow graph ──────────────────────────────────────────────────
  const following = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const followingIds = following.map((f) => f.followingId);
  const followingSet = new Set(followingIds);
  const authorIds = [...followingIds, userId];

  // ── Post select ───────────────────────────────────────────────────
  const postSelect = {
    id: true,
    content: true,
    postType: true,
    images: true,
    likeCount: true,
    commentCount: true,
    viewCount: true,
    visibility: true,
    createdAt: true,
    userId: true,
    user: {
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        isVerified: true,
        batch: true,
      },
    },
    video: {
      select: {
        hlsMasterKey: true,
        thumbnail: true,
        durationSec: true,
        status: true,
      },
    },
    reel: {
      select: {
        musicName: true,
        musicUrl: true,
        loopEnabled: true,
      },
    },
    likes: {
      where: { userId, isLiked: true },
      select: { userId: true },
      take: 1,
    },
    bookmarks: {
      where: { userId },
      select: { userId: true },
      take: 1,
    },
    hashtags: {
      select: { hashtag: { select: { tag: true } } },
    },
  } as const;

  const baseWhere = {
    status: "active" as const,
    isReply: false,
  };

  // ── Fetch all three slices in parallel ────────────────────────────
  const sliceLimit = Math.ceil(limit / 3);

  const [followerPosts, newPosts, randomIds, total] = await Promise.all([
    // 1. Posts from followed users
    prisma.post.findMany({
      where: {
        ...baseWhere,
        userId: { in: authorIds },
        visibility: { in: ["public", "followers"] },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: sliceLimit,
      select: { ...postSelect, parentPost: { select: postSelect } },
    }),

    // 2. Latest public posts from anyone
    prisma.post.findMany({
      where: {
        ...baseWhere,
        userId: { notIn: authorIds }, // exclude already fetched above
        visibility: "public",
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: sliceLimit,
      select: { ...postSelect, parentPost: { select: postSelect } },
    }),

    // 3. Random public posts IDs
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Post"
      WHERE status = 'active'
        AND visibility = 'public'
        AND "isReply" = false
        AND "userId" != ${userId}
      ORDER BY RANDOM()
      LIMIT ${sliceLimit}
    `,

    // Total count for pagination (based on full feed pool)
    prisma.post.count({
      where: {
        ...baseWhere,
        visibility: { in: ["public", "followers"] },
      },
    }),
  ]);

  // Fetch full data for random posts
  const randomPosts = await prisma.post.findMany({
    where: { id: { in: randomIds.map((r) => r.id) } },
    select: { ...postSelect, parentPost: { select: postSelect } },
  });

  // ── Merge + deduplicate by id ─────────────────────────────────────
  const seen = new Set<string>();
  const merged = [...followerPosts, ...newPosts, ...randomPosts].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });

  // ── Normalize ─────────────────────────────────────────────────────
  const normalizePost = (
    post: (typeof followerPosts)[number] | (typeof followerPosts)[number]["parentPost"]
  ) => {
    if (!post) return null;
    return {
      ...post,
      viewCount: Number(post.viewCount),
      isLiked: post.likes.length > 0,
      isBookmarked: post.bookmarks.length > 0,
      isOwnPost: post.userId === userId,
      isFollowingAuthor: followingSet.has(post.userId),
      hashtags: post.hashtags.map((h) => h.hashtag.tag),
      parentPost: undefined,
      likes: undefined,
      bookmarks: undefined,
    };
  };

  const feed = merged.map((post) => ({
    ...normalizePost(post),
    parentPost:
      post.postType === "repost" ? normalizePost(post.parentPost) : null,
  }));

  return res.status(200).json({
    success: true,
    data: feed,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + merged.length < total,
    },
  });
});