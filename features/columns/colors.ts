import type { CSSProperties } from "react";
import type { BoardColumn } from "@/features/columns/types";

export const DEFAULT_COLUMN_COLORS = {
  assignee: "#a78bfa",
  custom: "#d4af37",
  pending: "#d4af37",
  in_progress: "#60a5fa",
  completed: "#34d399",
} as const;

export function getColumnColor(column: BoardColumn) {
  if (column.color) return column.color;
  if (column.kind === "system") return DEFAULT_COLUMN_COLORS[column.system_key];
  return DEFAULT_COLUMN_COLORS[column.kind];
}

export function getColumnBadgeStyle(color: string): CSSProperties {
  return { color, borderColor: `${color}4d`, backgroundColor: `${color}1f` };
}
