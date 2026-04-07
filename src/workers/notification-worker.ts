import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { ENV } from "../config/env.js";
import { prisma } from "../config/prisma.config.js";
import { cropText, formatUTCDate } from "../utils/core.js";
import { sendPostNotify } from "../mails/email-producer.js";
import { NotificationQueue } from "../queues/messaging.queue.js";

interface NotificationJobData {
  fcmToken: string;
  title: string;
  body: string;
  avatarImg?: string;
  postId: string;
  postType: string;
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
  console.log("Notification:", job.data);
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

      const emailJobs = followers.map(({ follower }) =>
        sendPostNotify({
          email: follower.email,
          authorName,
          authorAvatarUrl: post.user.avatarUrl || "",
          followerName: `${follower.first_name} ${follower.last_name} @${follower.username}`,
          postUrl: `${ENV.APP_URL}/screens/Post/page?post_id=${post.id}`,
          postDate: formatUTCDate(post.createdAt),
        })
      );

      await Promise.allSettled(emailJobs);

      function bodyText() {
        const fallback = "New post shared. Tap to view 👀";
        const text = post?.content ? cropText(post.content, 100) : "";
        return text || fallback;
      }

      const notificationJobs = followers
        .filter((f) => f.follower.fcmToken)
        .map(({ follower }) => ({
          name: "Post-Notification",
          data: {
            fcmToken: follower.fcmToken!,
            title: `📢 @${post.user.username} shared a new ${
              post.postType === "reel" ? "reel" : "post"
            }. Tap to view!`,
            body: bodyText(),
            avatarImg: post.user.avatarUrl || undefined,
            postId,
            postType: post.postType,
          },
        }));

      if (notificationJobs.length) {
        await NotificationQueue.addBulk(notificationJobs);
      }

      console.log(`Notifications sent: ${followers.length}`);
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