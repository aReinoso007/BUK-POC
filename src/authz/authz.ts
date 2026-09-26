import { AsyncLocalStorage } from "node:async_hooks";
import { AccessLevel, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma.js";
import { resolveCachedPermissions } from "./permissions-cache.js";
import { type EffectiveGrant, type EffectivePermissions, moduleGrant } from "./resolver.js";

const RESOURCE = Symbol("authz.resource");

export type ResourceDeclaration = {
  module: string;
  area: string;
  dimensions: Record<string, string>;
};

export type AuthorizedRecord = Record<string, unknown> & {
  [RESOURCE]: ResourceDeclaration;
};

type Action = "read" | "write";

type RequestContext = {
  userId: number;
  db: PrismaClient;
  permissions?: EffectivePermissions;
};

const requestStore = new AsyncLocalStorage<RequestContext>();

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

export function withResource<T extends Record<string, unknown>>(
  declaration: ResourceDeclaration,
  fields: T,
): T & AuthorizedRecord {
  return { ...fields, [RESOURCE]: declaration };
}

export function areaAllows(grant: EffectiveGrant, areaId: number | null): boolean {
  if (!grant.areaRestricted) {
    return true;
  }
  if (areaId == null) {
    return false;
  }
  return grant.areaIds.includes(areaId);
}

function entityAllows(grant: EffectiveGrant, declaration: ResourceDeclaration, record: AuthorizedRecord): boolean {
  for (const restriction of grant.restrictions) {
    if (restriction.resourceType !== declaration.module) {
      continue;
    }
    const column = declaration.dimensions[restriction.dimension];
    if (!column) {
      continue;
    }
    const value = record[column];
    if (typeof value !== "number" || !restriction.valueIds.includes(value)) {
      return false;
    }
  }
  return true;
}

function allows(permissions: EffectivePermissions, action: Action, record: AuthorizedRecord): boolean {
  if (permissions.isAdmin) {
    return true;
  }
  const declaration = record[RESOURCE];
  const grant = moduleGrant(permissions, declaration.module);
  if (LEVEL_RANK[grant.level] < LEVEL_RANK[action]) {
    return false;
  }
  const areaValue = record[declaration.area];
  const areaId = typeof areaValue === "number" ? areaValue : null;
  if (!areaAllows(grant, areaId)) {
    return false;
  }
  return entityAllows(grant, declaration, record);
}

export type InFilter = { in: number[] };

export type AuthzWhere = {
  AND?: AuthzWhere[];
  [field: string]: InFilter | AuthzWhere[] | undefined;
};

function scopeWhere(permissions: EffectivePermissions, action: Action, declaration: ResourceDeclaration): AuthzWhere {
  if (permissions.isAdmin) {
    return {};
  }
  const grant = moduleGrant(permissions, declaration.module);
  // Igual que can: el nivel se decide antes del filtro de área o categoría.
  // { in: [] } no matchea ninguna fila. No devolver {} , que sería sin restricciones.
  if (LEVEL_RANK[grant.level] < LEVEL_RANK[action]) {
    return { [declaration.area]: { in: [] } };
  }
  const filters: AuthzWhere[] = [];
  if (grant.areaRestricted) {
    filters.push({ [declaration.area]: { in: grant.areaIds } });
  }
  for (const restriction of grant.restrictions) {
    if (restriction.resourceType !== declaration.module) {
      continue;
    }
    const column = declaration.dimensions[restriction.dimension];
    if (!column) {
      continue;
    }
    filters.push({ [column]: { in: restriction.valueIds } });
  }
  if (filters.length === 0) {
    return {};
  }
  if (filters.length === 1) {
    return filters[0] ?? {};
  }
  return { AND: filters };
}

async function permissionsOf(context: RequestContext): Promise<EffectivePermissions> {
  if (!context.permissions) {
    context.permissions = await resolveCachedPermissions(context.userId, context.db);
  }
  return context.permissions;
}

export const Authz = {
  async withUser<T>(userId: number, run: () => Promise<T>, db: PrismaClient = defaultPrisma): Promise<T> {
    return requestStore.run({ userId, db }, run);
  },

  async can(action: Action, record: AuthorizedRecord): Promise<boolean> {
    const context = requestStore.getStore();
    if (!context) {
      throw new Error("Authz.can requiere un request con usuario");
    }
    return allows(await permissionsOf(context), action, record);
  },

  async scope(model: ResourceDeclaration, action: Action): Promise<AuthzWhere> {
    const context = requestStore.getStore();
    if (!context) {
      throw new Error("Authz.scope requiere un request con usuario");
    }
    return scopeWhere(await permissionsOf(context), action, model);
  },
};
