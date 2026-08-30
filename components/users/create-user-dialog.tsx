"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ToastNotice } from "@/components/ui/site-toast";

export function CreateUserDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (value: { fullName: string; email: string; password: string }) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onCreate({ fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Nova conta" description="A conta será criada pronta para aprovação e configuração." onClose={onClose} size="max-w-xl">
    <form onSubmit={submit} className="grid gap-4">
      <label className="label">Nome completo<input className="field" name="fullName" required minLength={2} maxLength={120} disabled={busy} /></label>
      <label className="label">E-mail<input className="field" name="email" type="email" required disabled={busy} /></label>
      <label className="label">Senha temporária<input className="field" name="password" type="password" minLength={8} maxLength={72} required disabled={busy} /></label>
      {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} />}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="button inline-flex items-center gap-2" disabled={busy}><UserPlus size={17} />{busy ? "Criando..." : "Criar conta"}</button></div>
    </form>
  </Modal>;
}

