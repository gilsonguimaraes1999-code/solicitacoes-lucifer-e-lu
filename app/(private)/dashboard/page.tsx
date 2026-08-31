import { KanbanBoard } from "@/components/kanban/kanban-board";
import { requireApprovedProfile } from "@/features/auth/guards";
import type { BoardColumn } from "@/features/columns/types";
import type { City } from "@/features/cities/types";
import { effectivePermissions } from "@/lib/permissions";
import { normalizeRequestRecord, REQUEST_WITH_RELATIONS_SELECT, type Profile, type RequestRecordRaw } from "@/features/requests/types";

export default async function DashboardPage() {
  const { supabase, user, profile, permissions } = await requireApprovedProfile();
  const [requestsResult, profilesResult, columnsResult, citiesResult] = await Promise.all([
    supabase.from("requests").select(REQUEST_WITH_RELATIONS_SELECT).order("position").order("id"),
    supabase.from("profiles").select("*").eq("approval_status", "approved").order("full_name"),
    supabase.from("board_columns").select("*").order("position").order("id"),
    supabase.from("cities").select("*").order("position").order("name").order("id"),
  ]);
  if (requestsResult.error) throw requestsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (columnsResult.error) throw columnsResult.error;
  if (citiesResult.error) throw citiesResult.error;
  const requests = (requestsResult.data ?? []).map((request) => normalizeRequestRecord(request as RequestRecordRaw));
  return <KanbanBoard initialRequests={requests} initialColumns={(columnsResult.data ?? []) as BoardColumn[]} cities={(citiesResult.data ?? []) as City[]} profiles={(profilesResult.data ?? []) as Profile[]} currentUserId={user.id} permissions={effectivePermissions(profile, permissions)} />;
}
