import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
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

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  option: one(productOptions, {
    fields: [cartItems.optionId],
    references: [productOptions.id],
  }),
}));

/** 상품 구매평 (리뷰) */
export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating'), // 1-5 선택
  body: text('body').notNull(), // 리뷰 내용
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productReviewsRelations = relations(
  productReviews,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productReviews.productId],
      references: [products.id],
    }),
    user: one(users, {
      fields: [productReviews.userId],
      references: [users.id],
    }),
    images: many(productReviewImages),
  }),
);

/** 구매평 첨부 이미지 */
export const productReviewImages = pgTable('product_review_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => productReviews.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const productReviewImagesRelations = relations(
  productReviewImages,
  ({ one }) => ({
    review: one(productReviews, {
      fields: [productReviewImages.reviewId],
      references: [productReviews.id],
    }),
  }),
);

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

export const productQaRelations = relations(productQa, ({ one }) => ({
  product: one(products, {
    fields: [productQa.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [productQa.userId],
    references: [users.id],
  }),
}));
