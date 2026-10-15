import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import {
  createE2eContext,
  E2E_DATABASE_URL,
  type E2eContext,
} from './support/e2e-app';

const describeWithDb = E2E_DATABASE_URL ? describe : describe.skip;

describeWithDb('구매 · 결제 · 배송 (e2e)', () => {
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

  const orderByNumber = async (orderNumber: string) => {
    const order = await ctx.db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, orderNumber),
      with: { orderItems: true },
    });
    if (!order) throw new Error(`order ${orderNumber} not found`);
    return order;
  };

  const stockOf = async (productId: string) => {
    const [row] = await ctx.db
      .select({ stock: schema.products.stockQuantity })
      .from(schema.products)
      .where(eq(schema.products.id, productId));
    return row.stock;
  };

  describe('결제 준비', () => {
    it('금액·배송비를 서버가 계산하고 결제창 호출값을 돌려준다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ price: 30000 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 2);

      const created = await ctx
        .checkout(member, {
          cartItemIds: [item.id],
          shippingAddressId: address.id,
        })
        .then((res) => {
          expect(res.status).toBe(201);
          return res.body;
        });

      expect(created).toMatchObject({
        merchantUserKey: member.id,
        productName: product.name,
        productCount: 2,
        totalPayAmount: 64000,
        taxScopeAmount: 64000,
        taxExScopeAmount: 0,
      });
      const order = await orderByNumber(created.merchantPayKey);
      expect(order).toMatchObject({
        status: 'pending',
        subtotal: 60000,
        shippingFee: 4000,
        total: 64000,
      });
    });

    it.each([
      ['일반 지역', '04551', 30000, 4000],
      ['제주', '63000', 30000, 5000],
      ['신안 도서(58826)', '58826', 30000, 5000],
      ['청주(28826, 도서 아님)', '28826', 30000, 4000],
      ['10만원 이상 무료배송', '63000', 100000, 0],
    ])('배송비: %s', async (_label, postalCode, price, expectedShippingFee) => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ price });
      const address = await ctx.createAddress(member.id, { postalCode });
      const item = await ctx.addCartItem(member.id, product.id, 1);

      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });

      expect(created.status).toBe(201);
      expect(created.body.totalPayAmount).toBe(price + expectedShippingFee);
    });

    it('주문 시점의 배송지를 주문에 고정해, 이후 주소록을 고쳐도 주문 배송지는 바뀌지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { addressId } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);

      await ctx
        .http()
        .patch(`/auth/addresses/${addressId}`)
        .set(member.auth)
        .send({
          recipientName: '다른 사람',
          phone: '01099998888',
          postalCode: '63000',
          addressLine1: '제주 제주시 어딘가 1',
          addressLine2: '',
        })
        .expect(200);

      const adminOrders = await ctx
        .http()
        .get('/shop/admin/orders?status=paid')
        .set(admin.auth)
        .expect(200);
      expect(adminOrders.body).toHaveLength(1);
      expect(adminOrders.body[0].shippingAddress).toMatchObject({
        recipientName: '홍길동',
        phone: '01012345678',
        postalCode: '04551',
        addressLine1: '서울 중구 을지로 100',
        addressLine2: '3층',
      });
    });

    it('수령인·연락처·우편번호가 빠진 배송지로는 주문할 수 없다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const item = await ctx.addCartItem(member.id, product.id, 1);

      for (const missing of [
        { recipientName: null },
        { phone: null },
        { postalCode: null },
      ]) {
        const address = await ctx.createAddress(member.id, missing);
        const created = await ctx.checkout(member, {
          cartItemIds: [item.id],
          shippingAddressId: address.id,
        });
        expect({ missing, status: created.status }).toEqual({
          missing,
          status: 400,
        });
      }
      expect(await ctx.db.select().from(schema.orders)).toHaveLength(0);
    });

    it('다른 회원의 배송지·장바구니, 판매 중지·품절 상품, 사라진 장바구니 항목은 거부한다', async () => {
      const member = await ctx.createUser();
      const other = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 2 });
      const inactive = await ctx.createProduct({ isActive: false });
      const soldOut = await ctx.createProduct({ stockQuantity: 0 });
      const address = await ctx.createAddress(member.id);
      const otherAddress = await ctx.createAddress(other.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const otherItem = await ctx.addCartItem(other.id, product.id, 1);
      const inactiveItem = await ctx.addCartItem(member.id, inactive.id, 1);
      const soldOutItem = await ctx.addCartItem(member.id, soldOut.id, 1);
      const overStock = await ctx.addCartItem(member.id, product.id, 3);

      const attempts: Array<[string, Record<string, unknown>]> = [
        [
          '다른 회원 배송지',
          { cartItemIds: [item.id], shippingAddressId: otherAddress.id },
        ],
        [
          '다른 회원 장바구니',
          { cartItemIds: [otherItem.id], shippingAddressId: address.id },
        ],
        [
          '일부만 유효한 장바구니',
          {
            cartItemIds: [item.id, otherItem.id],
            shippingAddressId: address.id,
          },
        ],
        [
          '판매 중지 상품',
          { cartItemIds: [inactiveItem.id], shippingAddressId: address.id },
        ],
        [
          '품절 상품',
          { cartItemIds: [soldOutItem.id], shippingAddressId: address.id },
        ],
        [
          '재고 초과',
          { cartItemIds: [overStock.id], shippingAddressId: address.id },
        ],
        [
          '장바구니 수량 초과 구매',
          {
            cartItemIds: [item.id],
            cartItemQuantities: [2],
            shippingAddressId: address.id,
          },
        ],
        [
          '수량 0',
          {
            cartItemIds: [item.id],
            cartItemQuantities: [0],
            shippingAddressId: address.id,
          },
        ],
        ['잘못된 ID', { cartItemIds: ['x'], shippingAddressId: address.id }],
      ];

      for (const [label, body] of attempts) {
        const created = await ctx.checkout(member, body);
        expect({ label, status: created.status }).toEqual({
          label,
          status: 400,
        });
      }
      expect(await ctx.db.select().from(schema.orders)).toHaveLength(0);
    });
  });

  describe('결제 승인', () => {
    it('승인되면 주문 확정·재고 차감·장바구니 정리·주문 메일 발송이 함께 처리된다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 5 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 3);

      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        cartItemQuantities: [2],
        shippingAddressId: address.id,
      });
      const { response, paymentId } = await ctx.confirm(member, created.body);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        orderNumber: created.body.merchantPayKey,
        status: 'paid',
      });
      const order = await orderByNumber(created.body.merchantPayKey);
      expect(order).toMatchObject({
        status: 'paid',
        naverPaymentId: paymentId,
      });
      expect(order.paidAt).toBeInstanceOf(Date);
      expect(await stockOf(product.id)).toBe(3);
      const cart = await ctx.db.select().from(schema.cartItems);
      expect(cart).toHaveLength(1);
      expect(cart[0].quantity).toBe(1);
      expect(ctx.email.sendOrderPaidEmail).toHaveBeenCalledTimes(1);
      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();

      // 결과 페이지 새로고침 등 같은 승인 요청이 다시 와도 중복 처리하지 않는다.
      const again = await ctx
        .http()
        .post('/shop/checkout/naver/confirm')
        .set(member.auth)
        .send({ paymentId, merchantPayKey: created.body.merchantPayKey })
        .expect(201);
      expect(again.body.status).toBe('paid');
      expect(await stockOf(product.id)).toBe(3);
      expect(ctx.email.sendOrderPaidEmail).toHaveBeenCalledTimes(1);
    });

    it('여러 상품 주문은 DB가 주문 상품을 어떤 순서로 돌려줘도 정상 승인된다', async () => {
      const member = await ctx.createUser();
      const first = await ctx.createProduct({ name: '먼저 담은 접시' });
      const second = await ctx.createProduct({ name: '나중에 담은 컵' });
      const address = await ctx.createAddress(member.id);
      const firstItem = await ctx.addCartItem(member.id, first.id, 1);
      await ctx.db
        .update(schema.cartItems)
        .set({ createdAt: new Date(Date.now() - 60_000) })
        .where(eq(schema.cartItems.id, firstItem.id));
      const secondItem = await ctx.addCartItem(member.id, second.id, 1);

      const created = await ctx.checkout(member, {
        cartItemIds: [firstItem.id, secondItem.id],
        shippingAddressId: address.id,
      });
      expect(created.status).toBe(201);
      // 대표 상품명 행을 갱신해 테이블의 물리적 행 순서를 바꾼다.
      await ctx.db.execute(sql`
        update order_items set product_name = product_name
        where product_name = ${created.body.productName}
      `);

      const { response } = await ctx.confirm(member, created.body);

      expect(response.status).toBe(201);
      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();
      expect((await orderByNumber(created.body.merchantPayKey)).status).toBe(
        'paid',
      );
    });

    it('승인 금액이 주문과 다르면 결제를 자동 취소하고 주문을 확정하지 않는다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 5 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });

      const { response, paymentId } = await ctx.confirm(member, {
        ...created.body,
        totalPayAmount: created.body.totalPayAmount - 1000,
      });

      expect(response.status).toBe(400);
      expect(ctx.naverPay.cancelPayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId }),
      );
      expect((await orderByNumber(created.body.merchantPayKey)).status).toBe(
        'cancelled',
      );
      expect(await stockOf(product.id)).toBe(5);
    });

    it('결제 사이에 재고가 소진되면 결제를 자동 취소한다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 1 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });
      await ctx.db
        .update(schema.products)
        .set({ stockQuantity: 0 })
        .where(eq(schema.products.id, product.id));

      const { response } = await ctx.confirm(member, created.body);

      expect(response.status).toBe(400);
      expect(ctx.naverPay.cancelPayment).toHaveBeenCalledTimes(1);
      expect((await orderByNumber(created.body.merchantPayKey)).status).toBe(
        'cancelled',
      );
      expect(ctx.email.sendOrderPaidEmail).not.toHaveBeenCalled();
    });

    it('같은 승인 요청이 동시에 두 번 와도 재고·메일은 한 번만 처리된다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 5 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 2);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });
      const paymentId = 'pay-double';
      ctx.prepareApproval({
        paymentId,
        merchantPayKey: created.body.merchantPayKey,
        userId: member.id,
        total: created.body.totalPayAmount,
        productName: created.body.productName,
      });
      const confirmRequest = () =>
        ctx
          .http()
          .post('/shop/checkout/naver/confirm')
          .set(member.auth)
          .send({ paymentId, merchantPayKey: created.body.merchantPayKey });

      const [first, second] = await Promise.all([
        confirmRequest(),
        confirmRequest(),
      ]);

      expect([first.status, second.status]).toEqual([201, 201]);
      expect(await stockOf(product.id)).toBe(3);
      expect(ctx.email.sendOrderPaidEmail).toHaveBeenCalledTimes(1);
      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();
      expect(await ctx.db.select().from(schema.cartItems)).toHaveLength(0);
    });

    it('겹친 승인 요청 중 하나가 실패해도, 다른 요청이 이미 확정한 주문의 결제는 환불하지 않는다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 5 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });
      const paymentId = 'pay-overlap';
      ctx.prepareApproval({
        paymentId,
        merchantPayKey: created.body.merchantPayKey,
        userId: member.id,
        total: created.body.totalPayAmount,
        productName: created.body.productName,
      });
      const confirmRequest = () =>
        ctx
          .http()
          .post('/shop/checkout/naver/confirm')
          .set(member.auth)
          .send({ paymentId, merchantPayKey: created.body.merchantPayKey });

      let secondStatus = 0;
      const transactionSpy = jest
        .spyOn(ctx.db, 'transaction')
        .mockImplementationOnce(async () => {
          // 첫 요청의 확정 트랜잭션이 일시적 DB 오류로 실패하기 직전에,
          // 같은 결제의 두 번째 요청이 주문을 정상 확정한 상황을 만든다.
          secondStatus = (await confirmRequest()).status;
          throw new Error('simulated transient database failure');
        });
      const first = await confirmRequest();
      transactionSpy.mockRestore();

      expect(secondStatus).toBe(201);
      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();
      expect((await orderByNumber(created.body.merchantPayKey)).status).toBe(
        'paid',
      );
      expect(await stockOf(product.id)).toBe(4);
      expect(first.status).toBe(201);
      expect(first.body.status).toBe('paid');
    });

    it('다른 회원의 주문은 승인할 수 없다', async () => {
      const member = await ctx.createUser();
      const attacker = await ctx.createUser();
      const product = await ctx.createProduct();
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });

      await ctx
        .http()
        .post('/shop/checkout/naver/confirm')
        .set(attacker.auth)
        .send({
          paymentId: 'pay-x',
          merchantPayKey: created.body.merchantPayKey,
        })
        .expect(404);
      expect(ctx.naverPay.approvePayment).not.toHaveBeenCalled();
    });
  });

  describe('주문 취소 · 발송', () => {
    it('발송 전 취소 시 결제 취소·재고 원복·재입고 알림이 함께 처리된다', async () => {
      const member = await ctx.createUser();
      const waiting = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 1 });
      const { order, paymentId } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);
      expect(await stockOf(product.id)).toBe(0);
      await ctx
        .http()
        .post(`/shop/products/${product.id}/restock-notifications`)
        .set(waiting.auth)
        .expect(201);

      const cancelled = await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(member.auth)
        .expect(201);

      expect(cancelled.body).toEqual({
        orderNumber: order.orderNumber,
        status: 'cancelled',
      });
      expect(ctx.naverPay.cancelPayment).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId, amount: order.total }),
      );
      expect(await stockOf(product.id)).toBe(1);
      const after = await orderByNumber(order.orderNumber);
      expect(after.status).toBe('cancelled');
      expect(after.cancelledAt).toBeInstanceOf(Date);
      expect(ctx.email.sendProductRestockedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: waiting.email }),
      );

      // 같은 취소 요청이 다시 와도 재고를 두 번 되돌리지 않는다.
      await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(member.auth)
        .expect(201);
      expect(await stockOf(product.id)).toBe(1);
      expect(ctx.naverPay.cancelPayment).toHaveBeenCalledTimes(1);
    });

    it('여러 회원의 결제 확정과 주문 취소가 동시에 몰려도 교착 없이 재고·쿠폰 수가 맞는다', async () => {
      const first = await ctx.createProduct({ stockQuantity: 50 });
      const second = await ctx.createProduct({ stockQuantity: 50 });
      const coupon = await ctx.createCoupon({ discountValue: 1000 });

      // 회원마다 두 상품을 서로 다른 순서로 담아 주문 상품 행의 순서를 엇갈리게 만든다.
      const prepare = async (index: number) => {
        const member = await ctx.createUser();
        const address = await ctx.createAddress(member.id);
        const productIds =
          index % 2 === 0 ? [first.id, second.id] : [second.id, first.id];
        const cartItemIds: string[] = [];
        for (const productId of productIds) {
          cartItemIds.push((await ctx.addCartItem(member.id, productId, 1)).id);
        }
        const created = await ctx.checkout(member, {
          cartItemIds,
          shippingAddressId: address.id,
          couponCode: coupon.code,
        });
        expect(created.status).toBe(201);
        return { member, checkout: created.body };
      };
      const confirmAll = (
        prepared: Array<Awaited<ReturnType<typeof prepare>>>,
      ) =>
        prepared.map(({ member, checkout }) =>
          ctx.confirm(member, checkout).then(({ response }) => response),
        );

      const firstWave = await Promise.all([0, 1, 2, 3, 4, 5].map(prepare));
      const firstResults = await Promise.all(confirmAll(firstWave));
      expect(firstResults.map((res) => res.status)).toEqual(Array(6).fill(201));
      expect(await stockOf(first.id)).toBe(44);
      expect(await stockOf(second.id)).toBe(44);

      // 앞의 세 주문은 취소하고, 동시에 새 회원 세 명이 결제를 확정한다.
      const secondWave = await Promise.all([6, 7, 8].map(prepare));
      const cancels = firstWave
        .slice(0, 3)
        .map(async ({ member, checkout }) => {
          const order = await orderByNumber(checkout.merchantPayKey);
          return ctx
            .http()
            .post(`/shop/orders/${order.id}/cancel`)
            .set(member.auth);
        });
      const mixed = await Promise.all([...cancels, ...confirmAll(secondWave)]);

      expect(mixed.map((res) => res.status)).toEqual(Array(6).fill(201));
      expect(await stockOf(first.id)).toBe(44);
      expect(await stockOf(second.id)).toBe(44);
      const [couponRow] = await ctx.db
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.id, coupon.id));
      expect(couponRow.usedCount).toBe(6);
      const statuses = (await ctx.db.select().from(schema.orders)).map(
        (order) => order.status,
      );
      expect(statuses.filter((status) => status === 'paid')).toHaveLength(6);
      expect(statuses.filter((status) => status === 'cancelled')).toHaveLength(
        3,
      );
    });

    it('다른 회원의 주문·이미 발송된 주문은 취소할 수 없다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const other = await ctx.createUser();
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);

      await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(other.auth)
        .expect(404);

      await ctx
        .http()
        .patch(`/shop/admin/orders/${order.id}/shipment`)
        .set(admin.auth)
        .send({ trackingNumber: '1234-5678' })
        .expect(200);
      await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(member.auth)
        .expect(400);
      expect(ctx.naverPay.cancelPayment).not.toHaveBeenCalled();
    });

    it('송장번호를 넣으면 발송 완료로 바뀌고 안내 메일을 한 번만 보낸다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);
      const url = `/shop/admin/orders/${order.id}/shipment`;

      await ctx.http().patch(url).set(member.auth).send({}).expect(403);
      await ctx
        .http()
        .patch(url)
        .set(admin.auth)
        .send({ trackingNumber: '   ' })
        .expect(400);

      const shipped = await ctx
        .http()
        .patch(url)
        .set(admin.auth)
        .send({ trackingNumber: '  5555-1234-0000 ' })
        .expect(200);
      expect(shipped.body).toMatchObject({
        status: 'shipped',
        trackingNumber: '5555-1234-0000',
      });
      expect(ctx.email.sendOrderShippedEmail).toHaveBeenCalledTimes(1);
      expect(ctx.email.sendOrderShippedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: member.email,
          trackingNumber: '5555-1234-0000',
        }),
      );

      // 송장번호 정정은 가능하지만 메일을 다시 보내지는 않는다.
      await ctx
        .http()
        .patch(url)
        .set(admin.auth)
        .send({ trackingNumber: '5555-1234-9999' })
        .expect(200);
      expect(ctx.email.sendOrderShippedEmail).toHaveBeenCalledTimes(1);
    });

    it('결제 전(pending)·취소된 주문은 발송 처리할 수 없다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const created = await ctx.checkout(member, {
        cartItemIds: [item.id],
        shippingAddressId: address.id,
      });
      const pending = await orderByNumber(created.body.merchantPayKey);

      await ctx
        .http()
        .patch(`/shop/admin/orders/${pending.id}/shipment`)
        .set(admin.auth)
        .send({ trackingNumber: '1111' })
        .expect(400);

      await ctx.db
        .update(schema.orders)
        .set({ status: 'cancelled' })
        .where(eq(schema.orders.id, pending.id));
      await ctx
        .http()
        .patch(`/shop/admin/orders/${pending.id}/shipment`)
        .set(admin.auth)
        .send({ trackingNumber: '1111' })
        .expect(400);
      await ctx
        .http()
        .patch('/shop/admin/orders/not-a-uuid/shipment')
        .set(admin.auth)
        .send({ trackingNumber: '1111' })
        .expect(400);
    });

    it('고객 결제 취소가 진행되는 동안 들어온 발송 처리는 환불된 주문을 발송 완료로 만들지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);

      let shipment: Promise<{ status: number }> | null = null;
      ctx.naverPay.cancelPayment.mockImplementationOnce(async () => {
        // 네이버페이 환불이 처리되는 바로 그 순간 관리자가 발송 처리를 누른 상황
        shipment = ctx
          .http()
          .patch(`/shop/admin/orders/${order.id}/shipment`)
          .set(admin.auth)
          .send({ trackingNumber: '7777' })
          .then((res) => ({ status: res.status }));
        await new Promise((resolve) => setTimeout(resolve, 400));
      });

      await ctx
        .http()
        .post(`/shop/orders/${order.id}/cancel`)
        .set(member.auth)
        .expect(201);
      const shipmentResult = await shipment!;

      const after = await orderByNumber(order.orderNumber);
      expect(after.status).toBe('cancelled');
      expect(after.trackingNumber).toBeNull();
      expect(shipmentResult.status).toBeGreaterThanOrEqual(400);
      expect(ctx.email.sendOrderShippedEmail).not.toHaveBeenCalled();
    });
  });

  describe('관리자 주문 관리', () => {
    it('pending 일괄 삭제는 결제 진행 중이거나 결제번호가 남은 주문을 지우지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 50 });
      const address = await ctx.createAddress(member.id);
      const item = await ctx.addCartItem(member.id, product.id, 1);
      const createPending = async () => {
        const created = await ctx.checkout(member, {
          cartItemIds: [item.id],
          shippingAddressId: address.id,
        });
        expect(created.status).toBe(201);
        return orderByNumber(created.body.merchantPayKey);
      };
      const stale = await createPending();
      const needsReconciliation = await createPending();
      const inProgress = await createPending();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await ctx.db
        .update(schema.orders)
        .set({ createdAt: twoHoursAgo })
        .where(eq(schema.orders.id, stale.id));
      await ctx.db
        .update(schema.orders)
        .set({ createdAt: twoHoursAgo, naverPaymentId: 'pay-stuck' })
        .where(eq(schema.orders.id, needsReconciliation.id));
      const { order: paid } = await ctx.placePaidOrder(
        member,
        [{ productId: product.id }],
        { addressId: address.id },
      );

      const result = await ctx
        .http()
        .delete('/shop/admin/orders/pending')
        .set(admin.auth)
        .expect(200);

      expect(result.body.deletedOrders).toBe(1);
      const remaining = (await ctx.db.select().from(schema.orders)).map(
        (order) => order.id,
      );
      expect(remaining.sort()).toEqual(
        [needsReconciliation.id, inProgress.id, paid.id].sort(),
      );
    });

    it('상태 필터로 주문을 조회한다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      await ctx.placePaidOrder(member, [{ productId: product.id }]);

      const paid = await ctx
        .http()
        .get('/shop/admin/orders?status=paid')
        .set(admin.auth)
        .expect(200);
      const shipped = await ctx
        .http()
        .get('/shop/admin/orders?status=shipped')
        .set(admin.auth)
        .expect(200);
      await ctx.http().get('/shop/admin/orders').set(member.auth).expect(403);

      expect(paid.body).toHaveLength(1);
      expect(paid.body[0].orderItems).toHaveLength(1);
      expect(shipped.body).toHaveLength(0);
    });
  });

  describe('배송지 주소록', () => {
    it('별칭·주소가 비어 있으면 저장하지 않는다', async () => {
      const member = await ctx.createUser();

      await ctx
        .http()
        .post('/auth/addresses')
        .set(member.auth)
        .send({ label: '  ', addressLine1: '서울 중구 을지로 1' })
        .expect(400);
      await ctx
        .http()
        .post('/auth/addresses')
        .set(member.auth)
        .send({ label: '집', addressLine1: '' })
        .expect(400);
      const created = await ctx
        .http()
        .post('/auth/addresses')
        .set(member.auth)
        .send({ label: '집', addressLine1: '서울 중구 을지로 1' })
        .expect(201);
      await ctx
        .http()
        .patch(`/auth/addresses/${created.body.id}`)
        .set(member.auth)
        .send({ addressLine1: '   ' })
        .expect(400);
    });

    it('기본 배송지는 항상 한 곳만 유지된다', async () => {
      const member = await ctx.createUser();
      const first = await ctx
        .http()
        .post('/auth/addresses')
        .set(member.auth)
        .send({ label: '집', addressLine1: '서울 1', isDefault: true })
        .expect(201);
      const second = await ctx
        .http()
        .post('/auth/addresses')
        .set(member.auth)
        .send({ label: '회사', addressLine1: '서울 2', isDefault: true })
        .expect(201);

      const list = await ctx
        .http()
        .get('/auth/addresses')
        .set(member.auth)
        .expect(200);
      const defaults = list.body.filter(
        (address: { isDefault: boolean }) => address.isDefault,
      );
      expect(defaults.map((address: { id: string }) => address.id)).toEqual([
        second.body.id,
      ]);
      expect(first.body.isDefault).toBe(true);
    });

    it('주문에 사용한 배송지도 삭제할 수 있고, 주문의 배송 정보는 유지된다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { addressId } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);

      await ctx
        .http()
        .delete(`/auth/addresses/${addressId}`)
        .set(member.auth)
        .expect(200);

      const list = await ctx.http().get('/auth/addresses').set(member.auth);
      expect(list.body).toEqual([]);
      const adminOrders = await ctx
        .http()
        .get('/shop/admin/orders?status=paid')
        .set(admin.auth)
        .expect(200);
      expect(adminOrders.body[0].shippingAddress).toMatchObject({
        recipientName: '홍길동',
        phone: '01012345678',
        addressLine1: '서울 중구 을지로 100',
      });
    });

    it('다른 회원의 배송지는 수정·삭제할 수 없다', async () => {
      const owner = await ctx.createUser();
      const other = await ctx.createUser();
      const address = await ctx.createAddress(owner.id);

      await ctx
        .http()
        .patch(`/auth/addresses/${address.id}`)
        .set(other.auth)
        .send({ label: '탈취' })
        .expect(400);
      await ctx
        .http()
        .delete(`/auth/addresses/${address.id}`)
        .set(other.auth)
        .expect(400);
    });
  });

  describe('회원 탈퇴', () => {
    it('발송을 기다리는 결제 완료 주문이 있으면 탈퇴를 막는다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);

      const blocked = await ctx
        .http()
        .delete('/auth/me')
        .set(member.auth)
        .expect(400);
      expect(blocked.body.message).toContain('주문');
      expect(await ctx.db.select().from(schema.orders)).toHaveLength(1);

      await ctx.db
        .update(schema.orders)
        .set({ status: 'shipped' })
        .where(eq(schema.orders.id, order.id));
      await ctx.http().delete('/auth/me').set(member.auth).expect(200);
      expect(await ctx.db.select().from(schema.users)).toHaveLength(0);
    });
  });
});
