import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
import { profiles } from '../../auth/schema'
import { products, productOptions } from './product'

/** 장바구니 (spec 2.3) */
export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  optionId: uuid('option_id').references(() => productOptions.id),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
