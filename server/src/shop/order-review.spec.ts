import { NaverCouponCheckoutService } from './naver-coupon-checkout.service';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import request from 'supertest';
import { OrderReviewController } from './order-review.controller';
import { OrderReviewService } from './order-review.service';
import { NaverOrderSessionGuard } from './naver-order-session.guard';
import { CouponService } from '../coupon/coupon.service';
import { EmailService } from '../common/email/email.service';
import { DRIZZLE } from '../common/database/database.module';

const productId = '11111111-1111-4111-8111-111111111111';
const optionA = '22222222-2222-4222-8222-222222222222';
const optionB = '22222222-2222-4222-8222-222222222223';
const couponId = (n: number) =>
  `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;
const ownId = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const dialect = new PgDialect();
function coupon(n: number, value: number, type: 'fixed' | 'percent' = 'fixed') {
  return {
    id: couponId(n),
    code: `BENEFIT${n}`,
    discountType: type,
    discountValue: value,
    minOrderAmount: null as number | null,
    validFrom: new Date(Date.now() - 86400000),
    validUntil: new Date(Date.now() + 86400000),
    usageLimit: null as number | null,
    usedCount: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
const body = (quantity = 1) => ({
  items: [{ productId, quantity, optionId: optionA }],
  source: 'product',
});

describe('read-only order review and issued coupons', () => {
  let app: INestApplication, config: ConfigService;
  let catalog: any[], coupons: ReturnType<typeof coupon>[], owned: any[];
  let db: any;
  beforeEach(async () => {
    catalog = [
      {
        id: productId,
        name: '오벌 접시',
        slug: 'oval',
        price: 31850,
        stockQuantity: 10,
        isActive: true,
        images: [{ url: '/plate.jpg' }],
        options: [
          { id: optionA, name: 'color', value: 'White' },
          { id: optionB, name: 'color', value: 'Gray' },
        ],
      },
    ];
    coupons = [coupon(1, 10, 'percent'), coupon(2, 5000)];
    owned = coupons.map((c) => ({
      id: ownId(c.id === couponId(1) ? 1 : 2),
      userId: 'member',
      couponId: c.id,
      coupon: c,
      usedAt: null,
    }));
    db = {
      select: () => ({ from: () => ({ where: async () => [] }) }),
      insert: jest.fn(() => {
        throw new Error('preview must not write');
      }),
      update: jest.fn(),
      delete: jest.fn(),
      query: {
        products: { findMany: jest.fn(async () => catalog) },
        coupons: {
          findFirst: jest.fn(async ({ where }: any) => {
            const { params } = dialect.sqlToQuery(where);
            return coupons.find(
              (c) => c.code.toLowerCase() === String(params[0]).toLowerCase(),
            );
          }),
        },
        userCoupons: {
          findMany: jest.fn(async ({ where }: any) => {
            const { sql, params } = dialect.sqlToQuery(where);
            return owned.filter(
              (c) =>
                c.userId === params[0] &&
                (params.length < 2 || c.couponId === params[1]) &&
                (!sql.includes('is null') || !c.usedAt),
            );
          }),
        },
      },
    };
    config = new ConfigService({ ORDER_REVIEW_PREVIEW_ENABLED: 'true' });
    const module = await Test.createTestingModule({
      controllers: [OrderReviewController],
      providers: [
        {
          provide: NaverCouponCheckoutService,
          useValue: {
            enabled: () => false,
            productPricing: async () => undefined,
            pending: async () => [],
          },
        },
        OrderReviewService,
        CouponService,
        { provide: ConfigService, useValue: config },
        { provide: DRIZZLE, useValue: db },
        { provide: EmailService, useValue: {} },
      ],
    })
      .overrideGuard(NaverOrderSessionGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          if (req.headers['x-test-user'])
            req.user = { id: req.headers['x-test-user'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
    await app.close();
  });
  const post = (app: INestApplication, data: unknown, member = 'member') => {
    const req = request(app.getHttpServer()).post('/shop/order-review');
    return (member ? req.set('x-test-user', member) : req).send(data);
  };
  it('uses the current server sale price and automatically chooses the best owned coupon', async () => {
    const res = await post(app, body()).expect(200);
    expect(res.body).toMatchObject({
      subtotal: 31850,
      discountAmount: 5000,
      discountedSubtotal: 26850,
      shippingFee: 4000,
      total: 30850,
      selectedUserCouponId: ownId(2),
      paymentEnabled: false,
      previewOnly: true,
    });
  });
  it('allocates rounded discounts once so selection and payable amount agree', async () => {
    catalog[0].price = 433;
    const otherId = '11111111-1111-4111-8111-111111111112';
    catalog.push({ ...catalog[0], id: otherId, price: 228, options: [] });
    coupons[1].discountValue = 1910;
    const res = await post(app, {
      items: [
        { productId, optionId: optionA, quantity: 2 },
        { productId: otherId, quantity: 5 },
      ],
      source: 'cart',
      userCouponId: ownId(2),
    }).expect(200);
    expect(res.body.discountAmount).toBe(1909);
    expect(
      res.body.coupons.find((c: any) => c.userCouponId === ownId(2))
        .discountAmount,
    ).toBe(1909);
    expect(
      res.body.items.reduce(
        (n: number, i: any) => n + i.discountedUnitPrice * i.quantity,
        0,
      ),
    ).toBe(res.body.discountedSubtotal);
  });
  it('recalculates a percentage coupon for the current quantity', async () => {
    const res = await post(app, { ...body(2), userCouponId: ownId(1) }).expect(
      200,
    );
    expect(res.body.discountAmount).toBe(6370);
    expect(res.body.total).toBe(61330);
  });
  it('supports opting out and applies the free shipping threshold after discounts', async () => {
    expect(
      (await post(app, { ...body(4), useCoupon: false }).expect(200)).body
        .shippingFee,
    ).toBe(0);
    coupons[1].discountValue = 30000;
    const res = await post(app, body(4)).expect(200);
    expect(res.body.shippingFee).toBe(4000);
  });
  it('keeps guests at the normal selling price and requires login to select a coupon', async () => {
    const res = await post(app, body(), '').expect(200);
    expect(res.body.coupons).toEqual([]);
    expect(res.body.discountAmount).toBe(0);
    await post(app, { ...body(), userCouponId: ownId(1) }, '').expect(401);
  });
  it('does not expose or apply another member coupon', async () => {
    const res = await post(app, body(), 'other-member').expect(200);
    expect(res.body.coupons).toEqual([]);
    await post(
      app,
      { ...body(), userCouponId: ownId(1) },
      'other-member',
    ).expect(400);
  });
  it('excludes expired, exhausted and used coupons without consuming anything', async () => {
    coupons[0].validUntil = new Date(Date.now() - 1000);
    coupons[1].usageLimit = 1;
    coupons[1].usedCount = 1;
    const res = await post(app, body()).expect(200);
    expect(res.body.discountAmount).toBe(0);
    expect(res.body.coupons.every((c: any) => c.reason)).toBe(true);
    owned[0].usedAt = new Date();
    expect((await post(app, body()).expect(200)).body.coupons).toHaveLength(1);
  });
  it('does not apply coupons below their minimum order amount', async () => {
    coupons.forEach((c) => (c.minOrderAmount = 50000));
    expect((await post(app, body()).expect(200)).body.discountAmount).toBe(0);
    expect((await post(app, body(2)).expect(200)).body.discountAmount).toBe(
      6370,
    );
  });
  it('rejects client prices, discounts, identities, invalid quantities and empty baskets', async () => {
    for (const data of [
      { ...body(), subtotal: 1 },
      { ...body(), discountAmount: 99999 },
      { ...body(), userId: 'other-member' },
      body(0),
      body(1.5),
      { items: [] },
    ])
      await post(app, data).expect(400);
  });
  it('validates options and shared stock across selected options', async () => {
    await post(app, { items: [{ productId, quantity: 1 }] }).expect(400);
    await post(app, {
      items: [
        { productId, optionId: optionA, quantity: 6 },
        { productId, optionId: optionB, quantity: 6 },
      ],
    }).expect(400);
    await post(app, { items: [body().items[0], body().items[0]] }).expect(400);
    catalog[0].isActive = false;
    await post(app, body()).expect(400);
  });
  it('is unavailable unless explicitly enabled and never creates an order', async () => {
    config.set('ORDER_REVIEW_PREVIEW_ENABLED', 'false');
    await post(app, body()).expect(404);
  });
});
