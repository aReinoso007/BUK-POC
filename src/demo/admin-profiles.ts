import { prisma } from "../db/prisma.js";
import { areaName, categoryName } from "./catalog.js";

export type AdminGrantView = {
  id: number;
  moduleKey: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  areaIds: { id: number; name: string }[];
  restrictions: {
    resourceType: string;
    dimension: string;
    valueId: number;
    name: string;
  }[];
};

export type AdminProfileView = {
  id: number;
  name: string;
  isAdmin: boolean;
  users: { id: number; name: string }[];
  grants: AdminGrantView[];
};

type StoredGrant = {
  id: number;
  moduleKey: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  areas: { areaId: number }[];
  restrictions: { resourceType: string; dimension: string; valueId: number }[];
};

export function viewGrant(grant: StoredGrant): AdminGrantView {
  return {
    id: grant.id,
    moduleKey: grant.moduleKey,
    level: grant.level,
    areaRestricted: grant.areaRestricted,
    areaIds: grant.areas
      .map((area) => area.areaId)
      .sort((a, b) => a - b)
      .map((id) => ({ id, name: areaName(id) })),
    restrictions: grant.restrictions
      .slice()
      .sort((a, b) => a.resourceType.localeCompare(b.resourceType) || a.valueId - b.valueId)
      .map((row) => ({
        resourceType: row.resourceType,
        dimension: row.dimension,
        valueId: row.valueId,
        name: categoryName(row.resourceType, row.valueId),
      })),
  };
}

export async function listAdminProfiles(): Promise<AdminProfileView[]> {
  const profiles = await prisma.profile.findMany({
    orderBy: { id: "asc" },
    include: {
      users: { orderBy: { id: "asc" }, select: { id: true, name: true } },
      grants: {
        orderBy: { moduleKey: "asc" },
        include: { areas: true, restrictions: true },
      },
    },
  });

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    isAdmin: profile.isAdmin,
    users: profile.users,
    grants: profile.grants.map((grant) => viewGrant(grant)),
  }));
}
