import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  profileEq: vi.fn(),
  profileSelect: vi.fn(),
  sessionFrom: vi.fn(),
  adminFrom: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  targetSelect: vi.fn(),
  targetEq: vi.fn(),
  targetMaybeSingle: vi.fn(),
  rpc: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.adminFrom, rpc: mocks.rpc, auth: { admin: { deleteUser: mocks.deleteUser } } }),
}));

import { DELETE, PATCH } from "@/app/api/admin/users/[id]/route";

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } } });
    mocks.profileSingle.mockResolvedValue({ data: { role: "owner", approval_status: "approved" } });
    mocks.profileEq.mockReturnValue({ single: mocks.profileSingle });
    mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
    mocks.sessionFrom.mockReturnValue({ select: mocks.profileSelect });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.updateEq });
    mocks.targetMaybeSingle.mockResolvedValue({ data: { id: "member-id", role: "member" }, error: null });
    mocks.targetEq.mockReturnValue({ maybeSingle: mocks.targetMaybeSingle });
    mocks.targetSelect.mockReturnValue({ eq: mocks.targetEq });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.adminFrom.mockImplementation((table: string) => table === "profiles"
      ? { select: mocks.targetSelect, update: mocks.update }
      : { upsert: mocks.upsert });
  });

  it("cria permissões ausentes incluindo o gerenciamento de cidades", async () => {
    const permissions = {
      can_create_requests: true,
      can_edit_requests: false,
      can_move_requests: true,
      can_delete_requests: false,
      can_manage_columns: true,
      can_manage_cities: true,
    };
    const response = await PATCH(new Request("http://localhost/api/admin/users/member-id", {
      method: "PATCH",
      body: JSON.stringify({ action: "permissions", permissions }),
    }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(200);
    expect(mocks.adminFrom).toHaveBeenCalledWith("user_permissions");
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "member-id", ...permissions }, { onConflict: "user_id" });
  });

  it("aprova a conta informada e não outra conta", async () => {
    const response = await PATCH(new Request("http://localhost/api/admin/users/member-id", {
      method: "PATCH",
      body: JSON.stringify({ action: "status", approvalStatus: "approved" }),
    }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(200);
    expect(mocks.adminFrom).toHaveBeenCalledWith("profiles");
    expect(mocks.update).toHaveBeenCalledWith({ approval_status: "approved" });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "member-id");
  });

  it("expõe uma mensagem administrativa útil quando a persistência falha", async () => {
    mocks.updateEq.mockResolvedValue({ error: { message: "permission denied for table profiles" } });

    const response = await PATCH(new Request("http://localhost/api/admin/users/member-id", {
      method: "PATCH",
      body: JSON.stringify({ action: "rename", fullName: "Lua" }),
    }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Não foi possível salvar as alterações do usuário." });
  });

  it("retorna 404 em vez de confirmar uma atualização de perfil inexistente", async () => {
    mocks.targetMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(new Request("http://localhost/api/admin/users/missing-id", {
      method: "PATCH",
      body: JSON.stringify({ action: "status", approvalStatus: "approved" }),
    }), { params: Promise.resolve({ id: "missing-id" }) });

    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } } });
    mocks.profileSingle.mockResolvedValue({ data: { role: "owner", approval_status: "approved" } });
    mocks.profileEq.mockReturnValue({ single: mocks.profileSingle });
    mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
    mocks.sessionFrom.mockReturnValue({ select: mocks.profileSelect });
    mocks.targetMaybeSingle.mockResolvedValue({ data: { id: "member-id", role: "member" }, error: null });
    mocks.targetEq.mockReturnValue({ maybeSingle: mocks.targetMaybeSingle });
    mocks.targetSelect.mockReturnValue({ eq: mocks.targetEq });
    mocks.adminFrom.mockReturnValue({ select: mocks.targetSelect });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
  });

  it("protege toda conta owner contra exclusão", async () => {
    mocks.targetMaybeSingle.mockResolvedValue({ data: { id: "another-owner", role: "owner" }, error: null });

    const response = await DELETE(new Request("http://localhost/api/admin/users/another-owner", { method: "DELETE" }), { params: Promise.resolve({ id: "another-owner" }) });

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("realoca os vínculos antes de excluir a autenticação do membro", async () => {
    const response = await DELETE(new Request("http://localhost/api/admin/users/member-id", { method: "DELETE" }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("prepare_member_deletion", { target_user_id: "member-id", replacement_user_id: "owner-id" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("member-id");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  });

  it("não exclui a autenticação quando a realocação falha", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "database error" } });

    const response = await DELETE(new Request("http://localhost/api/admin/users/member-id", { method: "DELETE" }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
