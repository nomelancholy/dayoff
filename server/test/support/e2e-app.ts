import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { DRIZZLE } from '../../src/common/database/database.module';
import { EmailService } from '../../src/common/email/email.service';
import * as schema from '../../src/db/schema';
import { NaverPayClient } from '../../src/shop/naver-pay.client';
import { SpacesStorageService } from '../../src/shop/spaces-storage.service';

export type Db = NodePgDatabase<typeof schema>;

/**
 * 테이블을 비우는 테스트이므로 전용 DB에서만 실행합니다.
 * 예) E2E_DATABASE_URL=postgresql://postgres:pw@127.0.0.1:55461/dayoff_e2e npm run test:e2e
 */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL;

function assertDisposableDatabase(rawUrl: string) {
  const url = new URL(rawUrl);
  const database = url.pathname.replace(/^\//, '');
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!isLocal || !/(e2e|test|audit)/i.test(database)) {
    throw new Error(
      'E2E_DATABASE_URL은 이름에 e2e/test/audit가 포함된 로컬 전용 DB여야 합니다.',
    );
  }
}

export function createFakeEmailService() {
  return {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendOrderPaidEmail: jest.fn().mockResolvedValue(undefined),
    sendOrderShippedEmail: jest.fn().mockResolvedValue(undefined),
    sendProductRestockedEmail: jest.fn().mockResolvedValue(undefined),
    sendCouponIssuedEmail: jest.fn().mockResolvedValue(undefined),
  };
}

type FakeApproval = {
  paymentId: string;
  payHistId: string;
  merchantPayKey: string;
  merchantUserKey: string;
  totalPayAmount: number;
  taxScopeAmount: number;
  taxExScopeAmount: number;
  productName: string;
  admissionTypeCode: string;
  admissionState: string;
};

export function createFakeNaverPayClient() {
  return {
    isEnabled: jest.fn(() => true),
    getMode: jest.fn(() => 'development' as const),
    getConfigurationStatus: jest.fn(() => ({
      enabled: true,
      mode: 'development',
      configured: true,
      missingKeys: [],
    })),
    getCheckoutConfig: jest.fn(() => ({
      mode: 'development' as const,
      clientId: 'e2e-client-id',
      chainId: 'e2e-chain-id',
    })),
    approvePayment: jest.fn<Promise<FakeApproval>, [string]>(),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
    findPaymentIdByMerchantPayKey: jest.fn().mockResolvedValue(null),
  };
}

export type E2eContext = Awaited<ReturnType<typeof createE2eContext>>;

