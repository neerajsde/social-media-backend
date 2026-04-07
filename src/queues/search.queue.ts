import { Queue } from "bullmq";
import { ENV } from "../config/env.js";

const connection = {
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
};

export const searchQueue = new Queue("search-worker", { connection });
