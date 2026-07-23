import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { prisma } from "../../config/prisma.config.js";

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

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  res.status(200).json({ success: true, data: messages });
});

// POST /chat/message
export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  const { receiverId, content, sharedPostId } = req.body;
  
  if (!userId) throw new ApiError(401, "Unauthorized");
  if (!receiverId) throw new ApiError(400, "Receiver id is required");
  if (!content && !sharedPostId) throw new ApiError(400, "Message content or shared post is required");

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

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: userId,
      content,
      sharedPostId,
    },
  });

  res.status(201).json({ success: true, data: message });
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
