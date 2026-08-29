"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";

export function AccountMonitor({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase.channel(`account:${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (payload: { new: Record<string, unknown> }) => {
        const status = (payload.new as { approval_status?: string }).approval_status;
        if (status === "approved") {
          router.replace("/dashboard");
        } else if (pathname !== "/pending") {
          router.replace("/pending");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_permissions", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [pathname, router, userId]);
  return null;
}

