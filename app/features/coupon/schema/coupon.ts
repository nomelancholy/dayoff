import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

/** 쿠폰 (spec 2.5) */
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  discountType: text('discount_type').$type<'percent' | 'fixed'>().notNull(),
  discountValue: integer('discount_value').notNull(),
  minOrderAmount: integer('min_order_amount'),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 회원 지급 쿠폰 (spec 2.5) — order_id는 FK 없이 UUID만 (순환 참조 방지) */
export const userCoupons = pgTable('user_coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  couponId: uuid('coupon_id').notNull().references(() => coupons.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  orderId: uuid('order_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
