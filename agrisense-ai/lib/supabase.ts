// lib/supabase.ts — Singleton Supabase client (browser-side)
// Prevents "Multiple GoTrueClient instances" warning by reusing one instance.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  return _client;
}
