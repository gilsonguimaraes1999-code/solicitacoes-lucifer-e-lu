import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn } from "@/features/columns/types";
import type { Profile } from "@/features/requests/types";
import { AddColumn } from "@/components/kanban/add-column";
import { ColumnActions } from "@/components/kanban/column-actions";

const profiles: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Ana", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const columns: BoardColumn[] = [{ id: "33333333-3333-4333-8333-333333333333", name: "Ana", kind: "assignee", system_key: null, assignee_id: "11111111-1111-4111-8111-111111111111", position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" }];

afterEach(() => cleanup());

describe("AddColumn", () => {
  it("não renderiza o controle para quem não pode gerenciar colunas", () => {
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns={false} onCreate={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /adicionar outra lista/i })).not.toBeInTheDocument();
  });

  it("exclui responsáveis já representados e preenche o nome ao selecionar", () => {
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));

    const select = screen.getByLabelText("Responsável");
    expect(select).not.toHaveTextContent("Ana");
    expect(select).toHaveTextContent("Bruno");

    fireEvent.change(select, { target: { value: "22222222-2222-4222-8222-222222222222" } });
    expect(screen.getByLabelText("Nome da lista")).toHaveValue("Bruno");
  });

  it("envia nome e responsável selecionado", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    fireEvent.change(screen.getByLabelText("Nome da lista"), { target: { value: "Atendimento Bruno" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: "Atendimento Bruno", assigneeId: "22222222-2222-4222-8222-222222222222" }));
  });

  it("desabilita o envio enquanto cria e mostra falha em português", async () => {
    let rejectCreate: (error: Error) => void = () => undefined;
    const onCreate = vi.fn().mockImplementation(() => new Promise<void>((_, reject) => { rejectCreate = reject; }));
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    expect(screen.getByRole("button", { name: "Adicionando..." })).toBeDisabled();
    rejectCreate(new Error("falha"));
    expect(await screen.findByText("Não foi possível adicionar a lista. Tente novamente.")).toBeInTheDocument();
  });

  it("permite cancelar quando não há responsáveis elegíveis", () => {
    render(<AddColumn columns={columns} profiles={[profiles[0]]} canManageColumns onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    expect(screen.getByText("Todos os responsáveis aprovados já possuem uma lista.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: /adicionar outra lista/i })).toBeInTheDocument();
  });
});

describe("ColumnActions", () => {
  it("não exibe ações para colunas de sistema ou sem permissão", () => {
    render(<><ColumnActions column={{ ...columns[0], kind: "system", assignee_id: null, system_key: "pending" }} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} /><ColumnActions column={columns[0]} canManageColumns={false} onRename={vi.fn()} onDelete={vi.fn()} /></>);

    expect(screen.queryByRole("button", { name: "Renomear lista" })).not.toBeInTheDocument();
  });

  it("renomeia a coluna usando o nome validado", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(<ColumnActions column={columns[0]} canManageColumns onRename={onRename} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear lista" }));
    fireEvent.change(screen.getByLabelText("Novo nome da lista"), { target: { value: "Atendimento Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", "Atendimento Ana"));
  });

  it("inicia a edição com o nome remoto mais recente", () => {
    const { rerender } = render(<ColumnActions column={columns[0]} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);

    rerender(<ColumnActions column={{ ...columns[0], name: "Nome recebido em tempo real" }} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Nome recebido em tempo real" }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear lista" }));

    expect(screen.getByLabelText("Novo nome da lista")).toHaveValue("Nome recebido em tempo real");
  });

  it("informa quando a coluna ocupada não pode ser excluída", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDelete = vi.fn().mockRejectedValue({ code: "23503" });
    render(<ColumnActions column={columns[0]} canManageColumns onRename={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir lista" }));

    expect(await screen.findByText("Mova os cartões antes de excluir esta coluna.")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
