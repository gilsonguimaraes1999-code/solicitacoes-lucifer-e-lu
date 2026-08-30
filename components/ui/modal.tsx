"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, description, onClose, children, size = "max-w-2xl" }: { title: string; description?: string; onClose: () => void; children: ReactNode; size?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const selector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
    const focusables = () => Array.from(dialog?.querySelectorAll<HTMLElement>(selector) ?? []);
    requestAnimationFrame(() => focusables()[0]?.focus());
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); previousFocus?.focus(); };
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal-card ${size}`}>
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
        <div><p className="eyebrow">Gerenciamento</p><h2 id={titleId} className="mt-1 text-xl font-bold text-white">{title}</h2>{description && <p className="mt-1 text-sm text-white/55">{description}</p>}</div>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="max-h-[75vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
    </section>
  </div>;
}
