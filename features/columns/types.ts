export const SYSTEM_COLUMN_KEYS = ["pending", "in_progress", "completed"] as const;
export type SystemColumnKey = (typeof SYSTEM_COLUMN_KEYS)[number];

export interface BoardColumn {
  id: string;
  name: string;
  kind: "system" | "assignee";
  system_key: SystemColumnKey | null;
  assignee_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
