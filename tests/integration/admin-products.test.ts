import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { AdminActor } from "@/lib/admin-log";
import { productFormSchema, type ProductFormInput } from "@/lib/admin-products-input";
import {
  getAdminProduct,
  listAdminProducts,
  ProductSaveError,
  productFormInitial,
  saveProduct,
} from "@/lib/admin-products";
import { getDb } from "@/lib/db";
import { ImageUploadError, readLocalUpload, saveProductPhoto } from "@/lib/storage";

// The admin product editor against the real database: create, update, sizes, photos and
// admin_log. Every product, log row and user made here is deleted afterwards.

const db = getDb();
const SLUG_PREFIX = "it-prod-";
const DOMAIN = "@it-products.example.com";
let admin: AdminActor;

beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `admin-${randomUUID().slice(0, 8)}${DOMAIN}`,
      name: "Product Admin",
      role: "admin",
    },
  });
  admin = { adminId: user.id, ip: "203.0.113.9" };
});

afterEach(async () => {
  await db.adminLog.deleteMany({ where: { adminUserId: admin.adminId } });
  await db.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await db.$disconnect();
});

function input(overrides: Record<string, unknown> = {}): ProductFormInput {
  return productFormSchema.parse({
    title: "Test silk saree",
    slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
    description: "A test silk saree with a woven border, for integration tests only.",
    category: "saree",
    gender: "women",
    fabric: "Silk",
    work: "Zari weave",
    colour: "Red",
    occasions: ["wedding"],
    care: "Dry clean only.",
    hsCode: "6204.44",
    price: "349.00",
    compareAt: "",
    readyDays: "5",
    customFitExtra: "",
    customDays: "",
    status: "published",
    sizes: JSON.stringify([
      { size: "S", sku: "", stock: 3 },
      { size: "M", sku: "", stock: null },
    ]),
    photos: JSON.stringify([
      { url: "/seed/ruby-banarasi-silk-saree-1.webp", alt: "Model wearing the saree" },
      { url: "/seed/ruby-banarasi-silk-saree-2.webp", alt: "Close-up of the border" },
    ]),
    ...overrides,
  });
}

