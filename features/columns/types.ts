export const SYSTEM_COLUMN_KEYS = ["pending", "in_progress", "completed"] as const;
export type SystemColumnKey = (typeof SYSTEM_COLUMN_KEYS)[number];

interface BoardColumnBase {
  id: string;
  name: string;
  color?: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BoardColumn =
  | (BoardColumnBase & { kind: "system"; system_key: SystemColumnKey; assignee_id: null })
  | (BoardColumnBase & { kind: "assignee"; system_key: null; assignee_id: string })
  | (BoardColumnBase & { kind: "custom"; system_key: null; assignee_id: null });

export type CreateColumnInput =
  | { kind: "assignee"; name: string; assigneeId: string; color: string }
  | { kind: "custom"; name: string; assigneeId: null; color: string };
