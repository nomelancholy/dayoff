-- 이미 DB에 테이블이 있는데 db:migrate를 쓰려면, 0000/0001을 "이미 적용됨"으로 표시해야 합니다.
-- 이 스크립트를 한 번만 실행한 뒤, 이후에는 `npm run db:migrate`만 실행하세요.
-- (PostgreSQL에서 실행: psql $DATABASE_URL -f src/db/migrations/scripts/bootstrap-migrations-log.sql)

CREATE SCHEMA IF NOT EXISTS drizzle;

CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- 0001_needy_norman_osborn 까지 적용된 것으로 기록 (created_at = journal.when)
-- 이렇게 하면 db:migrate 시 0002만 실행됩니다. (이미 행이 있으면 건너뜀)
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0001_needy_norman_osborn', 1770710630617
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1);
