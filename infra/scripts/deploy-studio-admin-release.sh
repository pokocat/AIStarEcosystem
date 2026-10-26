#!/usr/bin/env bash
# Deploy only a prebuilt Studio dashboard artifact.
# Prerequisite: the dedicated systemd unit and env file already exist.
# This script intentionally never modifies nginx, apps/server, or web-aiavatar.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

RELEASE_DIR="${1:?usage: deploy-studio-admin-release.sh <release-dir>}"
DEPLOY_HOST="${DEPLOY_HOST:-${ECS_HOST:-}}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-star-eco}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
SUDO="${SUDO:-sudo}"

[[ -n "$DEPLOY_HOST" ]] || { echo "DEPLOY_HOST or ECS_HOST is required" >&2; exit 1; }
[[ -f "$RELEASE_DIR/studio-admin.tar.gz" ]] || { echo "studio-admin artifact missing" >&2; exit 1; }
[[ -f "$RELEASE_DIR/studio-admin-manifest.env" ]] || { echo "studio-admin manifest missing" >&2; exit 1; }

# shellcheck disable=SC1090
. "$RELEASE_DIR/studio-admin-manifest.env"
[[ "${SERVICE:-}" == "studio-admin" ]] || { echo "manifest is not for studio-admin" >&2; exit 1; }
[[ "${RELEASE_ID:-}" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "invalid RELEASE_ID" >&2; exit 1; }

SSH_BASE=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_BASE+=(-i "$SSH_KEY")
  RSYNC_SSH+=(-i "$SSH_KEY")
fi

REMOTE_STAGE="/tmp/aistareco-studio-admin-$RELEASE_ID"
"${SSH_BASE[@]}" "$DEPLOY_HOST" "rm -rf '$REMOTE_STAGE' && mkdir -p '$REMOTE_STAGE'"
rsync -az -e "${RSYNC_SSH[*]}" \
  "$RELEASE_DIR/studio-admin.tar.gz" \
  "$DEPLOY_HOST:$REMOTE_STAGE/studio-admin.tar.gz"

"${SSH_BASE[@]}" "$DEPLOY_HOST" \
  "RELEASE_ID='$RELEASE_ID' REMOTE_STAGE='$REMOTE_STAGE' REMOTE_ROOT='$REMOTE_ROOT' SUDO='$SUDO' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

TARGET="$REMOTE_ROOT/studio-admin"
NEXT="${TARGET}.__next__${RELEASE_ID}"
PREV="${TARGET}.__previous__${RELEASE_ID}"
ROLLBACK_NEEDED=0

cleanup() {
  status=$?
  if [[ "$status" -ne 0 && "$ROLLBACK_NEEDED" == "1" ]]; then
    echo "dashboard verification failed; rolling back independent service" >&2
    $SUDO rm -rf "$TARGET"
    if [[ -e "$PREV" ]]; then
      $SUDO mv "$PREV" "$TARGET"
      $SUDO systemctl restart aistareco-studio-admin || true
    else
      $SUDO systemctl stop aistareco-studio-admin || true
    fi
  fi
  ${SUDO:-} rm -rf "$REMOTE_STAGE" 2>/dev/null || true
}
trap cleanup EXIT

$SUDO test -f /etc/aistareco/studio-admin.env
$SUDO systemctl cat aistareco-studio-admin.service >/dev/null
$SUDO rm -rf "$NEXT"
$SUDO mkdir -p "$NEXT"
$SUDO tar -xzf "$REMOTE_STAGE/studio-admin.tar.gz" -C "$NEXT"
$SUDO rm -rf "$PREV"
if [[ -e "$TARGET" ]]; then
  $SUDO mv "$TARGET" "$PREV"
fi
$SUDO mv "$NEXT" "$TARGET"
ROLLBACK_NEEDED=1
$SUDO systemctl restart aistareco-studio-admin

for path in /admin /admin/login; do
  status="000"
  for _attempt in $(seq 1 20); do
    status="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' "http://127.0.0.1:3004$path" 2>/dev/null || true)"
    [[ "$status" == "200" ]] && break
    sleep 0.5
  done
  [[ "$status" == "200" ]] || { echo "dashboard verification failed: $path -> $status" >&2; exit 1; }
done

$SUDO rm -rf "$PREV"
ROLLBACK_NEEDED=0
REMOTE_SCRIPT

printf '[studio-admin-deploy] deployed %s; shared services were not restarted\n' "$RELEASE_ID"
