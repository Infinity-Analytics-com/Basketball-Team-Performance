import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

interface SortState {
  columnId: string;
  direction: SortDirection;
}

export interface SortableTableColumn<T> {
  id: string;
  label: string;
  sortAccessor: (row: T) => unknown;
  cell: (row: T, rowIndex: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface SortableTableProps<T> {
  rows: T[];
  columns: Array<SortableTableColumn<T>>;
  getRowKey: (row: T) => string;
}

export function SortableTable<T>({ rows, columns, getRowKey }: SortableTableProps<T>) {
  const [sortState, setSortState] = useState<SortState | null>(null);

  const sortedRows = useMemo(() => {
    if (!sortState) return rows.slice();
    const column = columns.find((item) => item.id === sortState.columnId);
    if (!column) return rows.slice();

    const direction = sortState.direction === "asc" ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = column.sortAccessor(left.row);
        const rightValue = column.sortAccessor(right.row);
        const byValue = compareUnknown(leftValue, rightValue) * direction;
        if (byValue !== 0) return byValue;
        return left.index - right.index;
      })
      .map((entry) => entry.row);
  }, [columns, rows, sortState]);

  const toggleSort = (columnId: string) => {
    setSortState((prev) => {
      if (!prev || prev.columnId !== columnId) {
        return { columnId, direction: "desc" };
      }
      return { columnId, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  };

  const sortIndicator = (columnId: string) => {
    if (!sortState || sortState.columnId !== columnId) return "";
    return sortState.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} className={column.headerClassName}>
              <button type="button" className="column-sort" onClick={() => toggleSort(column.id)}>
                {column.label}
                {sortIndicator(column.id)}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, rowIndex) => (
          <tr key={getRowKey(row)}>
            {columns.map((column) => (
              <td key={`${getRowKey(row)}-${column.id}`} className={column.cellClassName}>
                {column.cell(row, rowIndex)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function compareUnknown(left: unknown, right: unknown): number {
  const leftNumber = toSortableNumber(left);
  const rightNumber = toSortableNumber(right);
  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber - rightNumber;
  }
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { sensitivity: "base" });
}

function toSortableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
