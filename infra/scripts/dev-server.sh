#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/dev-server.sh — 本机 server 启动 wrapper
#
# 默认拉起 Docker MySQL 容器 + 注入 dev 弱密钥 + 跑 mvn spring-boot:run mysql profile。
# 第一次跑会 docker run 一个 aistareco-mysql-dev 容器（数据存 Docker volume，重启保留）；
# 后续直接 reuse。
#
# 用法：
#   ./infra/scripts/dev-server.sh                # 默认：mysql profile + docker mysql
#   ./infra/scripts/dev-server.sh --h2           # 旁路：H2 文件库（无需 docker）
#   ./infra/scripts/dev-server.sh --reset-db     # 删 docker mysql 容器 + 数据卷重来
#   ./infra/scripts/dev-server.sh --mysql-port 3307  # mysql 容器映射到其它端口（端口冲突时）
#   ./infra/scripts/dev-server.sh --skip-mysql   # 假设你已经在本机/远端跑了 MySQL，跳过容器管理
#   ./infra/scripts/dev-server.sh --mvn-args "-DskipTests" # 透传给 mvn
#
# ⚠️ 注入的是 **固定弱密钥**，仅本机 dev 用，绝不能上生产。
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# ── 配置 ─────────────────────────────────────────────────────────────────
PROFILE="mysql"
RESET_DB=0
SKIP_MYSQL=0
MYSQL_PORT=3306
MVN_ARGS=""
MYSQL_CONTAINER="aistareco-mysql-dev"
MYSQL_VOLUME="aistareco-mysql-dev-data"
MYSQL_IMAGE="mysql:8.0"
MYSQL_DB="aistareco"
MYSQL_ROOT_PASSWORD="root"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --h2)         PROFILE="dev"; SKIP_MYSQL=1; shift;;
    --reset-db)   RESET_DB=1; shift;;
    --skip-mysql) SKIP_MYSQL=1; shift;;
    --mysql-port) MYSQL_PORT="$2"; shift 2;;
    --mvn-args)   MVN_ARGS="$2"; shift 2;;
    -h|--help)    sed -n '2,20p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

# ── 颜色 ─────────────────────────────────────────────────────────────────
G=$'\033[1;32m'; R=$'\033[1;31m'; Y=$'\033[1;33m'; C=$'\033[1;36m'; N=$'\033[0m'
log()  { printf "${C}[dev-server]${N} %s\n" "$*"; }
ok()   { printf "${G}  ✓${N} %s\n" "$*"; }
warn() { printf "${Y}  ! %s${N}\n" "$*"; }
die()  { printf "${R}  ✗ %s${N}\n" "$*" >&2; exit 1; }

# ── 前置检查 ─────────────────────────────────────────────────────────────
command -v mvn >/dev/null || die "缺 mvn（brew install maven 或 apt install maven）"
command -v java >/dev/null || die "缺 java（推荐 java 17）"

if [[ "$SKIP_MYSQL" -eq 0 ]]; then
  command -v docker >/dev/null || die "缺 docker（curl -fsSL https://get.docker.com | sh）；或加 --skip-mysql / --h2"
  docker info >/dev/null 2>&1 || die "docker 未运行（启动 Docker Desktop 或 systemctl start docker）"
fi

# ── --reset-db ───────────────────────────────────────────────────────────
if [[ $RESET_DB -eq 1 ]]; then
  if [[ "$PROFILE" == "dev" ]]; then
    log "重置 H2 数据：rm -rf apps/server/data"
    rm -rf apps/server/data
    ok "H2 文件库已清"
  else
    log "重置 MySQL：stop+rm 容器 $MYSQL_CONTAINER + 删 volume $MYSQL_VOLUME"
    docker rm -f "$MYSQL_CONTAINER" 2>/dev/null || true
    docker volume rm "$MYSQL_VOLUME" 2>/dev/null || true
    ok "MySQL 容器 + 数据卷已清"
  fi
fi

