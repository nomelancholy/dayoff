CREATE TABLE "product_detail_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "product_review_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_reviews" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_reviews" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "purchase_notice" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "handling_notice" text;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "product_detail_images" ADD CONSTRAINT "product_detail_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_review_images" ADD CONSTRAINT "product_review_images_review_id_product_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."product_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;