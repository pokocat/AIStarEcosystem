#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/deploy-local.sh — 在 ECS 本机直接部署（不走 SSH）。
#
# 用途：
#   开发机网络不稳 / GitHub Actions 不可用 / 想直接在 ECS 本机部署已有代码。
#   如果还要自动拉最新代码，用 update-and-deploy.sh 或本脚本的 --pull。
#
# 用法：
#   ./infra/scripts/deploy-local.sh [services] [options]
#
# services（参数 / SERVICES 环境变量）：
#   all                                → server web-celebrity admin sau-service
#   server                             → 单个
#   server,web-celebrity               → 逗号或空格分隔
#   "server web-celebrity admin"       → 同上
#
# options：
#   --no-build         跳过 build-release.sh（要求 RELEASE_DIR 已存在）
#   --no-restart       仅落位文件，不 systemctl restart
#   --no-verify        部署后跳过 verify.sh 健康检查
#   --no-deps          跳过 install-host-deps.sh 宿主机依赖补齐
#   --no-env-check     跳过 /etc/aistareco/*.env 与 release manifest 检查
#   --no-fonts         跳过 install-cjk-fonts.sh 幂等执行
#   --pull             先 git pull 再部署（等价于 update-and-deploy.sh）
#   --keep-previous=N  保留多少个 .__previous__-<release> 备份目录（默认 2，0 = 立即删除）
#   --release-id=ID    指定 RELEASE_ID（默认 YYYYmmddHHMMSS-<git-sha>）
#
# 关键环境变量：
#   REMOTE_ROOT        默认 /opt/ai-star-eco（与 deploy-release.sh 对齐）
#   APP_USER/GROUP     默认 $(id -un)/$(id -gn)，落位文件的 owner
#   SUDO               默认 sudo；root 直接 root 跑可以传 SUDO=""
#   SKIP_INSTALL       传给 build-release.sh（1 = 跳 pnpm install）
#   SKIP_TYPECHECK     传给 build-release.sh（1 = 紧急部署跳 tsc --noEmit）
#   ENV_CHECK_WARN_ONLY 传给 check-runtime-env.sh（1 = env 问题只警告不阻断）
#   PUBLIC_BASE        verify.sh 用的公网 base url，默认 http://127.0.0.1
#
# 示例：
#   # all-in-one 全量部署
#   sudo ./infra/scripts/deploy-local.sh all
#
#   # 服务器上一键更新代码 + 补依赖 + 部署
#   sudo ./infra/scripts/deploy-local.sh all --pull
#
#   # 只更新 server + admin
#   sudo ./infra/scripts/deploy-local.sh server,admin
#
#   # 紧急部署：跳 typecheck + 跳 verify
#   SKIP_TYPECHECK=1 sudo ./infra/scripts/deploy-local.sh all --no-verify
#
#   # 先 build 再人工 review，再无 build 直接落位
#   ./infra/scripts/build-release.sh all
#   sudo ./infra/scripts/deploy-local.sh all --no-build --release-id=<旧 RELEASE_ID>
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail
export PATH="/usr/local/bin:/opt/node-current/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

DEFAULT_SERVICES="server web-celebrity admin sau-service"
ORIGINAL_ARGS=("$@")

# ── 参数解析 ────────────────────────────────────────────────────────────
RAW_SERVICES=""
DO_BUILD=1
DO_RESTART=1
DO_VERIFY=1
DO_DEPS=1
DO_ENV_CHECK="${ENV_CHECK:-1}"
DO_FONTS=1
DO_PULL=0
KEEP_PREVIOUS="${KEEP_PREVIOUS:-2}"
RELEASE_ID="${RELEASE_ID:-}"

