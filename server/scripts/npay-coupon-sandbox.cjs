// Controlled sandbox exercise. Real inventory and real coupon redemption are never enabled.
const fs = require('fs');
const {
  randomUUID,
  randomBytes,
  createCipheriv,
  publicEncrypt,
  constants,
  createPublicKey,
} = require('crypto');
function checkoutResult(value) {
  const publicKey = createPublicKey(
    Buffer.from(process.env.SANDBOX_RESULT_PUBLIC_KEY || '', 'base64'),
  );
  const key = randomBytes(32),
    iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  console.log(
    JSON.stringify({
      encryptedSandboxResult: {
        key: publicEncrypt(
          {
            key: publicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          key,
        ).toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64'),
      },
    }),
  );
}

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { eq, and, isNull, gt } = require('drizzle-orm');
const { ConfigService } = require('@nestjs/config');
const schema = require('../dist/src/db/schema');
const { CouponService } = require('../dist/src/coupon/coupon.service');
const { OrderReviewService } = require('../dist/src/shop/order-review.service');
const { NaverOrderClient } = require('../dist/src/shop/naver-order.client');
const { NaverOrderService } = require('../dist/src/shop/naver-order.service');
const {
  NaverCouponCheckoutService,
} = require('../dist/src/shop/naver-coupon-checkout.service');
const {
  NaverOrderApiClient,
} = require('../dist/src/shop/naver-order-api.client');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    const action = process.argv[2];
    const owner = await db.query.users.findFirst({
      where: eq(schema.users.email, 'npay_test@dayoff.invalid'),
    });
    if (!owner) throw Error('TEST_ACCOUNT_MISSING');
    const settings = {
      ...process.env,
      NAVER_COUPON_CHECKOUT_ENABLED: 'true',
      NAVER_ORDER_MODE: 'test',
      NAVER_ORDER_AUDIENCE: 'review',
      NAVER_ORDER_REVIEW_USER_IDS: owner.id,
      NAVER_ORDER_API_MODE: 'sandbox',
      NAVER_ORDER_SYNC_ENABLED: 'true',
      NAVER_ORDER_INVENTORY_ENABLED: 'false',
    };
    if (action === 'sync') {
      const credentials = JSON.parse(fs.readFileSync(0, 'utf8'));
      Object.assign(settings, credentials);
      settings.NAVER_ORDER_API_MODE = 'sandbox';
      settings.NAVER_ORDER_INVENTORY_ENABLED = 'false';
      const api = new NaverOrderApiClient(new ConfigService(settings));
      const {
        reconcileNaverCoupon,
      } = require('../dist/src/shop/naver-coupon-reconcile');
      const to = new Date();
      let from = new Date(to.getTime() - 86400000),
        sequence;
      const seen = new Set();
      for (let page = 0; page < 20; page++) {
        const changed = await api.changes(from, to, sequence);
        const ids = changed.lastChangeStatuses.map((c) => c.productOrderId);
        const details = ids.length ? await api.details(ids) : [];
        for (const detail of details) {
          const code = detail.productOrder?.sellerInternalCode1;
          if (!code?.startsWith('dc1_') || seen.has(code)) continue;
          await db.transaction((tx) =>
            reconcileNaverCoupon(
              tx,
              detail,
              'sandbox',
              settings.NAVER_ORDER_MERCHANT_ID,
              api,
            ),
          );
          seen.add(code);
        }
        if (!changed.more) break;
        if (page === 19) throw Error('SANDBOX_CATCHUP_LIMIT');
        from = new Date(changed.more.moreFrom);
        sequence = changed.more.moreSequence;
      }
      console.log(JSON.stringify({ sandbox: true, traceIds: api.traceIds() }));
    } else if (action === 'prepare') {
      // Never expose a checkout bearer key in this public repository's workflow logs.
      const resultKey = createPublicKey(
        Buffer.from(process.env.SANDBOX_RESULT_PUBLIC_KEY || '', 'base64'),
      );
      if (
        resultKey.asymmetricKeyType !== 'rsa' ||
        resultKey.asymmetricKeyDetails.modulusLength < 2048
      )
        throw Error('INVALID_RESULT_KEY');
      const existing = await db.query.naverCouponCheckouts.findFirst({
        where: and(
          eq(schema.naverCouponCheckouts.mode, 'sandbox'),
          eq(schema.naverCouponCheckouts.userId, owner.id),
          isNull(schema.naverCouponCheckouts.releasedAt),
          // Provider buy keys expire. Retain old evidence but prepare a fresh isolated
          // test when the previous uncompleted checkout is older than one hour.
          gt(schema.naverCouponCheckouts.createdAt, new Date(Date.now() - 3600000)),
        ),
      });
      if (existing) {
        if (existing.key)
          checkoutResult({
            sandbox: true,
            resumed: true,
            desktopUrl: `https://test-order.pay.naver.com/customer/buy/${existing.key}/${existing.merchantNo}`,
            mobileUrl: `https://test-m.pay.naver.com/o/customer/buy/${existing.key}/${existing.merchantNo}`,
          });
        else throw Error('EXISTING_SANDBOX_CHECKOUT_REQUIRES_REVIEW');
      } else {
        const products = await db.query.products.findMany({
          where: and(
            eq(schema.products.isActive, true),
            gt(schema.products.stockQuantity, 0),
            gt(schema.products.price, 3000),
          ),
          with: { images: true, options: true },
          limit: 1,
        });
        if (!products[0]?.images.length)
          throw Error('TEST_PRODUCT_UNAVAILABLE');
        const product = products[0];
        const [coupon] = await db
          .insert(schema.coupons)
          .values({
            code: 'NPAY_SANDBOX_' + randomUUID().slice(0, 8),
            discountType: 'fixed',
            discountValue: 3000,
            usageLimit: 1,
            validFrom: new Date(Date.now() - 60000),
            validUntil: new Date(Date.now() + 7 * 86400000),
          })
          .returning();
        const [owned] = await db
          .insert(schema.userCoupons)
          .values({ userId: owner.id, couponId: coupon.id })
          .returning();
        const config = new ConfigService(settings),
          client = new NaverOrderClient(config),
          review = new OrderReviewService(db, new CouponService(db, {})),
          orders = new NaverOrderService(db, client),
          checkout = new NaverCouponCheckoutService(
            db,
            review,
            orders,
            client,
            config,
          );
        const dto = {
          items: [
            {
              productId: product.id,
              optionId: product.options[0]?.id,
              quantity: 1,
            },
          ],
          source: 'product',
          userCouponId: owned.id,
          useCoupon: true,
          requestId: randomUUID(),
        };
        const quote = await review.preview(dto, owner.id);
        const result = await checkout.register(
          { ...dto, expectedTotal: quote.total },
          owner.id,
        );
        checkoutResult({
          sandbox: true,
          discountAmount: quote.discountAmount,
          subtotal: quote.subtotal,
          total: quote.total,
          desktopUrl: `https://test-order.pay.naver.com/customer/buy/${result.key}/${result.merchantNo}`,
          mobileUrl: `https://test-m.pay.naver.com/o/customer/buy/${result.key}/${result.merchantNo}`,
        });
      }
    } else throw Error('INVALID_ACTION');
    const rows = await db
      .select()
      .from(schema.naverCouponCheckouts)
      .where(
        and(
          eq(schema.naverCouponCheckouts.mode, 'sandbox'),
          eq(schema.naverCouponCheckouts.userId, owner.id),
        ),
      );
    console.log(
      JSON.stringify({
        sandbox: true,
        couponCheckouts: rows.map((r) => ({
          state: r.state,
          xmlRequested: !!r.validatedAt,
          paymentSeen: !!r.redeemedAt,
          cancellationReconciled: r.state === 'cancelled' && !!r.releasedAt,
        })),
        realInventoryWrites: false,
      }),
    );
  } finally {
    await pool.end();
  }
})().catch((e) => {
  const allowed = [
    'TEST_ACCOUNT_MISSING',
    'SANDBOX_STATE_MISSING',
    'SANDBOX_SYNC_FAILED',
    'SANDBOX_CATCHUP_LIMIT',
    'TEST_PRODUCT_UNAVAILABLE',
    'EXISTING_SANDBOX_CHECKOUT_REQUIRES_REVIEW',
  ];
  console.error(
    JSON.stringify({
      sandboxCheck: false,
      code: allowed.includes(e.message) ? e.message : 'SANDBOX_CHECK_FAILED',
    }),
  );
  process.exit(1);
});
