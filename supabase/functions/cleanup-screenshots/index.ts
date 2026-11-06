import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "screenshots";
const KEEP_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const BATCH = 100;

type Row = Record<string, unknown>;

function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  return keys.default ?? Object.values(keys)[0];
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const db = createClient(supabaseUrl, adminKey());

const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME") ?? "";
const cloudAuth = `Basic ${btoa(`${Deno.env.get("CLOUDINARY_API_KEY")}:${Deno.env.get("CLOUDINARY_API_SECRET")}`)}`;
const projectFolder = new URL(supabaseUrl).hostname.split(".")[0];

function storedPath(value: unknown) {
  return typeof value === "string" && value !== "" && !value.startsWith("data:") ? value : null;
}

async function select(table: string, columns: string, filter: (query: any) => any) {
  const { data, error } = await filter(db.from(table).select(columns));
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

const isCloudPath = (path: string) => path.includes("/cloud-");

async function removeCloudFiles(paths: string[]) {
  const body = new URLSearchParams([["invalidate", "true"], ...paths.map((path) => ["public_ids[]", `${projectFolder}/${path}`])]);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/authenticated`, {
    method: "DELETE",
    headers: { Authorization: cloudAuth },
    body,
  });
  if (!response.ok) throw new Error(`cloudinary: ${response.status} ${await response.text()}`);
}

async function removeFiles(paths: string[]) {
  for (let start = 0; start < paths.length; start += BATCH) {
    const batch = paths.slice(start, start + BATCH);
    const oldFiles = batch.filter((path) => !isCloudPath(path));
    const cloudFiles = batch.filter(isCloudPath);
    if (oldFiles.length) {
      const { error } = await db.storage.from(BUCKET).remove(oldFiles);
      if (error) throw new Error(`storage: ${error.message}`);
    }
    if (cloudFiles.length) await removeCloudFiles(cloudFiles);
  }
}

async function clearColumn(table: string, column: string, ids: string[]) {
  for (let start = 0; start < ids.length; start += BATCH) {
    const { error } = await db.from(table).update({ [column]: null }).in("id", ids.slice(start, start + BATCH));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

Deno.serve(async () => {
  try {
    const cutoff = Date.now() - KEEP_DAYS * DAY;

    // Pending and rejected orders keep their proof until the admin decides.
    const orders = await select("orders", "id, screenshot", (query) =>
      query.not("screenshot", "is", null).lt("submitted_at", cutoff).not("status", "in", "(pending_review,rejected)")
    );
    const messages = await select("messages", "id, image", (query) => query.not("image", "is", null).lt("created_at", cutoff));
    const tickets = await select("tickets", "id, screenshot", (query) => query.not("screenshot", "is", null).lt("created_at", cutoff));

    const paths = [
      ...orders.map((row) => storedPath(row.screenshot)),
      ...messages.map((row) => storedPath(row.image)),
      ...tickets.map((row) => storedPath(row.screenshot)),
    ].filter((path): path is string => path !== null);

    await removeFiles([...new Set(paths)]);
    await clearColumn("orders", "screenshot", orders.map((row) => String(row.id)));
    await clearColumn("messages", "image", messages.map((row) => String(row.id)));
    await clearColumn("tickets", "screenshot", tickets.map((row) => String(row.id)));

    return Response.json({ deletedFiles: new Set(paths).size, orders: orders.length, messages: messages.length, tickets: tickets.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
