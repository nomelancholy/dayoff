# DB 스키마 & 마이그레이션

- **스키마**: `app/db/schema/` — Drizzle ORM 테이블 정의 (spec.md Data Structure 기준).
- **마이그레이션**: `app/db/migrations/` — `npm run db:generate` 로 생성, `npm run db:migrate` 또는 Supabase 대시보드에서 적용.
- **타입**: 테이블/쿼리 타입은 Drizzle 스키마에서 추론 (`typeof schema.profiles.$inferSelect` 등). Supabase Auth 연동 시에는 Supabase Generated Types 또는 `profiles` 스키마 타입 사용.
