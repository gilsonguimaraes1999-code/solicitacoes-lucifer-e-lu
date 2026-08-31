import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardColumn, CreateColumnInput } from "@/features/columns/types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { createBoardColumn, getBoardColumn } from "@/features/columns/api";

const customColumn: BoardColumn = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Prioridades",
  kind: "custom",
  system_key: null,
  assignee_id: null,
  position: 5120,
  created_by: "owner",
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockReset();
  mocks.select.mockReset();
  mocks.eq.mockReset();
  mocks.single.mockReset();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ single: mocks.single });
});

describe("column API", () => {
  it("encaminha a lista custom com responsável nulo para a RPC própria", async () => {
    const input: CreateColumnInput = { kind: "custom", name: "Prioridades", assigneeId: null };
    mocks.rpc.mockResolvedValue({ data: customColumn, error: null });

    await expect(createBoardColumn(input, 5120)).resolves.toEqual(customColumn);

    expect(mocks.rpc).toHaveBeenCalledWith("create_custom_board_column", {
      new_name: "Prioridades",
      new_position: 5120,
    });
  });

  it("recarrega uma coluna canônica por id depois de drenar mutações locais", async () => {
    mocks.single.mockResolvedValue({ data: customColumn, error: null });

    await expect(getBoardColumn(customColumn.id)).resolves.toEqual(customColumn);

    expect(mocks.from).toHaveBeenCalledWith("board_columns");
    expect(mocks.select).toHaveBeenCalledWith("*");
    expect(mocks.eq).toHaveBeenCalledWith("id", customColumn.id);
    expect(mocks.single).toHaveBeenCalledOnce();
  });
});
