import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

import { seedImages, seedProducts, seedSku } from "./seed-data";

// Fills the database with the sample catalogue. Safe to run again: products are matched by
// slug, sizes by product + size, and photos are replaced.
// Run with: pnpm db:seed

function assertSafeTarget(databaseUrl: string) {
  const host = new URL(databaseUrl).hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      `Refusing to seed sample products into a non-local database (${host}). ` +
        "Set ALLOW_SEED=true only for a staging database, never for the live shop.",
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  assertSafeTarget(databaseUrl);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    for (const [index, item] of seedProducts.entries()) {
      const { sizes, customFitExtraCents, customDays, compareAtCents, ...fields } = item;
      const productData = {
        ...fields,
        compareAtCents: compareAtCents ?? null,
        customFitAvailable: customFitExtraCents !== undefined,
        customFitExtraCents: customFitExtraCents ?? 0,
        customDays: customDays ?? null,
      };

      await db.$transaction(async (tx) => {
        const product = await tx.product.upsert({
          where: { slug: item.slug },
          create: productData,
          update: productData,
        });

        await tx.productImage.deleteMany({ where: { productId: product.id } });
        await tx.productImage.createMany({
          data: seedImages(item).map((image, position) => ({
            ...image,
            position,
            productId: product.id,
          })),
        });

        for (const [position, { size, stock }] of sizes.entries()) {
          const variant = { sku: seedSku(index, size), stock, position };
          await tx.variant.upsert({
            where: { productId_size: { productId: product.id, size } },
            create: { ...variant, size, productId: product.id },
            update: variant,
          });
        }
      });
    }

    const published = seedProducts.filter((p) => p.status === "published").length;
    console.log(
      `Seeded ${seedProducts.length} products (${published} published, ` +
        `${seedProducts.length - published} draft).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
