import { ConfigService } from '@nestjs/config';
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
