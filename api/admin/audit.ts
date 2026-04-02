import { requireAuth } from "../_lib/auth";
import { requireAdmin } from "../_lib/rbac";
import { listAudit } from "../_lib/store";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

export default function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user || !requireAdmin(user, res)) return;

  if (req.method === "GET") {
    res.status(200).json({ audit: listAudit() });
    return;
  }

  res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
}
