import type { Role } from "./types";

export interface UserRecord {
  userId: string;
  email: string;
  role: Role;
  playerId?: string;
  active: boolean;
}

const users: UserRecord[] = [
  { userId: "u-admin", email: "admin@club.test", role: "admin", active: true },
  { userId: "u-manager", email: "manager@club.test", role: "manager", active: true },
  { userId: "u-player-jack", email: "jack@club.test", role: "player", playerId: "p-jack", active: true }
];

const audit: Array<{ at: string; actor: string; action: string }> = [
  { at: new Date().toISOString(), actor: "u-admin", action: "seeded user store" }
];

const settings = {
  sheetId: "1MP0mzEPAxo-Z9g0lmcipxLepjap6Vu3FSCXhbzaRpSU",
  tabs: ["Input Sheet AFL", "Inpact Score AFL", "CategoryScores"],
  ttlSeconds: 300
};

export function listUsers() {
  return users;
}

export function upsertUser(user: UserRecord, actor: string) {
  const idx = users.findIndex((u) => u.userId === user.userId);
  if (idx >= 0) {
    users[idx] = user;
  } else {
    users.push(user);
  }
  audit.unshift({ at: new Date().toISOString(), actor, action: `upserted user ${user.userId}` });
}

export function patchUser(userId: string, patch: Partial<UserRecord>, actor: string): UserRecord | null {
  const item = users.find((u) => u.userId === userId);
  if (!item) return null;
  Object.assign(item, patch);
  audit.unshift({ at: new Date().toISOString(), actor, action: `patched user ${userId}` });
  return item;
}

export function getSettings() {
  return settings;
}

export function updateSettings(patch: Partial<typeof settings>, actor: string) {
  Object.assign(settings, patch);
  audit.unshift({ at: new Date().toISOString(), actor, action: "updated settings" });
}

export function listAudit() {
  return audit;
}
