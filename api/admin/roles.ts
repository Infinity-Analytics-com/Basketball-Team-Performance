import { requireAuth } from "../_lib/auth";
import { requireAdmin } from "../_lib/rbac";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

const roles = {
  admin: ["dashboard:view", "player:view:any", "admin:users:manage", "admin:roles:manage", "admin:settings:manage", "admin:audit:view"],
  manager: ["dashboard:view", "player:view:any"],
  player: ["player:view:self"]
};

export default function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user || !requireAdmin(user, res)) return;

  if (req.method === "GET") {
    res.status(200).json({ roles });
    return;
  }

  if (req.method === "POST" || req.method === "PATCH") {
    res.status(200).json({ ok: true, roles });
    return;
  }

  res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
}
