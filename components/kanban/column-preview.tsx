import type { BoardColumn } from "@/features/columns/types";

export function ColumnPreview({ column, requestCount }: { column: BoardColumn; requestCount: number }) {
  return (
    <section className="w-[min(320px,calc(100vw-2rem))] rotate-[1deg] rounded-2xl border border-[#d4af37]/45 bg-[#171717] p-3 shadow-[0_20px_55px_rgba(0,0,0,0.7)] ring-1 ring-[#d4af37]/20">
      <header className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate font-black text-white">{column.name}</h2>
        <span className="text-xs font-semibold text-white/45">{requestCount}</span>
      </header>
      <p className="mt-3 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-white/35">Prévia da lista</p>
    </section>
  );
}
