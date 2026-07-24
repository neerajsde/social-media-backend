import express from "express";
import { getConversations, getMessages, sendMessage, getUnreadCount, markAsRead, clearChat } from "./chat.controller.js";
import { createVerifyToken } from "../../middlewares/auth.js";

const router = express.Router();

router.use(createVerifyToken("user"));

router.get("/conversations", getConversations);
router.get("/unread-count", getUnreadCount);
router.get("/:conversationId/messages", getMessages);
router.put("/:conversationId/read", markAsRead);
router.delete('/:conversationId/clear', clearChat);
router.post("/message", sendMessage);

export default router;
