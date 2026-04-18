#!/usr/bin/env bash
set -euo pipefail

DEV_HELP="$(./bjdev help)"
PROD_HELP="$(./bjprod help)"

normalize_help() {
  sed -E 's#\./bj(dev|prod)#./bj#g'
}

DEV_NORM="$(printf '%s\n' "$DEV_HELP" | normalize_help)"
PROD_NORM="$(printf '%s\n' "$PROD_HELP" | normalize_help)"

if [[ "$DEV_NORM" != "$PROD_NORM" ]]; then
  echo "bjdev and bjprod command surfaces differ"
  diff -u <(printf '%s\n' "$DEV_NORM") <(printf '%s\n' "$PROD_NORM") || true
  exit 1
fi

echo "bjdev and bjprod command surfaces are in parity"
