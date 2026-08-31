import { z } from "zod";

const columnNameSchema = z.string({ error: "Informe o nome" }).trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres");
const columnColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Selecione uma cor válida").transform((value) => value.toLowerCase());

export const createColumnInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("assignee"),
    name: columnNameSchema,
    assigneeId: z.uuid("Selecione um responsável"),
    color: columnColorSchema,
  }).strict(),
  z.object({
    kind: z.literal("custom"),
    name: columnNameSchema,
    assigneeId: z.null(),
    color: columnColorSchema,
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
  color: columnColorSchema,
});
