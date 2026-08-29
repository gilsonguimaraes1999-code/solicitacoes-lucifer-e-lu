import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome").max(120, "Use até 120 caracteres"),
    email: z.email("Informe um e-mail válido"),
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email: z.email("Informe um e-mail válido") });

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