export async function createE2eContext() {
  if (!E2E_DATABASE_URL) {
    throw new Error('E2E_DATABASE_URL이 필요합니다.');
  }
  assertDisposableDatabase(E2E_DATABASE_URL);

  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  const db: Db = drizzle(pool, { schema });
  // 운영 배포와 동일한 마이그레이션 파일을 그대로 적용해 스키마 정합성도 함께 검증합니다.
  await migrate(db, {
    migrationsFolder: join(__dirname, '../../src/db/migrations'),
  });

  const email = createFakeEmailService();
  const naverPay = createFakeNaverPayClient();
  // 실제 네이버페이처럼 결제번호별로 승인 결과를 돌려준다. (동시에 여러 승인 요청이 와도 섞이지 않게)
  const approvals = new Map<string, FakeApproval>();
  const approveByPaymentId = (paymentId: string) => {
    const approval = approvals.get(paymentId);
    return approval
      ? Promise.resolve(approval)
      : Promise.reject(new Error(`준비되지 않은 결제번호입니다: ${paymentId}`));
  };
  naverPay.approvePayment.mockImplementation(approveByPaymentId);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DRIZZLE)
    .useValue(db)
    .overrideProvider(EmailService)
    .useValue(email)
    .overrideProvider(NaverPayClient)
    .useValue(naverPay)
    .compile();

  moduleRef.get(ConfigService).set('NAVER_PAY_LEGACY_CHECKOUT_ENABLED', 'true');
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const jwt = app.get(JwtService);
  const storage = app.get(SpacesStorageService);
  // 실제 업로드 디렉터리의 파일을 지우지 않도록 삭제 호출은 기록만 합니다.
  const deleteStoredUrls = jest
    .spyOn(storage, 'deleteStoredUrls')
    .mockResolvedValue(undefined);

  let sequence = 0;
  const next = () => {
    sequence += 1;
    return sequence;
  };

  const http = () => request(app.getHttpServer());

  const resetDatabase = async () => {
    await db.execute(sql`
      TRUNCATE TABLE
        product_review_images, product_reviews, product_restock_subscriptions,
        product_qa, cart_items, user_coupons, order_items, orders, coupons,
        product_detail_images, product_images, product_options, products,
        product_categories, addresses, users
      RESTART IDENTITY CASCADE
    `);
    email.sendWelcomeEmail.mockClear();
    email.sendOrderPaidEmail.mockClear();
    email.sendOrderShippedEmail.mockClear();
    email.sendProductRestockedEmail.mockClear();
    email.sendCouponIssuedEmail.mockClear();
    approvals.clear();
    naverPay.approvePayment.mockReset().mockImplementation(approveByPaymentId);
    naverPay.cancelPayment.mockReset().mockResolvedValue(undefined);
    naverPay.findPaymentIdByMerchantPayKey.mockReset().mockResolvedValue(null);
    deleteStoredUrls.mockClear();
  };

  const createUser = async (
    overrides: Partial<typeof schema.users.$inferInsert> = {},
  ) => {
    const n = next();
    const [user] = await db
      .insert(schema.users)
      .values({
        email: `user${n}@example.com`,
        provider: 'kakao',
        providerId: `kakao-${n}`,
        fullName: `회원${n}`,
        role: 'member',
        ...overrides,
      })
      .returning();
    const token = jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { ...user, token, auth: { Authorization: `Bearer ${token}` } };
  };

  const createAdmin = () => createUser({ role: 'admin' });

  const createCategory = async (
    overrides: Partial<typeof schema.productCategories.$inferInsert> = {},
  ) => {
    const n = next();
    const [category] = await db
      .insert(schema.productCategories)
      .values({ slug: `category-${n}`, name: `카테고리${n}`, ...overrides })
      .returning();
    return category;
  };

  const createProduct = async (
    overrides: Partial<typeof schema.products.$inferInsert> = {},
    extras: {
      options?: Array<{ name: string; value: string }>;
      images?: string[];
    } = {},
  ) => {
    const n = next();
    const categoryId = overrides.categoryId ?? (await createCategory()).id;
    const [product] = await db
      .insert(schema.products)
      .values({
        slug: `product-${n}`,
        name: `상품${n}`,
        price: 30000,
        stockQuantity: 10,
        ...overrides,
        categoryId,
      })
      .returning();
    const options = extras.options?.length
      ? await db
          .insert(schema.productOptions)
          .values(
            extras.options.map((option, index) => ({
              productId: product.id,
              name: option.name,
              value: option.value,
              sortOrder: index + 1,
            })),
          )
          .returning()
      : [];
    const images = extras.images?.length
      ? await db
          .insert(schema.productImages)
          .values(
            extras.images.map((url, index) => ({
              productId: product.id,
              url,
              sortOrder: index + 1,
            })),
          )
          .returning()
      : [];
    return { ...product, options, images };
  };

  const createAddress = async (
    userId: string,
    overrides: Partial<typeof schema.addresses.$inferInsert> = {},
  ) => {
    const [address] = await db
      .insert(schema.addresses)
      .values({
        userId,
        label: '집',
        recipientName: '홍길동',
        phone: '01012345678',
        postalCode: '04551',
        addressLine1: '서울 중구 을지로 100',
        addressLine2: '3층',
        isDefault: true,
        ...overrides,
      })
      .returning();
    return address;
  };

  const addCartItem = async (
    userId: string,
    productId: string,
    quantity = 1,
    optionId: string | null = null,
  ) => {
    const [item] = await db
      .insert(schema.cartItems)
      .values({ userId, productId, quantity, optionId })
      .returning();
    return item;
  };

  const createCoupon = async (
    overrides: Partial<typeof schema.coupons.$inferInsert> = {},
  ) => {
    const n = next();
    const [coupon] = await db
      .insert(schema.coupons)
      .values({
        code: `COUPON${n}`,
        discountType: 'fixed',
        discountValue: 3000,
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        ...overrides,
      })
      .returning();
    return coupon;
  };

  /** 결제 준비 → (가짜) 네이버페이 승인 → 주문 확정까지 한 번에 진행합니다. */
  const checkout = async (
    user: { id: string; auth: { Authorization: string } },
    body: Record<string, unknown>,
  ) => http().post('/shop/checkout/naver').set(user.auth).send(body);

  const prepareApproval = (params: {
    paymentId: string;
    merchantPayKey: string;
    userId: string;
    total: number;
    productName: string;
  }) => {
    approvals.set(params.paymentId, {
      paymentId: params.paymentId,
      payHistId: `hist-${params.paymentId}`,
      merchantPayKey: params.merchantPayKey,
      merchantUserKey: params.userId,
      totalPayAmount: params.total,
      taxScopeAmount: params.total,
      taxExScopeAmount: 0,
      productName: params.productName,
      admissionTypeCode: '01',
      admissionState: 'SUCCESS',
    });
  };

  const confirm = async (
    user: { id: string; auth: { Authorization: string } },
    checkoutBody: {
      merchantPayKey: string;
      totalPayAmount: number;
      productName: string;
    },
    paymentId = `pay-${next()}`,
  ) => {
    prepareApproval({
      paymentId,
      merchantPayKey: checkoutBody.merchantPayKey,
      userId: user.id,
      total: checkoutBody.totalPayAmount,
      productName: checkoutBody.productName,
    });
    const response = await http()
      .post('/shop/checkout/naver/confirm')
      .set(user.auth)
      .send({ paymentId, merchantPayKey: checkoutBody.merchantPayKey });
    return { response, paymentId };
  };

  /** 장바구니 담기부터 결제 완료까지 진행한 주문을 만듭니다. */
  const placePaidOrder = async (
    user: { id: string; auth: { Authorization: string } },
    items: Array<{ productId: string; quantity?: number; optionId?: string }>,
    options: { couponCode?: string; addressId?: string } = {},
  ) => {
    const addressId = options.addressId ?? (await createAddress(user.id)).id;
    const cartItemIds: string[] = [];
    for (const item of items) {
      const cartItem = await addCartItem(
        user.id,
        item.productId,
        item.quantity ?? 1,
        item.optionId ?? null,
      );
      cartItemIds.push(cartItem.id);
    }
    const created = await checkout(user, {
      cartItemIds,
      shippingAddressId: addressId,
      ...(options.couponCode ? { couponCode: options.couponCode } : {}),
    });
    if (created.status !== 201) {
      throw new Error(
        `checkout failed: ${created.status} ${JSON.stringify(created.body)}`,
      );
    }
    const { response, paymentId } = await confirm(user, created.body);
    if (response.status !== 201) {
      throw new Error(
        `confirm failed: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, created.body.merchantPayKey),
      with: { orderItems: true },
    });
    if (!order) throw new Error('order not found after confirm');
    return { order, paymentId, addressId, checkout: created.body };
  };

  const close = async () => {
    await app.close();
    await pool.end();
  };

  return {
    app,
    db,
    http,
    email,
    naverPay,
    storage,
    deleteStoredUrls,
    resetDatabase,
    createUser,
    createAdmin,
    createCategory,
    createProduct,
    createAddress,
    addCartItem,
    createCoupon,
    checkout,
    prepareApproval,
    confirm,
    placePaidOrder,
    close,
  };
}
