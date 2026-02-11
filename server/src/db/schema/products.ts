import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/** 상품 카테고리 */
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const productCategoriesRelations = relations(
  productCategories,
  ({ many }) => ({
    products: many(products),
  }),
);

/** 상품 */
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => productCategories.id),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  /** 구매 전 안내사항 */
  purchaseNotice: text('purchase_notice'),
  /** 취급 및 구매 주의사항 */
  handlingNotice: text('handling_notice'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  images: many(productImages),
  options: many(productOptions),
  detailImages: many(productDetailImages),
}));

/** 상품 이미지 */
export const productImages = pgTable('product_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  url: text('url').notNull(),
  alt: text('alt'),
  sortOrder: integer('sort_order').default(0),
});

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

/** 상품 옵션 */
export const productOptions = pgTable('product_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  value: text('value').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const productOptionsRelations = relations(productOptions, ({ one }) => ({
  product: one(products, {
    fields: [productOptions.productId],
    references: [products.id],
  }),
}));

/** 상품 상세 페이지 하단 이미지 (추가 상세 이미지) */
export const productDetailImages = pgTable('product_detail_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt'),
  sortOrder: integer('sort_order').default(0),
});

export const productDetailImagesRelations = relations(
  productDetailImages,
  ({ one }) => ({
    product: one(products, {
      fields: [productDetailImages.productId],
      references: [products.id],
    }),
  }),
);

