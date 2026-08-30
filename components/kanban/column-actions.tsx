"use client";

import { useState } from "react";
import { renameColumnSchema } from "@/features/columns/schemas";
import type { BoardColumn } from "@/features/columns/types";

function isOccupiedColumnError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export function ColumnActions({ column, canManageColumns, canMoveLeft = false, canMoveRight = false, onRename, onReorder, onDelete }: { column: BoardColumn; canManageColumns: boolean; canMoveLeft?: boolean; canMoveRight?: boolean; onRename: (columnId: string, name: string) => Promise<void>; onReorder?: (columnId: string, direction: "left" | "right") => Promise<void>; onDelete: (columnId: string) => Promise<void> }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(column.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!canManageColumns || column.kind !== "assignee") return null;

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = renameColumnSchema.safeParse({ columnId: column.id, name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise o nome da lista.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRename(column.id, parsed.data.name);
      setRenaming(false);
    } catch {
      setError("Não foi possível renomear a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Excluir esta lista? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(column.id);
    } catch (caught) {
      setError(isOccupiedColumnError(caught) ? "Mova os cartões antes de excluir esta coluna." : "Não foi possível excluir a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: "left" | "right") {
    if (!onReorder) return;
    setBusy(true);
    setError("");
    try {
      await onReorder(column.id, direction);
    } catch {
      setError("Não foi possível reordenar a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex items-center gap-1" aria-label={`Ações da lista ${column.name}`}>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {renaming ? <form className="flex items-center gap-1" onSubmit={rename}>
      <label className="sr-only" htmlFor={`column-name-${column.id}`}>Novo nome da lista</label>
      <input id={`column-name-${column.id}`} className="field h-8 w-36 py-1 text-sm" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} minLength={2} maxLength={80} required />
      <button type="submit" className="button px-2 py-1 text-xs" disabled={busy}>Salvar nome</button>
      <button type="button" className="button secondary px-2 py-1 text-xs" disabled={busy} onClick={() => { setName(column.name); setError(""); setRenaming(false); }}>Cancelar</button>
    </form> : <>
      {onReorder && <>
        <button type="button" className="button secondary px-2 py-1 text-xs" aria-label={`Mover lista ${column.name} para a esquerda`} disabled={busy || !canMoveLeft} onClick={() => void move("left")}>←</button>
        <button type="button" className="button secondary px-2 py-1 text-xs" aria-label={`Mover lista ${column.name} para a direita`} disabled={busy || !canMoveRight} onClick={() => void move("right")}>→</button>
      </>}
      <button type="button" className="button secondary px-2 py-1 text-xs" disabled={busy} onClick={() => { setName(column.name); setError(""); setRenaming(true); }}>Renomear lista</button>
      <button type="button" className="button danger px-2 py-1 text-xs" disabled={busy} onClick={() => void remove()}>Excluir lista</button>
    </>}
  </div>;
}
