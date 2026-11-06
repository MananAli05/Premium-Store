import { randomUUID } from "node:crypto";
import { uploadForm } from "@/lib/server/cloudinary";
import { canUse, findRequester } from "@/lib/server/requester";

export async function POST(request: Request) {
  const requester = await findRequester(request);
  if (!requester) return new Response("Please sign in again.", { status: 401 });

  const { customerId } = await request.json().catch(() => ({ customerId: "" }));
  if (typeof customerId !== "string" || !/^[\w-]+$/.test(customerId)) return new Response("Unknown customer.", { status: 400 });

  const path = `${customerId}/cloud-${randomUUID()}`;
  if (!canUse(requester, path)) return new Response("Not allowed.", { status: 403 });

  return Response.json({ path, ...uploadForm(path) });
}
