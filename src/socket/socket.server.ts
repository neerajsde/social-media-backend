import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";

import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.config.js";
import { redisClient } from "../config/redis.config.js";
import { SOCKET_KEYS } from "../constants/redisKeys.js";

interface JwtPayload {
  id: string;
  email?: string;
  socket_id?: string;
  sessionId: string;
}

interface MessageData {
  conversationId: string;
  content: string;
}

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export const initSocket = (server: HTTPServer) => {
  const allowedOrigins = ENV.ALLOWED_ORIGINS
    ? ENV.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket: AuthenticatedSocket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies.token;
      }

      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as JwtPayload;

      decoded.socket_id = socket.id;
      socket.user = decoded;

      next();
    } catch {
      next(new Error("Invalid Token"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    console.log("User connected:", socket.user?.socket_id);
    await saveConnection(socket);

    /**
     * JOIN CONVERSATION
     */
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(conversationId);

      console.log(
        `User ${socket.user?.id} joined conversation ${conversationId}`,
      );
    });

    /**
     * SEND MESSAGE
     */
    socket.on("send_message", async (data: MessageData) => {
      if (!socket.user) return;

      const message = {
        conversationId: data.conversationId,
        senderId: socket.user.id,
        content: data.content,
        createdAt: new Date(),
      };

      io.to(data.conversationId).emit("receive_message", message);
    });

    /**
     * DISCONNECT
     */
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.id);
      await deleteConnection(socket);
    });
  });
};

async function getSessionOwner(
  sessionId: string,
  purpose: "save" | "delete",
): Promise<string | null> {
  const newPresence = purpose === "save" ? "online" : "offline";

  // Try user session first
  const userSession = await prisma.userSession.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      user: {
        select: { presence: true },
      },
    },
  });

  if (userSession) {
    if (userSession.user.presence !== newPresence) {
      await prisma.user.update({
        where: { id: userSession.userId },
        data: { presence: newPresence },
      });
    }

    return userSession.userId;
  }

  // Try admin session
  const adminSession = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    select: {
      adminId: true,
      admin: {
        select: { presence: true },
      },
    },
  });

  if (adminSession) {
    if (adminSession.admin.presence !== newPresence) {
      await prisma.admin.update({
        where: { id: adminSession.adminId },
        data: { presence: newPresence },
      });
    }

    return adminSession.adminId;
  }

  return null;
}

async function saveConnection(socket: AuthenticatedSocket): Promise<boolean> {
  const { sessionId, socket_id } = socket.user || {};

  if (!sessionId || !socket_id) return false;

  try {
    const ownerId = await getSessionOwner(sessionId, "save");

    if (!ownerId) return false;

    const redisKey = SOCKET_KEYS.saveSocketId(ownerId, sessionId);

    await redisClient.set(redisKey, socket_id);

    return true;
  } catch (error) {
    console.error("Save connection error:", error);
    return false;
  }
}

async function deleteConnection(socket: AuthenticatedSocket): Promise<boolean> {
  const { sessionId } = socket.user || {};

  if (!sessionId) return false;

  try {
    const ownerId = await getSessionOwner(sessionId, "delete");

    if (!ownerId) return false;

    const redisKey = SOCKET_KEYS.saveSocketId(ownerId, sessionId);

    await redisClient.del(redisKey);

    return true;
  } catch (error) {
    console.error("Delete connection error:", error);
    return false;
  }
}
