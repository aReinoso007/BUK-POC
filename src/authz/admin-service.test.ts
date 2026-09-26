import { afterAll, describe, expect, it } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { redis } from "../cache/redis.js";
import { tenantVersionKey } from "../cache/tenant.js";
import { prisma } from "../db/prisma.js";
import { adminService } from "./admin-service.js";
import { resolveCachedPermissions, userPermissionsCacheKey } from "./permissions-cache.js";
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

async function version(): Promise<number> {
  return Number((await redis.get(tenantVersionKey())) ?? "0");
}

describe("AdminService", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("un cambio confirmado sube la versión del tenant en 1", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Perfil version", isAdmin: false },
    });

    try {
      const before = await version();
      await adminService.setModuleGrant({
        profileId: profile.id,
        moduleKey: "documents",
        level: "read",
        areaRestricted: false,
      });
      expect(await version()).toBe(before + 1);
    } finally {
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("la resolución siguiente usa la versión nueva y recalcula desde Postgres", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Perfil clave nueva", isAdmin: false },
    });
    const user = await prisma.user.create({
      data: { name: "Usuario clave nueva", profileId: profile.id },
    });
    await prisma.moduleGrant.create({
      data: {
        profileId: profile.id,
        moduleKey: "assets",
        level: "read",
        areaRestricted: false,
      },
    });

    let oldKey = "";
    let newKey = "";
    try {
      await resolveCachedPermissions(user.id);
      oldKey = await userPermissionsCacheKey(user.id);

      await adminService.setModuleGrant({
        profileId: profile.id,
        moduleKey: "assets",
        level: "write",
        areaRestricted: false,
      });

      newKey = await userPermissionsCacheKey(user.id);
      expect(newKey).not.toBe(oldKey);
      expect(await redis.get(newKey)).toBeNull();

      const sentinel: EffectivePermissions = { userId: user.id, isAdmin: true, grants: [] };
      await redis.set(oldKey, JSON.stringify(sentinel));

      const { db, reads } = countingDb();
      const permissions = await resolveCachedPermissions(user.id, db);

      expect(reads()).toBeGreaterThan(0);
      expect(permissions).toEqual({
        userId: user.id,
        isAdmin: false,
        grants: [
          {
            moduleKey: "assets",
            level: "write",
            areaRestricted: false,
            areaIds: [],
            restrictions: [],
          },
        ],
      });
      expect(await redis.get(oldKey)).toBe(JSON.stringify(sentinel));
    } finally {
      if (oldKey) {
        await redis.del(oldKey);
      }
      if (newKey) {
        await redis.del(newKey);
      }
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });
});
