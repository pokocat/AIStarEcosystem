#!/usr/bin/env bash
# ============================================================
# 数字人资产平台（dap / web-aiavatar）一键联调验证
#
# 生成引擎统一经后台「AI 应用绑定」管理；脚本用 aep.dap.dev-seed.* 自动把 DAP_* 端点种进 admin 表。
#
# 用法（在仓库根目录）：
#   bash scripts/dap-verify.sh                 # H2 + 真实 Agnes（自动读 ~/dev/Agnes.md 的 key）
#   PROFILE=mysql bash scripts/dap-verify.sh   # 本地 MySQL + 真实 Agnes
#   AGNES=fake bash scripts/dap-verify.sh      # 本地 fake 多模态引擎（无外网联调）
#   AGNES=none bash scripts/dap-verify.sh      # 不绑端点，测占位降级路径（建议 H2）
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
AGNES="${AGNES:-real}"               # 生成引擎模式：real(云端 Agnes) | fake(本地多模态) | none(占位)
VIDEO="${VIDEO:-0}"
KEEP="${KEEP:-0}"
SERVER_PORT="${SERVER_PORT:-8080}"
FAKE_PORT="${FAKE_MULTIMODAL_PORT:-${FAKE_AGNES_PORT:-18181}}"

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

# ── 0. 生成引擎接入点（统一经 admin 端点；脚本用 dev-seed 自动绑定 DAP_*）──────
# 大模型不再走 AGNES_* env 兜底：DapMultimodalClient 运行时只读 admin「AI 应用绑定」。
# 这里用 aep.dap.dev-seed.* 让 server 开机把 DAP_PERSONA/IMAGE/VIDEO 端点「种」进 admin 表
# （幂等、不覆盖运营已配）。mysql 持久库上切 fake↔real 时端点会被刷新；测 none 占位路径建议用 H2。
export AEP_DAP_DEV_SEED_ENABLED=true
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ] && [ -f "$HOME/dev/Agnes.md" ]; then
  AGNES_API_KEY="$(grep -o 'Agnes-ak:[^ ]*' "$HOME/dev/Agnes.md" | head -1 | cut -d: -f2 | tr -d '[:space:]')"
fi
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ]; then
  note "未找到 Agnes key（~/dev/Agnes.md），自动降级 AGNES=fake"
  AGNES="fake"
fi
if [ "$AGNES" = "fake" ]; then
  node "$ROOT/scripts/dev-fake-multimodal-server.mjs" > "$OUT/fake-multimodal.log" 2>&1 &
  FAKE_PID=$!
  export AEP_DAP_DEV_SEED_BASE_URL="http://localhost:$FAKE_PORT"
  export AEP_DAP_DEV_SEED_API_KEY="fake-key"
  export AEP_DAP_DEV_SEED_CHAT_MODEL="fake-chat"
  export AEP_DAP_DEV_SEED_IMAGE_MODEL="fake-image"
  export AEP_DAP_DEV_SEED_VIDEO_MODEL="fake-video"
  sleep 1
  note "fake 多模态引擎已启动（${AEP_DAP_DEV_SEED_BASE_URL}）→ dev-seed 绑定 DAP_*"
elif [ "$AGNES" = "none" ]; then
  export AEP_DAP_DEV_SEED_ENABLED=false   # 不绑端点 → 走占位降级路径
  export AEP_DAP_ALLOW_PLACEHOLDER=true
  note "AGNES=none · 不绑端点 + 显式放行占位降级（生产默认严格 503）"
else
  # real：dev-seed 指向 Agnes 云端，模型用真实 id（不再 export AGNES_API_KEY 给 server）
  export AEP_DAP_DEV_SEED_BASE_URL="${AGNES_BASE_URL:-https://apihub.agnes-ai.com}"
  export AEP_DAP_DEV_SEED_API_KEY="$AGNES_API_KEY"
  export AEP_DAP_DEV_SEED_CHAT_MODEL="${AGNES_CHAT_MODEL:-agnes-2.0-flash}"
  export AEP_DAP_DEV_SEED_IMAGE_MODEL="${AGNES_IMAGE_MODEL:-agnes-image-2.1-flash}"
  export AEP_DAP_DEV_SEED_VIDEO_MODEL="${AGNES_VIDEO_MODEL:-agnes-video-v2.0}"
  note "真实 Agnes（${AEP_DAP_DEV_SEED_BASE_URL}）→ dev-seed 绑定 DAP_*"
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
