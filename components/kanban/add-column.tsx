"use client";

import { useMemo, useState } from "react";
import { createColumnSchema } from "@/features/columns/schemas";
import type { BoardColumn } from "@/features/columns/types";
import type { Profile } from "@/features/requests/types";

export function AddColumn({ columns, profiles, canManageColumns, onCreate }: { columns: BoardColumn[]; profiles: Profile[]; canManageColumns: boolean; onCreate: (input: { name: string; assigneeId: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligibleProfiles = useMemo(() => {
    const represented = new Set(columns.map((column) => column.assignee_id).filter(Boolean));
    return profiles.filter((profile) => profile.approval_status === "approved" && !represented.has(profile.id));
  }, [columns, profiles]);

  if (!canManageColumns) return null;

  function changeAssignee(nextAssigneeId: string) {
    setAssigneeId(nextAssigneeId);
    setName(eligibleProfiles.find((profile) => profile.id === nextAssigneeId)?.full_name ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createColumnSchema.safeParse({ name, assigneeId });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados da lista.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onCreate(parsed.data);
      setOpen(false);
      setAssigneeId("");
      setName("");
    } catch {
      setError("Não foi possível adicionar a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" className="button secondary shrink-0" onClick={() => { setError(""); setOpen(true); }}>+ Adicionar outra lista</button>;

  return <form className="w-[320px] shrink-0 rounded-2xl border border-slate-200 bg-slate-100/70 p-3" onSubmit={submit}>
    <h2 className="text-sm font-bold">Adicionar outra lista</h2>
    {eligibleProfiles.length === 0 ? <><p className="mt-3 text-sm text-slate-500">Todos os responsáveis aprovados já possuem uma lista.</p><button type="button" className="button secondary mt-3" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button></> : <>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="label mt-3">Responsável
        <select className="field" value={assigneeId} onChange={(event) => changeAssignee(event.target.value)} disabled={busy} required>
          <option value="">Selecione</option>
          {eligibleProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
        </select>
      </label>
      <label className="label mt-3">Nome da lista
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} required minLength={2} maxLength={80} />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="button" disabled={busy}>{busy ? "Adicionando..." : "Adicionar lista"}</button>
        <button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </>}
  </form>;
}
