import type { Account, Session } from "./types";

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
