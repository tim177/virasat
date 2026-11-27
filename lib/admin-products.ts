import "server-only";

import { randomBytes } from "node:crypto";

import type { ProductFormInitial } from "@/components/admin/product-form";
import { writeAdminLog, type AdminActor } from "@/lib/admin-log";
import type { ProductFormInput } from "@/lib/admin-products-input";
import { getDb } from "@/lib/db";
import { Prisma, type ProductStatus } from "@/lib/generated/prisma/client";
import { centsToDecimalString } from "@/lib/money";

// Products in the admin: list, load and save. Callers check requireAdmin() first.

export class ProductSaveError extends Error {
  constructor(
    readonly field: "slug" | "sizes" | "photos" | "form",
    readonly reason: string,
  ) {
    super(reason);
    this.name = "ProductSaveError";
  }
}

export async function listAdminProducts(params: { status?: ProductStatus; q?: string }) {
  const db = getDb();
  const search: Prisma.ProductWhereInput = params.q
    ? { title: { contains: params.q, mode: "insensitive" } }
    : {};
  const [products, byStatus] = await Promise.all([
    db.product.findMany({
      where: { ...search, ...(params.status ? { status: params.status } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        status: true,
        priceCents: true,
        customFitAvailable: true,
        updatedAt: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: { select: { stock: true } },
      },
    }),
    db.product.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(
    byStatus.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<ProductStatus, number>>;
  return {
    products: products.map((product) => {
      const madeToOrder = product.variants.some((v) => v.stock === null);
      const inStock = product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        category: product.category,
        status: product.status,
        priceCents: product.priceCents,
        updatedAt: product.updatedAt,
        imageUrl: product.images[0]?.url ?? null,
        stock:
          madeToOrder || (product.variants.length === 0 && product.customFitAvailable)
            ? ("made_to_order" as const)
            : inStock,
      };
    }),
    counts,
    countAll: Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0),
  };
}

/** A product with its sizes and photos, for the edit form. */
export async function getAdminProduct(id: string) {
  return getDb().product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: [{ position: "asc" }, { size: "asc" }] },
      images: { orderBy: { position: "asc" } },
    },
  });
}

export type AdminProduct = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;

/** What admin_log keeps of a product: every field the form can change. */
function snapshot(product: AdminProduct) {
  return {
    slug: product.slug,
    title: product.title,
    description: product.description,
    category: product.category,
    gender: product.gender,
    fabric: product.fabric,
    work: product.work,
    colour: product.colour,
    occasions: product.occasions,
    care: product.care,
    hsCode: product.hsCode,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    customFitAvailable: product.customFitAvailable,
    customFitExtraCents: product.customFitExtraCents,
    readyDays: product.readyDays,
    customDays: product.customDays,
    status: product.status,
    sizes: product.variants.map((v) => ({ size: v.size, sku: v.sku, stock: v.stock })),
    photos: product.images.map((image) => ({ url: image.url, alt: image.alt })),
  };
}

