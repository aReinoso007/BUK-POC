import { afterAll, describe, expect, it } from "@jest/globals";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { Authz, withResource, type ResourceDeclaration } from "./authz.js";

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

async function userId(name: string): Promise<number> {
  const user = await prisma.user.findFirstOrThrow({ where: { name } });
  return user.id;
}

async function withGrant(
  name: string,
  areaRestricted: boolean,
  run: (userId: number) => Promise<void>,
): Promise<void> {
  const profile = await prisma.profile.create({ data: { name, isAdmin: false } });
  const user = await prisma.user.create({ data: { name, profileId: profile.id } });
  await prisma.moduleGrant.create({
    data: { profileId: profile.id, moduleKey: "assets", level: "write", areaRestricted },
  });
  try {
    await run(user.id);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.profile.delete({ where: { id: profile.id } });
  }
}

describe("Authz.can", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("no infiere sin restricción cuando areaIds está vacío", async () => {
    const record = withResource(assetDeclaration, { ownerAreaId: 3, categoryId: 1 });

    await withGrant("Sin restriccion de area", false, async (id) => {
      await Authz.withUser(id, async () => {
        expect(await Authz.can("write", record)).toBe(true);
      });
    });

    await withGrant("Alcance de area vacio", true, async (id) => {
      await Authz.withUser(id, async () => {
        expect(await Authz.can("write", record)).toBe(false);
      });
    });
  });

  it("el administrador puede escribir cualquier activo", async () => {
    const record = withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 3 });
    await Authz.withUser(await userId("Gerente General"), async () => {
      expect(await Authz.can("write", record)).toBe(true);
    });
  });

  it("read no autoriza write y write cubre read", async () => {
    const document = withResource(documentDeclaration, { areaId: 1 });
    const asset = withResource(assetDeclaration, { ownerAreaId: 1, categoryId: 1 });
    await Authz.withUser(await userId("Pedro"), async () => {
      expect(await Authz.can("read", document)).toBe(true);
      expect(await Authz.can("write", document)).toBe(false);
      expect(await Authz.can("write", asset)).toBe(true);
    });
  });

  it("un activo sin área solo lo escribe quien no tiene restricción de área", async () => {
    const record = withResource(assetDeclaration, { ownerAreaId: null, categoryId: 1 });

    await Authz.withUser(await userId("Pedro"), async () => {
      expect(await Authz.can("write", record)).toBe(true);
    });
    await Authz.withUser(await userId("Jefe de Gerencia Comercial"), async () => {
      expect(await Authz.can("read", record)).toBe(false);
    });
  });

  it("write en assets no autoriza write en documentos", async () => {
    const document = withResource(documentDeclaration, { areaId: 1 });

    await Authz.withUser(await userId("Pedro"), async () => {
      expect(await Authz.can("write", document)).toBe(false);
    });
  });

  it("el área del registro tiene que estar en el alcance expandido", async () => {
    const norte = withResource(assetDeclaration, { ownerAreaId: 3, categoryId: 1 });
    const operaciones = withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 1 });
    await Authz.withUser(await userId("Jefe de Gerencia Comercial"), async () => {
      expect(await Authz.can("read", norte)).toBe(true);
      expect(await Authz.can("read", operaciones)).toBe(false);
    });
  });

  it("la categoría tiene que estar en la allow-list", async () => {
    const computador = withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 1 });
    const vehiculo = withResource(assetDeclaration, { ownerAreaId: 6, categoryId: 3 });
    await Authz.withUser(await userId("Jefe de TI"), async () => {
      expect(await Authz.can("write", computador)).toBe(true);
      expect(await Authz.can("write", vehiculo)).toBe(false);
    });
  });

  it("el segundo can del mismo request no vuelve a leer permisos", async () => {
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
    const record = withResource(assetDeclaration, { ownerAreaId: 1, categoryId: 1 });
    await Authz.withUser(
      await userId("Pedro"),
      async () => {
        expect(await Authz.can("read", record)).toBe(true);
        const afterFirst = reads;
        expect(await Authz.can("read", record)).toBe(true);
        expect(reads).toBe(afterFirst);
      },
      db as unknown as PrismaClient,
    );
  });
});
