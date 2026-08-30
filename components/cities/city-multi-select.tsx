"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MapPinned } from "lucide-react";
import type { City } from "@/features/cities/types";

interface CityMultiSelectProps {
  cities: City[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

function orderedCities(cities: City[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return cities
    .filter((city) => city.active || selected.has(city.id))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR") || first.id.localeCompare(second.id));
}

export function CityMultiSelect({ cities, value, onChange, disabled = false }: CityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const activeIds = cities.filter((city) => city.active).map((city) => city.id);
  const selectedActiveCount = activeIds.filter((id) => value.includes(id)).length;
  const allSelected = activeIds.length > 0 && selectedActiveCount === activeIds.length;
  const partiallySelected = selectedActiveCount > 0 && !allSelected;
  const displayCities = orderedCities(cities, value);
  const selectedCities = value.map((id) => cities.find((city) => city.id === id)).filter((city): city is City => Boolean(city));
  const summary = value.length === 0
    ? "Selecione cidades"
    : value.length === 1
      ? selectedCities[0]?.name ?? "1 cidade selecionada"
      : `${value.length} cidades selecionadas`;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

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

  function toggleOpen() {
    if (!disabled) setOpen((current) => !current);
  }

  function toggleAll() {
    onChange(
      allSelected
        ? value.filter((id) => !activeIds.includes(id))
        : [...new Set([...value, ...activeIds])],
    );
  }

  function toggleCity(city: City) {
    if (disabled) return;
    onChange(value.includes(city.id)
      ? value.filter((id) => id !== city.id)
      : [...new Set([...value, city.id])]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="field flex min-h-11 items-center justify-between gap-3 text-left font-semibold disabled:opacity-50"
        aria-label="Selecionar cidades"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggleOpen}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-gold-soft transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="city-options-scroll absolute z-30 mt-2 max-h-[min(20rem,calc(100vh-10rem))] w-full overflow-y-auto rounded-xl border border-[#d4af37]/30 bg-[#0c0c0c] p-1.5 shadow-2xl shadow-black/70"
        >
          <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-3 rounded-lg border-b border-white/10 bg-[#0c0c0c] px-3 py-2.5 text-sm font-bold text-white shadow-[0_8px_14px_-13px_rgba(0,0,0,.9)]">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="h-4 w-4 accent-[#d4af37]"
              aria-label={allSelected ? "Desmarcar todas" : "Selecionar todas"}
              aria-checked={partiallySelected ? "mixed" : allSelected ? "true" : "false"}
              checked={allSelected}
              disabled={disabled || activeIds.length === 0}
              onChange={toggleAll}
            />
            <span>{allSelected ? "Desmarcar todas" : "Selecionar todas"}</span>
          </label>

          <div role="listbox" aria-label="Cidades disponíveis" aria-multiselectable="true" className="grid gap-1 pt-1">
            {displayCities.map((city) => {
              const checked = value.includes(city.id);
              const inactive = !city.active;
              return (
                <button
                  key={city.id}
                  type="button"
                  role="option"
                  aria-label={inactive ? `${city.name} Desativada` : city.name}
                  aria-selected={checked}
                  disabled={disabled}
                  onClick={() => toggleCity(city)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " " && event.key !== "Space") return;
                    event.preventDefault();
                    toggleCity(city);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${inactive ? "bg-white/[.025] text-white/55" : "text-white/80 hover:bg-white/[.07] hover:text-white"}`}
                >
                  <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-[#d4af37] bg-[#d4af37] text-[#080808]" : "border-white/30 bg-white/[.03]"}`}>
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex min-w-0 items-center gap-2"><MapPinned aria-hidden="true" size={15} className={inactive ? "text-white/30" : "text-gold-soft"} /><span className="truncate">{city.name}</span></span>
                    {inactive && <small className="pl-6 text-xs font-semibold text-white/40">Desativada</small>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
