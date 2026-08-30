import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import {
  REQUEST_WITH_RELATIONS_SELECT,
  createRequest,
  getRequest,
  normalizeRequestRecord,
  updateRequest,
} from "@/features/requests/api";
import type { RequestInput } from "@/features/requests/schemas";
import type { RequestRecordRaw } from "@/features/requests/types";
import {
  createCity,
  deactivateCity,
  listCities,
  reactivateCity,
  renameCity,
} from "@/features/cities/api";

const city = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "São Paulo",
  active: true,
  created_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
};

const rawRequest: RequestRecordRaw = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Pedido de acesso",
  description: null,
  requester_name: "Mariana",
  assigned_to: "22222222-2222-4222-8222-222222222222",
  external_url: null,
  tags: ["f1", "growth"],
  status: "pending" as const,
  column_id: "33333333-3333-4333-8333-333333333333",
  position: 0,
  created_by: "44444444-4444-4444-8444-444444444444",
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
};

const requestRecord = {
  id: rawRequest.id,
  title: rawRequest.title,
  description: rawRequest.description,
  assigned_to: rawRequest.assigned_to,
  external_url: rawRequest.external_url,
  tags: rawRequest.tags,
  status: rawRequest.status,
  column_id: rawRequest.column_id,
  position: rawRequest.position,
  created_by: rawRequest.created_by,
  created_at: rawRequest.created_at,
  updated_at: rawRequest.updated_at,
};

const requestInput: RequestInput = {
  title: "Pedido de acesso",
  description: "",
  assignedTo: rawRequest.assigned_to,
  tags: ["f1", "growth"],
  cityIds: [city.id],
  externalUrl: "",
};

function mockCanonicalRequest(data = { ...rawRequest, request_cities: [{ city }] }) {
  mocks.single.mockResolvedValue({ data, error: null });
  mocks.eq.mockReturnValue({ single: mocks.single });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ select: mocks.select });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("request API", () => {
  it("cria solicitação com UUIDs de cidades e sem requester_name", async () => {
    mocks.rpc.mockResolvedValue({ data: rawRequest, error: null });
    mockCanonicalRequest();

    await expect(createRequest(requestInput, rawRequest.created_by, 1024)).resolves.toEqual({
      ...requestRecord,
      cities: [city],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_request_with_cities", expect.objectContaining({ new_city_ids: [city.id] }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("new_requester_name");
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("requester_name");
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ new_position: 1024 });
  });

  it("preserva a posição canônica retornada pelo servidor ao criar", async () => {
    mocks.rpc.mockResolvedValue({ data: rawRequest, error: null });
    mockCanonicalRequest();

    await expect(createRequest(requestInput, rawRequest.created_by, 1024)).resolves.toMatchObject({ position: 0 });
  });

  it("atualiza solicitação com UUIDs de cidades", async () => {
    mocks.rpc.mockResolvedValue({ data: rawRequest, error: null });
    mockCanonicalRequest();

    await expect(updateRequest(rawRequest.id, requestInput)).resolves.toEqual({ ...requestRecord, cities: [city] });

    expect(mocks.rpc).toHaveBeenCalledWith("update_request_with_cities", expect.objectContaining({
      request_id: rawRequest.id,
      new_city_ids: [city.id],
    }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("new_requester_name");
  });

  it("preserva a posição canônica retornada pelo servidor ao atualizar", async () => {
    mocks.rpc.mockResolvedValue({ data: rawRequest, error: null });
    mockCanonicalRequest();

    await expect(updateRequest(rawRequest.id, requestInput)).resolves.toMatchObject({ position: 0 });
  });

  it("normaliza a relação request_cities em cities", () => {
    expect(normalizeRequestRecord({ ...rawRequest, request_cities: [{ city }] })).toEqual({ ...requestRecord, cities: [city] });
  });

  it("relê uma solicitação canônica pela seleção aninhada compartilhada", async () => {
    mockCanonicalRequest();

    await expect(getRequest(rawRequest.id)).resolves.toEqual({ ...requestRecord, cities: [city] });

    expect(mocks.select).toHaveBeenCalledWith(REQUEST_WITH_RELATIONS_SELECT);
  });

  it("propaga a falha da releitura canônica", async () => {
    const error = new Error("não foi possível reler a solicitação");
    mocks.single.mockResolvedValue({ data: null, error });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });

    await expect(getRequest(rawRequest.id)).rejects.toBe(error);
  });
});

describe("city API", () => {
  it("usa os nomes e argumentos de mutação de cidade", async () => {
    mocks.rpc.mockResolvedValue({ data: city, error: null });

    await expect(createCity("  São Paulo  ")).resolves.toEqual(city);
    await expect(renameCity(city.id, "  Campinas  ")).resolves.toEqual(city);
    await expect(deactivateCity(city.id)).resolves.toEqual(city);
    await expect(reactivateCity(city.id)).resolves.toEqual(city);

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "create_city", { new_name: "São Paulo" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "rename_city", { city_id: city.id, new_name: "Campinas" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, "deactivate_city", { city_id: city.id });
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "reactivate_city", { city_id: city.id });
  });

  it("mapeia a contagem de solicitações, inclusive quando ausente", async () => {
    const first = { ...city, request_cities: [{ count: 2 }] };
    const second = { ...city, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Recife", request_cities: [] };
    mocks.order.mockResolvedValue({ data: [first, second], error: null });
    mocks.select.mockReturnValue({ order: mocks.order });
    mocks.from.mockReturnValue({ select: mocks.select });

    await expect(listCities()).resolves.toEqual([
      { ...city, request_count: 2 },
      { ...city, id: second.id, name: "Recife", request_count: 0 },
    ]);
    expect(mocks.select).toHaveBeenCalledWith("*, request_cities(count)");
    expect(mocks.order).toHaveBeenCalledWith("name");
  });

  it("propaga erros do Supabase nas mutações de cidade", async () => {
    const error = new Error("sem permissão");
    mocks.rpc.mockResolvedValue({ data: null, error });

    await expect(createCity("São Paulo")).rejects.toBe(error);
  });
});
