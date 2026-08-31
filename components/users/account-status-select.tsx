"use client";

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ApprovalStatus } from "@/features/requests/types";

const accountStatusOptions = [
  { value: "pending", label: "Pendente" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "suspended", label: "Suspensa" },
] as const satisfies ReadonlyArray<{ value: ApprovalStatus; label: string }>;

interface AccountStatusSelectProps {
  value: ApprovalStatus;
  onChange: (value: ApprovalStatus) => void;
  disabled?: boolean;
}

function labelForStatus(value: ApprovalStatus) {
  return accountStatusOptions.find((option) => option.value === value)?.label ?? "Pendente";
}

interface MenuState {
  open: boolean;
  revision: number;
}

type MenuAction = { type: "open" } | { type: "close" };

function menuStateReducer(state: MenuState, action: MenuAction): MenuState {
  if (action.type === "open") return { open: true, revision: state.revision + 1 };
  if (!state.open) return state;
  return { ...state, open: false };
}

function createBooleanStore(initialValue: boolean) {
  let currentValue = initialValue;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => currentValue,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (nextValue: boolean) => {
      if (currentValue === nextValue) return;
      currentValue = nextValue;
      listeners.forEach((listener) => listener());
    },
  };
}

function getClosedServerSnapshot() {
  return false;
}

export function AccountStatusSelect({ value, onChange, disabled = false }: AccountStatusSelectProps) {
  const [menuState, dispatch] = useReducer(menuStateReducer, { open: false, revision: 0 });
  const [openInvalidationStore] = useState(() => createBooleanStore(false));
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);
  const focusRestoreTimeoutRef = useRef<number | null>(null);
  const selectedLabel = labelForStatus(value);
  const openInvalidated = useSyncExternalStore(
    openInvalidationStore.subscribe,
    openInvalidationStore.getSnapshot,
    getClosedServerSnapshot,
  );
  const isOpen = menuState.open && !disabled && !openInvalidated;

  const clearPendingFocusRestore = useCallback(() => {
    if (focusRestoreTimeoutRef.current === null) return;
    window.clearTimeout(focusRestoreTimeoutRef.current);
    focusRestoreTimeoutRef.current = null;
  }, []);

  const restoreTriggerFocusSoon = useCallback(() => {
    clearPendingFocusRestore();
    focusRestoreTimeoutRef.current = window.setTimeout(() => {
      focusRestoreTimeoutRef.current = null;
      if (!mountedRef.current || disabled || !triggerRef.current?.isConnected) return;
      triggerRef.current.focus();
    }, 0);
  }, [clearPendingFocusRestore, disabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPendingFocusRestore();
    };
  }, [clearPendingFocusRestore]);

  const closeMenu = useCallback(() => {
    openInvalidationStore.set(false);
    dispatch({ type: "close" });
  }, [openInvalidationStore]);

  useEffect(() => {
    if (!isOpen) return;

    const closeFromOutside = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      closeMenu();
      restoreTriggerFocusSoon();
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearPendingFocusRestore();
      closeMenu();
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromEscape);
    };
  }, [clearPendingFocusRestore, closeMenu, isOpen, restoreTriggerFocusSoon]);

  useEffect(() => {
    if (!disabled || !menuState.open) return;
    openInvalidationStore.set(true);
    clearPendingFocusRestore();
  }, [clearPendingFocusRestore, disabled, menuState.open, openInvalidationStore]);

  function select(nextValue: ApprovalStatus) {
    if (disabled) return;
    clearPendingFocusRestore();
    closeMenu();
    onChange(nextValue);
    triggerRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="field flex min-h-11 items-center justify-between gap-3 text-left font-semibold disabled:opacity-50"
        aria-label={`Status da conta: ${selectedLabel}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          clearPendingFocusRestore();
          openInvalidationStore.set(false);
          dispatch({ type: isOpen ? "close" : "open" });
        }}
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-gold-soft transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="city-options-scroll absolute z-30 mt-2 max-h-[min(20rem,calc(100vh-10rem))] w-full overflow-y-auto rounded-xl border border-[#d4af37]/30 bg-[#0c0c0c] p-1.5 shadow-2xl shadow-black/70">
          <div role="listbox" aria-label="Status da conta disponível" className="grid gap-1">
            {accountStatusOptions.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-label={option.label}
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => select(option.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " " && event.key !== "Space") return;
                    event.preventDefault();
                    select(option.value);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-white/[.07] hover:text-white"
                >
                  <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? "border-[#d4af37] bg-[#d4af37] text-[#080808]" : "border-white/30 bg-white/[.03]"}`}>
                    {selected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
