"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";

interface ConfirmDialogProps {
  ariaLabel: string;
  title: string;
  itemName: string;
  description: string;
  busy?: boolean;
  actionLabel?: string;
  busyActionLabel?: string;
  eyebrow?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function subscribeToPortalRoot() {
  return () => undefined;
}

function getPortalRoot(): HTMLElement | null {
  return document.body;
}

function getServerPortalRoot(): HTMLElement | null {
  return null;
}

export function ConfirmDialog({ ariaLabel, title, itemName, description, busy = false, actionLabel = "Excluir definitivamente", busyActionLabel = "Excluindo...", eyebrow = "Ação permanente", onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const portalRoot = useSyncExternalStore(subscribeToPortalRoot, getPortalRoot, getServerPortalRoot);

  useEffect(() => {
    if (!portalRoot) return;

    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (cancelRef.current ?? dialogRef.current)?.focus();

    return () => {
      if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
    };
  }, [portalRoot]);

  useEffect(() => {
    if (!portalRoot) return;

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
      if (event.key !== "Tab") return;

      const focusableElements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        dialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [busy, onCancel, portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-md"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-[#0b0b0b] shadow-[0_24px_80px_rgba(0,0,0,0.75)]">
        <div className="h-px bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
              <TriangleAlert size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#d4af37]">{eyebrow}</p>
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
              {busy ? busyActionLabel : actionLabel}
            </button>
          </div>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