for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    --no-restart) DO_RESTART=0 ;;
    --no-verify) DO_VERIFY=0 ;;
    --no-deps) DO_DEPS=0 ;;
    --no-env-check) DO_ENV_CHECK=0 ;;
    --no-fonts) DO_FONTS=0 ;;
    --pull) DO_PULL=1 ;;
    --keep-previous=*) KEEP_PREVIOUS="${arg#--keep-previous=}" ;;
    --release-id=*) RELEASE_ID="${arg#--release-id=}" ;;
    --*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) RAW_SERVICES="${RAW_SERVICES} ${arg}" ;;
  esac
done

RAW_SERVICES="$(printf "%s" "${RAW_SERVICES:-${SERVICES:-all}}" | xargs)"

REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-star-eco}"
APP_USER="${APP_USER:-$(id -un)}"
APP_GROUP="${APP_GROUP:-$(id -gn)}"
SUDO="${SUDO-sudo}"
PUBLIC_BASE="${PUBLIC_BASE:-http://127.0.0.1}"

[[ "$KEEP_PREVIOUS" =~ ^[0-9]+$ ]] || { echo "--keep-previous must be a non-negative integer" >&2; exit 2; }

log()  { printf "\033[1;34m[deploy-local]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[deploy-local]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[deploy-local] %s\033[0m\n" "$*" >&2; exit 1; }

normalize_services() {
  local raw="${1//,/ }"
  local out="" item
  for item in $raw; do
    case "$item" in
      all) out="$out $DEFAULT_SERVICES" ;;
      server|web-celebrity|admin|sau-service) out="$out $item" ;;
      "") ;;
      *) fail "unknown service '$item' (expected server|web-celebrity|admin|sau-service|all)" ;;
    esac
  done
  # 保序去重
  local seen=" " deduped=""
  for item in $out; do
    case "$seen" in
      *" $item "*) ;;
      *) seen="$seen$item "; deduped="$deduped $item" ;;
    esac
  done
  printf "%s\n" "$deduped" | xargs
}

SERVICES_TO_DEPLOY="$(normalize_services "$RAW_SERVICES")"
[[ -n "$SERVICES_TO_DEPLOY" ]] || fail "no services selected"

# --pull 转给 update-and-deploy.sh：它会先安全更新 git，再 exec 回 deploy-local.sh。
if [[ "$DO_PULL" == "1" ]]; then
  UPDATE_ARGS=()
  for arg in "${ORIGINAL_ARGS[@]}"; do
    [[ "$arg" == "--pull" ]] && continue
    UPDATE_ARGS+=("$arg")
  done
  if [[ "${#UPDATE_ARGS[@]}" -eq 0 ]]; then
    UPDATE_ARGS=("all")
  fi
  log "--pull requested; hand off to update-and-deploy.sh"
  exec "$REPO_ROOT/infra/scripts/update-and-deploy.sh" "${UPDATE_ARGS[@]}"
fi

# ── Phase 0：宿主机依赖（幂等，只补缺口） ───────────────────────────────
if [[ "$DO_DEPS" == "1" ]]; then
  if [[ -f "$REPO_ROOT/infra/scripts/install-host-deps.sh" ]]; then
    log "ensure host dependencies"
    "$REPO_ROOT/infra/scripts/install-host-deps.sh" "$SERVICES_TO_DEPLOY"
  else
    log "WARN: install-host-deps.sh missing; skip host dependency ensure"
  fi
fi

# ── Phase 1：build（除非 --no-build） ─────────────────────────────────────
if [[ "$DO_BUILD" == "1" ]]; then
  if [[ -z "$RELEASE_ID" ]]; then
    RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
  fi
  export RELEASE_ID
  log "build phase: RELEASE_ID=$RELEASE_ID services='$SERVICES_TO_DEPLOY'"
  "$REPO_ROOT/infra/scripts/build-release.sh" "$SERVICES_TO_DEPLOY"
else
  [[ -n "$RELEASE_ID" ]] || fail "--no-build requires --release-id=<existing RELEASE_ID>"
fi

