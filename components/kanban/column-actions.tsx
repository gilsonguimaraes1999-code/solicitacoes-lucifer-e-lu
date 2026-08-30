"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  return <div className="relative" aria-label={`Ações da lista ${column.name}`}>
    {renaming ? <form className="absolute right-0 top-9 z-30 w-72 rounded-xl border border-white/10 bg-[#101010] p-3 shadow-2xl" onSubmit={rename}>
      <label className="sr-only" htmlFor={`column-name-${column.id}`}>Novo nome da lista</label>
      <input id={`column-name-${column.id}`} className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} minLength={2} maxLength={80} required />
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-3 flex justify-end gap-2"><button type="button" className="button secondary px-3 py-2 text-xs" disabled={busy} onClick={() => { setName(column.name); setError(""); setRenaming(false); }}>Cancelar</button><button type="submit" className="button px-3 py-2 text-xs" disabled={busy}>Salvar nome</button></div>
    </form> : null}
    <button type="button" className="icon-button" aria-label={`Abrir ações da lista ${column.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={18} /></button>
    {menuOpen && !renaming && <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-white/10 bg-[#101010] p-1.5 shadow-2xl">
      {error && <p role="alert" className="px-2 py-2 text-xs text-red-300">{error}</p>}
      {onReorder && <><button type="button" className="menu-action" aria-label={`Mover lista ${column.name} para a esquerda`} disabled={busy || !canMoveLeft} onClick={() => void move("left")}><ChevronLeft size={16} />Mover para a esquerda</button><button type="button" className="menu-action" aria-label={`Mover lista ${column.name} para a direita`} disabled={busy || !canMoveRight} onClick={() => void move("right")}><ChevronRight size={16} />Mover para a direita</button></>}
      <button type="button" className="menu-action" disabled={busy} onClick={() => { setName(column.name); setError(""); setMenuOpen(false); setRenaming(true); }}><Pencil size={15} />Renomear lista</button>
      <button type="button" className="menu-action danger-text" disabled={busy} onClick={() => void remove()}><Trash2 size={15} />Excluir lista</button>
    </div>}
  </div>;
}
