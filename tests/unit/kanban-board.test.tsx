import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "@/features/columns/types";
import type { City } from "@/features/cities/types";
import type { EffectivePermissions, RequestRecord } from "@/features/requests/types";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  createBoardColumn: vi.fn(),
  renameBoardColumn: vi.fn(),
  reorderBoardColumn: vi.fn(),
  deleteBoardColumn: vi.fn(),
  columnChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => void,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({ channel: mocks.channel, removeChannel: mocks.removeChannel }),
}));

vi.mock("@/features/columns/api", () => ({
  createBoardColumn: mocks.createBoardColumn,
  renameBoardColumn: mocks.renameBoardColumn,
  reorderBoardColumn: mocks.reorderBoardColumn,
  deleteBoardColumn: mocks.deleteBoardColumn,
}));

import { KanbanBoard } from "@/components/kanban/kanban-board";

const columns: BoardColumn[] = [
  { id: "column-pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1024, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2048, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3072, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-lucifer", name: "Lucifer", kind: "assignee", system_key: null, assignee_id: "profile-lucifer", position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const cities: City[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Santa Luzia", active: true, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const requests: RequestRecord[] = [
  { id: "request-1", title: "Pedido pendente", description: null, cities, assigned_to: "profile-lucifer", external_url: null, tags: [], status: "pending", column_id: "column-pending", position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "profile-lucifer", full_name: "Lucifer" } },
  { id: "request-2", title: "Pedido do responsável", description: null, cities, assigned_to: "profile-lucifer", external_url: null, tags: [], status: null, column_id: "column-lucifer", position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "profile-lucifer", full_name: "Lucifer" } },
];

const permissions: EffectivePermissions = { canCreate: false, canEdit: false, canMove: false, canDelete: false, canManageColumns: false, canManageCities: false };

