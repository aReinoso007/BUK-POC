import type { AccessLevel } from "@prisma/client";
import { moduleGrant, type EffectivePermissions } from "../authz/resolver.js";
import { areaName, categoryName, levelLabel } from "./catalog.js";

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };

export type AssetFact = {
  ownerAreaId: number | null;
  categoryId: number;
};

// Misma precedencia que Authz.can: nivel, después área, después categoría.
export function explainAsset(permissions: EffectivePermissions, action: "read" | "write", asset: AssetFact): string {
  if (permissions.isAdmin) {
    return "El perfil administrador no pasa por módulo, área ni categoría.";
  }

  const grant = moduleGrant(permissions, "assets");
  const actionLabel = action === "read" ? "lectura" : "escritura";
  if (LEVEL_RANK[grant.level] < LEVEL_RANK[action]) {
    return `Activos está en «${levelLabel(grant.level)}». La ${actionLabel} exige un nivel mayor.`;
  }

  if (grant.areaRestricted) {
    const covered = grant.areaIds.map((id) => areaName(id));
    const inside = asset.ownerAreaId != null && grant.areaIds.includes(asset.ownerAreaId);
    if (!inside) {
      const place = asset.ownerAreaId == null ? "sin área" : areaName(asset.ownerAreaId);
      const scope = covered.length === 0 ? "ninguna área" : covered.join(", ");
      return `El área del activo (${place}) queda fuera del alcance (${scope}).`;
    }
  }

  let categoryNote = "";
  for (const restriction of grant.restrictions) {
    if (restriction.resourceType !== "assets" || restriction.dimension !== "category") {
      continue;
    }
    const category = categoryName("assets", asset.categoryId);
    if (!restriction.valueIds.includes(asset.categoryId)) {
      const allowed = restriction.valueIds.map((id) => categoryName("assets", id)).join(", ") || "ninguna";
      return `La categoría «${category}» no está permitida (${allowed}).`;
    }
    categoryNote = ` La categoría «${category}» está permitida.`;
  }

  const where = grant.areaRestricted && asset.ownerAreaId != null ? `en ${areaName(asset.ownerAreaId)}` : "en toda la empresa";
  return `Hay ${actionLabel} ${where}.${categoryNote}`;
}
