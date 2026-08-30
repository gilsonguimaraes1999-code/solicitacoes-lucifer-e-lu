"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  ariaLabel: string;
  title: string;
  itemName: string;
  description: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ ariaLabel, title, itemName, description, busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-[#0b0b0b] shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        <div className="h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
              <TriangleAlert size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Ação permanente</p>
              <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="truncate font-semibold text-white" title={itemName}>{itemName}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={cancelRef} type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancelar</button>
            <button type="button" className="button danger" disabled={busy} onClick={onConfirm}>
              {busy ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
