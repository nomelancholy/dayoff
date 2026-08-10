ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "original_price" integer,
  ADD COLUMN IF NOT EXISTS "discount_rate" integer DEFAULT 0 NOT NULL;

ALTER TABLE "products"
  DROP CONSTRAINT IF EXISTS "products_original_price_non_negative",
  ADD CONSTRAINT "products_original_price_non_negative"
    CHECK ("original_price" IS NULL OR "original_price" >= 0),
  DROP CONSTRAINT IF EXISTS "products_discount_rate_range",
  ADD CONSTRAINT "products_discount_rate_range"
    CHECK ("discount_rate" >= 0 AND "discount_rate" <= 100);
