import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/pending",
  refresh: vi.fn(),
  replace: vi.fn(),
  profileUpdate: undefined as undefined | ((payload: { new: Record<string, unknown> }) => void),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => {
    const channel = {
      on: vi.fn((_event: string, filter: { table: string }, callback: (payload: { new: Record<string, unknown> }) => void) => {
        if (filter.table === "profiles") mocks.profileUpdate = callback;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  },
}));

import { AccountMonitor } from "@/components/layout/account-monitor";

describe("AccountMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/pending";
    mocks.profileUpdate = undefined;
  });

  it("não navega novamente quando a conta já está na tela pendente", () => {
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.profileUpdate?.({ new: { approval_status: "pending" } }));

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("leva a conta aprovada diretamente ao painel", () => {
    render(<AccountMonitor userId="user-1" />);

    act(() => mocks.profileUpdate?.({ new: { approval_status: "approved" } }));

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });
});

