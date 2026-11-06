import { getActiveClient } from "./sync";

const BUCKET = "screenshots";
const URL_LIFETIME_SECONDS = 60 * 60;
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_WAIT_MS = 30_000;
const signedUrls = new Map<string, { url: string; expiresAt: number }>();
const cloudUrls = new Map<string, Promise<string | null>>();

type UploadForm = { path: string; url: string; fields: Record<string, string> };

const isCloudPath = (path: string) => path.includes("/cloud-");

async function callServer(route: string, body: unknown) {
  const { data } = await getActiveClient().auth.getSession();
  const response = await fetch(`/api/screenshots/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || `Server error ${response.status}`);
  return response.json();
}

async function sendToCloudinary({ url, fields }: UploadForm, blob: Blob) {
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.append(name, value));
  form.append("file", blob);
  const response = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(UPLOAD_WAIT_MS) });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
}

export async function uploadScreenshot(customerId: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  let upload: UploadForm | undefined;

  for (let attempt = 1; ; attempt++) {
    try {
      upload ??= (await callServer("upload", { customerId })) as UploadForm;
      await sendToCloudinary(upload, blob);
      return upload.path;
    } catch (problem) {
      if (attempt === UPLOAD_ATTEMPTS) throw problem;
      if (problem instanceof Error && /sign in/i.test(problem.message)) await getActiveClient().auth.refreshSession();
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
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

  // Refresh a few minutes early so an open page never shows an expired link.
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
