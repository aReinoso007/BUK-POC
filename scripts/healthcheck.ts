import pg from "pg";
import { Redis } from "ioredis";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name}`);
  }
  return value;
}

async function checkPostgres(databaseUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    await client.end();
  }
}

async function checkRedis(redisUrl: string): Promise<void> {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Redis respondió ${pong}`);
    }
  } finally {
    redis.disconnect();
  }
}

async function main(): Promise<void> {
  await checkPostgres(requireEnv("DATABASE_URL"));
  console.log("Postgres responde");
  await checkRedis(requireEnv("REDIS_URL"));
  console.log("Redis responde");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
