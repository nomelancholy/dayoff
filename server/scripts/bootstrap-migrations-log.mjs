/**
 * DB에 이미 테이블이 있을 때, 0000/0001을 "적용됨"으로 기록합니다.
 * 한 번만 실행한 뒤 `npm run db:migrate`를 사용하세요.
 * 사용: node scripts/bootstrap-migrations-log.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 없습니다. .env를 확인하세요.');
  process.exit(1);
}

const sqlPath = join(__dirname, '../src/db/migrations/scripts/bootstrap-migrations-log.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  console.log('drizzle 마이그레이션 로그 부트스트랩 완료. 이제 npm run db:migrate 를 실행하세요.');
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end();
}
