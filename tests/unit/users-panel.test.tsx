import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserEditor } from "@/components/users/user-editor";
import { sortUsersByName } from "@/features/users/filter-users";

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
    render(<UserEditor user={{ ...member, id: "owner-id", role: "owner", approval_status: "approved" }} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByLabelText("Status da conta")).toBeDisabled();
    expect(screen.getByLabelText("Criar solicitações")).toBeChecked();
    expect(screen.getByLabelText("Criar solicitações")).toBeDisabled();
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
