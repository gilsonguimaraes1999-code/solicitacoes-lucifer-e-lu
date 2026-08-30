import { z } from "zod";

export const cityNameSchema = z.string().trim().min(2, "Informe o nome da cidade.").max(120, "Use até 120 caracteres.");
export const cityIdsSchema = z.array(z.uuid("Cidade inválida."))
  .min(1, "Selecione pelo menos uma cidade.")
  .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, "Não repita cidades.");
