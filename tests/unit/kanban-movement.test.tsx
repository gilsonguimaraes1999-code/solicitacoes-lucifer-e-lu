import type { ReactNode } from "react";
import type { Announcements, DragEndEvent, ScreenReaderInstructions } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "@/features/columns/types";
import type { EffectivePermissions, Profile, RequestRecord } from "@/features/requests/types";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  moveRequest: vi.fn(),
  getRequest: vi.fn(),
  deleteRequest: vi.fn(),
  dragEnd: undefined as unknown as (event: DragEndEvent) => Promise<void>,
  dragStart: undefined as unknown as (event: { active: { id: string } }) => void,
  dragCancel: undefined as unknown as () => void,
  sensors: [] as Array<{ options?: { activationConstraint?: { distance?: number } } }>,
  requestChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: Record<string, unknown>; new: Record<string, unknown> }) => Promise<void>,
  accessibility: undefined as unknown as { announcements?: Announcements; screenReaderInstructions?: ScreenReaderInstructions },
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...original,
    DndContext: ({ children, onDragStart, onDragCancel, onDragEnd, accessibility, sensors }: { children: ReactNode; onDragStart?: (event: { active: { id: string } }) => void; onDragCancel?: () => void; onDragEnd: (event: DragEndEvent) => Promise<void>; accessibility?: { announcements?: Announcements; screenReaderInstructions?: ScreenReaderInstructions }; sensors?: Array<{ options?: { activationConstraint?: { distance?: number } } }> }) => {
      mocks.dragEnd = onDragEnd;
      mocks.dragStart = onDragStart ?? (() => undefined);
      mocks.dragCancel = onDragCancel ?? (() => undefined);
      mocks.sensors = sensors ?? [];
      mocks.accessibility = accessibility ?? {};
      return <>{children}</>;
    },
    DragOverlay: ({ children }: { children: ReactNode }) => children ? <div data-testid="drag-overlay">{children}</div> : null,
  };
});