function newSku(): string {
  return `VRS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Photos must be our own: sample artwork, local uploads, or the images domain (R2). */
function assertOwnPhotos(input: ProductFormInput) {
  const imagesBase = process.env.IMAGES_BASE_URL?.replace(/\/+$/, "");
  for (const photo of input.photos) {
    const local = photo.url.startsWith("/seed/") || photo.url.startsWith("/uploads/");
    const remote = imagesBase && photo.url.startsWith(`${imagesBase}/`);
    if (!local && !remote) throw new ProductSaveError("photos", "foreign_photo");
  }
}

/**
 * Creates or updates a product with its sizes and photos, in one transaction with its
 * admin_log entry (before and after). Sizes that already exist keep their id, so stock and
 * order history stay linked; removed sizes are deleted.
 */
export async function saveProduct(
  input: ProductFormInput,
  admin: AdminActor,
): Promise<{ id: string; slug: string; created: boolean }> {
  assertOwnPhotos(input);
  const data = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    category: input.category,
    gender: input.gender,
    fabric: input.fabric,
    work: input.work,
    colour: input.colour,
    occasions: input.occasions,
    care: input.care,
    hsCode: input.hsCode ?? null,
    priceCents: input.price,
    compareAtCents: input.compareAt,
    customFitAvailable: input.customFitAvailable,
    customFitExtraCents: input.customFitAvailable ? (input.customFitExtra ?? 0) : 0,
    readyDays: input.readyDays,
    customDays: input.customFitAvailable ? (input.customDays ?? null) : null,
    status: input.status,
  };

  try {
    return await getDb().$transaction(async (tx) => {
      const load = (id: string) =>
        tx.product.findUnique({
          where: { id },
          include: {
            variants: { orderBy: [{ position: "asc" }, { size: "asc" }] },
            images: { orderBy: { position: "asc" } },
          },
        });

      const before = input.id ? await load(input.id) : null;
      if (input.id && !before) throw new ProductSaveError("form", "not_found");

      const product = before
        ? await tx.product.update({ where: { id: before.id }, data })
        : await tx.product.create({ data });

      // Sizes: delete removed ones first (frees their names), then update, then add.
      const keepIds = new Set(input.sizes.flatMap((row) => (row.id ? [row.id] : [])));
      const existing = new Map((before?.variants ?? []).map((v) => [v.id, v]));
      for (const id of keepIds) {
        if (!existing.has(id)) throw new ProductSaveError("sizes", "unknown_size");
      }
      await tx.variant.deleteMany({
        where: { productId: product.id, id: { notIn: [...keepIds] } },
      });
      for (const [position, row] of input.sizes.entries()) {
        const fields = { size: row.size, stock: row.stock, position };
        if (row.id) {
          await tx.variant.update({
            where: { id: row.id },
            data: { ...fields, sku: row.sku ?? existing.get(row.id)!.sku },
          });
        } else {
          await tx.variant.create({
            data: { ...fields, productId: product.id, sku: row.sku ?? newSku() },
          });
        }
      }

      // Photos: replaced as a list, in the order shown in the form.
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      if (input.photos.length > 0) {
        await tx.productImage.createMany({
          data: input.photos.map((photo, position) => ({
            productId: product.id,
            url: photo.url,
            alt: photo.alt,
            position,
          })),
        });
      }

      const after = (await load(product.id))!;
      await writeAdminLog(tx, admin, {
        action: before ? "product.update" : "product.create",
        entity: "product",
        entityId: product.id,
        before: before ? snapshot(before) : null,
        after: snapshot(after),
      });
      return { id: product.id, slug: product.slug, created: !before };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = JSON.stringify(error.meta ?? {});
      if (target.includes("slug")) throw new ProductSaveError("slug", "slug_taken");
      if (target.includes("sku")) throw new ProductSaveError("sizes", "sku_taken");
      throw new ProductSaveError("sizes", "duplicate_size");
    }
    throw error;
  }
}

/** The form's starting values: an existing product, or sensible defaults for a new one. */
export function productFormInitial(product: AdminProduct | null): ProductFormInitial {
  if (!product) {
    return {
      title: "",
      slug: "",
      description: "",
      category: "",
      gender: "women",
      fabric: "",
      work: "",
      colour: "",
      occasions: [],
      care: "",
      hsCode: "",
      price: "",
      compareAt: "",
      readyDays: "7",
      customFitAvailable: false,
      customFitExtra: "",
      customDays: "",
      status: "draft",
      sizes: [],
      photos: [],
    };
  }
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    category: product.category,
    gender: product.gender,
    fabric: product.fabric,
    work: product.work,
    colour: product.colour,
    occasions: product.occasions,
    care: product.care,
    hsCode: product.hsCode ?? "",
    price: centsToDecimalString(product.priceCents),
    compareAt: product.compareAtCents === null ? "" : centsToDecimalString(product.compareAtCents),
    readyDays: String(product.readyDays),
    customFitAvailable: product.customFitAvailable,
    customFitExtra: product.customFitAvailable
      ? centsToDecimalString(product.customFitExtraCents)
      : "",
    customDays: product.customDays === null ? "" : String(product.customDays),
    status: product.status,
    sizes: product.variants.map((v) => ({
      id: v.id,
      size: v.size,
      sku: v.sku,
      stock: v.stock === null ? "" : String(v.stock),
    })),
    photos: product.images.map((image) => ({ url: image.url, alt: image.alt })),
  };
}
