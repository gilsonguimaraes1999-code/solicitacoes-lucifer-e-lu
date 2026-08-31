"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastNotice } from "@/components/ui/site-toast";
import { renameColumnSchema } from "@/features/columns/schemas";
import type { BoardColumn } from "@/features/columns/types";
import { getColumnColor } from "@/features/columns/colors";

function isOccupiedColumnError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export function ColumnActions({ column, canManageColumns, canMoveLeft = false, canMoveRight = false, initialRenaming = false, onRename, onReorder, onDelete }: { column: BoardColumn; canManageColumns: boolean; canMoveLeft?: boolean; canMoveRight?: boolean; initialRenaming?: boolean; onRename: (columnId: string, name: string, color: string) => Promise<void>; onReorder?: (columnId: string, direction: "left" | "right") => Promise<void>; onDelete: (columnId: string) => Promise<void> }) {
  const [renaming, setRenaming] = useState(initialRenaming);
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(getColumnColor(column));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen && !renaming) return;

    function closeWhenOutside(event: PointerEvent) {
      if (busy || !(event.target instanceof Node) || actionsRef.current?.contains(event.target)) return;
      setMenuOpen(false);
      setRenaming(false);
      setName(column.name);
      setColor(getColumnColor(column));
      setError("");
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, column, menuOpen, renaming]);

  const canRename = column.kind !== "assignee";
  const canDelete = column.kind === "custom";

  if (!canManageColumns) return null;

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = renameColumnSchema.safeParse({ columnId: column.id, name, color });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise o nome da lista.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onRename(column.id, parsed.data.name, parsed.data.color);
      setRenaming(false);
    } catch {
      setError("Não foi possível renomear a lista. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete(column.id);
      setConfirmingDelete(false);
    } catch (caught) {
      setError(isOccupiedColumnError(caught) ? "Mova os cartões antes de excluir esta coluna." : "Não foi possível excluir a lista. Tente novamente.");
      setConfirmingDelete(false);
      setMenuOpen(true);
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: "left" | "right") {
    if (!onReorder) return;
    setMenuOpen(false);
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

  return <div ref={actionsRef} className="relative" aria-label={`Ações da lista ${column.name}`}>
    {renaming ? <form className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-white/10 bg-[#101010] p-2 shadow-2xl" onSubmit={rename}>
      {canRename && <><label className="sr-only" htmlFor={`column-name-${column.id}`}>Novo nome da lista</label><input id={`column-name-${column.id}`} className="field px-2.5 py-1.5 text-sm" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} minLength={2} maxLength={80} required /></>}
      <label className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-white/60">Cor<input aria-label="Cor da lista" type="color" className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent p-0.5" value={color} onChange={(event) => setColor(event.target.value)} disabled={busy} /></label>
      {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} />}
      <div className="mt-2 flex justify-end gap-1.5"><button type="button" className="inline-flex h-7 items-center rounded-full border border-white/12 bg-white/[.06] px-2.5 text-xs font-semibold text-white/75" disabled={busy} onClick={() => { setName(column.name); setColor(getColumnColor(column)); setError(""); setRenaming(false); }}>Cancelar</button><button type="submit" className="inline-flex h-7 items-center rounded-full border border-[#d4af37]/30 bg-[#d4af37] px-2.5 text-xs font-bold text-black" disabled={busy}>Salvar</button></div>
    </form> : null}
    <button ref={triggerRef} type="button" className="column-actions-trigger" aria-label={`Abrir ações da lista ${column.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={18} /></button>
    {menuOpen && !renaming && <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-white/10 bg-[#101010] p-1.5 shadow-2xl">
      {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} />}
      {onReorder && <><button type="button" className="menu-action" aria-label={`Mover lista ${column.name} para a esquerda`} disabled={busy || !canMoveLeft} onClick={() => void move("left")}><ChevronLeft size={16} />Mover para a esquerda</button><button type="button" className="menu-action" aria-label={`Mover lista ${column.name} para a direita`} disabled={busy || !canMoveRight} onClick={() => void move("right")}><ChevronRight size={16} />Mover para a direita</button></>}
      <button type="button" className="menu-action" disabled={busy} onClick={() => { setName(column.name); setColor(getColumnColor(column)); setError(""); setMenuOpen(false); setRenaming(true); }}><Pencil size={15} />{canRename ? "Renomear lista" : "Editar cor"}</button>
      {canDelete ? <button type="button" className="menu-action danger-text" disabled={busy} onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}><Trash2 size={15} />Excluir lista</button> : null}
    </div>}
    {canDelete && confirmingDelete && <ConfirmDialog ariaLabel="Confirmar exclusão da lista" title="Excluir lista?" itemName={column.name} description="A lista será removida permanentemente. Só é possível excluir listas que não possuem solicitações." busy={busy} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void remove()} />}
  </div>;
}
