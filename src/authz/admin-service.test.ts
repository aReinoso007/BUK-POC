import { afterAll, describe, expect, it } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { redis } from "../cache/redis.js";
import { tenantVersionKey } from "../cache/tenant.js";
import { prisma } from "../db/prisma.js";
import { LastAdminError, adminService } from "./admin-service.js";
import { Authz, withResource, type ResourceDeclaration } from "./authz.js";
import { resolveCachedPermissions, userPermissionsCacheKey } from "./permissions-cache.js";
import { type EffectivePermissions } from "./resolver.js";

const assetDeclaration: ResourceDeclaration = {
  module: "assets",
  area: "ownerAreaId",
  dimensions: { category: "categoryId" },
};

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

  it("el job resuelve al ejecutarse", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Perfil job", isAdmin: false },
    });
    const user = await prisma.user.create({
      data: { name: "Usuario job", profileId: profile.id },
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
      const alEncolar = await resolveCachedPermissions(user.id);
      expect(alEncolar.grants[0]?.level).toBe("read");
      oldKey = await userPermissionsCacheKey(user.id);

      const userId = user.id;

      await adminService.setModuleGrant({
        profileId: profile.id,
        moduleKey: "assets",
        level: "write",
        areaRestricted: false,
      });

      const alEjecutar = await resolveCachedPermissions(userId);
      newKey = await userPermissionsCacheKey(userId);
      expect(alEjecutar.grants[0]?.level).toBe("write");
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

  it("un cambio de admin, el siguiente Authz.can del mismo usuario ya no usa el permiso viejo", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Perfil can siguiente", isAdmin: false },
    });
    const user = await prisma.user.create({
      data: { name: "Usuario can siguiente", profileId: profile.id },
    });
    await prisma.moduleGrant.create({
      data: {
        profileId: profile.id,
        moduleKey: "assets",
        level: "read",
        areaRestricted: false,
      },
    });
    const userId = user.id;

    try {
      await Authz.withUser(userId, async () => {
        const antes = await Authz.can(
          "write",
          withResource(assetDeclaration, { ownerAreaId: null, categoryId: 1 }),
        );
        expect(antes).toBe(false);
      });

      await adminService.setModuleGrant({
        profileId: profile.id,
        moduleKey: "assets",
        level: "write",
        areaRestricted: false,
      });

      await Authz.withUser(userId, async () => {
        const despues = await Authz.can(
          "write",
          withResource(assetDeclaration, { ownerAreaId: null, categoryId: 1 }),
        );
        expect(despues).toBe(true);
      });
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("rechaza degradar o borrar el último administrador", async () => {
    const admin = await prisma.profile.findFirstOrThrow({ where: { name: "Administrador" } });

    try {
      await expect(adminService.updateProfile(admin.id, { isAdmin: false })).rejects.toBeInstanceOf(LastAdminError);
      await expect(adminService.deleteProfile(admin.id)).rejects.toBeInstanceOf(LastAdminError);
      expect((await prisma.profile.findUniqueOrThrow({ where: { id: admin.id } })).isAdmin).toBe(true);
    } finally {
      await prisma.profile.update({ where: { id: admin.id }, data: { isAdmin: true } });
    }
  });

  it("permite degradar o borrar un administrador si queda otro", async () => {
    const extra = await prisma.profile.create({
      data: { name: "Admin extra", isAdmin: true },
    });
    const seed = await prisma.profile.findFirstOrThrow({ where: { name: "Administrador" } });

    try {
      await adminService.updateProfile(extra.id, { isAdmin: false });
      expect((await prisma.profile.findUniqueOrThrow({ where: { id: extra.id } })).isAdmin).toBe(false);
      expect((await prisma.profile.findUniqueOrThrow({ where: { id: seed.id } })).isAdmin).toBe(true);

      await prisma.profile.update({ where: { id: extra.id }, data: { isAdmin: true } });
      await adminService.deleteProfile(extra.id);
      expect(await prisma.profile.findUnique({ where: { id: extra.id } })).toBeNull();
      expect((await prisma.profile.findUniqueOrThrow({ where: { id: seed.id } })).isAdmin).toBe(true);
    } finally {
      await prisma.profile.deleteMany({ where: { id: extra.id } });
    }
  });
});
