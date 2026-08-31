import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

afterEach(() => cleanup());

describe("ConfirmDialog", () => {
  const defaultProps = {
    ariaLabel: "Confirmar exclusão",
    title: "Excluir lista?",
    itemName: "Prioridades",
    description: "A lista será removida permanentemente.",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("monta o diálogo no body fora de um ancestral transformado", () => {
    render(
      <div data-testid="dragged-column" style={{ transform: "translate3d(0, 0, 0)", overflow: "hidden" }}>
        <ConfirmDialog {...defaultProps} />
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Confirmar exclusão" });
    expect(screen.getByTestId("dragged-column")).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
  });

  it("preserva a semântica modal e move o foco inicial para cancelar", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByRole("dialog", { name: "Confirmar exclusão" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("permite cancelar por Escape ou botão e confirmar pelo botão de ação", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("bloqueia Escape e ações enquanto está ocupado", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} busy onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluindo..." })).toBeDisabled();
  });

  it("leva Tab do último controle de volta ao primeiro", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    const confirmButton = screen.getByRole("button", { name: "Excluir definitivamente" });
    confirmButton.focus();

    fireEvent.keyDown(confirmButton, { key: "Tab" });

    expect(cancelButton).toHaveFocus();
  });

  it("leva Shift+Tab do primeiro controle de volta ao último", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    const confirmButton = screen.getByRole("button", { name: "Excluir definitivamente" });

    fireEvent.keyDown(cancelButton, { key: "Tab", shiftKey: true });

    expect(confirmButton).toHaveFocus();
  });

  it("restaura o foco ao elemento invocador quando fecha e desmonta", () => {
    function ConfirmationHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Excluir lista</button>
          {open && <ConfirmDialog {...defaultProps} onCancel={() => setOpen(false)} />}
        </>
      );
    }

    render(<ConfirmationHarness />);
    const trigger = screen.getByRole("button", { name: "Excluir lista" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(trigger).toHaveFocus();
  });

  it("pode ser renderizado no servidor sem acessar document", () => {
    expect(() => renderToString(<ConfirmDialog {...defaultProps} />)).not.toThrow();
  });
});
