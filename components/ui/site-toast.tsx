"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export type ToastTone = "success" | "error";
export type ToastMessage = { text: string; tone: ToastTone };

const siteToastEvent = "site:toast";

export function notifySite(message: ToastMessage) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(siteToastEvent, { detail: message }));
}

export function ToastNotice({ text, tone, onClose, actionLabel, onAction, placement = "fixed" }: ToastMessage & { onClose: () => void; actionLabel?: string; onAction?: () => void; placement?: "fixed" | "inline" }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, tone === "success" ? 3000 : 6000);
    return () => window.clearTimeout(timeout);
  }, [onClose, text, tone]);

  const position = placement === "fixed"
    ? "fixed bottom-6 left-1/2 z-[200] w-[calc(100%_-_2rem)] -translate-x-1/2"
    : "relative mx-auto mt-5 w-full";

  return <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"} className={`${tone === "error" ? "alert-error" : "alert-success"} ${position} flex max-w-[30rem] items-start justify-between gap-4 shadow-2xl shadow-black/60`}>
    <span className="min-w-0 break-words">{text}</span>
    <span className="flex shrink-0 items-center gap-3">
      {actionLabel && onAction && <button type="button" className="font-semibold" onClick={() => { onClose(); onAction(); }}>{actionLabel}</button>}
      <button type="button" aria-label="Fechar mensagem" onClick={onClose}><X size={16} /></button>
    </span>
  </div>;
}

export function SiteToastProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Array<ToastMessage & { id: number }>>([]);

  useEffect(() => {
    let nextId = 0;
    function receive(event: Event) {
      const detail = (event as CustomEvent<ToastMessage>).detail;
      if (!detail?.text || !["success", "error"].includes(detail.tone)) return;
      setQueue((current) => [...current, { ...detail, id: nextId++ }]);
    }
    window.addEventListener(siteToastEvent, receive);
    return () => window.removeEventListener(siteToastEvent, receive);
  }, []);

  const closeCurrent = useCallback(() => setQueue((current) => current.slice(1)), []);
  const current = queue[0];

  return <>{children}{current && <ToastNotice key={current.id} text={current.text} tone={current.tone} onClose={closeCurrent} />}</>;
}
