"use client";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];
const POPOVER_WIDTH = 260;
const POPOVER_HEIGHT = 280;
const VIEWPORT_PADDING = 8;
const POPOVER_GAP = 8;

interface PopoverPosition {
  left: number;
  top: number;
}

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

function calculatePopoverPosition(rect: DOMRect): PopoverPosition {
  const availableWidth = Math.max(0, window.innerWidth - VIEWPORT_PADDING * 2);
  const effectiveWidth = Math.min(POPOVER_WIDTH, availableWidth);
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, rect.right - effectiveWidth),
    Math.max(VIEWPORT_PADDING, window.innerWidth - VIEWPORT_PADDING - effectiveWidth),
  );
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
  const openAbove = spaceBelow < POPOVER_HEIGHT && rect.top > spaceBelow;
  const desiredTop = openAbove
    ? rect.top - POPOVER_GAP - POPOVER_HEIGHT
    : rect.bottom + POPOVER_GAP;
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, desiredTop),
    Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - POPOVER_HEIGHT),
  );
  return { left, top };
}

export function RequestDateTimePicker({ value, onChange, disabled = false }: RequestDateTimePickerProps) {
  const parsedParts = splitRequestLocalDateTime(value);
  if (!parsedParts) throw new Error("RequestDateTimePicker exige uma data local válida.");
  const parts: RequestLocalDateTimeParts = parsedParts;

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => utcDate(parts.year, parts.month - 1, 1));
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    const reposition = () => {
      if (triggerRef.current) setPopoverPosition(calculatePopoverPosition(triggerRef.current.getBoundingClientRect()));
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
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
          if (!open) {
            setViewMonth(utcDate(parts.year, parts.month - 1, 1));
            setPopoverPosition(calculatePopoverPosition(triggerRef.current!.getBoundingClientRect()));
          }
          setOpen((current) => !current);
        }}
      >
        <span>{displayValue(parts)}</span>
        <CalendarClock size={18} className="text-gold-soft" aria-hidden="true" />
      </button>

      {open && !disabled && popoverPosition && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Calendário da solicitação"
          className="fixed z-[320] w-[260px] max-w-[calc(100vw-1rem)] rounded-xl border border-gold/55 bg-[#0d0d0d] p-2.5 shadow-xl shadow-black/70"
          style={{ left: popoverPosition.left, top: popoverPosition.top }}
        >
          <div className="flex h-7 items-center justify-between gap-2">
            <button type="button" aria-label="Mês anterior" className="grid size-7 place-items-center rounded-md text-white/65 hover:bg-gold/10 hover:text-gold-soft" onClick={() => moveMonth(-1)}><ChevronLeft size={15} /></button>
            <strong className="text-xs text-white">
              <span aria-hidden="true">{monthLabels[monthIndex]} {year}</span>
              <span className="sr-only">{monthFormatter.format(viewMonth)}</span>
            </strong>
            <button type="button" aria-label="Próximo mês" className="grid size-7 place-items-center rounded-md text-white/65 hover:bg-gold/10 hover:text-gold-soft" onClick={() => moveMonth(1)}><ChevronRight size={15} /></button>
          </div>

          <div className="mt-1 grid grid-cols-7 place-items-center gap-0.5" aria-hidden="true">
            {weekDays.map((weekDay, index) => <span key={`${weekDay}-${index}`} className="grid size-6 place-items-center text-[9px] font-bold text-white/35">{weekDay}</span>)}
          </div>
          <div className="grid grid-cols-7 place-items-center gap-0.5">
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstWeekDay + 1;
              if (day < 1 || day > daysInMonth) return <span key={`blank-${index}`} className="size-6" aria-hidden="true" />;
              const date = utcDate(year, monthIndex, day);
              const selected = parts.year === year && parts.month === monthIndex + 1 && parts.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={dayLabelFormatter.format(date)}
                  aria-pressed={selected}
                  className={`size-6 rounded-full text-[11px] font-semibold transition-colors ${selected ? "bg-gold text-black" : "text-white/75 hover:bg-gold/15 hover:text-gold-soft"}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-white/8 pt-2">
            {([
              ["hour", "Hora", "Hora", 23],
              ["minute", "Minuto", "Min", 59],
              ["second", "Segundo", "Seg", 59],
            ] as const).map(([field, label, shortLabel, maximum]) => (
              <label key={field} className="grid gap-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white/40">
                {shortLabel}
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={label}
                  min={0}
                  max={maximum}
                  value={String(parts[field]).padStart(2, "0")}
                  className="field h-8 px-1 text-center text-xs text-white"
                  onChange={(event) => updateTime(field, event.target.value, maximum)}
                />
              </label>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
