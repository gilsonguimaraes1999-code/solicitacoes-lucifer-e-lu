import { createBrowserClient } from "@/lib/supabase/browser";
import type { BoardColumn, CreateColumnInput } from "@/features/columns/types";

async function createAssigneeBoardColumn(name: string, assigneeId: string, position: number) {
  const response = await createBrowserClient().rpc("create_board_column", {
    new_name: name,
    target_assignee: assigneeId,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export async function createCustomBoardColumn(name: string, position: number) {
  const response = await createBrowserClient().rpc("create_custom_board_column", {
    new_name: name,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export function createBoardColumn(input: CreateColumnInput, position: number): Promise<BoardColumn>;
export function createBoardColumn(name: string, assigneeId: string, position: number): Promise<BoardColumn>;
export function createBoardColumn(input: CreateColumnInput | string, assigneeOrPosition: string | number, legacyPosition?: number): Promise<BoardColumn> {
  if (typeof input === "string") return createAssigneeBoardColumn(input, assigneeOrPosition as string, legacyPosition as number);
  return input.kind === "custom"
    ? createCustomBoardColumn(input.name, assigneeOrPosition as number)
    : createAssigneeBoardColumn(input.name, input.assigneeId, assigneeOrPosition as number);
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

export async function getBoardColumn(columnId: string) {
  const response = await createBrowserClient()
    .from("board_columns")
    .select("*")
    .eq("id", columnId)
    .single();
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}

export async function deleteBoardColumn(columnId: string) {
  const response = await createBrowserClient().rpc("delete_board_column", { column_id: columnId });
  if (response.error) throw response.error;
  return response.data as BoardColumn;
}
