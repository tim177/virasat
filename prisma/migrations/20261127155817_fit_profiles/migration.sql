-- CreateTable
CREATE TABLE "fit_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "Gender" NOT NULL,
    "units" TEXT NOT NULL,
    "measurements" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fit_profiles_user_id_updated_at_idx" ON "fit_profiles"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fit_profiles_user_id_name_key" ON "fit_profiles"("user_id", "name");

-- AddForeignKey
ALTER TABLE "fit_profiles" ADD CONSTRAINT "fit_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Safety rules (CHECK constraints) ───────────────────────────────────────
-- Written by hand: Prisma can't express these, and Prisma Migrate leaves them in place.

-- A short, trimmed, non-empty name ("Me", "Mum").
ALTER TABLE "fit_profiles" ADD CONSTRAINT "fit_profiles_name_valid"
  CHECK (btrim("name") <> '' AND "name" = btrim("name") AND char_length("name") <= 40);

ALTER TABLE "fit_profiles" ADD CONSTRAINT "fit_profiles_units_known"
  CHECK ("units" IN ('in', 'cm'));

-- { "values": { ... }, "notes"?: "..." }; the values themselves are checked by lib/measurements.ts.
ALTER TABLE "fit_profiles" ADD CONSTRAINT "fit_profiles_measurements_shape"
  CHECK (jsonb_typeof("measurements") = 'object' AND coalesce(jsonb_typeof("measurements" -> 'values'), '') = 'object');
