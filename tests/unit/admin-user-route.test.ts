import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  profileEq: vi.fn(),
  profileSelect: vi.fn(),
  sessionFrom: vi.fn(),
  adminFrom: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.sessionFrom,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mocks.adminFrom }),
}));

import { PATCH } from "@/app/api/admin/users/[id]/route";

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-id" } } });
    mocks.profileSingle.mockResolvedValue({ data: { role: "owner", approval_status: "approved" } });
    mocks.profileEq.mockReturnValue({ single: mocks.profileSingle });
    mocks.profileSelect.mockReturnValue({ eq: mocks.profileEq });
    mocks.sessionFrom.mockReturnValue({ select: mocks.profileSelect });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.adminFrom.mockReturnValue({ upsert: mocks.upsert });
  });

  it("cria permissões ausentes com os cinco campos", async () => {
    const permissions = {
      can_create_requests: true,
      can_edit_requests: false,
      can_move_requests: true,
      can_delete_requests: false,
      can_manage_columns: true,
    };
    const response = await PATCH(new Request("http://localhost/api/admin/users/member-id", {
      method: "PATCH",
      body: JSON.stringify({ action: "permissions", permissions }),
    }), { params: Promise.resolve({ id: "member-id" }) });

    expect(response.status).toBe(200);
    expect(mocks.adminFrom).toHaveBeenCalledWith("user_permissions");
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "member-id", ...permissions }, { onConflict: "user_id" });
  });
});
