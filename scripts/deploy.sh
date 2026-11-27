#!/usr/bin/env bash
# Deploys the current code: database, migrations, a fresh build, then a restart.
#
#   On the server, from the repo folder:   bash scripts/deploy.sh
#   Local test of the production setup:    APP_ENV_FILE=deploy/local.env SKIP_PULL=1 bash scripts/deploy.sh
#
# Settings come from .env (or APP_ENV_FILE). Steps and first-time setup: deploy/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib.sh

if [ "${SKIP_PULL:-}" != "1" ]; then
  echo "→ Getting the latest code"
  git pull --ff-only
fi

# The web build reads the catalogue (to prerender the shop) through Postgres on 127.0.0.1.
POSTGRES_PASSWORD="$(env_value POSTGRES_PASSWORD)"
POSTGRES_HOST_PORT="$(env_value POSTGRES_HOST_PORT)"
export BUILD_DATABASE_URL="postgresql://virasat:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT:-5432}/virasat"
SENTRY_AUTH_TOKEN="$(env_value SENTRY_AUTH_TOKEN)"
export SENTRY_AUTH_TOKEN
# A new value every time, so the build step always runs (see the Dockerfile).
BUILD_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD 2>/dev/null || echo local)"
export BUILD_ID

echo "→ Starting the database"
compose up -d --wait postgres

echo "→ Applying database migrations"
compose --profile tools build tools
compose --profile tools run --rm tools pnpm db:deploy

echo "→ Building the app"
compose build web

echo "→ Starting the app and HTTPS"
compose up -d --wait web caddy

docker image prune --force >/dev/null
echo "✓ Deployed. Check $(env_value SITE_URL)/api/health"
