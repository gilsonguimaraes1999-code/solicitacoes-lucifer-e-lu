"use client";

import { Gamepad2, ShoppingBag, TrendingUp } from "lucide-react";
import { REQUEST_TAG_LABELS, REQUEST_TAGS, type RequestTag } from "@/features/requests/tags";

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
  return <fieldset className="grid gap-2">
    <legend className="label">Tags</legend>
    <div className="flex flex-wrap gap-2">
      {REQUEST_TAGS.map((tag) => {
        const selected = value.includes(tag);
        return <button key={tag} type="button" aria-label={`Tag ${REQUEST_TAG_LABELS[tag]}`} aria-pressed={selected} onClick={() => onChange(selected ? value.filter((item) => item !== tag) : [...value, tag])} className={`filter-chip ${selected ? "active" : ""}`}>
          <TagGlyph tag={tag} />{REQUEST_TAG_LABELS[tag]}
        </button>;
      })}
    </div>
  </fieldset>;
}

export function RequestTagFilterIcon({ tag }: { tag: RequestTag }) {
  return <TagGlyph tag={tag} />;
}
