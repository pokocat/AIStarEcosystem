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
#   ./infra/scripts/dev-server.sh --repair-flyway      # 清 flyway_schema_history 里的失败记录
#   ./infra/scripts/dev-server.sh --log                # 日志同步写 logs/server-<timestamp>.log
#   ./infra/scripts/dev-server.sh --log FILE           # 指定日志文件路径
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
REPAIR_FLYWAY=0
MYSQL_HOST="localhost"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASS=""
MYSQL_DB="aistareco"
MVN_ARGS=""
LOG_FILE=""
DOCKER_CONTAINER="aistareco-mysql-dev"
DOCKER_VOLUME="aistareco-mysql-dev-data"
DOCKER_IMAGE="mysql:8.0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --h2)         PROFILE="dev"; MODE="skip"; shift;;
    --docker)     MODE="docker"; shift;;
    --skip-mysql) MODE="skip"; shift;;
    --reset-db)       RESET_DB=1; shift;;
    --repair-flyway)  REPAIR_FLYWAY=1; shift;;
    --mysql-host) MYSQL_HOST="$2"; shift 2;;
    --mysql-port) MYSQL_PORT="$2"; shift 2;;
    --mysql-user) MYSQL_USER="$2"; shift 2;;
    --mysql-pass) MYSQL_PASS="$2"; shift 2;;
    --mvn-args)   MVN_ARGS="$2"; shift 2;;
    --log)
      # --log 后面跟值或单独：./dev-server.sh --log              → 自动时间戳
      #                       ./dev-server.sh --log file.log    → 指定路径
      if [[ ${2:-} == "" || ${2:-} == --* ]]; then
        LOG_FILE="logs/server-$(date +%Y%m%d-%H%M%S).log"
        shift
      else
        LOG_FILE="$2"
        shift 2
      fi
      ;;
    -h|--help)    sed -n '2,30p' "$0"; exit 0;;
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
    log "MySQL 模式：本机服务（${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}）"

    command -v mysql >/dev/null || die "缺 mysql client（brew install mysql-client 或 apt install mysql-client）"

    # mysql 命令封装：捕获 stderr，失败时打印让用户能看到原始 mysql 错（不再静默吞）
    mysql_exec() {
      local sql="$1"
      local err
      if ! err=$(mysql --connect-timeout=5 \
                       -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" \
                       -u "${MYSQL_USER}" -p"${MYSQL_PASS}" \
                       -e "${sql}" 2>&1); then
        printf "${R}  ✗ mysql 命令失败:${N}\n  $ mysql -h %s -P %s -u %s -p*** -e %q\n  → %s\n" \
          "${MYSQL_HOST}" "${MYSQL_PORT}" "${MYSQL_USER}" "${sql}" "${err}" >&2
        return 1
      fi
      return 0
    }

    # 1) 真实连接测试（同时测端口可达 + 用户名/密码正确），不依赖 mysqladmin ping
    #    （mysqladmin ping 在某些版本即使认证失败仍返回 alive，导致后续 CREATE 静默失败）
    log "测试连接 ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}..."
    if ! mysql_exec "SELECT 1;" >/dev/null; then
      die "MySQL 连不上或认证失败。常见原因：
   - 服务未启动:  macOS  brew services start mysql
                  Linux  systemctl start mysql
   - 密码不对:    --mysql-pass <真实密码>（默认是 root）
                  或重置 root 密码：mysqladmin -uroot password 'root'
   - 用户不存在:  --mysql-user <user>
   - 改用 docker: --docker      改用 H2: --h2"
    fi
    ok "MySQL 服务在跑，认证通过"

    # 2) --reset-db
    if [[ ${RESET_DB} -eq 1 ]]; then
      log "重置：DROP DATABASE IF EXISTS ${MYSQL_DB}"
      mysql_exec "DROP DATABASE IF EXISTS ${MYSQL_DB};" || die "DROP DATABASE 失败（见上面 mysql 错误）"
      ok "${MYSQL_DB} 已删"
    fi

    # 3) 确保库存在（首启自动建，utf8mb4_unicode_ci 跟 application-mysql.yml 对齐）
    mysql_exec "CREATE DATABASE IF NOT EXISTS ${MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
      || die "CREATE DATABASE 失败（见上面 mysql 错误，多半是该用户无 CREATE 权限）"
    ok "数据库 ${MYSQL_DB} 就绪"

    # 4) --repair-flyway: 清掉 flyway_schema_history 里的失败记录
    # 用途：上次 V<N> migration 跑到一半失败留下 success=0 的脏数据，下次启动 Flyway
    # validate 会拒绝继续。这个开关把 success=0 的行删掉让 Flyway 重新尝试。
    if [[ ${REPAIR_FLYWAY} -eq 1 ]]; then
      log "清 flyway_schema_history 里 success=0 的失败记录..."
      # 用 mysql_exec 跑 DELETE。如果 schema_history 还不存在（首启），DELETE 会
      # 报「table doesn't exist」，整个 || true 跳过（不算 repair 失败）
      mysql_exec "USE ${MYSQL_DB}; DELETE FROM flyway_schema_history WHERE success = 0;" \
        2>/dev/null || warn "flyway_schema_history 表不存在或无失败记录，跳过"
      ok "Flyway 失败记录已清"
    fi
    ;;

  docker)
    log "MySQL 模式：docker 容器 ${DOCKER_CONTAINER}（port ${MYSQL_PORT}）"

    command -v docker >/dev/null || die "缺 docker（curl -fsSL https://get.docker.com | sh）"
    docker info >/dev/null 2>&1 || die "docker 未运行（启动 Docker Desktop 或 systemctl start docker）"

    if [[ ${RESET_DB} -eq 1 ]]; then
      log "重置：stop+rm 容器 + 删 volume"
      docker rm -f "${DOCKER_CONTAINER}" 2>/dev/null || true
      docker volume rm "${DOCKER_VOLUME}" 2>/dev/null || true
      ok "容器 + 数据卷已清"
    fi

    state=$(docker inspect -f '{{.State.Status}}' "${DOCKER_CONTAINER}" 2>/dev/null || echo "absent")
    case "${state}" in
      running)        ok "容器已在跑";;
      exited|created) log "启动已停容器"; docker start "${DOCKER_CONTAINER}" >/dev/null; ok "已 start";;
      absent)
        if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"${MYSQL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
          die "宿主端口 ${MYSQL_PORT} 已被占用。--mysql-port 换端口；或不加 --docker 让脚本走本机 mysql"
        fi
        log "首次启动：docker run ${DOCKER_IMAGE} → volume ${DOCKER_VOLUME}"
        docker run -d \
          --name "${DOCKER_CONTAINER}" \
          -p "${MYSQL_PORT}:3306" \
          -e MYSQL_ROOT_PASSWORD="${MYSQL_PASS}" \
          -e MYSQL_DATABASE="${MYSQL_DB}" \
          -v "${DOCKER_VOLUME}:/var/lib/mysql" \
          --restart unless-stopped \
          "${DOCKER_IMAGE}" \
          --character-set-server=utf8mb4 \
          --collation-server=utf8mb4_unicode_ci \
          --default-time-zone=+08:00 \
          >/dev/null
        ok "容器已起"
        ;;
      *) die "容器状态异常：${state}";;
    esac

    log "等 MySQL ready（最多 60s）"
    for i in $(seq 1 30); do
      if docker exec "${DOCKER_CONTAINER}" mysqladmin ping -uroot -p"${MYSQL_PASS}" >/dev/null 2>&1; then
        ok "MySQL ready"; break
      fi
      sleep 2
      [[ ${i} -eq 30 ]] && die "MySQL 60s 内未 ready，看 docker logs ${DOCKER_CONTAINER}"
    done

    docker exec "${DOCKER_CONTAINER}" mysql -uroot -p"${MYSQL_PASS}" \
      -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
      2>/dev/null
    ok "数据库 ${MYSQL_DB} 就绪"

    MYSQL_HOST="localhost"     # docker 暴露的端口在 localhost
    ;;

  skip)
    if [[ "${PROFILE}" == "mysql" ]]; then
      log "MySQL 模式：跳过（假设你已经搞定）"
    fi
    # --reset-db 在 H2 模式下清本地 ./data
    if [[ ${RESET_DB} -eq 1 && "${PROFILE}" == "dev" ]]; then
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

