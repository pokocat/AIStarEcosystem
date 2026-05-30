#!/usr/bin/env bash
# Production health checks for the current single-host deployment.
#
# Usage:
#   DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/path/key.pem ./infra/scripts/verify.sh
#   ECS_HOST=ecs-user@47.98.162.120 PUBLIC_BASE=http://47.98.162.120 ./infra/scripts/verify.sh

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-${ECS_HOST:-}}"
[[ -n "$DEPLOY_HOST" ]] || { echo "DEPLOY_HOST or ECS_HOST is required" >&2; exit 1; }

SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
SUDO="${SUDO:-sudo}"
HOST_REMOTE="${DEPLOY_HOST#*@}"
PUBLIC_BASE="${PUBLIC_BASE:-http://$HOST_REMOTE}"
PUBLIC_PATHS="${PUBLIC_PATHS:-/ /login /admin /api/celebrity/dictionaries}"

FAILED=0

log() { printf "\033[1;34m[verify]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m  ✗ %s\033[0m\n" "$*"; FAILED=1; }

SSH_BASE=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_BASE+=(-i "$SSH_KEY")
fi

ssh_remote() {
  "${SSH_BASE[@]}" "$DEPLOY_HOST" "$@"
}

log "public endpoints ($PUBLIC_BASE)"
for path in $PUBLIC_PATHS; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$PUBLIC_BASE$path" || echo "000")"
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "308" ]]; then
    ok "$path -> $code"
  else
    fail "$path -> $code"
  fi
done

log "remote services"
ssh_remote "SUDO='$SUDO' bash -s" <<'REMOTE_CHECKS' || warn "remote checks partially failed"
set -euo pipefail

check_unit() {
  local svc="$1"
  if systemctl list-unit-files | grep -q "^${svc}.service"; then
    if systemctl is-active --quiet "$svc"; then
      echo "  ✓ $svc active"
    else
      echo "  ✗ $svc inactive"
      systemctl --no-pager --full status "$svc" | tail -40 || true
      exit 1
    fi
  fi
}

check_unit mysqld
check_unit nginx
check_unit docker
check_unit aistareco-server
check_unit aistareco-web-celebrity
check_unit aistareco-admin
check_unit aistareco-sau-service

if curl -fsS http://127.0.0.1:8080/api/celebrity/dictionaries >/dev/null; then
  echo "  ✓ server local API ok"
else
  echo "  ✗ server local API failed"
  exit 1
fi

if curl -fsS http://127.0.0.1:8090/healthz >/dev/null; then
  echo "  ✓ sau-service /healthz ok"
else
  echo "  ✗ sau-service /healthz failed"
  exit 1
fi

if $SUDO nginx -t >/dev/null 2>&1; then
  echo "  ✓ nginx -t ok"
else
  echo "  ✗ nginx -t failed"
  $SUDO nginx -t
  exit 1
fi
REMOTE_CHECKS

echo
if [[ $FAILED -eq 0 ]]; then
  printf "\033[1;32m[verify] ALL GREEN\033[0m\n"
  exit 0
fi

printf "\033[1;31m[verify] FAILED\033[0m\n"
exit 1
