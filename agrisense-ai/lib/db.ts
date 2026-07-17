// lib/db.ts — Neon PostgreSQL serverless client (server-side only)
// Replaces lib/supabase.ts. Use this in API Routes and server components ONLY.
// Do NOT import this file in "use client" components — use fetch('/api/...') instead.

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("[db] Missing DATABASE_URL environment variable");
}

export const sql = neon(process.env.DATABASE_URL);
