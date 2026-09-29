export const MODULES = [
  {
    key: "assets",
    label: "Activos",
    categories: [
      { id: 1, name: "Computadores" },
      { id: 2, name: "Teléfonos" },
      { id: 3, name: "Vehículos" },
    ],
  },
  {
    key: "complaints",
    label: "Denuncias",
    categories: [
      { id: 1, name: "Acoso" },
      { id: 2, name: "Fraude" },
      { id: 3, name: "Discriminación" },
    ],
  },
  { key: "documents", label: "Documentos", categories: [] },
  { key: "payroll", label: "Remuneraciones", categories: [] },
  { key: "vacations", label: "Vacaciones", categories: [] },
] as const;

export const AREAS = [
  { id: 1, name: "Gerencia General" },
  { id: 2, name: "Gerencia Comercial" },
  { id: 3, name: "Ventas Zona Norte" },
  { id: 4, name: "Ventas Zona Sur" },
  { id: 5, name: "Marketing" },
  { id: 6, name: "Gerencia de Operaciones" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type AccessLevel = "none" | "read" | "write";
