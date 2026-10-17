// Read-only connectivity probe. No credentials, token, customer data or order IDs in output.
const { ConfigService } = require('@nestjs/config');
const { NaverOrderApiClient, NaverApiError } = require('../dist/src/shop/naver-order-api.client');
(async () => {
  const api = new NaverOrderApiClient(new ConfigService(process.env));
  const end = new Date(Date.now() - 30000);
  const page = await api.changes(new Date(end.getTime() - 3600000), end);
  const ids = [...new Set(page.lastChangeStatuses.map(o => o.productOrderId))];
  const details = ids.length ? await api.details(ids) : [];
  console.log(JSON.stringify({ mode: api.mode(), authenticated: true, changedOrders: ids.length, detailsRead: details.length, hasMore: !!page.more, inventoryModified: false }));
})().catch(e => { console.error(JSON.stringify({ authenticated: false, code: e instanceof NaverApiError ? e.code : 'CHECK_FAILED' })); process.exit(1); });
