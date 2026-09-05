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
# 统一账号中心（id.aibuzz.cn）已抽离为独立仓库 pokocat/aibuzz-id，部署脚本见该仓 deploy/README.md。

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
    SUDO="$SUDO" bash -s
  else
    "${SSH_BASE[@]}" "$DEPLOY_HOST" "SUDO='$SUDO' bash -s"
  fi
}

# 就绪重试：deploy-release.sh 在 restart 后立即调本脚本，而 Spring Boot ~10s 才 boot 完，
# 期间 nginx 上游未就绪 → 502 / 本机 8080 拒连。对「还在启动」的瞬态码（000/502/503/504）
# 轮询而非一次性判失败；其它码（404/500…）立即失败，既快又不误报。
READINESS_RETRIES="${READINESS_RETRIES:-20}"     # 20 × 3s ≈ 60s 上限
READINESS_INTERVAL="${READINESS_INTERVAL:-3}"

log "public endpoints ($PUBLIC_BASE)"
for path in $PUBLIC_PATHS; do
  code="000"
  for ((attempt = 1; attempt <= READINESS_RETRIES; attempt++)); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$PUBLIC_BASE$path" || echo "000")"
    case "$code" in
      200|301|302|307|308) break ;;                    # 成功（v0.136 起消费域 /admin 为 302 → admin 子域）
      000|502|503|504) sleep "$READINESS_INTERVAL" ;;  # 还在启动，重试
      *) break ;;                                      # 真错误（404/500…），立即判失败
    esac
  done
  if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
    ok "$path -> $code"
  else
    fail "$path -> $code"
  fi
done

log "$([[ "$LOCAL_MODE" == "1" ]] && echo "local" || echo "remote") services"
remote_exec <<'REMOTE_CHECKS' || warn "remote checks partially failed"
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
check_unit aistareco-web-music
check_unit aistareco-web-drama
check_unit aistareco-web-celebrity
check_unit aistareco-web-aiavatar
check_unit aistareco-web-star
check_unit aistareco-admin
check_unit aistareco-sau-service

# 就绪重试：restart 后 Spring Boot ~10s 才监听 8080，轮询最多 ~60s 再判失败。
api_ready=0
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8080/api/celebrity/dictionaries >/dev/null 2>&1; then
    api_ready=1
    break
  fi
  sleep 3
done
if [ "$api_ready" = 1 ]; then
  echo "  ✓ server local API ok"
else
  echo "  ✗ server local API failed"
  exit 1
fi

if command -v fc-list >/dev/null 2>&1 \
  && fc-list :lang=zh family 2>/dev/null | grep -Eiq 'Noto (Sans|Serif) CJK|Source Han|WenQuanYi|WenQuan Yi|Microsoft YaHei|SimHei|PingFang'; then
  match="$(fc-list :lang=zh family 2>/dev/null | grep -Eim1 'Noto (Sans|Serif) CJK|Source Han|WenQuanYi|WenQuan Yi|Microsoft YaHei|SimHei|PingFang' || true)"
  echo "  ✓ CJK fonts ok (${match})"
else
  echo "  ✗ CJK fonts missing (run infra/scripts/install-cjk-fonts.sh on ECS)"
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
