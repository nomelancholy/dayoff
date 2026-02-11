import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

/** 원데이 클래스 종류 */
export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subtitle: text('subtitle'),
  description: text('description'),
  durationMin: integer('duration_min'),
  bookingUrl: text('booking_url'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 연락처/사이트 설정 */
export const contactInfo = pgTable('contact_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address'),
  email: text('email'),
  openingHours: text('opening_hours'),
  instagramUrl: text('instagram_url'),
  blogUrl: text('blog_url'),
  mapEmbedUrl: text('map_embed_url'),
  mapLat: text('map_lat'),
  mapLng: text('map_lng'),
});

/** 찾아오는 길 단계 */
export const wayfindingSteps = pgTable('wayfinding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  route: text('route').notNull(),
  stepOrder: integer('step_order').notNull(),
  title: text('title'),
  description: text('description'),
  imageUrl: text('image_url'),
});
