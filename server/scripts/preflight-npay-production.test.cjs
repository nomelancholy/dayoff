const test = require('node:test');
const assert = require('node:assert/strict');
const { preflight } = require('./preflight-npay-production.cjs');
function setup() {
 const values={NAVER_ORDER_MODE:'production',NAVER_ORDER_SYNC_ENABLED:'false',NAVER_ORDER_INVENTORY_ENABLED:'false'};
 const windows=[];
 return {windows,values,api:{mode:()=> 'production',value:k=>values[k],changes:async(a,b)=>{windows.push([+a,+b]);return {lastChangeStatuses:[]}}},db:{query:async()=>({rows:[{found:false}]})}};
}
test('read-only gate checks all 30 daily windows and preserves delayed boundary',async()=>{const s=setup(),now=Date.now(); const r=await preflight(s.api,s.db,now);assert.equal(s.windows.length,30);assert.equal(s.windows.at(-1)[1],now-30000);assert.equal(s.windows[0][0],now-30000-30*86400000); assert.equal(r.startsAt,new Date(now-30000).toISOString());assert.equal(r.recentOrderHistoryEmpty,true)});
test('refuses enabled writes or scheduled sync',async()=>{for(const key of ['NAVER_ORDER_INVENTORY_ENABLED','NAVER_ORDER_SYNC_ENABLED']){const s=setup();s.values[key]='true';await assert.rejects(preflight(s.api,s.db),/UNSAFE_PREFLIGHT/);assert.equal(s.windows.length,0)}});
test('refuses existing production ledger',async()=>{const s=setup();s.db.query=async()=>({rows:[{found:true}]});await assert.rejects(preflight(s.api,s.db),/LEDGER_ALREADY_EXISTS/);assert.equal(s.windows.length,0)});
test('any recent order requires manual reconciliation',async()=>{const s=setup();s.api.changes=async()=>({lastChangeStatuses:[{}]});await assert.rejects(preflight(s.api,s.db),/RECONCILIATION/)});
test('pagination cannot silently hide orders',async()=>{const s=setup();s.api.changes=async()=>({lastChangeStatuses:[],more:{}});await assert.rejects(preflight(s.api,s.db),/RECONCILIATION/)});
test('provider error never produces activation receipt',async()=>{const s=setup();s.api.changes=async()=>{throw Error('network')};await assert.rejects(preflight(s.api,s.db),/network/)});
