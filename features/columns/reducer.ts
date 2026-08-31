import type { BoardColumn } from "@/features/columns/types";

export type ColumnsEvent =
  | { type: "snapshot"; columns: BoardColumn[] }
  | { type: "insert" | "update"; column: BoardColumn }
  | { type: "delete"; id: string };

function sortColumns(columns: BoardColumn[]): BoardColumn[] {
  return [...columns].sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}

export function columnsReducer(state: BoardColumn[], event: ColumnsEvent): BoardColumn[] {
  if (event.type === "delete") return state.filter((column) => column.id !== event.id);

  if (event.type === "snapshot") {
    return sortColumns([...new Map(event.columns.map((column) => [column.id, column])).values()]);
  }
  const columns = new Map(state.map((column) => [column.id, column]));
  columns.set(event.column.id, event.column);
  return sortColumns([...columns.values()]);
}
