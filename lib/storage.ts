import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AwsClient } from "aws4fetch";

import { detectImageKind, MAX_IMAGE_BYTES } from "@/lib/image-file";

// Where product photos are kept.
//  - Cloudflare R2 when the R2_* keys and IMAGES_BASE_URL are set (staging and live): photos
//    are served from the images domain, e.g. https://images.example.com/products/…
//  - Otherwise a local folder (UPLOADS_DIR, default ./uploads), served by app/uploads at
//    /uploads/products/… (local development, CI, or a server before R2 exists).

export class ImageUploadError extends Error {
  constructor(readonly reason: "too_large" | "not_an_image" | "empty") {
    super(`Image upload rejected: ${reason}`);
    this.name = "ImageUploadError";
  }
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

function r2Config(): R2Config | null {
  const values = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicBaseUrl: process.env.IMAGES_BASE_URL?.replace(/\/+$/, ""),
  };
  const set = Object.values(values).filter(Boolean).length;
  if (set === 0 || (set === 1 && values.publicBaseUrl)) return null;
  if (set < 5) {
    throw new Error(
      "R2 is half set up: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and IMAGES_BASE_URL together.",
    );
  }
  return values as R2Config;
}

/** The local folder for uploads (when R2 isn't set up). */
export function uploadsDir(): string {
  return path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));
}

/** Where saved photos are kept right now, for the admin to see. */
export function storageMode(): "r2" | "local" {
  return r2Config() ? "r2" : "local";
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * Checks a photo and saves it under a new random name. Returns the URL to store in
 * product_images.url. Throws ImageUploadError for files we don't accept.
 */
export async function saveProductPhoto(bytes: Uint8Array): Promise<{ url: string }> {
  if (bytes.length === 0) throw new ImageUploadError("empty");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageUploadError("too_large");
  const kind = detectImageKind(bytes);
  if (!kind) throw new ImageUploadError("not_an_image");

  const key = `products/${randomUUID()}.${kind.extension}`;
  const r2 = r2Config();
  if (r2) {
    const client = new AwsClient({
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      service: "s3",
      region: "auto",
    });
    const response = await client.fetch(
      `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucket}/${key}`,
      {
        method: "PUT",
        body: new Uint8Array(bytes),
        headers: { "Content-Type": kind.contentType, "Cache-Control": IMMUTABLE },
      },
    );
    if (!response.ok) {
      throw new Error(`R2 upload failed (${response.status}): ${await response.text()}`);
    }
    return { url: `${r2.publicBaseUrl}/${key}` };
  }

  const file = path.join(uploadsDir(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return { url: `/uploads/${key}` };
}

/** A locally saved photo by its path under /uploads, or null. Rejects anything but our names. */
export async function readLocalUpload(segments: string[]): Promise<Buffer | null> {
  const [folder, name, ...rest] = segments;
  if (folder !== "products" || !name || rest.length > 0) return null;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(name)) return null;
  try {
    return await readFile(path.join(uploadsDir(), folder, name));
  } catch {
    return null;
  }
}

export { IMMUTABLE as UPLOAD_CACHE_CONTROL };
