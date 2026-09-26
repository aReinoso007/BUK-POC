import { afterAll, describe, expect, it } from "@jest/globals";
import { prisma } from "../db/prisma.js";
import { moduleGrant, resolveEffectivePermissions } from "./resolver.js";

async function userId(name: string): Promise<number> {
  const user = await prisma.user.findFirstOrThrow({ where: { name } });
  return user.id;
}

describe("resolveEffectivePermissions", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("arma el grant completo de un usuario seedeado", async () => {
    const comercial = await resolveEffectivePermissions(await userId("Jefe de Gerencia Comercial"));
    expect(comercial.isAdmin).toBe(false);
    expect(comercial.grants).toEqual([
      {
        moduleKey: "assets",
        level: "read",
        areaRestricted: true,
        areaIds: [2, 3, 4, 5],
        restrictions: [],
      },
    ]);

    const ti = await resolveEffectivePermissions(await userId("Jefe de TI"));
    expect(ti.grants).toEqual([
      {
        moduleKey: "assets",
        level: "write",
        areaRestricted: false,
        areaIds: [],
        restrictions: [
          {
            resourceType: "assets",
            dimension: "category",
            valueIds: [1, 2],
          },
        ],
      },
    ]);
  });

  it("el administrador tiene write en todos los módulos, sin restricciones", async () => {
    const admin = await resolveEffectivePermissions(await userId("Gerente General"));

    expect(admin.isAdmin).toBe(true);
    expect(admin.grants).toEqual([
      { moduleKey: "assets", level: "write", areaRestricted: false, areaIds: [], restrictions: [] },
      { moduleKey: "complaints", level: "write", areaRestricted: false, areaIds: [], restrictions: [] },
      { moduleKey: "documents", level: "write", areaRestricted: false, areaIds: [], restrictions: [] },
      { moduleKey: "payroll", level: "write", areaRestricted: false, areaIds: [], restrictions: [] },
      { moduleKey: "vacations", level: "write", areaRestricted: false, areaIds: [], restrictions: [] },
    ]);
  });

  it("un módulo sin grant es fail-closed", async () => {
    const carolina = await resolveEffectivePermissions(await userId("Carolina"));
    const assets = moduleGrant(carolina, "assets");

    expect(assets).toEqual({
      moduleKey: "assets",
      level: "none",
      areaRestricted: true,
      areaIds: [],
      restrictions: [],
    });
  });

  it("un grant restringido sin áreas raíz tiene alcance vacío", async () => {
    const profile = await prisma.profile.create({
      data: { name: "Perfil alcance vacio", isAdmin: false },
    });
    const user = await prisma.user.create({
      data: { name: "Usuario alcance vacio", profileId: profile.id },
    });
    await prisma.moduleGrant.create({
      data: {
        profileId: profile.id,
        moduleKey: "assets",
        level: "read",
        areaRestricted: true,
      },
    });

    try {
      const permissions = await resolveEffectivePermissions(user.id);
      expect(permissions.grants).toEqual([
        {
          moduleKey: "assets",
          level: "read",
          areaRestricted: true,
          areaIds: [],
          restrictions: [],
        },
      ]);
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });
});
