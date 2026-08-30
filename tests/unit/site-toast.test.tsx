import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteToastProvider } from "@/components/ui/site-toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("notificações globais", () => {
  it("exibe mensagens em fila no centro inferior e remove cada uma automaticamente", () => {
    vi.useFakeTimers();
    render(<SiteToastProvider><p>Conteúdo</p></SiteToastProvider>);

    act(() => {
      window.dispatchEvent(new CustomEvent("site:toast", { detail: { text: "Primeira mensagem", tone: "success" } }));
      window.dispatchEvent(new CustomEvent("site:toast", { detail: { text: "Segunda mensagem", tone: "success" } }));
    });

    const first = screen.getByRole("status");
    expect(first).toHaveTextContent("Primeira mensagem");
    expect(first).toHaveClass("fixed", "bottom-6", "left-1/2");
    expect(screen.queryByText("Segunda mensagem")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("status")).toHaveTextContent("Segunda mensagem");
  });
});

