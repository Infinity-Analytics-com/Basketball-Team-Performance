import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SnapshotResponse } from "@/types";
import { ManagerDashboardPage } from "@/pages/ManagerDashboardPage";

const { getSnapshotMock } = vi.hoisted(() => ({
  getSnapshotMock: vi.fn<() => Promise<SnapshotResponse>>()
}));

vi.mock("@/api/client", () => ({
  getSnapshot: getSnapshotMock,
  refreshSnapshot: vi.fn(),
  SNAPSHOT_CACHE_UPDATED_EVENT: "snapshot-cache-updated"
}));

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({
    session: { userId: "u-manager", role: "manager", token: "token" },
    logout: vi.fn()
  })
}));

function makeSnapshot(): SnapshotResponse {
  return {
    meta: { sourceSheetId: "sheet", fetchedAt: "2026-03-04T00:00:00.000Z", version: "v1" },
    auth: { userId: "u-manager", role: "manager" },
    permissions: ["dashboard:view", "player:view:any"],
    visiblePlayerIds: ["p-a", "p-b", "p-c"],
    dashboard: {
      kpis: [{ label: "All Impact", value: "1.0", subtitle: "" }],
      tabs: ["All Impact"],
      rows: [
        {
          rank: 1,
          playerId: "p-a",
          name: "Alpha",
          position: "Player",
          number: "#1",
          minutes: 40,
          att60: 7,
          trans60: 4,
          def60: 5,
          koOurPct: 60,
          koOppPct: 40,
          totalImpact: 16
        },
        {
          rank: 2,
          playerId: "p-b",
          name: "Bravo",
          position: "Player",
          number: "#2",
          minutes: 20,
          att60: 3,
          trans60: 8,
          def60: 6,
          koOurPct: 45.4,
          koOppPct: 54.6,
          totalImpact: 11
        },
        {
          rank: 3,
          playerId: "p-c",
          name: "Charlie",
          position: "Player",
          number: "#3",
          minutes: 60,
          att60: 9,
          trans60: 2,
          def60: 4,
          koOurPct: 70,
          koOppPct: 30,
          totalImpact: 15
        }
      ],
      topPerformers: []
    },
    players: {
      "p-a": { playerId: "p-a", name: "Alpha", number: "#1", position: "Player" },
      "p-b": { playerId: "p-b", name: "Bravo", number: "#2", position: "Player" },
      "p-c": { playerId: "p-c", name: "Charlie", number: "#3", position: "Player" }
    },
    playerViews: {}
  };
}

function readPlayerOrder(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".manager-table tbody tr td:first-child a")).map((link) => link.textContent ?? "");
}

describe("Manager dashboard table sorting", () => {
  it("sorts high-to-low on first click, then low-to-high on second click", async () => {
    getSnapshotMock.mockResolvedValue(makeSnapshot());
    const { container } = render(
      <MemoryRouter>
        <ManagerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".manager-table tbody tr").length).toBe(3);
    });

    fireEvent.click(screen.getByRole("button", { name: /att 60/i }));
    await waitFor(() => {
      expect(readPlayerOrder(container)).toEqual(["Charlie", "Alpha", "Bravo"]);
    });

    fireEvent.click(screen.getByRole("button", { name: /att 60/i }));
    await waitFor(() => {
      expect(readPlayerOrder(container)).toEqual(["Bravo", "Alpha", "Charlie"]);
    });
  });

  it("sorts by total impact 60 from high-to-low on first click", async () => {
    getSnapshotMock.mockResolvedValue(makeSnapshot());
    const { container } = render(
      <MemoryRouter>
        <ManagerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".manager-table tbody tr").length).toBe(3);
    });

    fireEvent.click(screen.getByRole("button", { name: /total impact 60/i }));
    await waitFor(() => {
      expect(readPlayerOrder(container)).toEqual(["Bravo", "Alpha", "Charlie"]);
    });
  });

  it("renders kickout percentages as whole numbers and centers numeric columns", async () => {
    getSnapshotMock.mockResolvedValue(makeSnapshot());
    const { container } = render(
      <MemoryRouter>
        <ManagerDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".manager-table tbody tr").length).toBe(3);
    });

    expect(screen.getByRole("button", { name: /ko our %/i }).closest("th")).toHaveClass("num");
    expect(screen.getAllByText("45%")[0].closest("td")).toHaveClass("num");
    expect(screen.getByRole("button", { name: /total min/i }).closest("th")).toHaveClass("num");
  });
});
