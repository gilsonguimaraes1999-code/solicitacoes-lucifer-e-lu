import { AuthMessage } from "@/components/auth/auth-message";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="mt-7 text-2xl font-bold text-white">Entrar</h1>
      <p className="mt-6 text-center text-sm text-white/50">Acesse o quadro com seu e-mail e senha.</p>
      <AuthMessage error={params.erro} success={params.senha ? "Senha alterada. Entre novamente." : undefined} />
      <LoginForm />
    </>
  );
}
