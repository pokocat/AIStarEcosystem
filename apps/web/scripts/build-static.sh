#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/src/app/api"
API_BACKUP_DIR="$ROOT_DIR/src/app/__api_static_build_backup__"

cleanup() {
  if [ -d "$API_BACKUP_DIR" ]; then
    mv "$API_BACKUP_DIR" "$API_DIR"
  fi
}

trap cleanup EXIT

if [ -d "$API_DIR" ]; then
  rm -rf "$API_BACKUP_DIR"
  mv "$API_DIR" "$API_BACKUP_DIR"
fi

cd "$ROOT_DIR"
NEXT_PUBLIC_MOCK=true npx next build
