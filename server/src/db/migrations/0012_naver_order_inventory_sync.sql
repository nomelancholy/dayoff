CREATE TABLE "naver_order_sync_state" (
  "mode" text PRIMARY KEY CHECK ("mode" IN ('sandbox', 'production')),
  "identity" text NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "cursor" timestamptz NOT NULL,
  "inventory_enabled" boolean NOT NULL,
  "last_success_at" timestamptz,
  "last_error" text,
  CHECK ("mode" = 'production' OR NOT "inventory_enabled")
);
--> statement-breakpoint
CREATE TABLE "naver_order_inventory" (
  "mode" text NOT NULL CHECK ("mode" IN ('sandbox', 'production')),
  "product_order_id" text NOT NULL,
  "order_id" text NOT NULL,
  "pay_product_id" text NOT NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "quantity" integer NOT NULL CHECK ("quantity" BETWEEN 1 AND 999),
  "cancelled_quantity" integer NOT NULL CHECK ("cancelled_quantity" BETWEEN 0 AND "quantity"),
  "consumed" integer NOT NULL CHECK ("consumed" BETWEEN 0 AND "quantity"),
  "applied_consumed" integer NOT NULL CHECK ("applied_consumed" BETWEEN 0 AND "quantity"),
  "status" text NOT NULL,
  "payment_date" timestamptz,
  "last_changed_date" timestamptz NOT NULL,
  "manual_review" boolean NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("mode", "product_order_id"),
  CHECK ("mode" = 'production' OR "applied_consumed" = 0)
);
