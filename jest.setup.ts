import { afterAll } from "@jest/globals";
import { redis } from "./src/cache/redis.js";

afterAll(async () => {
  await redis.quit();
});
