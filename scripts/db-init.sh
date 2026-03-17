#!/usr/bin/env bash
# -e is exit on error (nonzero exit on a command, script stops)
# -u causes exit when a variable referenced isn't set
# -o pipefail means that false | true will evaluate to false (any piped command failing = failure)

set -euo pipefail

CONTAINER_NAME="imageboard-pg"
DB_NAME="${1:-imageboard}"
DB_USER="postgres"

echo "Ensuring database exists and applying schema: $DB_NAME (container: $CONTAINER_NAME)"

# Ensure container exists
podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" || {
  echo "Error: container '$CONTAINER_NAME' is not running."
  exit 1
}

if ! podman exec -i "$CONTAINER_NAME" \
  psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" \
  | grep -q 1; then
  podman exec -i "$CONTAINER_NAME" \
    psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${DB_NAME}\";"
fi

podman exec -i "$CONTAINER_NAME" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < db/schema.sql

echo "Schema applied successfully to $DB_NAME."

