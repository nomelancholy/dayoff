// Only aggregates and configuration booleans leave the production server.
const { Pool } = require('pg');
(async () => {
  const e = process.env;
  if (e.NAVER_ORDER_API_MODE !== 'production' || e.NAVER_ORDER_MODE !== 'production' ||
      e.NAVER_ORDER_SYNC_ENABLED !== 'true' || e.NAVER_ORDER_INVENTORY_ENABLED !== 'true') throw Error('CONFIGURATION_MISMATCH');
  const db = new Pool({connectionString:e.DATABASE_URL});
  try {
    const result = await db.query(`select exists(select 1 from naver_order_sync_state where mode='production'
      and inventory_enabled=true and last_error is null and last_success_at > now()-interval '3 minutes'
      and cursor > now()-interval '3 minutes' and starts_at=$1) as healthy`, [e.NAVER_ORDER_SYNC_START_AT]);
    if (!result.rows[0].healthy) throw Error('SYNC_NOT_HEALTHY');
    const isolation = await db.query("select not exists(select 1 from naver_order_inventory where mode='sandbox' and applied_consumed<>0) as isolated");
    if (!isolation.rows[0].isolated) throw Error('SANDBOX_NOT_ISOLATED');
    const totals = await db.query("select count(*)::int as recorded_product_orders, coalesce(sum(applied_consumed),0)::int as applied_units from naver_order_inventory where mode='production'");
    const response = await fetch('http://127.0.0.1:'+e.PORT+'/shop/naver-order/config');
    const config = await response.json();
    if (!response.ok || !config.enabled || config.sdkUrl !== 'https://npay-order.pstatic.net/assets/button/latest/npay.button.js') throw Error('CHECKOUT_MISMATCH');
    console.log(JSON.stringify({productionApi:true, syncHealthy:true, liveInventoryEnabled:true, sandboxIsolated:true, productionCheckout:true, startsAt:e.NAVER_ORDER_SYNC_START_AT, ...totals.rows[0]}));
  } finally { await db.end(); }
})().catch(() => {console.error('Production synchronization health check failed');process.exit(1)});
