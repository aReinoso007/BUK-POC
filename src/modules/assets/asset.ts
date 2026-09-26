import type { ResourceDeclaration } from "../../authz/authz.js";

export const assetDeclaration: ResourceDeclaration = {
  module: "assets",
  area: "ownerAreaId",
  dimensions: { category: "categoryId" },
};
