// Nombres fijos de docs/seed-data.md. El esquema no guarda etiquetas de área ni categoría.

export const MODULES = [
  { key: "assets", label: "Activos" },
  { key: "complaints", label: "Denuncias" },
  { key: "documents", label: "Documentos" },
  { key: "payroll", label: "Remuneraciones" },
  { key: "vacations", label: "Vacaciones" },
] as const;

const AREA_NAMES: Record<number, string> = {
  1: "Gerencia General",
  2: "Gerencia Comercial",
  3: "Ventas Zona Norte",
  4: "Ventas Zona Sur",
  5: "Marketing",
  6: "Gerencia de Operaciones",
};

const ASSET_CATEGORIES: Record<number, string> = {
  1: "Computadores",
  2: "Teléfonos",
  3: "Vehículos",
};

const COMPLAINT_CATEGORIES: Record<number, string> = {
  1: "Acoso",
  2: "Fraude",
  3: "Discriminación",
};

export type OrgNode = {
  id: number;
  name: string;
  children: OrgNode[];
};

export const ORG: OrgNode[] = [
  {
    id: 1,
    name: "Gerencia General",
    children: [
      {
        id: 2,
        name: "Gerencia Comercial",
        children: [
          { id: 3, name: "Ventas Zona Norte", children: [] },
          { id: 4, name: "Ventas Zona Sur", children: [] },
          { id: 5, name: "Marketing", children: [] },
        ],
      },
      { id: 6, name: "Gerencia de Operaciones", children: [] },
    ],
  },
];

export function moduleLabel(moduleKey: string): string {
  return MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey;
}

export function areaName(areaId: number): string {
  return AREA_NAMES[areaId] ?? `Área ${areaId}`;
}

export function categoryName(resourceType: string, valueId: number): string {
  const table = resourceType === "complaints" ? COMPLAINT_CATEGORIES : resourceType === "assets" ? ASSET_CATEGORIES : {};
  return table[valueId] ?? `#${valueId}`;
}

export function levelLabel(level: "none" | "read" | "write"): string {
  if (level === "write") {
    return "escritura";
  }
  if (level === "read") {
    return "lectura";
  }
  return "sin acceso";
}

export function joinNames(names: string[]): string {
  if (names.length === 0) {
    return "ninguna";
  }
  if (names.length === 1) {
    return names[0] ?? "ninguna";
  }
  const last = names[names.length - 1];
  return `${names.slice(0, -1).join(", ")} y ${last}`;
}
