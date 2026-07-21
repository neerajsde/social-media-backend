import express from "express";
import { getConversations, getMessages, sendMessage } from "./chat.controller.js";
import { createVerifyToken } from "../../middlewares/auth.js";

const router = express.Router();

router.use(createVerifyToken("user"));

router.get("/conversations", getConversations);
router.get("/:conversationId/messages", getMessages);
router.post("/message", sendMessage);

export default router;
