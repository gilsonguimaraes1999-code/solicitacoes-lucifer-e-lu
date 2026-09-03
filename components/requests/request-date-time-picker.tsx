"use client";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  joinRequestLocalDateTime,
  splitRequestLocalDateTime,
  type RequestLocalDateTimeParts,
} from "@/features/requests/date";

interface RequestDateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function utcDate(year: number, monthIndex: number, day: number) {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, monthIndex, day);
  return value;
}

function displayValue(parts: RequestLocalDateTimeParts) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(parts.day)}/${pad(parts.month)}/${String(parts.year).padStart(4, "0")} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function mergeDateTimeParts(
  parts: RequestLocalDateTimeParts,
  updates: Partial<RequestLocalDateTimeParts>,
): RequestLocalDateTimeParts {
  return {
    year: updates.year ?? parts.year,
    month: updates.month ?? parts.month,
    day: updates.day ?? parts.day,
    hour: updates.hour ?? parts.hour,
    minute: updates.minute ?? parts.minute,
    second: updates.second ?? parts.second,
  };
}

export function RequestDateTimePicker({ value, onChange, disabled = false }: RequestDateTimePickerProps) {
  const parsedParts = splitRequestLocalDateTime(value);
  if (!parsedParts) throw new Error("RequestDateTimePicker exige uma data local válida.");
  const parts: RequestLocalDateTimeParts = parsedParts;

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => utcDate(parts.year, parts.month - 1, 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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

  const year = viewMonth.getUTCFullYear();
  const monthIndex = viewMonth.getUTCMonth();
  const firstWeekDay = utcDate(year, monthIndex, 1).getUTCDay();
  const daysInMonth = utcDate(year, monthIndex + 1, 0).getUTCDate();

  function moveMonth(offset: number) {
    setViewMonth(utcDate(year, monthIndex + offset, 1));
  }

  function selectDay(day: number) {
    onChange(joinRequestLocalDateTime(mergeDateTimeParts(parts, { year, month: monthIndex + 1, day })));
  }

  function updateTime(field: "hour" | "minute" | "second", rawValue: string, maximum: number) {
    if (!/^\d{1,2}$/.test(rawValue)) return;
    const nextValue = Number(rawValue);
    if (nextValue > maximum) return;
    onChange(joinRequestLocalDateTime(mergeDateTimeParts(parts, { [field]: nextValue })));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Escolher data e horário"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className="field flex w-full items-center justify-between gap-3 text-left text-white"
        onClick={() => {
          if (!open) setViewMonth(utcDate(parts.year, parts.month - 1, 1));
          setOpen((current) => !current);
        }}
      >
        <span>{displayValue(parts)}</span>
        <CalendarClock size={18} className="text-gold-soft" aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div role="dialog" aria-label="Calendário da solicitação" className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full min-w-72 rounded-2xl border border-gold/45 bg-[#0d0d0d] p-4 shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between gap-3">
            <button type="button" aria-label="Mês anterior" className="grid size-8 place-items-center rounded-lg border border-white/12 text-white/70 hover:border-gold/55 hover:text-gold-soft" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button>
            <strong className="text-sm capitalize text-white">{monthFormatter.format(viewMonth)}</strong>
            <button type="button" aria-label="Próximo mês" className="grid size-8 place-items-center rounded-lg border border-white/12 text-white/70 hover:border-gold/55 hover:text-gold-soft" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
            {weekDays.map((weekDay) => <span key={weekDay} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white/35">{weekDay}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstWeekDay + 1;
              if (day < 1 || day > daysInMonth) return <span key={`blank-${index}`} className="size-8" aria-hidden="true" />;
              const date = utcDate(year, monthIndex, day);
              const selected = parts.year === year && parts.month === monthIndex + 1 && parts.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={dayLabelFormatter.format(date)}
                  aria-pressed={selected}
                  className={`size-8 rounded-lg text-xs font-semibold transition-colors ${selected ? "bg-gold text-black" : "text-white/75 hover:bg-gold/15 hover:text-gold-soft"}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/8 pt-4">
            {([
              ["hour", "Hora", 23],
              ["minute", "Minuto", 59],
              ["second", "Segundo", 59],
            ] as const).map(([field, label, maximum]) => (
              <label key={field} className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                {label}
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={label}
                  min={0}
                  max={maximum}
                  value={String(parts[field]).padStart(2, "0")}
                  className="field h-10 px-2 text-center text-sm text-white"
                  onChange={(event) => updateTime(field, event.target.value, maximum)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
