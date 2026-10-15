import { eq, sql } from 'drizzle-orm';
import { readdir, unlink } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import * as schema from '../src/db/schema';
import {
  createE2eContext,
  E2E_DATABASE_URL,
  type E2eContext,
} from './support/e2e-app';

const describeWithDb = E2E_DATABASE_URL ? describe : describe.skip;

describeWithDb('상품 · 카테고리 · 장바구니 · 구매평 (e2e)', () => {
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

  describe('카테고리', () => {
    it('관리자만 등록할 수 있다', async () => {
      const member = await ctx.createUser();
      const body = { name: '컵', slug: 'cup', sortOrder: 1 };

      await ctx.http().post('/shop/admin/categories').send(body).expect(401);
      await ctx
        .http()
        .post('/shop/admin/categories')
        .set(member.auth)
        .send(body)
        .expect(403);
    });

    it('등록 후 목록에 노출되고, 필수값 누락·중복 slug는 4xx로 안내한다', async () => {
      const admin = await ctx.createAdmin();

      const created = await ctx
        .http()
        .post('/shop/admin/categories')
        .set(admin.auth)
        .send({ name: ' 컵 ', slug: ' cup ', sortOrder: 2 })
        .expect(201);
      expect(created.body).toMatchObject({
        name: '컵',
        slug: 'cup',
        sortOrder: 2,
      });

      const list = await ctx.http().get('/shop/categories').expect(200);
      expect(list.body).toHaveLength(1);

      await ctx
        .http()
        .post('/shop/admin/categories')
        .set(admin.auth)
        .send({ name: '이름만' })
        .expect(400);
      await ctx
        .http()
        .post('/shop/admin/categories')
        .set(admin.auth)
        .send({ name: '   ', slug: 'blank-name' })
        .expect(400);
      await ctx
        .http()
        .post('/shop/admin/categories')
        .set(admin.auth)
        .send({ name: '컵2', slug: 'cup' })
        .expect(409);
    });

    it('수정 시 다른 카테고리의 slug와 겹치면 409, 없는 카테고리는 404', async () => {
      const admin = await ctx.createAdmin();
      const cup = await ctx.createCategory({ slug: 'cup', name: '컵' });
      const plate = await ctx.createCategory({ slug: 'plate', name: '접시' });

      await ctx
        .http()
        .patch(`/shop/admin/categories/${plate.id}`)
        .set(admin.auth)
        .send({ slug: 'cup' })
        .expect(409);
      await ctx
        .http()
        .patch(`/shop/admin/categories/${plate.id}`)
        .set(admin.auth)
        .send({ slug: '  ' })
        .expect(400);

      const updated = await ctx
        .http()
        .patch(`/shop/admin/categories/${cup.id}`)
        .set(admin.auth)
        .send({ name: '머그', slug: 'cup', sortOrder: 5 })
        .expect(200);
      expect(updated.body).toMatchObject({ name: '머그', sortOrder: 5 });

      await ctx
        .http()
        .patch('/shop/admin/categories/00000000-0000-4000-8000-000000000000')
        .set(admin.auth)
        .send({ name: '없음' })
        .expect(404);
    });

    it('상품이 연결된 카테고리는 삭제를 막고, 비어 있으면 삭제한다', async () => {
      const admin = await ctx.createAdmin();
      const used = await ctx.createCategory();
      const empty = await ctx.createCategory();
      await ctx.createProduct({ categoryId: used.id });

      const blocked = await ctx
        .http()
        .delete(`/shop/admin/categories/${used.id}`)
        .set(admin.auth)
        .expect(400);
      expect(blocked.body.message).toContain('상품이 있어');

      await ctx
        .http()
        .delete(`/shop/admin/categories/${empty.id}`)
        .set(admin.auth)
        .expect(200);
      await ctx
        .http()
        .delete('/shop/admin/categories/not-a-uuid')
        .set(admin.auth)
        .expect(400);
    });
  });

  describe('상품 등록 · 수정', () => {
    const productBody = (categoryId: string, slug = 'sand-mug') => ({
      name: '샌드 머그',
      slug,
      price: 27000,
      originalPrice: 30000,
      discountRate: 10,
      description: '설명',
      categoryId,
      stockQuantity: 5,
      purchaseNotice: '구매 전 안내',
      shippingNotice: '배송 안내',
      exchangeReturnNotice: '교환 안내',
      careGuide: '케어',
      handlingNotice: '케어',
      images: [
        { url: 'https://cdn.example.com/a.webp', alt: '', sortOrder: 1 },
        { url: 'https://cdn.example.com/b.webp', alt: '', sortOrder: 2 },
      ],
      options: [
        { name: '색상', value: '화이트', sortOrder: 1 },
        { name: '색상', value: '샌드', sortOrder: 2 },
      ],
    });

    it('관리자 화면이 보내는 형식 그대로 등록되고 할인가는 서버가 계산한다', async () => {
      const admin = await ctx.createAdmin();
      const category = await ctx.createCategory();

      const created = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send(productBody(category.id))
        .expect(201);

      expect(created.body).toMatchObject({
        name: '샌드 머그',
        slug: 'sand-mug',
        price: 27000,
        originalPrice: 30000,
        discountRate: 10,
        stockQuantity: 5,
        isActive: true,
      });
      expect(created.body.images).toHaveLength(2);
      expect(created.body.options).toHaveLength(2);

      const list = await ctx.http().get('/shop/products').expect(200);
      expect(list.body).toHaveLength(1);
    });

    it('없는 카테고리·중복 slug·잘못된 값은 500이 아니라 4xx로 안내한다', async () => {
      const admin = await ctx.createAdmin();
      const category = await ctx.createCategory();
      await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send(productBody(category.id))
        .expect(201);

      const duplicated = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send(productBody(category.id));
      expect(duplicated.status).toBe(409);

      const unknownCategory = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send(productBody('00000000-0000-4000-8000-000000000000', 'other-mug'));
      expect(unknownCategory.status).toBe(400);

      const missingCategory = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send({ ...productBody(category.id, 'no-category'), categoryId: '' });
      expect(missingCategory.status).toBe(400);

      const brokenImage = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send({
          ...productBody(category.id, 'broken-image'),
          images: [{ alt: 'url 없음' }],
        });
      expect(brokenImage.status).toBe(400);
    });

    it('API 경로와 겹치는 slug는 새로 쓸 수 없지만, 기존 상품의 다른 항목 수정은 막지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const category = await ctx.createCategory();

      for (const slug of ['cart', 'admin', 'my-reviews']) {
        const response = await ctx
          .http()
          .post('/shop/admin/products')
          .set(admin.auth)
          .send(productBody(category.id, slug));
        expect({ slug, status: response.status }).toEqual({
          slug,
          status: 400,
        });
      }

      const legacy = await ctx.createProduct({ slug: 'orders' });
      const normal = await ctx.createProduct({ slug: 'plain-cup' });
      await ctx
        .http()
        .patch(`/shop/admin/products/${legacy.id}`)
        .set(admin.auth)
        .send({ slug: 'orders', name: '이름만 수정' })
        .expect(200);
      await ctx
        .http()
        .patch(`/shop/admin/products/${normal.id}`)
        .set(admin.auth)
        .send({ slug: 'checkout' })
        .expect(400);
    });

    it('요청에 섞여 들어온 id·생성일 같은 임의 필드는 저장에 반영하지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const category = await ctx.createCategory();
      const forcedId = '11111111-1111-4111-8111-111111111111';

      const created = await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send({
          ...productBody(category.id),
          id: forcedId,
          createdAt: '2000-01-01T00:00:00.000Z',
          unknownField: 'x',
        })
        .expect(201);

      expect(created.body.id).not.toBe(forcedId);
      expect(new Date(created.body.createdAt).getFullYear()).toBeGreaterThan(
        2020,
      );
    });

    it('수정 시 slug 중복·없는 카테고리를 4xx로 안내하고 임의 필드는 무시한다', async () => {
      const admin = await ctx.createAdmin();
      const first = await ctx.createProduct({ slug: 'first' });
      const second = await ctx.createProduct({ slug: 'second' });

      const conflict = await ctx
        .http()
        .patch(`/shop/admin/products/${second.id}`)
        .set(admin.auth)
        .send({ slug: 'first' });
      expect(conflict.status).toBe(409);

      const unknownCategory = await ctx
        .http()
        .patch(`/shop/admin/products/${second.id}`)
        .set(admin.auth)
        .send({ categoryId: '00000000-0000-4000-8000-000000000000' });
      expect(unknownCategory.status).toBe(400);

      const updated = await ctx
        .http()
        .patch(`/shop/admin/products/${first.id}`)
        .set(admin.auth)
        .send({
          name: '수정된 이름',
          price: 20000,
          originalPrice: null,
          discountRate: 0,
          createdAt: '2000-01-01T00:00:00.000Z',
          id: second.id,
        });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        id: first.id,
        name: '수정된 이름',
        price: 20000,
        originalPrice: null,
        discountRate: 0,
      });
    });

    it('품절 상품의 재고를 채우면 알림 신청자에게 재입고 메일을 보낸다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 0 });

      await ctx
        .http()
        .post(`/shop/products/${product.id}/restock-notifications`)
        .set(member.auth)
        .expect(201);

      await ctx
        .http()
        .patch(`/shop/admin/products/${product.id}`)
        .set(admin.auth)
        .send({ stockQuantity: 3 })
        .expect(200);

      expect(ctx.email.sendProductRestockedEmail).toHaveBeenCalledTimes(1);
      expect(ctx.email.sendProductRestockedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: member.email,
          productSlug: product.slug,
        }),
      );
      const remaining = await ctx.db
        .select()
        .from(schema.productRestockSubscriptions);
      expect(remaining).toHaveLength(0);
    });
  });

  describe('상품 삭제', () => {
    it('옵션이 담긴 장바구니가 있어도 삭제된다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const product = await ctx.createProduct(
        {},
        { options: [{ name: '색상', value: '화이트' }] },
      );
      await ctx.addCartItem(member.id, product.id, 1, product.options[0].id);

      const deleted = await ctx
        .http()
        .delete(`/shop/admin/products/${product.id}`)
        .set(admin.auth);
      expect(deleted.status).toBe(200);

      const cart = await ctx.http().get('/shop/cart').set(member.auth);
      expect(cart.body).toEqual([]);
      await ctx.http().get(`/shop/products/${product.id}`).expect(404);
    });

    it('주문 이력이 있는 상품도 삭제 처리되고 주문 내역은 그대로 남는다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const category = await ctx.createCategory();
      const product = await ctx.createProduct(
        { categoryId: category.id, slug: 'moon-vase' },
        {
          options: [{ name: '색상', value: '화이트' }],
          images: ['https://cdn.example.com/moon.webp'],
        },
      );
      await ctx.placePaidOrder(member, [
        { productId: product.id, optionId: product.options[0].id },
      ]);

      const deleted = await ctx
        .http()
        .delete(`/shop/admin/products/${product.id}`)
        .set(admin.auth);
      expect(deleted.status).toBe(200);

      // 쇼핑몰/관리자 목록과 상세에서는 사라진다.
      const list = await ctx.http().get('/shop/products').expect(200);
      expect(list.body).toEqual([]);
      await ctx.http().get('/shop/products/moon-vase').expect(404);
      await ctx.http().get(`/shop/products/${product.id}`).expect(404);

      // 고객 주문 내역에는 상품명과 이미지가 그대로 남는다.
      const orders = await ctx.http().get('/shop/orders').set(member.auth);
      expect(orders.body).toHaveLength(1);
      expect(orders.body[0].orderItems[0]).toMatchObject({
        productName: product.name,
        optionLabel: '색상: 화이트',
      });
      expect(orders.body[0].orderItems[0].product.images[0].url).toBe(
        'https://cdn.example.com/moon.webp',
      );
      // 주문 내역이 참조하는 이미지는 저장소에서 지우지 않는다.
      expect(ctx.deleteStoredUrls).not.toHaveBeenCalledWith(
        expect.arrayContaining(['https://cdn.example.com/moon.webp']),
        expect.anything(),
      );

      // 같은 slug로 새 상품을 다시 등록할 수 있다.
      await ctx
        .http()
        .post('/shop/admin/products')
        .set(admin.auth)
        .send({
          name: '문 베이스 2',
          slug: 'moon-vase',
          price: 50000,
          categoryId: category.id,
        })
        .expect(201);
    });

    it('삭제된 상품만 남은 카테고리는 삭제할 수 있다', async () => {
      const admin = await ctx.createAdmin();
      const member = await ctx.createUser();
      const category = await ctx.createCategory();
      const product = await ctx.createProduct({ categoryId: category.id });
      await ctx.placePaidOrder(member, [{ productId: product.id }]);

      await ctx
        .http()
        .delete(`/shop/admin/products/${product.id}`)
        .set(admin.auth)
        .expect(200);
      await ctx
        .http()
        .delete(`/shop/admin/categories/${category.id}`)
        .set(admin.auth)
        .expect(200);
    });

    it('다른 상품이 함께 쓰는 이미지는 저장소에서 지우지 않는다', async () => {
      const admin = await ctx.createAdmin();
      const shared = 'http://localhost:4000/uploads/product/shared.webp';
      const own = 'http://localhost:4000/uploads/product/own.webp';
      const product = await ctx.createProduct({}, { images: [shared, own] });
      await ctx.createProduct({}, { images: [shared] });

      await ctx
        .http()
        .delete(`/shop/admin/products/${product.id}`)
        .set(admin.auth)
        .expect(200);

      const deletedUrls = ctx.deleteStoredUrls.mock.calls.flatMap(
        (call) => call[0],
      );
      expect(deletedUrls).toContain(own);
      expect(deletedUrls).not.toContain(shared);
    });

    it('없는 상품·잘못된 ID는 404/400으로 응답한다', async () => {
      const admin = await ctx.createAdmin();
      await ctx
        .http()
        .delete('/shop/admin/products/00000000-0000-4000-8000-000000000000')
        .set(admin.auth)
        .expect(404);
      await ctx
        .http()
        .delete('/shop/admin/products/not-a-uuid')
        .set(admin.auth)
        .expect(400);
    });
  });

  describe('상품 조회', () => {
    it('구매평 작성자의 이메일 원문을 공개 응답에 싣지 않는다', async () => {
      const member = await ctx.createUser({
        email: 'private.person@example.com',
        fullName: null,
      });
      const product = await ctx.createProduct();
      await ctx.db.insert(schema.productReviews).values({
        productId: product.id,
        userId: member.id,
        body: '정말 마음에 드는 그릇입니다.',
        rating: 5,
      });

      const detail = await ctx
        .http()
        .get(`/shop/products/${product.slug}`)
        .expect(200);

      expect(JSON.stringify(detail.body)).not.toContain(
        'private.person@example.com',
      );
      expect(detail.body.reviews[0].user.email).toMatch(/\*/);
    });
  });

  describe('장바구니', () => {
    it('수량은 1 이상의 정수만 허용한다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 5 });

      for (const quantity of [0, -3, 1.5, '2', null]) {
        const response = await ctx
          .http()
          .post('/shop/cart')
          .set(member.auth)
          .send({ productId: product.id, quantity });
        expect({ quantity, status: response.status }).toEqual({
          quantity,
          status: 400,
        });
      }

      await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({ productId: product.id, quantity: 2 })
        .expect(201);
      const merged = await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({ productId: product.id, quantity: 1 })
        .expect(201);
      expect(merged.body.quantity).toBe(3);

      for (const quantity of [0, -1, 2.5]) {
        await ctx
          .http()
          .patch(`/shop/cart/${merged.body.id}`)
          .set(member.auth)
          .send({ quantity })
          .expect(400);
      }
      const rows = await ctx.db.select().from(schema.cartItems);
      expect(rows).toHaveLength(1);
      expect(rows[0].quantity).toBe(3);
    });

    it('재고보다 많이 담거나 늘릴 수 없고, 줄이는 것은 항상 가능하다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct({ stockQuantity: 2 });

      const tooMany = await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({ productId: product.id, quantity: 3 });
      expect(tooMany.status).toBe(400);

      // 같은 상품을 여러 번 담아도 재고(2개)를 넘지 않는다. (바로 구매를 반복해도 막히지 않도록 오류는 내지 않음)
      const add = () =>
        ctx
          .http()
          .post('/shop/cart')
          .set(member.auth)
          .send({ productId: product.id, quantity: 1 })
          .expect(201);
      expect((await add()).body.quantity).toBe(1);
      expect((await add()).body.quantity).toBe(2);
      const capped = await add();
      expect(capped.body.quantity).toBe(2);

      // 재고가 줄기 전에 더 많이 담아 둔 수량은 줄이지 않고, 늘리는 것만 막는다.
      await ctx.db
        .update(schema.cartItems)
        .set({ quantity: 5 })
        .where(eq(schema.cartItems.id, capped.body.id));
      expect((await add()).body.quantity).toBe(5);
      await ctx
        .http()
        .patch(`/shop/cart/${capped.body.id}`)
        .set(member.auth)
        .send({ quantity: 6 })
        .expect(400);
      await ctx
        .http()
        .patch(`/shop/cart/${capped.body.id}`)
        .set(member.auth)
        .send({ quantity: 4 })
        .expect(200);
    });

    it('옵션 상품은 해당 상품의 옵션만, 옵션 없는 상품은 옵션 없이 담긴다', async () => {
      const member = await ctx.createUser();
      const withOptions = await ctx.createProduct(
        {},
        { options: [{ name: '색상', value: '화이트' }] },
      );
      const plain = await ctx.createProduct();

      await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({ productId: withOptions.id, quantity: 1 })
        .expect(400);
      await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({
          productId: plain.id,
          quantity: 1,
          optionId: withOptions.options[0].id,
        })
        .expect(400);
      await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({ productId: 'not-a-uuid', quantity: 1 })
        .expect(400);

      const ok = await ctx
        .http()
        .post('/shop/cart')
        .set(member.auth)
        .send({
          productId: withOptions.id,
          quantity: 1,
          optionId: withOptions.options[0].id,
        })
        .expect(201);
      expect(ok.body.optionId).toBe(withOptions.options[0].id);
    });

    it('다른 회원의 장바구니 항목은 수정·삭제할 수 없다', async () => {
      const owner = await ctx.createUser();
      const other = await ctx.createUser();
      const product = await ctx.createProduct();
      const item = await ctx.addCartItem(owner.id, product.id, 1);

      await ctx
        .http()
        .patch(`/shop/cart/${item.id}`)
        .set(other.auth)
        .send({ quantity: 2 })
        .expect(404);
      await ctx
        .http()
        .delete(`/shop/cart/${item.id}`)
        .set(other.auth)
        .expect(404);
    });
  });

  describe('구매평', () => {
    const reviewBody = '선물용으로 구매했는데 아주 만족합니다.';

    const shippedOrderItem = async (
      member: Awaited<ReturnType<E2eContext['createUser']>>,
      status: 'paid' | 'shipped' | 'delivered' = 'shipped',
    ) => {
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);
      await ctx.db
        .update(schema.orders)
        .set({ status })
        .where(eq(schema.orders.id, order.id));
      return { product, orderItem: order.orderItems[0] };
    };

    it('작성하면 저장된 구매평을 그대로 돌려준다', async () => {
      const member = await ctx.createUser();
      const { product, orderItem } = await shippedOrderItem(member);

      const created = await ctx
        .http()
        .post(`/shop/products/${product.id}/reviews`)
        .set(member.auth)
        .send({ body: reviewBody, rating: 5, orderItemId: orderItem.id })
        .expect(201);

      expect(created.body).toMatchObject({
        body: reviewBody,
        rating: 5,
        orderItemId: orderItem.id,
      });
    });

    it('배송 완료(delivered) 주문도 작성할 수 있고, 발송 전에는 막는다', async () => {
      const member = await ctx.createUser();
      const delivered = await shippedOrderItem(member, 'delivered');
      const paid = await shippedOrderItem(member, 'paid');

      await ctx
        .http()
        .post(`/shop/products/${delivered.product.id}/reviews`)
        .set(member.auth)
        .send({ body: reviewBody, orderItemId: delivered.orderItem.id })
        .expect(201);
      await ctx
        .http()
        .post(`/shop/products/${paid.product.id}/reviews`)
        .set(member.auth)
        .send({ body: reviewBody, orderItemId: paid.orderItem.id })
        .expect(400);
    });

    it('본문 누락·범위를 벗어난 별점은 400, 같은 주문 상품에는 한 번만 작성된다', async () => {
      const member = await ctx.createUser();
      const { product, orderItem } = await shippedOrderItem(member);
      const url = `/shop/products/${product.id}/reviews`;

      await ctx
        .http()
        .post(url)
        .set(member.auth)
        .send({ orderItemId: orderItem.id })
        .expect(400);
      await ctx
        .http()
        .post(url)
        .set(member.auth)
        .send({ body: reviewBody, rating: 9, orderItemId: orderItem.id })
        .expect(400);
      await ctx
        .http()
        .post(url)
        .set(member.auth)
        .send({ body: reviewBody, orderItemId: 'not-a-uuid' })
        .expect(400);

      await ctx
        .http()
        .post(url)
        .set(member.auth)
        .send({ body: reviewBody, orderItemId: orderItem.id })
        .expect(201);
      await ctx
        .http()
        .post(url)
        .set(member.auth)
        .send({ body: reviewBody, orderItemId: orderItem.id })
        .expect(409);

      const reviews = await ctx.db.select().from(schema.productReviews);
      expect(reviews).toHaveLength(1);
    });

    it('다른 회원의 주문 상품으로는 작성할 수 없다', async () => {
      const buyer = await ctx.createUser();
      const stranger = await ctx.createUser();
      const { product, orderItem } = await shippedOrderItem(buyer);

      await ctx
        .http()
        .post(`/shop/products/${product.id}/reviews`)
        .set(stranger.auth)
        .send({ body: reviewBody, orderItemId: orderItem.id })
        .expect(400);
    });

    it('이 서버가 발급하지 않은 이미지 주소는 구매평에 붙일 수 없다', async () => {
      const member = await ctx.createUser();
      const productImage = 'http://localhost:4000/uploads/product/hero.webp';
      const { product, orderItem } = await shippedOrderItem(member);
      await ctx.db
        .insert(schema.productImages)
        .values({ productId: product.id, url: productImage });

      for (const imageUrl of [
        productImage,
        '/uploads/product/hero.webp',
        'https://evil.example.com/tracker.png',
        '/uploads/review/../product/hero.webp',
      ]) {
        const response = await ctx
          .http()
          .post(`/shop/products/${product.id}/reviews`)
          .set(member.auth)
          .send({
            body: reviewBody,
            orderItemId: orderItem.id,
            imageUrls: [imageUrl],
          });
        expect({ imageUrl, status: response.status }).toEqual({
          imageUrl,
          status: 400,
        });
      }
      expect(await ctx.db.select().from(schema.productReviews)).toHaveLength(0);
    });

    it('구매평을 지워도 구매평 폴더 밖의 파일 삭제를 요청하지 않는다', async () => {
      const member = await ctx.createUser();
      const { product, orderItem } = await shippedOrderItem(member);
      // 과거 데이터처럼 상품 이미지 주소가 구매평에 저장돼 있는 상황
      const [review] = await ctx.db
        .insert(schema.productReviews)
        .values({
          productId: product.id,
          userId: member.id,
          orderItemId: orderItem.id,
          body: reviewBody,
        })
        .returning();
      await ctx.db.insert(schema.productReviewImages).values({
        reviewId: review.id,
        url: 'http://localhost:4000/uploads/product/hero.webp',
      });

      await ctx
        .http()
        .delete(`/shop/my-reviews/${review.id}`)
        .set(member.auth)
        .expect(200);

      for (const call of ctx.deleteStoredUrls.mock.calls) {
        expect(call[1]).toEqual({ directory: 'review' });
      }
    });
  });

  describe('이미지 업로드', () => {
    const reviewDir = join(process.cwd(), 'uploads', 'review');
    const listReviewFiles = async () =>
      (await readdir(reviewDir)).filter((name) => name !== '.gitkeep').sort();

    it('이미지가 아닌 파일은 확장자·MIME을 속여도 거부하고 디스크에 남기지 않는다', async () => {
      const member = await ctx.createUser();
      const before = await listReviewFiles();

      const disguised = await ctx
        .http()
        .post('/shop/upload')
        .set(member.auth)
        .attach('files', Buffer.from('<script>alert(1)</script>'), {
          filename: 'evil.html',
          contentType: 'image/png',
        });
      expect(disguised.status).toBe(400);

      const wrongType = await ctx
        .http()
        .post('/shop/upload')
        .set(member.auth)
        .attach('files', Buffer.from('plain text'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        });
      expect(wrongType.status).toBe(400);

      expect(await listReviewFiles()).toEqual(before);
    });

    it('정상 이미지는 WebP로 저장되고, 그 주소로 구매평을 작성할 수 있다', async () => {
      const member = await ctx.createUser();
      const product = await ctx.createProduct();
      const { order } = await ctx.placePaidOrder(member, [
        { productId: product.id },
      ]);
      await ctx.db
        .update(schema.orders)
        .set({ status: 'shipped' })
        .where(eq(schema.orders.id, order.id));
      const png = await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 3,
          background: { r: 200, g: 180, b: 150 },
        },
      })
        .png()
        .toBuffer();
      const before = await listReviewFiles();
      let created: string[] = [];

      try {
        const uploaded = await ctx
          .http()
          .post('/shop/upload')
          .set(member.auth)
          .attach('files', png, {
            filename: 'photo.html',
            contentType: 'image/png',
          })
          .expect(201);
        created = (await listReviewFiles()).filter(
          (name) => !before.includes(name),
        );

        expect(uploaded.body.urls).toHaveLength(1);
        expect(uploaded.body.urls[0]).toMatch(
          /\/uploads\/review\/[\w.-]+\.webp$/,
        );
        expect(created).toHaveLength(1);
        expect(created[0]).toMatch(/\.webp$/);

        const review = await ctx
          .http()
          .post(`/shop/products/${product.id}/reviews`)
          .set(member.auth)
          .send({
            body: '사진과 함께 남기는 구매평입니다.',
            orderItemId: order.orderItems[0].id,
            imageUrls: uploaded.body.urls,
          })
          .expect(201);
        expect(review.body.images).toHaveLength(1);
      } finally {
        await Promise.all(
          created.map((name) =>
            unlink(join(reviewDir, name)).catch(() => undefined),
          ),
        );
      }
    });
  });

  it('마이그레이션이 주문 배송지 스냅샷 컬럼을 만든다', async () => {
    const columns = await ctx.db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns
      where table_name = 'orders' and column_name like 'shipping_%'
      order by column_name
    `);
    expect(columns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_phone',
        'shipping_postal_code',
        'shipping_recipient_name',
      ]),
    );
  });
});
