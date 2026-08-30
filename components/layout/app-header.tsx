import Link from "next/link";
import Image from "next/image";
import { LogOut, Users } from "lucide-react";
import { logout } from "@/features/auth/actions";
import type { Profile } from "@/features/requests/types";

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
        <Link href="/dashboard" className="flex items-center gap-3"><Image src="/angel-a.png" alt="" width={48} height={48} className="h-11 w-11 object-contain" priority /><div><span className="font-display font-black uppercase tracking-[.08em] text-white">Solicitações</span><p className="text-xs text-white/40">Lucifer e Lu</p></div></Link>
        <nav className="flex items-center gap-2 text-sm">
          {profile.role === "owner" && <Link href="/admin/users" className="nav-link"><Users size={16} /><span className="hidden sm:inline">Usuários</span></Link>}
          <span className="hidden border-l border-white/10 pl-3 text-white/55 lg:inline">{profile.full_name}</span>
          <form action={logout}><button className="nav-link" type="submit"><LogOut size={16} /><span className="hidden sm:inline">Sair</span></button></form>
        </nav>
      </div>
    </header>
  );
}
