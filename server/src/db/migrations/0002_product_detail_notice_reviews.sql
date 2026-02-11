-- 상품: 구매 전 안내·취급 주의사항
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "purchase_notice" text,
  ADD COLUMN IF NOT EXISTS "handling_notice" text;

-- 상품 상세 하단 이미지
CREATE TABLE IF NOT EXISTS "product_detail_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt" text,
  "sort_order" integer DEFAULT 0
);

-- product_reviews: rating nullable, updated_at 추가
ALTER TABLE "product_reviews"
  ALTER COLUMN "rating" DROP NOT NULL;
ALTER TABLE "product_reviews"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

UPDATE "product_reviews" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
ALTER TABLE "product_reviews" ALTER COLUMN "updated_at" SET NOT NULL;

UPDATE "product_reviews" SET "body" = '' WHERE "body" IS NULL;
ALTER TABLE "product_reviews" ALTER COLUMN "body" SET NOT NULL;

-- 구매평 첨부 이미지
CREATE TABLE IF NOT EXISTS "product_review_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "review_id" uuid NOT NULL REFERENCES "product_reviews"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "sort_order" integer DEFAULT 0
);
