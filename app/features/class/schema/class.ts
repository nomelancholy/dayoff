import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'

/** 원데이 클래스 종류 (spec 2.6) */
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
