"use client";
/* eslint-disable react-hooks/refs -- dnd-kit exposes render-safe callback refs and reactive transform data. */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink } from "lucide-react";
import { RequestTagIcons } from "@/components/requests/request-tags";
import type { RequestRecord } from "@/features/requests/types";
import { formatRequestCreatedAt } from "@/features/requests/date";

function citySummary(request: RequestRecord) {
  if (request.cities.length === 0) return { label: "Cidade", names: "Não definida" };
  return {
    label: request.cities.length === 1 ? "Cidade" : "Cidades",
    names: request.cities.map((city) => city.name).join(", "),
  };
}

export function RequestCardPreview({ request }: { request: RequestRecord }) {
  const city = citySummary(request);
  return (
    <article className="w-[min(320px,calc(100vw-2rem))] rotate-[1deg] rounded-xl border border-[#d4af37]/45 bg-[#171717] p-3 shadow-[0_20px_55px_rgba(0,0,0,0.7)] ring-1 ring-[#d4af37]/20">
      <h3 className="font-semibold leading-snug text-white">{request.title}</h3>
      <RequestTagIcons tags={request.tags ?? []} />
      <p className="mt-2 text-xs text-white/45">{city.label}: {city.names}</p>
      <p className="mt-1 text-xs text-white/45">Responsável: {request.assignee?.full_name ?? "—"}</p>
      <div className="mt-3 flex flex-nowrap items-center justify-between gap-2 overflow-hidden">{request.external_url && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gold-soft"><ExternalLink size={13} />Abrir link</span>}<span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-white/35">Criada em: {formatRequestCreatedAt(request.created_at)}</span></div>
    </article>
  );
}

export function RequestCard({ request, canMove, onOpen }: { request: RequestRecord; canMove: boolean; onOpen: () => void }) {
  const sortable = useSortable({ id: request.id, data: { type: "request", columnId: request.column_id }, disabled: !canMove });
  const dragProps = canMove ? { ...sortable.attributes, ...sortable.listeners } : {};
  const city = citySummary(request);

  return (
    <article
      ref={sortable.setNodeRef}
      {...dragProps}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${request.title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpen();
          return;
        }
        sortable.listeners?.onKeyDown?.(event);
      }}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? .28 : 1, touchAction: canMove ? "none" : "auto" }}
      className={`select-none rounded-xl border bg-white/[.055] p-3 shadow-lg shadow-black/20 outline-none transition-[border-color,background-color,box-shadow,opacity] duration-200 hover:border-[#d4af37]/30 hover:bg-white/[.075] focus-visible:border-[#d4af37]/60 focus-visible:ring-2 focus-visible:ring-[#d4af37]/25 ${sortable.isDragging ? "cursor-grabbing border-[#d4af37]/40" : canMove ? "cursor-grab border-white/10 active:cursor-grabbing" : "cursor-pointer border-white/10"}`}
    >
      <h3 className="font-semibold leading-snug text-white">{request.title}</h3>
      <RequestTagIcons tags={request.tags ?? []} />
      <p className="mt-2 text-xs text-white/45">{city.label}: {city.names}</p>
      <p className="mt-1 text-xs text-white/45">Responsável: {request.assignee?.full_name ?? "—"}</p>
      <div className="mt-3 flex flex-nowrap items-center justify-between gap-2 overflow-hidden">
        {request.external_url && <a
          href={request.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 inline-flex shrink-0 items-center gap-1 text-xs text-gold-soft"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        ><ExternalLink size={13} />Abrir link</a>}
        <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] text-white/35">Criada em: {formatRequestCreatedAt(request.created_at)}</span>
      </div>
    </article>
  );
}
