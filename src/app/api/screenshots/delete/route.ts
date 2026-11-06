import { deleteFiles } from "@/lib/server/cloudinary";
import { findRequester, readPaths } from "@/lib/server/requester";

export async function POST(request: Request) {
  const requester = await findRequester(request);
  if (!requester?.isAdmin) return new Response("Not allowed.", { status: 403 });

  const paths = await readPaths(request);
  if (!paths) return new Response("Unknown screenshots.", { status: 400 });

  try {
    await deleteFiles(paths);
    return Response.json({ deleted: paths.length });
  } catch (problem) {
    return new Response(problem instanceof Error ? problem.message : "Delete failed", { status: 502 });
  }
}
