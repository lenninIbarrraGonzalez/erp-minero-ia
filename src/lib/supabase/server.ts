import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. The ERP demo is read-only and unauthenticated,
 * so there is no session to persist. Keys are read from server env and never
 * reach the browser bundle (enforced by the `server-only` import).
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY environment variables",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
