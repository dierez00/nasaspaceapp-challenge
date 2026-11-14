"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/shared/config/env";
import type { Database } from "@/server/db/database.types";

export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
