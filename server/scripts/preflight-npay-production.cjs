// Read-only cutover gate. Never logs credentials or customer/order identifiers.
const { ConfigService } = require('@nestjs/config');
const { Pool } = require('pg');
const { NaverOrderApiClient, NaverApiError } = require('../dist/src/shop/naver-order-api.client');
async function preflight(api, db, now = Date.now(), pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (api.mode() !== 'production' || api.value('NAVER_ORDER_MODE') !== 'production' ||
      api.value('NAVER_ORDER_SYNC_ENABLED') === 'true' || api.value('NAVER_ORDER_INVENTORY_ENABLED') === 'true')
    throw new Error('UNSAFE_PREFLIGHT_CONFIGURATION');
  const existing = await db.query("select exists(select 1 from naver_order_sync_state where mode='production') or exists(select 1 from naver_order_inventory where mode='production') as found");
  if (existing.rows[0].found) throw new Error('PRODUCTION_LEDGER_ALREADY_EXISTS');
  const end = now - 30000;
  // The owner confirmed there have been no real orders. Any recent history requires reconciliation.
  for (let day = 30; day > 0; day--) {
    // Space read requests and retry only the provider's explicit throttling response.
    if (day < 30) await pause(2000);
    let page;
    for (let attempt = 0; ; attempt++) {
      try {
        page = await api.changes(new Date(end - day * 86400000), new Date(end - (day - 1) * 86400000));
        break;
      } catch (error) {
        if (!(error instanceof NaverApiError) || error.code !== 'GW.RATE_LIMIT' || attempt >= 3) throw error;
        await pause(5000 * (attempt + 1));
      }
    }
    if (page.lastChangeStatuses.length || page.more) throw new Error('EXISTING_ORDERS_REQUIRE_RECONCILIATION');
  }
  return { authenticated: true, historyDaysChecked: 30, recentOrderHistoryEmpty: true, startsAt: new Date(end).toISOString() };
}
module.exports = { preflight };
if (require.main === module) {
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  preflight(new NaverOrderApiClient(new ConfigService(process.env)), db)
    .then(result => console.log(JSON.stringify(result)))
    .catch(e => {
      const allowed = ['UNSAFE_PREFLIGHT_CONFIGURATION', 'PRODUCTION_LEDGER_ALREADY_EXISTS', 'EXISTING_ORDERS_REQUIRE_RECONCILIATION'];
      console.error(JSON.stringify({ preflightPassed: false, code: e instanceof NaverApiError ? e.code : allowed.includes(e.message) ? e.message : 'PREFLIGHT_FAILED' }));
      process.exitCode = 1;
    }).finally(() => db.end());
}
