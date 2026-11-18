import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const deleteBatch = 100;
const siteLinkLifetimeSeconds = 7 * 24 * 60 * 60;

function account() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  };
}

export function cloudinaryReady() {
  const { cloudName, apiKey, apiSecret } = account();
  return Boolean(cloudName && apiKey && apiSecret);
}

function sha1(text: string, encoding: "hex" | "base64url") {
  return createHash("sha1").update(text).digest(encoding);
}

function publicIdOf(path: string) {
  const projectFolder = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "http://local").hostname.split(".")[0];
  return `${projectFolder}/${path}`;
}

export function uploadForm(path: string) {
  const { cloudName, apiKey, apiSecret } = account();
  const publicId = publicIdOf(path);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sha1(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated${apiSecret}`, "hex");
  return {
    url: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    fields: { api_key: apiKey, public_id: publicId, timestamp, type: "authenticated", signature },
  };
}

export async function uploadFile(path: string, file: Blob) {
  const { url, fields } = uploadForm(path);
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.append(name, value));
  form.append("file", file);
  const response = await fetch(url, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Cloudinary upload failed (${response.status})`);
}

export function viewUrl(path: string) {
  const { cloudName, apiSecret } = account();
  const publicId = publicIdOf(path);
  const signature = sha1(publicId + apiSecret, "base64url").slice(0, 8);
  return `https://res.cloudinary.com/${cloudName}/image/authenticated/s--${signature}--/${publicId}`;
}

function linkSignature(path: string, expires: string) {
  return createHmac("sha256", account().apiSecret).update(`${path}:${expires}`).digest("base64url");
}

export function siteLink(origin: string, path: string) {
  const expires = String(Math.floor(Date.now() / 1000) + siteLinkLifetimeSeconds);
  const query = new URLSearchParams({ path, expires, signature: linkSignature(path, expires) });
  return `${origin}/api/screenshots/image?${query}`;
}

export function linkIsValid(path: string, expires: string | null, signature: string | null) {
  if (!expires || !signature || Number(expires) * 1000 < Date.now()) return false;
  const expected = Buffer.from(linkSignature(path, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function deleteFiles(paths: string[]) {
  const { cloudName, apiKey, apiSecret } = account();
  const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
  for (let start = 0; start < paths.length; start += deleteBatch) {
    const body = new URLSearchParams([["invalidate", "true"], ...paths.slice(start, start + deleteBatch).map((path) => ["public_ids[]", publicIdOf(path)])]);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/authenticated`, {
      method: "DELETE",
      headers: { Authorization: authorization },
      body,
    });
    if (!response.ok) throw new Error(`Cloudinary delete failed (${response.status})`);
  }
}
