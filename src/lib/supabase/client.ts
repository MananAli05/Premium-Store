import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setOnline } from "../store/connection";
export type AppRole = "customer" | "admin";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const clients: Partial<Record<AppRole, SupabaseClient>> = {};

const REQUEST_WAIT_MS = 20_000;

async function fetchAndMarkOnline(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_WAIT_MS);
  init?.signal?.addEventListener("abort", () => controller.abort());

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    setOnline(true);
    return response;
  } finally {
    clearTimeout(timer);
  }
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