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
  reorderCity: vi.fn(),
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
  position: 1024,
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
  position: 2048,
  active: false,
  request_count: 1,
};

const curitiba = { ...activeCity, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Curitiba", position: 3072, request_count: 0 };
const salvador = { ...activeCity, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Salvador", position: 4096, request_count: 2 };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.createCity.mockResolvedValue(curitiba);
  mocks.renameCity.mockImplementation(async (id: string, name: string) => ({ ...activeCity, id, name }));
  mocks.deactivateCity.mockImplementation(async (id: string) => ({ ...activeCity, id, active: false }));
  mocks.reactivateCity.mockImplementation(async (id: string) => ({ ...inactiveCity, id, active: true }));
  mocks.reorderCity.mockImplementation(async () => [activeCity, inactiveCity, curitiba]);
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

function cityNames() {
  return screen.getAllByRole("heading", { level: 2 }).map((item) => item.textContent);
}

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

    await act(async () => {
      await mocks.requestCityChange({ eventType: "DELETE", old: { request_id: "request-1", city_id: activeCity.id }, new: {} });
    });

    expect(mocks.listCities).toHaveBeenCalledOnce();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativas 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Pesquisar cidades")).toHaveValue("são");
    expect(screen.queryByRole("button", { name: "A–Z" })).not.toBeInTheDocument();
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

  it("exibe contagens na ordem persistida e remove o controle local de A–Z", () => {
    render(<CitiesPanel initialCities={[inactiveCity, activeCity]} />);

    expect(screen.getByRole("button", { name: "Todas 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativas 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativadas 1" })).toBeInTheDocument();
    expect(cityNames()).toEqual(["São Paulo", "Recife"]);
    expect(screen.queryByRole("button", { name: "A–Z" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Z–A" })).not.toBeInTheDocument();
  });

  it("move a cidade do meio para cima com atualização otimista usando a ordem persistida completa", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    expect(cityNames()).toEqual([activeCity.name, recifeAtiva.name, curitiba.name]);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    expect(mocks.reorderCity).toHaveBeenCalledWith(recifeAtiva.id, { beforeCityId: undefined, afterCityId: activeCity.id });
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024 },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);
  });

  it("desabilita os limites de mover para cima e para baixo", () => {
    const recifeAtiva = { ...inactiveCity, active: true };
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    expect(screen.getByRole("button", { name: `Mover ${activeCity.name} para cima` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para baixo` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Mover ${curitiba.name} para baixo` })).toBeDisabled();
  });

  it("agrupa as setas de ordenação lado a lado em botões pequenos sem a caixa global", () => {
    const recifeAtiva = { ...inactiveCity, active: true };
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    const moveUp = screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` });
    const moveDown = screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para baixo` });

    expect(moveUp.parentElement).toBe(moveDown.parentElement);
    expect(moveUp.parentElement).toHaveClass("flex-row");
    expect(moveUp).toHaveClass("h-7", "w-7");
    expect(moveDown).toHaveClass("h-7", "w-7");
    expect(moveUp).not.toHaveClass("icon-button");
    expect(moveDown).not.toHaveClass("icon-button");
  });

  it("restaura o snapshot exato e mostra a mensagem de falha ao reordenar", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderFailure = deferred<CityWithCount>();
    mocks.reorderCity.mockReturnValueOnce(reorderFailure.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    await act(async () => {
      reorderFailure.promise.catch(() => undefined);
      reorderFailure.reject?.(new Error("offline"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível reordenar a cidade. Tente novamente.");
    expect(cityNames()).toEqual([activeCity.name, recifeAtiva.name, curitiba.name]);
  });

  it("serializa reorders globalmente enquanto qualquer reorder está pendente", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const firstReorder = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(firstReorder.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    expect(screen.getByRole("button", { name: `Mover ${activeCity.name} para cima` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Mover ${curitiba.name} para cima` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Mover ${salvador.name} para cima` })).toBeDisabled();

    const blockedMove = screen.getByRole("button", { name: `Mover ${curitiba.name} para cima` });
    blockedMove.removeAttribute("disabled");
    fireEvent.click(blockedMove);
    expect(mocks.reorderCity).toHaveBeenCalledTimes(1);
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    await act(async () => {
      firstReorder.promise.catch(() => undefined);
      firstReorder.reject(new Error("offline"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível reordenar a cidade. Tente novamente.");
    expect(cityNames()).toEqual([activeCity.name, recifeAtiva.name, curitiba.name, salvador.name]);
  });

  it("reordena visualmente quando o Realtime atualiza a posição", () => {
    const recifeAtiva = { ...inactiveCity, active: true };
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, position: 512, updated_at: "2026-08-30T03:00:00Z" },
    }));

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);
  });

  it("calcula vizinhos pelo conjunto persistido completo mesmo com filtro ativo", async () => {
    const user = userEvent.setup();
    render(<CitiesPanel initialCities={[curitiba, inactiveCity, activeCity]} />);

    await user.click(screen.getByRole("button", { name: "Ativas 2" }));
    await user.click(screen.getByRole("button", { name: `Mover ${curitiba.name} para cima` }));

    expect(mocks.reorderCity).toHaveBeenCalledWith(curitiba.id, { beforeCityId: activeCity.id, afterCityId: inactiveCity.id });
  });

  it("não deixa um UPDATE Realtime antigo sobrescrever uma reordenação local mais recente", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, position: 2048, updated_at: "2026-08-30T04:00:00Z" },
    }));

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, updated_at: "2026-08-30T04:00:01Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);
  });

  it("reaplica evento remoto divergente mais novo se o reorder local falha", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Remota", position: 5120, updated_at: "2026-08-30T06:00:00Z" },
    }));

    expect(cityNames()).toEqual(["Recife Remota", activeCity.name, curitiba.name, salvador.name]);

    await act(async () => {
      reorderResponse.promise.catch(() => undefined);
      reorderResponse.reject(new Error("offline"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível reordenar a cidade. Tente novamente.");
    expect(cityNames()).toEqual([activeCity.name, curitiba.name, salvador.name, "Recife Remota"]);
  });

  it("aplica as novas posições do catálogo canônico completo quando o reorder conclui", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, updated_at: "2026-08-30T06:10:00Z" },
        { ...curitiba, position: 2048, updated_at: "2026-08-30T06:10:00Z" },
        { ...activeCity, position: 3072, updated_at: "2026-08-30T06:10:00Z" },
        { ...salvador, position: 4096, updated_at: "2026-08-30T06:10:00Z" },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, curitiba.name, activeCity.name, salvador.name]);
  });

  it("preserva uma cidade B com update mais novo que a linha canônica atrasada", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: salvador,
      new: { ...salvador, name: "Salvador Remota", active: false, updated_at: "2026-08-30T06:20:01Z" },
    }));

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, updated_at: "2026-08-30T06:20:00Z" },
        { ...activeCity, position: 2048, updated_at: "2026-08-30T06:20:00Z" },
        { ...curitiba, position: 3072, updated_at: "2026-08-30T06:20:00Z" },
        { ...salvador, name: "Salvador Antiga", active: true, position: 4096, updated_at: "2026-08-30T06:20:00Z" },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, "Salvador Remota"]);
    expect(screen.getByRole("button", { name: "Reativar Salvador Remota" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar Salvador Antiga" })).not.toBeInTheDocument();
  });

  it("preserva cidade B com CRUD pendente contra o catálogo canônico do reorder", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    const renameResponse = deferred<CityWithCount>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    mocks.renameCity.mockReturnValueOnce(renameResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    await user.click(screen.getByRole("button", { name: `Renomear ${activeCity.name}` }));
    await user.clear(screen.getByLabelText("Nome da cidade"));
    await user.type(screen.getByLabelText("Nome da cidade"), "São Paulo Local");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));
    await waitFor(() => expect(mocks.renameCity).toHaveBeenCalledWith(activeCity.id, "São Paulo Local"));

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, updated_at: "2026-08-30T06:30:00Z" },
        { ...activeCity, name: "São Paulo Canônica", position: 2048, updated_at: "2026-08-30T06:31:00Z" },
        { ...curitiba, position: 3072, updated_at: "2026-08-30T06:30:00Z" },
        { ...salvador, position: 4096, updated_at: "2026-08-30T06:30:00Z" },
      ]);
      await reorderResponse.promise;
    });

    expect(screen.getByText(activeCity.name)).toBeInTheDocument();
    expect(screen.queryByText("São Paulo Canônica")).not.toBeInTheDocument();
    expect(cityNames().slice(0, 4)).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);
    expect(screen.getByRole("button", { name: `Renomear ${activeCity.name}` })).toBeDisabled();

    await act(async () => {
      renameResponse.resolve({ ...activeCity, name: "São Paulo Local", updated_at: "2026-08-30T06:32:00Z" });
      await renameResponse.promise;
    });

    expect(screen.getByText("São Paulo Local")).toBeInTheDocument();
  });

  it("trata confirmação realtime da posição alvo como sucesso se a RPC falha", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderFailure = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderFailure.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Confirmada", position: 1024, updated_at: "2026-08-30T06:30:00Z" },
    }));

    await act(async () => {
      reorderFailure.promise.catch(() => undefined);
      reorderFailure.reject(new Error("offline"));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(cityNames()).toEqual(["Recife Confirmada", activeCity.name, curitiba.name]);
  });

  it("não confirma a posição canônica com evento histórico coincidente e ainda faz rollback com toast na falha", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true, updated_at: "2026-08-30T06:30:00Z" };
    const reorderFailure = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderFailure.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Coincidente Antiga", position: 1024, updated_at: "2026-08-30T06:29:59Z" },
    }));

    await act(async () => {
      reorderFailure.promise.catch(() => undefined);
      reorderFailure.reject(new Error("offline"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível reordenar a cidade. Tente novamente.");
    expect(cityNames()).toEqual([activeCity.name, recifeAtiva.name, curitiba.name]);
    expect(screen.queryByText("Recife Coincidente Antiga")).not.toBeInTheDocument();
  });

  it("preserva update remoto posterior sem toast quando a posição já foi confirmada e a RPC falha", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderFailure = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderFailure.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Confirmada", position: 1024, updated_at: "2026-08-30T06:40:00Z" },
    }));

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: { ...recifeAtiva, name: "Recife Confirmada", position: 1024, updated_at: "2026-08-30T06:40:00Z" },
      new: { ...recifeAtiva, name: "Recife Remota Final", position: 5120, active: false, updated_at: "2026-08-30T06:40:01Z" },
    }));

    expect(cityNames()).toEqual(["Recife Remota Final", activeCity.name, curitiba.name, salvador.name]);

    await act(async () => {
      reorderFailure.promise.catch(() => undefined);
      reorderFailure.reject(new Error("offline"));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(cityNames()).toEqual([activeCity.name, curitiba.name, salvador.name, "Recife Remota Final"]);
    expect(screen.getByRole("button", { name: "Reativar Recife Remota Final" })).toBeInTheDocument();
  });

  it("no sucesso com updated_at empatado a resposta RPC observada por último vence o remoto divergente", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Remota", position: 5120, updated_at: "2026-08-30T08:00:00Z" },
    }));

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, name: "Recife RPC", position: 1024, updated_at: "2026-08-30T08:00:00Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
        { ...salvador, position: 4096 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual(["Recife RPC", activeCity.name, curitiba.name, salvador.name]);
  });

  it("no sucesso com relógio remoto inválido a resposta RPC observada por último vence", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Sem Relogio", position: 5120, updated_at: "data-invalida" },
    }));

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, name: "Recife RPC", position: 1024, updated_at: "2026-08-30T09:00:00Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
        { ...salvador, position: 4096 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual(["Recife RPC", activeCity.name, curitiba.name, salvador.name]);
  });

  it("no sucesso preserva o remoto quando o timestamp demonstra que ele é mais novo", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Remota Nova", position: 5120, updated_at: "2026-08-30T10:00:01Z" },
    }));

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, name: "Recife RPC Antiga", position: 1024, updated_at: "2026-08-30T10:00:00Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
        { ...salvador, position: 4096 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([activeCity.name, curitiba.name, salvador.name, "Recife Remota Nova"]);
  });

  it("não reaplica resposta RPC antiga após confirmação realtime seguida de update remoto mais novo", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name, salvador.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: recifeAtiva,
      new: { ...recifeAtiva, name: "Recife Confirmada", position: 1024, active: true, updated_at: "2026-08-30T11:00:00Z" },
    }));
    expect(cityNames()).toEqual(["Recife Confirmada", activeCity.name, curitiba.name, salvador.name]);

    act(() => mocks.cityChange({
      eventType: "UPDATE",
      old: { ...recifeAtiva, name: "Recife Confirmada", position: 1024, active: true, updated_at: "2026-08-30T11:00:00Z" },
      new: { ...recifeAtiva, name: "Recife Final Remota", position: 5120, active: false, updated_at: "2026-08-30T11:00:01Z" },
    }));

    expect(cityNames()).toEqual(["Recife Final Remota", activeCity.name, curitiba.name, salvador.name]);

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, name: "Recife RPC Antiga", position: 1024, active: true, updated_at: "2026-08-30T11:00:00Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
        { ...salvador, position: 4096 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([activeCity.name, curitiba.name, salvador.name, "Recife Final Remota"]);
    expect(screen.getByRole("button", { name: "Reativar Recife Final Remota" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar Recife RPC Antiga" })).not.toBeInTheDocument();
  });

  it("não deixa refresh iniciado com reorder pendente sobrescrever a posição otimista", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true, request_count: 1 };
    const reorderResponse = deferred<CityWithCount[]>();
    const refreshResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    mocks.listCities.mockReturnValueOnce(refreshResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));
    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);

    let refreshEvent = Promise.resolve();
    act(() => {
      refreshEvent = Promise.resolve(mocks.requestCityChange({ eventType: "UPDATE", old: { request_id: "request-1" }, new: { request_id: "request-1" } }));
    });
    await waitFor(() => expect(mocks.listCities).toHaveBeenCalledOnce());

    await act(async () => {
      refreshResponse.resolve([
        { ...activeCity, request_count: 3 },
        { ...recifeAtiva, position: 2048, request_count: 9, updated_at: "2026-08-30T07:00:00Z" },
        curitiba,
      ]);
      await refreshEvent;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);
    expect(screen.getByText("9")).toBeInTheDocument();

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, request_count: 9, updated_at: "2026-08-30T07:00:01Z" },
        { ...activeCity, position: 2048, request_count: 3 },
        { ...curitiba, position: 3072, request_count: 0 },
      ]);
      await reorderResponse.promise;
    });

    expect(cityNames()).toEqual([recifeAtiva.name, activeCity.name, curitiba.name]);
  });

  it("desabilita renomear e desativar da mesma cidade enquanto o reorder está pendente e reabilita no sucesso", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const reorderResponse = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` }));

    expect(screen.getByRole("button", { name: `Renomear ${recifeAtiva.name}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Desativar ${recifeAtiva.name}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Renomear ${activeCity.name}` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Desativar ${activeCity.name}` })).toBeEnabled();

    await act(async () => {
      reorderResponse.resolve([
        { ...recifeAtiva, position: 1024, updated_at: "2026-08-30T12:00:00Z" },
        { ...activeCity, position: 2048 },
        { ...curitiba, position: 3072 },
      ]);
      await reorderResponse.promise;
    });

    expect(screen.getByRole("button", { name: `Renomear ${recifeAtiva.name}` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Desativar ${recifeAtiva.name}` })).toBeEnabled();
  });

  it("desabilita mover e ignora reorder da mesma cidade quando um CRUD já está pendente", async () => {
    const user = userEvent.setup();
    const recifeAtiva = { ...inactiveCity, active: true };
    const deactivateResponse = deferred<CityWithCount>();
    mocks.deactivateCity.mockReturnValueOnce(deactivateResponse.promise);
    render(<CitiesPanel initialCities={[curitiba, recifeAtiva, activeCity, salvador]} />);

    await user.click(screen.getByRole("button", { name: `Desativar ${recifeAtiva.name}` }));
    await user.click(screen.getByRole("button", { name: "Desativar cidade" }));
    await waitFor(() => expect(mocks.deactivateCity).toHaveBeenCalledWith(recifeAtiva.id));

    const moveUp = screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` });
    const moveDown = screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para baixo` });
    expect(moveUp).toBeDisabled();
    expect(moveDown).toBeDisabled();
    expect(screen.getByRole("button", { name: `Mover ${activeCity.name} para baixo` })).toBeEnabled();

    moveUp.removeAttribute("disabled");
    fireEvent.click(moveUp);
    expect(mocks.reorderCity).not.toHaveBeenCalled();
    expect(cityNames().slice(0, 4)).toEqual([activeCity.name, recifeAtiva.name, curitiba.name, salvador.name]);

    await act(async () => {
      deactivateResponse.resolve({ ...recifeAtiva, active: false, updated_at: "2026-08-30T12:30:00Z" });
      await deactivateResponse.promise;
    });

    expect(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para cima` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Mover ${recifeAtiva.name} para baixo` })).toBeEnabled();
  });

  it("mantém bloqueio de reorder por cidade com dois CRUDs concorrentes até cada settle", async () => {
    const user = userEvent.setup();
    const salvadorInativa = { ...salvador, active: false, updated_at: "2026-08-30T12:40:00Z" };
    const reactivateRecife = deferred<CityWithCount>();
    const reactivateSalvador = deferred<CityWithCount>();
    mocks.reactivateCity.mockReturnValueOnce(reactivateRecife.promise).mockReturnValueOnce(reactivateSalvador.promise);
    render(<CitiesPanel initialCities={[curitiba, inactiveCity, activeCity, salvadorInativa]} />);

    await user.click(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` }));
    await waitFor(() => expect(mocks.reactivateCity).toHaveBeenCalledWith(inactiveCity.id));
    await user.click(screen.getByRole("button", { name: `Reativar ${salvadorInativa.name}` }));
    await waitFor(() => expect(mocks.reactivateCity).toHaveBeenCalledWith(salvadorInativa.id));

    const moveRecife = screen.getByRole("button", { name: `Mover ${inactiveCity.name} para cima` });
    const moveSalvador = screen.getByRole("button", { name: `Mover ${salvadorInativa.name} para cima` });
    expect(moveRecife).toBeDisabled();
    expect(moveSalvador).toBeDisabled();

    await user.click(moveRecife);
    await user.click(moveSalvador);
    expect(mocks.reorderCity).not.toHaveBeenCalled();

    await act(async () => {
      reactivateSalvador.resolve({ ...salvadorInativa, active: true, updated_at: "2026-08-30T12:40:01Z" });
      await reactivateSalvador.promise;
    });

    expect(screen.getByRole("button", { name: `Mover ${inactiveCity.name} para cima` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Mover ${salvadorInativa.name} para cima` })).toBeEnabled();

    await act(async () => {
      reactivateRecife.resolve({ ...inactiveCity, active: true, updated_at: "2026-08-30T12:40:02Z" });
      await reactivateRecife.promise;
    });

    expect(screen.getByRole("button", { name: `Mover ${inactiveCity.name} para cima` })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Mover ${salvadorInativa.name} para cima` })).toBeEnabled();
  });

  it("desabilita reativar da mesma cidade durante reorder pendente e ainda mostra rollback e toast na falha", async () => {
    const user = userEvent.setup();
    const reorderFailure = deferred<CityWithCount[]>();
    mocks.reorderCity.mockReturnValueOnce(reorderFailure.promise);
    render(<CitiesPanel initialCities={[curitiba, inactiveCity, activeCity]} />);

    await user.click(screen.getByRole("button", { name: `Mover ${inactiveCity.name} para cima` }));
    expect(cityNames()).toEqual([inactiveCity.name, activeCity.name, curitiba.name]);
    expect(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` })).toBeDisabled();

    await act(async () => {
      reorderFailure.promise.catch(() => undefined);
      reorderFailure.reject(new Error("offline"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível reordenar a cidade. Tente novamente.");
    expect(cityNames()).toEqual([activeCity.name, inactiveCity.name, curitiba.name]);
    expect(screen.getByRole("button", { name: `Reativar ${inactiveCity.name}` })).toBeEnabled();
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
