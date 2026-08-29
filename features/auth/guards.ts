import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Profile, UserPermissions } from "@/features/requests/types";

export async function requireUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function getSessionProfile() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_permissions").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profile) redirect("/pending");
  return { supabase, user, profile: profile as Profile, permissions: permissions as UserPermissions | null };
}

export async function requireApprovedProfile() {
  const session = await getSessionProfile();
  if (session.profile.approval_status !== "approved") redirect("/pending");
  return session;
}

export async function requireOwner() {
  const session = await requireApprovedProfile();
  if (session.profile.role !== "owner") redirect("/dashboard");
  return session;
}
