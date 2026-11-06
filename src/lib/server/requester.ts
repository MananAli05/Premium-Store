import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export type Requester = { id: string; isAdmin: boolean };

export async function findRequester(request: Request): Promise<Requester | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await supabase.auth.getUser(token);
  if (!data.user) return null;

  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { id: data.user.id, isAdmin: isAdmin === true };
}

export function canUse(requester: Requester, path: string) {
  return requester.isAdmin || path.startsWith(`${requester.id}/`);
}

export async function readPaths(request: Request) {
  const { paths } = await request.json().catch(() => ({ paths: null }));
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 100) return null;
  if (!paths.every((path) => typeof path === "string" && /^[\w-]+\/cloud-[\w-]+$/.test(path))) return null;
  return paths as string[];
}
