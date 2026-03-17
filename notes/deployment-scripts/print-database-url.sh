#!/usr/bin/env bash
set -euo pipefail

# Prints a DATABASE_URL line with URL-encoded password.
# Also writes/updates DATABASE_URL in an env file by default.
#
# Usage examples:
#   APP_DB_PASS='your-password' bash notes/deployment-scripts/print-database-url.sh
#   APP_DB_USER=bjord_app APP_DB_PASS='your-password' APP_DB_NAME=bjord bash notes/deployment-scripts/print-database-url.sh
#   sudo APP_DB_PASS='your-password' bash notes/deployment-scripts/print-database-url.sh
#
# Optional overrides:
#   APP_DB_SCHEME=postgres
#   APP_DB_USER=bjord_app
#   APP_DB_PASS=<required>
#   APP_DB_HOST=127.0.0.1
#   APP_DB_PORT=5432
#   APP_DB_NAME=bjord
#   APP_ENV_FILE=/etc/bjord/bjord.env
#   WRITE_ENV=true|false   (default: true)

APP_DB_SCHEME="${APP_DB_SCHEME:-postgres}"
APP_DB_USER="${APP_DB_USER:-bjord_app}"
APP_DB_PASS="${APP_DB_PASS:-}"
APP_DB_HOST="${APP_DB_HOST:-127.0.0.1}"
APP_DB_PORT="${APP_DB_PORT:-5432}"
APP_DB_NAME="${APP_DB_NAME:-bjord}"
APP_ENV_FILE="${APP_ENV_FILE:-/etc/bjord/bjord.env}"
WRITE_ENV="${WRITE_ENV:-true}"

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

DATABASE_URL_VALUE="${APP_DB_SCHEME}://${APP_DB_USER}:${ENCODED_PASS}@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}"
DATABASE_URL_LINE="DATABASE_URL=${DATABASE_URL_VALUE}"

echo "${DATABASE_URL_LINE}"

if [[ "${WRITE_ENV}" == "true" ]]; then
  env_dir="$(dirname "${APP_ENV_FILE}")"

  if [[ ! -d "${env_dir}" ]]; then
    if ! mkdir -p "${env_dir}" 2>/dev/null; then
      echo "WARN: could not create ${env_dir}; skipping env file update" >&2
      exit 0
    fi
  fi

  if [[ ! -f "${APP_ENV_FILE}" ]]; then
    if ! touch "${APP_ENV_FILE}" 2>/dev/null; then
      echo "WARN: could not write ${APP_ENV_FILE}; skipping env file update" >&2
      exit 0
    fi
  fi

  if [[ ! -w "${APP_ENV_FILE}" ]]; then
    echo "WARN: ${APP_ENV_FILE} is not writable; run with sudo or set WRITE_ENV=false" >&2
    exit 0
  fi

  tmp_file="$(mktemp)"
  awk -v new_line="${DATABASE_URL_LINE}" '
    BEGIN { replaced = 0 }
    /^DATABASE_URL=/ {
      if (!replaced) {
        print new_line
        replaced = 1
      }
      next
    }
    { print }
    END {
      if (!replaced) print new_line
    }
  ' "${APP_ENV_FILE}" > "${tmp_file}"

  cat "${tmp_file}" > "${APP_ENV_FILE}"
  rm -f "${tmp_file}"

  echo "Updated ${APP_ENV_FILE}"
fi
