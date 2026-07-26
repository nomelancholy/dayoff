ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "naver_payment_id" text,
  ADD COLUMN IF NOT EXISTS "naver_pay_hist_id" text,
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_naver_payment_id_unique"
ON "orders" USING btree ("naver_payment_id")
WHERE "naver_payment_id" IS NOT NULL;
