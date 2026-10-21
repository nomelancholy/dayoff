CREATE TABLE naver_coupon_checkouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mode text NOT NULL CHECK(mode IN ('production','sandbox')),
 user_id uuid NOT NULL REFERENCES users(id), user_coupon_id uuid REFERENCES user_coupons(id) ON DELETE SET NULL,
 coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL, request_id uuid NOT NULL, request_hash text NOT NULL,
 token text NOT NULL, state text NOT NULL DEFAULT 'registering' CHECK(state IN ('registering','registered','pending','paid','cancelled','failed','review')),
 items jsonb NOT NULL, discount_amount integer NOT NULL CHECK(discount_amount>0), subtotal integer NOT NULL CHECK(subtotal>discount_amount),
 buy_key text, merchant_no text, provider_order_id text, validated_at timestamptz, redeemed_at timestamptz,
 released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX naver_coupon_checkout_request ON naver_coupon_checkouts(mode,user_id,request_id);
--> statement-breakpoint
CREATE UNIQUE INDEX naver_coupon_checkout_hold ON naver_coupon_checkouts(mode,user_coupon_id) WHERE released_at IS NULL;
