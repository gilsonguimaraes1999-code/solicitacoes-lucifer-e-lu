"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { RequestCard } from "@/components/kanban/request-card";
import { ColumnActions } from "@/components/kanban/column-actions";
import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";

const systemColors = {
  pending: "status-pending",
  in_progress: "border border-blue-400/20 bg-blue-400/10 text-blue-300",
  completed: "status-approved",
} as const;

export function KanbanColumn({ column, requests, canMove, canManageColumns, canMoveColumnLeft, canMoveColumnRight, onOpen, onRename, onReorder, onDelete }: { column: BoardColumn; requests: RequestRecord[]; canMove: boolean; canManageColumns: boolean; canMoveColumnLeft?: boolean; canMoveColumnRight?: boolean; onOpen: (request: RequestRecord) => void; onRename: (columnId: string, name: string) => Promise<void>; onReorder?: (columnId: string, direction: "left" | "right") => Promise<void>; onDelete: (columnId: string) => Promise<void> }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const color = column.kind === "assignee" ? "border border-violet-400/20 bg-violet-400/10 text-violet-300" : systemColors[column.system_key ?? "pending"];
  return <section ref={setNodeRef} className={`min-h-[360px] min-w-0 rounded-2xl border p-3 transition ${isOver ? "border-[#d4af37] bg-[#d4af37]/10" : "border-white/10 bg-black/45 backdrop-blur-md"}`}><header className="mb-3 flex items-center justify-between gap-2"><h2 className={`badge min-w-0 truncate ${color}`}>{column.name}</h2><div className="flex shrink-0 items-center gap-2"><span className="text-xs font-semibold text-white/40">{requests.length}</span><ColumnActions column={column} canManageColumns={canManageColumns} canMoveLeft={canMoveColumnLeft} canMoveRight={canMoveColumnRight} onRename={onRename} onReorder={onReorder} onDelete={onDelete} /></div></header><SortableContext items={requests.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="grid gap-3">{requests.map((request) => <RequestCard key={request.id} request={request} canMove={canMove} onOpen={() => onOpen(request)} />)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Nenhuma solicitação nesta coluna.</p>}</div></SortableContext></section>;
}
