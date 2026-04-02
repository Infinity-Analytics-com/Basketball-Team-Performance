import { describe, expect, it } from "vitest";
import { sortManagerRows, type ManagerTableRow } from "@/pages/managerDashboardSorting";

const rows: ManagerTableRow[] = [
  {
    rank: 1,
    playerId: "p-1",
    name: "Zed",
    position: "Player",
    number: "",
    totalMinutes: 40,
    totalImpact60: 24.15,
    att60: 8.2,
    trans60: 3.1,
    def60: 4.8,
    koOurPct: 61,
    koOppPct: 39,
    totalImpact: 16.1
  },
  {
    rank: 2,
    playerId: "p-2",
    name: "Amy",
    position: "Player",
    number: "",
    totalMinutes: 22,
    totalImpact60: 38.45,
    att60: 6.2,
    trans60: 4.1,
    def60: 5.8,
    koOurPct: 55,
    koOppPct: 45,
    totalImpact: 14.1
  },
  {
    rank: 3,
    playerId: "p-3",
    name: "Ben",
    position: "Player",
    number: "",
    totalMinutes: 60,
    totalImpact60: 15.30,
    att60: 7.4,
    trans60: 5.1,
    def60: 2.8,
    koOurPct: 70,
    koOppPct: 30,
    totalImpact: 15.3
  }
];

describe("manager dashboard sorting", () => {
  it("sorts numeric columns descending", () => {
    const sorted = sortManagerRows(rows, "att60", "desc");
    expect(sorted.map((row) => row.name)).toEqual(["Zed", "Ben", "Amy"]);
  });

  it("sorts numeric columns ascending", () => {
    const sorted = sortManagerRows(rows, "def60", "asc");
    expect(sorted.map((row) => row.name)).toEqual(["Ben", "Zed", "Amy"]);
  });

  it("sorts names alphabetically", () => {
    const sorted = sortManagerRows(rows, "name", "asc");
    expect(sorted.map((row) => row.name)).toEqual(["Amy", "Ben", "Zed"]);
  });

  it("sorts total impact 60 descending", () => {
    const sorted = sortManagerRows(rows, "totalImpact60", "desc");
    expect(sorted.map((row) => row.name)).toEqual(["Amy", "Zed", "Ben"]);
  });
});
