import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getNewestProducts } from "@/lib/products";
import { seedProducts } from "@/prisma/seed-data";

// Needs the local database migrated and seeded: pnpm db:up && pnpm db:deploy && pnpm db:seed

const db = getDb();

afterAll(async () => {
  await db.$disconnect();
});

describe("seeded catalogue", () => {
  it("contains every seed product with photos and sizes", async () => {
    const products = await db.product.findMany({
      where: { slug: { in: seedProducts.map((p) => p.slug) } },
      include: { images: true, variants: true },
    });

    expect(products).toHaveLength(seedProducts.length);
    for (const product of products) {
      expect(product.images.length, product.slug).toBeGreaterThan(0);
      expect(product.variants.length, product.slug).toBeGreaterThan(0);
      expect(Number.isSafeInteger(product.priceCents), product.slug).toBe(true);
      for (const image of product.images) {
        expect(image.url, product.slug).toMatch(/^\/seed\/.+\.webp$/);
        expect(image.alt.trim().length, product.slug).toBeGreaterThan(0);
      }
    }
  });

  it("keeps drafts out of the shop", async () => {
    const newest = await getNewestProducts(50);
    const drafts = seedProducts.filter((p) => p.status === "draft").map((p) => `/p/${p.slug}`);
    expect(drafts.length).toBeGreaterThan(0);
    expect(newest.map((p) => p.href)).not.toEqual(expect.arrayContaining(drafts));
  });

  it("marks custom-fit products with a badge", async () => {
    const newest = await getNewestProducts(50);
    const customFit = newest.find((p) => p.href === "/p/rose-silk-kurta-set");
    const standardOnly = newest.find((p) => p.href === "/p/sage-linen-kurta-set");
    expect(customFit?.badge).toBe("Custom fit available");
    expect(standardOnly?.badge).toBeUndefined();
  });

  it("maps each product's first photo for the product card", async () => {
    const [first] = await getNewestProducts(1);
    expect(first.image?.src).toMatch(/^\/seed\/.+-1\.webp$/);
    expect(first.image?.alt).toMatch(/front view$/);
  });
});

// Each case tries to save bad data inside a transaction that always rolls back, so a test can
// never leave rows behind. The database itself must reject the write (CHECK constraints).
describe("database safety rules", () => {
  class Rollback extends Error {}

  const validProduct = (): Prisma.ProductCreateInput => ({
    slug: `test-${randomUUID()}`,
    title: "Test product",
    description: "Test",
    category: "lehenga",
    gender: "women",
    fabric: "Silk",
    work: "Zardozi",
    colour: "Red",
    occasions: ["wedding"],
    care: "Dry clean",
    priceCents: 10000,
    readyDays: 3,
  });

  async function attempt(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    await db.$transaction(async (tx) => {
      await write(tx);
      throw new Rollback("write was accepted");
    });
  }

  it("accepts a valid product (sanity check)", async () => {
    await expect(attempt((tx) => tx.product.create({ data: validProduct() }))).rejects.toThrow(
      Rollback,
    );
  });

  it.each([
    ["zero price", { priceCents: 0 }, "products_price_cents_positive"],
    ["negative price", { priceCents: -500 }, "products_price_cents_positive"],
    ["sale price not below original", { compareAtCents: 10000 }, "products_compare_at_above_price"],
    [
      "negative custom-fit extra",
      { customFitExtraCents: -1 },
      "products_custom_fit_extra_not_negative",
    ],
    ["zero ready days", { readyDays: 0 }, "products_ready_days_positive"],
    [
      "custom fit without custom days",
      { customFitAvailable: true },
      "products_custom_days_when_custom_fit",
    ],
    ["slug with spaces", { slug: "Bad Slug" }, "products_slug_format"],
  ] as const)("rejects %s", async (_name, override, constraint) => {
    await expect(
      attempt((tx) => tx.product.create({ data: { ...validProduct(), ...override } })),
    ).rejects.toThrow(constraint);
  });

  it("rejects negative stock", async () => {
    await expect(
      attempt(async (tx) => {
        const product = await tx.product.create({ data: validProduct() });
        await tx.variant.create({
          data: { productId: product.id, size: "M", sku: `TEST-${randomUUID()}`, stock: -1 },
        });
      }),
    ).rejects.toThrow("variants_stock_not_negative");
  });

  it("rejects a photo without alt text", async () => {
    await expect(
      attempt(async (tx) => {
        const product = await tx.product.create({ data: validProduct() });
        await tx.productImage.create({
          data: { productId: product.id, url: "/seed/x.webp", alt: "   " },
        });
      }),
    ).rejects.toThrow("product_images_alt_not_blank");
  });
});
