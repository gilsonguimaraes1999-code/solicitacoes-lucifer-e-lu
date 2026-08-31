import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CityMultiSelect } from "@/components/cities/city-multi-select";
import type { City } from "@/features/cities/types";

const curitiba: City = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Curitiba",
  position: 1024,
  active: true,
  created_by: null,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
};

const inactiveCity: City = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Recife",
  position: 2048,
  active: false,
  created_by: null,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
};

const saoPaulo: City = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "São Paulo",
  position: 3072,
  active: true,
  created_by: null,
  created_at: "2026-08-30T00:00:00Z",
  updated_at: "2026-08-30T00:00:00Z",
};

const cities = [saoPaulo, inactiveCity, curitiba];

afterEach(cleanup);

describe("CityMultiSelect", () => {
  it("seleciona todas, mostra estado indeterminado e desmarca todas", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<CityMultiSelect cities={cities} value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    await user.click(screen.getByRole("checkbox", { name: "Selecionar todas" }));
    expect(onChange).toHaveBeenLastCalledWith([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);

    rerender(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]} onChange={onChange} />);
    expect(screen.getByRole("checkbox", { name: "Selecionar todas" })).toHaveAttribute("aria-checked", "mixed");

    rerender(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox", { name: "Desmarcar todas" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("fecha por Escape e preserva cidade desativada já selecionada", async () => {
    const user = userEvent.setup();
    render(<CityMultiSelect cities={cities} value={["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    expect(screen.getByText("Desativada")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Cidades disponíveis" })).not.toBeInTheDocument();
  });

  it("resume zero, uma e várias cidades selecionadas", () => {
    const { rerender } = render(<CityMultiSelect cities={cities} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent("Selecione cidades");

    rerender(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent("Curitiba");

    rerender(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Selecionar cidades" })).toHaveTextContent("2 cidades selecionadas");
  });

  it("alterna pelo acionador, fecha fora e devolve foco após Escape", async () => {
    const user = userEvent.setup();
    render(<><CityMultiSelect cities={cities} value={[]} onChange={vi.fn()} /><button type="button">Fora</button></>);
    const trigger = screen.getByRole("button", { name: "Selecionar cidades" });

    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Cidades disponíveis" })).toBeInTheDocument();
    await user.click(trigger);
    expect(screen.queryByRole("listbox", { name: "Cidades disponíveis" })).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("listbox", { name: "Cidades disponíveis" })).not.toBeInTheDocument();

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("alterna cidades ativas por clique e teclado sem duplicar IDs", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    await user.click(screen.getByRole("option", { name: "São Paulo" }));
    expect(onChange).toHaveBeenLastCalledWith([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);

    rerender(<CityMultiSelect cities={cities} value={["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"]} onChange={onChange} />);
    screen.getByRole("option", { name: "Curitiba" }).focus();
    await user.keyboard("{Space}");
    expect(onChange).toHaveBeenLastCalledWith(["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
  });

  it("mantém o histórico inativo removível e o preserva ao selecionar ou limpar todas", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<CityMultiSelect cities={cities} value={["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    expect(screen.getByRole("option", { name: "Recife Desativada" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("checkbox", { name: "Selecionar todas" }));
    expect(onChange).toHaveBeenLastCalledWith([
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ]);

    rerender(<CityMultiSelect cities={cities} value={["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox", { name: "Desmarcar todas" }));
    expect(onChange).toHaveBeenLastCalledWith(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
    rerender(<CityMultiSelect cities={cities} value={["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]} onChange={onChange} />);
    await user.click(screen.getByRole("option", { name: "Recife Desativada" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("não mostra cidade inativa não selecionada e segue a ordem persistida em vez da alfabética", async () => {
    const user = userEvent.setup();
    const sameNameFirst = { ...curitiba, id: "11111111-1111-4111-8111-111111111111", name: "Águas", position: 1536 };
    const sameNameSecond = { ...curitiba, id: "22222222-2222-4222-8222-222222222222", name: "Águas", position: 1536 };
    const curitibaAfterSaoPaulo = { ...curitiba, position: 4096 };
    render(<CityMultiSelect cities={[saoPaulo, inactiveCity, sameNameSecond, curitibaAfterSaoPaulo, sameNameFirst]} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    expect(screen.queryByText("Recife")).not.toBeInTheDocument();
    const listbox = screen.getByRole("listbox", { name: "Cidades disponíveis" });
    expect(within(listbox).getAllByRole("option").map((option) => option.getAttribute("aria-label"))).toEqual(["Águas", "Águas", "São Paulo", "Curitiba"]);
    expect(within(listbox).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("expõe ARIA, linha fixa e rolagem temática e não abre quando desabilitado", async () => {
    const user = userEvent.setup();
    render(<CityMultiSelect cities={cities} value={[]} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "Selecionar cidades" });

    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("mantém selecionar-todas fora da lista e usa opções sem controles aninhados", async () => {
    const user = userEvent.setup();
    render(<CityMultiSelect cities={cities} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Selecionar cidades" }));
    const listbox = screen.getByRole("listbox", { name: "Cidades disponíveis" });
    const selectAll = screen.getByRole("checkbox", { name: "Selecionar todas" });
    expect(selectAll.closest("label")).toHaveClass("sticky", "top-0");
    expect(selectAll.closest(".city-options-scroll")).toContainElement(listbox);
    expect(listbox).not.toContainElement(selectAll);
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    expect(within(listbox).queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
