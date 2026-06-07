#!/usr/bin/env bash
# ============================================================
# 数字人资产平台 · 本地后端一键起服（人工体验用，前台运行，Ctrl+C 停止）
#
#   bash scripts/dap-dev.sh                  # MySQL + 真实 Agnes（默认）
#   PROFILE=dev bash scripts/dap-dev.sh      # H2 内存库（不依赖本地 MySQL）
#   AGNES=fake bash scripts/dap-dev.sh       # 本地 fake Agnes（离线/省额度）
#   DB_PASSWORD= bash scripts/dap-dev.sh     # MySQL root 空密码时
#
# 前端另开终端：pnpm dev:aiavatar → http://localhost:3013
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

PROFILE="${PROFILE:-mysql}"
AGNES="${AGNES:-real}"
SERVER_PORT="${SERVER_PORT:-8080}"
FAKE_PORT="${FAKE_AGNES_PORT:-18181}"

# ── Agnes key（自动读 ~/dev/Agnes.md；没有则降级 fake）──────────
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ] && [ -f "$HOME/dev/Agnes.md" ]; then
  AGNES_API_KEY="$(grep -o 'Agnes-ak:[^ ]*' "$HOME/dev/Agnes.md" | head -1 | cut -d: -f2 | tr -d '[:space:]')"
  export AGNES_API_KEY
fi
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ]; then
  echo "⚠️  未找到 AGNES_API_KEY，降级 AGNES=fake"
  AGNES="fake"
fi
FAKE_PID=""
if [ "$AGNES" = "fake" ]; then
  node "$ROOT/scripts/dev-fake-agnes-server.mjs" &
  FAKE_PID=$!
  export AGNES_BASE_URL="http://localhost:$FAKE_PORT" AGNES_API_KEY="fake-key"
  trap '[ -n "$FAKE_PID" ] && kill $FAKE_PID 2>/dev/null' EXIT
fi

# ── 本地联调环境（与 dap-verify.sh 一致）──────────────────────
export AEP_DEV_AUTH_ENABLED=true            # 体验账号一键登录
export AEP_SMS_DRIVER=log                   # 验证码打到 server 日志
export AEP_SEED_DEV_DATA_ENABLED=true       # 种子账号
export AEP_CDN_DRIVER=local
export AEP_CDN_PUBLIC_BASE_URL="${AEP_CDN_PUBLIC_BASE_URL:-http://localhost:${SERVER_PORT}/cdn}"
export AEP_JWT_SECRET="${AEP_JWT_SECRET:-dap-local-dev-jwt-secret-请勿用于生产-32c}"
export AEP_SECRET_KEY="${AEP_SECRET_KEY:-dap-local-dev-aes-secret-请勿用于生产-32c}"

SPRING_ARGS=""
if [ "$PROFILE" = "mysql" ]; then
  export DB_URL="${DB_URL:-jdbc:mysql://localhost:3306/aistareco?useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&createDatabaseIfNotExist=true}"
  export DB_USERNAME="${DB_USERNAME:-root}"
  export DB_PASSWORD="${DB_PASSWORD-root}"
  SPRING_ARGS="-Dspring-boot.run.profiles=mysql"
fi

echo "================================================================"
echo " 后端 : http://localhost:${SERVER_PORT}   profile=${PROFILE}  Agnes=${AGNES}"
echo " 前端 : 另开终端 → pnpm dev:aiavatar → http://localhost:3013"
echo " 登录 : 登录页「体验账号」tab 一键进入（creator_luna 等）"
echo "================================================================"
cd apps/server && exec ./mvnw spring-boot:run $SPRING_ARGS
