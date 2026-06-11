#!/usr/bin/env bash
# Deploy a release directory produced by infra/scripts/build-release.sh.
#
# Usage:
#   DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/path/key.pem \
#     ./infra/scripts/deploy-release.sh dist/deploy/<release> [services]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

RELEASE_DIR="${1:?usage: deploy-release.sh <release-dir> [services]}"
RAW_SERVICES="${2:-${SERVICES:-}}"
DEPLOY_HOST="${DEPLOY_HOST:-${ECS_HOST:-}}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-star-eco}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
SUDO="${SUDO:-sudo}"
VERIFY="${VERIFY:-1}"
PUBLIC_BASE="${PUBLIC_BASE:-}"
REMOTE_APP_USER="${REMOTE_APP_USER:-}"
REMOTE_APP_GROUP="${REMOTE_APP_GROUP:-}"
ENSURE_HOST_DEPS="${ENSURE_HOST_DEPS:-1}"
ENSURE_CJK_FONTS="${ENSURE_CJK_FONTS:-1}"
CHECK_RUNTIME_ENV="${CHECK_RUNTIME_ENV:-1}"

[[ -n "$DEPLOY_HOST" ]] || { echo "DEPLOY_HOST or ECS_HOST is required" >&2; exit 1; }
[[ -d "$RELEASE_DIR" ]] || { echo "release dir not found: $RELEASE_DIR" >&2; exit 1; }
[[ -f "$RELEASE_DIR/manifest.env" ]] || { echo "manifest missing: $RELEASE_DIR/manifest.env" >&2; exit 1; }

# shellcheck disable=SC1090
. "$RELEASE_DIR/manifest.env"
RELEASE_ID="${RELEASE_ID:?manifest RELEASE_ID missing}"
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "invalid RELEASE_ID: $RELEASE_ID" >&2; exit 1; }
if [[ -z "$RAW_SERVICES" ]]; then
  RAW_SERVICES="${SERVICES:?manifest SERVICES missing}"
fi

DEFAULT_SERVICES="server web-music web-drama web-celebrity web-aiavatar web-star admin sau-service"

log() { printf "\033[1;34m[deploy-release]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m[deploy-release]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[deploy-release] %s\033[0m\n" "$*" >&2; exit 1; }

normalize_services() {
  local raw="${1//,/ }"
  local out="" item
  for item in $raw; do
    case "$item" in
      all) out="$out $DEFAULT_SERVICES" ;;
      server|web-music|web-drama|web-celebrity|web-aiavatar|web-star|admin|sau-service) out="$out $item" ;;
      "") ;;
      *) fail "unknown service '$item' (expected server|web-music|web-drama|web-celebrity|web-aiavatar|web-star|admin|sau-service|all)" ;;
    esac
  done

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
  printf "%s\n" "$deduped" | xargs
}

SERVICES_TO_DEPLOY="$(normalize_services "$RAW_SERVICES")"
[[ -n "$SERVICES_TO_DEPLOY" ]] || fail "no services selected"

SSH_BASE=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_BASE+=(-i "$SSH_KEY")
  RSYNC_SSH+=(-i "$SSH_KEY")
fi

ssh_remote() {
  "${SSH_BASE[@]}" "$DEPLOY_HOST" "$@"
}

REMOTE_STAGE="/tmp/aistareco-release-$RELEASE_ID"

require_artifact() {
  local file="$1"
  [[ -f "$RELEASE_DIR/$file" ]] || fail "selected service requires missing artifact: $RELEASE_DIR/$file"
}

for svc in $SERVICES_TO_DEPLOY; do
  case "$svc" in
    server) require_artifact "server/app.jar" ;;
    web-music) require_artifact "web-music.tar.gz" ;;
    web-drama) require_artifact "web-drama.tar.gz" ;;
    web-celebrity) require_artifact "web-celebrity.tar.gz" ;;
    web-aiavatar) require_artifact "web-aiavatar.tar.gz" ;;
    web-star) require_artifact "web-star.tar.gz" ;;
    admin) require_artifact "admin.tar.gz" ;;
    sau-service) require_artifact "sau-service.tar.gz" ;;
  esac
done

