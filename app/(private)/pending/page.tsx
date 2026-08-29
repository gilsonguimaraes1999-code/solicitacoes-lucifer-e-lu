import { getSessionProfile } from "@/features/auth/guards";
import { redirect } from "next/navigation";

const messages = {
  pending: ["Aguardando aprovação", "Sua conta foi criada e está aguardando a análise do responsável."],
  rejected: ["Conta não aprovada", "Seu acesso foi rejeitado. Fale com o responsável pela equipe."],
  suspended: ["Conta suspensa", "Seu acesso está temporariamente suspenso."],
} as const;

export default async function PendingPage() {
  const { profile } = await getSessionProfile();
  if (profile.approval_status === "approved") redirect("/dashboard");
  const [title, description] = messages[profile.approval_status as keyof typeof messages] ?? messages.pending;
  return <main className="grid min-h-[70vh] place-items-center p-5"><section className="panel max-w-lg p-9 text-center"><div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full bg-amber-200" /><h1 className="text-2xl font-bold">{title}</h1><p className="mt-3 text-slate-600">{description}</p><p className="mt-6 text-sm text-slate-500">Esta página será atualizada automaticamente quando seu status mudar.</p></section></main>;
}