const brunoProfileId = "22222222-2222-4222-8222-222222222222";
const brunoColumn: BoardColumn = { id: "column-bruno", name: "Bruno", kind: "assignee", system_key: null, assignee_id: brunoProfileId, position: 5120, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function emitColumnChange(eventType: "INSERT" | "UPDATE" | "DELETE", column: BoardColumn) {
  act(() => {
    mocks.columnChange({ eventType, old: eventType === "DELETE" ? { id: column.id } : {}, new: eventType === "DELETE" ? {} : column as unknown as Record<string, unknown> });
  });
}

beforeEach(() => {
  mocks.createBoardColumn.mockReset();
  mocks.renameBoardColumn.mockReset();
  mocks.reorderBoardColumn.mockReset();
  mocks.deleteBoardColumn.mockReset();
  mocks.channel.mockReset();
  mocks.removeChannel.mockReset();
  mocks.channel.mockImplementation((name: string) => {
    const channel = {
      on: vi.fn((_event: string, _filter: Record<string, unknown>, callback: typeof mocks.columnChange) => {
        if (name === "board-columns") mocks.columnChange = callback;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return channel;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanBoard", () => {
  it("inicializa solicitações e colunas pelos snapshots ordenados dos reducers", () => {
    const laterPending = { ...requests[0], id: "request-later", title: "Pedido posterior", position: 2048 };
    const earlierPending = { ...requests[0], id: "request-earlier", title: "Pedido anterior", position: 512 };
    render(<KanbanBoard initialRequests={[laterPending, requests[1], earlierPending]} initialColumns={[brunoColumn, ...columns].reverse()} cities={cities} profiles={[]} currentUserId="owner" permissions={permissions} />);

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Lucifer", "Bruno"]);
    const pendingSection = screen.getByRole("heading", { level: 2, name: "Pendente" }).closest("section");
    expect(pendingSection).not.toBeNull();
    expect(within(pendingSection!).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Pedido anterior", "Pedido posterior"]);
  });

  it("mostra somente a coluna escolhida e restaura o quadro completo em Todos", () => {
    render(<KanbanBoard initialRequests={requests} initialColumns={columns} cities={cities} profiles={[]} currentUserId="owner" permissions={permissions} />);

    expect(screen.getByPlaceholderText("Título, cidade ou responsável")).toHaveStyle({ paddingLeft: "2.75rem" });
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Lucifer"]);

    fireEvent.click(screen.getByRole("button", { name: "Pendente (1)" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente"]);

    fireEvent.click(screen.getByRole("button", { name: "Lucifer (1)" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Lucifer"]);

    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Lucifer"]);
  });

  it("cria a lista após as colunas existentes quando há permissão", async () => {
    const profileId = "22222222-2222-4222-8222-222222222222";
    const created: BoardColumn = { id: "column-bruno", name: "Bruno", kind: "assignee", system_key: null, assignee_id: profileId, position: 5120, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };
    mocks.createBoardColumn.mockResolvedValue(created);
    render(<KanbanBoard initialRequests={requests} initialColumns={columns} cities={cities} profiles={[{ id: profileId, full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" }]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profileId } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    await waitFor(() => expect(mocks.createBoardColumn).toHaveBeenCalledWith("Bruno", profileId, 5120));
    expect(await screen.findByText("Lista adicionada.")).toBeInTheDocument();
  });

  it("move uma coluna personalizada por uma posição visível, atravessando as colunas fixas", async () => {
    mocks.reorderBoardColumn.mockResolvedValue({ ...columns[3], position: 2560 });
    render(<KanbanBoard initialRequests={requests} initialColumns={[...columns, brunoColumn]} cities={cities} profiles={[]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Lucifer" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover lista Lucifer para a esquerda" }));

    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith("column-lucifer", 2560));
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Lucifer", "Concluído", "Bruno"]);
    expect(screen.queryByRole("button", { name: /Mover lista Pendente/ })).not.toBeInTheDocument();
    expect(screen.getByText("Lista reordenada.")).toBeInTheDocument();
  });

  it("reverte a ordem otimista e informa o erro quando a RPC de reordenação falha", async () => {
    const reorder = deferred<BoardColumn>();
    mocks.reorderBoardColumn.mockReturnValue(reorder.promise);
    render(<KanbanBoard initialRequests={requests} initialColumns={[...columns, brunoColumn]} cities={cities} profiles={[]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Lucifer" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover lista Lucifer para a direita" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Bruno", "Lucifer"]));
    await act(async () => {
      reorder.reject(new Error("offline"));
      await reorder.promise.catch(() => undefined);
    });

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Lucifer", "Bruno"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reordenar a lista. A ordem anterior foi restaurada.");
    expect(screen.getByRole("alert")).toHaveClass("fixed", "bottom-6", "left-1/2");
  });

  it("preserva a ordem confirmada por Realtime quando a resposta da RPC de reordenação falha", async () => {
    const reorder = deferred<BoardColumn>();
    const confirmed = { ...columns[3], position: 6144 };
    mocks.reorderBoardColumn.mockReturnValue(reorder.promise);
    render(<KanbanBoard initialRequests={requests} initialColumns={[...columns, brunoColumn]} cities={cities} profiles={[]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Lucifer" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover lista Lucifer para a direita" }));
    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledOnce());
    emitColumnChange("UPDATE", confirmed);
    await act(async () => {
      reorder.reject(new Error("resposta perdida"));
      await reorder.promise.catch(() => undefined);
    });

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Pendente", "Em progresso", "Concluído", "Bruno", "Lucifer"]);
    expect(screen.getByText("Lista reordenada.")).toBeInTheDocument();
    expect(screen.queryByText(/ordem anterior foi restaurada/i)).not.toBeInTheDocument();
  });

  it("não ressuscita uma coluna excluída antes da resposta atrasada de criação", async () => {
    const create = deferred<BoardColumn>();
    mocks.createBoardColumn.mockReturnValue(create.promise);
    render(<KanbanBoard initialRequests={requests} initialColumns={columns} cities={cities} profiles={[{ id: brunoProfileId, full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" }]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: brunoProfileId } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));
    await waitFor(() => expect(mocks.createBoardColumn).toHaveBeenCalledOnce());
    emitColumnChange("INSERT", brunoColumn);
    emitColumnChange("DELETE", brunoColumn);
    await act(async () => {
      create.resolve(brunoColumn);
      await create.promise;
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Bruno" })).not.toBeInTheDocument();
    expect(screen.queryByText("Lista adicionada.")).not.toBeInTheDocument();
  });

  it("não ressuscita uma coluna excluída antes da resposta atrasada de renomeação", async () => {
    const rename = deferred<BoardColumn>();
    const renamedColumn = { ...columns[3], id: "33333333-3333-4333-8333-333333333333" };
    mocks.renameBoardColumn.mockReturnValue(rename.promise);
    render(<KanbanBoard initialRequests={requests} initialColumns={[...columns.slice(0, 3), renamedColumn]} cities={cities} profiles={[]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Lucifer" }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear lista" }));
    fireEvent.change(screen.getByLabelText("Novo nome da lista"), { target: { value: "Nome atrasado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() => expect(mocks.renameBoardColumn).toHaveBeenCalledOnce());
    emitColumnChange("DELETE", renamedColumn);
    await act(async () => {
      rename.resolve({ ...renamedColumn, name: "Nome atrasado" });
      await rename.promise;
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Nome atrasado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Lucifer" })).not.toBeInTheDocument();
    expect(screen.queryByText("Lista renomeada.")).not.toBeInTheDocument();
  });

  it("ignora INSERT ou UPDATE Realtime fora de ordem após DELETE da coluna", () => {
    render(<KanbanBoard initialRequests={requests} initialColumns={columns} cities={cities} profiles={[]} currentUserId="owner" permissions={{ ...permissions, canManageColumns: true }} />);

    emitColumnChange("DELETE", columns[3]);
    emitColumnChange("UPDATE", { ...columns[3], name: "Coluna obsoleta" });

    expect(screen.queryByRole("heading", { level: 2, name: "Coluna obsoleta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Lucifer" })).not.toBeInTheDocument();
  });
});
