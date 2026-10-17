#!/bin/sh
# This workflow can configure only sandbox/shadow synchronization, never live stock.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
test -f .env.deploy
umask 077
backup=$(mktemp .env.deploy.before-npay-api.XXXXXX.local)
cp .env.deploy "$backup"
chmod 600 "$backup"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.deploy "$@"; }
rollback() {
  result=$?
  trap - EXIT
  unset NPAY_ORDER_API_SETUP_B64
  if [ "$result" -ne 0 ]; then
    cp "$backup" .env.deploy
    chmod 600 .env.deploy
    compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api || true
    compose exec -T web nginx -s reload || true
  fi
  exit "$result"
}
trap rollback EXIT
python3 - <<'PYENV'
from pathlib import Path
from datetime import datetime, timezone, timedelta
import base64, json, os, re
p=Path('.env.deploy')
text=p.read_text()
payload=json.loads(base64.b64decode(os.environ['NPAY_ORDER_API_SETUP_B64'], validate=True))
assert set(payload)=={'NAVER_ORDER_API_CLIENT_ID','NAVER_ORDER_API_CLIENT_SECRET'}, 'Unexpected payload fields'
assert re.fullmatch(r'[A-Za-z0-9_-]{1,128}', payload['NAVER_ORDER_API_CLIENT_ID']), 'Invalid application ID format'
assert re.fullmatch(r'\$2[ab]\$\d{2}\$[./A-Za-z0-9]{22}', payload['NAVER_ORDER_API_CLIENT_SECRET']), 'Invalid secret format'
def current(key):
    values=re.findall(r'^'+key+r'=(.*)$',text,re.M)
    assert len(values)<=1, 'Duplicate environment key'
    return values[0].strip().strip("\"'") if values else ''
assert current('NAVER_ORDER_MODE')=='production', 'Checkout must remain production'
assert current('NAVER_ORDER_INVENTORY_ENABLED')!='true', 'Live inventory is already active'
assert current('NAVER_ORDER_API_MODE') in ('','sandbox'), 'Do not replace production API configuration'
updates={**payload,'NAVER_ORDER_API_MODE':'sandbox','NAVER_ORDER_SYNC_ENABLED':'true','NAVER_ORDER_INVENTORY_ENABLED':'false', 'NAVER_ORDER_SYNC_START_AT':current('NAVER_ORDER_SYNC_START_AT') or (datetime.now(timezone.utc)-timedelta(hours=1)).isoformat(timespec='milliseconds')}
for key,val in updates.items():
    pattern=r'^'+key+r'=.*$'
    line=key+"='"+val+"'"
    text=re.sub(pattern,lambda _:line,text,flags=re.M) if re.search(pattern,text,re.M) else text.rstrip()+'\n'+line+'\n'
tmp=p.with_name('.env.deploy.npay-api.tmp')
tmp.write_text(text);os.chmod(tmp,0o600);os.replace(tmp,p)
print('Sandbox order API configured; live checkout preserved; inventory writes disabled.')
PYENV
unset NPAY_ORDER_API_SETUP_B64
compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api
compose exec -T web nginx -s reload
compose exec -T api node scripts/check-npay-order-api.cjs
compose exec -T api node - <<'JS'
const { Pool } = require('pg');
(async () => {
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  try {
    const r=await pool.query("select mode, cursor, last_success_at, last_error, inventory_enabled from naver_order_sync_state where mode='sandbox'");
    console.log(JSON.stringify({sync:r.rows,liveStockWrites:process.env.NAVER_ORDER_INVENTORY_ENABLED==='true'}));
    const config=await (await fetch('http://127.0.0.1:'+process.env.PORT+'/shop/naver-order/config')).json();
    if(!config.enabled||config.sdkUrl!=='https://npay-order.pstatic.net/assets/button/latest/npay.button.js')throw Error('Checkout config mismatch');
    console.log('Production checkout preserved.');
  } finally {await pool.end();}
})().catch(()=>{console.error('Post-setup verification failed');process.exit(1)});
JS
trap - EXIT
