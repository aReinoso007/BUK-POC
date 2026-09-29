import type { Account, AdminGrant, AdminProfile, AssetScope, GrantPatch, PermissionsProbe, Session } from "./types";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

export async function fetchAccounts(signal?: AbortSignal): Promise<Account[]> {
  const response = await fetch("/demo/accounts", { signal });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<Account[]>;
}

export async function fetchSession(userId: number, signal?: AbortSignal): Promise<Session> {
  const response = await fetch("/demo/session", {
    signal,
    headers: { "X-User-Id": String(userId) },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<Session>;
}

export async function fetchPermissions(
  actorId: number,
  targetId: number,
  signal?: AbortSignal,
): Promise<PermissionsProbe> {
  const response = await fetch(`/debug/permissions/${targetId}`, {
    signal,
    headers: { "X-User-Id": String(actorId) },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<PermissionsProbe>;
}

export async function fetchAssetScope(userId: number, signal?: AbortSignal): Promise<AssetScope> {
  const response = await fetch("/debug/scope?module=assets&action=read", {
    signal,
    headers: { "X-User-Id": String(userId) },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<AssetScope>;
}

export async function fetchAdminProfiles(adminId: number, signal?: AbortSignal): Promise<AdminProfile[]> {
  const response = await fetch("/admin/profiles", {
    signal,
    headers: { "X-User-Id": String(adminId) },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<AdminProfile[]>;
}

export async function degradeProfile(
  adminId: number,
  profileId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(`/admin/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(adminId),
    },
    body: JSON.stringify({ isAdmin: false }),
  });
  if (response.ok) {
    return { ok: true };
  }
  return { ok: false, error: await readError(response) };
}

export async function saveGrant(
  adminId: number,
  patch: GrantPatch,
): Promise<AdminGrant> {
  const response = await fetch("/admin/grants", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(adminId),
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<AdminGrant>;
}

export async function renameAsset(
  userId: number,
  assetId: number,
  name: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const response = await fetch(`/assets/${assetId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": String(userId),
    },
    body: JSON.stringify({ name }),
  });
  if (response.ok) {
    return { ok: true };
  }
  return { ok: false, status: response.status, error: await readError(response) };
}
