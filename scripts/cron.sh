#!/usr/bin/env bash
# Runs a scheduled job: bash scripts/cron.sh emails|drafts|fit-calls
# Called by cron (deploy/crontab). It calls the app's protected /api/cron/<job> route from inside
# the web container, with CRON_SECRET, so the request never leaves the server.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib.sh

job="${1:-}"
case "$job" in
  emails | drafts | fit-calls) ;;
  *)
    echo "Usage: scripts/cron.sh emails|drafts|fit-calls" >&2
    exit 1
    ;;
esac

compose exec -T web node -e '
const job = process.argv[1];
fetch(`http://127.0.0.1:3000/api/cron/${job}`, {
  method: "POST",
  headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
})
  .then(async (response) => {
    console.log(new Date().toISOString(), job, response.status, await response.text());
    process.exit(response.ok ? 0 : 1);
  })
  .catch((error) => {
    console.error(new Date().toISOString(), job, error);
    process.exit(1);
  });
' "$job"
