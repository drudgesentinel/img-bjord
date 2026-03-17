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

sudo -u postgres psql <<SQL
DO \
\$\$\
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
    CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASS}';
  ELSE
    ALTER ROLE ${APP_DB_USER} WITH LOGIN PASSWORD '${APP_DB_PASS}';
  END IF;
END
\$\$;

DO \
\$\$\
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${APP_DB_NAME}') THEN
    CREATE DATABASE ${APP_DB_NAME} OWNER ${APP_DB_USER};
  END IF;
END
\$\$;

REVOKE ALL ON DATABASE ${APP_DB_NAME} FROM PUBLIC;
SQL

psql "postgres://${APP_DB_USER}:${APP_DB_PASS}@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}" -f db/schema.sql

echo "Done. Set DATABASE_URL to:"
echo "postgres://${APP_DB_USER}:<redacted>@${APP_DB_HOST}:${APP_DB_PORT}/${APP_DB_NAME}"
