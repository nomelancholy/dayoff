ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "stock_quantity" integer NOT NULL DEFAULT 0;

