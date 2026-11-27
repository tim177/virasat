#!/usr/bin/env bash
# Nightly backup (deploy/crontab): the database, plus product photos stored on the server
# (when R2 isn't used). Copied to Google Cloud Storage when BACKUP_BUCKET is set in .env.
# Keeps 7 days on the server; the bucket keeps 30 (lifecycle rule, deploy/README.md).
# Prove a backup restores with: bash scripts/restore-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib.sh

dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
dir="${dir:-/var/backups/virasat}"
mkdir -p "$dir"
chmod 700 "$dir"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
db="$dir/db-$stamp.dump"
photos="$dir/uploads-$stamp.tar.gz"

compose exec -T postgres pg_dump -U virasat -d virasat --format=custom >"$db.partial"
mv "$db.partial" "$db"
compose exec -T web tar -czf - -C /app uploads >"$photos.partial"
mv "$photos.partial" "$photos"

if [ ! -s "$db" ]; then
  echo "The database backup is empty: $db" >&2
  exit 1
fi

bucket="$(env_value BACKUP_BUCKET)"
if [ -n "$bucket" ]; then
  gcloud storage cp "$db" "$photos" "gs://$bucket/"
fi

find "$dir" -name 'db-*.dump' -mtime +7 -delete
find "$dir" -name 'uploads-*.tar.gz' -mtime +7 -delete
echo "✓ Backup $stamp ($(du -h "$db" | cut -f1) database)${bucket:+, copied to gs://$bucket}"
