#!/usr/bin/env bash
# ============================================================
# 数字人资产平台 · 本地后端一键起服（人工体验用，前台运行，Ctrl+C 停止）
#
#   bash apps/web-aiavatar/scripts/dap-dev.sh                  # MySQL + 真实 Agnes（默认）
#   PROFILE=dev bash apps/web-aiavatar/scripts/dap-dev.sh      # H2 内存库（不依赖本地 MySQL）
#   AGNES=fake bash apps/web-aiavatar/scripts/dap-dev.sh       # 本地 fake 多模态引擎（离线/省额度）
#   AGNES=none bash apps/web-aiavatar/scripts/dap-dev.sh       # 不绑引擎（自己进 admin 配 / 测占位）
#   DB_PASSWORD= bash apps/web-aiavatar/scripts/dap-dev.sh     # MySQL root 空密码时
#
# 大模型统一经后台「AI 模型与 Key + AI 应用绑定」管理；本脚本用 aep.dap.dev-seed.* 在开机时
# 把 DAP_* 端点自动「种」进 admin 表（幂等、不覆盖你在 admin 手配的端点），免去每次手动配置。
# 前端另开终端：pnpm dev:aiavatar → http://localhost:3013
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/../../.."   # apps/web-aiavatar/scripts → 仓库根
ROOT="$(pwd)"

PROFILE="${PROFILE:-mysql}"
AGNES="${AGNES:-real}"
SERVER_PORT="${SERVER_PORT:-8080}"
FAKE_PORT="${FAKE_MULTIMODAL_PORT:-${FAKE_AGNES_PORT:-18181}}"

# ── 生成引擎接入点（dev-seed 自动绑定 DAP_*；不再用 AGNES_* env 兜底）─────────
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ] && [ -f "$HOME/dev/Agnes.md" ]; then
  AGNES_API_KEY="$(grep -o 'Agnes-ak:[^ ]*' "$HOME/dev/Agnes.md" | head -1 | cut -d: -f2 | tr -d '[:space:]')"
fi
if [ "$AGNES" = "real" ] && [ -z "${AGNES_API_KEY:-}" ]; then
  echo "⚠️  未找到 Agnes key，降级 AGNES=fake"
  AGNES="fake"
fi
FAKE_PID=""
export AEP_DAP_DEV_SEED_ENABLED=true
if [ "$AGNES" = "fake" ]; then
  node "$ROOT/apps/web-aiavatar/scripts/dev-fake-multimodal-server.mjs" &
  FAKE_PID=$!
  trap '[ -n "$FAKE_PID" ] && kill $FAKE_PID 2>/dev/null' EXIT
  export AEP_DAP_DEV_SEED_BASE_URL="http://localhost:$FAKE_PORT"
  export AEP_DAP_DEV_SEED_API_KEY="fake-key"
  export AEP_DAP_DEV_SEED_CHAT_MODEL="fake-chat"
  export AEP_DAP_DEV_SEED_IMAGE_MODEL="fake-image"
  export AEP_DAP_DEV_SEED_VIDEO_MODEL="fake-video"
elif [ "$AGNES" = "none" ]; then
  # 不绑端点：自己进 admin「AI 模型与 Key」配，或体验占位降级（dev profile 默认放行）
  export AEP_DAP_DEV_SEED_ENABLED=false
else
  # real：dev-seed 指向 Agnes 云端，模型用真实 id
  export AEP_DAP_DEV_SEED_BASE_URL="${AGNES_BASE_URL:-https://apihub.agnes-ai.com}"
  export AEP_DAP_DEV_SEED_API_KEY="$AGNES_API_KEY"
  export AEP_DAP_DEV_SEED_CHAT_MODEL="${AGNES_CHAT_MODEL:-agnes-2.0-flash}"
  export AEP_DAP_DEV_SEED_IMAGE_MODEL="${AGNES_IMAGE_MODEL:-agnes-image-2.1-flash}"
  export AEP_DAP_DEV_SEED_VIDEO_MODEL="${AGNES_VIDEO_MODEL:-agnes-video-v2.0}"
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
echo " 后端 : http://localhost:${SERVER_PORT}   profile=${PROFILE}  引擎=${AGNES}（dev-seed 绑定 DAP_*）"
echo " 前端 : 另开终端 → pnpm dev:aiavatar → http://localhost:3013"
echo " 登录 : 登录页「体验账号」tab 一键进入（creator_luna 等）"
echo "================================================================"
cd apps/server && exec ./mvnw spring-boot:run $SPRING_ARGS
