import { updatePassword } from "@/features/auth/actions";
import { AuthMessage } from "@/components/auth/auth-message";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  return <><h1 className="mt-7 text-2xl font-bold">Nova senha</h1><AuthMessage error={params.erro} /><form action={updatePassword} className="mt-6 grid gap-4"><label className="label">Nova senha<input className="field" name="password" type="password" minLength={8} required /></label><label className="label">Confirmar senha<input className="field" name="confirmPassword" type="password" minLength={8} required /></label><button className="button">Alterar senha</button></form></>;
}
