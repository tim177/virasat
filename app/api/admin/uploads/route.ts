import { getAdmin } from "@/lib/admin-auth";
import { MAX_IMAGE_BYTES } from "@/lib/image-file";
import { siteUrl } from "@/lib/site-url";
import { ImageUploadError, saveProductPhoto } from "@/lib/storage";

// Product photo upload from the admin product form. Admins only (checked on every request),
// same-site only, and the file must really be a JPEG, PNG, WebP or AVIF of at most 8 MB.
// The photo is saved under a random name; it joins a product when the admin saves the form.
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(siteUrl).origin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  try {
    const saved = await saveProductPhoto(new Uint8Array(await file.arrayBuffer()));
    return Response.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return Response.json({ error: error.reason }, { status: 400 });
    }
    console.error("[admin] photo upload failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
