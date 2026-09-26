import { PrismaClient } from "@prisma/client";
import { redis } from "../cache/redis.js";
import { tenantVersionKey, userPermissionsKey } from "../cache/tenant.js";
import { prisma as defaultPrisma } from "../db/prisma.js";
import { resolveEffectivePermissions, type EffectivePermissions } from "./resolver.js";

export const PERMISSIONS_CACHE_TTL_SECONDS = 300;

export async function userPermissionsCacheKey(userId: number): Promise<string> {
  const version = (await redis.get(tenantVersionKey())) ?? "0";
  return userPermissionsKey(version, userId);
}

export async function resolveCachedPermissions(
  userId: number,
  db: PrismaClient = defaultPrisma,
): Promise<EffectivePermissions> {
  const key = await userPermissionsCacheKey(userId);
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as EffectivePermissions;
  }

  const permissions = await resolveEffectivePermissions(userId, db);
  await redis.set(key, JSON.stringify(permissions), "EX", PERMISSIONS_CACHE_TTL_SECONDS);
  return permissions;
}
