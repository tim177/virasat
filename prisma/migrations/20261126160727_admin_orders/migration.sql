-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "status_email_sent_for" "OrderStatus";

-- CreateTable
CREATE TABLE "admin_log" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_log_created_at_idx" ON "admin_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_log_entity_entity_id_idx" ON "admin_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Safety rules (CHECK constraints) ───────────────────────────────────────
-- Written by hand: Prisma can't express these, and Prisma Migrate leaves them in place.

-- A shipped or delivered order always says how it was sent.
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipment_recorded"
  CHECK ("status" NOT IN ('shipped', 'delivered') OR ("courier" IS NOT NULL AND "tracking_number" IS NOT NULL));

ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_entity_known"
  CHECK ("entity" IN ('order', 'product'));
