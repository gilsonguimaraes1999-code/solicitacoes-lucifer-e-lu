import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/pending",
  refresh: vi.fn(),
  replace: vi.fn(),
  profileUpdate: undefined as undefined | ((payload: { new: Record<string, unknown> }) => void),
  profileDelete: undefined as undefined | ((payload: { old: Record<string, unknown> }) => Promise<void> | void),
  permissionUpdate: undefined as undefined | (() => void),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  signOut: vi.fn(),
  channels: [] as Array<object>,
  removeChannel: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => {
    const channel = {
      on: vi.fn((_type: string, filter: { event: string; table: string }, callback: (payload: never) => void) => {
        if (filter.table === "profiles" && filter.event === "UPDATE") mocks.profileUpdate = callback as typeof mocks.profileUpdate;
        if (filter.table === "profiles" && filter.event === "DELETE") mocks.profileDelete = callback as typeof mocks.profileDelete;
        if (filter.table === "user_permissions" && filter.event === "UPDATE") mocks.permissionUpdate = callback as typeof mocks.permissionUpdate;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    mocks.channels.push(channel);
    return {
      auth: { getUser: mocks.getUser, signOut: mocks.signOut },
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })) })) })),
      channel: vi.fn(() => channel),
      removeChannel: mocks.removeChannel,
    };
  },
}));

import { AccountMonitor } from "@/components/layout/account-monitor";

describe("AccountMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/pending";
    mocks.profileUpdate = undefined;
    mocks.profileDelete = undefined;
    mocks.permissionUpdate = undefined;
    mocks.channels = [];
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { approval_status: "pending" }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.useRealTimers());

  it("não navega novamente quando a conta já está na tela pendente", () => {
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.profileUpdate?.({ new: { approval_status: "pending" } }));

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("leva a conta aprovada da tela pendente diretamente ao painel", () => {
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.profileUpdate?.({ new: { approval_status: "approved" } }));

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("mantém a conta aprovada na página administrativa de cidades", () => {
    mocks.pathname = "/admin/cities";
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.profileUpdate?.({ new: { approval_status: "approved" } }));

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("atualiza o layout quando as permissões da conta mudam", () => {
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.permissionUpdate?.());

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("mantém uma assinatura única e a remove ao desmontar", () => {
    const { unmount } = render(<AccountMonitor userId="user-1" />);

    expect(mocks.channels).toHaveLength(1);
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.channels[0]);
  });

  it("encerra a sessão quando o perfil da conta é excluído em tempo real", async () => {
    render(<AccountMonitor userId="user-1" />);

    await act(async () => {
      await mocks.profileDelete?.({ old: { id: "user-1" } });
    });

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.replace).toHaveBeenCalledWith("/login?erro=Sua%20conta%20foi%20removida");
  });

  it("retira o acesso ao detectar suspensão na verificação de segurança", async () => {
    vi.useFakeTimers();
    mocks.pathname = "/dashboard";
    mocks.maybeSingle.mockResolvedValue({ data: { approval_status: "suspended" }, error: null });
    render(<AccountMonitor userId="user-1" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.replace).toHaveBeenCalledWith("/pending");
  });

  it("não navega novamente quando a conta aprovada já está no painel", async () => {
    vi.useFakeTimers();
    mocks.pathname = "/dashboard";
    mocks.maybeSingle.mockResolvedValue({ data: { approval_status: "approved" }, error: null });
    render(<AccountMonitor userId="user-1" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
