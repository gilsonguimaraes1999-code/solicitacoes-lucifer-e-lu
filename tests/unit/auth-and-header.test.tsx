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
    expect(screen.getByText("Conteúdo")).toBeVisible();
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
});

describe("AppHeader", () => {
  it("usa apenas a marca como acesso ao quadro", () => {
    render(<AppHeader profile={{ id: "owner-id", full_name: "Lucifer", role: "owner", approval_status: "approved", created_at: "2026-08-30T00:00:00Z", updated_at: "2026-08-30T00:00:00Z" }} />);

    expect(screen.getByRole("link", { name: /Solicitações Lucifer e Lu/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Quadro" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usuários" })).toBeVisible();
  });
});
