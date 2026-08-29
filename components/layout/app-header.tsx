import Link from "next/link";
import { logout } from "@/features/auth/actions";
import type { Profile } from "@/features/requests/types";

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
        <div><Link href="/dashboard" className="font-extrabold">Solicitações</Link><p className="text-xs text-slate-500">Quadro da equipe</p></div>
        <nav className="flex items-center gap-3 text-sm">
          {profile.role === "owner" && <Link href="/admin/users" className="font-semibold text-blue-700">Usuários</Link>}
          <span className="hidden text-slate-600 sm:inline">{profile.full_name}</span>
          <form action={logout}><button className="button secondary" type="submit">Sair</button></form>
        </nav>
      </div>
    </header>
  );
}
