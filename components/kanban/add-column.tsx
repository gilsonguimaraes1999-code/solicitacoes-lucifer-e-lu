"use client";

import { useMemo, useState } from "react";
import { createColumnInputSchema } from "@/features/columns/schemas";
import { ToastNotice } from "@/components/ui/site-toast";
import type { BoardColumn, CreateColumnInput } from "@/features/columns/types";
import type { Profile } from "@/features/requests/types";

export function AddColumn({ columns, profiles, canManageColumns, onCreate }: { columns: BoardColumn[]; profiles: Profile[]; canManageColumns: boolean; onCreate: (input: CreateColumnInput) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CreateColumnInput["kind"] | null>(null);
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

  function close() {
    setOpen(false);
    setKind(null);
    setAssigneeId("");
    setName("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind) return;
    const input: CreateColumnInput = kind === "custom"
      ? { kind, name, assigneeId: null }
      : { kind, name, assigneeId };
    const parsed = createColumnInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados da lista.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await onCreate(parsed.data);
      close();
    } catch {
      setError("Não foi possível adicionar a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button type="button" className="add-list-tile" onClick={() => setOpen(true)}>+ Adicionar outra lista</button>;

  if (!kind) return <div className="min-w-0 rounded-2xl border border-[#d4af37]/20 bg-black/55 p-4 backdrop-blur-md">
    <h2 className="text-sm font-bold text-white">Adicionar outra lista</h2>
    <p className="mt-3 text-sm text-white/55">Escolha o tipo de lista que deseja adicionar.</p>
    <div className="mt-3 grid gap-2">
      <button type="button" className="button secondary justify-start" disabled={eligibleProfiles.length === 0} onClick={() => setKind("assignee")}>Lista de responsável</button>
      <button type="button" className="button secondary justify-start" onClick={() => setKind("custom")}>Lista personalizada</button>
    </div>
    {eligibleProfiles.length === 0 && <p className="mt-3 text-sm text-white/45">Todos os responsáveis aprovados já possuem uma lista.</p>}
    <button type="button" className="button secondary mt-3" onClick={close}>Cancelar</button>
  </div>;

  return <form className="min-w-0 rounded-2xl border border-[#d4af37]/20 bg-black/55 p-4 backdrop-blur-md" onSubmit={submit}>
    <h2 className="text-sm font-bold text-white">Adicionar outra lista</h2>
    {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} />}
    {kind === "assignee" && <>
      <label className="label mt-3">Responsável
        <select className="field" value={assigneeId} onChange={(event) => changeAssignee(event.target.value)} disabled={busy} required>
          <option value="">Selecione</option>
          {eligibleProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
        </select>
      </label>
      <label className="label mt-3">Nome da lista
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} required minLength={2} maxLength={80} />
      </label>
    </>}
    {kind === "custom" && <label className="label mt-3">Nome da lista
      <input className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} required minLength={2} maxLength={80} autoFocus />
    </label>}
    <div className="mt-3 flex gap-2">
      <button type="submit" className="button" disabled={busy}>{busy ? "Adicionando..." : "Adicionar lista"}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={close}>Cancelar</button>
    </div>
  </form>;
}
