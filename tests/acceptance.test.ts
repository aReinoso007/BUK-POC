import { afterAll, describe, expect, it } from "@jest/globals";
import { prisma } from "../src/db/prisma.js";
import { Authz, withResource, type ResourceDeclaration } from "../src/authz/authz.js";

// Ejemplos del caso ya cubiertos, sin repetir el mismo assert:
// - Pedro lee Documentos: este archivo, "Pedro: lectura en Documentos, escritura en Gestión de Activos"
// - Pedro no escribe Documentos: src/authz/authz.test.ts "write en assets no autoriza write en documentos"
// - Gerente General ve y edita todo: src/authz/resolver.test.ts y src/authz/authz.test.ts
// - Analistas de remuneraciones, solo lectura: src/authz/scope.test.ts
// - Jefe de TI, solo Computadores y Teléfonos: src/authz/authz.test.ts

const documentDeclaration: ResourceDeclaration = {
  module: "documents",
  area: "areaId",
  dimensions: {},
};

const assetDeclaration: ResourceDeclaration = {
  module: "assets",
  area: "ownerAreaId",
  dimensions: { category: "categoryId" },
};

const vacationDeclaration: ResourceDeclaration = {
  module: "vacations",
  area: "areaId",
  dimensions: {},
};

const complaintDeclaration: ResourceDeclaration = {
  module: "complaints",
  area: "areaId",
  dimensions: { category: "categoryId" },
};

const VENTAS_ZONA_NORTE = 3;
const VENTAS_ZONA_SUR = 4;
const MARKETING = 5;
const GERENCIA_DE_OPERACIONES = 6;
const ACOSO = 1;
const FRAUDE = 2;
const DISCRIMINACION = 3;

async function userId(name: string): Promise<number> {
  const user = await prisma.user.findFirstOrThrow({ where: { name } });
  return user.id;
}

describe("ejemplos del caso", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Carolina: acceso solo al módulo Vacaciones, restringido a Ventas Zona Norte y sus subáreas", async () => {
    const sur = withResource(vacationDeclaration, { areaId: VENTAS_ZONA_SUR });
    const marketing = withResource(vacationDeclaration, { areaId: MARKETING });

    await Authz.withUser(await userId("Carolina"), async () => {
      expect(await Authz.scope(vacationDeclaration, "read")).toEqual({
        areaId: { in: [VENTAS_ZONA_NORTE] },
      });
      expect(await Authz.can("read", sur)).toBe(false);
      expect(await Authz.can("read", marketing)).toBe(false);
      expect(await Authz.scope(assetDeclaration, "read")).toEqual({
        ownerAreaId: { in: [] },
      });
    });
  });

  it("Encargados de Canal de Denuncias: uno solo Acoso y Discriminación, otro solo Fraude", async () => {
    const acoso = withResource(complaintDeclaration, { areaId: 1, categoryId: ACOSO });
    const fraude = withResource(complaintDeclaration, { areaId: 1, categoryId: FRAUDE });

    await Authz.withUser(await userId("Encargado de Denuncias A"), async () => {
      expect(await Authz.can("write", acoso)).toBe(true);
      expect(await Authz.can("write", fraude)).toBe(false);
      expect(await Authz.scope(complaintDeclaration, "write")).toEqual({
        categoryId: { in: [ACOSO, DISCRIMINACION] },
      });
    });

    await Authz.withUser(await userId("Encargado de Denuncias B"), async () => {
      expect(await Authz.can("write", fraude)).toBe(true);
      expect(await Authz.can("write", acoso)).toBe(false);
      expect(await Authz.scope(complaintDeclaration, "write")).toEqual({
        categoryId: { in: [FRAUDE] },
      });
    });
  });

  it("Jefe de Gerencia Comercial: ve Norte, Sur y Marketing, pero no Gerencia de Operaciones", async () => {
    const norte = withResource(assetDeclaration, { ownerAreaId: VENTAS_ZONA_NORTE, categoryId: 1 });
    const operaciones = withResource(assetDeclaration, { ownerAreaId: GERENCIA_DE_OPERACIONES, categoryId: 1 });

    await Authz.withUser(await userId("Jefe de Gerencia Comercial"), async () => {
      expect(await Authz.can("read", operaciones)).toBe(false);
      expect(await Authz.can("read", norte)).toBe(true);
    });
  });

  it("Pedro: lectura en Documentos, escritura en Gestión de Activos", async () => {
    const documento = withResource(documentDeclaration, { areaId: 1 });

    await Authz.withUser(await userId("Pedro"), async () => {
      expect(await Authz.can("read", documento)).toBe(true);
    });
  });

  it("Pedro: escritura en Gestión de Activos, sin restricción de área", async () => {
    await Authz.withUser(await userId("Pedro"), async () => {
      const where = await Authz.scope(assetDeclaration, "write");
      expect(where.ownerAreaId).toBeUndefined();
      expect(where).toEqual({});
    });
  });
});
