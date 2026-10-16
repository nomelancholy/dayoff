import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NaverOrderClient } from './naver-order.client';
import {
  NaverOrderService,
  payProductId,
  databaseProductId,
} from './naver-order.service';
import { NaverOrderController } from './naver-order.controller';
import { DRIZZLE } from '../common/database/database.module';

const id = '10b821e3-bbe5-4485-a1fe-dd7b15831e2a';
const jwt = new JwtService({ secret: 'local-test-signing-key' });
const reviewAuth = `Bearer ${jwt.sign({ sub: 'review-user' })}`;
const optionId = 'a3a4c75c-cc5d-40da-9ef5-75d715aee70e';
const configValues = {
  NAVER_ORDER_ENABLED: 'true',
  NAVER_ORDER_MODE: 'test',
  NAVER_ORDER_AUDIENCE: 'review',
  NAVER_ORDER_REVIEW_USER_IDS: 'review-user',
  JWT_SECRET: 'local-test-signing-key',
  FRONTEND_URL: 'https://dayoff.today',
  NAVER_ORDER_MERCHANT_ID: 'np_test',
  NAVER_ORDER_CERTI_KEY: 'secret-never-public',
  NAVER_ORDER_BUTTON_KEY: 'button',
  NAVER_ORDER_ACCOUNT_ID: 'account',
};
const product = () => ({
  id,
  name: '컵 < & >',
  slug: 'cup',
  price: 30000,
  stockQuantity: 3,
  isActive: true,
  images: [{ url: '/uploads/cup.jpg' }],
  options: [] as Array<{ id: string; name: string; value: string }>,
});

