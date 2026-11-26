-- Order numbers for customers: VRS-1001, VRS-1002, ... (written by hand; used as the
-- default for orders.number). Gaps can appear if a transaction rolls back; that is fine.
CREATE SEQUENCE "order_number_seq" START WITH 1001;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('paid', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded');

-- CreateTable
CREATE TABLE "checkout_drafts" (
    "id" UUID NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "stripe_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL DEFAULT ('VRS-'::text || nextval('order_number_seq'::regclass)),
    "status" "OrderStatus" NOT NULL DEFAULT 'paid',
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "customer_name" TEXT NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal_cents" INTEGER NOT NULL,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "shipping_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL,
    "stripe_session_id" TEXT NOT NULL,
    "stripe_payment_intent_id" TEXT,
    "access_token" TEXT NOT NULL,
    "courier" TEXT,
    "tracking_number" TEXT,
    "confirmation_sent_at" TIMESTAMP(3),
    "admin_alert_sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "in_production_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "title_snapshot" TEXT NOT NULL,
    "image_snapshot" TEXT,
    "size" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "measurements" JSONB,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "production_days" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus",
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_drafts_stripe_session_id_key" ON "checkout_drafts"("stripe_session_id");

-- CreateIndex
CREATE INDEX "checkout_drafts_created_at_idx" ON "checkout_drafts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_session_id_key" ON "orders"("stripe_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_payment_intent_id_key" ON "orders"("stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_access_token_key" ON "orders"("access_token");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_email_idx" ON "orders"("email");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Safety rules (CHECK constraints) ───────────────────────────────────────
-- Written by hand: Prisma can't express these, and Prisma Migrate leaves them in place.

ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_subtotal_positive"
  CHECK ("subtotal_cents" > 0);

ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_usd"
  CHECK ("currency" = 'USD');

ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_not_negative"
  CHECK ("subtotal_cents" >= 0 AND "discount_cents" >= 0 AND "shipping_cents" >= 0 AND "total_cents" >= 0);

ALTER TABLE "orders" ADD CONSTRAINT "orders_total_adds_up"
  CHECK ("total_cents" = "subtotal_cents" - "discount_cents" + "shipping_cents");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_range"
  CHECK ("quantity" BETWEEN 1 AND 10);

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_positive"
  CHECK ("unit_price_cents" > 0);

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_production_days_positive"
  CHECK ("production_days" > 0);
