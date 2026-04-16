import type { Role } from "@/types";

const STORAGE_VERSION = "v3";
const SESSION_KEY = `afl-session:${STORAGE_VERSION}`;
const LEGACY_SESSION_KEYS = ["afl-session"];

function clearLegacySessions() {
  LEGACY_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}

export interface Session {
  userId: string;
  role: Role;
  playerId?: string;
  token: string;
}

export function readSession(): Session | null {
  clearLegacySessions();
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session): void {
  clearLegacySessions();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  clearLegacySessions();
}
