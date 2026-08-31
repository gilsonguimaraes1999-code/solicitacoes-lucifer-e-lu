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

  it("exclui responsáveis já representados e mantém o nome vinculado ao cadastro", () => {
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lista de responsável" }));

    const select = screen.getByLabelText("Responsável");
    expect(select).not.toHaveTextContent("Ana");
    expect(select).toHaveTextContent("Bruno");

    fireEvent.change(select, { target: { value: "22222222-2222-4222-8222-222222222222" } });
    expect(screen.queryByLabelText("Nome da lista")).not.toBeInTheDocument();
    expect(screen.getByText("O nome da lista acompanha o cadastro do responsável.")).toBeInTheDocument();
  });

  it("envia uma lista de responsável com o tipo explícito", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lista de responsável" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ kind: "assignee", name: "Bruno", assigneeId: "22222222-2222-4222-8222-222222222222", color: "#a78bfa" }));
  });

  it("mantém a lista personalizada disponível e envia o tipo custom com responsável nulo", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<AddColumn columns={columns} profiles={[profiles[0]]} canManageColumns onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lista personalizada" }));
    fireEvent.change(screen.getByLabelText("Nome da lista"), { target: { value: "Prioridades" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ kind: "custom", name: "Prioridades", assigneeId: null, color: "#d4af37" }));
  });

  it("desabilita o envio enquanto cria e mostra falha em português", async () => {
    let rejectCreate: (error: Error) => void = () => undefined;
    const onCreate = vi.fn().mockImplementation(() => new Promise<void>((_, reject) => { rejectCreate = reject; }));
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lista de responsável" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "22222222-2222-4222-8222-222222222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar lista" }));

    expect(screen.getByRole("button", { name: "Adicionando..." })).toBeDisabled();
    rejectCreate(new Error("falha"));
    expect(await screen.findByText("Não foi possível adicionar a lista. Tente novamente.")).toBeInTheDocument();
  });

  it("permite escolher uma lista personalizada quando não há responsáveis elegíveis", () => {
    render(<AddColumn columns={columns} profiles={[profiles[0]]} canManageColumns onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    expect(screen.getByRole("button", { name: "Lista personalizada" })).toBeInTheDocument();
  });

  it("não abre o seletor de cor ao clicar no texto da linha", () => {
    render(<AddColumn columns={columns} profiles={profiles} canManageColumns onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /adicionar outra lista/i }));
    fireEvent.click(screen.getByRole("button", { name: "Lista personalizada" }));
    const colorInput = screen.getByLabelText("Cor da lista");
    const onColorClick = vi.fn();
    colorInput.addEventListener("click", onColorClick);

    fireEvent.click(screen.getByText("Cor da lista"));

    expect(onColorClick).not.toHaveBeenCalled();
  });
});

