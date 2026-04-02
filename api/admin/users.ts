import { requireAuth } from "../_lib/auth";
import { requireAdmin } from "../_lib/rbac";
import { listUsers, patchUser, upsertUser, type UserRecord } from "../_lib/store";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

export default function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user || !requireAdmin(user, res)) return;

  if (req.method === "GET") {
    res.status(200).json({ users: listUsers() });
    return;
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as UserRecord;
    upsertUser(body, user.userId);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as { userId: string; patch: Partial<UserRecord> };
    const updated = patchUser(body.userId, body.patch, user.userId);
    if (!updated) {
      res.status(404).json({ code: "NOT_FOUND", message: "User not found" });
      return;
    }
    res.status(200).json({ user: updated });
    return;
  }

  res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
}
