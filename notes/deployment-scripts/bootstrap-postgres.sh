#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   sudo APP_DB_PASS='replace-me' bash notes/deployment-scripts/bootstrap-postgres.sh
#
# Optional overrides:
#   APP_DB_USER=bjord_app
#   APP_DB_NAME=bjord
#   APP_DB_HOST=127.0.0.1
#   APP_DB_PORT=5432

APP_DB_USER="${APP_DB_USER:-bjord_app}"
APP_DB_NAME="${APP_DB_NAME:-bjord}"
APP_DB_HOST="${APP_DB_HOST:-127.0.0.1}"
APP_DB_PORT="${APP_DB_PORT:-5432}"
APP_DB_PASS="${APP_DB_PASS:-}"

if [[ -z "${APP_DB_PASS}" ]]; then
  echo "ERROR: APP_DB_PASS is required" >&2
  exit 1
fi

if [[ ! -f "db/schema.sql" ]]; then
  echo "ERROR: run this from the repository root (db/schema.sql not found)" >&2
  exit 1
fi

sudo -u postgres psql \
  -v ON_ERROR_STOP=1 \
  --set=db_user="${APP_DB_USER}" \
  --set=db_name="${APP_DB_NAME}" \
  --set=db_pass="${APP_DB_PASS}" <<'SQL'

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db_name')
\gexec
SQL

PGPASSWORD="${APP_DB_PASS}" psql \
  -v ON_ERROR_STOP=1 \
  -h "${APP_DB_HOST}" \
  -p "${APP_DB_PORT}" \
  -U "${APP_DB_USER}" \
  -d "${APP_DB_NAME}" \
  -f db/schema.sql

echo "Done."
echo "Set DATABASE_URL with a URL-encoded password if it has special characters."
echo "Example (redacted): postgres://${APP_DB_USER}:<urlencoded-password>@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}"
echo "Helper: APP_DB_PASS='<password>' APP_DB_USER='${APP_DB_USER}' APP_DB_NAME='${APP_DB_NAME}' bash notes/deployment-scripts/print-database-url.sh"
