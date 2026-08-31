import { describe, expect, it } from "vitest";
import { createColumnInputSchema, createColumnSchema, renameColumnSchema } from "@/features/columns/schemas";
import { effectivePermissions } from "@/lib/permissions";

describe("column domain", () => {
  it("validates an assignee column", () => {
    expect(createColumnSchema.parse({ name: "Lucifer", assigneeId: crypto.randomUUID() }).name).toBe("Lucifer");
    expect(() => createColumnSchema.parse({ name: " ", assigneeId: "x" })).toThrow();
  });

  it("validates discriminated inputs for assignee and custom columns", () => {
    const assigneeId = crypto.randomUUID();

    expect(createColumnInputSchema.parse({ kind: "assignee", name: "  Lucifer  ", assigneeId })).toEqual({
      kind: "assignee",
      name: "Lucifer",
      assigneeId,
    });
    expect(createColumnInputSchema.parse({ kind: "custom", name: "  Prioridades  ", assigneeId: null })).toEqual({
      kind: "custom",
      name: "Prioridades",
      assigneeId: null,
    });
    expect(() => createColumnInputSchema.parse({ kind: "custom", name: "Prioridades" })).toThrow();
    expect(() => createColumnInputSchema.parse({ kind: "custom", name: "Prioridades", assigneeId })).toThrow();
    expect(() => createColumnInputSchema.parse({ kind: "assignee", name: "Lucifer" })).toThrow();
  });

  it("returns messages in pt-BR when renaming a column", () => {
    const invalidIdentifier = renameColumnSchema.safeParse({ columnId: "x", name: "Lucifer" });
    const shortName = renameColumnSchema.safeParse({ columnId: crypto.randomUUID(), name: " " });
    const longName = renameColumnSchema.safeParse({ columnId: crypto.randomUUID(), name: "L".repeat(81) });

    expect(invalidIdentifier.error?.issues[0]?.message).toBe("Selecione uma coluna");
    expect(shortName.error?.issues[0]?.message).toBe("Informe o nome");
    expect(longName.error?.issues[0]?.message).toBe("Use até 80 caracteres");
  });

  it("gives column management to owner and explicit members", () => {
    expect(effectivePermissions({ role: "owner", approval_status: "pending" }, null).canManageColumns).toBe(true);
    expect(effectivePermissions({ role: "member", approval_status: "approved" }, { can_manage_columns: true }).canManageColumns).toBe(true);
    expect(effectivePermissions({ role: "member", approval_status: "approved" }, null).canManageColumns).toBe(false);
  });

  it("denies column management to non-approved members even with the flag", () => {
    for (const approval_status of ["pending", "rejected", "suspended"] as const) {
      expect(effectivePermissions({ role: "member", approval_status }, { can_manage_columns: true }).canManageColumns).toBe(false);
    }
  });
});
