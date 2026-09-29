import { describe, expect, it } from "@jest/globals";
import type { EffectivePermissions } from "../authz/resolver.js";
import { explainAsset } from "./explain.js";

function permissions(grants: EffectivePermissions["grants"], isAdmin = false): EffectivePermissions {
  return { userId: 1, isAdmin, grants };
}

const notebook = { ownerAreaId: 3, categoryId: 1 };
const camioneta = { ownerAreaId: 6, categoryId: 3 };

describe("explainAsset", () => {
  it("el administrador no recorre los filtros", () => {
    const reason = explainAsset(permissions([], true), "write", camioneta);
    expect(reason).toContain("administrador");
  });

  it("sin grant de activos niega por nivel, antes que por área", () => {
    const reason = explainAsset(permissions([]), "read", notebook);
    expect(reason).toContain("sin acceso");
  });

  it("la lectura no alcanza para escribir", () => {
    const reason = explainAsset(
      permissions([
        {
          moduleKey: "assets",
          level: "read",
          areaRestricted: true,
          areaIds: [2, 3, 4, 5],
          restrictions: [],
        },
      ]),
      "write",
      notebook,
    );
    expect(reason).toContain("lectura");
  });

  it("un área fuera del árbol se nombra", () => {
    const reason = explainAsset(
      permissions([
        {
          moduleKey: "assets",
          level: "read",
          areaRestricted: true,
          areaIds: [2, 3, 4, 5],
          restrictions: [],
        },
      ]),
      "read",
      camioneta,
    );
    expect(reason).toContain("Gerencia de Operaciones");
  });

  it("la categoría recorta aunque el área no limite", () => {
    const reason = explainAsset(
      permissions([
        {
          moduleKey: "assets",
          level: "write",
          areaRestricted: false,
          areaIds: [],
          restrictions: [{ resourceType: "assets", dimension: "category", valueIds: [1, 2] }],
        },
      ]),
      "write",
      camioneta,
    );
    expect(reason).toContain("Vehículos");
    expect(reason).toContain("Computadores");
  });
});
