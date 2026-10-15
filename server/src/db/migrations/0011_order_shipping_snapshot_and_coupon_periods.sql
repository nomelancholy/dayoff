-- 주문 시점의 배송지 스냅샷.
-- 주소록(addresses)을 나중에 수정·삭제해도 이미 접수된 주문의 배송 정보가 바뀌지 않도록 합니다.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "shipping_recipient_name" text,
  ADD COLUMN IF NOT EXISTS "shipping_phone" text,
  ADD COLUMN IF NOT EXISTS "shipping_postal_code" text,
  ADD COLUMN IF NOT EXISTS "shipping_address_line1" text,
  ADD COLUMN IF NOT EXISTS "shipping_address_line2" text;
--> statement-breakpoint
-- 결제 취소(환불)를 하기로 결정한 시각.
-- 네이버페이에 취소를 요청하기 전에 먼저 기록해, 환불 처리 중이거나 결과를 확인하지 못한 주문이
-- 발송 처리되거나 결제 완료로 확정되지 않게 합니다.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "cancel_requested_at" timestamp with time zone;
--> statement-breakpoint
-- 기존 주문은 현재 연결된 주소록 값으로 한 번 채워 둡니다.
UPDATE "orders" AS o
SET "shipping_recipient_name" = a."recipient_name",
    "shipping_phone" = a."phone",
    "shipping_postal_code" = a."postal_code",
    "shipping_address_line1" = a."address_line1",
    "shipping_address_line2" = a."address_line2"
FROM "addresses" AS a
WHERE o."shipping_address_id" = a."id"
  AND o."shipping_address_line1" IS NULL;
--> statement-breakpoint
-- 주문 이력이 있어 숨김 처리된(삭제된) 상품이 카테고리 삭제를 막지 않도록 허용합니다.
ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;
--> statement-breakpoint
-- 쿠폰 유효 기간 보정.
-- 관리자 화면의 날짜(YYYY-MM-DD)가 UTC 자정(한국 시간 오전 9시)으로 저장되어
-- 시작일 0~9시에는 쓸 수 없고 종료일 오전 9시에 만료되던 문제를 한국 시간 하루 단위로 바로잡습니다.
UPDATE "coupons"
SET "valid_from" = "valid_from" - interval '9 hours'
WHERE ("valid_from" AT TIME ZONE 'UTC')::time = time '00:00:00';
--> statement-breakpoint
UPDATE "coupons"
SET "valid_until" = "valid_until" + interval '14 hours 59 minutes 59.999 seconds'
WHERE ("valid_until" AT TIME ZONE 'UTC')::time = time '00:00:00';
