export interface ManagerTableRow {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  goals: number;
  tackles: number;
  assists: number;
  turnovers: number;
}

export type ManagerSortColumn = keyof Omit<ManagerTableRow, "playerId">;
export type SortDirection = "asc" | "desc";

export function sortManagerRows(sourceRows: ManagerTableRow[], sortBy: ManagerSortColumn, sortDirection: SortDirection): ManagerTableRow[] {
  const direction = sortDirection === "asc" ? 1 : -1;
  return sourceRows.slice().sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
}
