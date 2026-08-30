import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  sessionFrom: vi.fn(),
  listUsers: vi.fn(),
  adminFrom: vi.fn(),
  profilesOrder: vi.fn(),
  permissionsSelect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: mocks.listUsers } },
    from: mocks.adminFrom,
  }),
}));

import { GET } from "@/app/api/admin/users/route";

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } } });
    mocks.profileSingle.mockResolvedValue({ data: { role: "owner", approval_status: "approved" } });
    mocks.sessionFrom.mockReturnValue({ select: () => ({ eq: () => ({ single: mocks.profileSingle }) }) });
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: "member-id", email: "lua@example.com", created_at: "2026-08-30T00:00:00Z" }] },
      error: null,
    });
    mocks.profilesOrder.mockResolvedValue({
      data: [{ id: "member-id", full_name: "Lua", role: "member", approval_status: "pending", created_at: "2026-08-30T00:00:00Z" }],
      error: null,
    });
    mocks.permissionsSelect.mockResolvedValue({ data: [], error: null });
    mocks.adminFrom.mockImplementation((table: string) => table === "profiles"
      ? { select: () => ({ order: mocks.profilesOrder }) }
      : { select: mocks.permissionsSelect });
  });

  it("combina Auth e perfil completo para os filtros de status", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([expect.objectContaining({
      id: "member-id",
      email: "lua@example.com",
      full_name: "Lua",
      role: "member",
      approval_status: "pending",
    })]);
  });

  it("não devolve usuários incompletos quando a leitura de perfis falha", async () => {
    mocks.profilesOrder.mockResolvedValue({ data: null, error: { message: "permission denied for table profiles" } });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Não foi possível carregar os perfis dos usuários." });
  });

  it("não esconde falha ao carregar permissões", async () => {
    mocks.permissionsSelect.mockResolvedValue({ data: null, error: { message: "permission denied for table user_permissions" } });

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Não foi possível carregar as permissões dos usuários." });
  });

  it("informa explicitamente quando uma conta do Auth está sem perfil", async () => {
    mocks.profilesOrder.mockResolvedValue({ data: [], error: null });

    const response = await GET();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "A conta lua@example.com está sem perfil. Restaure o perfil antes de administrá-la." });
  });
});