if [[ "${PROFILE}" == "mysql" ]]; then
  export DB_URL="jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&connectionCollation=utf8mb4_unicode_ci&characterEncoding=UTF-8"
  export DB_USERNAME="${MYSQL_USER}"
  export DB_PASSWORD="${MYSQL_PASS}"
fi

# ── 清 target/ 里可能残留的旧 Flyway migration ───────────────────────────
# 背景：mvn process-resources 只 copy，不删 target/classes 里 source 已不存在的
# 文件。若 db/migration/ 下做过 SQL → Java（或反向）替换，target/classes 里同时
# 留着新旧两份 V<N>__*.{sql,class} → Flyway 启动报「Found more than one migration
# with version N」。这里精确清掉 target/classes/db/migration/，让 mvn 重 copy。
# 代价：每次启动多 100ms 左右 resource copy；好处：跨 git pull / branch 切换稳定。
if [[ -d apps/server/target/classes/db/migration ]]; then
  rm -rf apps/server/target/classes/db/migration
fi

# ── 启动 server ──────────────────────────────────────────────────────────
log "启动 Spring Boot（profile=${PROFILE}）"
echo
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo "${Y}  ⚠️  注入的是 dev 弱密钥（NOT-FOR-PROD），不可上线${N}"
echo "${Y}  ✓ http://localhost:8080/api/auth/dev-accounts  ← 看演示账号${N}"
[[ "${PROFILE}" == "dev" ]] && \
echo "${Y}  ✓ http://localhost:8080/h2-console             ← H2 GUI${N}"
[[ "${PROFILE}" == "mysql" && "${MODE}" == "native" ]] && \
echo "${Y}  ✓ mysql -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p ${MYSQL_DB}${N}"
[[ "${PROFILE}" == "mysql" && "${MODE}" == "docker" ]] && \
echo "${Y}  ✓ docker logs -f ${DOCKER_CONTAINER}             ← MySQL 容器日志${N}"
[[ -n "${LOG_FILE}" ]] && \
echo "${Y}  ✓ 日志同步写到: ${LOG_FILE}                ← tail -f 跟踪${N}"
echo "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo

