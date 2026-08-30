"use client";

import { useState } from "react";
import { MapPinned } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cityNameSchema } from "@/features/cities/schemas";
import type { CityWithCount } from "@/features/cities/types";

export function CityDialog({ city, onSave, onClose }: { city?: CityWithCount; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(city?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = cityNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe o nome da cidade.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(parsed.data);
    } catch {
      // The panel translates remote errors into the global temporary toast.
    } finally {
      setSaving(false);
    }
  }

  const title = city ? "Renomear cidade" : "Nova cidade";
  return <Modal title={title} description={city ? "Atualize o nome exibido nas solicitações." : "Cadastre uma cidade para usar nas solicitações."} onClose={onClose} size="max-w-md">
    <form onSubmit={submit} className="grid gap-5">
      <label className="label" htmlFor="city-name">Nome da cidade
        <input id="city-name" className="field" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? "city-name-error" : undefined} maxLength={120} />
      </label>
      {error && <p id="city-name-error" className="-mt-3 text-sm text-red-300" role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancelar</button>
        <button type="submit" className="button inline-flex items-center gap-2" disabled={saving}><MapPinned size={17} />{saving ? "Salvando..." : "Salvar cidade"}</button>
      </div>
    </form>
  </Modal>;
}
