#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.deploy "$@"; }
case "$1" in
  prepare) compose exec -T -e SANDBOX_RESULT_PUBLIC_KEY="$SANDBOX_RESULT_PUBLIC_KEY" api node scripts/npay-coupon-sandbox.cjs prepare ;;
  sync)
    # Recover the already-installed sandbox credential only inside the server. No key leaves it.
    python3 - <<'PYKEY' | compose exec -T api node scripts/npay-coupon-sandbox.cjs sync
from pathlib import Path
import json,re
for p in sorted(Path('.').glob('.env.deploy.before-npay-production.*.local')):
    text=p.read_text()
    def value(key):
        m=re.search(r'^'+key+r'=(.*)$',text,re.M)
        return m.group(1).strip().strip("\"'") if m else ''
    if value('NAVER_ORDER_API_MODE')=='sandbox':
        keys={k:value(k) for k in ['NAVER_ORDER_API_CLIENT_ID','NAVER_ORDER_API_CLIENT_SECRET']}
        if all(keys.values()):
            print(json.dumps(keys));break
else: raise SystemExit('Sandbox credential backup not found')
PYKEY
    ;;
  enable-production) sh deploy/enable-npay-coupons.sh ;;
  *) exit 2 ;;
esac
compose exec -T api node scripts/check-npay-production-health.cjs
