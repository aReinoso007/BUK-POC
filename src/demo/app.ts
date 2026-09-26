import { Prisma } from "@prisma/client";
import express, { type Request, type Response } from "express";
import { Authz, withResource } from "../authz/authz.js";
import { prisma } from "../db/prisma.js";
import { assetDeclaration } from "../modules/assets/asset.js";
import { loadUser } from "./load-user.js";

export const app = express();

app.use(express.json());
app.use(loadUser);

function userId(req: Request, res: Response): number | undefined {
  if (!req.user) {
    res.status(401).json({ error: "Falta X-User-Id" });
    return undefined;
  }
  return req.user.id;
}

app.get("/assets", async (req, res, next) => {
  const id = userId(req, res);
  if (id === undefined) {
    return;
  }
  try {
    await Authz.withUser(id, async () => {
      const where = await Authz.scope(assetDeclaration, "read");
      const assets = await prisma.asset.findMany({
        where: where as Prisma.AssetWhereInput,
        orderBy: { id: "asc" },
      });
      res.json(assets);
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/assets/:id", async (req, res, next) => {
  const actorId = userId(req, res);
  if (actorId === undefined) {
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const name = req.body?.name;
  if (typeof name !== "string" || name.length === 0) {
    res.status(400).json({ error: "name es obligatorio" });
    return;
  }
  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      res.status(404).json({ error: "Activo no existe" });
      return;
    }
    await Authz.withUser(actorId, async () => {
      const allowed = await Authz.can(
        "write",
        withResource(assetDeclaration, {
          ownerAreaId: asset.ownerAreaId,
          categoryId: asset.categoryId,
        }),
      );
      if (!allowed) {
        res.status(403).json({ error: "denegado" });
        return;
      }
      const updated = await prisma.asset.update({ where: { id }, data: { name } });
      res.json(updated);
    });
  } catch (error) {
    next(error);
  }
});
