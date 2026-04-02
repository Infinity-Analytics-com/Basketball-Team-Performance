import type { Permission, Role } from "@/types";

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "dashboard:view",
    "player:view:any",
    "admin:users:manage",
    "admin:roles:manage",
    "admin:settings:manage",
    "admin:audit:view"
  ],
  manager: ["dashboard:view", "player:view:any"],
  player: ["player:view:self"]
};

export function permissionsForRole(role: Role): Permission[] {
  return rolePermissions[role];
}

export function canViewPlayer(role: Role, viewerPlayerId: string | undefined, targetPlayerId: string): boolean {
  if (role === "admin" || role === "manager") {
    return true;
  }
  return viewerPlayerId === targetPlayerId;
}

export function isAdmin(role: Role): boolean {
  return role === "admin";
}
