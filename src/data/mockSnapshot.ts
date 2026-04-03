import type { SnapshotResponse } from "@/types";
import { permissionsForRole } from "@/rbac/permissions";

export function buildMockSnapshot(role: SnapshotResponse["auth"]["role"], userId = "u-manager", playerId = "p-placeholder"): SnapshotResponse {
  return {
    meta: {
      sourceSheetId: "mock-disabled",
      fetchedAt: new Date().toISOString(),
      version: "v4-empty"
    },
    auth: { userId, role, playerId: role === "player" ? playerId : undefined },
    permissions: permissionsForRole(role),
    visiblePlayerIds: role === "player" ? [playerId] : [],
    players: {},
    filters: {
      defaultOptionId: "all",
      options: [{ id: "all", label: "All", description: "No mock data available" }]
    },
    records: [],
    performanceLeaderboard: [],
    shootingLeaderboard: []
  };
}
