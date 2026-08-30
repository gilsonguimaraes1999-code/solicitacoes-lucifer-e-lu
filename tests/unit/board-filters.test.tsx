import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardFilters } from "@/components/kanban/board-filters";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import type { BoardColumn } from "@/features/columns/types";
import type { RequestRecord } from "@/features/requests/types";

const columns: BoardColumn[] = [
  { id: "column-pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1024, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2048, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3072, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-lucifer", name: "Lucifer", kind: "assignee", system_key: null, assignee_id: "profile-lucifer", position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const requests: RequestRecord[] = [
  { id: "request-1", title: "Primeiro", description: null, requester_name: "Ana", assigned_to: "profile-lucifer", external_url: null, tags: ["hub", "outros"], status: null, column_id: "column-lucifer", position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "profile-lucifer", full_name: "Lucifer" } },
  { id: "request-2", title: "Segundo", description: null, requester_name: "Bruno", assigned_to: "profile-lucifer", external_url: null, tags: ["jogo"], status: "pending", column_id: "column-pending", position: 1024, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: { id: "profile-lucifer", full_name: "Lucifer" } },
];

afterEach(cleanup);

describe("BoardFilters", () => {
  it("exibe todos os chips com contagens por column_id e troca o filtro selecionado", () => {
    const onChange = vi.fn();

    render(<BoardFilters columns={columns} requests={requests} selected="all" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Todos (2)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pendente (1)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Em progresso (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluído (0)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lucifer (1)" }));
    expect(onChange).toHaveBeenCalledWith("column-lucifer");
  });

  it("exibe contagens de tags e permite selecionar várias", () => {
    const onTagChange = vi.fn();
    render(<BoardFilters columns={columns} requests={requests} selected="all" onChange={vi.fn()} selectedTags={["hub"]} onTagChange={onTagChange} />);

    expect(screen.getByRole("button", { name: /HUB.*1/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Jogo.*1/ })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Jogo.*1/ }));
    expect(onTagChange).toHaveBeenCalledWith(["hub", "jogo"]);
  });
});

describe("KanbanColumn", () => {
  it("renderiza o nome e a contagem de uma coluna genérica", () => {
    render(<KanbanColumn column={columns[3]} requests={requests.filter((request) => request.column_id === columns[3].id)} canMove={false} canManageColumns={false} onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Lucifer" })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();
  });

  it("usa o cartão inteiro para abrir e arrastar sem exibir um botão de arraste", () => {
    const onOpen = vi.fn();
    const { container } = render(<KanbanColumn column={columns[3]} requests={[requests[0]]} canMove canManageColumns={false} onOpen={onOpen} onRename={vi.fn()} onDelete={vi.fn()} />);

    const card = container.querySelector("article");
    expect(card).not.toBeNull();
    if (!card) return;
    expect(card.style.touchAction).toBe("none");
    expect(card).not.toHaveTextContent("Arrastar");

    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("mostra somente os ícones das tags no cartão", () => {
    render(<KanbanColumn column={columns[3]} requests={[requests[0]]} canMove={false} canManageColumns={false} onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText("Tag HUB")).toHaveTextContent("⚙️");
    expect(screen.getByLabelText("Tag Outros")).toHaveTextContent("🔁");
    expect(screen.queryByText("HUB")).not.toBeInTheDocument();
    expect(screen.queryByText("Outros")).not.toBeInTheDocument();
  });
});
