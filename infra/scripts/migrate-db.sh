#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/migrate-db.sh — MariaDB localhost → 阿里云 RDS MySQL 8.0 一次性迁移
#
# 用法：
#   SOURCE_HOST=root@47.94.102.182 \
#   SOURCE_DB_USER=aistareco_app SOURCE_DB_PASS=xxx \
#   RDS_HOST=rm-xxx.mysql.rds.aliyuncs.com RDS_USER=aistareco_root RDS_PASS=xxx \
#   ./infra/scripts/migrate-db.sh
#
# 流程：
#   1. 在 source ECS 上 mysqldump 全库 → /tmp/aistareco-$(date).sql.gz
#   2. scp 回本地（或直接 ssh + ssh tunnel 推 RDS）
#   3. 用 mysql client 推到 RDS
#   4. 校验：select count(*) from admin_users / aep_users / etc
#
# **重要**：执行前请确认：
#   ✓ stop server systemd（避免迁移期间写入），停机窗口约 15-30 分钟
#   ✓ RDS 已创库（infra/rds/00_create_database.sql）+ 应用账号（01_create_app_user.sql）
#   ✓ ECS 内网能访问 RDS endpoint（白名单已加 ECS 内网 IP）
#   ✓ 备份当前 MariaDB 一份本地拷贝（防迁移失败回滚）
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SOURCE_HOST="${SOURCE_HOST:?SOURCE_HOST required, e.g. root@47.94.102.182}"
SOURCE_DB_USER="${SOURCE_DB_USER:-aistareco_app}"
SOURCE_DB_PASS="${SOURCE_DB_PASS:?SOURCE_DB_PASS required}"
SOURCE_DB_NAME="${SOURCE_DB_NAME:-aistareco}"

RDS_HOST="${RDS_HOST:?RDS_HOST required, e.g. rm-xxx.mysql.rds.aliyuncs.com}"
RDS_PORT="${RDS_PORT:-3306}"
RDS_USER="${RDS_USER:?RDS_USER required (高权限主账号)}"
RDS_PASS="${RDS_PASS:?RDS_PASS required}"
RDS_DB_NAME="${RDS_DB_NAME:-aistareco}"

TS="$(date +%Y%m%d-%H%M%S)"
DUMP="/tmp/aistareco-$TS.sql.gz"

log() { printf "\033[1;34m[migrate-db %s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }

# ── 1. 停 server ───────────────────────────────────────────────
log "stopping aistareco-server on $SOURCE_HOST (so no writes during dump)..."
ssh "$SOURCE_HOST" 'systemctl stop aistareco-server' || true

# ── 2. dump ─────────────────────────────────────────────────────
log "mysqldump on $SOURCE_HOST → $DUMP"
ssh "$SOURCE_HOST" "
  mysqldump \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --default-character-set=utf8mb4 \
    --set-gtid-purged=OFF \
    --no-tablespaces \
    -u '$SOURCE_DB_USER' -p'$SOURCE_DB_PASS' \
    '$SOURCE_DB_NAME' | gzip > $DUMP
"

# 大小检查
SIZE=$(ssh "$SOURCE_HOST" "ls -lh $DUMP | awk '{print \$5}'")
log "dump size: $SIZE"

# ── 3. 推到 RDS ────────────────────────────────────────────────
# 方式 A: 在 source ECS 直接推（如 ECS 能访问 RDS endpoint，推荐）
log "推送 dump → RDS（直接 source ECS → RDS endpoint）"
ssh "$SOURCE_HOST" "
  zcat $DUMP | mysql \
    -h $RDS_HOST -P $RDS_PORT \
    -u $RDS_USER -p$RDS_PASS \
    --default-character-set=utf8mb4 \
    $RDS_DB_NAME
"

# 方式 B: 如果 source ECS 无法访问 RDS endpoint（如 RDS 在另一个 VPC），fall back 到 scp + 本机推：
# scp "$SOURCE_HOST:$DUMP" /tmp/
# zcat /tmp/$(basename $DUMP) | mysql -h $RDS_HOST -P $RDS_PORT -u $RDS_USER -p$RDS_PASS $RDS_DB_NAME

# ── 4. 校验 ─────────────────────────────────────────────────────
log "校验：对比关键表行数（应一致）"
echo "  -- source (MariaDB) --"
ssh "$SOURCE_HOST" "
  mysql -u '$SOURCE_DB_USER' -p'$SOURCE_DB_PASS' -N -e '
    SELECT \"admin_users\", COUNT(*) FROM aistareco.admin_users UNION ALL
    SELECT \"aep_users\", COUNT(*) FROM aistareco.aep_users UNION ALL
    SELECT \"celebrity_stars\", COUNT(*) FROM aistareco.celebrity_stars UNION ALL
    SELECT \"products\", COUNT(*) FROM aistareco.products UNION ALL
    SELECT \"mixcut_render_job\", COUNT(*) FROM aistareco.mixcut_render_job UNION ALL
    SELECT \"publish_job\", COUNT(*) FROM aistareco.publish_job;'
"

echo "  -- target (RDS) --"
mysql -h "$RDS_HOST" -P "$RDS_PORT" -u "$RDS_USER" -p"$RDS_PASS" -N -e "
  SELECT 'admin_users', COUNT(*) FROM $RDS_DB_NAME.admin_users UNION ALL
  SELECT 'aep_users', COUNT(*) FROM $RDS_DB_NAME.aep_users UNION ALL
  SELECT 'celebrity_stars', COUNT(*) FROM $RDS_DB_NAME.celebrity_stars UNION ALL
  SELECT 'products', COUNT(*) FROM $RDS_DB_NAME.products UNION ALL
  SELECT 'mixcut_render_job', COUNT(*) FROM $RDS_DB_NAME.mixcut_render_job UNION ALL
  SELECT 'publish_job', COUNT(*) FROM $RDS_DB_NAME.publish_job;"

# ── 5. 提示下一步 ─────────────────────────────────────────────
log "迁移完成。下一步："
log "  1) 编辑 /etc/aistareco/server.env：把 DB_URL / DB_USERNAME / DB_PASSWORD 改为 RDS"
log "  2) ssh $SOURCE_HOST 'systemctl start aistareco-server'"
log "  3) 观察启动日志（journalctl -u aistareco-server -n 100）"
log "  4) 跑 verify.sh"
log "  5) 一切 OK 后，源 MariaDB 保留 24-48h 再下线，作为应急回滚"
