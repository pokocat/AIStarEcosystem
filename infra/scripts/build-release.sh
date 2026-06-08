#!/usr/bin/env bash
# Build deployable artifacts for the current production topology.
#
# Usage:
#   ./infra/scripts/build-release.sh [services]
#
# services:
#   all                               -> server,web-music,web-drama,web-celebrity,web-aiavatar,admin,sau-service
#   server,web-celebrity,web-aiavatar,admin -> comma-separated
#   "server web-celebrity web-aiavatar admin" -> space-separated
#
# Output:
#   dist/deploy/<RELEASE_ID>/

set -euo pipefail
export PATH="/usr/local/bin:/opt/node-current/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DEFAULT_SERVICES="server web-music web-drama web-celebrity web-aiavatar admin sau-service"
RAW_SERVICES="${1:-${SERVICES:-all}}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/dist/deploy/$RELEASE_ID}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
SKIP_TYPECHECK="${SKIP_TYPECHECK:-0}"

export NEXT_PUBLIC_USE_MOCK="${NEXT_PUBLIC_USE_MOCK:-0}"
export NEXT_PUBLIC_ENABLE_DEV_LOGIN="${NEXT_PUBLIC_ENABLE_DEV_LOGIN:-0}"
export NEXT_PUBLIC_MIXCUT_USE_REAL="${NEXT_PUBLIC_MIXCUT_USE_REAL:-1}"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-/api}"
export NEXT_PUBLIC_SERVER_API_BASE="${NEXT_PUBLIC_SERVER_API_BASE:-http://127.0.0.1:8080}"
export COPYFILE_DISABLE="${COPYFILE_DISABLE:-1}"
export CI="${CI:-true}"

TAR_CREATE_EXTRA_ARGS=()
if tar --no-xattrs -cf /dev/null --files-from /dev/null >/dev/null 2>&1; then
  TAR_CREATE_EXTRA_ARGS+=(--no-xattrs)
fi
if tar --no-mac-metadata -cf /dev/null --files-from /dev/null >/dev/null 2>&1; then
  TAR_CREATE_EXTRA_ARGS+=(--no-mac-metadata)
fi

log() { printf "\033[1;34m[build-release]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m[build-release]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[build-release] %s\033[0m\n" "$*" >&2; exit 1; }

normalize_services() {
  local raw="${1//,/ }"
  local out="" item
  for item in $raw; do
    case "$item" in
      all)
        out="$out $DEFAULT_SERVICES"
        ;;
      server|web-music|web-drama|web-celebrity|web-aiavatar|admin|sau-service)
        out="$out $item"
        ;;
      "")
        ;;
      *)
        fail "unknown service '$item' (expected server|web-music|web-drama|web-celebrity|web-aiavatar|admin|sau-service|all)"
        ;;
    esac
  done

  # Deduplicate while preserving order.
  local seen=" " deduped=""
  for item in $out; do
    case "$seen" in
      *" $item "*) ;;
      *)
        seen="$seen$item "
        deduped="$deduped $item"
        ;;
    esac
  done
  printf "%s\n" "$deduped"
}

