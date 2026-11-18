import { cloudinaryReady, uploadFile } from "@/lib/server/cloudinary";
import { canUse, findRequester, newCloudPath } from "@/lib/server/requester";

const maxFileSize = 2 * 1024 * 1024;
const pictureTypes = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  if (!cloudinaryReady()) return new Response("Cloudinary is not set up.", { status: 404 });

  const requester = await findRequester(request);
  if (!requester) return new Response("Please sign in again.", { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const path = newCloudPath(form?.get("customerId"));
  if (!path) return new Response("Unknown customer.", { status: 400 });
  if (!canUse(requester, path)) return new Response("Not allowed.", { status: 403 });
  if (!(file instanceof Blob) || !pictureTypes.includes(file.type) || file.size > maxFileSize) {
    return new Response("Please send a picture under 2 MB.", { status: 400 });
  }

  try {
    await uploadFile(path, file);
  } catch (problem) {
    return new Response(problem instanceof Error ? problem.message : "Upload failed.", { status: 502 });
  }
  return Response.json({ path });
}
