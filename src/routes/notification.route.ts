import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "../modules/notification.controller.js";
import { createVerifyToken } from "../middlewares/auth.js";

const router = express.Router();

router.use(createVerifyToken("user"));

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

export default router;
