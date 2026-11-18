import { cloudinaryReady, uploadForm } from "@/lib/server/cloudinary";
import { canUse, findRequester, newCloudPath } from "@/lib/server/requester";

export async function POST(request: Request) {
  if (!cloudinaryReady()) return new Response("Cloudinary is not set up.", { status: 404 });

  const requester = await findRequester(request);
  if (!requester) return new Response("Please sign in again.", { status: 401 });

  const { customerId } = await request.json().catch(() => ({ customerId: "" }));
  const path = newCloudPath(customerId);
  if (!path) return new Response("Unknown customer.", { status: 400 });
  if (!canUse(requester, path)) return new Response("Not allowed.", { status: 403 });

  return Response.json({ path, ...uploadForm(path) });
}
