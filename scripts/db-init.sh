#!/usr/bin/env bash
# -e is exit on error (nonzero exit on a command, script stops)
# -u causes exit when a variable referenced isn't set
# -o pipefail means that false | true will evaluate to false (any piped command failing = failure)

set -euo pipefail

CONTAINER_NAME="imageboard-pg"
DB_NAME="imageboard"
DB_USER="postgres"

echo "Applying schema inside container: $CONTAINER_NAME"

# Ensure container exists
podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$" || {
  echo "Error: container '$CONTAINER_NAME' is not running."
  exit 1
}

podman exec -i "$CONTAINER_NAME" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  < db/schema.sql

echo "Schema applied successfully."

