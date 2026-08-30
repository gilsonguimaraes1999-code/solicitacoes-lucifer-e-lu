"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastNotice } from "@/components/ui/site-toast";
import type { BoardColumn, SystemColumnKey } from "@/features/columns/types";
import type { RequestInput } from "@/features/requests/schemas";
import type { Profile, RequestRecord } from "@/features/requests/types";

const systemActions: Array<{ key: SystemColumnKey; label: string }> = [
  { key: "pending", label: "Pendente" },
  { key: "in_progress", label: "Em progresso" },
  { key: "completed", label: "Concluído" },
];

interface RequestDialogProps {
  request: RequestRecord | null;
  profiles: Profile[];
  columns: BoardColumn[];
  canEdit: boolean;
  canDelete: boolean;
  canMove: boolean;
  onClose: () => void;
  onSave: (input: RequestInput) => Promise<void>;
  onMoveToSystem: (systemKey: SystemColumnKey) => Promise<void>;
  onDelete?: () => Promise<void>;
}

type FormField = keyof RequestInput;

function requestFormValues(request: RequestRecord | null): RequestInput {
  return {
    title: request?.title ?? "",
    description: request?.description ?? "",
    requesterName: request?.requester_name ?? "",
    assignedTo: request?.assigned_to ?? "",
    externalUrl: request?.external_url ?? "",
  };
}

function movementErrorMessage(error: unknown) {
  if (error instanceof Error && [
    "A coluna de destino não foi encontrada.",
    "Uma movimentação desta solicitação já está em andamento.",
    "A solicitação foi atualizada durante a movimentação. Confira o estado atual.",
  ].includes(error.message)) return error.message;
  return "Não foi possível mover a solicitação. Tente novamente.";
}

function deletionErrorMessage(error: unknown) {
  if (error instanceof Error && [
    "Não é possível excluir enquanto uma movimentação está em andamento.",
    "A exclusão desta solicitação já está em andamento.",
  ].includes(error.message)) return error.message;
  return "Não foi possível excluir a solicitação. Tente novamente.";
}

export function RequestDialog({ request, profiles, columns, canEdit, canDelete, canMove, onClose, onSave, onMoveToSystem, onDelete }: RequestDialogProps) {
  const [editing, setEditing] = useState(!request);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [formValues, setFormValues] = useState<RequestInput>(() => requestFormValues(request));
  const dirtyFieldsRef = useRef(new Set<FormField>());

  useEffect(() => {
    const remoteValues = requestFormValues(request);
    setFormValues((current) => ({
      title: dirtyFieldsRef.current.has("title") ? current.title : remoteValues.title,
      description: dirtyFieldsRef.current.has("description") ? current.description : remoteValues.description,
      requesterName: dirtyFieldsRef.current.has("requesterName") ? current.requesterName : remoteValues.requesterName,
      assignedTo: dirtyFieldsRef.current.has("assignedTo") ? current.assignedTo : remoteValues.assignedTo,
      externalUrl: dirtyFieldsRef.current.has("externalUrl") ? current.externalUrl : remoteValues.externalUrl,
    }));
  }, [request]);

  function updateField(field: FormField, value: string) {
    dirtyFieldsRef.current.add(field);
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const currentColumn = request ? columns.find((column) => column.id === request.column_id) : undefined;
  const pendingColumn = columns.find((column) => column.system_key === "pending");
  const assigneeColumn = columns.find((column) => column.kind === "assignee" && column.assignee_id === formValues.assignedTo);
  const selectedDestination = assigneeColumn ?? pendingColumn;
  const keepsCurrentColumn = request && currentColumn && (
    currentColumn.kind === "system" || formValues.assignedTo === request.assigned_to
  );
  const destinationMessage = keepsCurrentColumn
    ? `Ao salvar, continuará em: ${currentColumn.name}`
    : request
      ? `Ao salvar, irá para: ${selectedDestination?.name ?? "Pendente"}`
      : `Entrará em: ${selectedDestination?.name ?? "Pendente"}`;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onSave(formValues);
      onClose();
    } catch {
      setError("Não foi possível salvar. Revise os dados e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function moveToSystem(systemKey: SystemColumnKey) {
    setBusy(true);
    setError("");
    try {
      await onMoveToSystem(systemKey);
      onClose();
    } catch (moveError) {
      setError(movementErrorMessage(moveError));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    setError("");
    try {
      await onDelete();
      setConfirmingDelete(false);
      onClose();
    } catch (deleteError) {
      setError(deletionErrorMessage(deleteError));
      setConfirmingDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={request ? "Detalhes da solicitação" : "Nova solicitação"} className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel max-h-[92vh] w-full max-w-xl overflow-auto p-6">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">{request ? (editing ? "Editar solicitação" : "Detalhes da solicitação") : "Nova solicitação"}</h2>
          <button type="button" className="button secondary" onClick={onClose}>Fechar</button>
        </header>
        {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} />}
        {!editing && request ? (
          <div className="mt-5 grid gap-4 text-sm text-white/65">
            <div><b>Título</b><p>{request.title}</p></div>
            <div><b>Descrição</b><p className="whitespace-pre-wrap">{request.description || "Sem descrição"}</p></div>
            <div><b>Solicitante</b><p>{request.requester_name}</p></div>
            <div><b>Responsável</b><p>{request.assignee?.full_name ?? "—"}</p></div>
            {request.external_url && <a href={request.external_url} target="_blank" rel="noopener noreferrer" className="text-gold-soft">Abrir link externo</a>}
            {canMove && (
              <div className="grid gap-2">
                <b>Mover para</b>
                <div role="group" aria-label="Mover para status" className="flex flex-wrap gap-2">
                  {systemActions.map((action) => <button key={action.key} type="button" className="button secondary" disabled={busy} onClick={() => void moveToSystem(action.key)}>{action.label}</button>)}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {canEdit && <button type="button" className="button" onClick={() => setEditing(true)}>Editar</button>}
              {canDelete && onDelete && <button type="button" className="button danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>Excluir</button>}
            </div>
          </div>
        ) : (
          <form action={submit} className="mt-5 grid gap-4">
            <label className="label">Título<input className="field" name="title" value={formValues.title} onChange={(event) => updateField("title", event.target.value)} required minLength={2} maxLength={160} /></label>
            <label className="label">Descrição<textarea className="field min-h-28" name="description" value={formValues.description} onChange={(event) => updateField("description", event.target.value)} maxLength={5000} /></label>
            <label className="label">Solicitante<input className="field" name="requesterName" value={formValues.requesterName} onChange={(event) => updateField("requesterName", event.target.value)} required /></label>
            <label className="label">Responsável<select className="field" name="assignedTo" value={formValues.assignedTo} onChange={(event) => updateField("assignedTo", event.target.value)} required><option value="">Selecione</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
            <p className="-mt-2 text-sm text-white/45" aria-live="polite">{destinationMessage}</p>
            <label className="label">Link externo<input className="field" name="externalUrl" type="url" placeholder="https://" value={formValues.externalUrl} onChange={(event) => updateField("externalUrl", event.target.value)} /></label>
            <button className="button" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
          </form>
        )}
      </section>
      {confirmingDelete && request && (
        <ConfirmDialog
          ariaLabel="Confirmar exclusão da solicitação"
          title="Excluir solicitação?"
          itemName={request.title}
          description="Esta solicitação e seus dados serão removidos permanentemente. Esta ação não pode ser desfeita."
          busy={busy}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  );
}