log "uploading release $RELEASE_ID to $DEPLOY_HOST:$REMOTE_STAGE"
ssh_remote "rm -rf '$REMOTE_STAGE' && mkdir -p '$REMOTE_STAGE'"
rsync -az --delete -e "${RSYNC_SSH[*]}" "$RELEASE_DIR/" "$DEPLOY_HOST:$REMOTE_STAGE/"
rsync -az -e "${RSYNC_SSH[*]}" "$REPO_ROOT/infra/scripts/install-host-deps.sh" "$DEPLOY_HOST:$REMOTE_STAGE/install-host-deps.sh"
rsync -az -e "${RSYNC_SSH[*]}" "$REPO_ROOT/infra/scripts/install-cjk-fonts.sh" "$DEPLOY_HOST:$REMOTE_STAGE/install-cjk-fonts.sh"
rsync -az -e "${RSYNC_SSH[*]}" "$REPO_ROOT/infra/scripts/check-runtime-env.sh" "$DEPLOY_HOST:$REMOTE_STAGE/check-runtime-env.sh"

log "applying release on remote host"
ssh_remote \
  "RELEASE_ID='$RELEASE_ID' REMOTE_STAGE='$REMOTE_STAGE' REMOTE_ROOT='$REMOTE_ROOT' SERVICES_TO_DEPLOY='$SERVICES_TO_DEPLOY' SUDO='$SUDO' REMOTE_APP_USER='$REMOTE_APP_USER' REMOTE_APP_GROUP='$REMOTE_APP_GROUP' ENSURE_HOST_DEPS='$ENSURE_HOST_DEPS' ENSURE_CJK_FONTS='$ENSURE_CJK_FONTS' CHECK_RUNTIME_ENV='$CHECK_RUNTIME_ENV' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

log() { printf "\033[1;34m[remote-deploy]\033[0m %s\n" "$*"; }

APP_USER="${REMOTE_APP_USER:-$(id -un)}"
APP_GROUP="${REMOTE_APP_GROUP:-$(id -gn)}"
RELEASE_STORE="$REMOTE_ROOT/releases/$RELEASE_ID"

ensure_host_deps() {
  if [[ "${ENSURE_HOST_DEPS:-1}" != "1" ]]; then
    log "skip host dependency ensure (ENSURE_HOST_DEPS=$ENSURE_HOST_DEPS)"
    return
  fi
  if [[ ! -f "$REMOTE_STAGE/install-host-deps.sh" ]]; then
    log "host dependency installer missing in remote stage; skip"
    return
  fi
  log "ensure host dependencies"
  $SUDO bash "$REMOTE_STAGE/install-host-deps.sh" "$SERVICES_TO_DEPLOY"
}

ensure_cjk_fonts() {
  if [[ "${ENSURE_CJK_FONTS:-1}" != "1" ]]; then
    log "skip CJK font ensure (ENSURE_CJK_FONTS=$ENSURE_CJK_FONTS)"
    return
  fi
  if [[ ! -f "$REMOTE_STAGE/install-cjk-fonts.sh" ]]; then
    log "CJK font installer missing in remote stage; skip"
    return
  fi
  log "ensure system CJK fonts"
  $SUDO bash "$REMOTE_STAGE/install-cjk-fonts.sh"
}

check_runtime_env() {
  if [[ "${CHECK_RUNTIME_ENV:-1}" != "1" ]]; then
    log "skip runtime env check (CHECK_RUNTIME_ENV=$CHECK_RUNTIME_ENV)"
    return
  fi
  if [[ ! -f "$REMOTE_STAGE/check-runtime-env.sh" ]]; then
    log "runtime env checker missing in remote stage; skip"
    return
  fi
  log "check runtime env"
  $SUDO bash "$REMOTE_STAGE/check-runtime-env.sh" "$SERVICES_TO_DEPLOY" --release-dir "$REMOTE_STAGE"
}

$SUDO mkdir -p "$REMOTE_ROOT/releases" "$REMOTE_ROOT/server" "$REMOTE_ROOT/web-music" "$REMOTE_ROOT/web-drama" "$REMOTE_ROOT/web-celebrity" "$REMOTE_ROOT/web-aiavatar" "$REMOTE_ROOT/web-star" "$REMOTE_ROOT/admin" "$REMOTE_ROOT/sau-service"

ensure_host_deps
check_runtime_env
ensure_cjk_fonts

