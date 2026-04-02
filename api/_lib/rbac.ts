import type { ApiResponseLike, ApiUser } from "./types";

export function requireAdmin(user: ApiUser, res: ApiResponseLike): boolean {
  if (user.role !== "admin") {
    res.status(403).json({ code: "FORBIDDEN", message: "Admin role required" });
    return false;
  }
  return true;
}

export function canAccessPlayer(user: ApiUser, targetPlayerId: string): boolean {
  if (user.role === "admin" || user.role === "manager") return true;
  return user.playerId === targetPlayerId;
}
