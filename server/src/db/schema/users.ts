import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

/** 로그인 제공자: 이메일 비밀번호 | 소셜 */
export type AuthProvider = 'email' | 'kakao' | 'google' | 'naver';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  password: text('password'), // 이메일 로그인 시만 사용, 소셜은 null
  provider: text('provider').$type<AuthProvider>().notNull().default('email'),
  providerId: text('provider_id'), // 소셜 제공자 쪽 사용자 식별자
  fullName: text('full_name'),
  phone: text('phone'),
  role: text('role').$type<'member' | 'admin'>().notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// 소셜 사용자 식별은 (provider, providerId)로 앱에서 보장. 이메일 사용자는 provider='email'일 때 email 중복 체크.

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  label: text('label').notNull(),
  recipientName: text('recipient_name'),
  phone: text('phone'),
  postalCode: text('postal_code'),
  addressLine1: text('address_line1').notNull(),
  addressLine2: text('address_line2'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
