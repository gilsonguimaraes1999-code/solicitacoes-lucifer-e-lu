import { describe, expect, it } from "vitest";
import { registerSchema } from "@/features/auth/schemas";
import { requestsReducer } from "@/features/requests/reducer";
import { effectivePermissions } from "@/lib/permissions";
import type { RequestRecord } from "@/features/requests/types";

const card: RequestRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Card",
  description: null,
  requester_name: "Pessoa",
  assigned_to: "22222222-2222-4222-8222-222222222222",
  external_url: null,
  status: "pending",
  position: 1024,
  created_by: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
};

describe("requestsReducer", () => {
  it("não duplica eventos realtime e permite rollback", () => {
    const once = requestsReducer([], { type: "insert", request: card });
    const twice = requestsReducer(once, { type: "insert", request: card });
    expect(twice).toHaveLength(1);
    const moved = requestsReducer(twice, { type: "update", request: { ...card, status: "completed" } });
    expect(moved[0].status).toBe("completed");
    expect(requestsReducer(moved, { type: "snapshot", requests: once })[0].status).toBe("pending");
  });
});

describe("registerSchema", () => {
  it("rejeita confirmação diferente", () => {
    const result = registerSchema.safeParse({
      fullName: "Ana Silva",
      email: "ana@example.com",
      password: "SenhaSegura123!",
      confirmPassword: "OutraSenha123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("effectivePermissions", () => {
  it("dá acesso total ao owner e preserva flags do membro", () => {
    expect(effectivePermissions({ role: "owner" }, null)).toEqual({
      canCreate: true,
      canEdit: true,
      canMove: true,
      canDelete: true,
    });
    expect(effectivePermissions({ role: "member" }, { can_create_requests: true })).toMatchObject({
      canCreate: true,
      canEdit: false,
    });
  });
});
