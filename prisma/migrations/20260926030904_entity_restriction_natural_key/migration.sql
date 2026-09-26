/*
  Warnings:

  - A unique constraint covering the columns `[grant_id,resource_type,dimension,value_id]` on the table `entity_restrictions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "entity_restrictions_grant_id_resource_type_dimension_value__key" ON "entity_restrictions"("grant_id", "resource_type", "dimension", "value_id");
