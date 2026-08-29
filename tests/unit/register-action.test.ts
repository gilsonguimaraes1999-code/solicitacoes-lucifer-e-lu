import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminCreateUser: vi.fn(),
  redirect: vi.fn(),
  serverSignIn: vi.fn(),
  serverSignUp: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "https://solicitacoes-lucifer-e-lu.vercel.app" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { createUser: mocks.adminCreateUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { signInWithPassword: mocks.serverSignIn, signUp: mocks.serverSignUp },
  }),
}));

import { register } from "@/features/auth/actions";

describe("register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminCreateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.serverSignIn.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.serverSignUp.mockResolvedValue({ data: null, error: null });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  it("cria a conta pelo servidor sem depender do envio de confirmação", async () => {
    const formData = new FormData();
    formData.set("fullName", "Lucifer Lu");
    formData.set("email", "lucifer@gmail.com");
    formData.set("password", "SenhaSegura123!");
    formData.set("confirmPassword", "SenhaSegura123!");

    await expect(register(formData)).rejects.toThrow("REDIRECT:/pending");

    expect(mocks.adminCreateUser).toHaveBeenCalledWith({
      email: "lucifer@gmail.com",
      password: "SenhaSegura123!",
      email_confirm: true,
      user_metadata: { full_name: "Lucifer Lu" },
    });
    expect(mocks.serverSignIn).toHaveBeenCalledWith({
      email: "lucifer@gmail.com",
      password: "SenhaSegura123!",
    });
    expect(mocks.serverSignUp).not.toHaveBeenCalled();
  });
});

