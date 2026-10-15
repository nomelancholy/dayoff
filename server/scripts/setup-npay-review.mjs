// 로컬: npm run npay:review:setup
// 배포 환경: DATABASE_URL을 주입하고 --env-file /path/.env.deploy 지정 후 API 재시작.
// 비밀번호는 Git에서 제외된 .local 파일에만 기록합니다. 기존 계정은 덮어쓰지 않습니다.
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import pg from 'pg';

const index = process.argv.indexOf('--env-file');
if (index >= 0 && !process.argv[index + 1])
  throw new Error('--env-file 뒤에 환경 파일 경로를 지정해 주세요.');
const productionSite = process.argv.includes('--production-site');
const envPath = resolve(index >= 0 ? process.argv[index + 1] : '.env');
let envText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const settings = { ...dotenv.parse(envText), ...process.env };
if (!settings.DATABASE_URL) throw new Error('DATABASE_URL이 필요합니다.');
if (settings.NAVER_ORDER_MODE && settings.NAVER_ORDER_MODE !== 'test')
  throw new Error('운영 결제 환경에는 검수 계정을 활성화하지 않습니다.');
if (settings.NAVER_ORDER_AUDIENCE && settings.NAVER_ORDER_AUDIENCE !== 'review')
  throw new Error('NAVER_ORDER_AUDIENCE=review 환경에서 실행해 주세요.');
if (productionSite) {
  if (settings.NODE_ENV !== 'production')
    throw new Error(
      '운영 사이트 설정은 production API 컨테이너에서 실행해 주세요.',
    );
  const origin = new URL(settings.FRONTEND_URL || 'http://localhost');
  if (origin.protocol !== 'https:' || origin.username || origin.password)
    throw new Error('운영 FRONTEND_URL은 HTTPS 주소여야 합니다.');
  for (const key of [
    'NAVER_ORDER_MERCHANT_ID',
    'NAVER_ORDER_CERTI_KEY',
    'NAVER_ORDER_BUTTON_KEY',
    'NAVER_ORDER_ACCOUNT_ID',
  ]) {
    if (!settings[key]?.trim())
      throw new Error(`운영 환경변수 ${key}가 필요합니다.`);
  }
}

const credentialsPath = resolve(
  dirname(envPath),
  'npay-review-credentials.local',
);
const credentials = existsSync(credentialsPath)
  ? JSON.parse(readFileSync(credentialsPath, 'utf8'))
  : {
      userId: randomUUID(),
      loginId: 'npay_test',
      email: 'npay_test@dayoff.invalid',
      password: `Npay-${randomBytes(18).toString('base64url')}`,
      loginPath: '/npay-review',
      note: '이 스크립트가 연결한 DB의 검수 전용 계정입니다. 실제 이메일 수신함은 없습니다.',
    };
if (
  settings.NAVER_REVIEW_USER_ID &&
  settings.NAVER_REVIEW_USER_ID !== credentials.userId
)
  throw new Error(
    '설정된 검수 계정과 로컬 인증정보 파일이 다릅니다. 덮어쓰지 않습니다.',
  );
if (!existsSync(credentialsPath))
  writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
chmodSync(credentialsPath, 0o600);

const pool = new pg.Pool({
  connectionString: settings.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('dayoff-npay-review-setup'))",
  );
  const { rows } = await client.query(
    'SELECT id, email, provider, role, password FROM users WHERE id = $1 OR email = $2',
    [credentials.userId, credentials.email],
  );
  if (rows.length) {
    const user = rows[0];
    if (
      rows.length !== 1 ||
      user.id !== credentials.userId ||
      user.email !== credentials.email ||
      user.provider !== 'email' ||
      user.role !== 'member' ||
      !user.password ||
      !(await bcrypt.compare(credentials.password, user.password))
    )
      throw new Error(
        '동일 식별자의 기존 계정이 있습니다. 기존 계정을 수정하지 않았습니다.',
      );
  } else {
    await client.query(
      "INSERT INTO users (id, email, password, provider, full_name, role) VALUES ($1, $2, $3, 'email', '네이버페이 검수', 'member')",
      [
        credentials.userId,
        credentials.email,
        await bcrypt.hash(credentials.password, 12),
      ],
    );
  }
  await client.query('COMMIT');
  const updates = {
    NAVER_REVIEW_LOGIN_ENABLED: 'true',
    NAVER_REVIEW_LOGIN_ID: credentials.loginId,
    NAVER_REVIEW_USER_ID: credentials.userId,
    NAVER_ORDER_MODE: 'test',
    NAVER_ORDER_AUDIENCE: 'review',
    ...(productionSite
      ? { NAVER_ORDER_ENABLED: 'true', NAVER_ORDER_PRODUCTION_READY: 'false' }
      : {}),
  };
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    envText = pattern.test(envText)
      ? envText.replace(pattern, line)
      : `${envText.trimEnd()}\n${line}\n`;
  }
  writeFileSync(envPath, envText, { mode: 0o600 });
  console.log(`검수 일반 회원 준비 완료. 인증정보: ${credentialsPath}`);
  console.log(
    '서버 환경파일 반영 완료. API 재생성 후 /npay-review에서 로그인하세요. 검수 계정 전용이며 네이버페이 일반 공개는 비활성 상태입니다.',
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
