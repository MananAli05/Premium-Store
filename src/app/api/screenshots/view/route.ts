import { viewUrl } from "@/lib/server/cloudinary";
import { canUse, findRequester, readPaths } from "@/lib/server/requester";

export async function POST(request: Request) {
  const requester = await findRequester(request);
  if (!requester) return new Response("Please sign in again.", { status: 401 });

  const paths = await readPaths(request);
  if (!paths) return new Response("Unknown screenshots.", { status: 400 });

  const urls = Object.fromEntries(paths.filter((path) => canUse(requester, path)).map((path) => [path, viewUrl(path)]));
  return Response.json({ urls });
}
