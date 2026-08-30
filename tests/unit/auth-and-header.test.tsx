import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock("@/components/layout/app-background", () => ({ AppBackground: () => null }));
import AuthLayout from "@/app/(auth)/layout";
import LoginPage from "@/app/(auth)/login/page";
import { AppHeader } from "@/components/layout/app-header";

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

  it("mostra erros de autenticação como toast no centro inferior", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ erro: "E-mail ou senha inválidos." }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(screen.getByRole("alert")).toHaveClass("fixed", "bottom-6", "left-1/2");
  });
});

describe("AppHeader", () => {
  it("usa apenas a marca como acesso ao quadro", () => {
    render(<AppHeader profile={{ id: "owner-id", full_name: "Lucifer", role: "owner", approval_status: "approved", created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z" }} />);

    expect(screen.getByRole("link", { name: /Solicitações Lucifer e Lu/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Quadro" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usuários" })).toBeVisible();
  });
});

