import { createHash } from "node:crypto";

const deleteBatch = 100;

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

export function viewUrl(path: string) {
  const { cloudName, apiSecret } = account();
  const publicId = publicIdOf(path);
  const signature = sha1(publicId + apiSecret, "base64url").slice(0, 8);
  return `https://res.cloudinary.com/${cloudName}/image/authenticated/s--${signature}--/${publicId}`;
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
