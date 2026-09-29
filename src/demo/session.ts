import { Prisma } from "@prisma/client";
import { Authz, withResource } from "../authz/authz.js";
import { resolveCachedPermissions } from "../authz/permissions-cache.js";
import { moduleGrant } from "../authz/resolver.js";
import { prisma } from "../db/prisma.js";
import { assetDeclaration } from "../modules/assets/asset.js";
import {
  type OrgNode,
  ORG,
  areaName,
  categoryName,
  joinNames,
  levelLabel,
  MODULES,
  moduleLabel,
} from "./catalog.js";
import { explainAsset } from "./explain.js";

type StoredGrant = {
  moduleKey: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  areas: { areaId: number }[];
  restrictions: { resourceType: string; dimension: string; valueId: number }[];
};

type StoredProfile = {
  name: string;
  isAdmin: boolean;
  grants: StoredGrant[];
};

export type AccountView = {
  id: number;
  name: string;
  profileName: string;
  isAdmin: boolean;
  lesson: string;
  summary: string;
};

export type ModuleView = {
  moduleKey: string;
  moduleLabel: string;
  level: "none" | "read" | "write";
  areaRestricted: boolean;
  roots: { id: number; name: string }[];
  effectiveAreas: { id: number; name: string }[];
  categories: { id: number; name: string }[];
};

export type AssetView = {
  id: number;
  name: string;
  area: { id: number; name: string } | null;
  category: { id: number; name: string };
  listed: boolean;
  canRead: boolean;
  canWrite: boolean;
  readReason: string;
  writeReason: string;
};

export type SessionView = {
  user: {
    id: number;
    name: string;
    profileName: string;
    isAdmin: boolean;
  };
  lesson: string;
  modules: ModuleView[];
  org: OrgNode[];
  assets: AssetView[];
};

function categoryLabels(grant: StoredGrant): string[] {
  return grant.restrictions
    .filter((row) => row.resourceType === grant.moduleKey && row.dimension === "category")
    .map((row) => row.valueId)
    .sort((a, b) => a - b)
    .map((valueId) => categoryName(grant.moduleKey, valueId));
}

function describeGrant(grant: StoredGrant): string {
  const area = grant.areaRestricted
    ? `limitada a ${joinNames(grant.areas.map((area) => areaName(area.areaId)))} y subáreas`
    : "en toda la empresa";
  const categories = categoryLabels(grant);
  const category = categories.length > 0 ? `, categorías ${joinNames(categories)}` : "";
  return `${moduleLabel(grant.moduleKey)}: ${levelLabel(grant.level)} ${area}${category}.`;
}

export function lessonFor(profile: StoredProfile): string {
  if (profile.isAdmin) {
    return "Un administrador escribe en todos los módulos. El motor no aplica área ni categoría.";
  }
  const assets = profile.grants.find((grant) => grant.moduleKey === "assets");
  if (!assets) {
    const others = profile.grants.map((grant) => moduleLabel(grant.moduleKey));
    if (others.length > 0) {
      return `Su grant está en ${joinNames(others)}. Activos no está incluido, así que el listado sale vacío.`;
    }
    return "Sin grants: el motor niega todo.";
  }
  const hasCategory = assets.restrictions.some((row) => row.resourceType === "assets" && row.dimension === "category");
  if (hasCategory) {
    return "Puede escribir Activos, pero solo en las categorías incluidas. El resto se niega.";
  }
  if (assets.areaRestricted) {
    return "La raíz del grant incluye a sus subáreas. Un activo fuera de ese árbol no aparece.";
  }
  if (profile.grants.length > 1) {
    return "El nivel es por módulo. Escritura en Activos no abre los demás.";
  }
  return "El acceso efectivo es módulo, área y categoría a la vez.";
}

export function summarizeProfile(profile: StoredProfile): string {
  if (profile.isAdmin) {
    return "Administrador. Escritura en todos los módulos, sin filtro de área ni de categoría.";
  }
  if (profile.grants.length === 0) {
    return "Sin grants. Todo acceso queda denegado.";
  }
  return profile.grants.map((grant) => describeGrant(grant)).join(" ");
}

export async function listAccounts(): Promise<AccountView[]> {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    include: {
      profile: {
        include: {
          grants: {
            orderBy: { moduleKey: "asc" },
            include: { areas: true, restrictions: true },
          },
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    profileName: user.profile.name,
    isAdmin: user.profile.isAdmin,
    lesson: lessonFor(user.profile),
    summary: summarizeProfile(user.profile),
  }));
}

export async function buildSession(userId: number): Promise<SessionView> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      profile: {
        include: {
          grants: {
            include: { areas: true, restrictions: true },
          },
        },
      },
    },
  });
  const permissions = await resolveCachedPermissions(userId);
  const where = await Authz.scope(assetDeclaration, "read");
  const [assets, visible] = await Promise.all([
    prisma.asset.findMany({ orderBy: { id: "asc" } }),
    prisma.asset.findMany({
      where: where as Prisma.AssetWhereInput,
      orderBy: { id: "asc" },
    }),
  ]);
  const visibleIds = new Set(visible.map((asset) => asset.id));

  const modules: ModuleView[] = MODULES.map((module) => {
    const effective = moduleGrant(permissions, module.key);
    const stored = user.profile.grants.find((grant) => grant.moduleKey === module.key);
    const categories = effective.restrictions
      .filter((row) => row.resourceType === module.key && row.dimension === "category")
      .flatMap((row) => row.valueIds)
      .sort((a, b) => a - b)
      .map((id) => ({ id, name: categoryName(module.key, id) }));
    const roots = (stored?.areas ?? [])
      .map((area) => area.areaId)
      .sort((a, b) => a - b)
      .map((id) => ({ id, name: areaName(id) }));
    return {
      moduleKey: module.key,
      moduleLabel: module.label,
      level: effective.level,
      areaRestricted: effective.areaRestricted,
      roots,
      effectiveAreas: effective.areaIds.map((id) => ({ id, name: areaName(id) })),
      categories,
    };
  });

  const assetViews: AssetView[] = [];
  for (const asset of assets) {
    const record = withResource(assetDeclaration, {
      ownerAreaId: asset.ownerAreaId,
      categoryId: asset.categoryId,
    });
    const fact = { ownerAreaId: asset.ownerAreaId, categoryId: asset.categoryId };
    assetViews.push({
      id: asset.id,
      name: asset.name,
      area: asset.ownerAreaId == null ? null : { id: asset.ownerAreaId, name: areaName(asset.ownerAreaId) },
      category: { id: asset.categoryId, name: categoryName("assets", asset.categoryId) },
      listed: visibleIds.has(asset.id),
      canRead: await Authz.can("read", record),
      canWrite: await Authz.can("write", record),
      readReason: explainAsset(permissions, "read", fact),
      writeReason: explainAsset(permissions, "write", fact),
    });
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      profileName: user.profile.name,
      isAdmin: user.profile.isAdmin,
    },
    lesson: lessonFor(user.profile),
    modules,
    org: ORG,
    assets: assetViews,
  };
}
