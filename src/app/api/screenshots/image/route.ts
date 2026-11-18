import { linkIsValid, viewUrl } from "@/lib/server/cloudinary";
import { isCloudPath } from "@/lib/server/requester";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const path = query.get("path");
  if (!isCloudPath(path) || !linkIsValid(path, query.get("expires"), query.get("signature"))) {
    return new Response("This link has expired.", { status: 403 });
  }

  const picture = await fetch(viewUrl(path));
  if (!picture.ok) return new Response("Picture not found.", { status: 404 });

  return new Response(picture.body, {
    headers: {
      "Content-Type": picture.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
