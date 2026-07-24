import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";
import { redisClient } from "../../config/redis.config.js";
import { generateUploadURL } from "../../services/aws.js";
import { getClientIp } from "../auth/auth.service.js";
import { ENV } from "../../config/env.js";

// GET /chat/conversations
export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              first_name: true,
              last_name: true,
              avatarUrl: true,
              presence: true,
              lastSeenAt: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: {
              isRead: false,
              senderId: { not: userId },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const formattedConvs = conversations.map((conv) => {
    return {
      id: conv.id,
      participants: conv.participants.map((p) => p.user),
      lastMessage: conv.messages[0] || null,
      updatedAt: conv.updatedAt,
      unreadCount: conv._count.messages,
    };
  });

  res.status(200).json({ success: true, data: formattedConvs });
});

// GET /chat/:conversationId/messages
export const getMessages = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const conversationId = req.params.conversationId as string;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation || !conversation.participants.some(p => p.userId === userId)) {
    throw new ApiError(403, "Not part of this conversation");
  }

  const participant = conversation.participants.find(p => p.userId === userId);

  const messages = await prisma.message.findMany({
    where: { 
      conversationId,
      ...(participant?.clearedAt ? { createdAt: { gt: participant.clearedAt } } : {})
    },
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json({ success: true, data: messages });
});

// POST /chat/message
export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { receiverId, content, sharedPostId, fileKey, mediaType } = req.body;
  
  if (!userId) throw new ApiError(401, "Unauthorized");
  if (!receiverId) throw new ApiError(400, "Receiver id is required");
  if (!content && !sharedPostId && !fileKey) throw new ApiError(400, "Message content, shared post, or media is required");

  let mediaUrl: string | null = null;
  const ip = getClientIp(req);

  if (fileKey && typeof fileKey === "string") {
    // Validate the fileKey with AwsUploads
    const upload = await prisma.awsUploads.findFirst({
      where: { fileKey, userId },
    });

    if (!upload) {
      throw new ApiError(400, "Invalid file key");
    }

    if (upload.ipAddress !== ip) {
      throw new ApiError(400, "Invalid session for file upload");
    }

    if (upload.status !== "CREATED") {
      throw new ApiError(409, `File is already ${upload.status}`);
    }

    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - upload.createdAt.getTime() > maxAgeMs) {
      throw new ApiError(400, "Upload link expired");
    }

    mediaUrl = `${ENV.AWS_CDN_URL}/${fileKey}`;
  }

  // Find existing conversation between the two users
  let conversation = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: receiverId } } },
      ],
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: receiverId }],
        },
      },
    });
  } else {
    // Update conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  }

  const message = await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: userId,
        content,
        sharedPostId,
        mediaUrl,
        mediaType,
      },
    });

    if (fileKey) {
      await tx.awsUploads.updateMany({
        where: {
          fileKey: fileKey,
          userId,
          ipAddress: ip,
        },
        data: {
          status: "USED",
        },
      });
    }

    return newMessage;
  });

  // Publish to Redis for WebSocket realtime delivery
  await redisClient.publish(
    "realtime_chat",
    JSON.stringify({ userId: receiverId, message })
  );

  res.status(201).json({ success: true, data: message });
});

// POST /chat/upload-url
export const generateChatPresignedUrl = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { mimeType } = req.body;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!mimeType) {
    throw new ApiError(400, "mimeType is required");
  }

  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new ApiError(400, "Unsupported file type");
  }

  const { url, key } = await generateUploadURL(mimeType);
  const ip = getClientIp(req);
  
  await prisma.awsUploads.create({
    data: {
      userId,
      mimeType,
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
});
// GET /chat/unread-count
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const unreadCount = await prisma.message.count({
    where: {
      isRead: false,
      senderId: { not: userId },
      conversation: {
        participants: {
          some: { userId },
        },
      },
    },
  });

  res.status(200).json({ success: true, count: unreadCount });
});

// PUT /chat/:conversationId/read
export const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const conversationId = req.params.conversationId as string;

  if (!userId) throw new ApiError(401, "Unauthorized");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation || !conversation.participants.some((p) => p.userId === userId)) {
    throw new ApiError(403, "Not part of this conversation");
  }

  // Update all unread messages in this conversation where sender is NOT the current user
  const result = await prisma.message.updateMany({
    where: {
      conversationId,
      isRead: false,
      senderId: { not: userId },
    },
    data: {
      isRead: true,
    },
  });

  res.status(200).json({ success: true, count: result.count });
});

// DELETE /chat/:conversationId/clear
export const clearChat = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const conversationId = req.params.conversationId as string;

  if (!userId) throw new ApiError(401, "Unauthorized");

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });

  if (!conversation || !conversation.participants.some((p) => p.userId === userId)) {
    throw new ApiError(403, "Not part of this conversation");
  }

  // Update the participant's clearedAt timestamp
  await prisma.participant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: {
      clearedAt: new Date(),
    },
  });

  res.status(200).json({ success: true, message: "Chat cleared successfully" });
});
