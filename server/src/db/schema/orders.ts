import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, addresses } from './users';
import { products, productOptions } from './products';

/** 쿠폰 */
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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 회원 지급 쿠폰 */
export const userCoupons = pgTable('user_coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  couponId: uuid('coupon_id')
    .notNull()
    .references(() => coupons.id),
  usedAt: timestamp('used_at', { withTimezone: true }),
  orderId: uuid('order_id'), // 순환 참조 방지를 위해 references 생략 가능
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 주문 */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status')
    .$type<'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'>()
    .notNull()
    .default('pending'),
  shippingAddressId: uuid('shipping_address_id').references(
    () => addresses.id,
  ),
  subtotal: integer('subtotal').notNull(),
  shippingFee: integer('shipping_fee').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  total: integer('total').notNull(),
  couponId: uuid('coupon_id').references(() => coupons.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 주문 상세 */
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  productOptionId: uuid('product_option_id').references(
    () => productOptions.id,
  ),
  productName: text('product_name').notNull(),
  optionLabel: text('option_label'),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
