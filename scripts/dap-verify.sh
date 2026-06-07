#!/usr/bin/env bash
# ============================================================
# 数字人资产平台（dap / web-aiavatar）一键联调验证
#
# 用法（在仓库根目录）：
#   bash scripts/dap-verify.sh                 # H2 + 真实 Agnes（自动读 ~/dev/Agnes.md）
#   PROFILE=mysql bash scripts/dap-verify.sh   # 本地 MySQL + 真实 Agnes
#   AGNES=fake bash scripts/dap-verify.sh      # 用本地 fake Agnes（无外网联调）
#   VIDEO=1 bash scripts/dap-verify.sh         # 额外验证运镜视频（真实 Agnes 下耗时数分钟）
#   KEEP=1  bash scripts/dap-verify.sh         # 测完不杀 server（继续手动体验前端）
#
# 产物（全部在 .dap-verify/，已 gitignore）：
#   report.txt   — PASS/FAIL 总表
#   server.log   — Spring Boot 完整日志
#   e2e.log      — 每一步请求/响应摘要
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/.dap-verify"
mkdir -p "$OUT"
: > "$OUT/report.txt"
: > "$OUT/e2e.log"

PROFILE="${PROFILE:-dev}"            # dev(H2) | mysql
AGNES="${AGNES:-real}"               # real | fake | none
VIDEO="${VIDEO:-0}"
KEEP="${KEEP:-0}"
SERVER_PORT="${SERVER_PORT:-8080}"
FAKE_PORT="${FAKE_AGNES_PORT:-18181}"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS  $1" | tee -a "$OUT/report.txt"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL  $1" | tee -a "$OUT/report.txt"; }
note() { echo "----  $1" | tee -a "$OUT/report.txt"; }
log()  { echo "[$(date +%H:%M:%S)] $*" >> "$OUT/e2e.log"; }

cleanup() {
  if [ "$KEEP" != "1" ]; then
    [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
    [ -n "${FAKE_PID:-}" ] && kill "$FAKE_PID" 2>/dev/null
  else
    note "KEEP=1 · server 仍在运行（PID ${SERVER_PID:-?}，端口 ${SERVER_PORT}）"
  fi
}
trap cleanup EXIT

# ── 0. Agnes key ─────────────────────────────────────────────
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ]; then
  if [ -f "$HOME/dev/Agnes.md" ]; then
    AGNES_API_KEY="$(grep -o 'Agnes-ak:[^ ]*' "$HOME/dev/Agnes.md" | head -1 | cut -d: -f2 | tr -d '[:space:]')"
    export AGNES_API_KEY
  fi
fi
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ]; then
  note "未找到 AGNES_API_KEY（~/dev/Agnes.md），自动降级 AGNES=fake"
  AGNES="fake"
fi
if [ "$AGNES" = "fake" ]; then
  node "$ROOT/scripts/dev-fake-agnes-server.mjs" > "$OUT/fake-agnes.log" 2>&1 &
  FAKE_PID=$!
  export AGNES_BASE_URL="http://localhost:$FAKE_PORT"
  export AGNES_API_KEY="fake-key"
  sleep 1
  note "fake Agnes 已启动（${AGNES_BASE_URL}）"
elif [ "$AGNES" = "none" ]; then
  export AGNES_API_KEY=""
  # 生产严格模式下未配引擎会 503（不生成不扣费）；联调显式放行占位降级
  export AEP_DAP_ALLOW_PLACEHOLDER=true
  note "AGNES=none · 显式放行占位产物降级链路（生产默认严格 503）"
else
  note "真实 Agnes（apihub.agnes-ai.com）"
fi

# ── 1. 编译 ───────────────────────────────────────────────────
note "编译 apps/server（mvn compile）…"
( cd apps/server && ./mvnw -B -q -DskipTests compile ) > "$OUT/compile.log" 2>&1
if [ $? -ne 0 ]; then
  bad "server 编译失败 — 见 .dap-verify/compile.log"
  tail -60 "$OUT/compile.log" | tee -a "$OUT/report.txt"
  exit 1
fi
ok "server 编译"

