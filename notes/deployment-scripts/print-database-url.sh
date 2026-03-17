#!/usr/bin/env bash
set -euo pipefail

# Prints a DATABASE_URL line with URL-encoded password.
#
# Usage examples:
#   APP_DB_PASS='your-password' bash notes/deployment-scripts/print-database-url.sh
#   APP_DB_USER=bjord_app APP_DB_PASS='your-password' APP_DB_NAME=bjord bash notes/deployment-scripts/print-database-url.sh
#
# Optional overrides:
#   APP_DB_SCHEME=postgres
#   APP_DB_USER=bjord_app
#   APP_DB_PASS=<required>
#   APP_DB_HOST=127.0.0.1
#   APP_DB_PORT=5432
#   APP_DB_NAME=bjord

APP_DB_SCHEME="${APP_DB_SCHEME:-postgres}"
APP_DB_USER="${APP_DB_USER:-bjord_app}"
APP_DB_PASS="${APP_DB_PASS:-}"
APP_DB_HOST="${APP_DB_HOST:-127.0.0.1}"
APP_DB_PORT="${APP_DB_PORT:-5432}"
APP_DB_NAME="${APP_DB_NAME:-bjord}"

if [[ -z "${APP_DB_PASS}" ]]; then
  echo "ERROR: APP_DB_PASS is required" >&2
  exit 1
fi

ENCODED_PASS="$(python3 - <<'PY' "${APP_DB_PASS}"
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=''))
PY
)"

echo "DATABASE_URL=${APP_DB_SCHEME}://${APP_DB_USER}:${ENCODED_PASS}@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}"
