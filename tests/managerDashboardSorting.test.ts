import { describe, expect, it } from "vitest";
import { sortManagerRows, type ManagerTableRow } from "@/pages/managerDashboardSorting";

const rows: ManagerTableRow[] = [
  {
    playerId: "p-1",
    playerName: "Zed",
    minutes: 40,
    points: 12,
    goals: 2,
    tackles: 5,
    assists: 4,
    turnovers: 3
  },
  {
    playerId: "p-2",
    playerName: "Amy",
    minutes: 22,
    points: 8,
    goals: 1,
    tackles: 7,
    assists: 6,
    turnovers: 1
  },
  {
    playerId: "p-3",
    playerName: "Ben",
    minutes: 60,
    points: 10,
    goals: 0,
    tackles: 3,
    assists: 2,
    turnovers: 5
  }
];

describe("manager dashboard sorting", () => {
  it("sorts numeric columns descending", () => {
    const sorted = sortManagerRows(rows, "tackles", "desc");
    expect(sorted.map((row) => row.playerName)).toEqual(["Amy", "Zed", "Ben"]);
  });

  it("sorts numeric columns ascending", () => {
    const sorted = sortManagerRows(rows, "turnovers", "asc");
    expect(sorted.map((row) => row.playerName)).toEqual(["Amy", "Zed", "Ben"]);
  });

  it("sorts names alphabetically", () => {
    const sorted = sortManagerRows(rows, "playerName", "asc");
    expect(sorted.map((row) => row.playerName)).toEqual(["Amy", "Ben", "Zed"]);
  });

  it("sorts minutes descending", () => {
    const sorted = sortManagerRows(rows, "minutes", "desc");
    expect(sorted.map((row) => row.playerName)).toEqual(["Ben", "Zed", "Amy"]);
  });
});
