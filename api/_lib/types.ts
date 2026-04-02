export type Role = "admin" | "manager" | "player";

export interface ApiUser {
  userId: string;
  role: Role;
  playerId?: string;
}

export interface ApiRequestLike {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface ApiResponseLike {
  status: (code: number) => ApiResponseLike;
  json: (body: unknown) => void;
}
