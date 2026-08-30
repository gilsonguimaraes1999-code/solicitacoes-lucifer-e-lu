import { describe, expect, it } from "vitest";
import { positionBetween } from "@/features/requests/ordering";
import { requestSchema } from "@/features/requests/schemas";
import { filterUsersByStatus } from "@/features/users/filter-users";
import { effectivePermissions } from "@/lib/permissions";
import { updateUserSchema } from "@/features/users/schemas";

describe("positionBetween", () => {
  it("cria posições estáveis entre vizinhos", () => {
    expect(positionBetween()).toBe(1024);
    expect(positionBetween(1024)).toBe(2048);
    expect(positionBetween(undefined, 1024)).toBe(512);
    expect(positionBetween(1024, 2048)).toBe(1536);
  });
});

describe("requestSchema", () => {
  it("aceita apenas links http ou https", () => {
    const base = { title: "Solicitação", cityIds: [crypto.randomUUID()], assignedTo: crypto.randomUUID(), tags: ["f1"] };
    expect(requestSchema.safeParse({ ...base, externalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, externalUrl: "https://example.com" }).success).toBe(true);
  });

  it("exige ao menos uma tag válida e não aceita repetições", () => {
    const base = { title: "Solicitação", cityIds: [crypto.randomUUID()], assignedTo: crypto.randomUUID() };
    expect(requestSchema.safeParse({ ...base, tags: [] }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, tags: ["f1", "growth"] }).success).toBe(true);
    expect(requestSchema.safeParse({ ...base, tags: ["f1", "f1"] }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, tags: ["inexistente"] }).success).toBe(false);
  });
});

describe("filterUsersByStatus", () => {
  const users = [
    { id: "1", fullName: "Ana", email: "ana@example.com", approvalStatus: "approved" as const },
    { id: "2", fullName: "Bruno", email: "bruno@example.com", approvalStatus: "pending" as const },
  ];

  it("filtra pelo status e pela pesquisa", () => {
    expect(filterUsersByStatus(users, "pending", "")).toEqual([users[1]]);
    expect(filterUsersByStatus(users, "all", "ANA@EXAMPLE")).toEqual([users[0]]);
  });
});

describe("effectivePermissions", () => {
  it("does not grant column management to a member without permission", () => {
    expect(effectivePermissions({ role: "member", approval_status: "approved" }, null).canManageColumns).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("exige as seis permissões booleanas", () => {
    const permissions = {
      can_create_requests: true,
      can_edit_requests: true,
      can_move_requests: true,
      can_delete_requests: true,
      can_manage_columns: false,
      can_manage_cities: false,
    };

    expect(updateUserSchema.safeParse({ action: "permissions", permissions }).success).toBe(true);
    expect(updateUserSchema.safeParse({ action: "permissions", permissions: { ...permissions, can_manage_cities: undefined } }).success).toBe(false);
  });
});
