import { AuthMessage } from "@/components/auth/auth-message";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; senha?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="sr-only">Entrar</h1>
      <AuthMessage error={params.erro} success={params.senha ? "Senha alterada. Entre novamente." : undefined} />
      <LoginForm />
    </>
  );
}

