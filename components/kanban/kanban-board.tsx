"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Search, Plus } from "lucide-react";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { RequestDialog } from "@/components/requests/request-dialog";
import { requestsReducer } from "@/features/requests/reducer";
import { positionBetween } from "@/features/requests/ordering";
import { createRequest, deleteRequest, moveRequest, updateRequest } from "@/features/requests/api";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { EffectivePermissions, Profile, RequestRecord, RequestStatus } from "@/features/requests/types";
import type { RequestInput } from "@/features/requests/schemas";

const statuses: RequestStatus[] = ["pending", "in_progress", "completed"];

export function KanbanBoard({ initialRequests, profiles, currentUserId, permissions }: { initialRequests: RequestRecord[]; profiles: Profile[]; currentUserId: string; permissions: EffectivePermissions }) {
  const [requests, dispatch] = useReducer(requestsReducer, initialRequests);
  const [selected, setSelected] = useState<RequestRecord | null | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [message, setMessage] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel("requests-board").on("postgres_changes", { event: "*", schema: "public", table: "requests" }, async (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => {
      if (payload.eventType === "DELETE") dispatch({ type: "delete", id: (payload.old as { id: string }).id });
      else {
        const { data } = await supabase.from("requests").select("*, assignee:profiles!requests_assigned_to_fkey(id,full_name)").eq("id", (payload.new as { id: string }).id).single();
        if (data) dispatch({ type: payload.eventType === "INSERT" ? "insert" : "update", request: data as RequestRecord });
      }
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return requests.filter((request) => (assignee === "all" || request.assigned_to === assignee) && (!normalized || request.title.toLocaleLowerCase("pt-BR").includes(normalized) || request.requester_name.toLocaleLowerCase("pt-BR").includes(normalized) || request.assignee?.full_name.toLocaleLowerCase("pt-BR").includes(normalized)));
  }, [assignee, query, requests]);

  async function handleMove(event: DragEndEvent) {
    if (!permissions.canMove || !event.over) return;
    const current = requests.find((item) => item.id === event.active.id); if (!current) return;
    const overCard = requests.find((item) => item.id === event.over!.id);
    const targetStatus = (statuses.includes(event.over.id as RequestStatus) ? event.over.id : overCard?.status) as RequestStatus | undefined;
    if (!targetStatus) return;
    const column = requests.filter((item) => item.status === targetStatus && item.id !== current.id);
    const targetIndex = overCard ? Math.max(0, column.findIndex((item) => item.id === overCard.id)) : column.length;
    const before = column[targetIndex - 1]?.position; const after = column[targetIndex]?.position;
    const optimistic = { ...current, status: targetStatus, position: positionBetween(before, after) };
    dispatch({ type: "update", request: optimistic });
    try { const updated = await moveRequest(current.id, targetStatus, optimistic.position); dispatch({ type: "update", request: { ...optimistic, ...updated } }); setMessage("Solicitação movida."); }
    catch { dispatch({ type: "update", request: current }); setMessage("Não foi possível mover. A posição anterior foi restaurada."); }
  }

  async function save(input: RequestInput) {
    if (selected) { const updated = await updateRequest(selected.id, input); const profile = profiles.find((item) => item.id === input.assignedTo); dispatch({ type: "update", request: { ...selected, ...updated, assignee: profile ? { id: profile.id, full_name: profile.full_name } : null } }); setMessage("Solicitação atualizada."); }
    else { const max = Math.max(0, ...requests.filter((item) => item.status === "pending").map((item) => item.position)); const created = await createRequest(input, currentUserId, max + 1024); dispatch({ type: "insert", request: created }); setMessage("Solicitação criada."); }
  }

  return <main className="p-4 md:p-6"><div className="mx-auto max-w-[1500px]"><header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-extrabold">Quadro de solicitações</h1><p className="mt-1 text-sm text-slate-500">Acompanhe o trabalho da equipe em tempo real.</p></div>{permissions.canCreate && <button className="button inline-flex items-center gap-2" onClick={() => setSelected(null)}><Plus size={18} />Nova solicitação</button>}</header>{message && <button className="mb-4 w-full rounded-lg bg-blue-50 p-3 text-left text-sm text-blue-800" onClick={() => setMessage("")}>{message}</button>}<div className="panel mb-5 flex flex-wrap gap-3 p-3"><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><span className="sr-only">Pesquisar</span><input className="field pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Título, solicitante ou responsável" /></label><select className="field max-w-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filtrar por responsável"><option value="all">Todos os responsáveis</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></div><DndContext sensors={sensors} onDragEnd={handleMove}><div className="grid min-w-[900px] grid-cols-3 gap-4 overflow-x-auto">{statuses.map((status) => <KanbanColumn key={status} status={status} requests={filtered.filter((item) => item.status === status)} canMove={permissions.canMove} onOpen={setSelected} />)}</div></DndContext></div>{selected !== undefined && <RequestDialog key={selected?.id ?? "new"} request={selected} profiles={profiles} canEdit={permissions.canEdit} canDelete={permissions.canDelete} onClose={() => setSelected(undefined)} onSave={save} onDelete={selected ? async () => { await deleteRequest(selected.id); dispatch({ type: "delete", id: selected.id }); setMessage("Solicitação excluída."); } : undefined} />}</main>;
}
