import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

export type UserScopedClient = SupabaseClient;

/**
 * Auth verification client using the publishable key only.
 * Never put secret/service_role into browser bundles or user queries.
 */
export function createAuthVerificationClient(): SupabaseClient {
  const env = getPublicEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

/**
 * DB client authenticated as the end user so RLS (auth.uid()) applies.
 * Uses publishable key + user JWT — not the secret/service_role key.
 */
export function createUserScopedClient(accessToken: string): UserScopedClient {
  const env = getPublicEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
