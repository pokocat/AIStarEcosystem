#!/usr/bin/env bash
# Production health checks for the current single-host deployment.
#
# Usage:
#   DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/path/key.pem ./infra/scripts/verify.sh
#   ECS_HOST=ecs-user@47.98.162.120 PUBLIC_BASE=http://47.98.162.120 ./infra/scripts/verify.sh
#
# Local mode（在 ECS 本机直接跑，不走 SSH）：
#   LOCAL_MODE=1 PUBLIC_BASE=http://127.0.0.1 ./infra/scripts/verify.sh
#
# Readiness waits:
#   VERIFY_TIMEOUT_SECONDS=90      # per endpoint/service readiness budget
#   VERIFY_INTERVAL_SECONDS=3      # polling interval
#   VERIFY_HTTP_TIMEOUT_SECONDS=8  # single curl timeout

set -euo pipefail

LOCAL_MODE="${LOCAL_MODE:-0}"

DEPLOY_HOST="${DEPLOY_HOST:-${ECS_HOST:-}}"
if [[ "$LOCAL_MODE" != "1" ]]; then
  [[ -n "$DEPLOY_HOST" ]] || { echo "DEPLOY_HOST or ECS_HOST is required (or set LOCAL_MODE=1)" >&2; exit 1; }
fi

SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
SUDO="${SUDO:-sudo}"
if [[ "$LOCAL_MODE" == "1" ]]; then
  HOST_REMOTE="${HOST_REMOTE:-127.0.0.1}"
else
  HOST_REMOTE="${DEPLOY_HOST#*@}"
fi
PUBLIC_BASE="${PUBLIC_BASE:-http://$HOST_REMOTE}"
PUBLIC_PATHS="${PUBLIC_PATHS:-/ /login /admin /api/celebrity/dictionaries}"
VERIFY_TIMEOUT_SECONDS="${VERIFY_TIMEOUT_SECONDS:-90}"
VERIFY_INTERVAL_SECONDS="${VERIFY_INTERVAL_SECONDS:-3}"
VERIFY_HTTP_TIMEOUT_SECONDS="${VERIFY_HTTP_TIMEOUT_SECONDS:-8}"

FAILED=0

