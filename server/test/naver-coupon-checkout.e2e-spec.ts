import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import {
  createE2eContext,
  E2E_DATABASE_URL,
  E2eContext,
} from './support/e2e-app';
import * as schema from '../src/db/schema';
import { NaverOrderClient } from '../src/shop/naver-order.client';
import { NaverOrderApiClient } from '../src/shop/naver-order-api.client';
import { NaverOrderSyncService } from '../src/shop/naver-order-sync.service';
import { OrderReviewController } from '../src/shop/order-review.controller';
import { payProductId } from '../src/shop/naver-order.service';

(E2E_DATABASE_URL ? describe : describe.skip)(
  'Npay coupon checkout with PostgreSQL',
  () => {
    let ctx: E2eContext,
      cfg: ConfigService,
      api: NaverOrderApiClient,
      sync: NaverOrderSyncService,
      register: jest.SpyInstance;
    let user: any,
      product: any,
      coupon: any,
      owned: any,
      xml: string,
      details: any[],
      changeIds: string[];
    beforeAll(async () => {
      ctx = await createE2eContext();
      cfg = ctx.app.get(ConfigService);
      api = ctx.app.get(NaverOrderApiClient);
      sync = ctx.app.get(NaverOrderSyncService);
      register = jest.spyOn(ctx.app.get(NaverOrderClient), 'register');
      jest
        .spyOn(api, 'changes')
        .mockImplementation(async () => ({
          count: changeIds.length,
          lastChangeStatuses: changeIds.map((productOrderId) => ({
            productOrderId,
            lastChangedDate: new Date(Date.now() - 60000).toISOString(),
          })),
        }));
      jest
        .spyOn(api, 'details')
        .mockImplementation(async (ids) =>
          details.filter((d) => ids.includes(d.productOrder.productOrderId)),
        );
      jest
        .spyOn(api, 'productOrderIds')
        .mockImplementation(async () =>
          details.map((d) => d.productOrder.productOrderId),
        );
    });
    afterAll(async () => {
      await ctx?.close();
    });
    beforeEach(async () => {
      (ctx.app.get(OrderReviewController) as any).attempts.clear();
      await ctx.resetDatabase();
      await ctx.db.execute(
        sql`truncate naver_order_sync_state,naver_order_inventory`,
      );
      for (const [k, v] of Object.entries({
        NAVER_COUPON_CHECKOUT_ENABLED: 'true',
        NAVER_ORDER_ENABLED: 'true',
        NAVER_ORDER_MODE: 'production',
        NAVER_ORDER_AUDIENCE: 'public',
        NAVER_ORDER_PRODUCTION_READY: 'true',
        NAVER_ORDER_MERCHANT_ID: 'np_test',
        NAVER_ORDER_CERTI_KEY: 'test',
        NAVER_ORDER_BUTTON_KEY: 'test',
        NAVER_ORDER_ACCOUNT_ID: 'test',
        FRONTEND_URL: 'https://shop.example.com',
        NAVER_ORDER_API_MODE: 'production',
        NAVER_ORDER_API_CLIENT_ID: 'test-app',
        NAVER_ORDER_SYNC_ENABLED: 'true',
        NAVER_ORDER_INVENTORY_ENABLED: 'true',
        NAVER_ORDER_SYNC_START_AT: new Date(Date.now() - 180000).toISOString(),
      }))
        cfg.set(k, v);
      details = [];
      changeIds = [];
      await sync.run();
      user = await ctx.createUser();
      product = await ctx.createProduct(
        { price: 31850, stockQuantity: 10 },
        { images: ['https://shop.example.com/plate.jpg'] },
      );
      [coupon] = await ctx.db
        .insert(schema.coupons)
        .values({
          code: 'MEMBER3000',
          discountType: 'fixed',
          discountValue: 3000,
          validFrom: new Date(Date.now() - 86400000),
          validUntil: new Date(Date.now() + 86400000),
          usageLimit: 10,
        })
        .returning();
      [owned] = await ctx.db
        .insert(schema.userCoupons)
        .values({ userId: user.id, couponId: coupon.id })
        .returning();
      xml = '';
      register.mockReset().mockImplementation(async (body) => {
        xml = body;
        return { key: 'test-buy-key', merchantNo: '1234' };
      });
    });
    const draft = () => ({
      items: [{ productId: product.id, quantity: 1 }],
      source: 'product',
    });
    const request = () => ({
      ...draft(),
      userCouponId: owned.id,
      useCoupon: true,
      requestId: randomUUID(),
      expectedTotal: 32850,
    });
    const submit = (body = request(), auth = user.auth) =>
      ctx.http().post('/shop/order-review/register').set(auth).send(body);
    const record = async () =>
      (await ctx.db.select().from(schema.naverCouponCheckouts))[0];
    const couponRow = async () =>
      (
        await ctx.db
          .select()
          .from(schema.coupons)
          .where(eq(schema.coupons.id, coupon.id))
      )[0];
    const ownedRow = async () =>
      (
        await ctx.db
          .select()
          .from(schema.userCoupons)
          .where(eq(schema.userCoupons.id, owned.id))
      )[0];
    async function provider(status = 'PAYED', quantity = 1) {
      const row = await record();
      details = [
        {
          order: {
            orderId: 'order1',
            paymentDate:
              status === 'PAYMENT_WAITING' || status === 'CANCELED_BY_NOPAYMENT'
                ? undefined
                : new Date(Date.now() - 120000).toISOString(),
          },
          productOrder: {
            mallId: 'np_test',
            productOrderId: 'po1',
            productId: payProductId(product.id),
            orderIntegrationVersion: 'V21',
            productOrderStatus: status,
            initialQuantity: quantity,
            remainQuantity: status.startsWith('CANCELED') ? 0 : quantity,
            unitPrice: 28850,
            sellerInternalCode1: 'dc1_' + row.id,
            sellerInternalCode2: row.token,
          },
          completedClaims: [],
        },
      ];
      changeIds = ['po1'];
    }
    it('previews best owned coupon and registers matching XML without redeeming', async () => {
      const preview = await ctx
        .http()
        .post('/shop/order-review')
        .set(user.auth)
        .send(draft())
        .expect(200);
      expect(preview.body).toMatchObject({
        discountAmount: 3000,
        total: 32850,
        paymentEnabled: true,
      });
      await submit().expect(200);
      expect(xml).toContain('<basePrice>28850</basePrice>');
      const row = await record();
      expect(xml).toContain(
        '<merchantCustomCode1>dc1_' + row.id + '</merchantCustomCode1>',
      );
      await ctx.db
        .update(schema.products)
        .set({ price: 35000 })
        .where(eq(schema.products.id, product.id));
      const info = await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: row.token,
        })
        .expect(200);
      expect(info.text).toContain('<basePrice>28850</basePrice>');
      expect(info.text).toContain('<stockQuantity>1</stockQuantity>');
      expect((await ownedRow()).usedAt).toBeNull();
      expect((await couponRow()).usedCount).toBe(0);
    });
    it('same request or same coupon/cart reuses one provider order', async () => {
      const body = request();
      await submit(body).expect(200);
      await submit(body).expect(200);
      await submit({ ...body, requestId: randomUUID() }).expect(200);
      expect(register).toHaveBeenCalledTimes(1);
      expect(
        await ctx.db.select().from(schema.naverCouponCheckouts),
      ).toHaveLength(1);
      await submit({
        ...body,
        expectedTotal: 1,
        items: [{ productId: product.id, quantity: 2 }],
      }).expect(409);
    });
    it('concurrent clicks cannot create two discounted provider orders', async () => {
      const result = await Promise.all([submit(request()), submit(request())]);
      expect(
        result.filter((r) => r.status === 200).length,
      ).toBeGreaterThanOrEqual(1);
      expect(result.every((r) => [200, 409].includes(r.status))).toBe(true);
      expect(register).toHaveBeenCalledTimes(1);
    });
    it('blocks guests, other owners and price tampering', async () => {
      await ctx
        .http()
        .post('/shop/order-review/register')
        .send(request())
        .expect(401);
      const stranger = await ctx.createUser();
      await submit(request(), stranger.auth).expect(400);
      await submit({ ...request(), expectedTotal: 1 }).expect(409);
      expect(register).not.toHaveBeenCalled();
    });
    it('failed provider registration invalidates the quote and releases the hold', async () => {
      register.mockRejectedValueOnce(new Error('provider failure'));
      await submit().expect(500);
      const row = await record();
      expect(row.state).toBe('failed');
      expect(row.releasedAt).not.toBeNull();
      const info = await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: row.token,
        })
        .expect(200);
      expect(info.text).toContain('<stockQuantity>0</stockQuantity>');
      await submit().expect(200);
    });
    it('only the owner may resume or release an unvalidated checkout', async () => {
      const body = request();
      await submit(body).expect(200);
      const row = await record();
      const stranger = await ctx.createUser();
      await ctx
        .http()
        .post('/shop/order-review/' + row.id + '/resume')
        .set(stranger.auth)
        .expect(409);
      await ctx
        .http()
        .post('/shop/order-review/' + row.id + '/resume')
        .expect(401);
      await ctx
        .http()
        .post('/shop/order-review/' + row.id + '/resume')
        .set(user.auth)
        .expect(200);
      await ctx
        .http()
        .post('/shop/order-review/' + row.id + '/release')
        .set(user.auth)
        .expect(200);
      expect((await record()).releasedAt).not.toBeNull();
      const retry = await submit(body).expect(409);
      expect(retry.body.code).toBe('CHECKOUT_ATTEMPT_CLOSED');
      await submit().expect(200);
    });
    it('does not release a checkout after provider XML validation', async () => {
      await submit().expect(200);
      const row = await record();
      await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: row.token,
        })
        .expect(200);
      await ctx
        .http()
        .post('/shop/order-review/' + row.id + '/release')
        .set(user.auth)
        .expect(409);
      await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + '-'.repeat(36),
          merchantCustomCode2: row.token,
        })
        .expect(400);
      expect((await record()).releasedAt).toBeNull();
    });
    it('payment consumes once and full cancellation restores once without extending validity', async () => {
      await submit().expect(200);
      await provider();
      await sync.run();
      await sync.run();
      expect((await couponRow()).usedCount).toBe(1);
      expect((await ownedRow()).usedAt).not.toBeNull();
      const row = await record();
      const blocked = await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: row.token,
        })
        .expect(200);
      expect(blocked.text).toContain('<stockQuantity>0</stockQuantity>');
      const expired = new Date(Date.now() - 1000);
      await ctx.db
        .update(schema.coupons)
        .set({ validUntil: expired })
        .where(eq(schema.coupons.id, coupon.id));
      details[0].productOrder.productOrderStatus = 'CANCELED';
      details[0].productOrder.remainQuantity = 0;
      await sync.run();
      await sync.run();
      expect((await couponRow()).usedCount).toBe(0);
      expect((await ownedRow()).usedAt).toBeNull();
      expect((await couponRow()).validUntil.getTime()).toBe(expired.getTime());
      expect((await record()).state).toBe('cancelled');
    });
    it('cancel request and partial cancellation never restore the full coupon', async () => {
      await submit({
        ...request(),
        items: [{ productId: product.id, quantity: 2 }],
        expectedTotal: 64700,
      }).expect(200);
      await provider('PAYED', 2);
      details[0].productOrder.unitPrice = 30350;
      await sync.run();
      details[0].productOrder.claimType = 'CANCEL';
      await sync.run();
      expect((await couponRow()).usedCount).toBe(1);
      details[0].completedClaims = [
        {
          claimId: 'c1',
          claimType: 'CANCEL',
          claimStatus: 'CANCEL_DONE',
          requestQuantity: 1,
        },
      ];
      details[0].productOrder.remainQuantity = 1;
      await sync.run();
      expect((await ownedRow()).usedAt).not.toBeNull();
      details[0].productOrder.productOrderStatus = 'CANCELED';
      details[0].productOrder.remainQuantity = 0;
      await sync.run();
      expect((await ownedRow()).usedAt).toBeNull();
    });
    it('payment waiting keeps the hold and provider expiry releases it', async () => {
      await submit().expect(200);
      await provider('PAYMENT_WAITING');
      await sync.run();
      expect((await record()).state).toBe('pending');
      expect((await ownedRow()).usedAt).toBeNull();
      await submit().expect(409);
      details[0].productOrder.productOrderStatus = 'CANCELED_BY_NOPAYMENT';
      details[0].productOrder.remainQuantity = 0;
      await sync.run();
      expect((await record()).releasedAt).not.toBeNull();
      expect((await couponRow()).usedCount).toBe(0);
    });
    it('unknown token fails closed and product stock remains authoritative', async () => {
      await submit().expect(200);
      const row = await record();
      await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: 'wrong',
        })
        .expect(400);
      await ctx.db
        .update(schema.products)
        .set({ stockQuantity: 0 })
        .where(eq(schema.products.id, product.id));
      const r = await ctx
        .http()
        .get('/shop/naver-order/products')
        .query({
          'product[0][id]': payProductId(product.id),
          merchantCustomCode1: 'dc1_' + row.id,
          merchantCustomCode2: row.token,
        })
        .expect(200);
      expect(r.text).toContain('SOLD_OUT');
      expect(r.text).toContain('<stockQuantity>0</stockQuantity>');
    });
    it('a changed provider quantity or price requires review, never silently restores', async () => {
      await submit().expect(200);
      await provider();
      details[0].productOrder.unitPrice = 1;
      await sync.run();
      expect((await record()).state).toBe('review');
      expect((await record()).releasedAt).toBeNull();
      expect((await ownedRow()).usedAt).toBeNull();
    });
    it('waits for every item in a multi-product order before restoring', async () => {
      const other = await ctx.createProduct(
        { price: 10000, stockQuantity: 5 },
        { images: ['https://shop.example.com/other.jpg'] },
      );
      const body = {
        ...request(),
        source: 'cart',
        items: [
          { productId: product.id, quantity: 1 },
          { productId: other.id, quantity: 1 },
        ],
        expectedTotal: 42850,
      };
      await submit(body).expect(200);
      await provider();
      const row = await record();
      details[0].productOrder.unitPrice = row.items.find(
        (i) => i.productId === product.id,
      )!.discountedUnitPrice;
      details.push({
        ...details[0],
        productOrder: {
          ...details[0].productOrder,
          productOrderId: 'po2',
          productId: payProductId(other.id),
          unitPrice: row.items.find((i) => i.productId === other.id)!
            .discountedUnitPrice,
        },
      });
      changeIds = ['po1'];
      await sync.run();
      expect((await couponRow()).usedCount).toBe(1);
      details[0].productOrder.productOrderStatus = 'CANCELED';
      details[0].productOrder.remainQuantity = 0;
      await sync.run();
      expect((await record()).releasedAt).toBeNull();
      details[1].productOrder.productOrderStatus = 'CANCELED';
      details[1].productOrder.remainQuantity = 0;
      await sync.run();
      await sync.run();
      expect((await record()).state).toBe('cancelled');
      expect((await couponRow()).usedCount).toBe(0);
    });
    it('serializes the last available coupon usage across different members', async () => {
      await ctx.db
        .update(schema.coupons)
        .set({ usageLimit: 1 })
        .where(eq(schema.coupons.id, coupon.id));
      const other = await ctx.createUser();
      const [otherCoupon] = await ctx.db
        .insert(schema.userCoupons)
        .values({ userId: other.id, couponId: coupon.id })
        .returning();
      const results = await Promise.all([
        submit(),
        submit({ ...request(), userCouponId: otherCoupon.id }, other.auth),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(register).toHaveBeenCalledTimes(1);
    });
    it('keeps normal guest checkout and refuses coupon checkout during sync failure', async () => {
      await ctx
        .http()
        .post('/shop/order-review/register')
        .send({
          ...draft(),
          requestId: randomUUID(),
          expectedTotal: 35850,
          useCoupon: false,
        })
        .expect(200);
      await ctx.db
        .update(schema.naverOrderSyncState)
        .set({ lastError: 'TEST_ERROR' })
        .where(eq(schema.naverOrderSyncState.mode, 'production'));
      await submit().expect(503);
      expect(register).toHaveBeenCalledTimes(1);
    });
    it('Sandbox coupon reconciliation never consumes real coupon usage', async () => {
      cfg.set('NAVER_ORDER_MODE', 'test');
      cfg.set('NAVER_ORDER_AUDIENCE', 'review');
      cfg.set('NAVER_ORDER_REVIEW_USER_IDS', user.id);
      cfg.set('NAVER_ORDER_API_MODE', 'sandbox');
      cfg.set('NAVER_ORDER_INVENTORY_ENABLED', 'false');
      await submit().expect(200);
      await provider();
      await sync.run();
      expect((await record()).state).toBe('paid');
      expect((await couponRow()).usedCount).toBe(0);
      expect((await ownedRow()).usedAt).toBeNull();
      expect(
        (
          await ctx.db
            .select()
            .from(schema.products)
            .where(eq(schema.products.id, product.id))
        )[0].stockQuantity,
      ).toBe(10);
    });
  },
);
