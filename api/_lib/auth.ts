import type { ApiRequestLike, ApiResponseLike, ApiUser, Role } from "./types";

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function readUser(req: ApiRequestLike): ApiUser | null {
  const role = normalizeHeader(req.headers?.["x-role"]) as Role | undefined;
  const userId = normalizeHeader(req.headers?.["x-user-id"]);
  const playerId = normalizeHeader(req.headers?.["x-player-id"]);

  if (!role || !userId) return null;
  if (!["admin", "manager", "player"].includes(role)) return null;

  return { userId, role, playerId: playerId || undefined };
}

export function requireAuth(req: ApiRequestLike, res: ApiResponseLike): ApiUser | null {
  const user = readUser(req);
  if (!user) {
    res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing or invalid auth headers" });
    return null;
  }
  return user;
}
