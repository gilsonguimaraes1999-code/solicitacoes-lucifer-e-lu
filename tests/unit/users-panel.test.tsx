import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AccountStatusSelect } from "@/components/users/account-status-select";
import { UserEditor } from "@/components/users/user-editor";
import { UsersPanel } from "@/components/users/users-panel";
import { sortUsersByName } from "@/features/users/filter-users";

const realtime = vi.hoisted(() => ({
  listeners: [] as Array<{ table: string; callback: () => void }>,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => {
    const channel = {
      on: vi.fn((_event: string, filter: { table: string }, callback: () => void) => {
        realtime.listeners.push({ table: filter.table, callback });
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
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
    can_manage_cities: false,
  },
};

beforeEach(() => {
  realtime.listeners = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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

  it("reflete a aprovação imediatamente mesmo se a releitura ainda retornar o estado anterior", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/admin/users/") && init?.method === "PATCH") return { ok: true, json: async () => ({ ok: true }) };
      return { ok: true, json: async () => [member] };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<UsersPanel currentUserId="owner-id" />);

    await screen.findByText("Lua");
    fireEvent.click(screen.getByRole("button", { name: "Aprovar Lua" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Aprovar Lua" })).not.toBeInTheDocument());
    expect(screen.getByText("Aprovados", { selector: ".status-badge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovados 1" })).toBeInTheDocument();
  });

  it("busca novos pedidos de acesso periodicamente quando o Realtime não entrega o evento", async () => {
    vi.useFakeTimers();
    const newcomer = { ...member, id: "new-member-id", email: "nova@example.com", full_name: "Nova" };
    let responseUsers = [member];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => responseUsers })));

    await act(async () => { render(<UsersPanel currentUserId="owner-id" />); });
    expect(screen.queryByText("Nova")).not.toBeInTheDocument();
    responseUsers = [member, newcomer];

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(screen.getByText("Nova")).toBeInTheDocument();
  });
});

describe("UserEditor", () => {
  it("abre o seletor de status com quatro opções e salva a aprovação editada", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserEditor user={member} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Lua Silva" } });
    await user.click(screen.getByRole("button", { name: "Status da conta: Pendente" }));

    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.getByRole("option", { name: "Pendente" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Aprovada" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByText("Selecionar todas")).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Aprovada" }));
    fireEvent.click(screen.getByLabelText("Criar solicitações"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("member-id", {
      fullName: "Lua Silva",
      approvalStatus: "approved",
      permissions: { ...member.permissions, can_create_requests: true },
    }));
  });

  it("fecha o seletor de status com Escape e clique externo, devolvendo foco ao trigger", async () => {
    const user = userEvent.setup();
    const onOutsideClick = vi.fn();
    render(
      <div>
        <UserEditor user={member} onClose={vi.fn()} onSave={vi.fn()} />
        <button type="button" onClick={onOutsideClick}>Fora</button>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Status da conta: Pendente" });
    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Fora" }));

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("fecha o seletor quando fica desabilitado e nao reabre sozinho ao habilitar de novo", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function DisabledHarness() {
      const [disabled, setDisabled] = useState(false);

      return (
        <div>
          <AccountStatusSelect value="pending" onChange={onChange} disabled={disabled} />
          <button type="button" onClick={() => setDisabled(true)}>Desabilitar</button>
          <button type="button" onClick={() => setDisabled(false)}>Habilitar</button>
        </div>
      );
    }

    render(<DisabledHarness />);

    const trigger = screen.getByRole("button", { name: "Status da conta: Pendente" });
    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Desabilitar" }));
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();
    expect(trigger).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Habilitar" }));
    expect(trigger).not.toBeDisabled();
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("nao reabre o listbox se disabled volta para false antes de timers pendentes", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(<AccountStatusSelect value="pending" onChange={onChange} disabled={false} />);

    const trigger = screen.getByRole("button", { name: "Status da conta: Pendente" });
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();

    rerender(<AccountStatusSelect value="pending" onChange={onChange} disabled />);
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();

    rerender(<AccountStatusSelect value="pending" onChange={onChange} disabled={false} />);
    expect(screen.queryByRole("listbox", { name: "Status da conta disponível" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: "Status da conta disponível" })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renderiza em SSR com snapshot inicial fechado e sem erro de hidratação", () => {
    const onChange = vi.fn();

    expect(() => renderToString(
      <AccountStatusSelect value="pending" onChange={onChange} disabled={false} />,
    )).not.toThrow();

    const markup = renderToString(
      <AccountStatusSelect value="pending" onChange={onChange} disabled={false} />,
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('role="listbox"');
  });

  it("expõe Gerenciar cidades e envia a permissão alterada", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserEditor user={member} onClose={vi.fn()} onSave={onSave} />);

    expect(screen.getByText("Permite criar, renomear, desativar e reativar cidades.")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Gerenciar cidades" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("member-id", expect.objectContaining({
      permissions: { ...member.permissions, can_manage_cities: true },
    })));
  });

  it("mantém inputs reais e desenha permissões com marcadores escuros e dourados", () => {
    render(<UserEditor user={member} onClose={vi.fn()} onSave={vi.fn()} />);

    const checkbox = screen.getByRole("checkbox", { name: "Criar solicitações" });
    const marker = checkbox.nextElementSibling;

    expect(checkbox.tagName).toBe("INPUT");
    expect(checkbox).toHaveAttribute("type", "checkbox");
    expect(checkbox).toHaveClass("sr-only");
    expect(marker).toHaveAttribute("aria-hidden", "true");
    expect(marker).toHaveClass("border-white/30", "bg-white/[.03]");

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(checkbox.nextElementSibling).toHaveClass("border-[#d4af37]", "bg-[#d4af37]");
  });

  it("mantém status e permissões nativas do owner protegidos", () => {
    render(<UserEditor user={{ ...member, id: "owner-id", role: "owner", approval_status: "approved" }} onClose={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Status da conta: Aprovada" })).toBeDisabled();
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
