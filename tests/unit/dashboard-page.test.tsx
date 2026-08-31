import { beforeEach, describe, expect, it, vi } from "vitest";
import { REQUEST_WITH_RELATIONS_SELECT } from "@/features/requests/types";

const mocks = vi.hoisted(() => ({
  orderCalls: [] as Array<{ table: string; column: string }>,
  selectCalls: [] as Array<{ table: string; columns: string }>,
  dataByTable: {} as Record<string, unknown[]>,
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
    select: (columns: string) => {
      mocks.selectCalls.push({ table, columns });
      return query;
    },
    eq: () => query,
    order: (column: string) => {
      mocks.orderCalls.push({ table, column });
      return query;
    },
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: mocks.dataByTable[table] ?? [], error: null }).then(resolve),
  };
  return query;
}

beforeEach(() => {
  mocks.orderCalls.length = 0;
  mocks.selectCalls.length = 0;
  mocks.dataByTable = {};
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
    expect(mocks.orderCalls.filter(({ table }) => table === "cities")).toEqual([
      { table: "cities", column: "position" },
      { table: "cities", column: "name" },
      { table: "cities", column: "id" },
    ]);
  });

  it("carrega relações de cidades, normaliza solicitações e repassa todas as cidades ao quadro", async () => {
    const city = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Santa Luzia", position: 1024, active: false, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z" };
    mocks.dataByTable = {
      requests: [{
        id: "request-1", title: "Pedido", description: null, requester_name: "Legado", assigned_to: "profile-1", external_url: null, tags: ["hub"], status: "pending", column_id: "column-pending", position: 512, created_by: "owner", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:00Z", assignee: null, request_cities: [{ city }],
      }],
      cities: [city],
    };

    const board = await DashboardPage();

    expect(mocks.selectCalls).toContainEqual({ table: "requests", columns: REQUEST_WITH_RELATIONS_SELECT });
    expect(mocks.selectCalls).toContainEqual({ table: "cities", columns: "*" });
    expect(board.props.initialRequests[0].cities).toEqual([city]);
    expect(board.props.initialRequests[0]).not.toHaveProperty("requester_name");
    expect(board.props.cities).toEqual([city]);
  });
});
