import { SYSTEM_COLUMN_KEYS, type BoardColumn } from "@/features/columns/types";

export type ColumnsEvent =
  | { type: "snapshot"; columns: BoardColumn[] }
  | { type: "insert" | "update"; column: BoardColumn }
  | { type: "delete"; id: string };

function systemKeyPosition(key: BoardColumn["system_key"]): number {
  const index = SYSTEM_COLUMN_KEYS.findIndex((systemKey) => systemKey === key);
  return index === -1 ? SYSTEM_COLUMN_KEYS.length : index;
}

function sortColumns(columns: BoardColumn[]): BoardColumn[] {
  return [...columns].sort((left, right) => {
    if (left.kind === "system" && right.kind === "system") {
      return systemKeyPosition(left.system_key) - systemKeyPosition(right.system_key)
        || left.position - right.position
        || left.id.localeCompare(right.id);
    }
    if (left.kind === "system") return -1;
    if (right.kind === "system") return 1;
    return left.position - right.position || left.id.localeCompare(right.id);
  });
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
