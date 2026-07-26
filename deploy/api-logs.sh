#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

tail_lines=${LOG_TAIL:-200}

exec docker compose \
  -f docker-compose.prod.yml \
  --env-file .env.deploy \
  logs \
  --tail="$tail_lines" \
  -f \
  api
