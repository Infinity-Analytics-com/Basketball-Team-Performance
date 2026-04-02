import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../api/_lib/sheets";

describe("snapshot RBAC filtering", () => {
  it("returns all rows for manager", async () => {
    const snapshot = await buildSnapshot({ userId: "u-manager", role: "manager" });
    expect(snapshot.dashboard.rows.length).toBeGreaterThan(1);
    expect(snapshot.visiblePlayerIds.length).toBe(snapshot.dashboard.rows.length);
  });

  it("returns only own player rows for player role", async () => {
    const snapshot = await buildSnapshot({ userId: "u-player", role: "player", playerId: "p-jack" });
    expect(snapshot.dashboard.rows.length).toBe(1);
    expect(snapshot.dashboard.rows[0].playerId).toBe("p-jack");
    expect(snapshot.visiblePlayerIds).toEqual(["p-jack"]);
  });
});
