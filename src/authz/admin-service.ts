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

export type UpdateGrantFullInput = {
  profileId: number;
  moduleKey: string;
  level?: AccessLevel;
  areaRestricted?: boolean;
  areaIds?: number[];
  restrictions?: EntityRestrictionInput[];
};

export type GrantWriteHooks = {
  afterSecondWrite?: (db: Prisma.TransactionClient) => Promise<void>;
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

async function replaceGrantAreas(db: Prisma.TransactionClient, grantId: number, areaIds: number[]): Promise<void> {
  await db.grantArea.deleteMany({ where: { grantId } });
  if (areaIds.length > 0) {
    await db.grantArea.createMany({
      data: areaIds.map((areaId) => ({ grantId, areaId })),
    });
  }
}

async function replaceEntityRestrictions(
  db: Prisma.TransactionClient,
  grantId: number,
  restrictions: EntityRestrictionInput[],
): Promise<void> {
  await db.entityRestriction.deleteMany({ where: { grantId } });
  if (restrictions.length > 0) {
    await db.entityRestriction.createMany({
      data: restrictions.map((restriction) => ({ grantId, ...restriction })),
    });
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
    await commitThenBump((db) => replaceGrantAreas(db, grantId, areaIds));
  },

  async setEntityRestrictions(grantId: number, restrictions: EntityRestrictionInput[]): Promise<void> {
    await commitThenBump((db) => replaceEntityRestrictions(db, grantId, restrictions));
  },

  async updateGrantFull(input: UpdateGrantFullInput, hooks?: GrantWriteHooks) {
    return commitThenBump(async (db) => {
      const existing = await db.moduleGrant.findUnique({
        where: {
          profileId_moduleKey: { profileId: input.profileId, moduleKey: input.moduleKey },
        },
      });
      const level = input.level ?? existing?.level;
      const areaRestricted = input.areaRestricted ?? existing?.areaRestricted;
      if (level === undefined || areaRestricted === undefined) {
        throw new Error("level y areaRestricted son obligatorios al crear el grant");
      }

      const grant = await db.moduleGrant.upsert({
        where: {
          profileId_moduleKey: { profileId: input.profileId, moduleKey: input.moduleKey },
        },
        create: {
          profileId: input.profileId,
          moduleKey: input.moduleKey,
          level,
          areaRestricted,
        },
        update: { level, areaRestricted },
      });

      if (input.areaIds !== undefined) {
        await replaceGrantAreas(db, grant.id, input.areaIds);
      }
      if (hooks?.afterSecondWrite) {
        await hooks.afterSecondWrite(db);
      }
      if (input.restrictions !== undefined) {
        await replaceEntityRestrictions(db, grant.id, input.restrictions);
      }

      return db.moduleGrant.findUniqueOrThrow({
        where: { id: grant.id },
        include: { areas: true, restrictions: true },
      });
    });
  },

  async reassignProfile(userId: number, profileId: number): Promise<void> {
    await commitThenBump((db) => db.user.update({ where: { id: userId }, data: { profileId } }));
  },
};
