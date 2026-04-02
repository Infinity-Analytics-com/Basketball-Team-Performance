import type { PlayerRow } from "@/types";

export interface ManagerTableRow extends PlayerRow {
  totalMinutes: number;
  totalImpact60: number;
}

export type ManagerSortColumn = "name" | "totalMinutes" | "totalImpact60" | "att60" | "trans60" | "def60" | "koOurPct" | "koOppPct";
export type SortDirection = "asc" | "desc";

function toSortableNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sortManagerRows(
  sourceRows: ManagerTableRow[],
  sortBy: ManagerSortColumn,
  sortDirection: SortDirection
): ManagerTableRow[] {
  const dir = sortDirection === "asc" ? 1 : -1;

  return sourceRows.slice().sort((a, b) => {
    if (sortBy === "name") {
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName * dir : a.playerId.localeCompare(b.playerId) * dir;
    }

    const aValue = toSortableNumber(a[sortBy]);
    const bValue = toSortableNumber(b[sortBy]);
    const byMetric = (aValue - bValue) * dir;
    if (byMetric !== 0) return byMetric;

    return a.name.localeCompare(b.name);
  });
}
