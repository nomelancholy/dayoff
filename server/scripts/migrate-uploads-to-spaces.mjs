/**
 * 기존 /uploads 이미지들을 DigitalOcean Spaces로 복사하고 DB URL을 CDN URL로 바꿉니다.
 * 원본 로컬 파일은 검증/롤백을 위해 삭제하지 않습니다.
 *
 * 운영 컨테이너에서 실행:
 *   npm run storage:migrate
 */
import 'dotenv/config';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname, resolve, sep } from 'path';
import pg from 'pg';

const requiredEnv = [
  'DATABASE_URL',
  'SPACES_REGION',
  'SPACES_BUCKET',
  'SPACES_ACCESS_KEY_ID',
  'SPACES_SECRET_ACCESS_KEY',
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim());
if (missingEnv.length > 0) {
  console.error(`필수 환경변수가 없습니다: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const region = process.env.SPACES_REGION.trim();
const bucket = process.env.SPACES_BUCKET.trim();
const endpoint =
  process.env.SPACES_ENDPOINT?.trim() ||
  `https://${region}.digitaloceanspaces.com`;
const publicBaseUrl = (
  process.env.SPACES_CDN_URL?.trim() ||
  `https://${bucket}.${region}.digitaloceanspaces.com`
).replace(/\/+$/, '');
const uploadsRoot = resolve(process.env.UPLOADS_ROOT?.trim() || './uploads');

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY.trim(),
  },
});

const contentTypes = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const tables = [
  'product_images',
  'product_detail_images',
  'product_review_images',
];

function localImage(url) {
  try {
    const pathname = new URL(url, 'http://local').pathname;
    if (!pathname.startsWith('/uploads/')) return null;

    const key = decodeURIComponent(pathname.slice('/uploads/'.length));
    const filePath = resolve(uploadsRoot, key);
    if (!key || !filePath.startsWith(`${uploadsRoot}${sep}`)) return null;
    return { key, filePath };
  } catch {
    return null;
  }
}

function publicUrl(key) {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${publicBaseUrl}/${encodedKey}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let migrated = 0;
let skipped = 0;
let failed = 0;

try {
  await client.connect();

  for (const table of tables) {
    const { rows } = await client.query(`SELECT id, url FROM ${table}`);
    for (const row of rows) {
      const local = localImage(row.url);
      if (!local) {
        skipped += 1;
        continue;
      }

      try {
        const fileStat = await stat(local.filePath);
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: local.key,
            Body: createReadStream(local.filePath),
            ContentLength: fileStat.size,
            ContentType:
              contentTypes[extname(local.filePath).toLowerCase()] ||
              'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
            ACL: 'public-read',
          }),
        );

        const nextUrl = publicUrl(local.key);
        await client.query(`UPDATE ${table} SET url = $1 WHERE id = $2`, [
          nextUrl,
          row.id,
        ]);
        migrated += 1;
        console.log(`[완료] ${table} ${row.id} -> ${nextUrl}`);
      } catch (error) {
        failed += 1;
        console.error(
          `[실패] ${table} ${row.id} (${local.filePath}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
} catch (error) {
  console.error('마이그레이션 실행 오류:', error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

console.log(
  `이미지 마이그레이션 결과: 완료 ${migrated}, 이미 외부 URL/대상 아님 ${skipped}, 실패 ${failed}`,
);
if (failed > 0) process.exitCode = 1;
