import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { profiles } from './profiles'

/** 주소록 (spec 2.2) */
export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id),
  label: text('label').notNull(),
  recipientName: text('recipient_name'),
  phone: text('phone'),
  postalCode: text('postal_code'),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
