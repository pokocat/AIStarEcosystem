#!/usr/bin/env bash
# Build only the independent Studio operations dashboard.
# This script never builds apps/server or apps/web-aiavatar.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/dist/deploy/$RELEASE_ID}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_TYPECHECK="${SKIP_TYPECHECK:-0}"
SKIP_TEST="${SKIP_TEST:-0}"

export NEXT_PUBLIC_USE_MOCK=0
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-/api}"
export NEXT_PUBLIC_SERVER_API_BASE="${NEXT_PUBLIC_SERVER_API_BASE:-http://127.0.0.1:8080}"
export NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH="${NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH:-/admin}"
export COPYFILE_DISABLE=1
export CI="${CI:-true}"

log() { printf '\033[1;34m[studio-admin-build]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[studio-admin-build] %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail "invalid RELEASE_ID"
[[ "$NEXT_PUBLIC_API_BASE_URL" == "/api" ]] || fail "production dashboard must use same-origin /api"
[[ "$NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH" == "/admin" ]] || fail "production dashboard base path must be /admin"
[[ "$NEXT_PUBLIC_SERVER_API_BASE" =~ ^http://127\.0\.0\.1:[0-9]+$ ]] || \
  fail "NEXT_PUBLIC_SERVER_API_BASE must remain a loopback URL"

if [[ "$SKIP_INSTALL" != "1" ]]; then
  pnpm install --frozen-lockfile
fi
if [[ "$SKIP_TYPECHECK" != "1" ]]; then
  pnpm --filter @ai-star-eco/studio-admin run typecheck
fi
if [[ "$SKIP_TEST" != "1" ]]; then
  pnpm --filter @ai-star-eco/studio-admin run test
fi

log "building standalone dashboard"
pnpm --filter @ai-star-eco/studio-admin run build

TMP="$OUT_DIR/.tmp-studio-admin"
rm -rf "$TMP"
mkdir -p "$TMP/apps/web-aiavatar/studio-admin/.next"
cp -a apps/web-aiavatar/studio-admin/.next/standalone/. "$TMP/"
cp -a apps/web-aiavatar/studio-admin/.next/static "$TMP/apps/web-aiavatar/studio-admin/.next/static"
if [[ -d apps/web-aiavatar/studio-admin/public ]]; then
  cp -a apps/web-aiavatar/studio-admin/public "$TMP/apps/web-aiavatar/studio-admin/public"
fi
find "$TMP" -type f \( -name '.env' -o -name '.env.*' \) -delete

mkdir -p "$OUT_DIR"
TAR_ARGS=()
if tar --no-xattrs -cf /dev/null --files-from /dev/null >/dev/null 2>&1; then
  TAR_ARGS+=(--no-xattrs)
fi
if tar --no-mac-metadata -cf /dev/null --files-from /dev/null >/dev/null 2>&1; then
  TAR_ARGS+=(--no-mac-metadata)
fi
tar "${TAR_ARGS[@]}" -C "$TMP" -czf "$OUT_DIR/studio-admin.tar.gz" .
rm -rf "$TMP"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_DIR/studio-admin.tar.gz" > "$OUT_DIR/studio-admin.sha256"
else
  shasum -a 256 "$OUT_DIR/studio-admin.tar.gz" > "$OUT_DIR/studio-admin.sha256"
fi

printf 'RELEASE_ID=%s\nGIT_SHA=%s\nSERVICE=studio-admin\n' \
  "$RELEASE_ID" "$(git rev-parse HEAD 2>/dev/null || echo unknown)" \
  > "$OUT_DIR/studio-admin-manifest.env"

log "release ready: $OUT_DIR/studio-admin.tar.gz"
