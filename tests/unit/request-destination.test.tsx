import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestDialog } from "@/components/requests/request-dialog";
import type { BoardColumn } from "@/features/columns/types";
import type { Profile, RequestRecord } from "@/features/requests/types";

const profiles: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Lucifer", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", full_name: "Bruno", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "33333333-3333-4333-8333-333333333333", full_name: "Lu", role: "member", approval_status: "approved", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const columns: BoardColumn[] = [
  { id: "column-pending", name: "Pendente", kind: "system", system_key: "pending", assignee_id: null, position: 1024, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-progress", name: "Em progresso", kind: "system", system_key: "in_progress", assignee_id: null, position: 2048, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-completed", name: "Concluído", kind: "system", system_key: "completed", assignee_id: null, position: 3072, created_by: null, created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
  { id: "column-lucifer", name: "Atendimento Lucifer", kind: "assignee", system_key: null, assignee_id: profiles[0].id, position: 4096, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" },
];

const request: RequestRecord = {
  id: "request-1",
  title: "Pedido de acesso",
  description: null,
  requester_name: "Ana",
  assigned_to: profiles[0].id,
  external_url: null,
  tags: ["loja"],
  status: null,
  column_id: "column-lucifer",
  position: 1024,
  created_by: "owner",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
  assignee: { id: profiles[0].id, full_name: profiles[0].full_name },
};

const baseProps = {
  profiles,
  columns,
  canEdit: true,
  canDelete: false,
  canMove: false,
  onClose: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  onMoveToSystem: vi.fn().mockResolvedValue(undefined),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RequestDialog destination", () => {
  it("mostra a coluna vinculada e volta para Pendente ao trocar o responsável", () => {
    render(<RequestDialog {...baseProps} request={null} />);

    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[0].id } });
    expect(screen.getByText("Entrará em: Atendimento Lucifer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[1].id } });
    expect(screen.getByText("Entrará em: Pendente")).toBeInTheDocument();
  });

  it("explica que editar o responsável não move um cartão de coluna fixa", () => {
    const fixedRequest = { ...request, column_id: "column-progress", status: "in_progress" as const };
    render(<RequestDialog {...baseProps} request={fixedRequest} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[1].id } });

    expect(screen.getByText("Ao salvar, continuará em: Em progresso")).toBeInTheDocument();
  });

  it("mantém a coluna assignee atual enquanto o responsável não muda", () => {
    const brunoInLuciferColumn = {
      ...request,
      assigned_to: profiles[1].id,
      assignee: { id: profiles[1].id, full_name: profiles[1].full_name },
    };
    render(<RequestDialog {...baseProps} request={brunoInLuciferColumn} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByText("Ao salvar, continuará em: Atendimento Lucifer")).toBeInTheDocument();
  });

  it("preserva a escolha manual do responsável diante de atualização remota posterior", () => {
    const { rerender } = render(<RequestDialog {...baseProps} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[1].id } });

    const remoteRequest = {
      ...request,
      assigned_to: profiles[2].id,
      assignee: { id: profiles[2].id, full_name: profiles[2].full_name },
    };
    rerender(<RequestDialog {...baseProps} request={remoteRequest} />);

    expect(screen.getByLabelText("Responsável")).toHaveValue(profiles[1].id);
  });
});

describe("RequestDialog tags", () => {
  it("exige uma tag e envia todas as tags selecionadas", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={null} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Nova demanda" } });
    fireEvent.change(screen.getByLabelText("Solicitante"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: profiles[0].id } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Selecione pelo menos uma tag.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));
    fireEvent.click(screen.getByRole("button", { name: "Tag Growth" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ["loja", "growth"] })));
  });

  it("permite trocar as tags ao editar", () => {
    render(<RequestDialog {...baseProps} request={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByRole("button", { name: "Tag Loja" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tag Loja" }));
    fireEvent.click(screen.getByRole("button", { name: "Tag Jogo" }));
    expect(screen.getByRole("button", { name: "Tag Loja" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Tag Jogo" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("RequestDialog status actions", () => {
  it("oculta as ações sem permissão de movimentação", () => {
    render(<RequestDialog {...baseProps} request={request} />);

    expect(screen.queryByRole("button", { name: "Pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Em progresso" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluído" })).not.toBeInTheDocument();
  });

  it("envia a chave exata da ação fixa e fecha após sucesso", async () => {
    const onClose = vi.fn();
    const onMoveToSystem = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={request} canMove onClose={onClose} onMoveToSystem={onMoveToSystem} />);

    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));

    await waitFor(() => expect(onMoveToSystem).toHaveBeenCalledWith("completed"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("desabilita todas as ações enquanto move e mostra a falha em português", async () => {
    let rejectMove: (error: Error) => void = () => undefined;
    const onMoveToSystem = vi.fn().mockImplementation(() => new Promise<void>((_, reject) => { rejectMove = reject; }));
    render(<RequestDialog {...baseProps} request={request} canMove onMoveToSystem={onMoveToSystem} />);

    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    expect(screen.getByRole("button", { name: "Pendente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Em progresso" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Concluído" })).toBeDisabled();

    rejectMove(new Error("A coluna de destino não foi encontrada."));
    expect(await screen.findByText("A coluna de destino não foi encontrada.")).toBeInTheDocument();
  });
});

describe("RequestDialog deletion", () => {
  it("exige confirmação temática antes de excluir a solicitação", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<RequestDialog {...baseProps} request={request} canDelete onDelete={onDelete} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    const confirmation = screen.getByRole("dialog", { name: "Confirmar exclusão da solicitação" });
    expect(within(confirmation).getByText("Pedido de acesso")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancela a confirmação sem excluir", () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<RequestDialog {...baseProps} request={request} canDelete onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog", { name: "Confirmar exclusão da solicitação" })).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
