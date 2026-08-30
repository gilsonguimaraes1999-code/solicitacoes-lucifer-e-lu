"use client";

import { ToastNotice } from "@/components/ui/site-toast";

export type BoardMessage = { text: string; tone: "success" | "error" };

export function BoardNotice({ message, onClose }: { message: BoardMessage | null; onClose: () => void }) {
  if (!message) return null;
  return <ToastNotice text={message.text} tone={message.tone} onClose={onClose} />;
}

