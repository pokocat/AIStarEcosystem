#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/deploy.sh — 幂等部署单个 service 到生产 ECS
#
# 用法：
#   ./infra/scripts/deploy.sh <service> [git-sha-or-tag]
#
# service:
#   server              — Spring Boot 后端
#   web                 — Next 14 (basePath=/web)
#   admin               — Next 14 (basePath=/admin)
#   web-celebrity       — Next 16 (根路径)
#   web-music           — Next 16 (根路径)
#   web-drama           — Next 16 (根路径)
#   sau-service         — Docker (Python FastAPI + Playwright)
#   all                 — 按依赖顺序部署 server → 三个新 web → 旧 web/admin → sau-service
#
# git-sha-or-tag:
#   可选；默认 = git rev-parse --short HEAD
#   仅在 sau-service 时用于 docker image tag
#
# 环境变量（必填）：
#   ECS_HOST            — 形如 root@<your-ecs-host>
#   REMOTE_ROOT         — 默认 /opt/ai-star-eco
#
# 假设：
#   • 远端 /etc/aistareco/*.env 已配置
#   • 远端 /etc/systemd/system/aistareco-*.service 已落位 + daemon-reload
#   • 远端 nginx /etc/nginx/conf.d/ai.conf 已配置
#   • 本机有 SSH key 能登 ECS（推荐 ssh-agent + ssh -A）
#
# 设计原则：
#   1) 失败立即退出（set -euo pipefail）
#   2) 操作前 echo 命令（set -x）
#   3) 输出色彩与时间戳，方便定位是哪一步卡的
#   4) **不**改 nginx / systemd / .env（这些 infra 改动走人工 + git）
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── 配置 ─────────────────────────────────────────────────────────
ECS_HOST="${ECS_HOST:?ECS_HOST is required, e.g. ECS_HOST=root@<your-ecs-host>}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-star-eco}"
SERVICE="${1:?usage: deploy.sh <service> [tag]}"
TAG="${2:-$(git rev-parse --short HEAD)}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# ── 工具函数 ─────────────────────────────────────────────────────
log()  { printf "\033[1;34m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }
ok()   { printf "\033[1;32m[%s] ✓ %s\033[0m\n" "$(date +%H:%M:%S)" "$*"; }
fail() { printf "\033[1;31m[%s] ✗ %s\033[0m\n" "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

ssh_remote() { ssh "$ECS_HOST" "$@"; }

# ── 单 service 部署函数 ─────────────────────────────────────────

deploy_server() {
  log "build server jar (mvnw package -DskipTests)..."
  (cd apps/server && ./mvnw package -DskipTests -q)

  local jar="apps/server/target/ai-star-eco-server-1.0.0.jar"
  [[ -f "$jar" ]] || fail "jar not built: $jar"

  log "rsync jar → $ECS_HOST:$REMOTE_ROOT/apps/server/target/"
  rsync -avz --progress "$jar" "$ECS_HOST:$REMOTE_ROOT/apps/server/target/"

  log "restart systemd aistareco-server (may take 2-3 min for first /api/auth/dev-accounts response)"
  ssh_remote 'systemctl restart aistareco-server'

  ok "server deployed (tag=$TAG)"
}

deploy_next_app() {
  local app_dir="$1"          # apps/web 或 apps/admin
  local svc="$2"              # aistareco-web 或 aistareco-admin
  local pkg_mgr="${3:-npm}"   # npm（legacy web/admin）或 pnpm（新 app）
  local remote_prefix="$4"    # 远端 standalone 子路径前缀（pnpm workspace 产物多一层）

  log "build $app_dir ($pkg_mgr)..."
  if [[ "$pkg_mgr" == "pnpm" ]]; then
    pnpm --filter "@ai-star-eco/${app_dir#apps/}" build
  else
    (cd "$app_dir" && npm install --no-audit --no-fund && npm run build)
  fi

  local local_standalone="$app_dir/.next/standalone"
  local local_static="$app_dir/.next/static"
  local local_public="$app_dir/public"
  local remote_standalone="$REMOTE_ROOT/$app_dir/.next/standalone"

  [[ -d "$local_standalone" ]] || fail "$local_standalone not found; did next config set output:'standalone'?"

  log "rsync $local_standalone/ → $ECS_HOST:$remote_standalone/"
  rsync -az --delete --exclude='.next/static' --exclude='public' \
    "$local_standalone/" "$ECS_HOST:$remote_standalone/"

  log "rsync $local_static/ → $ECS_HOST:$remote_standalone/${remote_prefix}.next/static/"
  rsync -az "$local_static/" "$ECS_HOST:$remote_standalone/${remote_prefix}.next/static/"

  if [[ -d "$local_public" ]]; then
    log "rsync $local_public/ → $ECS_HOST:$remote_standalone/${remote_prefix}public/"
    rsync -az --delete "$local_public/" "$ECS_HOST:$remote_standalone/${remote_prefix}public/"
  fi

  log "rsync next.config.mjs"
  rsync -avz "$app_dir/next.config.mjs" "$ECS_HOST:$REMOTE_ROOT/$app_dir/next.config.mjs"

  log "restart $svc"
  ssh_remote "systemctl restart $svc"

  ok "$app_dir deployed (tag=$TAG)"
}

deploy_sau_service() {
  log "rsync sau-service source → $ECS_HOST:$REMOTE_ROOT/repo/apps/sau-service/"
  rsync -az --delete --exclude='__pycache__' --exclude='.venv' \
    apps/sau-service/ "$ECS_HOST:$REMOTE_ROOT/repo/apps/sau-service/"

  log "remote docker build (--build-arg INSTALL_REAL=1) → aistareco/sau-service:$TAG + :real"
  ssh_remote "cd $REMOTE_ROOT/repo/apps/sau-service && \
    DOCKER_BUILDKIT=1 docker build \
      --progress=plain \
      --build-arg INSTALL_REAL=1 \
      -t aistareco/sau-service:$TAG \
      -t aistareco/sau-service:real \
      ."

  log "restart systemd aistareco-sau-service (will pick up :real tag)"
  ssh_remote 'systemctl restart aistareco-sau-service'

  ok "sau-service deployed (tag=$TAG)"
}

# ── 主分发 ─────────────────────────────────────────────────────

case "$SERVICE" in
  server)
    deploy_server
    ;;
  web)
    deploy_next_app apps/web aistareco-web npm ""
    ;;
  admin)
    deploy_next_app apps/admin aistareco-admin npm ""
    ;;
  web-celebrity)
    deploy_next_app apps/web-celebrity aistareco-web-celebrity pnpm "apps/web-celebrity/"
    ;;
  web-music)
    deploy_next_app apps/web-music aistareco-web-music pnpm "apps/web-music/"
    ;;
  web-drama)
    deploy_next_app apps/web-drama aistareco-web-drama pnpm "apps/web-drama/"
    ;;
  sau-service)
    deploy_sau_service
    ;;
  all)
    deploy_server
    deploy_next_app apps/web aistareco-web npm ""
    deploy_next_app apps/admin aistareco-admin npm ""
    deploy_next_app apps/web-celebrity aistareco-web-celebrity pnpm "apps/web-celebrity/"
    deploy_next_app apps/web-music aistareco-web-music pnpm "apps/web-music/"
    deploy_next_app apps/web-drama aistareco-web-drama pnpm "apps/web-drama/"
    deploy_sau_service
    ;;
  *)
    fail "unknown service: $SERVICE (expected: server|web|admin|web-celebrity|web-music|web-drama|sau-service|all)"
    ;;
esac

log "all done — running verify.sh..."
"$REPO_ROOT/infra/scripts/verify.sh"
