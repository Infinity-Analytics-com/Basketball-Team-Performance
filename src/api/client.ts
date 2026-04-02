import { buildLiveSnapshot } from "@/data/liveSheetsSnapshot";
import type { SnapshotResponse } from "@/types";
import type { Session } from "@/auth/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const SNAPSHOT_CACHE_KEY = "afl-snapshot-cache:v1";
export const SNAPSHOT_CACHE_UPDATED_EVENT = "snapshot-cache-updated";

interface SnapshotCacheEntry {
  session: Pick<Session, "userId" | "role" | "playerId">;
  snapshot: SnapshotResponse;
  updatedAt: string;
}

function readCacheEntry(): SnapshotCacheEntry | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SnapshotCacheEntry>;
    if (!parsed?.snapshot || !parsed.session?.userId || !parsed.session.role) return null;
    return parsed as SnapshotCacheEntry;
  } catch {
    return null;
  }
}

function writeCacheEntry(session: Session, snapshot: SnapshotResponse): SnapshotResponse {
  const entry: SnapshotCacheEntry = {
    session: { userId: session.userId, role: session.role, playerId: session.playerId },
    snapshot,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(entry));
  window.dispatchEvent(new CustomEvent(SNAPSHOT_CACHE_UPDATED_EVENT, { detail: { updatedAt: entry.updatedAt } }));
  return snapshot;
}

export function clearSnapshotCache() {
  localStorage.removeItem(SNAPSHOT_CACHE_KEY);
}

export function hasSnapshotCacheForSession(session: Session): boolean {
  const entry = readCacheEntry();
  if (!entry) return false;
  return entry.session.userId === session.userId && entry.session.role === session.role;
}

export async function refreshSnapshot(session: Session): Promise<SnapshotResponse> {
  if (!API_BASE_URL) {
    const snapshot = await buildLiveSnapshot(session.role, session.userId, session.playerId);
    return writeCacheEntry(session, snapshot);
  }

  const response = await fetch(`${API_BASE_URL}/api/sheets/snapshot`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      "x-user-id": session.userId,
      "x-role": session.role,
      "x-player-id": session.playerId ?? ""
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string; error?: { message?: string } };
      detail = body.message || body.error?.message || "";
    } catch {
      detail = "";
    }
    if (response.status === 429) {
      console.warn("[sheets] rate limited");
    }
    const suffix = detail ? ` - ${detail}` : "";
    throw new Error(`Snapshot request failed (${response.status})${suffix}`);
  }

  const snapshot = (await response.json()) as SnapshotResponse;
  return writeCacheEntry(session, snapshot);
}

export async function getSnapshot(session: Session): Promise<SnapshotResponse> {
  const entry = readCacheEntry();
  if (!entry) {
    throw new Error("No cached snapshot found. Use Refresh Data to fetch from Google Sheets.");
  }
  if (entry.session.userId !== session.userId || entry.session.role !== session.role) {
    throw new Error("Cached snapshot belongs to a different user session. Use Refresh Data.");
  }
  return entry.snapshot;
}
