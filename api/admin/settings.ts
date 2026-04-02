import { requireAuth } from "../_lib/auth";
import { requireAdmin } from "../_lib/rbac";
import { getSettings, updateSettings } from "../_lib/store";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

export default function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user || !requireAdmin(user, res)) return;

  if (req.method === "GET") {
    res.status(200).json({ settings: getSettings() });
    return;
  }

  if (req.method === "PATCH") {
    updateSettings((req.body ?? {}) as Partial<ReturnType<typeof getSettings>>, user.userId);
    res.status(200).json({ settings: getSettings() });
    return;
  }

  res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
}
