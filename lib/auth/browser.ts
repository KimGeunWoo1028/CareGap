import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

/** Browser Auth client: memory session only; refresh requires re-login after reload. */
export function createBrowserAuthClient(): SupabaseClient {
  const env = getPublicEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
}

export function getBrowserAuthClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserAuthClient();
  }
  return browserClient;
}

export async function signInWithPassword(email: string, password: string) {
  const client = getBrowserAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { session: null, user: null, error };
  }
  return { session: data.session, user: data.user, error: null };
}

export async function signOut() {
  const client = getBrowserAuthClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  return { error };
}

export async function getAccessToken(): Promise<string | null> {
  const client = getBrowserAuthClient();
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}
