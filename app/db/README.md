# DB 스키마 & 마이그레이션

- **실제 스키마·마이그레이션**: **NestJS 서버**에서 관리. `server/src/db/schema/`, `server/src/db/migrations/` 참고.
- **server**에서: `npm run db:generate` 로 마이그레이션 생성, `npm run db:push` 또는 `npm run db:migrate` 로 PostgreSQL에 적용.
- **타입**: Drizzle 스키마에서 추론. (PostgreSQL 전용, Supabase 미사용)
