import { requireAuth } from "../_lib/auth";
import type { ApiRequestLike, ApiResponseLike } from "../_lib/types";

export default function handler(req: ApiRequestLike, res: ApiResponseLike) {
  const user = requireAuth(req, res);
  if (!user) return;
  res.status(200).json(user);
}
