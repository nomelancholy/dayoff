#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
umask 077
test -f .env.deploy
backup=$(mktemp .env.deploy.before-npay-production.XXXXXX.local)
receipt=$(mktemp .npay-production-preflight.XXXXXX.local)
cp .env.deploy "$backup"
activated=false
compose() { docker compose -f docker-compose.prod.yml --env-file .env.deploy "$@"; }
cleanup() {
  result=$?
  trap - EXIT
  unset NPAY_ORDER_API_PRODUCTION_SETUP_B64
  rm -f "$receipt"
  if [ "$result" -ne 0 ]; then
    if [ "$activated" = true ]; then
      python3 deploy/configure-npay-production.py stop
      echo 'Activation verification failed: sync stopped; production cutover and ledger preserved.'
    else
      cp "$backup" .env.deploy
      echo 'Preflight failed: prior environment restored; live inventory was not enabled.'
    fi
    compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api || true
    compose exec -T web nginx -s reload || true
  fi
  exit "$result"
}
trap cleanup EXIT
mkdir -p backups
chmod 700 backups
snapshot="backups/pre-npay-production-$(date -u +%Y%m%dT%H%M%SZ).dump"
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$snapshot"
test -s "$snapshot"
compose exec -T postgres pg_restore --list < "$snapshot" > /dev/null
python3 deploy/configure-npay-production.py install
unset NPAY_ORDER_API_PRODUCTION_SETUP_B64
compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api
compose exec -T web nginx -s reload
compose exec -T api node scripts/preflight-npay-production.cjs > "$receipt"
cat "$receipt"
python3 deploy/configure-npay-production.py activate "$receipt"
activated=true
compose up -d --no-deps --force-recreate --wait --wait-timeout 180 api
compose exec -T web nginx -s reload
attempt=0
until compose exec -T api node scripts/check-npay-production-health.cjs; do
  attempt=$((attempt+1))
  [ "$attempt" -lt 12 ] || exit 1
  sleep 5
done
trap - EXIT
rm -f "$receipt"
echo 'Production order API and inventory synchronization activated.'
