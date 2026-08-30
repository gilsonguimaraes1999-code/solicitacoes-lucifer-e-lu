"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export type BoardMessage = { text: string; tone: "success" | "error" };

export function BoardNotice({ message, onClose }: { message: BoardMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message || message.tone !== "success") return;
    const timeout = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timeout);
  }, [message, onClose]);

  if (!message) return null;

  if (message.tone === "error") {
    return <div role="alert" className="alert-error mb-4 flex items-center justify-between gap-3"><span>{message.text}</span><button type="button" aria-label="Fechar mensagem" onClick={onClose}><X size={16} /></button></div>;
  }

  return <div role="status" aria-live="polite" className="alert-success fixed bottom-6 left-1/2 z-[100] w-[calc(100%_-_2rem)] max-w-[30rem] -translate-x-1/2 gap-4 shadow-2xl shadow-black/60"><span>{message.text}</span><button type="button" aria-label="Fechar mensagem" onClick={onClose}><X size={16} /></button></div>;
}
