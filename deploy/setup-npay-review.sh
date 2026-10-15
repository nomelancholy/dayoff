#!/bin/sh
# 새 검수 로그인 코드가 포함된 API/Web 이미지를 배포한 뒤 운영 호스트에서 실행합니다.
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
if [ ! -f .env.deploy ]; then
  echo '운영 서버 프로젝트 디렉터리에 .env.deploy가 필요합니다.' >&2
  exit 1
fi

# API 서비스의 DATABASE_URL을 그대로 사용하므로 운영 DB에 생성됩니다.
# 호스트 폴더를 마운트하여 환경변수/비밀번호가 임시 컨테이너 삭제 후에도 보존됩니다.
# 진입점을 node로 지정해 계정 준비 때문에 별도 마이그레이션/서버를 실행하지 않습니다.
docker compose -f docker-compose.prod.yml --env-file .env.deploy \
  run --rm --no-deps --user "$(id -u):$(id -g)" \
  --volume "$project_dir:/review-setup" --entrypoint node \
  api scripts/setup-npay-review.mjs \
  --env-file /review-setup/.env.deploy --production-site

# restart만으로는 변경된 환경변수가 반영되지 않습니다.
docker compose -f docker-compose.prod.yml --env-file .env.deploy \
  up -d --no-deps --force-recreate api

# API 기동을 기다린 후 Nginx가 새 API 컨테이너 주소를 다시 해석하도록 합니다.
ready=false
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if docker compose -f docker-compose.prod.yml --env-file .env.deploy exec -T api \
    node -e 'fetch("http://127.0.0.1:" + (process.env.PORT || "4000") + "/").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'API 기동 확인 실패. 운영 로그를 확인해 주세요.' >&2
  exit 1
fi
docker compose -f docker-compose.prod.yml --env-file .env.deploy exec -T web nginx -s reload

echo "운영 검수 계정 정보: $project_dir/npay-review-credentials.local"
echo '운영 사이트 /npay-review 로그인 및 일반 방문자 비노출 확인 후 검수를 요청하세요.'
