import { describe, expect, it } from "vitest";
import { canViewPlayer, permissionsForRole } from "../src/rbac/permissions";

describe("rbac permissions", () => {
  it("grants full dashboard permissions to admin", () => {
    const permissions = permissionsForRole("admin");
    expect(permissions).toContain("admin:users:manage");
    expect(permissions).toContain("player:view:any");
  });

  it("restricts player to own profile", () => {
    expect(canViewPlayer("player", "p-jack", "p-jack")).toBe(true);
    expect(canViewPlayer("player", "p-jack", "p-kelly")).toBe(false);
  });

  it("allows manager to view all players", () => {
    expect(canViewPlayer("manager", undefined, "p-jack")).toBe(true);
    expect(canViewPlayer("manager", undefined, "p-kelly")).toBe(true);
  });
});
