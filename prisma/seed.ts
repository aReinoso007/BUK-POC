import { existsSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { AccessLevel, PrismaClient } from "@prisma/client";

if (existsSync(".env")) {
  config({ quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const AREA_IDS = {
  "Gerencia General": 1,
  "Gerencia Comercial": 2,
  "Ventas Zona Norte": 3,
  "Ventas Zona Sur": 4,
  "Marketing": 5,
  "Gerencia de Operaciones": 6,
} as const;

const ASSET_CATEGORY_IDS = {
  Computadores: 1,
  Teléfonos: 2,
  Vehículos: 3,
} as const;

const COMPLAINT_CATEGORY_IDS = {
  Acoso: 1,
  Fraude: 2,
  Discriminación: 3,
} as const;

const CLOSURE: Array<[number, number, number]> = [
  [AREA_IDS["Gerencia General"], AREA_IDS["Gerencia General"], 0],
  [AREA_IDS["Gerencia Comercial"], AREA_IDS["Gerencia Comercial"], 0],
  [AREA_IDS["Ventas Zona Norte"], AREA_IDS["Ventas Zona Norte"], 0],
  [AREA_IDS["Ventas Zona Sur"], AREA_IDS["Ventas Zona Sur"], 0],
  [AREA_IDS["Marketing"], AREA_IDS["Marketing"], 0],
  [AREA_IDS["Gerencia de Operaciones"], AREA_IDS["Gerencia de Operaciones"], 0],
  [AREA_IDS["Gerencia General"], AREA_IDS["Gerencia Comercial"], 1],
  [AREA_IDS["Gerencia General"], AREA_IDS["Gerencia de Operaciones"], 1],
  [AREA_IDS["Gerencia General"], AREA_IDS["Ventas Zona Norte"], 2],
  [AREA_IDS["Gerencia General"], AREA_IDS["Ventas Zona Sur"], 2],
  [AREA_IDS["Gerencia General"], AREA_IDS["Marketing"], 2],
  [AREA_IDS["Gerencia Comercial"], AREA_IDS["Ventas Zona Norte"], 1],
  [AREA_IDS["Gerencia Comercial"], AREA_IDS["Ventas Zona Sur"], 1],
  [AREA_IDS["Gerencia Comercial"], AREA_IDS["Marketing"], 1],
];

type GrantSeed = {
  moduleKey: string;
  level: AccessLevel;
  areaRestricted: boolean;
  areaIds?: number[];
  categories?: { resourceType: string; valueIds: number[] };
};

type ProfileSeed = {
  profileName: string;
  userName: string;
  isAdmin: boolean;
  grants: GrantSeed[];
};

const PROFILES: ProfileSeed[] = [
  {
    profileName: "Administrador",
    userName: "Gerente General",
    isAdmin: true,
    grants: [],
  },
  {
    profileName: "Pedro",
    userName: "Pedro",
    isAdmin: false,
    grants: [
      { moduleKey: "documents", level: AccessLevel.read, areaRestricted: false },
      { moduleKey: "assets", level: AccessLevel.write, areaRestricted: false },
    ],
  },
  {
    profileName: "Carolina",
    userName: "Carolina",
    isAdmin: false,
    grants: [
      {
        moduleKey: "vacations",
        level: AccessLevel.read,
        areaRestricted: true,
        areaIds: [AREA_IDS["Ventas Zona Norte"]],
      },
    ],
  },
  {
    profileName: "Analista de Remuneraciones",
    userName: "Analista de Remuneraciones",
    isAdmin: false,
    grants: [{ moduleKey: "payroll", level: AccessLevel.read, areaRestricted: false }],
  },
  {
    profileName: "Jefe de Gerencia Comercial",
    userName: "Jefe de Gerencia Comercial",
    isAdmin: false,
    grants: [
      {
        moduleKey: "assets",
        level: AccessLevel.read,
        areaRestricted: true,
        areaIds: [AREA_IDS["Gerencia Comercial"]],
      },
    ],
  },
  {
    profileName: "Jefe de TI",
    userName: "Jefe de TI",
    isAdmin: false,
    grants: [
      {
        moduleKey: "assets",
        level: AccessLevel.write,
        areaRestricted: false,
        categories: {
          resourceType: "assets",
          valueIds: [ASSET_CATEGORY_IDS.Computadores, ASSET_CATEGORY_IDS.Teléfonos],
        },
      },
    ],
  },
  {
    profileName: "Encargado de Denuncias A",
    userName: "Encargado de Denuncias A",
    isAdmin: false,
    grants: [
      {
        moduleKey: "complaints",
        level: AccessLevel.write,
        areaRestricted: false,
        categories: {
          resourceType: "complaints",
          valueIds: [COMPLAINT_CATEGORY_IDS.Acoso, COMPLAINT_CATEGORY_IDS.Discriminación],
        },
      },
    ],
  },
  {
    profileName: "Encargado de Denuncias B",
    userName: "Encargado de Denuncias B",
    isAdmin: false,
    grants: [
      {
        moduleKey: "complaints",
        level: AccessLevel.write,
        areaRestricted: false,
        categories: {
          resourceType: "complaints",
          valueIds: [COMPLAINT_CATEGORY_IDS.Fraude],
        },
      },
    ],
  },
];

async function upsertProfile(name: string, isAdmin: boolean) {
  const existing = await prisma.profile.findFirst({ where: { name } });
  if (existing) {
    return prisma.profile.update({
      where: { id: existing.id },
      data: { isAdmin },
    });
  }
  return prisma.profile.create({ data: { name, isAdmin } });
}

async function upsertUser(name: string, profileId: number) {
  const existing = await prisma.user.findFirst({ where: { name } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { profileId },
    });
  }
  return prisma.user.create({ data: { name, profileId } });
}

async function upsertRestriction(
  grantId: number,
  resourceType: string,
  valueId: number,
) {
  const existing = await prisma.entityRestriction.findFirst({
    where: { grantId, resourceType, dimension: "category", valueId },
  });
  if (existing) {
    return existing;
  }
  return prisma.entityRestriction.create({
    data: { grantId, resourceType, dimension: "category", valueId },
  });
}

async function main() {
  for (const [ancestorId, descendantId, depth] of CLOSURE) {
    await prisma.areaClosure.upsert({
      where: { ancestorId_descendantId: { ancestorId, descendantId } },
      create: { ancestorId, descendantId, depth },
      update: { depth },
    });
  }

  for (const profileSeed of PROFILES) {
    const profile = await upsertProfile(profileSeed.profileName, profileSeed.isAdmin);
    await upsertUser(profileSeed.userName, profile.id);

    for (const grantSeed of profileSeed.grants) {
      const grant = await prisma.moduleGrant.upsert({
        where: {
          profileId_moduleKey: {
            profileId: profile.id,
            moduleKey: grantSeed.moduleKey,
          },
        },
        create: {
          profileId: profile.id,
          moduleKey: grantSeed.moduleKey,
          level: grantSeed.level,
          areaRestricted: grantSeed.areaRestricted,
        },
        update: {
          level: grantSeed.level,
          areaRestricted: grantSeed.areaRestricted,
        },
      });

      for (const areaId of grantSeed.areaIds ?? []) {
        await prisma.grantArea.upsert({
          where: { grantId_areaId: { grantId: grant.id, areaId } },
          create: { grantId: grant.id, areaId },
          update: {},
        });
      }

      for (const valueId of grantSeed.categories?.valueIds ?? []) {
        await upsertRestriction(grant.id, grantSeed.categories!.resourceType, valueId);
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
