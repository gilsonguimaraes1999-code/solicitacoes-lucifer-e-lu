import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CitiesPanel } from "@/components/cities/cities-panel";
import type { CityWithCount } from "@/features/cities/types";

const mocks = vi.hoisted(() => ({
  createCity: vi.fn(),
  renameCity: vi.fn(),
  deactivateCity: vi.fn(),
  reactivateCity: vi.fn(),
  listCities: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  cityChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: object; new: object }) => void | Promise<void>,
  requestCityChange: undefined as unknown as (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; old: object; new: object }) => void | Promise<void>,
}));

vi.mock("@/features/cities/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/cities/api")>(),
  ...mocks,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

const activeCity: CityWithCount = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "São Paulo",
  active: true,
  created_by: null,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
  request_count: 3,
};

const inactiveCity: CityWithCount = {
  ...activeCity,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Recife",
  active: false,
  request_count: 1,
};

const curitiba = { ...activeCity, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Curitiba", request_count: 0 };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.createCity.mockResolvedValue(curitiba);
  mocks.renameCity.mockImplementation(async (id: string, name: string) => ({ ...activeCity, id, name }));
  mocks.deactivateCity.mockImplementation(async (id: string) => ({ ...activeCity, id, active: false }));
  mocks.reactivateCity.mockImplementation(async (id: string) => ({ ...inactiveCity, id, active: true }));
  mocks.listCities.mockReset();
  mocks.channel.mockReset();
  mocks.removeChannel.mockReset();
  mocks.channel.mockImplementation((name: string) => {
    const channel = {
      on: vi.fn((_event: string, _filter: Record<string, unknown>, callback: typeof mocks.cityChange) => {
        if (name === "cities-management") mocks.cityChange = callback;
        if (name === "request-cities-management") mocks.requestCityChange = callback;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return channel;
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("CitiesPanel", () => {
  it("substitui eventos de cidade por UUID sem duplicar a linha", () => {
    render(<CitiesPanel initialCities={[activeCity, inactiveCity]} />);

    const renamed = { ...activeCity, name: "São Paulo Capital" };
    act(() => mocks.cityChange({ eventType: "UPDATE", old: activeCity, new: renamed }));
    act(() => mocks.cityChange({ eventType: "UPDATE", old: activeCity, new: renamed }));

    expect(screen.getAllByText(renamed.name)).toHaveLength(1);
    expect(screen.queryByText(activeCity.name)).not.toBeInTheDocument();
    expect(screen.getByText(String(activeCity.request_count))).toBeInTheDocument();
  });

  it("atualiza contagens por relacionamento sem perder filtro, consulta e ordem", async () => {
    const refreshed = [{ ...activeCity, request_count: 4 }, inactiveCity];
    mocks.listCities.mockResolvedValue(refreshed);
    render(<CitiesPanel initialCities={[activeCity, inactiveCity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ativas 1" }));
    fireEvent.change(screen.getByLabelText("Pesquisar cidades"), { target: { value: "são" } });
    fireEvent.click(screen.getByRole("button", { name: "A–Z" }));

    await act(async () => {
      await mocks.requestCityChange({ eventType: "DELETE", old: { request_id: "request-1", city_id: activeCity.id }, new: {} });
    });

    expect(mocks.listCities).toHaveBeenCalledOnce();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativas 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Pesquisar cidades")).toHaveValue("são");
    expect(screen.getByRole("button", { name: "Z–A" })).toBeInTheDocument();
    expect(screen.queryByText(inactiveCity.name)).not.toBeInTheDocument();
  });

  it("ignora snapshot de contagens antigo que resolve depois de um refresh mais novo", async () => {
    const olderRefresh = deferred<CityWithCount[]>();
    const newerRefresh = deferred<CityWithCount[]>();
    mocks.listCities.mockReturnValueOnce(olderRefresh.promise).mockReturnValueOnce(newerRefresh.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    let olderEvent = Promise.resolve();
    let newerEvent = Promise.resolve();
    act(() => {
      olderEvent = Promise.resolve(mocks.requestCityChange({ eventType: "INSERT", old: {}, new: { request_id: "request-1", city_id: activeCity.id } }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledTimes(1));
    act(() => {
      newerEvent = Promise.resolve(mocks.requestCityChange({ eventType: "DELETE", old: { request_id: "request-2", city_id: activeCity.id }, new: {} }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledTimes(2));

    await act(async () => {
      newerRefresh.resolve([{ ...activeCity, request_count: 7 }]);
      await newerEvent;
    });
    expect(screen.getByText("7")).toBeInTheDocument();

    await act(async () => {
      olderRefresh.resolve([{ ...activeCity, request_count: 4 }]);
      await olderEvent;
    });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
  });

  it("mescla a contagem do snapshot com nome e status de cidade atualizados depois do início", async () => {
    const staleRefresh = deferred<CityWithCount[]>();
    mocks.listCities.mockReturnValue(staleRefresh.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    let relationshipEvent = Promise.resolve();
    act(() => {
      relationshipEvent = Promise.resolve(mocks.requestCityChange({ eventType: "UPDATE", old: { request_id: "request-1" }, new: { request_id: "request-1" } }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledOnce());

    const updatedCity = { ...activeCity, name: "São Paulo Atualizada", active: false };
    act(() => mocks.cityChange({ eventType: "UPDATE", old: activeCity, new: updatedCity }));
    expect(screen.getByText(updatedCity.name)).toBeInTheDocument();

    await act(async () => {
      staleRefresh.resolve([{ ...activeCity, request_count: 6 }]);
      await relationshipEvent;
    });

    expect(screen.getByText(updatedCity.name)).toBeInTheDocument();
    expect(screen.queryByText(activeCity.name)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Reativar ${updatedCity.name}` })).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("não deixa resposta atrasada de rename vencer um UPDATE Realtime posterior", async () => {
    const renameResponse = deferred<CityWithCount>();
    const user = userEvent.setup();
    mocks.renameCity.mockReturnValueOnce(renameResponse.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Renomear ${activeCity.name}` }));
    await user.clear(screen.getByLabelText("Nome da cidade"));
    await user.type(screen.getByLabelText("Nome da cidade"), "São Paulo Local");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    await waitFor(() => expect(mocks.renameCity).toHaveBeenCalledOnce());

    const realtimeCity = { ...activeCity, name: "São Paulo Externa", updated_at: "2026-08-30T01:00:00Z" };
    act(() => mocks.cityChange({ eventType: "UPDATE", old: activeCity, new: realtimeCity }));
    expect(screen.getByText(realtimeCity.name)).toBeInTheDocument();

    await act(async () => {
      renameResponse.resolve({ ...activeCity, name: "São Paulo Local" });
      await renameResponse.promise;
    });

    expect(screen.getByText(realtimeCity.name)).toBeInTheDocument();
    expect(screen.queryByText("São Paulo Local")).not.toBeInTheDocument();
  });

  it("não deixa resposta atrasada de deactivate vencer um UPDATE Realtime posterior", async () => {
    const deactivateResponse = deferred<CityWithCount>();
    const user = userEvent.setup();
    mocks.deactivateCity.mockReturnValueOnce(deactivateResponse.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Desativar ${activeCity.name}` }));
    await user.click(screen.getByRole("button", { name: "Desativar cidade" }));
    await waitFor(() => expect(mocks.deactivateCity).toHaveBeenCalledOnce());

    const realtimeCity = { ...activeCity, name: "São Paulo Externa Ativa", active: true, updated_at: "2026-08-30T01:00:00Z" };
    act(() => mocks.cityChange({ eventType: "UPDATE", old: activeCity, new: realtimeCity }));

    await act(async () => {
      deactivateResponse.resolve({ ...activeCity, active: false });
      await deactivateResponse.promise;
    });

    expect(screen.getByText(realtimeCity.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Desativar ${realtimeCity.name}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Reativar ${activeCity.name}` })).not.toBeInTheDocument();
  });

  it("não deixa resposta atrasada de reactivate vencer um UPDATE Realtime posterior", async () => {
    const reactivateResponse = deferred<CityWithCount>();
    const user = userEvent.setup();
    mocks.reactivateCity.mockReturnValueOnce(reactivateResponse.promise);
    render(<CitiesPanel initialCities={[inactiveCity]} />);

    await user.click(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` }));
    await waitFor(() => expect(mocks.reactivateCity).toHaveBeenCalledOnce());

    const realtimeCity = { ...inactiveCity, name: "Recife Externa", active: false, updated_at: "2026-08-30T01:00:00Z" };
    act(() => mocks.cityChange({ eventType: "UPDATE", old: inactiveCity, new: realtimeCity }));

    await act(async () => {
      reactivateResponse.resolve({ ...inactiveCity, active: true });
      await reactivateResponse.promise;
    });

    expect(screen.getByText(realtimeCity.name)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Reativar ${realtimeCity.name}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Desativar ${inactiveCity.name}` })).not.toBeInTheDocument();
  });

  it("não deixa snapshot iniciado durante rename reverter a resposta válida da mutação", async () => {
    const renameResponse = deferred<CityWithCount>();
    const refreshResponse = deferred<CityWithCount[]>();
    const user = userEvent.setup();
    mocks.renameCity.mockReturnValueOnce(renameResponse.promise);
    mocks.listCities.mockReturnValueOnce(refreshResponse.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Renomear ${activeCity.name}` }));
    await user.clear(screen.getByLabelText("Nome da cidade"));
    await user.type(screen.getByLabelText("Nome da cidade"), "São Paulo Aplicada");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    await waitFor(() => expect(mocks.renameCity).toHaveBeenCalledOnce());

    let refreshEvent = Promise.resolve();
    act(() => {
      refreshEvent = Promise.resolve(mocks.requestCityChange({ eventType: "UPDATE", old: {}, new: {} }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledOnce());

    await act(async () => {
      renameResponse.resolve({ ...activeCity, name: "São Paulo Aplicada" });
      await renameResponse.promise;
    });
    expect(screen.getByText("São Paulo Aplicada")).toBeInTheDocument();

    await act(async () => {
      refreshResponse.resolve([{ ...activeCity, request_count: 9 }]);
      await refreshEvent;
    });

    expect(screen.getByText("São Paulo Aplicada")).toBeInTheDocument();
    expect(screen.queryByText(activeCity.name)).not.toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("não deixa snapshot iniciado durante deactivate reverter a resposta válida da mutação", async () => {
    const deactivateResponse = deferred<CityWithCount>();
    const refreshResponse = deferred<CityWithCount[]>();
    const user = userEvent.setup();
    mocks.deactivateCity.mockReturnValueOnce(deactivateResponse.promise);
    mocks.listCities.mockReturnValueOnce(refreshResponse.promise);
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Desativar ${activeCity.name}` }));
    await user.click(screen.getByRole("button", { name: "Desativar cidade" }));
    await waitFor(() => expect(mocks.deactivateCity).toHaveBeenCalledOnce());

    let refreshEvent = Promise.resolve();
    act(() => {
      refreshEvent = Promise.resolve(mocks.requestCityChange({ eventType: "UPDATE", old: {}, new: {} }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledOnce());

    await act(async () => {
      deactivateResponse.resolve({ ...activeCity, active: false });
      await deactivateResponse.promise;
    });
    expect(screen.getByRole("button", { name: `Reativar ${activeCity.name}` })).toBeInTheDocument();

    await act(async () => {
      refreshResponse.resolve([{ ...activeCity, request_count: 8 }]);
      await refreshEvent;
    });

    expect(screen.getByRole("button", { name: `Reativar ${activeCity.name}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Desativar ${activeCity.name}` })).not.toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("não deixa snapshot iniciado durante reactivate reverter a resposta válida da mutação", async () => {
    const reactivateResponse = deferred<CityWithCount>();
    const refreshResponse = deferred<CityWithCount[]>();
    const user = userEvent.setup();
    mocks.reactivateCity.mockReturnValueOnce(reactivateResponse.promise);
    mocks.listCities.mockReturnValueOnce(refreshResponse.promise);
    render(<CitiesPanel initialCities={[inactiveCity]} />);

    await user.click(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` }));
    await waitFor(() => expect(mocks.reactivateCity).toHaveBeenCalledOnce());

    let refreshEvent = Promise.resolve();
    act(() => {
      refreshEvent = Promise.resolve(mocks.requestCityChange({ eventType: "UPDATE", old: {}, new: {} }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledOnce());

    await act(async () => {
      reactivateResponse.resolve({ ...inactiveCity, active: true });
      await reactivateResponse.promise;
    });
    expect(screen.getByRole("button", { name: `Desativar ${inactiveCity.name}` })).toBeInTheDocument();

    await act(async () => {
      refreshResponse.resolve([{ ...inactiveCity, request_count: 7 }]);
      await refreshEvent;
    });

    expect(screen.getByRole("button", { name: `Desativar ${inactiveCity.name}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `Reativar ${inactiveCity.name}` })).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("remove os canais administrativos e ignora refresh concluído após desmontar", async () => {
    let resolveRefresh: (cities: CityWithCount[]) => void = () => undefined;
    const refresh = new Promise<CityWithCount[]>((resolve) => { resolveRefresh = resolve; });
    mocks.listCities.mockReturnValue(refresh);
    const { unmount } = render(<CitiesPanel initialCities={[activeCity]} />);
    const staleRelationshipCallback = mocks.requestCityChange;
    const pendingRefresh = staleRelationshipCallback({ eventType: "INSERT", old: {}, new: { request_id: "request-1", city_id: activeCity.id } });

    unmount();
    resolveRefresh([{ ...activeCity, request_count: 9 }]);
    await pendingRefresh;
    await staleRelationshipCallback({ eventType: "INSERT", old: {}, new: { request_id: "request-1", city_id: activeCity.id } });

    expect(mocks.removeChannel).toHaveBeenCalledTimes(2);
    expect(new Set(mocks.removeChannel.mock.calls.map(([channel]) => channel))).toHaveProperty("size", 2);
    expect(mocks.listCities).toHaveBeenCalledOnce();
  });

  it("cria, renomeia, desativa e reativa cidades com toasts inferiores", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[activeCity, inactiveCity]} />);

    await user.click(screen.getByRole("button", { name: "Nova cidade" }));
    await user.type(screen.getByLabelText("Nome da cidade"), "Curitiba");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    await waitFor(() => expect(mocks.createCity).toHaveBeenCalledWith("Curitiba"));
    expect(await screen.findByText("Curitiba")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("fixed", "bottom-6", "left-1/2");

    await user.click(screen.getByRole("button", { name: "Renomear Curitiba" }));
    await user.clear(screen.getByLabelText("Nome da cidade"));
    await user.type(screen.getByLabelText("Nome da cidade"), "Curitiba PR");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    await waitFor(() => expect(mocks.renameCity).toHaveBeenCalledWith(curitiba.id, "Curitiba PR"));
    expect(screen.getAllByText("Curitiba PR")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: `Desativar ${activeCity.name}` }));
    expect(screen.getByRole("dialog", { name: "Confirmar desativação da cidade" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desativar cidade" }));
    await waitFor(() => expect(mocks.deactivateCity).toHaveBeenCalledWith(activeCity.id));
    expect(screen.getByRole("button", { name: `Reativar ${activeCity.name}` })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` }));
    await waitFor(() => expect(mocks.reactivateCity).toHaveBeenCalledWith(inactiveCity.id));
  });

  it("filtra ativas e desativadas e pesquisa por nome", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[activeCity, inactiveCity]} />);

    await user.click(screen.getByRole("button", { name: "Desativadas 1" }));
    expect(screen.getByText(inactiveCity.name)).toBeInTheDocument();
    expect(screen.queryByText(activeCity.name)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todas 2" }));
    await user.type(screen.getByLabelText("Pesquisar cidades"), "são");
    expect(screen.getByText(activeCity.name)).toBeInTheDocument();
    expect(screen.queryByText(inactiveCity.name)).not.toBeInTheDocument();
  });

  it("exibe contagens e alterna a ordenação entre A–Z e Z–A", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[activeCity, inactiveCity]} />);

    expect(screen.getByRole("button", { name: "Todas 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativas 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativadas 1" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((item) => item.textContent)).toEqual(["Recife", "São Paulo"]);

    await user.click(screen.getByRole("button", { name: "A–Z" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((item) => item.textContent)).toEqual(["São Paulo", "Recife"]);
  });

  it("mantém o diálogo aberto e mostra a validação junto ao campo quando o nome é inválido", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[]} />);

    await user.click(screen.getByRole("button", { name: "Nova cidade" }));
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    expect(screen.getByRole("dialog", { name: "Nova cidade" })).toBeInTheDocument();
    expect(screen.getByText("Informe o nome da cidade.")).toBeInTheDocument();
    expect(mocks.createCity).not.toHaveBeenCalled();
  });

  it("explica que a desativação preserva o histórico e cancelar não altera a cidade", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Desativar ${activeCity.name}` }));
    const dialog = screen.getByRole("dialog", { name: "Confirmar desativação da cidade" });
    expect(dialog).toHaveTextContent("histórico");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.deactivateCity).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: `Desativar ${activeCity.name}` })).toBeInTheDocument();
  });

  it.each([
    [{ code: "23505" }, "Já existe uma cidade com este nome."],
    [{ code: "42501" }, "Você não tem permissão para gerenciar cidades."],
    [new Error("indisponível"), "Não foi possível salvar a cidade."],
  ])("mantém o estado e mostra erro seguro quando a API falha", async (failure, message) => {
    const user = userEvent.setup();
    mocks.createCity.mockRejectedValueOnce(failure);
    render(<CitiesPanel initialCities={[activeCity]} />);

    await user.click(screen.getByRole("button", { name: "Nova cidade" }));
    await user.type(screen.getByLabelText("Nome da cidade"), "Curitiba");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText(activeCity.name)).toBeInTheDocument();
    expect(screen.queryByText("Curitiba")).not.toBeInTheDocument();
  });

  it("fecha o diálogo por seu controle explícito e devolve o foco ao acionador", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[]} />);
    const trigger = screen.getByRole("button", { name: "Nova cidade" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Nova cidade" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
