-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('none', 'read', 'write');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "profile_id" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_grants" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "module_key" TEXT NOT NULL,
    "level" "AccessLevel" NOT NULL,
    "area_restricted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "module_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_areas" (
    "grant_id" INTEGER NOT NULL,
    "area_id" INTEGER NOT NULL,

    CONSTRAINT "grant_areas_pkey" PRIMARY KEY ("grant_id","area_id")
);

-- CreateTable
CREATE TABLE "entity_restrictions" (
    "id" SERIAL NOT NULL,
    "grant_id" INTEGER NOT NULL,
    "resource_type" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "value_id" INTEGER NOT NULL,

    CONSTRAINT "entity_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "area_closure" (
    "ancestor_id" INTEGER NOT NULL,
    "descendant_id" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "area_closure_pkey" PRIMARY KEY ("ancestor_id","descendant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "module_grants_profile_id_module_key_key" ON "module_grants"("profile_id", "module_key");

-- CreateIndex
CREATE INDEX "entity_restrictions_grant_id_resource_type_dimension_idx" ON "entity_restrictions"("grant_id", "resource_type", "dimension");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_grants" ADD CONSTRAINT "module_grants_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_areas" ADD CONSTRAINT "grant_areas_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "module_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_restrictions" ADD CONSTRAINT "entity_restrictions_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "module_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
