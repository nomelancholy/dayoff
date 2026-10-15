import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/common/database/database.module';

/**
 * 운영에서는 Nginx(deploy/nginx-dayoff-locations.conf)가 API 경로만 골라 백엔드로 넘기고
 * 나머지는 프론트(SPA)로 보냅니다. 개발 환경에는 Nginx가 없어 설정 누락이 드러나지 않으므로,
 * 서버에 등록된 모든 API 경로가 실제로 백엔드로 전달되는지 설정 파일을 읽어 확인합니다.
 */
type Location =
  | { kind: 'prefix'; value: string; proxied: boolean }
  | { kind: 'regex'; value: RegExp; proxied: boolean };

function parseLocations(conf: string): Location[] {
  const locations: Location[] = [];
  const pattern = /^location\s+(~\s+)?(\S+)\s*\{\n([\s\S]*?)^\}/gm;
  for (const match of conf.matchAll(pattern)) {
    const proxied = /^\s*proxy_pass\s/m.test(match[3]);
    locations.push(
      match[1]
        ? { kind: 'regex', value: new RegExp(match[2]), proxied }
        : { kind: 'prefix', value: match[2], proxied },
    );
  }
  return locations;
}

/** 이 설정 파일에서 쓰는 범위의 Nginx location 선택 규칙을 흉내 냅니다. */
function resolve(locations: Location[], path: string) {
  // 슬래시로 끝나는 proxy prefix는 슬래시 없는 같은 경로를 301로 돌려보낸다.
  // (브라우저는 301을 받은 POST를 GET으로 바꿔 다시 보내므로 등록 요청이 사라진다.)
  const redirected = locations.some(
    (location) =>
      location.kind === 'prefix' &&
      location.proxied &&
      location.value.endsWith('/') &&
      location.value.slice(0, -1) === path,
  );
  if (redirected) return 'redirect';

  const regex = locations.find(
    (location) => location.kind === 'regex' && location.value.test(path),
  );
  if (regex) return regex.proxied ? 'api' : 'static';

  const prefix = locations
    .filter(
      (location): location is Extract<Location, { kind: 'prefix' }> =>
        location.kind === 'prefix' && path.startsWith(location.value),
    )
    .sort((a, b) => b.value.length - a.value.length)[0];
  return prefix?.proxied ? 'api' : 'static';
}

describe('운영 Nginx 프록시 설정', () => {
  const locations = parseLocations(
    readFileSync(
      join(__dirname, '../../deploy/nginx-dayoff-locations.conf'),
      'utf8',
    ),
  );
  let app: NestExpressApplication;
  let apiPaths: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DRIZZLE)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();

    const express = app.getHttpAdapter().getInstance() as {
      router?: { stack?: Array<{ route?: { path: string } }> };
    };
    const layers = express.router?.stack;
    if (!layers) {
      throw new Error(
        'Express 라우터 구조가 바뀌어 등록된 경로 목록을 읽지 못했습니다. 이 테스트의 경로 수집 방식을 갱신해 주세요.',
      );
    }
    apiPaths = [
      ...new Set(
        layers
          .map((layer) => layer.route?.path)
          .filter((path): path is string => !!path && path !== '/')
          // `:id` 같은 경로 변수는 실제 요청처럼 값으로 바꿔 확인한다.
          .map((path) => path.replace(/:[A-Za-z]+/g, 'sample-value')),
      ),
    ].sort();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('설정 파일에서 location 블록을 읽어 온다', () => {
    expect(locations.length).toBeGreaterThanOrEqual(5);
    expect(apiPaths).toEqual(
      expect.arrayContaining([
        '/coupons',
        '/coupons/sample-value/issue',
        '/shop/admin/orders/pending',
        '/shop/checkout/naver/confirm',
        '/auth/addresses/sample-value',
      ]),
    );
  });

  it('서버의 모든 API 경로가 리다이렉트 없이 백엔드로 전달된다', () => {
    const notProxied = apiPaths
      .map((path) => ({ path, target: resolve(locations, path) }))
      .filter(({ target }) => target !== 'api');

    expect(notProxied).toEqual([]);
  });

  it('프론트 화면 주소는 백엔드로 넘기지 않는다', () => {
    const pagePaths = [
      '/',
      '/shop',
      '/shop/sand-mug',
      '/shop/admin/new',
      '/shop/admin/edit/sample-value',
      '/cart',
      '/checkout',
      '/checkout/success',
      '/account',
      '/login',
      '/admin',
    ];

    for (const path of pagePaths) {
      expect({ path, target: resolve(locations, path) }).toEqual({
        path,
        target: 'static',
      });
    }
  });
});
