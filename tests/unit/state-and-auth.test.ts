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
  column_id: "44444444-4444-4444-8444-444444444444",
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
    const moved = requestsReducer(twice, { type: "update", request: { ...card, column_id: "55555555-5555-4555-8555-555555555555", position: 2048 } });
    expect(moved[0].column_id).toBe("55555555-5555-4555-8555-555555555555");
    const restored = requestsReducer(moved, { type: "snapshot", requests: [...once, ...once] });
    expect(restored).toHaveLength(1);
    expect(restored[0].column_id).toBe(card.column_id);
  });

  it("ordena cartões por coluna, posição e id", () => {
    const laterId = { ...card, id: "99999999-9999-4999-8999-999999999999", column_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", position: 1 };
    const earlierColumn = { ...card, id: "88888888-8888-4888-8888-888888888888", column_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", position: 9999 };
    const earlierPosition = { ...card, id: "77777777-7777-4777-8777-777777777777", column_id: laterId.column_id, position: 0 };

    expect(requestsReducer([], { type: "snapshot", requests: [laterId, earlierPosition, earlierColumn] }).map((request) => request.id)).toEqual([
      earlierColumn.id,
      earlierPosition.id,
      laterId.id,
    ]);
  });

  it("reconcilia cartões em coluna de responsável sem status legado", () => {
    const assigneeCard: RequestRecord = { ...card, status: null, column_id: "55555555-5555-4555-8555-555555555555" };

    expect(requestsReducer([], { type: "insert", request: assigneeCard })).toEqual([assigneeCard]);
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
    expect(effectivePermissions({ role: "owner", approval_status: "approved" }, null)).toEqual({
      canCreate: true,
      canEdit: true,
      canMove: true,
      canDelete: true,
      canManageColumns: true,
    });
    expect(effectivePermissions({ role: "member", approval_status: "approved" }, { can_create_requests: true })).toMatchObject({
      canCreate: true,
      canEdit: false,
    });
  });
});
