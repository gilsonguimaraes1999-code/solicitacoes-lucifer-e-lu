"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { RequestCard } from "@/components/kanban/request-card";
import { ColumnActions } from "@/components/kanban/column-actions";
import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";

const systemColors = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
} as const;

export function KanbanColumn({ column, requests, canMove, canManageColumns, canMoveColumnLeft, canMoveColumnRight, onOpen, onRename, onReorder, onDelete }: { column: BoardColumn; requests: RequestRecord[]; canMove: boolean; canManageColumns: boolean; canMoveColumnLeft?: boolean; canMoveColumnRight?: boolean; onOpen: (request: RequestRecord) => void; onRename: (columnId: string, name: string) => Promise<void>; onReorder?: (columnId: string, direction: "left" | "right") => Promise<void>; onDelete: (columnId: string) => Promise<void> }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const color = column.kind === "assignee" ? "bg-violet-100 text-violet-800" : systemColors[column.system_key ?? "pending"];
  return <section ref={setNodeRef} className={`w-[320px] shrink-0 min-h-[420px] rounded-2xl border p-3 transition ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-100/70"}`}><header className="mb-3 flex items-center justify-between gap-2"><h2 className={`badge ${color}`}>{column.name}</h2><div className="flex items-center gap-2"><span className="text-xs font-semibold text-slate-500">{requests.length}</span><ColumnActions column={column} canManageColumns={canManageColumns} canMoveLeft={canMoveColumnLeft} canMoveRight={canMoveColumnRight} onRename={onRename} onReorder={onReorder} onDelete={onDelete} /></div></header><SortableContext items={requests.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="grid gap-3">{requests.map((request) => <RequestCard key={request.id} request={request} canMove={canMove} onOpen={() => onOpen(request)} />)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma solicitação nesta coluna.</p>}</div></SortableContext></section>;
}
