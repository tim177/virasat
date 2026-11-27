# Shared helpers for the server scripts (deploy, cron, backup). Sourced, not run.

ENV_FILE="${APP_ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE (see deploy/README.md)" >&2
  exit 1
fi
export APP_ENV_FILE="$ENV_FILE"
# Git Bash on Windows (local tests) would turn container paths like /app into Windows paths.
# No effect on Linux.
export MSYS_NO_PATHCONV=1

compose() {
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" "$@"
}

# One value from the env file, read as text (never run as shell code), without quotes.
env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}
