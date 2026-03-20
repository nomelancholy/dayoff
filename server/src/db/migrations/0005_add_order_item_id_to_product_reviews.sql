ALTER TABLE "product_reviews"
ADD COLUMN IF NOT EXISTS "order_item_id" uuid;

