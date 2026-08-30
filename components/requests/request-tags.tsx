"use client";

import { Gamepad2, ShoppingBag, TrendingUp } from "lucide-react";
import { REQUEST_TAG_LABELS, REQUEST_TAGS, type RequestTag } from "@/features/requests/tags";

const selectorTagStyles: Record<RequestTag, { idle: string; selected: string }> = {
  f1: {
    idle: "border-rose-400/20 bg-rose-500/10 text-rose-300/70 hover:border-rose-400/40 hover:text-rose-200",
    selected: "border-rose-400/55 bg-rose-500/20 text-rose-100",
  },
  loja: {
    idle: "border-amber-400/20 bg-amber-500/10 text-amber-300/70 hover:border-amber-400/40 hover:text-amber-200",
    selected: "border-amber-400/55 bg-amber-500/20 text-amber-100",
  },
  jogo: {
    idle: "border-violet-400/20 bg-violet-500/10 text-violet-300/70 hover:border-violet-400/40 hover:text-violet-200",
    selected: "border-violet-400/55 bg-violet-500/20 text-violet-100",
  },
  hub: {
    idle: "border-sky-400/20 bg-sky-500/10 text-sky-300/70 hover:border-sky-400/40 hover:text-sky-200",
    selected: "border-sky-400/55 bg-sky-500/20 text-sky-100",
  },
  growth: {
    idle: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300/70 hover:border-emerald-400/40 hover:text-emerald-200",
    selected: "border-emerald-400/55 bg-emerald-500/20 text-emerald-100",
  },
  outros: {
    idle: "border-slate-400/20 bg-slate-500/10 text-slate-300/70 hover:border-slate-400/40 hover:text-slate-200",
    selected: "border-slate-300/45 bg-slate-400/20 text-slate-100",
  },
};

function TagGlyph({ tag }: { tag: RequestTag }) {
  if (tag === "f1") return <span aria-hidden="true">🏁</span>;
  if (tag === "hub") return <span aria-hidden="true">⚙️</span>;
  if (tag === "outros") return <span aria-hidden="true">🔁</span>;
  if (tag === "loja") return <ShoppingBag aria-hidden="true" size={15} />;
  if (tag === "jogo") return <Gamepad2 aria-hidden="true" size={15} />;
  return <TrendingUp aria-hidden="true" size={15} />;
}

export function RequestTagIcons({ tags }: { tags: RequestTag[] }) {
  if (tags.length === 0) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags da solicitação">
    {tags.map((tag) => <span key={tag} aria-label={`Tag ${REQUEST_TAG_LABELS[tag]}`} title={REQUEST_TAG_LABELS[tag]} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/10 text-sm text-[#f0d77c]"><TagGlyph tag={tag} /></span>)}
  </div>;
}

export function RequestTagSelector({ value, onChange }: { value: RequestTag[]; onChange: (tags: RequestTag[]) => void }) {
  return <fieldset className="grid gap-1.5">
    <legend className="text-xs font-semibold text-white/70">Tags</legend>
    <div className="flex flex-wrap items-center gap-1.5">
      {REQUEST_TAGS.map((tag) => {
        const selected = value.includes(tag);
        const color = selectorTagStyles[tag];
        return <button key={tag} type="button" aria-label={`Tag ${REQUEST_TAG_LABELS[tag]}`} aria-pressed={selected} style={{ fontSize: "0.75rem" }} onClick={() => onChange(selected ? value.filter((item) => item !== tag) : [...value, tag])} className={`inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/45 [&_svg]:h-3.5 [&_svg]:w-3.5 ${selected ? color.selected : color.idle}`}>
          <TagGlyph tag={tag} />{REQUEST_TAG_LABELS[tag]}
        </button>;
      })}
    </div>
  </fieldset>;
}

export function RequestTagFilterIcon({ tag }: { tag: RequestTag }) {
  return <TagGlyph tag={tag} />;
}
