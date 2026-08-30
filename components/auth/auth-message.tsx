"use client";

import { useState } from "react";
import { ToastNotice } from "@/components/ui/site-toast";

export function AuthMessage({ error, success }: { error?: string; success?: string }) {
  const [visible, setVisible] = useState(true);
  const text = error ?? success;
  if (!text || !visible) return null;
  return <ToastNotice text={text} tone={error ? "error" : "success"} onClose={() => setVisible(false)} />;
}

