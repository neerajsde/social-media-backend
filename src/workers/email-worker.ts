import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import sendEmail from "../utils/mailSender.js";
import { ENV } from "../config/env.js";

interface EmailJobData {
  email: string;
  subject: string;
  html: string;
}

const connection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  maxRetriesPerRequest: null,
});

async function emailWorker(job: Job<EmailJobData>) {
  const { email, subject, html } = job.data;

  await sendEmail(email, subject, html);

  if (ENV.NODE_ENV === "development") {
    console.log(`Mail Sent to ${email}`);
  }
}

export default new Worker<EmailJobData>(
  "email-worker",
  emailWorker,
  { connection: connection as any }
);