import { existsSync } from "node:fs";
import { config } from "dotenv";
import { Redis } from "ioredis";

if (existsSync(".env")) {
  config({ quiet: true });
}

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("Falta REDIS_URL");
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  connectTimeout: 5_000,
});
