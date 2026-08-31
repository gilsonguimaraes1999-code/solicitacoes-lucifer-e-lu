import type { ReactNode } from "react";
import type { Announcements, DragEndEvent, ScreenReaderInstructions } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "@/features/columns/types";
import type { City } from "@/features/cities/types";
import type { EffectivePermissions, Profile, RequestRecord } from "@/features/requests/types";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  moveRequest: vi.fn(),
  getRequest: vi.fn(),
  deleteRequest: vi.fn(),
  createBoardColumn: vi.fn(),
  getBoardColumn: vi.fn(),
  renameBoardColumn: vi.fn(),
  reorderBoardColumn: vi.fn(),
  deleteBoardColumn: vi.fn(),
  closestCenter: vi.fn(() => []),
  collisionDetection: undefined as unknown as (args: Record<string, unknown>) => unknown,
  sortableContexts: [] as Array<{ items: string[]; strategy: unknown }>,
  dragEnd: undefined as unknown as (event: DragEndEvent) => Promise<void>,
  dragStart: undefined as unknown as (event: { active: { id: string; data?: { current?: Record<string, unknown> } } }) => void,
  dragCancel: undefined as unknown as () => void,
  sensors: [] as Array<{ options?: { activationConstraint?: { distance?: number } } }>,
  requestChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => Promise<void>,
  cityChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => void,
  requestCityChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => Promise<void>,
  columnChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => void,
  accessibility: undefined as unknown as { announcements?: Announcements; screenReaderInstructions?: ScreenReaderInstructions },
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...original,
    closestCenter: mocks.closestCenter,
    DndContext: ({ children, onDragStart, onDragCancel, onDragEnd, accessibility, sensors, collisionDetection }: { children: ReactNode; onDragStart?: (event: { active: { id: string; data?: { current?: Record<string, unknown> } } }) => void; onDragCancel?: () => void; onDragEnd: (event: DragEndEvent) => Promise<void>; accessibility?: { announcements?: Announcements; screenReaderInstructions?: ScreenReaderInstructions }; sensors?: Array<{ options?: { activationConstraint?: { distance?: number } } }>; collisionDetection: (args: Record<string, unknown>) => unknown }) => {
      mocks.dragEnd = onDragEnd;
      mocks.dragStart = onDragStart ?? (() => undefined);
      mocks.dragCancel = onDragCancel ?? (() => undefined);
      mocks.sensors = sensors ?? [];
      mocks.accessibility = accessibility ?? {};
      mocks.collisionDetection = collisionDetection;
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: ReactNode }) => children ? <div data-testid="drag-overlay">{children}</div> : null,
  };
});

vi.mock("@/components/kanban/kanban-column", () => ({
  KanbanColumn: ({ column, requests, onOpen }: { column: BoardColumn; requests: RequestRecord[]; onOpen: (request: RequestRecord) => void }) => (
    <section aria-label={`Lista ${column.name}`}>
      <h2>{column.name}</h2>
      {requests.map((request) => <div key={request.id}><button type="button" onClick={() => onOpen(request)}>{request.title}</button><span>{request.assignee?.full_name ?? "—"}</span><span>{request.cities.length === 1 ? "Cidade" : "Cidades"}: {request.cities.map((city) => city.name).join(", ")}</span><span data-testid={`position-${request.id}`}>{request.position}</span></div>)}
    </section>
  ),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    from: () => ({
      select: () => ({
        eq: (_column: string, requestId: string) => ({
          single: async () => {
            try { return { data: await mocks.getRequest(requestId), error: null }; }
            catch (error) { return { data: null, error }; }
          },
        }),
      }),
    }),
  }),
}));

vi.mock("@/features/requests/api", () => ({
  createRequest: mocks.createRequest,
  updateRequest: mocks.updateRequest,
  moveRequest: mocks.moveRequest,
  getRequest: mocks.getRequest,
  deleteRequest: mocks.deleteRequest,
}));

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...original,
    SortableContext: ({ children, items, strategy }: { children: ReactNode; items: Array<string | { id: string }>; strategy: unknown }) => {
      mocks.sortableContexts.push({ items: items.map((item) => typeof item === "string" ? item : item.id), strategy });
      return <>{children}</>;
    },
  };
});

vi.mock("@/features/columns/api", () => ({
  createBoardColumn: mocks.createBoardColumn,
  getBoardColumn: mocks.getBoardColumn,
  renameBoardColumn: mocks.renameBoardColumn,
  reorderBoardColumn: mocks.reorderBoardColumn,
  deleteBoardColumn: mocks.deleteBoardColumn,
}));

import { KanbanBoard } from "@/components/kanban/kanban-board";