describe('주문형 2.1', () => {
  let app: INestApplication;
  let client: NaverOrderClient;
  let service: NaverOrderService;
  let config: ConfigService;
  let products: ReturnType<typeof product>[];
  let fetchMock: jest.SpyInstance;
  beforeEach(async () => {
    products = [product()];
    config = new ConfigService({ ...configValues });
    const module = await Test.createTestingModule({
      controllers: [NaverOrderController],
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: {
            findById: async (id: string) =>
              ['review-user', 'ordinary-user'].includes(id) ? { id } : null,
          },
        },
        NaverOrderClient,
        NaverOrderService,
        { provide: ConfigService, useValue: config },
        {
          provide: DRIZZLE,
          useValue: {
            query: { products: { findMany: jest.fn(async () => products) } },
          },
        },
      ],
    }).compile();
    client = module.get(NaverOrderClient);
    service = module.get(NaverOrderService);
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => new Response('SUCCESS:buyKey123:123456'));
  });
  afterEach(async () => {
    fetchMock.mockRestore();
    await app.close();
  });

  it('공개 설정은 가맹점 비밀키를 반환하지 않으며 운영은 기본 차단된다', async () => {
    const res = await request(app.getHttpServer())
      .get('/shop/naver-order/config')
      .set('Authorization', reviewAuth)
      .expect(200);
    expect(res.body.enabled).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(
      configValues.NAVER_ORDER_CERTI_KEY,
    );
    config.set('NAVER_ORDER_MODE', 'production');
    expect(client.publicConfig()).toEqual({ enabled: false });
    await request(app.getHttpServer())
      .post('/shop/naver-order/register')
      .set('Authorization', reviewAuth)
      .send({ items: [{ productId: id, quantity: 1 }] })
      .expect(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('검수 계정 주문: 서버 가격으로 XML 등록 후 주문서 키를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/shop/naver-order/register')
      .set('Authorization', reviewAuth)
      .send({ items: [{ productId: id, quantity: 2 }], naverInflowCode: '<x>' })
      .expect(200);
    expect(res.body).toEqual({ key: 'buyKey123', merchantNo: '123456' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://test-api.pay.naver.com/o/customer/api/order/v20/register',
    );
    expect(init.body).toContain('<basePrice>30000</basePrice>');
    expect(init.body).toContain('컵 &lt; &amp; &gt;');
    expect(init.body).toContain('<naverInflowCode>&lt;x&gt;</naverInflowCode>');
    expect(init.body).toContain('<quantity>2</quantity>');
  });
  it.each([
    { items: [{ productId: id, quantity: 1, price: 1 }] },
    { items: [{ productId: id, quantity: -1 }] },
    { items: [{ productId: id, quantity: 1.5 }] },
    { items: [{ productId: id, quantity: 1000 }] },
    { items: [{ productId: id, quantity: 1 }], couponCode: 'FORGED' },
    { items: [] },
    { items: [{ productId: id, quantity: 1 }], source: 'https://example.com' },
    { items: [{ productId: id, quantity: 1 }], backUrl: 'https://example.com' },
  ])(
    '가격·쿠폰 위조/잘못된 수량은 네이버 호출 전에 차단한다: %j',
    async (body) => {
      await request(app.getHttpServer())
        .post('/shop/naver-order/register')
        .set('Authorization', reviewAuth)
        .send(body)
        .expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it('옵션 미선택, 다른 상품 옵션, 중복 옵션과 합산 재고 초과를 차단한다', async () => {
    products[0].options = [
      { id: optionId, name: '색상', value: '화이트' },
      { id, name: '색상', value: '블랙' },
    ];
    for (const items of [
      [{ productId: id, quantity: 1 }],
      [{ productId: id, optionId: 'wrong', quantity: 1 }],
      [
        { productId: id, optionId, quantity: 1 },
        { productId: id, optionId, quantity: 1 },
      ],
      [
        { productId: id, optionId, quantity: 2 },
        { productId: id, optionId: id, quantity: 2 },
      ],
    ])
      await expect(service.register({ items })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await service.register({
      items: [{ productId: id, optionId, quantity: 2 }],
    });
    const xml = fetchMock.mock.calls[0][1].body as string;
    expect(xml).toContain('<selectedItem>');
    expect(xml).not.toContain('<manageCode>'); // 상품 전체 공유 재고 보존
    expect(xml).not.toContain('<single>');
  });
  it('품절·비활성·0원 상품을 거부한다', async () => {
    for (const patch of [
      { stockQuantity: 0 },
      { isActive: false },
      { price: 0 },
    ]) {
      products = [{ ...product(), ...patch }];
      await expect(
        service.register({ items: [{ productId: id, quantity: 1 }] }),
      ).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('상품 XML에 변경된 가격·공유 재고·옵션과 판매 상태를 반환한다', async () => {
    products[0].options = [{ id: optionId, name: '색상', value: '백색' }];
    const res = await request(app.getHttpServer())
      .get('/shop/naver-order/products')
      .query({ 'product[0][id]': payProductId(id), optionSearch: 'true' })
      .expect(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<stockQuantity>3</stockQuantity>');
    expect(res.text).toContain('<optionItem>');
    products[0].stockQuantity = 0;
    expect(
      await service.productInfo([{ id: payProductId(id) }], false),
    ).toContain('<status>SOLD_OUT</status>');
    products = [];
    expect(
      await service.productInfo([{ id: payProductId(id) }], false),
    ).toContain('<status>NOT_SALE</status>');
  });
  it('주문등록과 상품정보 XML은 동일한 네이버 권역별 추가배송비를 전달한다', async () => {
    await request(app.getHttpServer())
      .post('/shop/naver-order/register')
      .set('Authorization', reviewAuth)
      .send({ source: 'cart', items: [{ productId: id, quantity: 1 }] })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/shop/naver-order/products')
      .query({ 'product[0][id]': payProductId(id) })
      .expect(200);
    for (const xml of [fetchMock.mock.calls[0][1].body as string, res.text]) {
      expect(xml).toContain(
        '<surchargeByArea><apiSupport>false</apiSupport><splitUnit>2</splitUnit><area2Price>1000</area2Price></surchargeByArea>',
      );
      expect(xml).toContain('<feePrice>4000</feePrice>');
      expect(xml).toContain(
        '<conditionalFree><basePrice>100000</basePrice></conditionalFree>',
      );
      expect(xml).not.toContain('<apiSupport>true</apiSupport>');
    }
    await request(app.getHttpServer())
      .get('/shop/naver-order/shipping-fees')
      .query({ 'productId[0]': payProductId(id), zipcode: '63000' })
      .expect(404);
  });
  it('상품 번호는 원래 UUID로 복원하며 잘못된 번호를 거부한다', () => {
    expect(databaseProductId(payProductId(id))).toBe(id);
    expect(() => databaseProductId('invalid')).toThrow();
  });
  it.each([
    ['product', 'https://dayoff.today/shop/cup'],
    ['cart', 'https://dayoff.today/cart'],
  ])(
    '출발 화면 %s에 맞는 복귀 주소를 네이버에 전달한다',
    async (source, expected) => {
      await request(app.getHttpServer())
        .post('/shop/naver-order/register')
        .set('Authorization', reviewAuth)
        .send({ items: [{ productId: id, quantity: 1 }], source })
        .expect(200);
      expect(fetchMock.mock.calls[0][1].body).toContain(
        `<backUrl>${expected}</backUrl>`,
      );
    },
  );
  it('상품 상세에서 서로 다른 상품을 함께 주문하는 요청은 거부한다', async () => {
    products.push({ ...product(), id: optionId, slug: 'second' });
    await request(app.getHttpServer())
      .post('/shop/naver-order/register')
      .set('Authorization', reviewAuth)
      .send({
        source: 'product',
        items: [
          { productId: id, quantity: 1 },
          { productId: optionId, quantity: 1 },
        ],
      })
      .expect(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('비회원·일반 회원·위조/만료 토큰은 버튼 설정과 직접 주문등록 모두 차단한다', async () => {
    const denied = [
      '',
      `Bearer ${jwt.sign({ sub: 'ordinary-user' })}`,
      `Bearer ${jwt.sign({ sub: 'deleted-user' })}`,
      `Bearer ${new JwtService({ secret: 'wrong-secret' }).sign({ sub: 'review-user' })}`,
      `Bearer ${jwt.sign({ sub: 'review-user' }, { expiresIn: -1 })}`,
    ];
    for (const authorization of denied) {
      const res = await request(app.getHttpServer())
        .get('/shop/naver-order/config')
        .set('Authorization', authorization)
        .expect(200);
      expect(res.body).toEqual({ enabled: false });
      await request(app.getHttpServer())
        .post('/shop/naver-order/register')
        .set('Authorization', authorization)
        .send({ items: [{ productId: id, quantity: 1 }] })
        .expect(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('검수 계정 제한은 전체 상품에 적용되며 XML 콜백은 로그인 없이 조회된다', async () => {
    const secondId = 'a3a4c75c-cc5d-40da-9ef5-75d715aee70e';
    products.push({ ...product(), id: secondId, slug: 'second' });
    for (const productId of [id, secondId]) {
      await request(app.getHttpServer())
        .post('/shop/naver-order/register')
        .set('Authorization', reviewAuth)
        .send({ items: [{ productId, quantity: 1 }] })
        .expect(200);
      const res = await request(app.getHttpServer())
        .get('/shop/naver-order/products')
        .query({ 'product[0][id]': payProductId(productId) })
        .expect(200);
      expect(res.text).toContain('<status>ON_SALE</status>');
    }
  });

  it('허용 계정 제거/설정 누락은 즉시 차단, 공개 구매는 운영 승인 후만 가능하다', async () => {
    config.set('NAVER_ORDER_REVIEW_USER_IDS', '');
    expect(client.publicConfig('review-user')).toEqual({ enabled: false });
    config.set('NAVER_ORDER_AUDIENCE', 'public');
    expect(client.publicConfig()).toEqual({ enabled: false });
    config.set('NAVER_ORDER_MODE', 'production');
    expect(client.publicConfig()).toEqual({ enabled: false });
    config.set('NAVER_ORDER_PRODUCTION_READY', 'true');
    expect(client.publicConfig().enabled).toBe(true);
    config.set('NAVER_ORDER_AUDIENCE', 'typo');
    expect(client.publicConfig('review-user')).toEqual({ enabled: false });
  });

  it('실제 테스트 API의 22자 주문서 키를 허용하고 잘못된 응답은 차단한다', async () => {
    const key = 'Ab_9-C'.repeat(3) + 'X_y-';
    fetchMock.mockResolvedValue(new Response(`SUCCESS:${key}:123456789`));
    await expect(client.register('<order/>')).resolves.toEqual({
      key,
      merchantNo: '123456789',
    });
    for (const invalid of [
      `SUCCESS:${'A'.repeat(129)}:123`,
      'SUCCESS:abc/def:123',
      'SUCCESS:abc:123:unexpected',
      'SUCCESS::123',
    ]) {
      fetchMock.mockResolvedValue(new Response(invalid));
      await expect(client.register('<order/>')).rejects.toThrow(
        '주문서를 만들지 못했습니다',
      );
    }
  });

  it('네이버 오류 원문·인증키를 노출하지 않고 실패한다', async () => {
    fetchMock.mockResolvedValue(
      new Response(`FAIL:secret-never-public`, { status: 400 }),
    );
    const res = await request(app.getHttpServer())
      .post('/shop/naver-order/register')
      .set('Authorization', reviewAuth)
      .send({ items: [{ productId: id, quantity: 1 }] })
      .expect(502);
    expect(JSON.stringify(res.body)).not.toContain('secret-never-public');
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(client.register('<order/>')).rejects.toThrow(
      '연결하지 못했습니다',
    );
  });
});