has_service() {
  local needle="$1" item
  for item in $SERVICES_LIST; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

copy_dir_contents() {
  local src="$1" dst="$2"
  mkdir -p "$dst"
  cp -a "$src"/. "$dst"/
}

make_tar_from_dir() {
  local src="$1" tarball="$2"
  (cd "$src" && tar "${TAR_CREATE_EXTRA_ARGS[@]}" -czf "$tarball" .)
}

strip_env_files() {
  local root="$1"
  find "$root" -type f \( -name '.env' -o -name '.env.*' \) -delete
}

write_checksums() {
  (
    cd "$OUT_DIR"
    rm -f checksums.sha256
    if command -v sha256sum >/dev/null 2>&1; then
      find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 sha256sum > checksums.sha256
    else
      find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 shasum -a 256 > checksums.sha256
    fi
  )
}

build_server() {
  log "building server jar"
  (cd apps/server && ./mvnw -DskipTests package)
  local jar="apps/server/target/ai-star-eco-server-1.0.0.jar"
  [[ -f "$jar" ]] || fail "missing server jar: $jar"
  mkdir -p "$OUT_DIR/server"
  cp "$jar" "$OUT_DIR/server/app.jar"
}

build_web_music() {
  log "building web-music standalone"
  if [[ "$SKIP_INSTALL" != "1" ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_TYPECHECK" != "1" ]]; then
    pnpm --filter @ai-star-eco/web-music run typecheck
  fi
  pnpm --filter @ai-star-eco/web-music run build

  local tmp="$OUT_DIR/.tmp/web-music"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  copy_dir_contents "apps/web-music/.next/standalone" "$tmp"
  copy_dir_contents "apps/web-music/.next/static" "$tmp/apps/web-music/.next/static"
  if [[ -d apps/web-music/public ]]; then
    copy_dir_contents "apps/web-music/public" "$tmp/apps/web-music/public"
  fi
  strip_env_files "$tmp"
  make_tar_from_dir "$tmp" "$OUT_DIR/web-music.tar.gz"
}

build_web_drama() {
  log "building web-drama standalone"
  if [[ "$SKIP_INSTALL" != "1" ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_TYPECHECK" != "1" ]]; then
    pnpm --filter @ai-star-eco/web-drama run typecheck
  fi
  pnpm --filter @ai-star-eco/web-drama run build

  local tmp="$OUT_DIR/.tmp/web-drama"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  copy_dir_contents "apps/web-drama/.next/standalone" "$tmp"
  copy_dir_contents "apps/web-drama/.next/static" "$tmp/apps/web-drama/.next/static"
  if [[ -d apps/web-drama/public ]]; then
    copy_dir_contents "apps/web-drama/public" "$tmp/apps/web-drama/public"
  fi
  strip_env_files "$tmp"
  make_tar_from_dir "$tmp" "$OUT_DIR/web-drama.tar.gz"
}

build_web_celebrity() {
  log "building web-celebrity standalone"
  if [[ "$SKIP_INSTALL" != "1" ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_TYPECHECK" != "1" ]]; then
    pnpm --filter @ai-star-eco/web-celebrity run typecheck
  fi
  pnpm --filter @ai-star-eco/web-celebrity run build

  local tmp="$OUT_DIR/.tmp/web-celebrity"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  copy_dir_contents "apps/web-celebrity/.next/standalone" "$tmp"
  copy_dir_contents "apps/web-celebrity/.next/static" "$tmp/apps/web-celebrity/.next/static"
  if [[ -d apps/web-celebrity/public ]]; then
    copy_dir_contents "apps/web-celebrity/public" "$tmp/apps/web-celebrity/public"
  fi
  strip_env_files "$tmp"
  make_tar_from_dir "$tmp" "$OUT_DIR/web-celebrity.tar.gz"
}

build_web_aiavatar() {
  log "building web-aiavatar standalone"
  if [[ "$SKIP_INSTALL" != "1" ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_TYPECHECK" != "1" ]]; then
    pnpm --filter @ai-star-eco/web-aiavatar run typecheck
  fi
  pnpm --filter @ai-star-eco/web-aiavatar run build

  local tmp="$OUT_DIR/.tmp/web-aiavatar"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  copy_dir_contents "apps/web-aiavatar/.next/standalone" "$tmp"
  copy_dir_contents "apps/web-aiavatar/.next/static" "$tmp/apps/web-aiavatar/.next/static"
  if [[ -d apps/web-aiavatar/public ]]; then
    copy_dir_contents "apps/web-aiavatar/public" "$tmp/apps/web-aiavatar/public"
  fi
  strip_env_files "$tmp"
  make_tar_from_dir "$tmp" "$OUT_DIR/web-aiavatar.tar.gz"
}

build_admin() {
  log "building admin standalone"
  if [[ "$SKIP_INSTALL" != "1" ]]; then
    pnpm install --frozen-lockfile
  fi
  if [[ "$SKIP_TYPECHECK" != "1" ]]; then
    pnpm --filter @ai-star-eco/admin-new run typecheck
  fi
  pnpm --filter @ai-star-eco/admin-new run build

  local tmp="$OUT_DIR/.tmp/admin"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  copy_dir_contents "apps/admin/.next/standalone" "$tmp"
  copy_dir_contents "apps/admin/.next/static" "$tmp/apps/admin/.next/static"
  if [[ -d apps/admin/public ]]; then
    copy_dir_contents "apps/admin/public" "$tmp/apps/admin/public"
  fi
  cat > "$tmp/server.js" <<'EOF'
require("./apps/admin/server.js");
EOF
  strip_env_files "$tmp"
  make_tar_from_dir "$tmp" "$OUT_DIR/admin.tar.gz"
}

build_sau_service() {
  log "packing sau-service source"
  mkdir -p "$OUT_DIR"
  tar "${TAR_CREATE_EXTRA_ARGS[@]}" \
    --exclude='.venv' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='._*' \
    --exclude='*/._*' \
    --exclude='.pytest_cache' \
    --exclude='__pycache__' \
    --exclude='sau-debug-snapshots' \
    -C apps/sau-service \
    -czf "$OUT_DIR/sau-service.tar.gz" \
    .
}

SERVICES_LIST="$(normalize_services "$RAW_SERVICES")"
[[ -n "${SERVICES_LIST// /}" ]] || fail "no services selected"
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail "RELEASE_ID may only contain letters, numbers, dot, underscore, and dash"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

GIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
CREATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$OUT_DIR/manifest.env" <<EOF
RELEASE_ID='$RELEASE_ID'
GIT_SHA='$GIT_SHA'
CREATED_AT='$CREATED_AT'
SERVICES='$(printf "%s" "$SERVICES_LIST" | xargs)'
NEXT_PUBLIC_USE_MOCK='$NEXT_PUBLIC_USE_MOCK'
NEXT_PUBLIC_ENABLE_DEV_LOGIN='$NEXT_PUBLIC_ENABLE_DEV_LOGIN'
NEXT_PUBLIC_MIXCUT_USE_REAL='$NEXT_PUBLIC_MIXCUT_USE_REAL'
NEXT_PUBLIC_API_BASE_URL='$NEXT_PUBLIC_API_BASE_URL'
NEXT_PUBLIC_SERVER_API_BASE='$NEXT_PUBLIC_SERVER_API_BASE'
EOF

has_service server && build_server
has_service web-music && build_web_music
has_service web-drama && build_web_drama
has_service web-celebrity && build_web_celebrity
has_service web-aiavatar && build_web_aiavatar
has_service admin && build_admin
has_service sau-service && build_sau_service

rm -rf "$OUT_DIR/.tmp"
write_checksums

ok "release built: $OUT_DIR"
