# Project Name: 도자기 공방 DOT. 의 홈페이지

## 1. Goal

공방 소개 (about) 페이지, 물건을 구매할 수 있는 쇼핑 (shop) 페이지, 원데이 클래스 신청 (class) 페이지, 공방 컨택 (contact) 페이지로 구성된 공방 홈페이지를 만드는 것이 목표

이메일을 통한 로그인과 카카오톡, 구글, 애플을 활용한 소셜 로그인을 제공한다.

shop 페이지의 상품 등록은 admin만 할 수 있다.

회원에게 제공되는 할인 쿠폰 기능도 존재한다.

## 2. Data Structure

> `_reference_ui` 의 페이지·UI 구조를 기준으로 도출한 엔티티 및 필드 정의.

### 2.1 사용자·권한 (Auth & Profile)

- **users (Supabase Auth 확장 또는 profiles)**
  - `id` (UUID, PK, Supabase Auth 연동)
  - `email` (unique, not null)
  - `full_name` (이름, 프로필용)
  - `phone` (전화번호)
  - `role` (`'member'` | `'admin'`) — admin만 상품 등록 가능
  - `created_at`, `updated_at`

### 2.2 프로필·주소록 (Account 페이지)

- **addresses**
  - `id` (UUID, PK)
  - `user_id` (FK → users)
  - `label` (예: "HOME (DEFAULT)")
  - `recipient_name`, `phone`
  - `postal_code`, `address_line1`, `address_line2` (또는 단일 `address`)
  - `is_default` (boolean)
  - `created_at`, `updated_at`

### 2.3 상품·쇼핑 (Shop, Product Detail, Cart)

- **product_categories** (필터/브레드크럼용)
  - `id` (PK)
  - `slug` (`'cup'` | `'plate'` | `'object'` 등, reference UI 기준)
  - `name` (예: "CUP", "PLATE", "OBJECT")
  - `sort_order` (선택)

- **products** (admin만 등록/수정/삭제)
  - `id` (UUID, PK)
  - `category_id` (FK → product_categories)
  - `slug` (URL·상세 페이지용)
  - `name` (예: "MOONLIGHT VASE", "SAND MUG")
  - `description` (긴 상세 설명 텍스트)
  - `price` (정수, 원화)
  - `is_active` (boolean, 노출 여부)
  - `created_at`, `updated_at`
  - (이미지·옵션은 아래 테이블로 분리)

- **product_images**
  - `id` (PK)
  - `product_id` (FK → products)
  - `url` (또는 storage path)
  - `alt`, `sort_order`

- **product_options** (상세 페이지의 Finish 등)
  - `id` (PK)
  - `product_id` (FK → products)
  - `name` (예: "FINISH")
  - `value` (예: "Matte Sand White", "Glossy Pearl")
  - `sort_order`

- **cart_items** (회원 장바구니, 로그인 사용자 기준)
  - `id` (UUID, PK)
  - `user_id` (FK → users)
  - `product_id` (FK → products)
  - `option_id` (FK → product_options, nullable)
  - `quantity` (positive int)
  - `created_at`, `updated_at`

### 2.4 주문 (Order History)

- **orders**
  - `id` (UUID, PK)
  - `user_id` (FK → users)
  - `order_number` (예: "DOT-2024-0120", unique, 노출용)
  - `status` (`'pending'` | `'paid'` | `'shipped'` | `'delivered'` | `'cancelled'` 등)
  - `shipping_address_id` (FK → addresses, nullable)
  - `subtotal`, `shipping_fee`, `discount_amount`, `total` (원화)
  - `coupon_id` (FK → coupons, nullable)
  - `created_at`, `updated_at`

- **order_items**
  - `id` (PK)
  - `order_id` (FK → orders)
  - `product_id` (FK → products)
  - `product_option_id` (FK → product_options, nullable)
  - `product_name`, `option_label` (스냅샷)
  - `price`, `quantity`
  - `line_total`

### 2.5 쿠폰 (회원 할인)

- **coupons**
  - `id` (UUID, PK)
  - `code` (unique, 사용자 입력용)
  - `discount_type` (`'percent'` | `'fixed'`)
  - `discount_value` (퍼센트 또는 고정 금액)
  - `min_order_amount` (nullable, 적용 최소 주문액)
  - `valid_from`, `valid_until`
  - `usage_limit` (nullable), `used_count`
  - `is_active` (boolean)
  - `created_at`, `updated_at`

- **user_coupons** (회원에게 지급된 쿠폰)
  - `id` (PK)
  - `user_id` (FK → users)
  - `coupon_id` (FK → coupons)
  - `used_at` (nullable, 사용 시점)
  - `order_id` (FK → orders, nullable, 사용한 주문)
  - `created_at`

### 2.6 클래스 (Class 페이지)

- **classes** (원데이 클래스 종류, reference UI 기준 3종)
  - `id` (PK)
  - `slug` (예: `'wheel'`, `'color-clay'`, `'free-oneday'`)
  - `name` (예: "물레 클래스", "컬러 클레이 클래스", "자유 원데이 클래스")
  - `subtitle` (예: "WHEEL THROWING")
  - `description` (본문)
  - `duration_min` (분 단위, 예: 90, 120)
  - `booking_url` (네이버 예약 등 외부 링크, nullable)
  - `image_url`, `sort_order`
  - `created_at`, `updated_at`

(클래스 예약을 자체 DB로 관리할 경우: **class_bookings** 테이블 추가 — `user_id`, `class_id`, `scheduled_at`, `status` 등)

### 2.7 연락처·찾아오는 길 (Contact)

- **site_settings** 또는 **contact_info** (싱글톤 또는 키-값)
  - `address` (전체 주소)
  - `email`
  - `opening_hours` (예: "Tue - Sun | 11:00 - 20:00")
  - `instagram_url`, `blog_url`
  - `map_embed_url` 또는 `map_lat`, `map_lng` (지도 표시용)

- **wayfinding_steps** (찾아오는 길 단계별 안내)
  - `id` (PK)
  - `route` (`'chungmuro'` | `'euljiro'` 등)
  - `step_order` (1, 2, 3 …)
  - `title`, `description`
  - `image_url`

### 2.8 상품 상세 부가 (리뷰·Q&A·배송안내)

- **product_reviews** (선택)
  - `id` (PK)
  - `product_id` (FK → products)
  - `user_id` (FK → users)
  - `rating` (1–5)
  - `body` (텍스트)
  - `created_at`

- **product_qa** (선택)
  - `id` (PK)
  - `product_id` (FK → products)
  - `user_id` (FK → users, nullable — 비회원 문의 시)
  - `question`, `answer` (nullable, 관리자 답변)
  - `status` (`'pending'` | `'answered'`)
  - `created_at`, `answered_at`

배송·교환 안내는 고정 텍스트 또는 `site_settings`에 저장.

---

- **RLS**: `users`(profiles), `addresses`, `cart_items`, `orders`, `order_items`, `user_coupons` 등은 `auth.uid()` 기준으로 행 접근 제한. `products`, `product_categories`, `coupons`(읽기) 등은 공개 또는 역할별 정책 적용.
- **Admin**: `role = 'admin'` 인 사용자만 `products`, `product_categories`, `product_options`, `product_images`, `coupons`, `classes`, `site_settings`, `wayfinding_steps` 등에 대한 쓰기 허용.
