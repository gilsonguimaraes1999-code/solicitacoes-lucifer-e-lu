import { KanbanBoard } from "@/components/kanban/kanban-board";
import { requireApprovedProfile } from "@/features/auth/guards";
import { effectivePermissions } from "@/lib/permissions";
import type { Profile, RequestRecord } from "@/features/requests/types";

export default async function DashboardPage() {
  const { supabase, user, profile, permissions } = await requireApprovedProfile();
  const [{ data: requests }, { data: profiles }] = await Promise.all([
    supabase.from("requests").select("*, assignee:profiles!requests_assigned_to_fkey(id,full_name)").order("position"),
    supabase.from("profiles").select("*").eq("approval_status", "approved").order("full_name"),
  ]);
  return <KanbanBoard initialRequests={(requests ?? []) as RequestRecord[]} profiles={(profiles ?? []) as Profile[]} currentUserId={user.id} permissions={effectivePermissions(profile, permissions)} />;
}
