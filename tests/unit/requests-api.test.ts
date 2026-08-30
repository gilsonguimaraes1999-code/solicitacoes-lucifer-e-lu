import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { createRequest, getRequest } from "@/features/requests/api";

const created = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Pedido de acesso",
  description: null,
  requester_name: "Mariana",
  assigned_to: "22222222-2222-4222-8222-222222222222",
  external_url: null,
  status: "pending" as const,
  column_id: "33333333-3333-4333-8333-333333333333",
  position: 1024,
  created_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRequest", () => {
  it("retorna imediatamente a linha confirmada pela RPC sem segunda leitura", async () => {
    mocks.rpc.mockResolvedValue({ data: created, error: null });

    await expect(createRequest({ title: "Pedido de acesso", requesterName: "Mariana", assignedTo: created.assigned_to }, created.created_by, 1024)).resolves.toEqual(created);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("getRequest", () => {
  it("relê uma solicitação canônica com a relação do responsável", async () => {
    const enriched = { ...created, assignee: { id: created.assigned_to, full_name: "Lucifer" } };
    mocks.single.mockResolvedValue({ data: enriched, error: null });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });

    await expect(getRequest(created.id)).resolves.toEqual(enriched);
  });

  it("propaga a falha da releitura canônica", async () => {
    const error = new Error("não foi possível reler a solicitação");
    mocks.single.mockResolvedValue({ data: null, error });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });

    await expect(getRequest(created.id)).rejects.toBe(error);
  });
});