describe("ColumnActions", () => {
  it("permite renomear colunas de sistema, mas não excluí-las", () => {
    const systemColumn: BoardColumn = { ...columns[0], name: "Pendente", kind: "system", assignee_id: null, system_key: "pending" };
    render(<ColumnActions column={systemColumn} canManageColumns canMoveRight onRename={vi.fn()} onReorder={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Pendente" }));

    expect(screen.getByRole("button", { name: "Mover lista Pendente para a esquerda" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mover lista Pendente para a direita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Renomear lista" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir lista" })).not.toBeInTheDocument();
  });

  it("não permite renomear nem excluir colunas de responsável", () => {
    render(<ColumnActions column={columns[0]} canManageColumns canMoveRight onRename={vi.fn()} onReorder={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Ana" }));

    expect(screen.getByRole("button", { name: "Mover lista Ana para a direita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Renomear lista" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir lista" })).not.toBeInTheDocument();
  });

  it("não exibe menu sem permissão para gerenciar colunas", () => {
    render(<ColumnActions column={{ ...columns[0], kind: "system", assignee_id: null, system_key: "pending" }} canManageColumns={false} onRename={vi.fn()} onReorder={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /abrir ações da lista/i })).not.toBeInTheDocument();
  });

  it("exibe ações administrativas para listas personalizadas", () => {
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    render(<ColumnActions column={customColumn} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Prioridades" }));

    expect(screen.getByRole("button", { name: "Renomear lista" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir lista" })).toBeInTheDocument();
  });

  it("abre a edição ao montar uma lista customizada a partir do clique no nome", () => {
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    render(<ColumnActions column={customColumn} canManageColumns initialRenaming onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText("Novo nome da lista")).toHaveValue("Prioridades");
    expect(screen.getByLabelText("Cor da lista")).toHaveValue("#d4af37");
  });

  it("renomeia a coluna usando o nome validado", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const systemColumn: BoardColumn = { ...columns[0], name: "Pendente", kind: "system", assignee_id: null, system_key: "pending" };
    render(<ColumnActions column={systemColumn} canManageColumns onRename={onRename} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Pendente" }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear lista" }));
    fireEvent.change(screen.getByLabelText("Novo nome da lista"), { target: { value: "Aguardando" } });
    fireEvent.change(screen.getByLabelText("Cor da lista"), { target: { value: "#ff3366" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", "Aguardando", "#ff3366"));
  });

  it("permite editar somente a cor de uma coluna de responsável", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(<ColumnActions column={{ ...columns[0], color: "#a78bfa" }} canManageColumns onRename={onRename} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar cor" }));
    expect(screen.queryByLabelText("Novo nome da lista")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cor da lista"), { target: { value: "#12abef" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith(columns[0].id, "Ana", "#12abef"));
  });

  it("não abre o seletor de cor ao clicar no texto da linha de edição", () => {
    const systemColumn: BoardColumn = { ...columns[0], name: "Pendente", kind: "system", assignee_id: null, system_key: "pending" };
    render(<ColumnActions column={systemColumn} canManageColumns initialRenaming onRename={vi.fn()} onDelete={vi.fn()} />);

    const colorInput = screen.getByLabelText("Cor da lista");
    const onColorClick = vi.fn();
    colorInput.addEventListener("click", onColorClick);

    fireEvent.click(screen.getByText("Cor"));

    expect(onColorClick).not.toHaveBeenCalled();
  });

  it("fecha o menu quando o usuário clica fora dele", () => {
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    render(<ColumnActions column={customColumn} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Prioridades" }));
    expect(screen.getByRole("button", { name: "Renomear lista" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Renomear lista" })).not.toBeInTheDocument();
  });

  it("fecha o editor de nome quando o usuário clica fora dele", () => {
    const systemColumn: BoardColumn = { ...columns[0], name: "Pendente", kind: "system", assignee_id: null, system_key: "pending" };
    render(<ColumnActions column={systemColumn} canManageColumns initialRenaming onRename={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText("Novo nome da lista")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByLabelText("Novo nome da lista")).not.toBeInTheDocument();
  });

  it("inicia a edição com o nome remoto mais recente", () => {
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    const { rerender } = render(<ColumnActions column={customColumn} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);

    rerender(<ColumnActions column={{ ...customColumn, name: "Nome recebido em tempo real" }} canManageColumns onRename={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Nome recebido em tempo real" }));
    fireEvent.click(screen.getByRole("button", { name: "Renomear lista" }));

    expect(screen.getByLabelText("Novo nome da lista")).toHaveValue("Nome recebido em tempo real");
  });

  it("informa quando a coluna ocupada não pode ser excluída", async () => {
    const onDelete = vi.fn().mockRejectedValue({ code: "23503" });
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    render(<ColumnActions column={customColumn} canManageColumns onRename={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Prioridades" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir lista" }));
    expect(screen.getByRole("dialog", { name: "Confirmar exclusão da lista" })).toBeInTheDocument();
    expect(screen.getByText("Prioridades")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    expect(await screen.findByText("Mova os cartões antes de excluir esta coluna.")).toBeInTheDocument();
  });

  it("cancela a confirmação sem excluir a lista", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const customColumn: BoardColumn = { ...columns[0], name: "Prioridades", kind: "custom", system_key: null, assignee_id: null };
    render(<ColumnActions column={customColumn} canManageColumns onRename={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir ações da lista Prioridades" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir lista" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Confirmar exclusão da lista" })).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
