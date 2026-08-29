import { describe, expect, it } from "vitest";
import { positionBetween } from "@/features/requests/ordering";
import { requestSchema } from "@/features/requests/schemas";
import { filterUsersByStatus } from "@/features/users/filter-users";

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
    const base = { title: "Solicitação", requesterName: "João", assignedTo: crypto.randomUUID() };
    expect(requestSchema.safeParse({ ...base, externalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, externalUrl: "https://example.com" }).success).toBe(true);
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