const profiles: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Lucifer", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const cities: City[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Santa Luzia", active: true, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Belo Horizonte", active: true, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const columns: BoardColumn[] = [
  { id: "column-pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1024, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2048, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3072, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-lucifer", name: "Lucifer", kind: "assignee", system_key: null, assignee_id: profiles[0].id, position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const sourceRequest: RequestRecord = {
  id: "request-source",
  title: "Pedido do responsável",
  description: null,
  cities: [cities[0]],
  assigned_to: profiles[0].id,
  external_url: null,
  tags: ["hub"],
  status: null,
  column_id: "column-lucifer",
  position: 4096,
  created_by: "owner",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
  assignee: { id: profiles[0].id, full_name: profiles[0].full_name },
};

const pendingFirst: RequestRecord = { ...sourceRequest, id: "request-first", title: "Primeiro pendente", column_id: "column-pending", status: "pending", position: 1024 };
const pendingLast: RequestRecord = { ...sourceRequest, id: "request-last", title: "Último pendente", column_id: "column-pending", status: "pending", position: 3072 };
const customColumn: BoardColumn = { id: "column-priorities", name: "Prioridades", kind: "custom", system_key: null, assignee_id: null, position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };

const basePermissions: EffectivePermissions = { canCreate: false, canEdit: false, canMove: true, canDelete: false, canManageColumns: false, canManageCities: false };

function boardRequests(columnName: string) {
  return within(screen.getByRole("region", { name: `Lista ${columnName}` }));
}

function boardColumnNames() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

function drag(activeId: string, overId: string) {
  const overRequest = [sourceRequest, pendingFirst, pendingLast].find((request) => request.id === overId);
  act(() => {
    void mocks.dragEnd({
      active: { id: activeId, data: { current: { type: "request", columnId: sourceRequest.column_id } } },
      over: { id: overId, data: { current: overRequest ? { type: "request", columnId: overRequest.column_id } : { type: "column" } } },
    } as unknown as DragEndEvent);
  });
}

function dragColumn(activeId: string, overId: string) {
  act(() => {
    void mocks.dragEnd({
      active: { id: activeId, data: { current: { type: "column" } } },
      over: { id: overId, data: { current: { type: "column" } } },
    } as unknown as DragEndEvent);
  });
}

function selectFirstCity() {
  fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
  fireEvent.click(screen.getByRole("option", { name: cities[0].name }));
}

function selectAssignee(profile: Profile) {
  fireEvent.click(screen.getByRole("button", { name: "Selecionar responsável" }));
  fireEvent.click(screen.getByRole("option", { name: profile.full_name }));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function emitRequestUpdate(requestId: string) {
  await act(async () => {
    await mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: requestId } });
  });
}

async function emitRequestInsert(requestId: string) {
  await act(async () => {
    await mocks.requestChange({ eventType: "INSERT", old: {}, new: { id: requestId } });
  });
}

async function emitRequestDelete(requestId: string) {
  await act(async () => {
    await mocks.requestChange({ eventType: "DELETE", old: { id: requestId }, new: {} });
  });
}

function emitCityUpdate(city: City) {
  act(() => {
    mocks.cityChange({ eventType: "UPDATE", old: { id: city.id }, new: { ...city } });
  });
}

async function emitRequestCityChange(eventType: "INSERT" | "UPDATE" | "DELETE", requestId: string) {
  await act(async () => {
    await mocks.requestCityChange({
      eventType,
      old: eventType === "INSERT" ? {} : { request_id: requestId, city_id: cities[0].id },
      new: eventType === "DELETE" ? {} : { request_id: requestId, city_id: cities[1].id },
    });
  });
}

