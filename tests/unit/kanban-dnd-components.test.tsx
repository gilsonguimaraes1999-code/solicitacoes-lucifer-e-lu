import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";

const mocks = vi.hoisted(() => ({
  sortableArguments: [] as Array<Record<string, unknown>>,
  dragPointerDown: vi.fn(),
  dragKeyDown: vi.fn(),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/core")>();
  return { ...original, useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }) };
});

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...original,
    SortableContext: ({ children }: { children: ReactNode }) => children,
    useSortable: (arguments_: Record<string, unknown>) => {
      mocks.sortableArguments.push(arguments_);
      return {
        attributes: { role: "button", tabIndex: 0, "data-drag-attribute": "true" },
        listeners: { onPointerDown: mocks.dragPointerDown, onKeyDown: mocks.dragKeyDown },
        setNodeRef: vi.fn(),
        setActivatorNodeRef: vi.fn(),
        transform: null,
        transition: undefined,
        isDragging: false,
        isOver: false,
      };
    },
  };
});

import { KanbanColumn } from "@/components/kanban/kanban-column";
import { RequestCard } from "@/components/kanban/request-card";

const customColumn: BoardColumn = { id: "column-priorities", name: "Prioridades", kind: "custom", system_key: null, assignee_id: null, position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };
const systemColumn: BoardColumn = { ...customColumn, id: "column-pending", name: "Pendente", kind: "system", system_key: "pending" };
const assigneeColumn: BoardColumn = { ...customColumn, id: "column-lucifer", name: "Lucifer", kind: "assignee", system_key: null, assignee_id: "profile-1" };
const request: RequestRecord = { id: "request-1", title: "Pedido", description: null, cities: [], assigned_to: "profile-1", external_url: null, tags: [], status: null, column_id: customColumn.id, position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "profile-1", full_name: "Lucifer" } };

beforeEach(() => {
  mocks.sortableArguments = [];
  mocks.dragPointerDown.mockClear();
  mocks.dragKeyDown.mockClear();
});

afterEach(cleanup);

describe("Kanban DnD components", () => {
  it("cresce com as solicitações sem ultrapassar a altura disponível do quadro", () => {
    const { container } = render(<KanbanColumn column={customColumn} requests={[request]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    const column = container.querySelector("section");
    const requestList = screen.getByLabelText(`Solicitações em ${customColumn.name}`);

    expect(column).toHaveClass("flex", "max-h-full", "min-h-0", "flex-col");
    expect(column).not.toHaveClass("h-full");
    expect(requestList).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(requestList).not.toHaveClass("max-h-[min(28rem,calc(100dvh-18rem))]");
  });

  it("declara o tipo e a coluna do cartão sem perder abertura pelo clique", () => {
    const onOpen = vi.fn();
    render(<RequestCard request={request} canMove onOpen={onOpen} />);

    expect(mocks.sortableArguments[0]).toEqual(expect.objectContaining({ id: request.id, data: { type: "request", columnId: customColumn.id } }));
    fireEvent.click(screen.getByRole("button", { name: `Abrir ${request.title}` }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("mantém o pointer drag no cabeçalho e isola semântica e teclado em um botão dedicado", () => {
    const { container } = render(<KanbanColumn column={customColumn} requests={[]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(mocks.sortableArguments[0]).toEqual(expect.objectContaining({ id: customColumn.id, data: { type: "column" }, disabled: { draggable: false, droppable: false } }));
    const header = container.querySelector("header");
    expect(header).not.toHaveAttribute("role");
    expect(header).not.toHaveAttribute("tabindex");
    expect(header).not.toHaveAttribute("data-drag-attribute");
    expect(screen.queryByRole("button", { name: `Arrastar lista ${customColumn.name}` })).not.toBeInTheDocument();
    expect(header?.querySelector("button button")).toBeNull();

    fireEvent.pointerDown(header!);
    expect(mocks.dragPointerDown).toHaveBeenCalledOnce();
  });

  it("edita pelo nome custom e abre o menu sem iniciar o arraste da coluna", () => {
    render(<KanbanColumn column={customColumn} requests={[]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: `Renomear lista ${customColumn.name}` }));
    fireEvent.click(screen.getByRole("button", { name: `Renomear lista ${customColumn.name}` }));
    expect(screen.getByLabelText("Novo nome da lista")).toHaveValue(customColumn.name);
    expect(mocks.dragPointerDown).not.toHaveBeenCalled();

    fireEvent.pointerDown(screen.getByRole("button", { name: `Abrir ações da lista ${customColumn.name}` }));
    expect(mocks.dragPointerDown).not.toHaveBeenCalled();
  });

  it("permite editar o título de uma coluna de sistema", () => {
    render(<KanbanColumn column={systemColumn} requests={[]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Renomear lista Pendente" }));

    expect(screen.getByLabelText("Novo nome da lista")).toHaveValue("Pendente");
  });

  it("mantém o título de responsável vinculado ao cadastro", () => {
    render(<KanbanColumn column={assigneeColumn} requests={[]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 2, name: "Lucifer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renomear lista Lucifer" })).not.toBeInTheDocument();
  });

  it("preserva Escape para a acessibilidade do menu sem ativar o teclado do drag", () => {
    const onKeyDown = vi.fn();
    render(<div onKeyDown={onKeyDown}><KanbanColumn column={customColumn} requests={[]} canMove canManageColumns canReorderColumn onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} /></div>);
    const menuButton = screen.getByRole("button", { name: `Abrir ações da lista ${customColumn.name}` });

    fireEvent.keyDown(menuButton, { key: "Escape" });

    expect(onKeyDown).toHaveBeenCalledOnce();
  });
});
