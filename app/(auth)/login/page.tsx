import Link from "next/link";
import { login } from "@/features/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="mt-7 text-2xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-slate-500">Acesse o quadro com seu e-mail e senha.</p>
      <AuthMessage error={params.erro} success={params.senha ? "Senha alterada. Entre novamente." : undefined} />
      <form action={login} className="mt-6 grid gap-4">
        <label className="label">E-mail<input className="field" name="email" type="email" autoComplete="email" required /></label>
        <label className="label">Senha<input className="field" name="password" type="password" autoComplete="current-password" required /></label>
        <button className="button" type="submit">Entrar</button>
      </form>
      <div className="mt-5 flex justify-between text-sm"><Link href="/register">Criar conta</Link><Link href="/forgot-password">Esqueci a senha</Link></div>
    </>
  );
}