beforeEach(() => {
  mocks.createRequest.mockReset();
  mocks.updateRequest.mockReset();
  mocks.moveRequest.mockReset();
  mocks.getRequest.mockReset();
  mocks.deleteRequest.mockReset();
  mocks.createBoardColumn.mockReset();
  mocks.getBoardColumn.mockReset();
  mocks.renameBoardColumn.mockReset();
  mocks.reorderBoardColumn.mockReset();
  mocks.deleteBoardColumn.mockReset();
  mocks.closestCenter.mockClear();
  mocks.sortableContexts = [];
  mocks.channel.mockReset();
  mocks.removeChannel.mockReset();
  mocks.channel.mockImplementation((name: string) => {
    const channel = {
      on: vi.fn((_event: string, _filter: Record<string, unknown>, callback: typeof mocks.requestChange) => {
        if (name === "requests-board") mocks.requestChange = callback;
        if (name === "cities-board") mocks.cityChange = callback;
        if (name === "request-cities-board") mocks.requestCityChange = callback;
        if (name === "board-columns") mocks.columnChange = callback as typeof mocks.columnChange;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return channel;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("KanbanBoard city realtime", () => {
  it("substitui a cidade por UUID em todos os cartões e relações sem duplicar linhas", async () => {
    const relatedRequest = { ...sourceRequest, id: "request-related", title: "Outra solicitação", position: 512 };
    render(<KanbanBoard initialRequests={[sourceRequest, relatedRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    const updatedCity = { ...cities[0], name: "Santa Luzia Nova", active: false };
    emitCityUpdate(updatedCity);
    emitCityUpdate(updatedCity);

    expect(await screen.findAllByText("Cidade: Santa Luzia Nova")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: sourceRequest.title })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: relatedRequest.title })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: sourceRequest.title }));
    expect(screen.getByText("Santa Luzia Nova")).toBeInTheDocument();
    expect(screen.getByText("Desativada")).toBeInTheDocument();
  });

  it.each(["INSERT", "UPDATE", "DELETE"] as const)("recarrega e faz upsert somente da solicitação afetada em request_cities %s", async (eventType) => {
    const unaffected = { ...sourceRequest, id: "request-unaffected", title: "Não afetada", position: 512 };
    const canonical = { ...sourceRequest, title: `Canônica ${eventType}`, cities: [cities[0], cities[1]], position: 4096 };
    mocks.getRequest.mockResolvedValue(canonical);
    render(<KanbanBoard initialRequests={[sourceRequest, unaffected]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    await emitRequestCityChange(eventType, sourceRequest.id);

    expect(mocks.getRequest).toHaveBeenCalledOnce();
    expect(mocks.getRequest).toHaveBeenCalledWith(sourceRequest.id);
    expect(screen.getByRole("button", { name: canonical.title })).toBeInTheDocument();
    expect(screen.getByText("Cidades: Santa Luzia, Belo Horizonte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: unaffected.title })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: canonical.title })).toHaveLength(1);
  });

  it("mantém o upsert idempotente quando o mesmo relacionamento é notificado novamente", async () => {
    const canonical = { ...sourceRequest, cities: [cities[0], cities[1]] };
    mocks.getRequest.mockResolvedValue(canonical);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    await emitRequestCityChange("INSERT", sourceRequest.id);
    await emitRequestCityChange("INSERT", sourceRequest.id);

    expect(mocks.getRequest).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("button", { name: sourceRequest.title })).toHaveLength(1);
    expect(screen.getAllByText("Cidades: Santa Luzia, Belo Horizonte")).toHaveLength(1);
  });

  it("não deixa refetch antigo de relacionamento reverter uma cidade atualizada depois", async () => {
    const relationshipRead = deferred<RequestRecord>();
    mocks.getRequest.mockReturnValue(relationshipRead.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    let relationshipEvent = Promise.resolve();
    act(() => {
      relationshipEvent = mocks.requestCityChange({
        eventType: "INSERT",
        old: {},
        new: { request_id: sourceRequest.id, city_id: cities[1].id },
      });
    });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledWith(sourceRequest.id));

    const updatedCity = { ...cities[0], name: "Santa Luzia Atualizada", active: false };
    emitCityUpdate(updatedCity);
    expect(screen.getByText("Cidade: Santa Luzia Atualizada")).toBeInTheDocument();

    await act(async () => {
      relationshipRead.resolve({ ...sourceRequest, cities: [cities[0], cities[1]] });
      await relationshipRead.promise;
      await relationshipEvent;
    });

    expect(screen.getByText("Cidades: Santa Luzia Atualizada, Belo Horizonte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: sourceRequest.title }));
    expect(screen.getByText("Santa Luzia Atualizada, Belo Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Desativada")).toBeInTheDocument();
  });

  it("não deixa resposta atrasada de edição reverter cidade nem remover nova associação", async () => {
    const updateResponse = deferred<RequestRecord>();
    mocks.updateRequest.mockReturnValue(updateResponse.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(screen.getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    fireEvent.click(screen.getByRole("option", { name: cities[1].name }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalledOnce());

    const updatedCity = { ...cities[0], name: "Santa Luzia Externa", active: false };
    emitCityUpdate(updatedCity);
    expect(screen.getByText("Cidade: Santa Luzia Externa")).toBeInTheDocument();

    await act(async () => {
      updateResponse.resolve({ ...sourceRequest, cities: [cities[0], cities[1]] });
      await updateResponse.promise;
    });

    expect(screen.getByText("Cidades: Santa Luzia Externa, Belo Horizonte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: sourceRequest.title }));
    expect(screen.getByText("Santa Luzia Externa, Belo Horizonte")).toBeInTheDocument();
    expect(screen.getByText("Desativada")).toBeInTheDocument();
  });

  it("não deixa resposta atrasada de movimento reverter cidade, destino ou posição", async () => {
    const moveResponse = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(moveResponse.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-pending", 1024));
    const updatedCity = { ...cities[0], name: "Santa Luzia em Tempo Real", active: false };
    emitCityUpdate(updatedCity);

    await act(async () => {
      moveResponse.resolve({ ...sourceRequest, cities: [cities[0]], column_id: "column-pending", status: "pending", position: 1024 });
      await moveResponse.promise;
    });

    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Pendente").getByText("Cidade: Santa Luzia em Tempo Real")).toBeInTheDocument();
    expect(screen.getByTestId(`position-${sourceRequest.id}`)).toHaveTextContent("1024");
    fireEvent.click(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title }));
    expect(screen.getByText("Santa Luzia em Tempo Real")).toBeInTheDocument();
    expect(screen.getByText("Desativada")).toBeInTheDocument();
  });

  it("normaliza a cidade ao criar sem perder a posição canônica no topo", async () => {
    const createResponse = deferred<RequestRecord>();
    const older = { ...sourceRequest, id: "request-older-city", title: "Demanda antiga", position: 1024 };
    const created = { ...sourceRequest, id: "request-created-city", title: "Demanda nova", position: 512 };
    mocks.createRequest.mockReturnValue(createResponse.promise);
    render(<KanbanBoard initialRequests={[older]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: created.title } });
    selectFirstCity();
    selectAssignee(profiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag HUB" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledOnce());

    const updatedCity = { ...cities[0], name: "Santa Luzia Recente", active: false };
    emitCityUpdate(updatedCity);
    await act(async () => {
      createResponse.resolve(created);
      await createResponse.promise;
    });

    expect(boardRequests("Lucifer").getAllByRole("button").map((button) => button.textContent)).toEqual([created.title, older.title]);
    expect(boardRequests("Lucifer").getAllByText("Cidade: Santa Luzia Recente")).toHaveLength(2);
    expect(boardRequests("Lucifer").queryByText("Cidade: Santa Luzia")).not.toBeInTheDocument();
    expect(screen.getByTestId(`position-${created.id}`)).toHaveTextContent("512");
  });

  it("normaliza a cidade ao fazer rollback de um movimento não confirmado", async () => {
    const moveResponse = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(moveResponse.promise);
    mocks.getRequest.mockRejectedValue(new Error("indisponível"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledOnce());
    const updatedCity = { ...cities[0], name: "Santa Luzia no Rollback", active: false };
    emitCityUpdate(updatedCity);

    await act(async () => {
      moveResponse.reject(new Error("timeout"));
      await expect(moveResponse.promise).rejects.toThrow("timeout");
    });

    await waitFor(() => expect(boardRequests("Lucifer").getByText("Cidade: Santa Luzia no Rollback")).toBeInTheDocument());
    expect(screen.getByTestId(`position-${sourceRequest.id}`)).toHaveTextContent("4096");
  });

  it("remove todos os canais criados e ignora callbacks retidos ao desmontar", async () => {
    const { unmount } = render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);
    const staleRelationshipCallback = mocks.requestCityChange;

    unmount();
    await staleRelationshipCallback({ eventType: "INSERT", old: {}, new: { request_id: sourceRequest.id, city_id: cities[0].id } });

    expect(mocks.removeChannel).toHaveBeenCalledTimes(4);
    expect(new Set(mocks.removeChannel.mock.calls.map(([channel]) => channel))).toHaveProperty("size", 4);
    expect(mocks.getRequest).not.toHaveBeenCalled();
  });
});

describe("KanbanBoard movement", () => {
  it("arrasta uma coluna personalizada para antes das colunas de sistema", async () => {
    mocks.reorderBoardColumn.mockResolvedValue({ ...customColumn, position: 512 });
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(customColumn.id, columns[0].id);

    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith(customColumn.id, 512));
    expect(boardColumnNames()).toEqual(["Prioridades", "Pendente", "Em progresso", "Concluído"]);
  });

  it("arrasta uma coluna de sistema para depois de uma personalizada", async () => {
    mocks.reorderBoardColumn.mockResolvedValue({ ...columns[0], position: 5120 });
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(columns[0].id, customColumn.id);

    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith(columns[0].id, 5120));
    expect(boardColumnNames()).toEqual(["Em progresso", "Concluído", "Prioridades", "Pendente"]);
  });

  it("calcula a posição exata entre a coluna alvo e sua próxima vizinha", async () => {
    mocks.reorderBoardColumn.mockResolvedValue({ ...columns[0], position: 2560 });
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(columns[0].id, columns[1].id);

    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith(columns[0].id, 2560));
    expect(boardColumnNames()).toEqual(["Em progresso", "Pendente", "Concluído", "Prioridades"]);
  });

  it("restaura a ordem inteira quando a reordenação de coluna falha", async () => {
    const reorder = deferred<BoardColumn>();
    mocks.reorderBoardColumn.mockReturnValue(reorder.promise);
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(customColumn.id, columns[0].id);
    await waitFor(() => expect(boardColumnNames()).toEqual(["Prioridades", "Pendente", "Em progresso", "Concluído"]));
    await act(async () => {
      reorder.reject(new Error("offline"));
      await reorder.promise.catch(() => undefined);
    });

    expect(boardColumnNames()).toEqual(["Pendente", "Em progresso", "Concluído", "Prioridades"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reordenar a lista. A ordem anterior foi restaurada.");
  });

  it("serializa reordenações da mesma coluna e preserva a última intenção contra Realtime e respostas invertidos", async () => {
    const firstResponse = deferred<BoardColumn>();
    const latestResponse = deferred<BoardColumn>();
    const firstCanonical = { ...customColumn, position: 512, updated_at: "2026-08-30T01:00:00Z" };
    const latestCanonical = { ...customColumn, position: 4096, updated_at: "2026-08-30T01:00:01Z" };
    mocks.reorderBoardColumn
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(latestResponse.promise);
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(customColumn.id, columns[0].id);
    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith(customColumn.id, 512));
    dragColumn(customColumn.id, columns[2].id);

    expect(boardColumnNames()).toEqual(["Pendente", "Em progresso", "Concluído", "Prioridades"]);
    expect(mocks.reorderBoardColumn).toHaveBeenCalledTimes(1);

    await act(async () => {
      latestResponse.resolve(latestCanonical);
      mocks.columnChange({ eventType: "UPDATE", old: {}, new: latestCanonical as unknown as Record<string, unknown> });
      mocks.columnChange({ eventType: "UPDATE", old: {}, new: firstCanonical as unknown as Record<string, unknown> });
      firstResponse.resolve(firstCanonical);
      await firstResponse.promise;
    });

    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledTimes(2));
    await act(async () => { await latestResponse.promise; });

    expect(mocks.reorderBoardColumn).toHaveBeenNthCalledWith(2, customColumn.id, 4096);
    expect(boardColumnNames()).toEqual(["Pendente", "Em progresso", "Concluído", "Prioridades"]);

    act(() => {
      mocks.columnChange({ eventType: "UPDATE", old: {}, new: firstCanonical as unknown as Record<string, unknown> });
    });
    expect(boardColumnNames()).toEqual(["Pendente", "Em progresso", "Concluído", "Prioridades"]);
  });

  it("reconcilia a atualização remota posterior ao commit local mesmo quando ela chega antes da resposta HTTP", async () => {
    const localResponse = deferred<BoardColumn>();
    const localCanonical = { ...customColumn, position: 512, updated_at: "2026-08-30T02:00:00Z" };
    const remoteCanonical = { ...customColumn, position: 2560, updated_at: "2026-08-30T02:00:01Z" };
    mocks.reorderBoardColumn.mockReturnValue(localResponse.promise);
    mocks.getBoardColumn.mockResolvedValue(remoteCanonical);
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(customColumn.id, columns[0].id);
    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledWith(customColumn.id, 512));
    act(() => {
      mocks.columnChange({ eventType: "UPDATE", old: {}, new: remoteCanonical as unknown as Record<string, unknown> });
    });
    await act(async () => {
      localResponse.resolve(localCanonical);
      await localResponse.promise;
    });

    await waitFor(() => expect(mocks.getBoardColumn).toHaveBeenCalledWith(customColumn.id));
    expect(boardColumnNames()).toEqual(["Pendente", "Em progresso", "Prioridades", "Concluído"]);
  });

  it("não confirma a intenção enfileirada por evento coincidente recebido antes de sua RPC começar", async () => {
    const firstResponse = deferred<BoardColumn>();
    const queuedResponse = deferred<BoardColumn>();
    const coincidentBeforeStart = { ...customColumn, position: 4096, updated_at: "2026-08-30T03:00:00Z" };
    const firstCanonical = { ...customColumn, position: 512, updated_at: "2026-08-30T03:00:01Z" };
    mocks.reorderBoardColumn
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(queuedResponse.promise);
    mocks.getBoardColumn.mockResolvedValue(firstCanonical);
    render(<KanbanBoard initialRequests={[]} initialColumns={[...columns.slice(0, 3), customColumn]} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    dragColumn(customColumn.id, columns[0].id);
    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledTimes(1));
    dragColumn(customColumn.id, columns[2].id);
    act(() => {
      mocks.columnChange({ eventType: "UPDATE", old: {}, new: coincidentBeforeStart as unknown as Record<string, unknown> });
    });
    await act(async () => {
      firstResponse.resolve(firstCanonical);
      await firstResponse.promise;
    });
    await waitFor(() => expect(mocks.reorderBoardColumn).toHaveBeenCalledTimes(2));
    await act(async () => {
      queuedResponse.reject(new Error("offline"));
      await queuedResponse.promise.catch(() => undefined);
    });

    await waitFor(() => expect(mocks.getBoardColumn).toHaveBeenCalledWith(customColumn.id));
    expect(boardColumnNames()).toEqual(["Prioridades", "Pendente", "Em progresso", "Concluído"]);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reordenar a lista. A ordem anterior foi restaurada.");
    expect(screen.queryByText("Lista reordenada.")).not.toBeInTheDocument();
  });

  it("não trata um cartão como coluna mesmo quando o alvo é uma coluna", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    act(() => {
      void mocks.dragEnd({
        active: { id: columns[3].id, data: { current: { type: "request", columnId: columns[3].id } } },
        over: { id: columns[0].id, data: { current: { type: "column" } } },
      } as unknown as DragEndEvent);
    });

    expect(mocks.reorderBoardColumn).not.toHaveBeenCalled();
    expect(mocks.moveRequest).not.toHaveBeenCalled();
  });

  it("move otimisticamente para uma coluna vazia e restaura o cartão inteiro quando a RPC falha", async () => {
    let rejectMove: (error: Error) => void = () => undefined;
    mocks.moveRequest.mockImplementation(() => new Promise<RequestRecord>((_, reject) => { rejectMove = reject; }));
    mocks.getRequest.mockRejectedValue(new Error("offline"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");

    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-pending", 1024);

    act(() => rejectMove(new Error("offline")));

    expect(await screen.findByText("Não foi possível mover a solicitação. O cartão voltou à posição anterior.")).toBeInTheDocument();
    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Pendente").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("ignora uma segunda tentativa enquanto o cartão já está sendo persistido", async () => {
    const firstMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(firstMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    drag(sourceRequest.id, "column-completed");

    expect(mocks.moveRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(/movimentação.*andamento/i);

    await act(async () => {
      firstMove.resolve({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 1024 });
      await firstMove.promise;
    });
    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Concluído").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("libera o cartão para uma nova movimentação depois que a persistência termina", async () => {
    mocks.moveRequest
      .mockResolvedValueOnce({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 1024 })
      .mockResolvedValueOnce({ ...sourceRequest, column_id: "column-completed", status: "completed", position: 1024 });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    drag(sourceRequest.id, "column-completed");

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledTimes(2));
    expect(boardRequests("Concluído").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
  });

  it("mantém a RPC vigente quando uma releitura Realtime falha", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    mocks.getRequest.mockRejectedValue(new Error("offline"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    await emitRequestUpdate(sourceRequest.id);

    await act(async () => {
      pendingMove.resolve({ ...sourceRequest, column_id: "column-completed", status: "completed", position: 1024 });
      await pendingMove.promise;
    });
    expect(boardRequests("Concluído").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Pendente").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("reserva a versão no recebimento para o evento Realtime mais recente vencer releituras fora de ordem", async () => {
    const firstRead = deferred<RequestRecord>();
    const secondRead = deferred<RequestRecord>();
    const older = { ...sourceRequest, title: "Evento antigo", column_id: "column-completed", status: "completed" as const, position: 1024 };
    const latest = { ...sourceRequest, title: "Evento mais novo", column_id: "column-pending", status: "pending" as const, position: 1024 };
    mocks.getRequest.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    act(() => { void mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledTimes(1));
    act(() => { void mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledTimes(2));

    await act(async () => {
      firstRead.resolve(older);
      await firstRead.promise;
    });
    await act(async () => {
      secondRead.resolve(latest);
      await secondRead.promise;
    });

    expect(boardRequests("Pendente").getByRole("button", { name: "Evento mais novo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evento antigo" })).not.toBeInTheDocument();
  });

  it("não reaplica evento antigo quando a releitura do evento Realtime mais recente falha", async () => {
    const firstRead = deferred<RequestRecord>();
    const secondRead = deferred<RequestRecord>();
    const older = { ...sourceRequest, title: "Evento antigo tardio", column_id: "column-completed", status: "completed" as const, position: 1024 };
    mocks.getRequest.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    let firstEvent = Promise.resolve();
    let secondEvent = Promise.resolve();
    act(() => { firstEvent = mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledTimes(1));
    act(() => { secondEvent = mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondRead.reject(new Error("offline"));
      await secondEvent;
    });
    await act(async () => {
      firstRead.resolve(older);
      await firstRead.promise;
      await firstEvent;
    });

    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evento antigo tardio" })).not.toBeInTheDocument();
  });

  it("não deixa uma releitura Realtime recebida antes sobrescrever um movimento local mais novo", async () => {
    const realtimeRead = deferred<RequestRecord>();
    const pendingMove = deferred<RequestRecord>();
    const moved = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    mocks.getRequest.mockReturnValue(realtimeRead.promise);
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    let realtimeEvent = Promise.resolve();
    act(() => { realtimeEvent = mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledOnce());
    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());

    await act(async () => {
      realtimeRead.resolve(sourceRequest);
      await realtimeRead.promise;
      await realtimeEvent;
    });
    await act(async () => {
      pendingMove.resolve(moved);
      await pendingMove.promise;
    });

    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Lucifer").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("aceita uma releitura anterior que confirma exatamente o movimento local pendente", async () => {
    const realtimeRead = deferred<RequestRecord>();
    const pendingMove = deferred<RequestRecord>();
    const moved = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    mocks.getRequest.mockReturnValue(realtimeRead.promise);
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    let realtimeEvent = Promise.resolve();
    act(() => { realtimeEvent = mocks.requestChange({ eventType: "UPDATE", old: {}, new: { id: sourceRequest.id } }); });
    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledOnce());
    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-pending", 1024));

    await act(async () => {
      realtimeRead.resolve(moved);
      await realtimeRead.promise;
      await realtimeEvent;
    });
    await act(async () => {
      pendingMove.resolve(moved);
      await pendingMove.promise;
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitação movida.");
  });

  it("trata o próprio evento Realtime que confirma coluna e posição como sucesso do movimento", async () => {
    const pendingMove = deferred<RequestRecord>();
    const canonical = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    mocks.getRequest.mockResolvedValue(canonical);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-pending", 1024));
    await emitRequestUpdate(sourceRequest.id);

    await act(async () => {
      pendingMove.resolve(canonical);
      await pendingMove.promise;
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitação movida.");
  });

  it("invalida o movimento pendente quando Realtime traz estado e responsável mais novos", async () => {
    const pendingMove = deferred<RequestRecord>();
    const realtimeRequest = { ...sourceRequest, assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name }, column_id: "column-completed", status: "completed" as const, position: 1024 };
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    await emitRequestUpdate(sourceRequest.id);

    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();

    await act(async () => {
      pendingMove.resolve({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 1024 });
      await pendingMove.promise;
    });
    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();
    expect(boardRequests("Pendente").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("aplica a releitura canônica após falha ambígua em vez de voltar ao snapshot", async () => {
    const canonical = { ...sourceRequest, assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name }, column_id: "column-completed", status: "completed" as const, position: 1024 };
    mocks.moveRequest.mockRejectedValue(new Error("timeout"));
    mocks.getRequest.mockResolvedValue(canonical);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");

    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledWith(sourceRequest.id));
    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível mover a solicitação. O cartão voltou à posição anterior.")).not.toBeInTheDocument();
  });

  it("fecha o diálogo no DELETE Realtime e não ressuscita o cartão após sucesso pendente", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledOnce());

    await emitRequestDelete(sourceRequest.id);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();

    await act(async () => {
      pendingMove.resolve({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 1024 });
      await pendingMove.promise;
    });
    expect(screen.queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("rejeita exclusão durante movimento sem invalidar o sucesso pendente", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    mocks.deleteRequest.mockRejectedValue(new Error("não deveria chamar"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    fireEvent.click(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não é possível excluir.*movimentação/i);
    expect(mocks.deleteRequest).not.toHaveBeenCalled();

    await act(async () => {
      pendingMove.resolve({ ...sourceRequest, column_id: "column-completed", status: "completed", position: 1024 });
      await pendingMove.promise;
    });
    expect(boardRequests("Concluído").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
  });

  it("rejeita exclusão durante movimento sem impedir o rollback para a base", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    mocks.getRequest.mockRejectedValue(new Error("offline"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    fireEvent.click(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await screen.findByRole("alert");

    await act(async () => {
      pendingMove.reject(new Error("offline"));
      await pendingMove.promise.catch(() => undefined);
    });
    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Pendente").queryByRole("button", { name: sourceRequest.title })).not.toBeInTheDocument();
  });

  it("bloqueia drag sem mutação otimista enquanto a exclusão está pendente", async () => {
    const pendingDelete = deferred<void>();
    mocks.deleteRequest.mockReturnValue(pendingDelete.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(mocks.deleteRequest).toHaveBeenCalledOnce());
    drag(sourceRequest.id, "column-pending");

    expect(mocks.moveRequest).not.toHaveBeenCalled();
    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/exclusão.*andamento/i);
  });

  it("mostra falha de exclusão, libera a UI e aceita uma operação posterior", async () => {
    mocks.deleteRequest.mockRejectedValue(new Error("offline"));
    mocks.moveRequest.mockResolvedValue({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 1024 });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível excluir a solicitação. Tente novamente.");
    expect(screen.getByRole("button", { name: "Excluir" })).toBeEnabled();
    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
  });

  it("mantém a ação fixa aberta quando outro movimento do cartão já está pendente", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    fireEvent.click(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/movimentação.*andamento/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.moveRequest).toHaveBeenCalledOnce();
  });

  it("insere antes do cartão alvo pela posição e preserva a relação do responsável no retorno", async () => {
    mocks.moveRequest.mockResolvedValue({ ...sourceRequest, column_id: "column-pending", status: "pending", position: 2048, assignee: undefined });
    render(<KanbanBoard initialRequests={[pendingFirst, pendingLast, sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, pendingLast.id);

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-pending", 2048));
    const pending = boardRequests("Pendente");
    expect(pending.getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(pending.getAllByText("Lucifer")).toHaveLength(3);
  });

  it("insere depois do cartão alvo ao soltar abaixo dele na mesma coluna", async () => {
    const moving = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    const target = { ...pendingLast, position: 2048 };
    mocks.moveRequest.mockResolvedValue({ ...moving, position: 3072 });
    render(<KanbanBoard initialRequests={[moving, target]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    act(() => {
      void mocks.dragEnd({
        active: { id: moving.id, data: { current: { type: "request", columnId: moving.column_id } }, rect: { current: { translated: { top: 200 } } } },
        over: { id: target.id, data: { current: { type: "request", columnId: target.column_id } }, rect: { top: 100, height: 50 } },
      } as unknown as DragEndEvent);
    });

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(moving.id, "column-pending", 3072));
  });

  it("usa o centro do cartão ativo na zona entre o topo e o centro do alvo", async () => {
    const moving = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    const target = { ...pendingLast, position: 2048 };
    mocks.moveRequest.mockResolvedValue({ ...moving, position: 3072 });
    render(<KanbanBoard initialRequests={[moving, target]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    act(() => {
      void mocks.dragEnd({
        active: { id: moving.id, data: { current: { type: "request", columnId: moving.column_id } }, rect: { current: { translated: { top: 110, height: 40 } } } },
        over: { id: target.id, data: { current: { type: "request", columnId: target.column_id } }, rect: { top: 100, height: 50 } },
      } as unknown as DragEndEvent);
    });

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(moving.id, "column-pending", 3072));
  });

  it("ignora o arraste quando o usuário não tem permissão", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canMove: false }} />);

    drag(sourceRequest.id, "column-pending");

    expect(mocks.moveRequest).not.toHaveBeenCalled();
    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
  });

  it("resolve a ação fixa e usa o responsável canônico retornado", async () => {
    mocks.moveRequest.mockResolvedValue({ ...sourceRequest, assigned_to: profiles[1].id, column_id: "column-completed", status: "completed", position: 1024, assignee: undefined });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-completed", 1024));
    expect(boardRequests("Concluído").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitação movida.");
  });

  it("mostra um erro em português se a coluna fixa não existir", async () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns.filter((column) => column.system_key !== "completed")} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    expect(await screen.findByText("A coluna de destino não foi encontrada.")).toBeInTheDocument();
    expect(mocks.moveRequest).not.toHaveBeenCalled();
  });
});

describe("KanbanBoard save routing", () => {
  it("usa a posição inicial estável e renderiza o destino canônico retornado na criação", async () => {
    const created = { ...sourceRequest, id: "request-created", title: "Nova demanda", column_id: "column-lucifer", position: 1024, assignee: undefined };
    mocks.createRequest.mockResolvedValue(created);
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Nova demanda" } });
    selectFirstCity();
    selectAssignee(profiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag HUB" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith({ title: "Nova demanda", description: "", cityIds: [cities[0].id], assignedTo: profiles[0].id, externalUrl: "", tags: ["hub"] }, "owner", 1024));
    expect(boardRequests("Lucifer").getByRole("button", { name: "Nova demanda" })).toBeInTheDocument();
    expect(boardRequests("Lucifer").getByText("Lucifer", { selector: "span" })).toBeInTheDocument();
    const notice = await screen.findByText("Solicitação criada.");
    expect(notice.closest('[role="status"]')).toHaveClass("fixed", "bottom-6", "left-1/2");

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
    expect(screen.queryByText("Solicitação criada.")).not.toBeInTheDocument();
  });

  it("insere a criação no topo pela posição canônica sem recalcular cartões antigos", async () => {
    const older = { ...sourceRequest, id: "request-older", title: "Demanda antiga", position: 1024 };
    const created = { ...sourceRequest, id: "request-created-top", title: "Demanda nova", position: 512 };
    mocks.createRequest.mockResolvedValue(created);
    render(<KanbanBoard initialRequests={[older]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: created.title } });
    selectFirstCity();
    selectAssignee(profiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag HUB" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(boardRequests("Lucifer").getByRole("button", { name: created.title })).toBeInTheDocument());
    expect(boardRequests("Lucifer").getAllByRole("button").map((button) => button.textContent)).toEqual([created.title, older.title]);
    expect(screen.getByTestId(`position-${created.id}`)).toHaveTextContent("512");
    expect(screen.getByTestId(`position-${older.id}`)).toHaveTextContent("1024");
  });

  it("confia no column_id retornado ao editar e recompõe a relação do novo responsável", async () => {
    mocks.updateRequest.mockResolvedValue({ ...sourceRequest, assigned_to: profiles[1].id, column_id: "column-pending", status: "pending", assignee: undefined });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    selectAssignee(profiles[1]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalled());
    await waitFor(() => expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument());
    expect(boardRequests("Pendente").getByText("Bruno")).toBeInTheDocument();
  });

  it("usa o responsável recebido por Realtime ao editar somente o título", async () => {
    const realtimeRequest = { ...sourceRequest, assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name } };
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    mocks.updateRequest.mockResolvedValue({ ...realtimeRequest, title: "Título atualizado" });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await emitRequestUpdate(sourceRequest.id);
    await waitFor(() => expect(screen.getByRole("button", { name: "Selecionar responsável" })).toHaveTextContent(profiles[1].full_name));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalledWith(sourceRequest.id, expect.objectContaining({ title: "Título atualizado", assignedTo: profiles[1].id })));
  });

  it("sincroniza campos remotos não alterados e preserva o título local dirty", async () => {
    const realtimeRequest = {
      ...sourceRequest,
      title: "Título remoto",
      description: "Descrição remota",
      cities: [cities[1]],
      assigned_to: profiles[1].id,
      external_url: "https://example.com/remoto",
      assignee: { id: profiles[1].id, full_name: profiles[1].full_name },
    };
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    mocks.updateRequest.mockResolvedValue({ ...realtimeRequest, title: "Título local" });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título local" } });
    await emitRequestUpdate(sourceRequest.id);

    expect(screen.getByLabelText("Título")).toHaveValue("Título local");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Descrição remota");
    fireEvent.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    expect(screen.getByRole("option", { name: cities[1].name })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Selecionar responsável" })).toHaveTextContent(profiles[1].full_name);
    expect(screen.getByLabelText("Link externo")).toHaveValue("https://example.com/remoto");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalledWith(sourceRequest.id, {
      title: "Título local",
      description: "Descrição remota",
      cityIds: [cities[1].id],
      assignedTo: profiles[1].id,
      externalUrl: "https://example.com/remoto",
      tags: ["hub"],
    }));
  });

  it("preserva a linha Realtime quando ela chega antes da resposta atrasada da criação", async () => {
    const createResponse = deferred<RequestRecord>();
    const requestId = "request-created-race";
    const realtimeRequest = { ...sourceRequest, id: requestId, title: "Versão Realtime", assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name }, column_id: "column-completed", status: "completed" as const, position: 2048 };
    const staleRpcRequest = { ...sourceRequest, id: requestId, title: "Versão RPC", assignee: undefined };
    mocks.createRequest.mockReturnValue(createResponse.promise);
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Versão RPC" } });
    selectFirstCity();
    selectAssignee(profiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag HUB" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledOnce());

    await emitRequestInsert(requestId);
    expect(boardRequests("Concluído").getByRole("button", { name: "Versão Realtime" })).toBeInTheDocument();

    await act(async () => {
      createResponse.resolve(staleRpcRequest);
      await createResponse.promise;
    });
    expect(boardRequests("Concluído").getByRole("button", { name: "Versão Realtime" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Versão RPC" })).not.toBeInTheDocument();
  });

  it("não reinserte nem anuncia criação após INSERT e DELETE anteriores à resposta da RPC", async () => {
    const createResponse = deferred<RequestRecord>();
    const requestId = "request-created-deleted";
    const realtimeRequest = { ...sourceRequest, id: requestId, title: "Criada em Realtime" };
    mocks.createRequest.mockReturnValue(createResponse.promise);
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Resposta atrasada" } });
    selectFirstCity();
    selectAssignee(profiles[0]);
    fireEvent.click(screen.getByRole("button", { name: "Tag HUB" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledOnce());

    await emitRequestInsert(requestId);
    await emitRequestDelete(requestId);
    await act(async () => {
      createResponse.resolve({ ...realtimeRequest, title: "Resposta atrasada" });
      await createResponse.promise;
    });

    expect(screen.queryByRole("button", { name: "Resposta atrasada" })).not.toBeInTheDocument();
    expect(screen.queryByText("Solicitação criada.")).not.toBeInTheDocument();
  });
});

describe("KanbanBoard accessibility", () => {
  it("exige deslocamento antes de iniciar o arraste com o mouse", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(mocks.sensors[0]?.options?.activationConstraint?.distance).toBe(8);
  });

  it("mostra uma prévia flutuante apenas durante o arraste", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(screen.queryByTestId("drag-overlay")).not.toBeInTheDocument();
    act(() => mocks.dragStart({ active: { id: sourceRequest.id, data: { current: { type: "request", columnId: sourceRequest.column_id } } } }));
    expect(screen.getByTestId("drag-overlay")).toHaveTextContent(sourceRequest.title);

    act(() => mocks.dragCancel());
    expect(screen.queryByTestId("drag-overlay")).not.toBeInTheDocument();
  });

  it("mostra a prévia de coluna e registra todas as colunas no contexto horizontal", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);

    expect(mocks.sortableContexts.some((context) => context.items.join(",") === columns.map((column) => column.id).join(","))).toBe(true);
    act(() => mocks.dragStart({ active: { id: columns[0].id, data: { current: { type: "column" } } } }));
    expect(screen.getByTestId("drag-overlay")).toHaveTextContent("Pendente");
    expect(screen.getByTestId("drag-overlay")).toHaveTextContent("Prévia da lista");
  });

  it("restringe colisões de coluna a alvos declarados como coluna", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canManageColumns: true }} />);
    const columnTarget = { id: columns[0].id, data: { current: { type: "column" } } };
    const requestTarget = { id: sourceRequest.id, data: { current: { type: "request", columnId: sourceRequest.column_id } } };

    mocks.collisionDetection({ active: { id: columns[1].id, data: { current: { type: "column" } } }, droppableContainers: [columnTarget, requestTarget] });

    expect(mocks.closestCenter).toHaveBeenCalledWith(expect.objectContaining({ droppableContainers: [columnTarget] }));
  });

  it("fornece instruções e anúncios de arraste em português com nomes", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} cities={cities} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(mocks.accessibility.screenReaderInstructions?.draggable).toMatch(/barra de espaço/i);
    expect(mocks.accessibility.announcements?.onDragStart({ active: { id: sourceRequest.id, data: { current: { type: "request" } } } } as unknown as Parameters<Announcements["onDragStart"]>[0])).toContain(sourceRequest.title);
    expect(mocks.accessibility.announcements?.onDragOver({ active: { id: sourceRequest.id, data: { current: { type: "request" } } }, over: { id: "column-pending", data: { current: { type: "column" } } } } as unknown as Parameters<Announcements["onDragOver"]>[0])).toContain("Pendente");
    expect(mocks.accessibility.announcements?.onDragStart({ active: { id: columns[0].id, data: { current: { type: "column" } } } } as unknown as Parameters<Announcements["onDragStart"]>[0])).toContain("coluna Pendente");
  });
});
