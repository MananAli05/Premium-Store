import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setOnline } from "../store/connection";
export type AppRole = "customer" | "admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const clients: Partial<Record<AppRole, SupabaseClient>> = {};

async function fetchAndMarkOnline(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  setOnline(true);
  return response;
}
export function getSupabase(role: AppRole) {
  if (!clients[role]) {
    clients[role] = createClient(url, key, {
      auth: { storageKey: `premium-store-${role}`, persistSession: true, autoRefreshToken: true },
      global: { fetch: fetchAndMarkOnline },
    });
  }
  return clients[role];
}
export function createTemporaryClient() {
  return createClient(url, key, {
    auth: { storageKey: "premium-store-reset", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}