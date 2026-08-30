import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  permissionsMaybeSingle: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("@/features/auth/actions", () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock("@/components/layout/app-background", () => ({ AppBackground: () => null }));
vi.mock("next/navigation", () => ({ redirect: guardMocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: guardMocks.getUser },
    from: (table: string) => ({ select: () => ({ eq: () => table === "profiles" ? { single: guardMocks.profileSingle } : { maybeSingle: guardMocks.permissionsMaybeSingle } }) }),
  }),
}));
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import { metadata } from "@/app/layout";
import { AppHeader } from "@/components/layout/app-header";
import { requireCityManager } from "@/features/auth/guards";

const owner = { id: "owner-id", full_name: "Lucifer", role: "owner" as const, approval_status: "approved" as const, created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z" };
const approvedMember = { ...owner, id: "member-id", full_name: "Lu", role: "member" as const };
const memberPermissions = { canCreate: false, canEdit: false, canMove: false, canDelete: false, canManageColumns: false, canManageCities: false };

afterEach(() => cleanup());

describe("autenticação", () => {
  it("integra o conteúdo ao fundo sem restaurar a caixa externa", () => {
    const { container } = render(<AuthLayout><p>Conteúdo</p></AuthLayout>);

    expect(container.querySelector(".auth-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Solicitações")).not.toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeVisible();
  });

  it("repete a hierarquia e as ações do login da calculadora", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Entrar" })).toHaveClass("sr-only");
    expect(screen.queryByText("Acesse o quadro com seu e-mail e senha.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveClass("calculator-login-field");
    expect(screen.getByRole("button", { name: "Entrar" })).toHaveClass("calculator-login-primary");
    expect(screen.getByRole("link", { name: "Esqueci minha senha" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Solicitar novo acesso" })).toHaveAttribute("href", "/register");
  });

  it("permite mostrar e ocultar a senha no login", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));
    const password = screen.getByLabelText("Senha");

    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("mostra erros abaixo das ações sem sobrepor o conteúdo", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ erro: "E-mail ou senha inválidos." }) }));

    const alert = screen.getByRole("alert");
    const accessLink = screen.getByRole("link", { name: "Solicitar novo acesso" });
    expect(alert).toHaveTextContent("E-mail ou senha inválidos.");
    expect(alert).not.toHaveClass("fixed");
    expect(accessLink.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("usa a logo angelical como único ícone do navegador", () => {
    expect(metadata.icons).toEqual({ icon: [{ url: "/angel-a.png?v=2", type: "image/png" }] });
  });
});

describe("AppHeader", () => {
  it("usa apenas a marca como acesso ao quadro", () => {
    render(<AppHeader profile={owner} permissions={{ ...memberPermissions, canManageCities: true }} />);

    expect(screen.getByRole("link", { name: /Solicitações Lucifer e Lu/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Quadro" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usuários" })).toBeVisible();
  });

  it("mostra Cidades para membro autorizado e mantém Usuários exclusivo do owner", () => {
    render(<AppHeader profile={approvedMember} permissions={{ ...memberPermissions, canManageCities: true }} />);

    expect(screen.getByRole("link", { name: "Cidades" })).toHaveAttribute("href", "/admin/cities");
    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
  });

  it("mostra Usuários e Cidades para owner, nesta ordem", () => {
    render(<AppHeader profile={owner} permissions={{ ...memberPermissions, canManageCities: true }} />);

    const users = screen.getByRole("link", { name: "Usuários" });
    const cities = screen.getByRole("link", { name: "Cidades" });
    expect(users.compareDocumentPosition(cities) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("oculta Usuários e Cidades para membro sem permissão", () => {
    render(<AppHeader profile={approvedMember} permissions={memberPermissions} />);

    expect(screen.queryByRole("link", { name: "Usuários" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cidades" })).not.toBeInTheDocument();
  });
});

describe("requireCityManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    guardMocks.profileSingle.mockResolvedValue({ data: approvedMember });
    guardMocks.permissionsMaybeSingle.mockResolvedValue({ data: { user_id: "user-1", can_manage_cities: true } });
  });

  it("retorna a sessão do owner", async () => {
    guardMocks.profileSingle.mockResolvedValue({ data: owner });
    guardMocks.permissionsMaybeSingle.mockResolvedValue({ data: { user_id: "owner-id", can_manage_cities: false } });

    await expect(requireCityManager()).resolves.toMatchObject({ profile: owner, effective: { canManageCities: true } });
  });

  it("retorna membro aprovado com permissão persistida", async () => {
    await expect(requireCityManager()).resolves.toMatchObject({ profile: approvedMember, effective: { canManageCities: true } });
  });

  it("redireciona membro aprovado sem permissão antes de entregar a sessão", async () => {
    guardMocks.permissionsMaybeSingle.mockResolvedValue({ data: { user_id: "user-1", can_manage_cities: false } });

    await expect(requireCityManager()).rejects.toThrow("redirect:/dashboard");
    expect(guardMocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
