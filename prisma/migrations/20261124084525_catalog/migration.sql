-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('lehenga', 'saree', 'anarkali', 'sherwani', 'kurta_set');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('women', 'men');

-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('wedding', 'sangeet', 'mehendi', 'reception', 'festive', 'party');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "gender" "Gender" NOT NULL,
    "fabric" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "occasions" "Occasion"[],
    "care" TEXT NOT NULL,
    "hs_code" TEXT,
    "price_cents" INTEGER NOT NULL,
    "compare_at_cents" INTEGER,
    "custom_fit_available" BOOLEAN NOT NULL DEFAULT false,
    "custom_fit_extra_cents" INTEGER NOT NULL DEFAULT 0,
    "ready_days" INTEGER NOT NULL,
    "custom_days" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "size" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stock" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_category_idx" ON "products"("status", "category");

-- CreateIndex
CREATE INDEX "products_status_created_at_idx" ON "products"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "variants_sku_key" ON "variants"("sku");

-- CreateIndex
CREATE INDEX "variants_product_id_position_idx" ON "variants"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "variants_product_id_size_key" ON "variants"("product_id", "size");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Safety rules (CHECK constraints) ───────────────────────────────────────
-- Written by hand: Prisma can't express these, and Prisma Migrate leaves them in place.
-- Money is integer cents; these stop impossible prices and stock from ever being saved.

ALTER TABLE "products" ADD CONSTRAINT "products_price_cents_positive"
  CHECK ("price_cents" > 0);

ALTER TABLE "products" ADD CONSTRAINT "products_compare_at_above_price"
  CHECK ("compare_at_cents" IS NULL OR "compare_at_cents" > "price_cents");

ALTER TABLE "products" ADD CONSTRAINT "products_custom_fit_extra_not_negative"
  CHECK ("custom_fit_extra_cents" >= 0);

ALTER TABLE "products" ADD CONSTRAINT "products_ready_days_positive"
  CHECK ("ready_days" > 0);

ALTER TABLE "products" ADD CONSTRAINT "products_custom_days_when_custom_fit"
  CHECK (NOT "custom_fit_available" OR ("custom_days" IS NOT NULL AND "custom_days" > 0));

ALTER TABLE "products" ADD CONSTRAINT "products_slug_format"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_alt_not_blank"
  CHECK (length(btrim("alt")) > 0);

ALTER TABLE "variants" ADD CONSTRAINT "variants_stock_not_negative"
  CHECK ("stock" IS NULL OR "stock" >= 0);
