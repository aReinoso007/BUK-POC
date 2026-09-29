import { Authz, withResource, type ResourceDeclaration } from "../authz/authz.js";

export const adminDeclaration: ResourceDeclaration = {
  module: "admin",
  area: "ownerAreaId",
  dimensions: {},
};

export function adminRecord() {
  return withResource(adminDeclaration, { ownerAreaId: null });
}

export async function actorCanAdminister(): Promise<boolean> {
  return Authz.can("write", adminRecord());
}