# ── 2. 启动 server ────────────────────────────────────────────
export AEP_DEV_AUTH_ENABLED=true
export AEP_SMS_DRIVER=log
export AEP_CDN_DRIVER=local            # mysql profile 默认 oss，本地联调强制 local
export AEP_CDN_PUBLIC_BASE_URL="${AEP_CDN_PUBLIC_BASE_URL:-http://localhost:${SERVER_PORT}/cdn}"
export AEP_SEED_DEV_DATA_ENABLED=true
export AEP_JWT_SECRET="${AEP_JWT_SECRET:-dap-local-verify-jwt-secret-20260606-32chars}"
SPRING_ARGS=""
if [ "$PROFILE" = "mysql" ]; then
  # mysql profile 被 JwtUtil / AepCryptoUtil 视作"生产"，dev 默认密钥会 fail-fast。
  # 本地联调注入临时高熵密钥（每次随机生成，不落盘不入 git；正式部署仍走 server.env）。
  export AEP_JWT_SECRET="${AEP_JWT_SECRET:-local-verify-$(openssl rand -hex 24 2>/dev/null || date +%s%N)}"
  export AEP_SECRET_KEY="${AEP_SECRET_KEY:-local-verify-$(openssl rand -hex 24 2>/dev/null || date +%s%N)}"
  export DB_URL="${DB_URL:-jdbc:mysql://localhost:3306/aistareco?useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&createDatabaseIfNotExist=true}"
  export DB_USERNAME="${DB_USERNAME:-root}"
  export DB_PASSWORD="${DB_PASSWORD-root}"
  SPRING_ARGS="-Dspring-boot.run.profiles=mysql"
  note "MySQL profile（${DB_URL}）"
else
  note "H2 dev profile"
fi

note "启动 server（端口 ${SERVER_PORT}）…"
( cd apps/server && ./mvnw -B -q spring-boot:run $SPRING_ARGS ) > "$OUT/server.log" 2>&1 &
SERVER_PID=$!

BOOTED=0
for i in $(seq 1 120); do
  if curl -s -o /dev/null --max-time 2 "http://localhost:$SERVER_PORT/api/auth/dev-accounts"; then BOOTED=1; break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
  sleep 1
done
if [ "$BOOTED" != "1" ]; then
  bad "server 启动失败/超时 — 见 .dap-verify/server.log"
  tail -50 "$OUT/server.log" | tee -a "$OUT/report.txt"
  exit 1
fi
ok "server 启动"

# ── 3. E2E（python3 执行断言）─────────────────────────────────
VIDEO=$VIDEO PROFILE=$PROFILE AGNES=$AGNES SERVER="http://localhost:$SERVER_PORT" \
python3 "$ROOT/scripts/dap-e2e.py" 2>&1 | tee -a "$OUT/report.txt" "$OUT/e2e.log"
E2E_RC=${PIPESTATUS[0]}
if [ "$E2E_RC" -eq 0 ]; then
  ok "e2e 断言"
else
  bad "e2e 断言 — 见 .dap-verify/report.txt"
fi

# ── 4. 前端门 ─────────────────────────────────────────────────
note "web-aiavatar typecheck…"
if ( cd apps/web-aiavatar && npx tsc --noEmit ) > "$OUT/typecheck.log" 2>&1; then
  ok "web-aiavatar typecheck"
else
  bad "web-aiavatar typecheck — 见 .dap-verify/typecheck.log"
fi
if [ "${BUILD:-0}" = "1" ]; then
  note "web-aiavatar build…"
  if ( cd apps/web-aiavatar && npm run build ) > "$OUT/webbuild.log" 2>&1; then
    ok "web-aiavatar build"
  else
    bad "web-aiavatar build — 见 .dap-verify/webbuild.log"
  fi
fi

echo "" | tee -a "$OUT/report.txt"
echo "================  ${PASS} PASS / ${FAIL} FAIL（e2e rc=${E2E_RC}）  ================" | tee -a "$OUT/report.txt"
echo "日志目录：.dap-verify/（report.txt / server.log / e2e.log / compile.log）" | tee -a "$OUT/report.txt"
[ "$FAIL" -eq 0 ] && [ "$E2E_RC" -eq 0 ]
