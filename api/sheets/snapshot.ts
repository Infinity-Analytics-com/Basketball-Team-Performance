import { requireAuth } from "../_lib/auth";
import { buildSnapshot } from "../_lib/sheets";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user) return;

  try {
    const payload = await buildSnapshot(user);
    res.status(200).json(payload);
  } catch (error) {
    res.status(503).json({
      code: "UPSTREAM_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Failed to load sheets snapshot"
    });
  }
}
