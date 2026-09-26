import { afterAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { prisma } from "../db/prisma.js";
import { app } from "./app.js";

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

describe("demo de activos", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

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
