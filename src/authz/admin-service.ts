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

export class LastAdminError extends Error {
  constructor() {
    super("El tenant debe conservar un administrador");
    this.name = "LastAdminError";
  }
}

// La escritura corre dentro de $transaction. El INCR va en la línea siguiente,
// solo si esa promesa resolvió: un rollback no sube la versión.
async function commitThenBump<T>(write: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const result = await prisma.$transaction(write);
  await redis.incr(tenantVersionKey());
  return result;
}

async function lockAdminProfiles(db: Prisma.TransactionClient): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT id FROM profiles WHERE is_admin = true FOR UPDATE
  `);
  return rows.map((row) => row.id);
}

async function assertAdminRemains(db: Prisma.TransactionClient, profileId: number): Promise<void> {
  const adminIds = await lockAdminProfiles(db);
  if (adminIds.length === 1 && adminIds[0] === profileId) {
    throw new LastAdminError();
  }
}

export const adminService = {
  async updateProfile(profileId: number, data: { name?: string; isAdmin?: boolean }): Promise<void> {
    await commitThenBump(async (db) => {
      if (data.isAdmin === false) {
        await assertAdminRemains(db, profileId);
      }
      await db.profile.update({ where: { id: profileId }, data });
    });
  },

  async deleteProfile(profileId: number): Promise<void> {
    await commitThenBump(async (db) => {
      await assertAdminRemains(db, profileId);
      await db.profile.delete({ where: { id: profileId } });
    });
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
