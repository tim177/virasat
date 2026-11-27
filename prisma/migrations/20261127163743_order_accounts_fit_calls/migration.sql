-- AlterTable
ALTER TABLE "checkout_drafts" ADD COLUMN     "user_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fit_call_booked_at" TIMESTAMP(3),
ADD COLUMN     "fit_call_reminder_sent_at" TIMESTAMP(3),
ADD COLUMN     "user_id" UUID;

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- AddForeignKey
ALTER TABLE "checkout_drafts" ADD CONSTRAINT "checkout_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
