"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/features/auth/schemas";

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?erro=Dados%20inválidos");
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?erro=E-mail%20ou%20senha%20inválidos");
  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/register?erro=Revise%20os%20dados%20informados");
  const { error } = await createAdminClient().auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error) redirect("/register?erro=Não%20foi%20possível%20criar%20a%20conta");
  const supabase = await createServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (signInError) redirect("/login");
  redirect("/pending");
}

export async function sendPasswordReset(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/forgot-password?erro=E-mail%20inválido");
  const supabase = await createServerClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  redirect("/forgot-password?enviado=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/reset-password?erro=As%20senhas%20não%20coincidem");
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/reset-password?erro=Não%20foi%20possível%20alterar%20a%20senha");
  redirect("/login?senha=alterada");
}

export async function logout() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

