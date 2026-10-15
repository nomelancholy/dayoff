import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import {
  createE2eContext,
  E2E_DATABASE_URL,
  type E2eContext,
} from './support/e2e-app';

const describeWithDb = E2E_DATABASE_URL ? describe : describe.skip;

describeWithDb('쿠폰 (e2e)', () => {
  let ctx: E2eContext;

  beforeAll(async () => {
    ctx = await createE2eContext();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  beforeEach(async () => {
    await ctx.resetDatabase();
  });

  const couponBody = (overrides: Record<string, unknown> = {}) => ({
    code: 'WELCOME10',
    discountType: 'percent',
    discountValue: 10,
    validFrom: '2026-10-05',
    validUntil: '2026-10-31',
    isActive: true,
    ...overrides,
  });

  const couponRow = async (id: string) => {
    const [row] = await ctx.db
      .select()
      .from(schema.coupons)
      .where(eq(schema.coupons.id, id));
    return row;
  };

  describe('관리자 쿠폰 등록 · 수정', () => {
    it('날짜만 입력하면 한국 시간 기준 시작일 0시 ~ 종료일 끝까지 유효하다', async () => {
      const admin = await ctx.createAdmin();

      const created = await ctx
        .http()
        .post('/coupons')
        .set(admin.auth)
        .send(couponBody())
        .expect(201);

      const row = await couponRow(created.body.id);
      expect(row.validFrom.toISOString()).toBe('2026-10-04T15:00:00.000Z');
      expect(row.validUntil.toISOString()).toBe('2026-10-31T14:59:59.999Z');

      // 관리자 수정 폼은 응답 문자열 앞 10자리를 날짜 입력값으로 쓴다.
      expect(created.body.validFrom.slice(0, 10)).toBe('2026-10-05');
      expect(created.body.validUntil.slice(0, 10)).toBe('2026-10-31');
      expect(new Date(created.body.validFrom).getTime()).toBe(
        row.validFrom.getTime(),
      );

      const list = await ctx.http().get('/coupons').set(admin.auth).expect(200);
      expect(list.body[0].validFrom.slice(0, 10)).toBe('2026-10-05');
      expect(list.body[0].validUntil.slice(0, 10)).toBe('2026-10-31');
    });

    it('수정 폼에서 날짜를 그대로 다시 저장해도 기간이 밀리지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const created = await ctx
        .http()
        .post('/coupons')
        .set(admin.auth)
        .send(couponBody())
        .expect(201);

      const updated = await ctx
        .http()
        .patch(`/coupons/${created.body.id}`)
        .set(admin.auth)
        .send({
          code: 'WELCOME10',
          discountType: 'percent',
          discountValue: 15,
          validFrom: created.body.validFrom.slice(0, 10),
          validUntil: created.body.validUntil.slice(0, 10),
          isActive: true,
        })
        .expect(200);

      expect(updated.body.discountValue).toBe(15);
      const row = await couponRow(created.body.id);
      expect(row.validFrom.toISOString()).toBe('2026-10-04T15:00:00.000Z');
      expect(row.validUntil.toISOString()).toBe('2026-10-31T14:59:59.999Z');
    });

    it('하루짜리 쿠폰도 그날 하루 동안 사용할 수 있다', async () => {
      const admin = await ctx.createAdmin();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
      }).format(new Date());

      const created = await ctx
        .http()
        .post('/coupons')
        .set(admin.auth)
        .send(couponBody({ validFrom: today, validUntil: today }))
        .expect(201);

      const member = await ctx.createUser();
      const validated = await ctx
        .http()
        .post('/coupons/validate')
        .set(member.auth)
        .send({ code: created.body.code, orderAmount: 50000 })
        .expect(201);
      expect(validated.body.discountAmount).toBe(5000);
    });

    it('잘못된 입력은 400/409로 안내한다', async () => {
      const admin = await ctx.createAdmin();
      await ctx
        .http()
        .post('/coupons')
        .set(admin.auth)
        .send(couponBody())
        .expect(201);

      const invalid: Array<[string, Record<string, unknown>, number]> = [
        ['중복 코드(대소문자 무시)', { code: 'welcome10' }, 409],
        ['빈 코드', { code: '   ' }, 400],
        ['100% 초과', { code: 'OVER', discountValue: 150 }, 400],
        [
          '종료일이 시작일보다 빠름',
          { code: 'BACK', validFrom: '2026-10-31', validUntil: '2026-10-05' },
          400,
        ],
        ['사용 한도 0', { code: 'ZERO', usageLimit: 0 }, 400],
      ];
      for (const [label, overrides, status] of invalid) {
        const response = await ctx
          .http()
          .post('/coupons')
          .set(admin.auth)
          .send(couponBody(overrides));
        expect({ label, status: response.status }).toEqual({ label, status });
      }
    });

    it('정률 쿠폰의 할인 값만 100 초과로 바꾸는 수정도 막는다', async () => {
      const admin = await ctx.createAdmin();
      const coupon = await ctx.createCoupon({
        discountType: 'percent',
        discountValue: 10,
      });

      await ctx
        .http()
        .patch(`/coupons/${coupon.id}`)
        .set(admin.auth)
        .send({ discountValue: 150 })
        .expect(400);
      await ctx
        .http()
        .patch(`/coupons/${coupon.id}`)
        .set(admin.auth)
        .send({ validUntil: '2000-01-01' })
        .expect(400);
      expect((await couponRow(coupon.id)).discountValue).toBe(10);
    });

    it('최소 주문 금액·사용 한도를 null로 보내면 제한이 해제된다', async () => {
      const admin = await ctx.createAdmin();
      const coupon = await ctx.createCoupon({
        minOrderAmount: 50000,
        usageLimit: 10,
      });

      await ctx
        .http()
        .patch(`/coupons/${coupon.id}`)
        .set(admin.auth)
        .send({ minOrderAmount: null, usageLimit: null })
        .expect(200);

      expect(await couponRow(coupon.id)).toMatchObject({
        minOrderAmount: null,
        usageLimit: null,
      });
    });

    it('회원에게는 관리자 쿠폰 API를 열지 않는다', async () => {
      const member = await ctx.createUser();
      const coupon = await ctx.createCoupon();

      await ctx.http().get('/coupons').set(member.auth).expect(403);
      await ctx
        .http()
        .post('/coupons')
        .set(member.auth)
        .send(couponBody())
        .expect(403);
      await ctx
        .http()
        .delete(`/coupons/${coupon.id}`)
        .set(member.auth)
        .expect(403);
      await ctx
        .http()
        .post(`/coupons/${coupon.id}/issue`)
        .set(member.auth)
        .send({ userId: member.id })
        .expect(403);
    });
  });

  describe('쿠폰 지급(발송)', () => {
    it('지급하면 회원의 쿠폰함에 들어가고 안내 메일을 보낸다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const coupon = await ctx.createCoupon({
        code: 'THANKS5000',
        discountType: 'fixed',
        discountValue: 5000,
        minOrderAmount: 30000,
      });

      const issued = await ctx
        .http()
        .post(`/coupons/${coupon.id}/issue`)
        .set(admin.auth)
        .send({ userId: member.id })
        .expect(201);
      expect(issued.body).toMatchObject({
        userId: member.id,
        couponId: coupon.id,
        usedAt: null,
      });

      const mine = await ctx
        .http()
        .get('/coupons/my')
        .set(member.auth)
        .expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].coupon.code).toBe('THANKS5000');

      expect(ctx.email.sendCouponIssuedEmail).toHaveBeenCalledTimes(1);
      expect(ctx.email.sendCouponIssuedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: member.email,
          code: 'THANKS5000',
          discountType: 'fixed',
          discountValue: 5000,
          minOrderAmount: 30000,
        }),
      );
    });

    it('없는 회원·중복 지급·사용할 수 없는 쿠폰은 4xx로 안내한다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const coupon = await ctx.createCoupon();
      const expired = await ctx.createCoupon({
        validUntil: new Date(Date.now() - 1000),
      });
      const inactive = await ctx.createCoupon({ isActive: false });
      const exhausted = await ctx.createCoupon({ usageLimit: 1, usedCount: 1 });
      const issue = (couponId: string, userId: string) =>
        ctx
          .http()
          .post(`/coupons/${couponId}/issue`)
          .set(admin.auth)
          .send({ userId });

      await issue(coupon.id, '00000000-0000-4000-8000-000000000000').expect(
        404,
      );
      await issue('00000000-0000-4000-8000-000000000000', member.id).expect(
        404,
      );
      await issue(coupon.id, member.id).expect(201);
      await issue(coupon.id, member.id).expect(409);
      await issue(expired.id, member.id).expect(400);
      await issue(inactive.id, member.id).expect(400);
      await issue(exhausted.id, member.id).expect(400);
      expect(ctx.email.sendCouponIssuedEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('쿠폰 삭제', () => {
    it('지급했거나 주문에 사용된 쿠폰도 삭제되고 주문 금액은 유지된다', async () => {
      const admin = await ctx.createAdmin();
      const buyer = await ctx.createUser();
      const holder = await ctx.createUser();
      const product = await ctx.createProduct({ price: 50000 });
      const coupon = await ctx.createCoupon({ discountValue: 3000 });
      await ctx
        .http()
        .post(`/coupons/${coupon.id}/issue`)
        .set(admin.auth)
        .send({ userId: holder.id })
        .expect(201);
      const { order } = await ctx.placePaidOrder(
        buyer,
        [{ productId: product.id }],
        { couponCode: coupon.code },
      );
      expect(order.discountAmount).toBe(3000);

      await ctx
        .http()
        .delete(`/coupons/${coupon.id}`)
        .set(admin.auth)
        .expect(200);

      expect(await ctx.db.select().from(schema.coupons)).toHaveLength(0);
      expect(await ctx.db.select().from(schema.userCoupons)).toHaveLength(0);
      const [after] = await ctx.db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, order.id));
      expect(after).toMatchObject({
        status: 'paid',
        couponId: null,
        discountAmount: 3000,
        total: order.total,
      });
      const holderCoupons = await ctx
        .http()
        .get('/coupons/my')
        .set(holder.auth)
        .expect(200);
      expect(holderCoupons.body).toEqual([]);
    });
  });

  describe('쿠폰 사용', () => {
    it('검증 시 기간·활성 여부·최소 주문 금액·한도를 확인하고 할인액을 계산한다', async () => {
      const member = await ctx.createUser();
      const percent = await ctx.createCoupon({
        code: 'TEN',
        discountType: 'percent',
        discountValue: 10,
        minOrderAmount: 30000,
      });
      const fixed = await ctx.createCoupon({
        code: 'BIG',
        discountType: 'fixed',
        discountValue: 80000,
      });
      const notYet = await ctx.createCoupon({
        validFrom: new Date(Date.now() + 60_000),
      });
      const exhausted = await ctx.createCoupon({ usageLimit: 2, usedCount: 2 });
      const validate = (code: string, orderAmount: number) =>
        ctx
          .http()
          .post('/coupons/validate')
          .set(member.auth)
          .send({ code, orderAmount });

      const ok = await validate(' ten ', 45000).expect(201);
      expect(ok.body).toMatchObject({
        valid: true,
        couponId: percent.id,
        discountAmount: 4500,
      });
      // 정액 할인은 주문 금액을 넘지 않는다.
      expect((await validate(fixed.code, 50000)).body.discountAmount).toBe(
        50000,
      );
      await validate('TEN', 29999).expect(400);
      await validate(notYet.code, 50000).expect(400);
      await validate(exhausted.code, 50000).expect(400);
      await validate('NOPE', 50000).expect(400);
      await ctx
        .http()
        .post('/coupons/validate')
        .send({ code: 'TEN', orderAmount: 45000 })
        .expect(401);
    });

    it('결제가 확정되면 사용 처리되고, 같은 회원이 같은 쿠폰을 다시 쓸 수 없다', async () => {
      const member = await ctx.createUser();
      const other = await ctx.createUser();
      const product = await ctx.createProduct({
        price: 50000,
        stockQuantity: 20,
      });
      const coupon = await ctx.createCoupon({
        code: 'OPEN3000',
        discountValue: 3000,
      });

      const { order, addressId } = await ctx.placePaidOrder(
        member,
        [{ productId: product.id }],
        { couponCode: 'open3000' },
      );
      expect(order).toMatchObject({
        couponId: coupon.id,
        discountAmount: 3000,
        total: 50000 + 4000 - 3000,
      });
      expect((await couponRow(coupon.id)).usedCount).toBe(1);

      // 같은 회원의 재사용은 검증·결제 준비 단계에서 모두 막는다.
      await ctx
        .http()
        .post('/coupons/validate')
        .set(member.auth)
        .send({ code: 'OPEN3000', orderAmount: 50000 })
        .expect(400);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const second = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: addressId,
        couponCode: 'OPEN3000',
      });
      expect(second.status).toBe(400);

      // 다른 회원은 같은 공용 코드를 한 번 사용할 수 있다.
      await ctx.placePaidOrder(other, [{ productId: product.id }], {
        couponCode: 'OPEN3000',
      });
      expect((await couponRow(coupon.id)).usedCount).toBe(2);
    });

    it('사용한 쿠폰을 다시 지급받으면 새로 지급된 쿠폰으로 결제된다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct({
        price: 50000,
        stockQuantity: 20,
      });
      const coupon = await ctx.createCoupon();
      const issue = () =>
        ctx
          .http()
          .post(`/coupons/${coupon.id}/issue`)
          .set(admin.auth)
          .send({ userId: member.id })
          .expect(201);

      await issue();
      const first = await ctx.placePaidOrder(
        member,
        [{ productId: product.id }],
        { couponCode: coupon.code },
      );
      await issue();
      const second = await ctx.placePaidOrder(
        member,
        [{ productId: product.id }],
        { couponCode: coupon.code, addressId: first.addressId },
      );

      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();
      const rows = await ctx.db
        .select()
        .from(schema.userCoupons)
        .where(eq(schema.userCoupons.userId, member.id));
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.orderId).sort()).toEqual(
        [first.order.id, second.order.id].sort(),
      );
      expect((await couponRow(coupon.id)).usedCount).toBe(2);
    });

    it('주문을 취소하면 쿠폰을 다시 쓸 수 있게 되돌린다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ price: 50000 });
      const coupon = await ctx.createCoupon();
      await ctx
        .http()
        .post(`/coupons/${coupon.id}/issue`)
        .set(admin.auth)
        .send({ userId: member.id })
        .expect(201);
      const { order } = await ctx.placePaidOrder(
        member,
        [{ productId: product.id }],
        { couponCode: coupon.code },
      );
      expect(
        (await ctx.http().get('/coupons/my').set(member.auth)).body,
      ).toHaveLength(0);

      await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(member.auth)
        .expect(201);

      expect((await couponRow(coupon.id)).usedCount).toBe(0);
      expect(
        (await ctx.http().get('/coupons/my').set(member.auth)).body,
      ).toHaveLength(1);
      await ctx
        .http()
        .post('/coupons/validate')
        .set(member.auth)
        .send({ code: coupon.code, orderAmount: 50000 })
        .expect(201);
    });

    it('결제 사이에 쿠폰 한도가 소진되면 결제를 자동 취소한다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ price: 50000 });
      const coupon = await ctx.createCoupon({ usageLimit: 1 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
        couponCode: coupon.code,
      });
      expect(created.status).toBe(201);
      await ctx.db
        .update(schema.coupons)
        .set({ usedCount: 1 })
        .where(eq(schema.coupons.id, coupon.id));

      const { response } = await ctx.confirm(member, created.body);

      expect(response.status).toBe(400);
      expect(ctx.naverPay.cancelPayment).toHaveBeenCalledTimes(1);
      const [order] = await ctx.db.select().from(schema.orders);
      expect(order.status).toBe('cancelled');
    });
  });
});
