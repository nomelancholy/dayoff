import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SpacesStorageService } from './spaces-storage.service';

describe('SpacesStorageService', () => {
  const createService = (values: Record<string, string> = {}) =>
    new SpacesStorageService(new ConfigService(values));

  it('환경설정이 없으면 로컬 저장소를 사용한다', () => {
    const status = createService().getConfigurationStatus();

    expect(status).toEqual({
      driver: 'local',
      configured: false,
      region: null,
      bucket: null,
      publicBaseUrl: null,
      missingKeys: [],
    });
  });

  it('키가 설정되면 Spaces를 자동 활성화하고 CDN URL을 사용한다', () => {
    const status = createService({
      SPACES_REGION: 'sgp1',
      SPACES_BUCKET: 'dayofftoday',
      SPACES_CDN_URL: 'https://dayofftoday.sgp1.cdn.digitaloceanspaces.com',
      SPACES_ACCESS_KEY_ID: 'access-key',
      SPACES_SECRET_ACCESS_KEY: 'secret-key',
    }).getConfigurationStatus();

    expect(status).toEqual({
      driver: 'spaces',
      configured: true,
      region: 'sgp1',
      bucket: 'dayofftoday',
      publicBaseUrl: 'https://dayofftoday.sgp1.cdn.digitaloceanspaces.com',
      missingKeys: [],
    });
    expect(status).not.toHaveProperty('accessKeyId');
    expect(status).not.toHaveProperty('secretAccessKey');
  });

  it('명시적으로 비활성화하면 키가 있어도 로컬 저장소를 사용한다', () => {
    const status = createService({
      SPACES_ENABLED: 'false',
      SPACES_ACCESS_KEY_ID: 'access-key',
      SPACES_SECRET_ACCESS_KEY: 'secret-key',
    }).getConfigurationStatus();

    expect(status.driver).toBe('local');
    expect(status.configured).toBe(false);
    expect(status.missingKeys).toEqual([]);
  });

  it('일부 설정만 있으면 누락된 키 이름만 반환한다', () => {
    const status = createService({
      SPACES_ENABLED: 'true',
      SPACES_REGION: 'sgp1',
      SPACES_BUCKET: 'dayofftoday',
    }).getConfigurationStatus();

    expect(status.driver).toBe('spaces');
    expect(status.configured).toBe(false);
    expect(status.missingKeys).toEqual([
      'SPACES_ACCESS_KEY_ID',
      'SPACES_SECRET_ACCESS_KEY',
    ]);
  });
});

describe('SpacesStorageService 이미지 주소 소유 확인 · 삭제 범위', () => {
  let uploadsParent: string;
  const createService = (values: Record<string, string> = {}) =>
    new SpacesStorageService(new ConfigService(values));
  const spacesValues = {
    SPACES_REGION: 'sgp1',
    SPACES_BUCKET: 'dayofftoday',
    SPACES_CDN_URL: 'https://cdn.dayoff.today',
    SPACES_ACCESS_KEY_ID: 'access-key',
    SPACES_SECRET_ACCESS_KEY: 'secret-key',
  };
  const filePath = (...segments: string[]) =>
    join(uploadsParent, 'uploads', ...segments);
  const exists = (path: string) =>
    stat(path).then(
      () => true,
      () => false,
    );

  beforeEach(async () => {
    uploadsParent = await mkdtemp(join(tmpdir(), 'dayoff-storage-'));
    await mkdir(filePath('review'), { recursive: true });
    await mkdir(filePath('product'), { recursive: true });
    await writeFile(filePath('review', 'mine.webp'), 'review');
    await writeFile(filePath('product', 'hero.webp'), 'product');
    jest.spyOn(process, 'cwd').mockReturnValue(uploadsParent);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(uploadsParent, { recursive: true, force: true });
  });

  it('주소에서 폴더별 저장소 키를 얻고, 다른 폴더·이상한 경로는 인정하지 않는다', () => {
    const service = createService();

    expect(
      service.storageKeyFromUrl(
        'https://dayoff.today/uploads/product/a.webp',
        'product',
      ),
    ).toBe('product/a.webp');
    expect(
      service.storageKeyFromUrl(
        'https://cdn.dayoff.today/review/b.webp',
        'review',
      ),
    ).toBe('review/b.webp');
    expect(service.storageKeyFromUrl('/uploads/review/c.gif', 'review')).toBe(
      'review/c.gif',
    );

    for (const url of [
      'https://dayoff.today/uploads/product/a.webp',
      '/uploads/review/../product/a.webp',
      '/uploads/review/nested/a.webp',
      '/uploads/review/',
      'https://picsum.photos/800/800?random=1',
      '',
    ]) {
      expect(service.storageKeyFromUrl(url, 'review')).toBeNull();
    }
  });

  it('로컬 저장소: 실제로 저장된 구매평 파일만 인정하고 요청 호스트 기준 주소로 정규화한다', async () => {
    const service = createService();
    const baseUrl = 'https://dayoff.today';

    await expect(
      service.resolveUploadedUrl(
        'https://evil.example.com/uploads/review/mine.webp',
        'review',
        baseUrl,
      ),
    ).resolves.toBe('https://dayoff.today/uploads/review/mine.webp');
    await expect(
      service.resolveUploadedUrl(
        '/uploads/review/mine.webp',
        'review',
        baseUrl,
      ),
    ).resolves.toBe('https://dayoff.today/uploads/review/mine.webp');

    for (const url of [
      '/uploads/product/hero.webp',
      '/uploads/review/../product/hero.webp',
      '/uploads/review/missing.webp',
      'https://evil.example.com/tracker.png',
      'javascript:alert(1)',
    ]) {
      await expect(
        service.resolveUploadedUrl(url, 'review', baseUrl),
      ).resolves.toBeNull();
    }
  });

  it('Spaces: 설정된 CDN/버킷 호스트의 해당 폴더 주소만 인정한다', async () => {
    const service = createService(spacesValues);
    const baseUrl = 'https://dayoff.today';

    await expect(
      service.resolveUploadedUrl(
        'https://dayofftoday.sgp1.digitaloceanspaces.com/review/a.webp',
        'review',
        baseUrl,
      ),
    ).resolves.toBe('https://cdn.dayoff.today/review/a.webp');
    await expect(
      service.resolveUploadedUrl(
        'https://cdn.dayoff.today/product/hero.webp',
        'review',
        baseUrl,
      ),
    ).resolves.toBeNull();
    await expect(
      service.resolveUploadedUrl(
        'https://cdn.evil.example.com/review/a.webp',
        'review',
        baseUrl,
      ),
    ).resolves.toBeNull();
  });

  it('삭제는 지정한 폴더의 파일에만 적용된다', async () => {
    const service = createService();

    await service.deleteStoredUrls(
      [
        'https://dayoff.today/uploads/product/hero.webp',
        '/uploads/review/../product/hero.webp',
        'https://dayoff.today/uploads/review/mine.webp',
        null,
      ],
      { directory: 'review' },
    );

    expect(await exists(filePath('review', 'mine.webp'))).toBe(false);
    expect(await exists(filePath('product', 'hero.webp'))).toBe(true);
  });
});
