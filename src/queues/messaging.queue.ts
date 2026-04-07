import { Queue } from "bullmq";
import { ENV } from "../config/env.js";

const connection = {
    host: ENV.REDIS_HOST,
    port: ENV.REDIS_PORT
}

export const emailQueue = new Queue("email-worker", {connection});

export const bulkEmailQueue = new Queue("bulk-email-worker", {connection});

export const NotificationQueue = new Queue("notification-worker", {connection});

export const bulkNotificationQueue = new Queue("bulk-notification-worker", {connection});