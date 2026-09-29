import { AccessLevel, Prisma } from "@prisma/client";
import express, { type Request, type Response } from "express";
import { LastAdminError, adminService, type EntityRestrictionInput } from "../authz/admin-service.js";
import { Authz, withResource } from "../authz/authz.js";
import { resolvePermissionsWithSource } from "../authz/permissions-cache.js";
import { prisma } from "../db/prisma.js";
import { assetDeclaration } from "../modules/assets/asset.js";
import { actorCanAdminister } from "./admin-gate.js";
import { listAdminProfiles, viewGrant } from "./admin-profiles.js";
import { cors } from "./cors.js";
import { loadUser } from "./load-user.js";
import { buildSession, listAccounts } from "./session.js";

export const app = express();

app.use(cors);
app.use(express.json());

app.get("/demo/accounts", async (_req, res, next) => {
  try {
    res.json(await listAccounts());
  } catch (error) {
    next(error);
  }
});

app.use(loadUser);

function userId(req: Request, res: Response): number | undefined {
  if (!req.user) {
    res.status(401).json({ error: "Falta X-User-Id" });
    return undefined;
  }
  return req.user.id;
}

async function requireAdmin(req: Request, res: Response): Promise<number | undefined> {
  const id = userId(req, res);
  if (id === undefined) {
    return undefined;
  }
  const allowed = await Authz.withUser(id, () => actorCanAdminister());
  if (!allowed) {
    res.status(403).json({ error: "denegado" });
    return undefined;
  }
  return id;
}

const ACCESS_LEVELS = new Set<string>(Object.values(AccessLevel));

function readGrantPatch(body: unknown):
  | { ok: true; profileId: number; moduleKey: string; level?: AccessLevel; areaRestricted?: boolean; areaIds?: number[]; restrictions?: EntityRestrictionInput[] }
  | { ok: false; error: string } {
  if (body === null || typeof body !== "object") {
    return { ok: false, error: "body inválido" };
  }
  const record = body as Record<string, unknown>;
  const profileId = Number(record.profileId);
  const moduleKey = record.moduleKey;
  if (!Number.isInteger(profileId) || typeof moduleKey !== "string" || moduleKey.length === 0) {
    return { ok: false, error: "profileId y moduleKey son obligatorios" };
  }
  const patch: {
    profileId: number;
    moduleKey: string;
    level?: AccessLevel;
    areaRestricted?: boolean;
    areaIds?: number[];
    restrictions?: EntityRestrictionInput[];
  } = { profileId, moduleKey };
  if (record.level !== undefined) {
    if (typeof record.level !== "string" || !ACCESS_LEVELS.has(record.level)) {
      return { ok: false, error: "level inválido" };
    }
    patch.level = record.level as AccessLevel;
  }
  if (record.areaRestricted !== undefined) {
    if (typeof record.areaRestricted !== "boolean") {
      return { ok: false, error: "areaRestricted inválido" };
    }
    patch.areaRestricted = record.areaRestricted;
  }
  if (record.areaIds !== undefined) {
    if (!Array.isArray(record.areaIds) || record.areaIds.some((id) => !Number.isInteger(id))) {
      return { ok: false, error: "areaIds inválido" };
    }
    patch.areaIds = record.areaIds as number[];
  }
  if (record.restrictions !== undefined) {
    if (!Array.isArray(record.restrictions)) {
      return { ok: false, error: "restrictions inválido" };
    }
    const restrictions: EntityRestrictionInput[] = [];
    for (const row of record.restrictions) {
      if (row === null || typeof row !== "object") {
        return { ok: false, error: "restrictions inválido" };
      }
      const item = row as Record<string, unknown>;
      const valueId = Number(item.valueId);
      if (
        typeof item.resourceType !== "string" ||
        typeof item.dimension !== "string" ||
        !Number.isInteger(valueId)
      ) {
        return { ok: false, error: "restrictions inválido" };
      }
      restrictions.push({
        resourceType: item.resourceType,
        dimension: item.dimension,
        valueId,
      });
    }
    patch.restrictions = restrictions;
  }
  return { ok: true, ...patch };
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

app.get("/demo/session", async (req, res, next) => {
  const id = userId(req, res);
  if (id === undefined) {
    return;
  }
  try {
    const session = await Authz.withUser(id, () => buildSession(id));
    res.json(session);
  } catch (error) {
    next(error);
  }
});

app.get("/admin/profiles", async (req, res, next) => {
  if ((await requireAdmin(req, res)) === undefined) {
    return;
  }
  try {
    res.json(await listAdminProfiles());
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/grants", async (req, res, next) => {
  if ((await requireAdmin(req, res)) === undefined) {
    return;
  }
  const patch = readGrantPatch(req.body);
  if (!patch.ok) {
    res.status(400).json({ error: patch.error });
    return;
  }
  try {
    const profile = await prisma.profile.findUnique({ where: { id: patch.profileId } });
    if (!profile) {
      res.status(404).json({ error: "Perfil no existe" });
      return;
    }
    const grant = await adminService.updateGrantFull({
      profileId: patch.profileId,
      moduleKey: patch.moduleKey,
      level: patch.level,
      areaRestricted: patch.areaRestricted,
      areaIds: patch.areaIds,
      restrictions: patch.restrictions,
    });
    res.json(viewGrant(grant));
  } catch (error) {
    next(error);
  }
});

app.get("/debug/permissions/:userId", async (req, res, next) => {
  if (userId(req, res) === undefined) {
    return;
  }
  const targetId = Number(req.params.userId);
  if (!Number.isInteger(targetId)) {
    res.status(400).json({ error: "userId inválido" });
    return;
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      res.status(404).json({ error: "Usuario no existe" });
      return;
    }
    const resolved = await resolvePermissionsWithSource(targetId);
    res.json({
      source: resolved.source,
      permissions: resolved.permissions,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/debug/scope", async (req, res, next) => {
  const id = userId(req, res);
  if (id === undefined) {
    return;
  }
  const moduleKey = req.query.module;
  const action = req.query.action;
  if (moduleKey !== "assets" || (action !== "read" && action !== "write")) {
    res.status(400).json({ error: "module y action inválidos" });
    return;
  }
  try {
    const where = await Authz.withUser(id, () => Authz.scope(assetDeclaration, action));
    res.json({ module: moduleKey, action, where });
  } catch (error) {
    next(error);
  }
});

app.patch("/admin/profiles/:id", async (req, res, next) => {
  if ((await requireAdmin(req, res)) === undefined) {
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "id inválido" });
    return;
  }
  const isAdmin = req.body?.isAdmin;
  if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
    res.status(400).json({ error: "isAdmin inválido" });
    return;
  }
  try {
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ error: "Perfil no existe" });
      return;
    }
    await adminService.updateProfile(id, isAdmin === undefined ? {} : { isAdmin });
    const updated = await prisma.profile.findUniqueOrThrow({
      where: { id },
      include: {
        users: { orderBy: { id: "asc" }, select: { id: true, name: true } },
      },
    });
    res.json({
      id: updated.id,
      name: updated.name,
      isAdmin: updated.isAdmin,
      users: updated.users,
    });
  } catch (error) {
    if (error instanceof LastAdminError) {
      res.status(409).json({ error: "no se puede dejar el tenant sin administrador" });
      return;
    }
    next(error);
  }
});
