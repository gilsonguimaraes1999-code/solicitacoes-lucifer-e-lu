import { z } from "zod";

const columnNameSchema = z.string({ error: "Informe o nome" }).trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres");

export const createColumnInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("assignee"),
    name: columnNameSchema,
    assigneeId: z.uuid("Selecione um responsável"),
  }).strict(),
  z.object({
    kind: z.literal("custom"),
    name: columnNameSchema,
    assigneeId: z.null(),
  }).strict(),
]);

const legacyAssigneeColumnSchema = z.object({
  name: z.string({ error: "Informe o nome" }).trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres"),
  assigneeId: z.uuid("Selecione um responsável"),
}).strict();

export const createColumnSchema = legacyAssigneeColumnSchema;

export const renameColumnSchema = z.object({
  columnId: z.uuid("Selecione uma coluna"),
  name: columnNameSchema,
});
