"use client";

import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";
import { RequestTagFilterIcon } from "@/components/requests/request-tags";
import { REQUEST_TAG_LABELS, REQUEST_TAGS, type RequestTag } from "@/features/requests/tags";

export function BoardFilters({ columns, requests, selected, onChange, selectedTags = [], onTagChange = () => undefined }: { columns: BoardColumn[]; requests: RequestRecord[]; selected: string; onChange: (columnId: string) => void; selectedTags?: RequestTag[]; onTagChange?: (tags: RequestTag[]) => void }) {
  return <div className="grid gap-2.5">
    <div className="flex flex-wrap gap-2" aria-label="Filtrar colunas">
      <button type="button" className={`filter-chip ${selected === "all" ? "active" : ""}`} aria-pressed={selected === "all"} onClick={() => onChange("all")}>Todos <span>({requests.length})</span></button>
      {columns.map((column) => {
        const count = requests.filter((request) => request.column_id === column.id).length;
        const isSelected = selected === column.id;
        return <button key={column.id} type="button" className={`filter-chip ${isSelected ? "active" : ""}`} aria-pressed={isSelected} onClick={() => onChange(column.id)}>{column.name} <span>({count})</span></button>;
      })}
    </div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar tags">
      <span className="px-1 text-[.68rem] font-black uppercase tracking-[.16em] text-white/35">Tags</span>
      {REQUEST_TAGS.map((tag) => {
        const selectedTag = selectedTags.includes(tag);
        const count = requests.filter((request) => request.tags?.includes(tag)).length;
        const next = selectedTag ? selectedTags.filter((item) => item !== tag) : [...selectedTags, tag];
        return <button key={tag} type="button" className={`filter-chip ${selectedTag ? "active" : ""}`} aria-pressed={selectedTag} onClick={() => onTagChange(next)}><RequestTagFilterIcon tag={tag} />{REQUEST_TAG_LABELS[tag]} <span>({count})</span></button>;
      })}
    </div>
  </div>;
}
