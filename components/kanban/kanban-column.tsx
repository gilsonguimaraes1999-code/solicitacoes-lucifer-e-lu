"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { RequestCard } from "@/components/kanban/request-card";
import type { RequestRecord, RequestStatus } from "@/features/requests/types";

const names: Record<RequestStatus, string> = { pending: "Pendente", in_progress: "Em progresso", completed: "Concluído" };
const colors: Record<RequestStatus, string> = { pending: "bg-amber-100 text-amber-800", in_progress: "bg-blue-100 text-blue-800", completed: "bg-emerald-100 text-emerald-800" };

export function KanbanColumn({ status, requests, canMove, onOpen }: { status: RequestStatus; requests: RequestRecord[]; canMove: boolean; onOpen: (request: RequestRecord) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return <section ref={setNodeRef} className={`min-h-[420px] rounded-2xl border p-3 transition ${isOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-100/70"}`}><header className="mb-3 flex items-center justify-between"><h2 className={`badge ${colors[status]}`}>{names[status]}</h2><span className="text-xs font-semibold text-slate-500">{requests.length}</span></header><SortableContext items={requests.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="grid gap-3">{requests.map((request) => <RequestCard key={request.id} request={request} canMove={canMove} onOpen={() => onOpen(request)} />)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma solicitação nesta coluna.</p>}</div></SortableContext></section>;
}
