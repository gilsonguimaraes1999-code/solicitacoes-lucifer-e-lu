import Link from "next/link";
import { register } from "@/features/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="mt-7 text-2xl font-bold">Criar conta</h1>
      <p className="mt-2 text-sm text-slate-500">Após o cadastro, sua conta aguardará aprovação.</p>
      <AuthMessage error={params.erro} />
      <form action={register} className="mt-6 grid gap-4">
        <label className="label">Nome completo<input className="field" name="fullName" required maxLength={120} /></label>
        <label className="label">E-mail<input className="field" name="email" type="email" required /></label>
        <label className="label">Senha<input className="field" name="password" type="password" minLength={8} required /></label>
        <label className="label">Confirmar senha<input className="field" name="confirmPassword" type="password" minLength={8} required /></label>
        <button className="button" type="submit">Cadastrar</button>
      </form>
      <p className="mt-5 text-sm"><Link href="/login">Voltar ao login</Link></p>
    </>
  );
}
