import { afterAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { prisma } from "../db/prisma.js";
import { app } from "./app.js";
import type { AccountView, SessionView } from "./session.js";

type AssetBody = {
  id: number;
  name: string;
  ownerAreaId: number;
  categoryId: number;
};

async function userId(name: string): Promise<number> {
  const user = await prisma.user.findFirstOrThrow({ where: { name } });
  return user.id;
}

async function assetId(name: string): Promise<number> {
  const asset = await prisma.asset.findFirstOrThrow({ where: { name } });
  return asset.id;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("demo de activos", () => {
  it("Pedro escribe un activo de cualquier área", async () => {
    const response = await request(app)
      .patch(`/assets/${await assetId("Camioneta Operaciones")}`)
      .set("X-User-Id", String(await userId("Pedro")))
      .send({ name: "Camioneta Operaciones" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ownerAreaId: 6, categoryId: 3 });
  });

  it("Carolina no accede a activos", async () => {
    const carolina = String(await userId("Carolina"));
    const patch = await request(app)
      .patch(`/assets/${await assetId("Notebook Zona Norte")}`)
      .set("X-User-Id", carolina)
      .send({ name: "No deberia" });

    expect(patch.status).toBe(403);
    expect(patch.body).toEqual({ error: "denegado" });

    const list = await request(app).get("/assets").set("X-User-Id", carolina);
    expect(list.status).toBe(200);
    expect(list.body).toEqual([]);
  });

  it("el jefe comercial ve su gerencia y no Operaciones", async () => {
    const response = await request(app)
      .get("/assets")
      .set("X-User-Id", String(await userId("Jefe de Gerencia Comercial")));

    expect(response.status).toBe(200);
    const assets = response.body as AssetBody[];
    expect(assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerAreaId: 3, categoryId: 1 }),
        expect.objectContaining({ ownerAreaId: 5, categoryId: 2 }),
      ]),
    );
    expect(assets.map((asset) => asset.ownerAreaId)).not.toContain(6);
  });

  it("el jefe de TI escribe Computadores y no Vehículos", async () => {
    const ti = String(await userId("Jefe de TI"));
    const notebook = await request(app)
      .patch(`/assets/${await assetId("Notebook Zona Norte")}`)
      .set("X-User-Id", ti)
      .send({ name: "Notebook Zona Norte" });

    expect(notebook.status).toBe(200);
    expect(notebook.body).toMatchObject({ categoryId: 1 });

    const camioneta = await request(app)
      .patch(`/assets/${await assetId("Camioneta Operaciones")}`)
      .set("X-User-Id", ti)
      .send({ name: "No deberia" });

    expect(camioneta.status).toBe(403);
    expect(camioneta.body).toEqual({ error: "denegado" });
  });
});

describe("demo de cuentas", () => {
  it("lista las cuentas del seed sin X-User-Id", async () => {
    const response = await request(app).get("/demo/accounts");
    expect(response.status).toBe(200);
    const accounts = response.body as AccountView[];
    const carolina = accounts.find((account) => account.name === "Carolina");
    const comercial = accounts.find((account) => account.name === "Jefe de Gerencia Comercial");
    const ti = accounts.find((account) => account.name === "Jefe de TI");
    expect(carolina?.summary).toContain("Vacaciones");
    expect(carolina?.summary).toContain("Ventas Zona Norte");
    expect(comercial?.summary).toContain("Gerencia Comercial");
    expect(ti?.summary).toContain("Computadores");
    expect(accounts.find((account) => account.name === "Gerente General")?.isAdmin).toBe(true);
  });

  it("la sesión exige usuario", async () => {
    const response = await request(app).get("/demo/session");
    expect(response.status).toBe(401);
  });

  it("el jefe comercial lee el subárbol y no escribe", async () => {
    const response = await request(app)
      .get("/demo/session")
      .set("X-User-Id", String(await userId("Jefe de Gerencia Comercial")));

    expect(response.status).toBe(200);
    const session = response.body as SessionView;
    const assets = session.modules.find((module) => module.moduleKey === "assets");
    expect(assets).toMatchObject({ level: "read", areaRestricted: true });
    expect(assets?.roots.map((area) => area.id)).toEqual([2]);
    expect(assets?.effectiveAreas.map((area) => area.id)).toEqual([2, 3, 4, 5]);

    const notebook = session.assets.find((asset) => asset.category.id === 1);
    const camioneta = session.assets.find((asset) => asset.category.id === 3);
    expect(notebook).toMatchObject({ listed: true, canRead: true, canWrite: false });
    expect(camioneta).toMatchObject({ listed: false, canRead: false, canWrite: false });
    expect(camioneta?.readReason).toContain("Gerencia de Operaciones");
  });

  it("Carolina no ve activos y el jefe de TI no escribe vehículos", async () => {
    const carolina = await request(app).get("/demo/session").set("X-User-Id", String(await userId("Carolina")));
    const carolinaSession = carolina.body as SessionView;
    expect(carolinaSession.modules.find((module) => module.moduleKey === "vacations")?.level).toBe("read");
    expect(carolinaSession.assets.every((asset) => !asset.listed && !asset.canRead && !asset.canWrite)).toBe(true);

    const ti = await request(app).get("/demo/session").set("X-User-Id", String(await userId("Jefe de TI")));
    const tiSession = ti.body as SessionView;
    const categories = tiSession.modules.find((module) => module.moduleKey === "assets")?.categories.map((item) => item.name);
    expect(categories).toEqual(["Computadores", "Teléfonos"]);
    expect(tiSession.assets.find((asset) => asset.category.id === 1)?.canWrite).toBe(true);
    expect(tiSession.assets.find((asset) => asset.category.id === 3)?.canWrite).toBe(false);
  });
});
