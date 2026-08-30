import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderCalls: [] as Array<{ table: string; column: string }>,
  requireApprovedProfile: vi.fn(),
}));

vi.mock("@/features/auth/guards", () => ({
  requireApprovedProfile: mocks.requireApprovedProfile,
}));

vi.mock("@/lib/permissions", () => ({
  effectivePermissions: () => ({ canCreate: false, canEdit: false, canMove: false, canDelete: false, canManageColumns: false }),
}));

import DashboardPage from "@/app/(private)/dashboard/page";

function queryFor(table: string) {
  const query = {
    select: () => query,
    eq: () => query,
    order: (column: string) => {
      mocks.orderCalls.push({ table, column });
      return query;
    },
    then: (resolve: (value: { data: never[] }) => unknown) => Promise.resolve({ data: [] }).then(resolve),
  };
  return query;
}

beforeEach(() => {
  mocks.orderCalls.length = 0;
  mocks.requireApprovedProfile.mockResolvedValue({
    supabase: { from: (table: string) => queryFor(table) },
    user: { id: "owner" },
    profile: { role: "owner" },
    permissions: null,
  });
});

describe("DashboardPage", () => {
  it("desempata solicitações e colunas por id depois da posição", async () => {
    await DashboardPage();

    expect(mocks.orderCalls.filter(({ table }) => table === "requests")).toEqual([
      { table: "requests", column: "position" },
      { table: "requests", column: "id" },
    ]);
    expect(mocks.orderCalls.filter(({ table }) => table === "board_columns")).toEqual([
      { table: "board_columns", column: "position" },
      { table: "board_columns", column: "id" },
    ]);
  });
});
