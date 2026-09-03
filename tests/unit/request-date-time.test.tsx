import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestDateTimePicker } from "@/components/requests/request-date-time-picker";
import {
  currentRequestLocalValue,
  isValidRequestLocalDateTime,
  requestInstantToLocalValue,
  splitRequestLocalDateTime,
} from "@/features/requests/date";
import { requestSchema } from "@/features/requests/schemas";

const validInput = {
  title: "Solicitação com data",
  description: "",
  cityIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  assignedTo: "11111111-1111-4111-8111-111111111111",
  tags: ["loja"],
  externalUrl: "",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("request date-time domain", () => {
  it("aceita data local completa e rejeita calendário ou horário impossíveis", () => {
    expect(isValidRequestLocalDateTime("2026-09-02T14:05:09")).toBe(true);
    expect(isValidRequestLocalDateTime("2026-02-30T14:05:09")).toBe(false);
    expect(isValidRequestLocalDateTime("2026-09-02T24:00:00")).toBe(false);
    expect(isValidRequestLocalDateTime("2026-09-02T14:60:00")).toBe(false);
    expect(isValidRequestLocalDateTime("2026-09-02T14:05:60")).toBe(false);
  });

  it("separa todos os componentes sem depender do fuso do navegador", () => {
    expect(splitRequestLocalDateTime("2026-09-02T04:05:06")).toEqual({
      year: 2026,
      month: 9,
      day: 2,
      hour: 4,
      minute: 5,
      second: 6,
    });
    expect(splitRequestLocalDateTime("texto inválido")).toBeNull();
  });

  it("converte instantes para o relógio de São Paulo com segundos", () => {
    expect(requestInstantToLocalValue("2026-08-29T00:00:00Z")).toBe("2026-08-28T21:00:00");
    expect(currentRequestLocalValue(new Date("2026-09-02T15:34:56Z"))).toBe("2026-09-02T12:34:56");
  });

  it("normaliza a ausência da sobrescrita e valida o valor manual no schema", () => {
    expect(requestSchema.parse(validInput).createdAtLocal).toBeNull();
    expect(requestSchema.parse({ ...validInput, createdAtLocal: null }).createdAtLocal).toBeNull();
    expect(requestSchema.parse({ ...validInput, createdAtLocal: "2026-09-02T12:34:56" }).createdAtLocal).toBe("2026-09-02T12:34:56");
    expect(() => requestSchema.parse({ ...validInput, createdAtLocal: "2026-02-30T12:00:00" })).toThrow("Informe uma data e um horário válidos.");
  });
});

describe("RequestDateTimePicker", () => {
  it("abre um popover compacto dentro da viewport sem aumentar o scroll do modal", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 760 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
    render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Escolher data e horário" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 570,
      height: 48,
      left: 620,
      right: 740,
      top: 522,
      width: 120,
      x: 620,
      y: 522,
      toJSON: () => ({}),
    });
    fireEvent.click(trigger);

    const calendar = screen.getByRole("dialog", { name: "Calendário da solicitação" });
    expect(calendar.parentElement).toBe(document.body);
    expect(calendar).toHaveClass("fixed", "w-[260px]");
    expect(Number.parseFloat(calendar.style.top)).toBeLessThan(522);
    expect(Number.parseFloat(calendar.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(calendar.style.left) + 260).toBeLessThanOrEqual(752);
  });

  it("abre um calendário temático com a data e o horário completos", () => {
    render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: "Escolher data e horário" });
    expect(trigger).toHaveTextContent("02/09/2026 12:34:56");
    fireEvent.click(trigger);

    const calendar = screen.getByRole("dialog", { name: "Calendário da solicitação" });
    expect(calendar).toHaveClass("bg-[#0d0d0d]");
    expect(within(calendar).getByText("setembro de 2026")).toBeInTheDocument();
    expect(within(calendar).getByRole("spinbutton", { name: "Hora" })).toHaveValue(12);
    expect(within(calendar).getByRole("spinbutton", { name: "Minuto" })).toHaveValue(34);
    expect(within(calendar).getByRole("spinbutton", { name: "Segundo" })).toHaveValue(56);
    expect(within(calendar).getByRole("button", { name: "2 de setembro de 2026" })).toHaveAttribute("aria-pressed", "true");
  });

  it("usa a paleta dourada sem texto preto no dia selecionado", () => {
    render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher data e horário" }));

    const calendar = screen.getByRole("dialog", { name: "Calendário da solicitação" });
    const selectedDay = within(calendar).getByRole("button", { name: "2 de setembro de 2026" });

    expect(calendar).toHaveClass("border-[#d4af37]/55");
    expect(selectedDay).toHaveClass("border-[#d4af37]/70", "bg-[#d4af37]/15", "text-[#f0d77c]");
    expect(selectedDay).not.toHaveClass("text-black");
  });

  it("centraliza os valores de hora, minuto e segundo sem controles numéricos nativos", () => {
    render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher data e horário" }));

    for (const label of ["Hora", "Minuto", "Segundo"]) {
      const input = screen.getByRole("spinbutton", { name: label });
      expect(input).toHaveClass("text-center", "[appearance:textfield]", "[&::-webkit-inner-spin-button]:appearance-none", "[&::-webkit-outer-spin-button]:appearance-none");
      expect(input.parentElement).toHaveClass("items-center", "text-center");
    }
    expect(screen.getByRole("spinbutton", { name: "Hora" }).parentElement?.parentElement).toHaveClass("border-[#d4af37]/20");
  });

  it("navega entre meses, escolhe o dia e mantém o horário", () => {
    const onChange = vi.fn();
    render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher data e horário" }));

    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "15 de outubro de 2026" }));

    expect(onChange).toHaveBeenLastCalledWith("2026-10-15T12:34:56");
  });

  it("altera hora, minuto e segundo usando limites válidos", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RequestDateTimePicker value="2026-09-02T12:34:56" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher data e horário" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Hora" }), { target: { value: "23" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-09-02T23:34:56");
    rerender(<RequestDateTimePicker value="2026-09-02T23:34:56" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minuto" }), { target: { value: "59" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-09-02T23:59:56");
    rerender(<RequestDateTimePicker value="2026-09-02T23:59:56" onChange={onChange} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Segundo" }), { target: { value: "58" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-09-02T23:59:58");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Hora" }), { target: { value: "24" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-09-02T23:59:58");
  });

  it("fecha por clique externo e Escape, devolvendo o foco ao acionador", () => {
    render(<div><RequestDateTimePicker value="2026-09-02T12:34:56" onChange={vi.fn()} /><button type="button">Fora</button></div>);
    const trigger = screen.getByRole("button", { name: "Escolher data e horário" });

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("dialog", { name: "Calendário da solicitação" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Calendário da solicitação" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