$SUDO rm -rf "$RELEASE_STORE"
$SUDO mkdir -p "$RELEASE_STORE"
$SUDO cp -a "$REMOTE_STAGE"/. "$RELEASE_STORE"/
$SUDO chown -R "$APP_USER:$APP_GROUP" "$RELEASE_STORE" "$REMOTE_ROOT/server" "$REMOTE_ROOT/web-music" "$REMOTE_ROOT/web-drama" "$REMOTE_ROOT/web-celebrity" "$REMOTE_ROOT/web-aiavatar" "$REMOTE_ROOT/web-star" "$REMOTE_ROOT/admin" "$REMOTE_ROOT/sau-service"

deploy_server() {
  log "install server jar"
  $SUDO install -m 0644 "$RELEASE_STORE/server/app.jar" "$REMOTE_ROOT/server/app.jar"
  $SUDO chown "$APP_USER:$APP_GROUP" "$REMOTE_ROOT/server/app.jar"
  $SUDO systemctl restart aistareco-server
}

extract_app() {
  local service="$1" tarball="$2" target="$3" unit="$4"
  log "extract $service"
  local next="${target}.__next__${RELEASE_ID}"
  local prev="${target}.__previous__"
  $SUDO rm -rf "$next"
  $SUDO mkdir -p "$next"
  $SUDO tar -xzf "$RELEASE_STORE/$tarball" -C "$next"
  $SUDO chown -R "$APP_USER:$APP_GROUP" "$next"
  $SUDO rm -rf "$prev"
  if [[ -e "$target" ]]; then
    $SUDO mv "$target" "$prev"
  fi
  $SUDO mv "$next" "$target"
  $SUDO systemctl restart "$unit"
  $SUDO rm -rf "$prev"
}

deploy_sau_service() {
  log "extract sau-service source"
  local target="$REMOTE_ROOT/sau-service"
  local next="${target}.__next__${RELEASE_ID}"
  local prev="${target}.__previous__"
  $SUDO rm -rf "$next"
  $SUDO mkdir -p "$next"
  $SUDO tar -xzf "$RELEASE_STORE/sau-service.tar.gz" -C "$next"
  $SUDO chown -R "$APP_USER:$APP_GROUP" "$next"

  log "build sau-service docker image"
  cd "$next"
  $SUDO docker build --build-arg INSTALL_REAL=1 -t "aistareco/sau-service:$RELEASE_ID" -t aistareco/sau-service:real .
  $SUDO rm -rf "$prev"
  if [[ -e "$target" ]]; then
    $SUDO mv "$target" "$prev"
  fi
  $SUDO mv "$next" "$target"
  $SUDO systemctl restart aistareco-sau-service
  $SUDO rm -rf "$prev"
}

for svc in $SERVICES_TO_DEPLOY; do
  case "$svc" in
    server) deploy_server ;;
    web-music) extract_app web-music web-music.tar.gz "$REMOTE_ROOT/web-music" aistareco-web-music ;;
    web-drama) extract_app web-drama web-drama.tar.gz "$REMOTE_ROOT/web-drama" aistareco-web-drama ;;
    web-celebrity) extract_app web-celebrity web-celebrity.tar.gz "$REMOTE_ROOT/web-celebrity" aistareco-web-celebrity ;;
    web-aiavatar) extract_app web-aiavatar web-aiavatar.tar.gz "$REMOTE_ROOT/web-aiavatar" aistareco-web-aiavatar ;;
    web-star) extract_app web-star web-star.tar.gz "$REMOTE_ROOT/web-star" aistareco-web-star ;;
    admin) extract_app admin admin.tar.gz "$REMOTE_ROOT/admin" aistareco-admin ;;
    sau-service) deploy_sau_service ;;
  esac
done

log "deployed services: $SERVICES_TO_DEPLOY"
REMOTE_SCRIPT

if [[ "$VERIFY" == "1" ]]; then
  log "running verify.sh"
  ECS_HOST="$DEPLOY_HOST" SSH_KEY="$SSH_KEY" SSH_PORT="$SSH_PORT" PUBLIC_BASE="$PUBLIC_BASE" REMOTE_ROOT="$REMOTE_ROOT" "$REPO_ROOT/infra/scripts/verify.sh"
fi

ok "release deployed: $RELEASE_ID ($SERVICES_TO_DEPLOY)"