vi.mock("@/components/kanban/kanban-column", () => ({
  KanbanColumn: ({ column, requests, onOpen }: { column: BoardColumn; requests: RequestRecord[]; onOpen: (request: RequestRecord) => void }) => (
    <section aria-label={`Lista ${column.name}`}>
      <h2>{column.name}</h2>
      {requests.map((request) => <div key={request.id}><button type="button" onClick={() => onOpen(request)}>{request.title}</button><span>{request.assignee?.full_name ?? "—"}</span></div>)}
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

import { KanbanBoard } from "@/components/kanban/kanban-board";

const profiles: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Lucifer", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
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
  requester_name: "Ana",
  assigned_to: profiles[0].id,
  external_url: null,
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

const basePermissions: EffectivePermissions = { canCreate: false, canEdit: false, canMove: true, canDelete: false, canManageColumns: false };

function boardRequests(columnName: string) {
  return within(screen.getByRole("region", { name: `Lista ${columnName}` }));
}

function drag(activeId: string, overId: string) {
  act(() => {
    void mocks.dragEnd({ active: { id: activeId }, over: { id: overId } } as DragEndEvent);
  });
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

beforeEach(() => {
  mocks.createRequest.mockReset();
  mocks.updateRequest.mockReset();
  mocks.moveRequest.mockReset();
  mocks.getRequest.mockReset();
  mocks.deleteRequest.mockReset();
  mocks.channel.mockReset();
  mocks.removeChannel.mockReset();
  mocks.channel.mockImplementation((name: string) => {
    const channel = {
      on: vi.fn((_event: string, _filter: Record<string, unknown>, callback: typeof mocks.requestChange) => {
        if (name === "requests-board") mocks.requestChange = callback;
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

describe("KanbanBoard movement", () => {
  it("move otimisticamente para uma coluna vazia e restaura o cartão inteiro quando a RPC falha", async () => {
    let rejectMove: (error: Error) => void = () => undefined;
    mocks.moveRequest.mockImplementation(() => new Promise<RequestRecord>((_, reject) => { rejectMove = reject; }));
    mocks.getRequest.mockRejectedValue(new Error("offline"));
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    drag(sourceRequest.id, "column-pending");

    await waitFor(() => expect(mocks.getRequest).toHaveBeenCalledWith(sourceRequest.id));
    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível mover a solicitação. O cartão voltou à posição anterior.")).not.toBeInTheDocument();
  });

  it("fecha o diálogo no DELETE Realtime e não ressuscita o cartão após sucesso pendente", async () => {
    const pendingMove = deferred<RequestRecord>();
    mocks.moveRequest.mockReturnValue(pendingMove.promise);
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canDelete: true }} />);

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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[pendingFirst, pendingLast, sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[moving, target]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    act(() => {
      void mocks.dragEnd({
        active: { id: moving.id, rect: { current: { translated: { top: 200 } } } },
        over: { id: target.id, rect: { top: 100, height: 50 } },
      } as unknown as DragEndEvent);
    });

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(moving.id, "column-pending", 3072));
  });

  it("usa o centro do cartão ativo na zona entre o topo e o centro do alvo", async () => {
    const moving = { ...sourceRequest, column_id: "column-pending", status: "pending" as const, position: 1024 };
    const target = { ...pendingLast, position: 2048 };
    mocks.moveRequest.mockResolvedValue({ ...moving, position: 3072 });
    render(<KanbanBoard initialRequests={[moving, target]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    act(() => {
      void mocks.dragEnd({
        active: { id: moving.id, rect: { current: { translated: { top: 110, height: 40 } } } },
        over: { id: target.id, rect: { top: 100, height: 50 } },
      } as unknown as DragEndEvent);
    });

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(moving.id, "column-pending", 3072));
  });

  it("ignora o arraste quando o usuário não tem permissão", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canMove: false }} />);

    drag(sourceRequest.id, "column-pending");

    expect(mocks.moveRequest).not.toHaveBeenCalled();
    expect(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
  });

  it("resolve a ação fixa e usa o responsável canônico retornado", async () => {
    mocks.moveRequest.mockResolvedValue({ ...sourceRequest, assigned_to: profiles[1].id, column_id: "column-completed", status: "completed", position: 1024, assignee: undefined });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    await waitFor(() => expect(mocks.moveRequest).toHaveBeenCalledWith(sourceRequest.id, "column-completed", 1024));
    expect(boardRequests("Concluído").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Concluído").getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Solicitação movida.");
  });

  it("mostra um erro em português se a coluna fixa não existir", async () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns.filter((column) => column.system_key !== "completed")} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

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
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Nova demanda" } });
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[0].id } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.createRequest).toHaveBeenCalledWith({ title: "Nova demanda", description: "", requesterName: "Mariana", assignedTo: profiles[0].id, externalUrl: "" }, "owner", 1024));
    expect(boardRequests("Lucifer").getByRole("button", { name: "Nova demanda" })).toBeInTheDocument();
    expect(boardRequests("Lucifer").getByText("Lucifer", { selector: "span" })).toBeInTheDocument();
    const notice = await screen.findByText("Solicitação criada.");
    expect(notice.closest('[role="status"]')).toHaveClass("fixed", "bottom-6", "left-1/2");

    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 3100)); });
    expect(screen.queryByText("Solicitação criada.")).not.toBeInTheDocument();
  });

  it("confia no column_id retornado ao editar e recompõe a relação do novo responsável", async () => {
    mocks.updateRequest.mockResolvedValue({ ...sourceRequest, assigned_to: profiles[1].id, column_id: "column-pending", status: "pending", assignee: undefined });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[1].id } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalled());
    expect(boardRequests("Pendente").getByRole("button", { name: sourceRequest.title })).toBeInTheDocument();
    expect(boardRequests("Pendente").getByText("Bruno")).toBeInTheDocument();
  });

  it("usa o responsável recebido por Realtime ao editar somente o título", async () => {
    const realtimeRequest = { ...sourceRequest, assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name } };
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    mocks.updateRequest.mockResolvedValue({ ...realtimeRequest, title: "Título atualizado" });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await emitRequestUpdate(sourceRequest.id);
    await waitFor(() => expect(screen.getByLabelText("Responsável")).toHaveValue(profiles[1].id));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalledWith(sourceRequest.id, expect.objectContaining({ title: "Título atualizado", assignedTo: profiles[1].id })));
  });

  it("sincroniza campos remotos não alterados e preserva o título local dirty", async () => {
    const realtimeRequest = {
      ...sourceRequest,
      title: "Título remoto",
      description: "Descrição remota",
      requester_name: "Solicitante remoto",
      assigned_to: profiles[1].id,
      external_url: "https://example.com/remoto",
      assignee: { id: profiles[1].id, full_name: profiles[1].full_name },
    };
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    mocks.updateRequest.mockResolvedValue({ ...realtimeRequest, title: "Título local" });
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canEdit: true }} />);

    fireEvent.click(boardRequests("Lucifer").getByRole("button", { name: sourceRequest.title }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Título local" } });
    await emitRequestUpdate(sourceRequest.id);

    expect(screen.getByLabelText("Título")).toHaveValue("Título local");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Descrição remota");
    expect(screen.getByLabelText("Solicitante")).toHaveValue("Solicitante remoto");
    expect(screen.getByLabelText("Responsável")).toHaveValue(profiles[1].id);
    expect(screen.getByLabelText("Link externo")).toHaveValue("https://example.com/remoto");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mocks.updateRequest).toHaveBeenCalledWith(sourceRequest.id, {
      title: "Título local",
      description: "Descrição remota",
      requesterName: "Solicitante remoto",
      assignedTo: profiles[1].id,
      externalUrl: "https://example.com/remoto",
    }));
  });

  it("preserva a linha Realtime quando ela chega antes da resposta atrasada da criação", async () => {
    const createResponse = deferred<RequestRecord>();
    const requestId = "request-created-race";
    const realtimeRequest = { ...sourceRequest, id: requestId, title: "Versão Realtime", assigned_to: profiles[1].id, assignee: { id: profiles[1].id, full_name: profiles[1].full_name }, column_id: "column-completed", status: "completed" as const, position: 2048 };
    const staleRpcRequest = { ...sourceRequest, id: requestId, title: "Versão RPC", assignee: undefined };
    mocks.createRequest.mockReturnValue(createResponse.promise);
    mocks.getRequest.mockResolvedValue(realtimeRequest);
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Versão RPC" } });
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[0].id } });
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
    render(<KanbanBoard initialRequests={[]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={{ ...basePermissions, canCreate: true }} />);

    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Resposta atrasada" } });
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Mariana" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[0].id } });
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
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(mocks.sensors[0]?.options?.activationConstraint?.distance).toBe(8);
  });

  it("mostra uma prévia flutuante apenas durante o arraste", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(screen.queryByTestId("drag-overlay")).not.toBeInTheDocument();
    act(() => mocks.dragStart({ active: { id: sourceRequest.id } }));
    expect(screen.getByTestId("drag-overlay")).toHaveTextContent(sourceRequest.title);

    act(() => mocks.dragCancel());
    expect(screen.queryByTestId("drag-overlay")).not.toBeInTheDocument();
  });

  it("fornece instruções e anúncios de arraste em português com nomes", () => {
    render(<KanbanBoard initialRequests={[sourceRequest]} initialColumns={columns} profiles={profiles} currentUserId="owner" permissions={basePermissions} />);

    expect(mocks.accessibility.screenReaderInstructions?.draggable).toMatch(/barra de espaço/i);
    expect(mocks.accessibility.announcements?.onDragStart({ active: { id: sourceRequest.id } } as Parameters<Announcements["onDragStart"]>[0])).toContain(sourceRequest.title);
    expect(mocks.accessibility.announcements?.onDragOver({ active: { id: sourceRequest.id }, over: { id: "column-pending" } } as Parameters<Announcements["onDragOver"]>[0])).toContain("Pendente");
  });
});
