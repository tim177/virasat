#!/usr/bin/env bash
# Proves a backup can be restored, without touching the live database:
#   bash scripts/restore-check.sh                     (the newest backup)
#   bash scripts/restore-check.sh path/to/db-….dump   (a given one, e.g. downloaded from the bucket)
# Restores it into a temporary database, prints what's in it, then removes it.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib.sh

dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
dir="${dir:-/var/backups/virasat}"
dump="${1:-$(ls -t "$dir"/db-*.dump 2>/dev/null | head -n 1)}"
if [ -z "$dump" ] || [ ! -s "$dump" ]; then
  echo "No backup found in $dir. Run bash scripts/backup.sh first." >&2
  exit 1
fi

check_db=virasat_restore_check
psql() { compose exec -T postgres psql -U virasat -v ON_ERROR_STOP=1 "$@"; }

echo "→ Restoring $dump into a temporary database"
psql -d postgres -c "SET client_min_messages TO warning" \
  -c "DROP DATABASE IF EXISTS $check_db" -c "CREATE DATABASE $check_db" >/dev/null
compose exec -T postgres pg_restore -U virasat -d "$check_db" --no-owner --exit-on-error <"$dump"

psql -d "$check_db" -c "SELECT
  (SELECT count(*) FROM products) AS products,
  (SELECT count(*) FROM variants) AS sizes,
  (SELECT count(*) FROM orders) AS orders,
  (SELECT count(*) FROM users) AS users,
  (SELECT max(finished_at) FROM _prisma_migrations) AS last_migration"

psql -d postgres -c "DROP DATABASE $check_db" >/dev/null
echo "✓ The backup restores. (To restore for real, see deploy/README.md.)"
