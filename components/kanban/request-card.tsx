"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes render-safe callback refs and reactive transform data. */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink } from "lucide-react";
import type { RequestRecord } from "@/features/requests/types";

export function RequestCard({ request, canMove, onOpen }: { request: RequestRecord; canMove: boolean; onOpen: () => void }) {
  const sortable = useSortable({ id: request.id, data: { columnId: request.column_id }, disabled: !canMove });
  return (
    <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .45 : 1 }} className="rounded-xl border border-white/10 bg-white/[.055] p-3 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/[.075]">
      <button type="button" onClick={onOpen} className="w-full text-left"><h3 className="font-semibold leading-snug text-white">{request.title}</h3><p className="mt-2 text-xs text-white/45">Solicitante: {request.requester_name}</p><p className="mt-1 text-xs text-white/45">Responsável: {request.assignee?.full_name ?? "—"}</p></button>
      <div className="mt-3 flex items-center justify-between">
        {request.external_url ? <a href={request.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gold-soft"><ExternalLink size={13} />Abrir link</a> : <span />}
        {canMove && <button type="button" aria-label={`Mover ${request.title}`} {...sortable.attributes} {...sortable.listeners} style={{ touchAction: "none" }} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/45">Arrastar</button>}
      </div>
    </article>
  );
}
