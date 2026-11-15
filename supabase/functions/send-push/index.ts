import { createClient } from "jsr:@supabase/supabase-js@2";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type AdminNotification = { kind: string; title: string; body: string; customer_id: string };

const tabs: Record<string, string> = { payment: "pending", payment_issue: "pending", support: "issues", blocked: "blocked" };
const goneCodes = ["UNREGISTERED", "SENDER_ID_MISMATCH"];

const account: ServiceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");

function adminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  return keys.default ?? Object.values(keys)[0];
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, adminKey());

let googleToken: { value: string; expiresAt: number } | null = null;

function base64url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function accessToken() {
  if (googleToken && googleToken.expiresAt > Date.now() + 60_000) return googleToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const pem = account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (char) => char.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${base64url(signature)}` }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description ?? "Google did not give an access token");

  googleToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return googleToken.value;
}

type Target = { orderId: string } | { ticketId: string } | null;

async function send(device: string, notification: AdminNotification, target: Target, bearer: string) {
  const message = {
    token: device,
    notification: { title: notification.title, body: notification.body },
    data: { section: "inbox", tab: tabs[notification.kind] ?? "pending", customerId: notification.customer_id, ...target },
    android: { priority: "high", notification: { channel_id: "admin_alerts", sound: "default" } },
  };

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (response.ok) return true;

  const error = await response.json().catch(() => null);
  const code = error?.error?.details?.find((detail: { errorCode?: string }) => detail.errorCode)?.errorCode ?? error?.error?.status;
  if (goneCodes.includes(code)) await supabase.from("admin_devices").delete().eq("token", device);
  return false;
}

async function latestId(table: "orders" | "tickets", customerId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const query = table === "orders"
      ? supabase.from("orders").select("id").eq("customer_id", customerId).eq("status", "pending_review").order("submitted_at", { ascending: false })
      : supabase.from("tickets").select("id").eq("customer_id", customerId).eq("kind", "support").eq("status", "open").order("created_at", { ascending: false });
    const { data } = await query.limit(1).maybeSingle();
    if (data?.id) return data.id as string;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

async function targetFor(notification: AdminNotification): Promise<Target> {
  if (notification.kind === "payment") {
    const orderId = await latestId("orders", notification.customer_id);
    return orderId ? { orderId } : null;
  }
  if (notification.kind === "support") {
    const ticketId = await latestId("tickets", notification.customer_id);
    return ticketId ? { ticketId } : null;
  }
  return null;
}

Deno.serve(async (request) => {
  const payload = await request.json().catch(() => null);
  const notification: AdminNotification | undefined = payload?.record;
  if (payload?.type !== "INSERT" || !notification) return Response.json({ sent: 0, reason: "not a new notification" });

  const { data: devices, error } = await supabase.from("admin_devices").select("token");
  if (error) return Response.json({ sent: 0, reason: error.message }, { status: 500 });
  if (!devices?.length) return Response.json({ sent: 0, reason: "no admin phones" });

  const target = await targetFor(notification);
  const bearer = await accessToken();
  const results = await Promise.all(devices.map(({ token }) => send(token, notification, target, bearer)));
  return Response.json({ sent: results.filter(Boolean).length, of: devices.length });
});
