import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Server-only service/secret client. Bypasses RLS — never expose to the browser.
 * Use only after user JWT auth + ownership checks, with conditional UPDATEs.
 */
export function createServiceRoleClient(): SupabaseClient {
  const env = getServerEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
