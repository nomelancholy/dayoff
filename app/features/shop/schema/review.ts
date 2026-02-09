import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { profiles } from '../../auth/schema'
import { products } from './product'

/** 상품 리뷰 (spec 2.8, 선택) */
export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  rating: integer('rating').notNull(),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 상품 Q&A (spec 2.8, 선택) */
export const productQa = pgTable('product_qa', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id),
  userId: uuid('user_id').references(() => profiles.id),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status').$type<'pending' | 'answered'>().notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
})
