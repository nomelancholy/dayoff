import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { products, productOptions } from './products';

/** 장바구니 */
export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  optionId: uuid('option_id').references(() => productOptions.id),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 상품 리뷰 */
export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  rating: integer('rating').notNull(),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 상품 Q&A */
export const productQa = pgTable('product_qa', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  userId: uuid('user_id').references(() => users.id),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status')
    .$type<'pending' | 'answered'>()
    .notNull()
    .default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
});
