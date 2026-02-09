import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { profiles, addresses } from '../../auth/schema'
import { coupons } from '../../coupon/schema'
import { products, productOptions } from '../../shop/schema'

/** 주문 (spec 2.4) */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status')
    .$type<'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'>()
    .notNull()
    .default('pending'),
  shippingAddressId: uuid('shipping_address_id').references(() => addresses.id),
  subtotal: integer('subtotal').notNull(),
  shippingFee: integer('shipping_fee').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  total: integer('total').notNull(),
  couponId: uuid('coupon_id').references(() => coupons.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 주문 상세 (spec 2.4) */
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  productOptionId: uuid('product_option_id').references(() => productOptions.id),
  productName: text('product_name').notNull(),
  optionLabel: text('option_label'),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  lineTotal: integer('line_total').notNull(),
})
