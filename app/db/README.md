# DB 스키마 & 마이그레이션

- **스키마 정의**: 각 feature 폴더 내 `app/features/[feature-name]/schema/` 에 테이블을 정의한다. (`.cursorrules` Project Structure 참고)
- **집합**: `app/db/schema/index.ts` 에서 위 feature schema들을 re-export하여 Drizzle Kit이 한 곳만 참조하도록 한다.
- **마이그레이션**: `app/db/migrations/` — `npm run db:generate` 로 생성, `npm run db:migrate` 또는 Supabase 대시보드에서 적용.
- **타입**: Drizzle 스키마에서 추론. Supabase Auth 연동 시 Supabase Generated Types 또는 해당 feature의 스키마 타입 사용.
