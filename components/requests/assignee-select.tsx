"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserRound } from "lucide-react";
import type { Profile } from "@/features/requests/types";

interface AssigneeSelectProps {
  profiles: Profile[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AssigneeSelect({ profiles, value, onChange, disabled = false }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const approvedProfiles = profiles
    .filter((profile) => profile.approval_status === "approved")
    .sort((first, second) => first.full_name.localeCompare(second.full_name, "pt-BR") || first.id.localeCompare(second.id));
  const selectedProfile = approvedProfiles.find((profile) => profile.id === value);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [open]);

  function select(profileId: string) {
    if (disabled) return;
    onChange(profileId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="field flex min-h-11 items-center justify-between gap-3 text-left font-semibold disabled:opacity-50"
        aria-label="Selecionar responsável"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
      >
        <span className="min-w-0 truncate">{selectedProfile?.full_name ?? "Selecione"}</span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-gold-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="city-options-scroll absolute z-30 mt-2 max-h-[min(20rem,calc(100vh-10rem))] w-full overflow-y-auto rounded-xl border border-[#d4af37]/30 bg-[#0c0c0c] p-1.5 shadow-2xl shadow-black/70">
          <div role="listbox" aria-label="Responsáveis disponíveis" className="grid gap-1">
            {approvedProfiles.map((profile) => {
              const selected = profile.id === value;
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="option"
                  aria-label={profile.full_name}
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => select(profile.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " " && event.key !== "Space") return;
                    event.preventDefault();
                    select(profile.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-white/[.07] hover:text-white"
                >
                  <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-[#d4af37] bg-[#d4af37] text-[#080808]" : "border-white/30 bg-white/[.03]"}`}>
                    {selected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <UserRound aria-hidden="true" size={15} className="shrink-0 text-gold-soft" />
                  <span className="min-w-0 truncate">{profile.full_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