RELEASE_DIR="$REPO_ROOT/dist/deploy/$RELEASE_ID"
[[ -d "$RELEASE_DIR" ]] || fail "release dir not found: $RELEASE_DIR"
[[ -f "$RELEASE_DIR/manifest.env" ]] || fail "manifest missing: $RELEASE_DIR/manifest.env"

# ── Phase 2：运行时 env + build-time manifest 预检 ─────────────────────
if [[ "$DO_ENV_CHECK" == "1" ]]; then
  if [[ -f "$REPO_ROOT/infra/scripts/check-runtime-env.sh" ]]; then
    log "check runtime env"
    $SUDO bash "$REPO_ROOT/infra/scripts/check-runtime-env.sh" "$SERVICES_TO_DEPLOY" --release-dir "$RELEASE_DIR"
  else
    log "WARN: check-runtime-env.sh missing; skip env check"
  fi
fi

# ── Phase 3：CJK 字体（幂等） ────────────────────────────────────────────
if [[ "$DO_FONTS" == "1" ]]; then
  if [[ -f "$REPO_ROOT/infra/scripts/install-cjk-fonts.sh" ]]; then
    log "ensure system CJK fonts"
    $SUDO bash "$REPO_ROOT/infra/scripts/install-cjk-fonts.sh"
  fi
fi

# ── Phase 4：落位 + restart ────────────────────────────────────────────
$SUDO mkdir -p \
  "$REMOTE_ROOT/releases" \
  "$REMOTE_ROOT/server" \
  "$REMOTE_ROOT/web-celebrity" \
  "$REMOTE_ROOT/admin" \
  "$REMOTE_ROOT/sau-service"

RELEASE_STORE="$REMOTE_ROOT/releases/$RELEASE_ID"
log "stage release to $RELEASE_STORE"
$SUDO rm -rf "$RELEASE_STORE"
$SUDO mkdir -p "$RELEASE_STORE"
$SUDO cp -a "$RELEASE_DIR"/. "$RELEASE_STORE"/
$SUDO chown -R "$APP_USER:$APP_GROUP" "$RELEASE_STORE"

require_artifact() {
  local file="$1" svc="$2"
  [[ -f "$RELEASE_STORE/$file" ]] || fail "service '$svc' requires missing artifact: $file"
}

# 保留 N 个 .__previous__-<release> 备份；超过则按 mtime 删除最旧的
prune_previous_backups() {
  local target="$1"
  local parent base
  parent="$(dirname "$target")"
  base="$(basename "$target")"
  # ls 按 mtime 降序，超过 KEEP_PREVIOUS 的全删
  local backups
  backups=$($SUDO bash -c "ls -1dt '$parent/${base}.__previous__-'* 2>/dev/null || true")
  [[ -z "$backups" ]] && return 0
  local kept=0
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    if (( kept < KEEP_PREVIOUS )); then
      kept=$((kept + 1))
    else
      log "prune old backup: $dir"
      $SUDO rm -rf "$dir"
    fi
  done <<< "$backups"
}

restart_unit() {
  local unit="$1"
  if [[ "$DO_RESTART" != "1" ]]; then
    log "skip restart: $unit (--no-restart)"
    return 0
  fi
  if ! $SUDO systemctl list-unit-files "${unit}.service" >/dev/null 2>&1; then
    log "WARN: systemd unit not found: $unit.service — 跳过 restart（首次部署？参考 infra/systemd/*.example）"
    return 0
  fi
  log "systemctl restart $unit"
  $SUDO systemctl restart "$unit"
}

deploy_server() {
  require_artifact "server/app.jar" server
  log "install server jar → $REMOTE_ROOT/server/app.jar"
  $SUDO install -m 0644 "$RELEASE_STORE/server/app.jar" "$REMOTE_ROOT/server/app.jar"
  $SUDO chown "$APP_USER:$APP_GROUP" "$REMOTE_ROOT/server/app.jar"
  restart_unit aistareco-server
}

