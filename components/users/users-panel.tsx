"use client";
/* eslint-disable react-hooks/set-state-in-effect -- the effect owns the initial remote fetch and realtime subscription. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Check, Pencil, Search, UserPlus, X } from "lucide-react";
import { ToastNotice } from "@/components/ui/site-toast";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { UserEditor } from "@/components/users/user-editor";
import { filterUsersByStatus, sortUsersByName, type UserSortOrder, type UserStatusFilter } from "@/features/users/filter-users";
import type { AdminUser, UserEditorValue } from "@/features/users/types";
import { createBrowserClient } from "@/lib/supabase/browser";

const statusLabels: Record<UserStatusFilter, string> = { all: "Todos", pending: "Pendentes", approved: "Aprovados", rejected: "Rejeitados", suspended: "Suspensos" };
const statusClasses: Record<AdminUser["approval_status"], string> = { pending: "status-pending", approved: "status-approved", rejected: "status-rejected", suspended: "status-suspended" };

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as { error?: string };
  return data.error ?? fallback;
}

export function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<UserSortOrder>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "Não foi possível carregar os usuários."));
      const nextUsers = await response.json() as AdminUser[];
      if (generation === loadGeneration.current) setUsers(nextUsers);
    } catch (caught) {
      if (generation === loadGeneration.current) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os usuários.");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const supabase = createBrowserClient();
    const channel = supabase.channel("admin-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_permissions" }, load)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const counts = useMemo(() => ({
    all: users.length,
    pending: users.filter((user) => user.approval_status === "pending").length,
    approved: users.filter((user) => user.approval_status === "approved").length,
    rejected: users.filter((user) => user.approval_status === "rejected").length,
    suspended: users.filter((user) => user.approval_status === "suspended").length,
  }), [users]);
  const filtered = useMemo(() => sortUsersByName(filterUsersByStatus(users.map((user) => ({ ...user, fullName: user.full_name, approvalStatus: user.approval_status })), status, query), sortOrder), [query, sortOrder, status, users]);

  async function patchUser(id: string, body: object) {
    const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(await responseError(response, "Não foi possível atualizar o usuário."));
  }

  async function saveUser(id: string, value: UserEditorValue) {
    const current = users.find((user) => user.id === id);
    if (!current) throw new Error("Usuário não encontrado. Atualize a página e tente novamente.");
    let savedSteps = 0;
    try {
      if (value.fullName !== current.full_name) { await patchUser(id, { action: "rename", fullName: value.fullName }); savedSteps += 1; }
      if (current.role !== "owner" && value.approvalStatus !== current.approval_status) { await patchUser(id, { action: "status", approvalStatus: value.approvalStatus }); savedSteps += 1; }
      if (current.role !== "owner") { await patchUser(id, { action: "permissions", permissions: value.permissions }); savedSteps += 1; }
    } catch (caught) {
      await load();
      if (savedSteps > 0) throw new Error("Algumas alterações foram salvas, mas a operação não terminou. Os dados atuais foram recarregados; revise-os antes de tentar novamente.");
      throw caught;
    }
    await load();
    setEditing(null);
  }

  async function deleteUser(id: string) {
    const target = users.find((user) => user.id === id);
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await responseError(response, "Não foi possível excluir a conta."));
    await load();
    setEditing(null);
    setNotice(`Conta de ${target?.full_name ?? "usuário"} excluída.`);
  }

  async function approve(user: AdminUser) {
    setApprovingId(user.id);
    setError("");
    try {
      await patchUser(user.id, { action: "status", approvalStatus: "approved" });
      await load();
      setNotice(`Conta de ${user.full_name} aprovada.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível aprovar a conta.");
    } finally {
      setApprovingId(null);
    }
  }

  async function createUser(value: { fullName: string; email: string; password: string }) {
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
    if (!response.ok) throw new Error(await responseError(response, "Não foi possível criar a conta."));
    await load();
    setShowCreate(false);
    setNotice("Conta criada com senha temporária.");
  }

  return <main className="relative z-10 px-4 py-6 md:px-6 md:py-8">
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">Administração</p><h1 className="mt-1 text-3xl font-black text-white">Usuários e permissões</h1><p className="mt-2 text-sm text-white/55">Aprove acessos e defina o que cada pessoa pode fazer.</p></div>
        <button className="button inline-flex items-center gap-2" onClick={() => setShowCreate(true)}><UserPlus size={18} />Nova conta</button>
      </header>

      {notice && <ToastNotice text={notice} tone="success" onClose={() => setNotice("")} />}
      {error && <ToastNotice text={error} tone="error" onClose={() => setError("")} actionLabel="Tentar novamente" onAction={() => void load()} />}

      <section className="panel mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" aria-label="Filtrar usuários por status">{(Object.keys(statusLabels) as UserStatusFilter[]).map((item) => <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(item)} className={`filter-chip ${status === item ? "active" : ""}`}>{statusLabels[item]} <span>{counts[item]}</span></button>)}</div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-3 text-white/35" size={18} /><span className="sr-only">Pesquisar usuários</span><input className="field" style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome ou e-mail" />{query && <button type="button" aria-label="Limpar pesquisa" className="absolute right-3 top-3 text-white/45 hover:text-white" onClick={() => setQuery("")}><X size={18} /></button>}</label>
          <button type="button" className="button secondary inline-flex items-center justify-center gap-2" onClick={() => setSortOrder((current) => current === "asc" ? "desc" : "asc")}>{sortOrder === "asc" ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}{sortOrder === "asc" ? "A–Z" : "Z–A"}</button>
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden" aria-label="Lista de usuários">
        <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(210px,1fr)_150px_130px_88px] gap-4 border-b border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[.14em] text-white/40 lg:grid"><span>Usuário</span><span>E-mail</span><span>Perfil</span><span>Status</span><span className="sr-only">Ações</span></div>
        {loading ? <div className="grid gap-2 p-4">{[1,2,3].map((number) => <div key={number} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div> : filtered.map((user) => <article key={user.id} className="user-row">
          <div className="min-w-0"><div className="flex items-center gap-3"><span className="avatar">{user.full_name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate font-semibold text-white">{user.full_name}</h2>{user.id === currentUserId && <p className="text-xs text-gold-soft">Sua conta</p>}</div></div></div>
          <p className="min-w-0 truncate text-sm text-white/55">{user.email}</p>
          <span className="w-fit rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/70">{user.role === "owner" ? "Owner" : "Membro"}</span>
          <span className={`status-badge ${statusClasses[user.approval_status]}`}>{statusLabels[user.approval_status]}</span>
          <div className="flex justify-end gap-2">{user.approval_status !== "approved" && <button type="button" className="icon-button text-emerald-300" aria-label={`Aprovar ${user.full_name}`} disabled={approvingId === user.id} onClick={() => void approve(user)}><Check size={17} /></button>}<button type="button" className="icon-button" aria-label={`Editar ${user.full_name}`} onClick={() => setEditing(user)}><Pencil size={17} /></button></div>
        </article>)}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-white/45">Nenhum usuário encontrado com estes filtros.</div>}
      </section>
    </div>
    {editing && <UserEditor user={editing} onClose={() => setEditing(null)} onSave={saveUser} onDelete={deleteUser} />}
    {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} onCreate={createUser} />}
  </main>;
}

