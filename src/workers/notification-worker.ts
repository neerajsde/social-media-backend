import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.config.js";
import { cropText, formatUTCDate } from "../utils/core.js";
import { sendPostNotify } from "../mails/email-producer.js";
import { NotificationQueue } from "../queues/messaging.queue.js";
import { redisClient } from "../config/redis.config.js";
import { emailQueue } from "../queues/messaging.queue.js";
import type { NotificationType } from "@prisma/client";

interface NotificationJobData {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  messageId?: string;
}

interface BulkNotificationJobData {
  userId: string;
  postId: string;
}

const connection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
});

async function notification(job: Job<NotificationJobData>) {
  const { userId, actorId, type, postId, commentId, messageId } = job.data;

  try {
    // 1. Create Notification in DB
    const newNotification = await prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        postId,
        commentId,
        messageId,
      },
      include: {
        actor: {
          select: { id: true, username: true, first_name: true, last_name: true, avatarUrl: true }
        },
        post: {
          select: { id: true, postType: true }
        }
      }
    });

    // 2. Publish to Redis for real-time Socket.IO emission
    await redisClient.publish("realtime_notification", JSON.stringify(newNotification));

    // 3. Fallback to Email if user is offline
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, presence: true, first_name: true, last_name: true, username: true }
    });

    if (recipient && recipient.presence === "offline") {
      // Create a fallback email subject/body based on type
      let subject = "New Notification";
      let body = `You have a new notification from @${newNotification.actor.username}`;

      if (type === "like") {
         subject = `New Like from @${newNotification.actor.username}`;
         body = `@${newNotification.actor.username} liked your post.`;
      } else if (type === "comment") {
         subject = `New Comment from @${newNotification.actor.username}`;
         body = `@${newNotification.actor.username} commented on your post.`;
      } else if (type === "follow") {
         subject = `New Follower: @${newNotification.actor.username}`;
         body = `@${newNotification.actor.username} started following you.`;
      } else if (type === "message") {
         subject = `New Message from @${newNotification.actor.username}`;
         body = `You received a new message from @${newNotification.actor.username}.`;
      } else if (type === "mention") {
         subject = `You were mentioned by @${newNotification.actor.username}`;
         body = `@${newNotification.actor.username} mentioned you in a post.`;
      }

      await emailQueue.add("Offline-Notification-Mail", {
        email: recipient.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Hi ${recipient.first_name || recipient.username},</h2>
            <p>${body}</p>
            <p>Log in to <a href="${ENV.APP_URL}">${ENV.APP_NAME}</a> to see more details.</p>
          </div>
        `
      });
    }

  } catch (error) {
    console.error("Error processing notification job:", error);
    throw error;
  }
}

async function bulkNotification(job: Job<BulkNotificationJobData>) {
  if (job.name === "Post-Notification") {
    try {
      const { userId, postId } = job.data;

      const [followers, post] = await Promise.all([
        prisma.follow.findMany({
          where: { followingId: userId },
          select: {
            follower: {
              select: {
                id: true,
                username: true,
                first_name: true,
                last_name: true,
                avatarUrl: true,
                email: true,
                fcmToken: true,
                presence: true
              },
            },
          },
        }),

        prisma.post.findUnique({
          where: { id: postId },
          select: {
            id: true,
            content: true,
            postType: true,
            createdAt: true,
            user: {
              select: {
                first_name: true,
                last_name: true,
                avatarUrl: true,
                username: true,
              },
            },
          },
        }),
      ]);

      if (!followers?.length) return;

      if (!post) {
        console.log("Post not found");
        return;
      }

      const authorName = `${post.user.first_name} ${post.user.last_name} @${post.user.username}`;
      const notificationJobs: any[] = [];
      const emailJobs: any[] = [];

      for (const { follower } of followers) {
        // Create standard DB notification for each follower
        notificationJobs.push({
          name: "Standard-Notification",
          data: {
             userId: follower.id,
             actorId: userId,
             type: "new_post",
             postId
          }
        });

        // Only send email if the follower is offline
        if (follower.presence === "offline") {
          emailJobs.push(
            sendPostNotify({
              email: follower.email,
              authorName,
              authorAvatarUrl: post.user.avatarUrl || "",
              followerName: `${follower.first_name} ${follower.last_name} @${follower.username}`,
              postUrl: `${ENV.APP_URL}/screens/Post/page?post_id=${post.id}`,
              postDate: formatUTCDate(post.createdAt),
            })
          );
        }
      }

      await Promise.allSettled(emailJobs);

      if (notificationJobs.length) {
         // Re-queue them as standard notifications to be saved and socket-emitted individually
         await NotificationQueue.addBulk(notificationJobs);
      }

      console.log(`Bulk Notifications queued: ${followers.length}`);
    } catch (err) {
      console.error("Bulk notification error:", err);
    }
  }
}

export const notificationWorker = new Worker<NotificationJobData>(
  "notification-worker",
  notification,
  { connection: connection as any }
);

export const bulkNotificationWorker = new Worker<BulkNotificationJobData>(
  "bulk-notification-worker",
  bulkNotification,
  { connection: connection as any }
);