import { contentTypeForFile } from "@/lib/image-file";
import { readLocalUpload, UPLOAD_CACHE_CONTROL } from "@/lib/storage";

// Serves product photos saved in the local uploads folder (when R2 isn't set up).
// Names are random and never reused, so browsers and Cloudflare may cache them for a year.
export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const segments = (await params).path;
  const file = await readLocalUpload(segments);
  const contentType = contentTypeForFile(segments.at(-1) ?? "");
  if (!file || !contentType) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": UPLOAD_CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
