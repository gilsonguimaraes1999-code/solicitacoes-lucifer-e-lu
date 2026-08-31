"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes render-safe callback refs and reactive transform data. */

import { useState, type PointerEventHandler } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RequestCard } from "@/components/kanban/request-card";
import { ColumnActions } from "@/components/kanban/column-actions";
import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";
import { getColumnBadgeStyle, getColumnColor } from "@/features/columns/colors";

export function KanbanColumn({ column, requests, canMove, canManageColumns, canReorderColumn = false, canMoveColumnLeft, canMoveColumnRight, onOpen, onRename, onReorder, onDelete }: { column: BoardColumn; requests: RequestRecord[]; canMove: boolean; canManageColumns: boolean; canReorderColumn?: boolean; canMoveColumnLeft?: boolean; canMoveColumnRight?: boolean; onOpen: (request: RequestRecord) => void; onRename: (columnId: string, name: string, color: string) => Promise<void>; onReorder?: (columnId: string, direction: "left" | "right") => Promise<void>; onDelete: (columnId: string) => Promise<void> }) {
  const sortable = useSortable({ id: column.id, data: { type: "column" }, disabled: { draggable: !canReorderColumn, droppable: false } });
  const [renameRequest, setRenameRequest] = useState(0);
  const badgeStyle = getColumnBadgeStyle(getColumnColor(column));
  const canRenameFromTitle = canManageColumns && column.kind !== "assignee";
  const handleHeaderPointerDown: PointerEventHandler<HTMLElement> | undefined = canReorderColumn && sortable.listeners?.onPointerDown
    ? (event) => sortable.listeners?.onPointerDown?.(event)
    : undefined;

  return <section ref={sortable.setNodeRef} data-board-pan-block style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .32 : 1 }} className={`flex max-h-full min-h-0 min-w-0 flex-col cursor-default rounded-2xl border p-3 transition ${sortable.isOver ? "border-[#d4af37] bg-[#d4af37]/10" : "border-white/10 bg-black/45 backdrop-blur-md"}`}>
    <header onPointerDown={handleHeaderPointerDown} className={`mb-3 flex shrink-0 items-center justify-between gap-2 ${canReorderColumn ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}>
      <h2 className="badge min-w-0 truncate border" style={badgeStyle}>{canRenameFromTitle ? <button type="button" className="truncate bg-transparent text-inherit" aria-label={`Renomear lista ${column.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setRenameRequest((current) => current + 1)}>{column.name}</button> : column.name}</h2>
      <div className="flex shrink-0 items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
        <span className="text-xs font-semibold text-white/40">{requests.length}</span>
        <ColumnActions key={`${column.id}-${renameRequest}`} column={column} canManageColumns={canManageColumns} canMoveLeft={canMoveColumnLeft} canMoveRight={canMoveColumnRight} initialRenaming={renameRequest > 0} onRename={onRename} onReorder={onReorder} onDelete={onDelete} />
      </div>
    </header>
    <SortableContext items={requests.map((item) => item.id)} strategy={verticalListSortingStrategy}><div aria-label={`Solicitações em ${column.name}`} className="city-options-scroll grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain pr-1">{requests.map((request) => <RequestCard key={request.id} request={request} canMove={canMove} onOpen={() => onOpen(request)} />)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">Nenhuma solicitação nesta coluna.</p>}</div></SortableContext>
  </section>;
}
