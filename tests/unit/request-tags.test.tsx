import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestTagSelector } from "@/components/requests/request-tags";

afterEach(cleanup);

describe("RequestTagSelector", () => {
  it("usa chips compactos, alinhados e uma cor própria para cada tag", () => {
    render(<RequestTagSelector value={["hub"]} onChange={vi.fn()} />);

    const f1 = screen.getByRole("button", { name: "Tag F1" });
    const loja = screen.getByRole("button", { name: "Tag Loja" });
    const jogo = screen.getByRole("button", { name: "Tag Jogo" });
    const hub = screen.getByRole("button", { name: "Tag HUB" });
    const growth = screen.getByRole("button", { name: "Tag Growth" });
    const outros = screen.getByRole("button", { name: "Tag Outros" });

    for (const chip of [f1, loja, jogo, hub, growth, outros]) {
      expect(chip).toHaveClass("h-7", "px-2.5", "text-xs");
      expect(chip).not.toHaveClass("filter-chip");
    }

    expect(f1.className).toContain("rose");
    expect(loja.className).toContain("amber");
    expect(jogo.className).toContain("violet");
    expect(hub.className).toContain("sky");
    expect(growth.className).toContain("emerald");
    expect(outros.className).toContain("slate");
    expect(hub).toHaveAttribute("aria-pressed", "true");
  });
});