describe("saving products", () => {
  it("creates a product with sizes, photos and an admin_log entry", async () => {
    const saved = await saveProduct(input(), admin);
    expect(saved.created).toBe(true);

    const product = (await getAdminProduct(saved.id))!;
    expect(product).toMatchObject({ priceCents: 34900, status: "published", hsCode: "6204.44" });
    expect(product.variants.map((v) => [v.size, v.stock, v.position])).toEqual([
      ["S", 3, 0],
      ["M", null, 1],
    ]);
    expect(product.variants.every((v) => /^VRS-[0-9A-F]{8}$/.test(v.sku))).toBe(true);
    expect(product.images.map((i) => i.alt)).toEqual([
      "Model wearing the saree",
      "Close-up of the border",
    ]);

    const log = await db.adminLog.findFirstOrThrow({ where: { entityId: saved.id } });
    expect(log).toMatchObject({ action: "product.create", entity: "product", ip: "203.0.113.9" });
    expect(log.before).toBeNull();
    expect(log.after).toMatchObject({
      priceCents: 34900,
      sizes: [{ size: "S", stock: 3 }, { size: "M" }],
    });

    // The edit form starts from what was saved.
    expect(productFormInitial(product)).toMatchObject({ price: "349.00", readyDays: "5" });
  });

  it("updates in place: sizes keep their ids, removed sizes go, photos follow the new order", async () => {
    const saved = await saveProduct(input(), admin);
    const before = (await getAdminProduct(saved.id))!;
    const [small] = before.variants;

    await saveProduct(
      input({
        id: saved.id,
        slug: saved.slug,
        price: "299",
        status: "draft",
        sizes: JSON.stringify([
          { id: small.id, size: "S", sku: small.sku, stock: 0 },
          { size: "L", sku: "it-l-001", stock: 2 },
        ]),
        photos: JSON.stringify([
          { url: "/seed/ruby-banarasi-silk-saree-2.webp", alt: "Close-up of the border" },
          { url: "/seed/ruby-banarasi-silk-saree-1.webp", alt: "Model wearing the saree" },
        ]),
      }),
      admin,
    );

    const after = (await getAdminProduct(saved.id))!;
    expect(after).toMatchObject({ priceCents: 29900, status: "draft" });
    expect(after.variants.map((v) => [v.size, v.stock, v.sku])).toEqual([
      ["S", 0, small.sku],
      ["L", 2, "IT-L-001"],
    ]);
    expect(after.variants[0].id).toBe(small.id);
    expect(after.images.map((i) => i.url)).toEqual([
      "/seed/ruby-banarasi-silk-saree-2.webp",
      "/seed/ruby-banarasi-silk-saree-1.webp",
    ]);

    const logs = await db.adminLog.findMany({
      where: { entityId: saved.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual(["product.create", "product.update"]);
    expect(logs[1].before).toMatchObject({ priceCents: 34900, status: "published" });
    expect(logs[1].after).toMatchObject({ priceCents: 29900, status: "draft" });
  });

  it("refuses a web address that's taken, sizes of other products, and photos from elsewhere", async () => {
    const first = await saveProduct(input(), admin);
    await expect(saveProduct(input({ slug: first.slug }), admin)).rejects.toMatchObject({
      reason: "slug_taken",
    });

    const otherProductSize = await db.variant.findFirstOrThrow({
      where: { productId: { not: first.id } },
    });
    await expect(
      saveProduct(
        input({
          id: first.id,
          slug: first.slug,
          sizes: JSON.stringify([{ id: otherProductSize.id, size: "S", stock: 1 }]),
        }),
        admin,
      ),
    ).rejects.toMatchObject({ reason: "unknown_size" });

    await expect(
      saveProduct(
        input({ photos: JSON.stringify([{ url: "https://evil.example/x.jpg", alt: "Photo" }]) }),
        admin,
      ),
    ).rejects.toThrow(ProductSaveError);

    // Nothing half-saved: still one product with its original sizes.
    const product = (await getAdminProduct(first.id))!;
    expect(product.variants.map((v) => v.size)).toEqual(["S", "M"]);
    expect(await db.adminLog.count({ where: { adminUserId: admin.adminId } })).toBe(1);
  });

  it("lists products with stock and counts per status", async () => {
    const saved = await saveProduct(input({ title: "Zz integration lehenga" }), admin);
    const list = await listAdminProducts({ q: "Zz integration" });
    expect(list.products).toHaveLength(1);
    expect(list.products[0]).toMatchObject({
      id: saved.id,
      stock: "made_to_order",
      imageUrl: "/seed/ruby-banarasi-silk-saree-1.webp",
    });
    expect(list.counts).toEqual({ published: 1 });
  });
});

describe("photo storage (local folder)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "virasat-uploads-"));
    vi.stubEnv("UPLOADS_DIR", dir);
    for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
      vi.stubEnv(key, "");
    }
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  const webp = new Uint8Array([...Buffer.from("RIFF\0\0\0\0WEBPVP8 "), ...new Uint8Array(64)]);

  it("saves a photo under a new random name and serves it back", async () => {
    const { url } = await saveProductPhoto(webp);
    expect(url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.webp$/);
    const segments = url.replace("/uploads/", "").split("/");
    expect(await readLocalUpload(segments)).toEqual(Buffer.from(webp));
    expect(await readdir(path.join(dir, "products"))).toHaveLength(1);
  });

  it("refuses files that aren't photos, are empty or too large", async () => {
    await expect(
      saveProductPhoto(new TextEncoder().encode("<svg onload=alert(1)>")),
    ).rejects.toThrow(ImageUploadError);
    await expect(saveProductPhoto(new Uint8Array())).rejects.toMatchObject({ reason: "empty" });
    const big = new Uint8Array(8 * 1024 * 1024 + 1);
    big.set(webp);
    await expect(saveProductPhoto(big)).rejects.toMatchObject({ reason: "too_large" });
  });

  it("only serves our own file names", async () => {
    expect(await readLocalUpload(["products", "../../.env"])).toBeNull();
    expect(await readLocalUpload(["..", "secret.webp"])).toBeNull();
    expect(await readLocalUpload(["products", "a", "b.webp"])).toBeNull();
    expect(await readLocalUpload(["products", `${randomUUID()}.webp`])).toBeNull();
  });
});
