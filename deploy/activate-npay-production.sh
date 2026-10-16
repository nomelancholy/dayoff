#!/bin/sh
# 최종 승인 후 명시적으로 실행합니다. 기존 인증키는 재사용하며 출력하지 않습니다.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
test -f .env.deploy
umask 077
backup=$(mktemp .env.deploy.before-npay-production.XXXXXX.local)
cp .env.deploy "$backup"
chmod 600 "$backup"
compose() { docker compose -f docker-compose.prod.yml --env-file .env.deploy "$@"; }
rollback() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    echo 'Activation failed; restoring previous Npay environment.' >&2
    cp "$backup" .env.deploy
    chmod 600 .env.deploy
    compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api || true
    compose exec -T web nginx -s reload || true
  fi
  exit "$result"
}
trap rollback EXIT
python3 - <<'PY'
from pathlib import Path
import os, re
p = Path('.env.deploy')
text = p.read_text()
def value(key):
    matches = re.findall(r'^' + key + r'=(.*)$', text, re.M)
    assert len(matches) == 1, 'Missing or duplicate required setting: ' + key
    return matches[0].strip().strip('\"\'')
for key in ['NAVER_ORDER_MERCHANT_ID', 'NAVER_ORDER_CERTI_KEY', 'NAVER_ORDER_BUTTON_KEY', 'NAVER_ORDER_ACCOUNT_ID']:
    assert value(key), 'Missing Npay credential'
assert value('FRONTEND_URL').rstrip('/') == 'https://dayoff.today', 'Unexpected frontend origin'
updates = {
    'NAVER_ORDER_ENABLED': 'true',
    'NAVER_ORDER_MODE': 'production',
    'NAVER_ORDER_AUDIENCE': 'public',
    'NAVER_ORDER_PRODUCTION_READY': 'true',
    'NAVER_REVIEW_LOGIN_ENABLED': 'false',
    'NAVER_ORDER_REVIEW_USER_IDS': '',
}
# NAVER_REVIEW_USER_ID는 유지하여 기존 검수 세션도 계속 거부합니다.
for key, val in updates.items():
    pattern = r'^' + key + r'=.*$'
    line = key + "='" + val + "'"
    text = re.sub(pattern, lambda _: line, text, flags=re.M) if re.search(pattern, text, re.M) else text.rstrip() + '\n' + line + '\n'
tmp = p.with_name('.env.deploy.npay-production.tmp')
tmp.write_text(text)
os.chmod(tmp, 0o600)
os.replace(tmp, p)
print('Npay production/public enabled; review login disabled; credentials preserved.')
PY
compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api
compose exec -T web nginx -s reload
compose exec -T api node - <<'JS'
(async () => {
  const base = 'http://127.0.0.1:' + (process.env.PORT || '4000');
  const r = await fetch(base + '/shop/naver-order/config');
  const c = await r.json();
  if (!r.ok || !c.enabled || c.sdkUrl !== 'https://npay-order.pstatic.net/assets/button/latest/npay.button.js' || c.orderHistoryUrl !== 'https://pay.naver.com') throw Error('Production config check failed');
  const denied = await fetch(base + '/auth/npay-review/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({identifier: 'npay_test', password: 'disabled-login-check'})});
  if (denied.status !== 403) throw Error('Review login is not disabled');
  console.log('Verified public production config and disabled review login.');
})().catch(e => {console.error(e.message); process.exit(1)});
JS
trap - EXIT
echo 'Npay production activation completed.'
