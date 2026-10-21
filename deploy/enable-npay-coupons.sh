#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.deploy "$@"; }
compose exec -T api node scripts/check-npay-production-health.cjs
# Full Sandbox lifecycle, including provider XML revalidation, must have been observed first.
compose exec -T api node - <<'CHECK'
const {Pool}=require('pg');
(async()=>{const db=new Pool({connectionString:process.env.DATABASE_URL});try{
 const r=await db.query("select exists(select 1 from naver_coupon_checkouts where mode='sandbox' and state='cancelled' and validated_at is not null and redeemed_at is not null and released_at is not null and created_at>now()-interval '7 days') as verified");
 if(!r.rows[0].verified)throw Error('SANDBOX_COUPON_LIFECYCLE_NOT_VERIFIED');
 console.log('Sandbox coupon payment and cancellation verified');
}finally{await db.end()}})().catch(e=>{console.error(e.message==='SANDBOX_COUPON_LIFECYCLE_NOT_VERIFIED'?e.message:'COUPON_CHECK_FAILED');process.exit(1)});
CHECK
umask 077
backup=".env.deploy.before-npay-coupons.$(date -u +%Y%m%dT%H%M%SZ).local"
cp .env.deploy "$backup"
chmod 600 "$backup"
rollback(){ cp "$backup" .env.deploy; compose up -d --no-deps --wait --wait-timeout 180 api; }
trap 'rollback' EXIT
python3 - <<'ENV'
from pathlib import Path
import re
p=Path('.env.deploy');s=p.read_text()
line='NAVER_COUPON_CHECKOUT_ENABLED=true'
s=re.sub(r'^NAVER_COUPON_CHECKOUT_ENABLED=.*$',line,s,flags=re.M) if re.search(r'^NAVER_COUPON_CHECKOUT_ENABLED=',s,re.M) else s.rstrip()+'\n'+line+'\n'
p.write_text(s);p.chmod(0o600)
ENV
compose up -d --no-deps --wait --wait-timeout 180 api
compose exec -T api node scripts/check-npay-production-health.cjs
compose exec -T api node - <<'VERIFY'
(async()=>{const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/shop/naver-order/config');const c=await r.json();if(!r.ok||!c.enabled||!c.couponCheckoutEnabled)process.exit(1);console.log(JSON.stringify({productionCouponCheckoutEnabled:true}))})().catch(()=>process.exit(1));
VERIFY
trap - EXIT
