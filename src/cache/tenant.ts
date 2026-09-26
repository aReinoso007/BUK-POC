import { existsSync } from "node:fs";
import { config } from "dotenv";

if (existsSync(".env")) {
  config({ quiet: true });
}

export function tenantId(): string {
  const value = process.env.TENANT_ID;
  if (!value) {
    throw new Error("Falta TENANT_ID");
  }
  return value;
}

export function tenantVersionKey(): string {
  return `authz:${tenantId()}:version`;
}

export function userPermissionsKey(version: string, userId: number): string {
  return `authz:${tenantId()}:v${version}:user:${userId}`;
}
