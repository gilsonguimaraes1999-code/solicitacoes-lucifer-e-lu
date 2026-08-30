import { describe, expect, it } from "vitest";
import { columnsReducer } from "@/features/columns/reducer";
import { filterBoard } from "@/features/requests/filter";
import type { BoardColumn } from "@/features/columns/types";
import type { City } from "@/features/cities/types";
import type { RequestRecord } from "@/features/requests/types";

const santaLuzia: City = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Santa Luzia", active: true, created_by: "creator", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };
const beloHorizonte: City = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Belo Horizonte", active: true, created_by: "creator", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };

const columns: BoardColumn[] = [
  { id: "assignee-z", name: "Zoe", kind: "assignee", system_key: null, assignee_id: "assignee-z", position: 9, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "assignee-a", name: "Ana", kind: "assignee", system_key: null, assignee_id: "assignee-a", position: 9, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const requests: RequestRecord[] = [
  { id: "request-1", title: "Pedido de acesso", description: null, cities: [santaLuzia], assigned_to: "assignee-z", external_url: null, tags: ["loja", "growth"], status: "pending", column_id: "assignee-z", position: 1024, created_by: "creator", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "assignee-z", full_name: "Lucifer" } },
  { id: "request-2", title: "Outro cartão", description: null, cities: [beloHorizonte], assigned_to: "assignee-a", external_url: null, tags: ["jogo"], status: "completed", column_id: "completed", position: 1024, created_by: "creator", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "assignee-a", full_name: "Ana" } },
];

describe("columnsReducer", () => {
  it("reconcilia snapshot e eventos repetidos por id em ordem determinística", () => {
    const snapshot = columnsReducer([], { type: "snapshot", columns: [...columns, columns[0]] });
    expect(snapshot.map((column) => column.id)).toEqual(["pending", "progress", "completed", "assignee-a", "assignee-z"]);

    const once = columnsReducer(snapshot, { type: "insert", column: columns[3] });
    expect(columnsReducer(once, { type: "update", column: columns[3] })).toEqual(once);
    expect(columnsReducer(once, { type: "delete", id: "assignee-a" }).map((column) => column.id)).not.toContain("assignee-a");
    expect(columnsReducer(once, { type: "delete", id: "missing" })).toEqual(once);
    expect(columnsReducer(once, { type: "snapshot", columns: [columns[2]] })).toEqual([columns[2]]);
  });

  it("intercala responsáveis pela posição sem alterar a ordem relativa dos status fixos", () => {
    const betweenPendingAndProgress = { ...columns[3], position: 1.5 };
    const beforePending = { ...columns[0], position: 0.5 };

    expect(columnsReducer([], { type: "snapshot", columns: [columns[1], columns[2], columns[4], betweenPendingAndProgress, beforePending] }).map((column) => column.id)).toEqual([
      "assignee-z",
      "pending",
      "assignee-a",
      "progress",
      "completed",
    ]);
  });

  it("mantém chaves de sistema desconhecidas depois das chaves válidas", () => {
    const unknownSystemColumn = {
      ...columns[0],
      id: "unknown-system",
      kind: "system",
      system_key: null,
      position: 0,
    } as unknown as BoardColumn;

    expect(columnsReducer([], { type: "snapshot", columns: [unknownSystemColumn, columns[1], columns[2], columns[4]] }).map((column) => column.id)).toEqual([
      "pending",
      "progress",
      "completed",
      "unknown-system",
    ]);
  });
});

describe("filterBoard", () => {
  it("filtra primeiro a coluna e depois os campos pesquisáveis normalizados", () => {
    expect(filterBoard(requests, "assignee-z", "pedido")).toEqual([requests[0]]);
    expect(filterBoard(requests, "all", "  lUcIfEr ")).toEqual([requests[0]]);
    expect(filterBoard(requests, "completed", "belo horizonte")).toEqual([requests[1]]);
  });

  it("combina coluna, pesquisa e qualquer uma das tags selecionadas", () => {
    expect(filterBoard(requests, "all", "", ["growth", "jogo"])).toEqual(requests);
    expect(filterBoard(requests, "assignee-z", "lucifer", ["loja"])).toEqual([requests[0]]);
    expect(filterBoard(requests, "completed", "", ["growth"])).toEqual([]);
  });
});