# 启动 mvn：可选 tee 到日志文件
# - 无 --log：直接 exec，stdout/stderr 打 console
# - 有 --log：mkdir -p logs/ 后 mvn 2>&1 | tee FILE。pipefail 保留 mvn 退出码
if [[ -n "${LOG_FILE}" ]]; then
  mkdir -p "$(dirname "${LOG_FILE}")"
  log "stdout/stderr 同步写入: ${LOG_FILE}"
  # 头里写一行元信息方便事后定位
  {
    echo "# dev-server.sh launched at $(date '+%Y-%m-%d %H:%M:%S')"
    echo "# profile=${PROFILE} mode=${MODE} mysql=${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}"
    echo "# mvn args: ${MVN_ARGS}"
    echo "# ── server output ──────────────────────────────────────────────────"
  } >> "${LOG_FILE}"
  # 用 stdbuf 让 mvn 不缓冲，日志实时刷盘（Linux）；macOS 自带 stdbuf 在 coreutils
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL -eL mvn -f apps/server/pom.xml spring-boot:run \
      -Dspring-boot.run.profiles="${PROFILE}" \
      ${MVN_ARGS} 2>&1 | tee -a "${LOG_FILE}"
  else
    mvn -f apps/server/pom.xml spring-boot:run \
      -Dspring-boot.run.profiles="${PROFILE}" \
      ${MVN_ARGS} 2>&1 | tee -a "${LOG_FILE}"
  fi
else
  exec mvn -f apps/server/pom.xml spring-boot:run \
    -Dspring-boot.run.profiles="${PROFILE}" \
    ${MVN_ARGS}
fi
