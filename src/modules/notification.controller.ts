import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.config.js";
import { z } from "zod";

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { page = "1", limit = "20" } = req.query;
    const pageNumber = parseInt(page as string, 10) || 1;
    const limitNumber = parseInt(limit as string, 10) || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limitNumber,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            postType: true,
            content: true,
            images: true,
          },
        },
      },
    });

    const total = await prisma.notification.count({ where: { userId } });
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.status(200).json({
      success: true,
      data: notifications,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.status(200).json({ success: true, count: unreadCount });
  } catch (error) {
    next(error);
  }
};
