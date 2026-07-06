ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "shipping_notice" text,
  ADD COLUMN IF NOT EXISTS "exchange_return_notice" text,
  ADD COLUMN IF NOT EXISTS "care_guide" text;

UPDATE "products"
SET "care_guide" = "handling_notice"
WHERE "care_guide" IS NULL
  AND "handling_notice" IS NOT NULL;
