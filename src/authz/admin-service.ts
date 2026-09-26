import { AccessLevel, Prisma } from "@prisma/client";
import { redis } from "../cache/redis.js";
import { tenantVersionKey } from "../cache/tenant.js";
import { prisma } from "../db/prisma.js";

export type ModuleGrantInput = {
  profileId: number;
  moduleKey: string;
  level: AccessLevel;
  areaRestricted: boolean;
};

export type EntityRestrictionInput = {
  resourceType: string;
  dimension: string;
  valueId: number;
};

async function commitThenBump<T>(write: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const result = await prisma.$transaction(write);
  await redis.incr(tenantVersionKey());
  return result;
}

export const adminService = {
  async updateProfile(profileId: number, data: { name?: string; isAdmin?: boolean }): Promise<void> {
    await commitThenBump((db) => db.profile.update({ where: { id: profileId }, data }));
  },

  async setModuleGrant(input: ModuleGrantInput): Promise<void> {
    const { profileId, moduleKey, level, areaRestricted } = input;
    await commitThenBump((db) =>
      db.moduleGrant.upsert({
        where: { profileId_moduleKey: { profileId, moduleKey } },
        create: { profileId, moduleKey, level, areaRestricted },
        update: { level, areaRestricted },
      }),
    );
  },

  async setGrantAreas(grantId: number, areaIds: number[]): Promise<void> {
    await commitThenBump(async (db) => {
      await db.grantArea.deleteMany({ where: { grantId } });
      if (areaIds.length > 0) {
        await db.grantArea.createMany({
          data: areaIds.map((areaId) => ({ grantId, areaId })),
        });
      }
    });
  },

  async setEntityRestrictions(grantId: number, restrictions: EntityRestrictionInput[]): Promise<void> {
    await commitThenBump(async (db) => {
      await db.entityRestriction.deleteMany({ where: { grantId } });
      if (restrictions.length > 0) {
        await db.entityRestriction.createMany({
          data: restrictions.map((restriction) => ({ grantId, ...restriction })),
        });
      }
    });
  },

  async reassignProfile(userId: number, profileId: number): Promise<void> {
    await commitThenBump((db) => db.user.update({ where: { id: userId }, data: { profileId } }));
  },
};
