import { z } from "zod";
import { cityIdsSchema } from "@/features/cities/schemas";
import { isValidRequestLocalDateTime } from "@/features/requests/date";
import { REQUEST_TAGS } from "@/features/requests/tags";

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048, "O link é muito longo")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Informe um link HTTP ou HTTPS válido")
  .transform((value) => value || null);

export const requestSchema = z.object({
  title: z.string().trim().min(2, "Informe o título").max(160, "Use até 160 caracteres"),
  description: z.string().trim().max(5000, "Use até 5.000 caracteres").optional().default(""),
  cityIds: cityIdsSchema,
  assignedTo: z.uuid("Selecione um responsável"),
  tags: z.array(z.enum(REQUEST_TAGS)).min(1, "Selecione pelo menos uma tag.").max(REQUEST_TAGS.length).refine((tags) => new Set(tags).size === tags.length, "Não repita tags."),
  externalUrl: optionalHttpUrl.optional().default(""),
  createdAtLocal: z.string().refine(isValidRequestLocalDateTime, "Informe uma data e um horário válidos.").nullable().optional().default(null),
});

export type RequestInput = z.input<typeof requestSchema>;
export type ParsedRequestInput = z.output<typeof requestSchema>;
