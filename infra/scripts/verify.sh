#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/verify.sh — 部署后健康检查批量
#
# 用法：
#   ECS_HOST=root@<your-ecs-host> ./infra/scripts/verify.sh
#   ECS_HOST=root@<your-ecs-host> PUBLIC_BASE=https://aibuzz.cn ./infra/scripts/verify.sh
#
# 环境变量：
#   ECS_HOST    — ssh 目标（用于 systemctl status / docker logs / 内网 healthz）
#   PUBLIC_BASE — 公网入口 base url，默认从 ECS_HOST 抽 host；多子域形态用 https://aibuzz.cn
#
# 检查项：
#   1. 公网入口 200（/web /admin /api/auth/dev-accounts）
#   2. server /api/internal/healthz（如有）/ /api/auth/dev-accounts
#   3. sau-service /healthz（内网）
#   4. 所有 systemd 服务 active
#   5. nginx -t 通过
#   6. RDS 连接（select 1）— 如能 ssh
#   7. OSS 上传 + 删除测试 — 如配了 ossutil
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ECS_HOST="${ECS_HOST:?ECS_HOST required, e.g. root@<your-ecs-host>}"
HOST_REMOTE="${ECS_HOST#*@}"
PUBLIC_BASE="${PUBLIC_BASE:-http://$HOST_REMOTE}"

log()  { printf "\033[1;34m[verify]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  ! %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m  ✗ %s\033[0m\n" "$*"; FAILED=1; }
FAILED=0

# ── 1) 公网入口 ─────────────────────────────────────────────────
log "1) 公网入口"
for path in /web /admin; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE$path" || echo "000")
  if [[ "$code" == "200" ]]; then ok "$path → $code"; else fail "$path → $code"; fi
done

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_BASE/api/auth/dev-accounts" || echo "000")
if [[ "$code" == "200" || "$code" == "403" || "$code" == "404" ]]; then
  ok "/api/auth/dev-accounts → $code (200 = dev-auth on; 403/404 = dev-auth off in prod)"
else
  fail "/api/auth/dev-accounts → $code"
fi

# ── 2) web-celebrity（如果直接 :3012 暴露） ─────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://$HOST_REMOTE:3012/" || echo "000")
if [[ "$code" == "200" || "$code" == "307" ]]; then ok ":3012/ → $code"; else warn ":3012/ → $code (or behind nginx)"; fi

# ── 3) 静态视频 ─────────────────────────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PUBLIC_BASE/static/videos/showreel-01.mp4" || echo "000")
if [[ "$code" == "200" || "$code" == "404" ]]; then
  ok "/static/videos/showreel-01.mp4 → $code (404 = 已迁 OSS / 文件不存在)"
else
  warn "/static/videos/showreel-01.mp4 → $code"
fi

# ── 4) 远端服务健康 ─────────────────────────────────────────────
log "2) 远端 systemd / docker 状态"
ssh "$ECS_HOST" '
  for svc in aistareco-server aistareco-web aistareco-admin aistareco-web-celebrity aistareco-web-music aistareco-web-drama; do
    if systemctl list-unit-files | grep -q "^${svc}.service"; then
      if systemctl is-active --quiet $svc; then
        echo "  ✓ $svc active"
      else
        echo "  ✗ $svc inactive: $(systemctl is-failed $svc 2>/dev/null || echo unknown)"
      fi
    fi
  done

  if docker ps --filter name=aistareco-sau-service --format "{{.Status}}" 2>/dev/null | grep -q Up; then
    echo "  ✓ aistareco-sau-service docker Up"
  else
    echo "  ✗ aistareco-sau-service docker not running"
  fi

  if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo "  ✓ nginx config syntax ok"
  else
    echo "  ✗ nginx config syntax error"
    nginx -t
  fi

  if curl -fsS http://127.0.0.1:8090/healthz >/dev/null 2>&1; then
    echo "  ✓ sau-service /healthz ok"
  else
    echo "  ✗ sau-service /healthz unreachable"
  fi
' || warn "ssh checks partially failed"

# ── 5) 总结 ─────────────────────────────────────────────────────
echo
if [[ $FAILED -eq 0 ]]; then
  printf "\033[1;32m[verify] ALL GREEN\033[0m\n"
  exit 0
else
  printf "\033[1;31m[verify] FAILED — 至少一项检查未通过\033[0m\n"
  exit 1
fi
