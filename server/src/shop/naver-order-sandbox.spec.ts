import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ValidationPipe,
  INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { NaverOrderSandboxController } from './naver-order-sandbox.controller';
import { NaverOrderClient } from './naver-order.client';
import { DRIZZLE } from '../common/database/database.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Real HTTP routing, validation and RolesGuard; authentication identity is stubbed.
describe('Admin sandbox checkout isolation', () => {
  let app: INestApplication;
  let config: ConfigService;
  const original = global.fetch;
  let remote: jest.Mock;
  let db: any;
  const productId = '11111111-1111-4111-8111-111111111111';
  const path = '/shop/admin/naver-order/sandbox';
  const order = { source: 'product', items: [{ productId, quantity: 1 }] };
  beforeEach(async () => {
    config = new ConfigService({
      NAVER_ORDER_API_MODE: 'sandbox',
      NAVER_ORDER_INVENTORY_ENABLED: 'false',
      NAVER_ORDER_MODE: 'production',
      NAVER_ORDER_ENABLED: 'true',
      NAVER_ORDER_AUDIENCE: 'public',
      NAVER_ORDER_PRODUCTION_READY: 'true',
      NAVER_ORDER_MERCHANT_ID: 'merchant',
      NAVER_ORDER_CERTI_KEY: 'private-cert',
      NAVER_ORDER_BUTTON_KEY: 'button',
      NAVER_ORDER_ACCOUNT_ID: 'account',
      FRONTEND_URL: 'https://dayoff.today',
      NAVER_ORDER_API_CLIENT_ID: 'test-app',
      NAVER_ORDER_API_CLIENT_SECRET: '$2a$04$abcdefghijklmnopqrstuu',
    });
    db = {
      query: {
        products: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: productId,
              name: 'Test',
              slug: 'test-product',
              isActive: true,
              stockQuantity: 2,
              price: 10000,
              options: [],
              images: [{ url: '/image.jpg' }],
            },
          ]),
        },
      },
      update: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
    };
    remote = jest.fn();
    global.fetch = remote;
    const module = await Test.createTestingModule({
      controllers: [NaverOrderSandboxController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: DRIZZLE, useValue: db },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(ctx: any) {
          const req = ctx.switchToHttp().getRequest();
          if (!req.headers['x-test-role']) throw new UnauthorizedException();
          req.user = { role: req.headers['x-test-role'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    global.fetch = original;
    await app.close();
  });
  it('rejects guests and ordinary members on every endpoint', async () => {
    for (const endpoint of ['', '/register', '/traces']) {
      for (const role of ['', 'user']) {
        const req = endpoint
          ? request(app.getHttpServer()).post(path + endpoint)
          : request(app.getHttpServer()).get(path);
        if (role) req.set('x-test-role', role);
        await req
          .send(endpoint === '/register' ? order : {})
          .expect(role ? 403 : 401);
      }
    }
    expect(remote).not.toHaveBeenCalled();
    expect(db.query.products.findMany).not.toHaveBeenCalled();
  });
  it('creates only test orders with server pricing, leaving public config and stock untouched', async () => {
    remote.mockResolvedValue(new Response('SUCCESS:test-key:12345'));
    const prod = new NaverOrderClient(config).publicConfig();
    const res = await request(app.getHttpServer())
      .post(path + '/register')
      .set('x-test-role', 'admin')
      .send(order)
      .expect(200);
    expect(res.body.desktopUrl).toBe(
      'https://test-order.pay.naver.com/customer/buy/test-key/12345',
    );
    expect(res.body.mobileUrl).toBe(
      'https://test-m.pay.naver.com/o/customer/buy/test-key/12345',
    );
    expect(remote.mock.calls[0][0]).toBe(
      'https://test-api.pay.naver.com/o/customer/api/order/v20/register',
    );
    expect(remote.mock.calls[0][1].body).toContain(
      '<basePrice>10000</basePrice>',
    );
    expect(new NaverOrderClient(config).publicConfig()).toEqual(prod);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(res.text).not.toContain('private-cert');
  });
  it.each([
    ['NAVER_ORDER_API_MODE', 'production'],
    ['NAVER_ORDER_API_MODE', ''],
    ['NAVER_ORDER_INVENTORY_ENABLED', 'true'],
  ])('fails closed for %s=%s', async (key, value) => {
    config.set(key, value);
    await request(app.getHttpServer())
      .post(path + '/register')
      .set('x-test-role', 'admin')
      .send(order)
      .expect(503);
    await request(app.getHttpServer())
      .post(path + '/traces')
      .set('x-test-role', 'admin')
      .expect(503);
    expect(remote).not.toHaveBeenCalled();
  });
  it('rejects tampered price and invalid quantity before registration', async () => {
    for (const body of [
      { ...order, price: 1 },
      { items: [{ productId, quantity: 0 }] },
      { items: [{ productId, quantity: 3 }] },
    ])
      await request(app.getHttpServer())
        .post(path + '/register')
        .set('x-test-role', 'admin')
        .send(body)
        .expect(400);
    expect(remote).not.toHaveBeenCalled();
  });
  const json = (value: unknown, trace: string) =>
    new Response(JSON.stringify(value), {
      headers: { 'GNCP-GW-Trace-ID': trace },
    });
  it('returns actual gateway traces after both successful calls without exposing customer data', async () => {
    remote
      .mockResolvedValueOnce(
        json(
          { access_token: 'private-token', expires_in: 3600 },
          'token-trace',
        ),
      )
      .mockResolvedValueOnce(
        json(
          {
            data: {
              count: 1,
              lastChangeStatuses: [
                {
                  productOrderId: 'po1',
                  lastChangedDate: new Date().toISOString(),
                },
              ],
            },
          },
          'changes-trace',
        ),
      )
      .mockResolvedValueOnce(
        json(
          {
            data: [
              {
                productOrder: { productOrderId: 'po1' },
                order: { buyerName: 'PRIVATE_NAME' },
              },
            ],
          },
          'details-trace',
        ),
      );
    const res = await request(app.getHttpServer())
      .post(path + '/traces')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(res.body).toMatchObject({
      changesTraceId: 'changes-trace',
      detailsTraceId: 'details-trace',
      detailsRead: 1,
      inventoryModified: false,
    });
    expect(res.text).not.toMatch(/PRIVATE_NAME|private-token|token-trace/);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('does not fabricate a detail trace for an empty sandbox', async () => {
    remote
      .mockResolvedValueOnce(
        json({ access_token: 'token', expires_in: 3600 }, 'token-trace'),
      )
      .mockResolvedValueOnce(
        json({ data: { count: 0, lastChangeStatuses: [] } }, 'changes-trace'),
      );
    const res = await request(app.getHttpServer())
      .post(path + '/traces')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(res.body).toMatchObject({ detailsRead: 0, detailsTraceId: null });
    expect(remote).toHaveBeenCalledTimes(2);
  });
});
