// Run only on the configured host. Creates one sandbox order registration (no payment).
const { ConfigService } = require('@nestjs/config');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { and, eq, gt } = require('drizzle-orm');
const schema = require('../dist/src/db/schema');
const { NaverOrderSandboxController } = require('../dist/src/shop/naver-order-sandbox.controller');
(async () => {
  const env = process.env;
  if (env.NAVER_ORDER_API_MODE !== 'sandbox' || env.NAVER_ORDER_INVENTORY_ENABLED === 'true' || env.NAVER_ORDER_MODE !== 'production') throw Error('UNSAFE_CONFIGURATION');
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const db = drizzle(pool, { schema });
    const snapshot = async () => (await pool.query('select id, stock_quantity from products order by id')).rows;
    const before = await snapshot();
    const product = await db.query.products.findFirst({ where: and(eq(schema.products.isActive, true), gt(schema.products.stockQuantity, 0)), with: { options: true } });
    if (!product) throw Error('NO_AVAILABLE_PRODUCT');
    const config = new ConfigService(env);
    const controller = new NaverOrderSandboxController(config, db);
    const registration = await controller.register({ source: 'product', items: [{ productId: product.id, quantity: 1, ...(product.options.length ? { optionId: product.options[0].id } : {}) }] });
    if (new URL(registration.desktopUrl).hostname !== 'test-order.pay.naver.com' || new URL(registration.mobileUrl).hostname !== 'test-m.pay.naver.com') throw Error('UNSAFE_REDIRECT');
    // Independent probe avoids the administrator's double-click cooldown.
    const read = await new NaverOrderSandboxController(config, db).traces();
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('STOCK_CHANGED_DURING_CHECK');
    const origin = 'http://127.0.0.1:' + env.PORT;
    const response = await fetch(origin + '/shop/admin/naver-order/sandbox');
    if (response.status !== 401) throw Error('ADMIN_GUARD_FAILED');
    const publicConfig = await (await fetch(origin + '/shop/naver-order/config')).json();
    if (!publicConfig.enabled || publicConfig.sdkUrl !== 'https://npay-order.pstatic.net/assets/button/latest/npay.button.js') throw Error('PRODUCTION_CHECKOUT_CHANGED');
    console.log(JSON.stringify({ sandboxRegistrationCreated: true, productionCheckoutPreserved: true, stockUnchanged: true, anonymousDenied: true, ...read }));
  } finally { await pool.end(); }
})().catch(error => { console.error(error.code || 'SANDBOX_CHECK_FAILED'); process.exit(1); });
