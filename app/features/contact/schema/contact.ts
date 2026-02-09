import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'

/** 연락처/사이트 설정 (spec 2.7) — 싱글톤용 키-값 또는 단일 행 */
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
})

/** 찾아오는 길 단계 (spec 2.7) */
export const wayfindingSteps = pgTable('wayfinding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  route: text('route').notNull(),
  stepOrder: integer('step_order').notNull(),
  title: text('title'),
  description: text('description'),
  imageUrl: text('image_url'),
})