log() { printf "\033[1;34m[verify]\033[0m %s\n" "$*"; }
ok() { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m  ✗ %s\033[0m\n" "$*"; FAILED=1; }

SSH_BASE=(ssh -p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_BASE+=(-i "$SSH_KEY")
fi

# v0.47：LOCAL_MODE=1 时把 remote check 直接本机 bash 跑，省去 ssh 回环。
remote_exec() {
  if [[ "$LOCAL_MODE" == "1" ]]; then
    SUDO="$SUDO" \
      VERIFY_TIMEOUT_SECONDS="$VERIFY_TIMEOUT_SECONDS" \
      VERIFY_INTERVAL_SECONDS="$VERIFY_INTERVAL_SECONDS" \
      VERIFY_HTTP_TIMEOUT_SECONDS="$VERIFY_HTTP_TIMEOUT_SECONDS" \
      bash -s
  else
    "${SSH_BASE[@]}" "$DEPLOY_HOST" \
      "SUDO='$SUDO' VERIFY_TIMEOUT_SECONDS='$VERIFY_TIMEOUT_SECONDS' VERIFY_INTERVAL_SECONDS='$VERIFY_INTERVAL_SECONDS' VERIFY_HTTP_TIMEOUT_SECONDS='$VERIFY_HTTP_TIMEOUT_SECONDS' bash -s"
  fi
}

http_code() {
  local url="$1" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$VERIFY_HTTP_TIMEOUT_SECONDS" "$url" 2>/dev/null || true)"
  if [[ ! "$code" =~ ^[0-9][0-9][0-9]$ ]]; then
    code="000"
  fi
  printf "%s" "$code"
}

is_acceptable_public_code() {
  case "$1" in
    200|307|308) return 0 ;;
    *) return 1 ;;
  esac
}

wait_public_path() {
  local path="$1" url="$2" deadline last_code="000"
  deadline=$((SECONDS + VERIFY_TIMEOUT_SECONDS))
  while true; do
    last_code="$(http_code "$url")"
    if is_acceptable_public_code "$last_code"; then
      ok "$path -> $last_code"
      return 0
    fi
    if (( SECONDS >= deadline )); then
      fail "$path -> $last_code (not ready after ${VERIFY_TIMEOUT_SECONDS}s)"
      return 1
    fi
    sleep "$VERIFY_INTERVAL_SECONDS"
  done
}

log "$([[ "$LOCAL_MODE" == "1" ]] && echo "local" || echo "remote") services"
if ! remote_exec <<'REMOTE_CHECKS'
set -euo pipefail

VERIFY_TIMEOUT_SECONDS="${VERIFY_TIMEOUT_SECONDS:-90}"
VERIFY_INTERVAL_SECONDS="${VERIFY_INTERVAL_SECONDS:-3}"
VERIFY_HTTP_TIMEOUT_SECONDS="${VERIFY_HTTP_TIMEOUT_SECONDS:-8}"

unit_exists() {
  local svc="$1" units
  units="$(systemctl list-unit-files "${svc}.service" --no-legend 2>/dev/null || true)"
  [[ "$units" == "${svc}.service "* || "$units" == "${svc}.service"$'\t'* ]]
}

print_recent_logs() {
  local svc="$1"
  if unit_exists "$svc"; then
    echo "  recent $svc logs:"
    journalctl -u "$svc" --since "5 minutes ago" --no-pager | tail -80 || true
  fi
}

wait_http_ready() {
  local label="$1" url="$2" svc="${3:-}" deadline
  deadline=$((SECONDS + VERIFY_TIMEOUT_SECONDS))
  while true; do
    if curl -fsS --max-time "$VERIFY_HTTP_TIMEOUT_SECONDS" "$url" >/dev/null 2>&1; then
      echo "  ✓ $label ok"
      return 0
    fi

    if [[ -n "$svc" ]] && unit_exists "$svc" && ! systemctl is-active --quiet "$svc"; then
      echo "  ✗ $label failed ($svc is not active)"
      systemctl --no-pager --full status "$svc" | tail -40 || true
      print_recent_logs "$svc"
      exit 1
    fi

    if (( SECONDS >= deadline )); then
      echo "  ✗ $label failed after ${VERIFY_TIMEOUT_SECONDS}s"
      if [[ -n "$svc" ]]; then
        systemctl --no-pager --full status "$svc" | tail -40 || true
        print_recent_logs "$svc"
      fi
      exit 1
    fi

    sleep "$VERIFY_INTERVAL_SECONDS"
  done
}

check_unit() {
  local svc="$1"
  if unit_exists "$svc"; then
    if systemctl is-active --quiet "$svc"; then
      echo "  ✓ $svc active"
    else
      echo "  ✗ $svc inactive"
      systemctl --no-pager --full status "$svc" | tail -40 || true
      print_recent_logs "$svc"
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

wait_http_ready "server local API" "http://127.0.0.1:8080/api/celebrity/dictionaries" "aistareco-server"

if unit_exists aistareco-web-celebrity; then
  wait_http_ready "web-celebrity /login" "http://127.0.0.1:3012/login" "aistareco-web-celebrity"
fi

if command -v fc-list >/dev/null 2>&1 \
  && fc-list :lang=zh family 2>/dev/null | grep -Eiq 'Noto (Sans|Serif) CJK|Source Han|WenQuanYi|WenQuan Yi|Microsoft YaHei|SimHei|PingFang'; then
  match="$(fc-list :lang=zh family 2>/dev/null | grep -Eim1 'Noto (Sans|Serif) CJK|Source Han|WenQuanYi|WenQuan Yi|Microsoft YaHei|SimHei|PingFang' || true)"
  echo "  ✓ CJK fonts ok (${match})"
else
  echo "  ✗ CJK fonts missing (run infra/scripts/install-cjk-fonts.sh on ECS)"
  exit 1
fi

if unit_exists aistareco-sau-service; then
  wait_http_ready "sau-service /healthz" "http://127.0.0.1:8090/healthz" "aistareco-sau-service"
fi

if $SUDO nginx -t >/dev/null 2>&1; then
  echo "  ✓ nginx -t ok"
else
  echo "  ✗ nginx -t failed"
  $SUDO nginx -t
  exit 1
fi
REMOTE_CHECKS
then
  warn "remote checks partially failed"
  FAILED=1
fi

log "public endpoints ($PUBLIC_BASE)"
for path in $PUBLIC_PATHS; do
  wait_public_path "$path" "$PUBLIC_BASE$path" || true
done

echo
if [[ $FAILED -eq 0 ]]; then
  printf "\033[1;32m[verify] ALL GREEN\033[0m\n"
  exit 0
fi

printf "\033[1;31m[verify] FAILED\033[0m\n"
exit 1
