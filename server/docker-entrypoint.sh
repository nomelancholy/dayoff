#!/bin/sh
set -e
npx drizzle-kit migrate --config=drizzle.deploy.config.cjs
exec node dist/main.js
