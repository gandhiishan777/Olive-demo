import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton across hot-reloads in dev. The service-role key bypasses RLS,
// so this module must never be imported from a client component. The
// `server-only` import above causes a build error if that happens.
const globalForSupabase = globalThis as unknown as {
  __supabaseAdmin?: SupabaseClient;
};

export function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.__supabaseAdmin) return globalForSupabase.__supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  globalForSupabase.__supabaseAdmin = client;
  return client;
}
