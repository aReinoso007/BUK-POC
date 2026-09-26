import { AccessLevel, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma.js";

export type EffectiveRestriction = {
  resourceType: string;
  dimension: string;
  valueIds: number[];
};

export type EffectiveGrant = {
  moduleKey: string;
  level: AccessLevel;
  areaRestricted: boolean;
  areaIds: number[];
  restrictions: EffectiveRestriction[];
};

export type EffectivePermissions = {
  userId: number;
  isAdmin: boolean;
  grants: EffectiveGrant[];
};

type AreaRow = { grant_id: number; descendant_id: number };

export async function resolveEffectivePermissions(
  userId: number,
  db: PrismaClient = defaultPrisma,
): Promise<EffectivePermissions> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) {
    throw new Error(`Usuario ${userId} no existe`);
  }

  const grants = await db.moduleGrant.findMany({
    where: { profileId: user.profileId },
    orderBy: { moduleKey: "asc" },
  });
  const grantIds = grants.map((grant) => grant.id);

  const [areaRows, restrictionRows] =
    grantIds.length === 0
      ? [[], []]
      : await Promise.all([
          db.$queryRaw<AreaRow[]>(Prisma.sql`
            SELECT ga.grant_id, ac.descendant_id
            FROM grant_areas ga
            INNER JOIN area_closure ac ON ac.ancestor_id = ga.area_id
            WHERE ga.grant_id IN (${Prisma.join(grantIds)})
          `),
          db.entityRestriction.findMany({
            where: { grantId: { in: grantIds } },
            orderBy: [{ resourceType: "asc" }, { dimension: "asc" }, { valueId: "asc" }],
          }),
        ]);

  const areasByGrant = new Map<number, number[]>();
  for (const row of areaRows) {
    const current = areasByGrant.get(row.grant_id) ?? [];
    current.push(row.descendant_id);
    areasByGrant.set(row.grant_id, current);
  }

  const restrictionsByGrant = new Map<number, Map<string, EffectiveRestriction>>();
  for (const row of restrictionRows) {
    const byKey = restrictionsByGrant.get(row.grantId) ?? new Map<string, EffectiveRestriction>();
    const key = `${row.resourceType}\0${row.dimension}`;
    const current = byKey.get(key) ?? {
      resourceType: row.resourceType,
      dimension: row.dimension,
      valueIds: [],
    };
    current.valueIds.push(row.valueId);
    byKey.set(key, current);
    restrictionsByGrant.set(row.grantId, byKey);
  }

  return {
    userId,
    isAdmin: user.profile.isAdmin,
    grants: grants.map((grant) => ({
      moduleKey: grant.moduleKey,
      level: grant.level,
      areaRestricted: grant.areaRestricted,
      areaIds: [...new Set(areasByGrant.get(grant.id) ?? [])].sort((a, b) => a - b),
      restrictions: [...(restrictionsByGrant.get(grant.id)?.values() ?? [])],
    })),
  };
}
