"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { AdminUser, PermissionSet, UserEditorValue } from "@/features/users/types";

const permissionLabels: [keyof PermissionSet, string, string][] = [
  ["can_create_requests", "Criar solicitações", "Permite cadastrar novos cartões no quadro."],
  ["can_edit_requests", "Editar solicitações", "Permite alterar dados e responsável."],
  ["can_move_requests", "Mover solicitações", "Permite arrastar cartões entre listas."],
  ["can_delete_requests", "Excluir solicitações", "Permite remover cartões do quadro."],
  ["can_manage_columns", "Gerenciar colunas", "Permite criar, ordenar, renomear e excluir listas."],
];

export function UserEditor({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: (id: string, value: UserEditorValue) => Promise<void> }) {
  const owner = user.role === "owner";
  const [fullName, setFullName] = useState(user.full_name);
  const [approvalStatus, setApprovalStatus] = useState(user.approval_status);
  const [permissions, setPermissions] = useState(user.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(user.id, {
        fullName: fullName.trim(),
        approvalStatus: owner ? "approved" : approvalStatus,
        permissions: owner ? Object.fromEntries(permissionLabels.map(([key]) => [key, true])) as unknown as PermissionSet : permissions,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Editar usuário" description={user.email} onClose={onClose}>
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label">Nome completo<input className="field" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={120} disabled={busy} /></label>
        <label className="label">Status da conta<select className="field" value={owner ? "approved" : approvalStatus} onChange={(event) => setApprovalStatus(event.target.value as AdminUser["approval_status"])} disabled={busy || owner}>
          <option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option><option value="suspended">Suspensa</option>
        </select></label>
      </div>
      <section className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-gold" /><h3 className="font-semibold text-white">Permissões individuais</h3></div>
        {owner && <p className="mt-2 text-sm text-gold-soft">A conta owner possui todas as permissões nativamente.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {permissionLabels.map(([key, label, description]) => <label key={key} className="permission-option"><input type="checkbox" aria-label={label} checked={owner || permissions[key]} disabled={busy || owner} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))} /><span><strong>{label}</strong><small>{description}</small></span></label>)}
        </div>
      </section>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="button" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div>
    </form>
  </Modal>;
}
