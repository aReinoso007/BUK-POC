import { afterAll, describe, expect, it } from "@jest/globals";
import { prisma } from "../db/prisma.js";
import { Authz, withResource, type AuthzWhere, type ResourceDeclaration } from "./authz.js";

const assetDeclaration: ResourceDeclaration = {
  module: "assets",
  area: "ownerAreaId",
  dimensions: { category: "categoryId" },
};

const documentDeclaration: ResourceDeclaration = {
  module: "documents",
  area: "areaId",
  dimensions: {},
};

function matches(where: AuthzWhere, record: Record<string, unknown>): boolean {
  if (where.AND) {
    return where.AND.every((part) => matches(part, record));
  }
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || !("in" in condition)) {
      return false;
    }
    const value = record[field];
    return typeof value === "number" && condition.in.includes(value);
  });
}

async function userId(name: string): Promise<number> {
  const user = await prisma.user.findFirstOrThrow({ where: { name } });
  return user.id;
}

describe("Authz.scope", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("incluye un registro si y solo si can lo permite", async () => {
    const records = [
      { model: assetDeclaration, record: withResource(assetDeclaration, { ownerAreaId: null, categoryId: 1 }) },
      { model: assetDeclaration, record: withResource(assetDeclaration, { ownerAreaId: 3, categoryId: 1 }) },
      { model: assetDeclaration, record: withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 1 }) },
      { model: assetDeclaration, record: withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 3 }) },
      { model: documentDeclaration, record: withResource(documentDeclaration, { areaId: 1 }) },
    ];
    const users = ["Pedro", "Jefe de Gerencia Comercial", "Jefe de TI", "Gerente General", "Carolina"];
    const actions = ["read", "write"] as const;

    for (const name of users) {
      const id = await userId(name);
      for (const action of actions) {
        for (const { model, record } of records) {
          await Authz.withUser(id, async () => {
            const allowed = await Authz.can(action, record);
            const where = await Authz.scope(model, action);
            expect(matches(where, record)).toBe(allowed);
          });
        }
      }
    }
  });

  it("restringido con areaIds vacío no abre toda la empresa", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Scope alcance vacio", isAdmin: false },
    });
    const user = await prisma.user.create({
      data: { name: "Scope alcance vacio", profileId: profile.id },
    });
    await prisma.moduleGrant.create({
      data: {
        profileId: profile.id,
        moduleKey: "assets",
        level: "write",
        areaRestricted: true,
      },
    });
    const record = withResource(assetDeclaration, { ownerAreaId: null, categoryId: 1 });

    try {
      await Authz.withUser(user.id, async () => {
        expect(await Authz.can("write", record)).toBe(false);
        expect(await Authz.scope(assetDeclaration, "write")).toEqual({
          ownerAreaId: { in: [] },
        });
      });
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });
});
