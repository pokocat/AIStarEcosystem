#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/dev-server.sh — 本机 server 启动 wrapper
#
# 默认连本机 MySQL（localhost:3306, root/root, 库 aistareco）+ 注入 dev 弱密钥 +
# 跑 mvn spring-boot:run mysql profile。脚本会：
#   1. 检查 mysql client 是否装
#   2. 检查 MySQL 服务是否在跑（mysqladmin ping）
#   3. 检查 aistareco 库是否存在，没有就 CREATE DATABASE
#   4. 自动 export 3 个本机 dev 弱密钥让 mysql profile 启动校验通过
#   5. exec mvn spring-boot:run
#
# 用法：
#   ./infra/scripts/dev-server.sh                      # 默认：本机 mysql
#   ./infra/scripts/dev-server.sh --h2                 # 旁路 H2 文件库（无需 mysql）
#   ./infra/scripts/dev-server.sh --docker             # 用 docker 启 aistareco-mysql-dev 容器
#   ./infra/scripts/dev-server.sh --reset-db           # 删 aistareco 库重来
#   ./infra/scripts/dev-server.sh --mysql-host HOST    # 默认 localhost
#   ./infra/scripts/dev-server.sh --mysql-port N       # 默认 3306
#   ./infra/scripts/dev-server.sh --mysql-user U       # 默认 root
#   ./infra/scripts/dev-server.sh --mysql-pass P       # 默认 root
#   ./infra/scripts/dev-server.sh --skip-mysql         # 假设已就绪，跳过所有 mysql 检查
#   ./infra/scripts/dev-server.sh --mvn-args "-DskipTests"
#
# ⚠️ 注入的是 **固定弱密钥**（包含 NOT-FOR-PROD 字样），仅本机 dev 用，绝不能上生产。
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# ── 配置 ─────────────────────────────────────────────────────────────────
PROFILE="mysql"
MODE="native"            # native | docker | skip
RESET_DB=0
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASS="root"
MYSQL_DB="aistareco"
MVN_ARGS=""
DOCKER_CONTAINER="aistareco-mysql-dev"
DOCKER_VOLUME="aistareco-mysql-dev-data"
DOCKER_IMAGE="mysql:8.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --h2)         PROFILE="dev"; MODE="skip"; shift;;
    --docker)     MODE="docker"; shift;;
    --skip-mysql) MODE="skip"; shift;;
    --reset-db)   RESET_DB=1; shift;;
    --mysql-host) MYSQL_HOST="$2"; shift 2;;
    --mysql-port) MYSQL_PORT="$2"; shift 2;;
    --mysql-user) MYSQL_USER="$2"; shift 2;;
    --mysql-pass) MYSQL_PASS="$2"; shift 2;;
    --mvn-args)   MVN_ARGS="$2"; shift 2;;
    -h|--help)    sed -n '2,28p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

# ── 颜色 ─────────────────────────────────────────────────────────────────
G=$'\033[1;32m'; R=$'\033[1;31m'; Y=$'\033[1;33m'; C=$'\033[1;36m'; N=$'\033[0m'
log()  { printf "${C}[dev-server]${N} %s\n" "$*"; }
ok()   { printf "${G}  ✓${N} %s\n" "$*"; }
warn() { printf "${Y}  ! %s${N}\n" "$*"; }
die()  { printf "${R}  ✗ %s${N}\n" "$*" >&2; exit 1; }

# ── 前置工具 ─────────────────────────────────────────────────────────────
command -v mvn >/dev/null || die "缺 mvn（brew install maven 或 apt install maven）"
command -v java >/dev/null || die "缺 java（推荐 java 17）"

