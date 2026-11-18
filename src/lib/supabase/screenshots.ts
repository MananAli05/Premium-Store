import { createId } from "../format";
import { timeoutSignal } from "../timeoutSignal";
import { getActiveClient } from "./sync";

const BUCKET = "screenshots";
const URL_LIFETIME_SECONDS = 60 * 60;
const UPLOAD_ATTEMPTS = 2;
const UPLOAD_WAIT_MS = 30_000;
const signedUrls = new Map<string, { url: string; expiresAt: number }>();
const cloudUrls = new Map<string, Promise<string | null>>();

const isCloudPath = (path: string) => path.includes("/cloud-");

async function authorization() {
  const { data } = await getActiveClient().auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

async function callServer(route: string, body: unknown) {
  const response = await fetch(`/api/screenshots/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: await authorization() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || `Server error ${response.status}`);
  return response.json();
}

async function sendThroughSite(customerId: string, blob: Blob): Promise<string | null> {
  const form = new FormData();
  form.append("customerId", customerId);
  form.append("file", blob);
  const response = await fetch("/api/screenshots/send", {
    method: "POST",
    headers: { Authorization: await authorization() },
    body: form,
    signal: timeoutSignal(UPLOAD_WAIT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error((await response.text()) || `Server error ${response.status}`);
  return (await response.json()).path;
}

async function sendToSupabase(path: string, blob: Blob) {
  const { error } = await getActiveClient().storage.from(BUCKET).upload(path, blob, { contentType: blob.type });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
}

async function withRetries<T>(task: () => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (problem) {
      if (attempt === UPLOAD_ATTEMPTS) throw problem;
      if (problem instanceof Error && /sign in/i.test(problem.message)) await getActiveClient().auth.refreshSession();
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function uploadScreenshot(customerId: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const cloudPath = await withRetries(() => sendThroughSite(customerId, blob)).catch(() => null);
  if (cloudPath) return cloudPath;

  const path = `${customerId}/${createId()}.${extensionFor(blob.type)}`;
  await withRetries(() => sendToSupabase(path, blob));
  return path;
}

function cloudUrl(path: string) {
  if (!cloudUrls.has(path)) {
    const url = callServer("view", { paths: [path] })
      .then(({ urls }) => (urls[path] as string | undefined) ?? null)
      .catch(() => {
        cloudUrls.delete(path);
        return null;
      });
    cloudUrls.set(path, url);
  }
  return cloudUrls.get(path)!;
}

export async function getScreenshotUrl(path: string) {
  if (path.startsWith("data:")) return path;
  if (isCloudPath(path)) return cloudUrl(path);

  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await getActiveClient().storage.from(BUCKET).createSignedUrl(path, URL_LIFETIME_SECONDS);
  if (error || !data) return null;

  signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + (URL_LIFETIME_SECONDS - 5 * 60) * 1000 });
  return data.signedUrl;
}

export async function deleteScreenshots(paths: string[]) {
  const storedPaths = paths.filter((path) => !path.startsWith("data:"));
  const cloudPaths = storedPaths.filter(isCloudPath);
  const oldPaths = storedPaths.filter((path) => !isCloudPath(path));
  if (oldPaths.length) await getActiveClient().storage.from(BUCKET).remove(oldPaths);
  if (cloudPaths.length) await callServer("delete", { paths: cloudPaths });
}