# ── MySQL 容器生命周期 ──────────────────────────────────────────────────
if [[ "$PROFILE" == "mysql" && "$SKIP_MYSQL" -eq 0 ]]; then
  log "确保 MySQL 容器 $MYSQL_CONTAINER 在跑（port $MYSQL_PORT）"

  state=$(docker inspect -f '{{.State.Status}}' "$MYSQL_CONTAINER" 2>/dev/null || echo "absent")
  case "$state" in
    running)
      ok "容器 $MYSQL_CONTAINER 已在跑"
      ;;
    exited|created)
      log "容器 $MYSQL_CONTAINER 存在但已停，docker start..."
      docker start "$MYSQL_CONTAINER" >/dev/null
      ok "已 start"
      ;;
    absent)
      # 检测端口冲突（仅当宿主上已有别的进程占用时）
      if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$MYSQL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        die "宿主端口 $MYSQL_PORT 已被占用。--mysql-port 换端口，或 --skip-mysql 用现有 MySQL"
      fi
      log "首次启动：docker run $MYSQL_IMAGE → 数据落 volume $MYSQL_VOLUME"
      docker run -d \
        --name "$MYSQL_CONTAINER" \
        -p "$MYSQL_PORT:3306" \
        -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
        -e MYSQL_DATABASE="$MYSQL_DB" \
        -v "$MYSQL_VOLUME:/var/lib/mysql" \
        --restart unless-stopped \
        "$MYSQL_IMAGE" \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_unicode_ci \
        --default-time-zone=+08:00 \
        >/dev/null
      ok "容器已起"
      ;;
    *)
      die "容器 $MYSQL_CONTAINER 状态异常：$state"
      ;;
  esac

  # 等 MySQL ready（mysqladmin ping）
  log "等 MySQL ready（最多 60s）"
  for i in $(seq 1 30); do
    if docker exec "$MYSQL_CONTAINER" mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" >/dev/null 2>&1; then
      ok "MySQL ready"
      break
    fi
    sleep 2
    if [[ $i -eq 30 ]]; then
      die "MySQL 60s 内未 ready，看 docker logs $MYSQL_CONTAINER"
    fi
  done

  # 确保 aistareco 库存在（MYSQL_DATABASE 已建，但 --reset-db 后也可能 race）
  docker exec "$MYSQL_CONTAINER" mysql -uroot -p"$MYSQL_ROOT_PASSWORD" \
    -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
    2>/dev/null
  ok "数据库 $MYSQL_DB 就绪"
fi

# ── 注入 dev 弱密钥 ──────────────────────────────────────────────────────
# ⚠️ 这些密钥是固定弱值，仅本机 dev；任何含 "NOT-FOR-PROD" 的字符串都会触发
#    JwtUtil / AepCryptoUtil 在 mysql/prod profile 启动时的 fail-fast 检查吗？
#    — 否。fail-fast 仅检查 "等于 dev default" 或长度 < 32。
#    这里 NOT-FOR-PROD 是 ≥32 字符且不等于 yml 里的 dev default，所以能通过启动校验。
#    名字带 NOT-FOR-PROD 是给 grep / log scrub 一眼能识别。
export AEP_JWT_SECRET="dev-local-jwt-secret-NOT-FOR-PROD-aaaaaaa"
export AEP_INTERNAL_SECRET="dev-local-internal-secret-NOT-FOR-PROD"
export AEP_SECRET_KEY="dev-local-aes-key-NOT-FOR-PROD-bbbbbbb"
export AEP_SEED_DEV_DATA_ENABLED="true"
export AEP_DEV_AUTH_ENABLED="true"

if [[ "$PROFILE" == "mysql" ]]; then
  # 显式覆盖默认 DB_URL（万一用户改了端口）
  export DB_URL="jdbc:mysql://localhost:${MYSQL_PORT}/${MYSQL_DB}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&connectionCollation=utf8mb4_unicode_ci&characterEncoding=UTF-8"
  export DB_USERNAME="root"
  export DB_PASSWORD="$MYSQL_ROOT_PASSWORD"
fi

# ── 启动 server ──────────────────────────────────────────────────────────
log "启动 Spring Boot（profile=$PROFILE）"
echo
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo "${Y}  ⚠️  注入的是 dev 弱密钥（NOT-FOR-PROD），不可上线${N}"
echo "${Y}  ✓ http://localhost:8080/api/auth/dev-accounts  ← 看演示账号${N}"
echo "${Y}  ✓ http://localhost:8080/h2-console             ← H2 GUI（仅 --h2 时）${N}"
[[ "$PROFILE" == "mysql" ]] && \
echo "${Y}  ✓ docker logs -f $MYSQL_CONTAINER              ← MySQL 日志${N}"
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo
exec mvn -f apps/server/pom.xml spring-boot:run \
  -Dspring-boot.run.profiles="$PROFILE" \
  $MVN_ARGS
