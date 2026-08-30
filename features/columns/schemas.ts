import { z } from "zod";

export const createColumnSchema = z.object({
  name: z.string({ error: "Informe o nome" }).trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres"),
  assigneeId: z.uuid("Selecione um responsável"),
});

export const renameColumnSchema = z.object({
  columnId: z.uuid("Selecione uma coluna"),
  name: z.string({ error: "Informe o nome" }).trim().min(2, "Informe o nome").max(80, "Use até 80 caracteres"),
});
