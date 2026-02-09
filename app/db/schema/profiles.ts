import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

/** Supabase Auth 확장 프로필 (spec 2.1) */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  role: text('role').$type<'member' | 'admin'>().notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