extract_app() {
  local service="$1" tarball="$2" target="$3" unit="$4"
  require_artifact "$tarball" "$service"
  log "extract $service → $target"

  local next="${target}.__next__${RELEASE_ID}"
  local prev_ts="${target}.__previous__-${RELEASE_ID}"

  $SUDO rm -rf "$next"
  $SUDO mkdir -p "$next"
  $SUDO tar -xzf "$RELEASE_STORE/$tarball" -C "$next"
  $SUDO chown -R "$APP_USER:$APP_GROUP" "$next"

  if [[ -e "$target" && ! -L "$target" && -n "$(ls -A "$target" 2>/dev/null || true)" ]]; then
    $SUDO mv "$target" "$prev_ts"
  elif [[ -e "$target" ]]; then
    # 空目录或符号链接，直接干掉
    $SUDO rm -rf "$target"
  fi
  $SUDO mv "$next" "$target"

  restart_unit "$unit"
  prune_previous_backups "$target"
}

deploy_sau_service() {
  require_artifact "sau-service.tar.gz" sau-service
  log "extract sau-service source → $REMOTE_ROOT/sau-service"

  local target="$REMOTE_ROOT/sau-service"
  local next="${target}.__next__${RELEASE_ID}"
  local prev_ts="${target}.__previous__-${RELEASE_ID}"

  $SUDO rm -rf "$next"
  $SUDO mkdir -p "$next"
  $SUDO tar -xzf "$RELEASE_STORE/sau-service.tar.gz" -C "$next"
  $SUDO chown -R "$APP_USER:$APP_GROUP" "$next"

  log "docker build aistareco/sau-service:$RELEASE_ID (+ :real tag)"
  (cd "$next" && $SUDO docker build --build-arg INSTALL_REAL=1 \
       -t "aistareco/sau-service:$RELEASE_ID" \
       -t aistareco/sau-service:real .)

  if [[ -e "$target" && ! -L "$target" && -n "$(ls -A "$target" 2>/dev/null || true)" ]]; then
    $SUDO mv "$target" "$prev_ts"
  elif [[ -e "$target" ]]; then
    $SUDO rm -rf "$target"
  fi
  $SUDO mv "$next" "$target"

  restart_unit aistareco-sau-service
  prune_previous_backups "$target"
}

# 逐个部署，单个失败立即终止（set -e）
for svc in $SERVICES_TO_DEPLOY; do
  case "$svc" in
    server)        deploy_server ;;
    web-celebrity) extract_app web-celebrity web-celebrity.tar.gz "$REMOTE_ROOT/web-celebrity" aistareco-web-celebrity ;;
    admin)         extract_app admin         admin.tar.gz         "$REMOTE_ROOT/admin"         aistareco-admin ;;
    sau-service)   deploy_sau_service ;;
  esac
done

# ── Phase 4：verify ────────────────────────────────────────────────────
if [[ "$DO_VERIFY" == "1" && "$DO_RESTART" == "1" ]]; then
  if [[ -x "$REPO_ROOT/infra/scripts/verify.sh" ]]; then
    log "running verify.sh (local mode)"
    # 复用现有 verify.sh，但目标就是本机
    DEPLOY_HOST="${DEPLOY_HOST:-$(id -un)@127.0.0.1}" \
    SSH_KEY="${SSH_KEY:-}" \
    PUBLIC_BASE="$PUBLIC_BASE" \
    REMOTE_ROOT="$REMOTE_ROOT" \
    LOCAL_MODE=1 \
      "$REPO_ROOT/infra/scripts/verify.sh" || log "WARN: verify.sh 报错（仍视为部署完成，请人工核对）"
  fi
fi

ok "deployed: $SERVICES_TO_DEPLOY (RELEASE_ID=$RELEASE_ID)"
log "release artifacts staged at $RELEASE_STORE"
log "previous backups kept: $KEEP_PREVIOUS (回滚: sudo mv \$REMOTE_ROOT/<svc>.__previous__-<old-id> \$REMOTE_ROOT/<svc>)"
