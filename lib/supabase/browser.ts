"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

let client: ReturnType<typeof createSsrBrowserClient> | undefined;

export function createBrowserClient() {
  if (!client) {
    const env = getPublicEnv();
    client = createSsrBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}
