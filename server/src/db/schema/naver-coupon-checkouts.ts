import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { userCoupons, coupons } from './orders';
export type CouponCheckoutItem = {
  productId: string;
  optionId: string | null;
  quantity: number;
  unitPrice: number;
  discountedUnitPrice: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  optionLabel: string | null;
  amount: number;
};
export const naverCouponCheckouts = pgTable(
  'naver_coupon_checkouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mode: text('mode').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    userCouponId: uuid('user_coupon_id').references(() => userCoupons.id, {
      onDelete: 'set null',
    }),
    couponId: uuid('coupon_id').references(() => coupons.id, {
      onDelete: 'set null',
    }),
    requestId: uuid('request_id').notNull(),
    requestHash: text('request_hash').notNull(),
    token: text('token').notNull(),
    state: text('state').notNull().default('registering'),
    items: jsonb('items').$type<CouponCheckoutItem[]>().notNull(),
    discountAmount: integer('discount_amount').notNull(),
    subtotal: integer('subtotal').notNull(),
    key: text('buy_key'),
    merchantNo: text('merchant_no'),
    providerOrderId: text('provider_order_id'),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('naver_coupon_checkout_request').on(
      t.mode,
      t.userId,
      t.requestId,
    ),
    uniqueIndex('naver_coupon_checkout_hold')
      .on(t.mode, t.userCouponId)
      .where(sql`${t.releasedAt} is null`),
  ],
);
