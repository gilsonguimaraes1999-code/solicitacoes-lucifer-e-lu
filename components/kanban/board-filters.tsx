"use client";

import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";

export function BoardFilters({ columns, requests, selected, onChange }: { columns: BoardColumn[]; requests: RequestRecord[]; selected: string; onChange: (columnId: string) => void }) {
  return <div className="flex flex-wrap gap-2" aria-label="Filtrar colunas">
    <button type="button" className={`filter-chip ${selected === "all" ? "active" : ""}`} aria-pressed={selected === "all"} onClick={() => onChange("all")}>Todos <span>({requests.length})</span></button>
    {columns.map((column) => {
      const count = requests.filter((request) => request.column_id === column.id).length;
      const isSelected = selected === column.id;
      return <button key={column.id} type="button" className={`filter-chip ${isSelected ? "active" : ""}`} aria-pressed={isSelected} onClick={() => onChange(column.id)}>{column.name} <span>({count})</span></button>;
    })}
  </div>;
}
