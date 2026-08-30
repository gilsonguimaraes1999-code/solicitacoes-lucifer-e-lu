import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserEditor } from "@/components/users/user-editor";
import { UsersPanel } from "@/components/users/users-panel";
import { sortUsersByName } from "@/features/users/filter-users";

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => {
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    return { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  },
}));

const member = {
  id: "member-id",
  email: "lua@example.com",
  full_name: "Lua",
  role: "member" as const,
  approval_status: "pending" as const,
  created_at: "2026-08-30T00:00:00Z",
  permissions: {
    can_create_requests: false,
    can_edit_requests: false,
    can_move_requests: false,
    can_delete_requests: false,
    can_manage_columns: false,
  },
};

afterEach(() => cleanup());

describe("UsersPanel", () => {
  it("reserva espaço antes do texto para o ícone de pesquisa", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<UsersPanel currentUserId="owner-id" />);

    expect(screen.getByPlaceholderText("Pesquisar por nome ou e-mail")).toHaveStyle({ paddingLeft: "2.75rem" });
    vi.unstubAllGlobals();
  });

  it("fecha a edição sem exibir a faixa persistente de alterações salvas", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/admin/users/") && init?.method === "PATCH") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => [member] };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<UsersPanel currentUserId="owner-id" />);

    await screen.findByText("Lua");
    fireEvent.click(screen.getByRole("button", { name: "Editar Lua" }));
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Lua Silva" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuário" })).not.toBeInTheDocument());
    expect(screen.queryByText("Alterações salvas com sucesso.")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("exibe a exclusão de usuário como toast no centro inferior", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/admin/users/") && init?.method === "DELETE") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => [member] };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<UsersPanel currentUserId="owner-id" />);

    await screen.findByText("Lua");
    fireEvent.click(screen.getByRole("button", { name: "Editar Lua" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent("Conta de Lua excluída.");
    expect(toast).toHaveClass("fixed", "bottom-6", "left-1/2");
    vi.unstubAllGlobals();
  });
});

describe("UserEditor", () => {
  it("salva nome, aprovação e permissões editados no modal", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserEditor user={member} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Lua Silva" } });
    fireEvent.change(screen.getByLabelText("Status da conta"), { target: { value: "approved" } });
    fireEvent.click(screen.getByLabelText("Criar solicitações"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("member-id", {
      fullName: "Lua Silva",
      approvalStatus: "approved",
      permissions: { ...member.permissions, can_create_requests: true },
    }));
  });

  it("mantém status e permissões nativas do owner protegidos", () => {
    render(<UserEditor user={{ ...member, id: "owner-id", role: "owner", approval_status: "approved" }} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByLabelText("Status da conta")).toBeDisabled();
    expect(screen.getByLabelText("Criar solicitações")).toBeChecked();
    expect(screen.getByLabelText("Criar solicitações")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Excluir conta" })).not.toBeInTheDocument();
  });

  it("confirma a exclusão de uma conta de membro com nome e e-mail", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<UserEditor user={member} onClose={vi.fn()} onSave={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));

    expect(screen.getByRole("dialog", { name: "Confirmar exclusão da conta" })).toHaveTextContent("Lua");
    expect(screen.getByRole("dialog", { name: "Confirmar exclusão da conta" })).toHaveTextContent("lua@example.com");
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("member-id"));
  });
});

describe("sortUsersByName", () => {
  it("ordena nomes com acentos em português nos dois sentidos", () => {
    const users = [
      { ...member, id: "2", fullName: "Zeca", approvalStatus: "pending" as const },
      { ...member, id: "1", fullName: "Ágata", approvalStatus: "approved" as const },
    ];

    expect(sortUsersByName(users, "asc").map((user) => user.fullName)).toEqual(["Ágata", "Zeca"]);
    expect(sortUsersByName(users, "desc").map((user) => user.fullName)).toEqual(["Zeca", "Ágata"]);
  });
});

