import { afterAll, describe, expect, it } from "@jest/globals";
import { prisma } from "../db/prisma.js";
import { resolveEffectivePermissions } from "./resolver.js";

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
});
