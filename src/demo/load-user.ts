import type { User } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma.js";

declare global {
  // Express publica Request en un namespace. La ampliación usa ese mismo contrato.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export async function loadUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("x-user-id");
  const id = Number(header);
  if (!header || !Number.isInteger(id)) {
    res.status(401).json({ error: "Falta X-User-Id" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(401).json({ error: "Usuario no existe" });
    return;
  }
  req.user = user;
  next();
}
