import Link from "next/link";
import { sendPasswordReset } from "@/features/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ erro?: string; enviado?: string }> }) {
  const params = await searchParams;
  return <><h1 className="mt-7 text-2xl font-bold">Recuperar senha</h1><p className="mt-2 text-sm text-slate-500">Enviaremos as instruções para seu e-mail.</p><AuthMessage error={params.erro} success={params.enviado ? "Se a conta existir, o e-mail foi enviado." : undefined} /><form action={sendPasswordReset} className="mt-6 grid gap-4"><label className="label">E-mail<input className="field" name="email" type="email" required /></label><button className="button">Enviar instruções</button></form><p className="mt-5 text-sm"><Link href="/login">Voltar ao login</Link></p></>;
}
