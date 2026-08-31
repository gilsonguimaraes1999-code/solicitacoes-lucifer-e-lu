"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AccountMonitor({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const supabase = createBrowserClient();
    let removed = false;

    const applyStatus = (status?: string) => {
      if (status === "approved") {
        if (pathname === "/pending") router.replace("/dashboard");
      } else if (status && pathname !== "/pending") {
        router.replace("/pending");
      }
    };

    const removeAccount = async () => {
      if (removed) return;
      removed = true;
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/login?erro=Sua%20conta%20foi%20removida");
      router.refresh();
    };

    const checkAccount = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== userId) {
        await removeAccount();
        return;
      }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("approval_status").eq("id", userId).maybeSingle();
      if (profileError) return;
      if (!profile) {
        await removeAccount();
        return;
      }
      applyStatus(profile.approval_status);
    };

    const channel = supabase.channel(`account:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (payload: { new: Record<string, unknown> }) => {
        applyStatus((payload.new as { approval_status?: string }).approval_status);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "profiles" }, (payload: { old: Record<string, unknown> }) => {
        if ((payload.old as { id?: string }).id === userId) void removeAccount();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_permissions", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    const interval = window.setInterval(() => { void checkAccount(); }, 5000);
    return () => { window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [pathname, router, userId]);
  return null;
}