# ── MySQL 处理：三种模式 ─────────────────────────────────────────────────
case "$MODE" in

  native)
    log "MySQL 模式：本机服务（$MYSQL_USER@$MYSQL_HOST:$MYSQL_PORT）"

    command -v mysql >/dev/null || die "缺 mysql client（brew install mysql-client 或 apt install mysql-client）"
    command -v mysqladmin >/dev/null || die "缺 mysqladmin（同上）"

    # 1) ping 测试服务
    if ! mysqladmin ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" --silent 2>/dev/null; then
      die "MySQL 连不上 $MYSQL_HOST:$MYSQL_PORT（user=$MYSQL_USER）。
   - macOS:    brew services start mysql
   - Linux:    systemctl start mysql
   - 密码不对: --mysql-user / --mysql-pass 改默认值
   - 用 docker: --docker      用 H2: --h2"
    fi
    ok "MySQL 服务在跑"

    # 2) --reset-db
    if [[ $RESET_DB -eq 1 ]]; then
      log "重置：DROP DATABASE IF EXISTS $MYSQL_DB"
      mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" \
        -e "DROP DATABASE IF EXISTS $MYSQL_DB;" 2>/dev/null
      ok "$MYSQL_DB 已删"
    fi

    # 3) 确保库存在（首启自动建，utf8mb4_unicode_ci 跟 application-mysql.yml 对齐）
    mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" \
      -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
      2>/dev/null
    ok "数据库 $MYSQL_DB 就绪"
    ;;

  docker)
    log "MySQL 模式：docker 容器 $DOCKER_CONTAINER（port $MYSQL_PORT）"

    command -v docker >/dev/null || die "缺 docker（curl -fsSL https://get.docker.com | sh）"
    docker info >/dev/null 2>&1 || die "docker 未运行（启动 Docker Desktop 或 systemctl start docker）"

    if [[ $RESET_DB -eq 1 ]]; then
      log "重置：stop+rm 容器 + 删 volume"
      docker rm -f "$DOCKER_CONTAINER" 2>/dev/null || true
      docker volume rm "$DOCKER_VOLUME" 2>/dev/null || true
      ok "容器 + 数据卷已清"
    fi

    state=$(docker inspect -f '{{.State.Status}}' "$DOCKER_CONTAINER" 2>/dev/null || echo "absent")
    case "$state" in
      running)        ok "容器已在跑";;
      exited|created) log "启动已停容器"; docker start "$DOCKER_CONTAINER" >/dev/null; ok "已 start";;
      absent)
        if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$MYSQL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
          die "宿主端口 $MYSQL_PORT 已被占用。--mysql-port 换端口；或不加 --docker 让脚本走本机 mysql"
        fi
        log "首次启动：docker run $DOCKER_IMAGE → volume $DOCKER_VOLUME"
        docker run -d \
          --name "$DOCKER_CONTAINER" \
          -p "$MYSQL_PORT:3306" \
          -e MYSQL_ROOT_PASSWORD="$MYSQL_PASS" \
          -e MYSQL_DATABASE="$MYSQL_DB" \
          -v "$DOCKER_VOLUME:/var/lib/mysql" \
          --restart unless-stopped \
          "$DOCKER_IMAGE" \
          --character-set-server=utf8mb4 \
          --collation-server=utf8mb4_unicode_ci \
          --default-time-zone=+08:00 \
          >/dev/null
        ok "容器已起"
        ;;
      *) die "容器状态异常：$state";;
    esac

    log "等 MySQL ready（最多 60s）"
    for i in $(seq 1 30); do
      if docker exec "$DOCKER_CONTAINER" mysqladmin ping -uroot -p"$MYSQL_PASS" >/dev/null 2>&1; then
        ok "MySQL ready"; break
      fi
      sleep 2
      [[ $i -eq 30 ]] && die "MySQL 60s 内未 ready，看 docker logs $DOCKER_CONTAINER"
    done

    docker exec "$DOCKER_CONTAINER" mysql -uroot -p"$MYSQL_PASS" \
      -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
      2>/dev/null
    ok "数据库 $MYSQL_DB 就绪"

    MYSQL_HOST="localhost"     # docker 暴露的端口在 localhost
    ;;

  skip)
    if [[ "$PROFILE" == "mysql" ]]; then
      log "MySQL 模式：跳过（假设你已经搞定）"
    fi
    # --reset-db 在 H2 模式下清本地 ./data
    if [[ $RESET_DB -eq 1 && "$PROFILE" == "dev" ]]; then
      log "重置 H2：rm -rf apps/server/data"
      rm -rf apps/server/data
      ok "H2 文件库已清"
    fi
    ;;
esac

# ── 注入 dev 弱密钥 ──────────────────────────────────────────────────────
# 这些密钥是固定弱值，仅本机 dev；包含 "NOT-FOR-PROD" 字样让 grep / log scrub
# 一眼能识别。它们 ≥32 字符且不等于 yml 里的 dev default，能通过 JwtUtil /
# AepCryptoUtil 的 mysql/prod profile fail-fast 校验（仅检查「等于 dev default」
# 或长度 <32）。
export AEP_JWT_SECRET="dev-local-jwt-secret-NOT-FOR-PROD-aaaaaaa"
export AEP_INTERNAL_SECRET="dev-local-internal-secret-NOT-FOR-PROD"
export AEP_SECRET_KEY="dev-local-aes-key-NOT-FOR-PROD-bbbbbbb"
export AEP_SEED_DEV_DATA_ENABLED="true"
export AEP_DEV_AUTH_ENABLED="true"

if [[ "$PROFILE" == "mysql" ]]; then
  export DB_URL="jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&connectionCollation=utf8mb4_unicode_ci&characterEncoding=UTF-8"
  export DB_USERNAME="$MYSQL_USER"
  export DB_PASSWORD="$MYSQL_PASS"
fi

# ── 启动 server ──────────────────────────────────────────────────────────
log "启动 Spring Boot（profile=$PROFILE）"
echo
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo "${Y}  ⚠️  注入的是 dev 弱密钥（NOT-FOR-PROD），不可上线${N}"
echo "${Y}  ✓ http://localhost:8080/api/auth/dev-accounts  ← 看演示账号${N}"
[[ "$PROFILE" == "dev" ]] && \
echo "${Y}  ✓ http://localhost:8080/h2-console             ← H2 GUI${N}"
[[ "$PROFILE" == "mysql" && "$MODE" == "native" ]] && \
echo "${Y}  ✓ mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p $MYSQL_DB${N}"
[[ "$PROFILE" == "mysql" && "$MODE" == "docker" ]] && \
echo "${Y}  ✓ docker logs -f $DOCKER_CONTAINER             ← MySQL 容器日志${N}"
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo
exec mvn -f apps/server/pom.xml spring-boot:run \
  -Dspring-boot.run.profiles="$PROFILE" \
  $MVN_ARGS
