import { afterAll, describe, expect, it } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { redis } from "../cache/redis.js";
import { tenantId } from "../cache/tenant.js";
import { prisma } from "../db/prisma.js";
import {
  PERMISSIONS_CACHE_TTL_SECONDS,
  resolveCachedPermissions,
  userPermissionsCacheKey,
} from "./permissions-cache.js";
import { type EffectivePermissions } from "./resolver.js";

function countingDb(): { db: PrismaClient; reads: () => number } {
  let reads = 0;
  const db = prisma.$extends({
    query: {
      user: {
        async findUnique({ args, query }) {
          reads += 1;
          return query(args);
        },
      },
    },
  });
  return { db: db as unknown as PrismaClient, reads: () => reads };
}

describe("caché de permisos", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("en miss lee Postgres y escribe la clave", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { name: "Pedro" } });
    const key = await userPermissionsCacheKey(user.id);
    await redis.del(key);

    const { db, reads } = countingDb();
    const permissions = await resolveCachedPermissions(user.id, db);

    expect(reads()).toBeGreaterThan(0);
    expect(key.startsWith(`authz:${tenantId()}:v`)).toBe(true);
    expect(key.endsWith(`:user:${user.id}`)).toBe(true);
    expect(JSON.parse((await redis.get(key)) ?? "")).toEqual(permissions);
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(PERMISSIONS_CACHE_TTL_SECONDS);
  });

  it("en hit no vuelve a leer Postgres", async () => {
    const userId = 999_999;
    const key = await userPermissionsCacheKey(userId);
    const stored: EffectivePermissions = {
      userId,
      isAdmin: false,
      grants: [],
    };
    await redis.set(key, JSON.stringify(stored));

    try {
      const { db, reads } = countingDb();
      const permissions = await resolveCachedPermissions(userId, db);

      expect(reads()).toBe(0);
      expect(permissions).toEqual(stored);
    } finally {
      await redis.del(key);
    }
  });
});
