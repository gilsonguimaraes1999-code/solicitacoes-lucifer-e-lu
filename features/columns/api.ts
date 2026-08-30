import { createBrowserClient } from "@/lib/supabase/browser";
import type { BoardColumn } from "@/features/columns/types";

export async function createBoardColumn(name: string, assigneeId: string, position: number) {
  const response = await createBrowserClient().rpc("create_board_column", {
    new_name: name,
    target_assignee: assigneeId,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export async function renameBoardColumn(columnId: string, name: string) {
  const response = await createBrowserClient().rpc("rename_board_column", {
    column_id: columnId,
    new_name: name,
  });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export async function reorderBoardColumn(columnId: string, position: number) {
  const response = await createBrowserClient().rpc("reorder_board_column", {
    column_id: columnId,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export async function deleteBoardColumn(columnId: string) {
  const response = await createBrowserClient().rpc("delete_board_column", { column_id: columnId });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}
