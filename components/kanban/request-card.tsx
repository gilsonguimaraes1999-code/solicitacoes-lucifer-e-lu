"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes render-safe callback refs and reactive transform data. */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink } from "lucide-react";
import type { RequestRecord } from "@/features/requests/types";

export function RequestCard({ request, canMove, onOpen }: { request: RequestRecord; canMove: boolean; onOpen: () => void }) {
  const sortable = useSortable({ id: request.id, data: { columnId: request.column_id }, disabled: !canMove });
  return (
    <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .45 : 1 }} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={onOpen} className="w-full text-left"><h3 className="font-semibold leading-snug">{request.title}</h3><p className="mt-2 text-xs text-slate-500">Solicitante: {request.requester_name}</p><p className="mt-1 text-xs text-slate-500">Responsável: {request.assignee?.full_name ?? "—"}</p></button>
      <div className="mt-3 flex items-center justify-between">
        {request.external_url ? <a href={request.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700"><ExternalLink size={13} />Abrir link</a> : <span />}
        {canMove && <button type="button" aria-label={`Mover ${request.title}`} {...sortable.attributes} {...sortable.listeners} style={{ touchAction: "none" }} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">Arrastar</button>}
      </div>
    </article>
  );
}
