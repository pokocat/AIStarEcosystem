#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/migrate-cdn.sh — 本地静态文件 → 阿里云 OSS 一次性迁移
#
# 用法：
#   SOURCE_HOST=root@47.94.102.182 \
#   OSS_BUCKET=aistareco-prod \
#   OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com \
#   OSS_AK_ID=LTAI... OSS_AK_SECRET=xxx \
#   ./infra/scripts/migrate-cdn.sh
#
# 流程：
#   1) 在 source ECS 上装 ossutil
#   2) 同步 ./cdn-mock/* → oss://<bucket>/mixcut/...
#   3) 同步 /opt/ai-star-eco/static/videos/* → oss://<bucket>/forge/videos/
#   4) 同步 ./mixcut-output/* → oss://<bucket>/mixcut/output/（30 天回填，可选）
#   5) 校验：oss ls 行数对比
#
# **重要**：迁移前应该已经按 infra/oss/README.md 创建好 bucket / RAM 用户 / CORS 配置
#
# 迁移完成后：
#   1) server.env 切 AEP_CDN_DRIVER=oss + OSS 6 个 env
#   2) 重启 server
#   3) 老视频路径已落库的 URL（如 aep_forge_results.video_url）需要 SQL 替换：
#      UPDATE aep_forge_results
#         SET video_url = REPLACE(video_url, '/static/videos/', 'https://cdn.aistar.com/forge/videos/')
#       WHERE video_url LIKE '/static/videos/%';
#   4) MixcutRenderOutput.fileUrl / cdnUrl 历史数据可保留（cdnUrl 已是绝对 URL）
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SOURCE_HOST="${SOURCE_HOST:?SOURCE_HOST required, e.g. root@47.94.102.182}"
SOURCE_ROOT="${SOURCE_ROOT:-/opt/ai-star-eco}"

OSS_BUCKET="${OSS_BUCKET:?OSS_BUCKET required, e.g. aistareco-prod}"
OSS_ENDPOINT="${OSS_ENDPOINT:?OSS_ENDPOINT required, e.g. oss-cn-hangzhou.aliyuncs.com}"
OSS_AK_ID="${OSS_AK_ID:?OSS_AK_ID required}"
OSS_AK_SECRET="${OSS_AK_SECRET:?OSS_AK_SECRET required}"

log() { printf "\033[1;34m[migrate-cdn %s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }

# ── 1) 装 ossutil（如未装） ────────────────────────────────────
log "确保 source ECS 装了 ossutil..."
ssh "$SOURCE_HOST" '
  if ! command -v ossutil >/dev/null 2>&1; then
    echo "[ossutil] 下载 v1.7.18..."
    curl -sLo /usr/local/bin/ossutil https://gosspublic.alicdn.com/ossutil/1.7.18/ossutilv1-1.7.18-linux-amd64
    chmod +x /usr/local/bin/ossutil
  fi
  ossutil --version
'

# ── 2) 写 ossutil 配置到远端（仅本会话用，结束删） ────────────
log "下发 ossutil 临时配置..."
ssh "$SOURCE_HOST" "cat > ~/.ossutilconfig <<EOF
[Credentials]
language=CH
endpoint=$OSS_ENDPOINT
accessKeyID=$OSS_AK_ID
accessKeySecret=$OSS_AK_SECRET
EOF
"

cleanup() { ssh "$SOURCE_HOST" 'rm -f ~/.ossutilconfig'; }
trap cleanup EXIT

# ── 3) 同步 cdn-mock → OSS mixcut/ ────────────────────────────
if ssh "$SOURCE_HOST" "[ -d $SOURCE_ROOT/cdn-mock ]"; then
  log "sync $SOURCE_ROOT/cdn-mock/ → oss://$OSS_BUCKET/mixcut/"
  ssh "$SOURCE_HOST" "ossutil sync -f $SOURCE_ROOT/cdn-mock/ oss://$OSS_BUCKET/mixcut/"
else
  log "skip cdn-mock (目录不存在)"
fi

# ── 4) 同步 forge videos → OSS forge/videos/ ─────────────────
if ssh "$SOURCE_HOST" "[ -d $SOURCE_ROOT/static/videos ]"; then
  log "sync $SOURCE_ROOT/static/videos/ → oss://$OSS_BUCKET/forge/videos/"
  ssh "$SOURCE_HOST" "ossutil sync -f $SOURCE_ROOT/static/videos/ oss://$OSS_BUCKET/forge/videos/"
else
  log "skip forge videos (目录不存在)"
fi

# ── 5) 校验 ──────────────────────────────────────────────────
log "校验：OSS 前缀下对象数"
ssh "$SOURCE_HOST" "ossutil stat oss://$OSS_BUCKET" || true
ssh "$SOURCE_HOST" "ossutil ls oss://$OSS_BUCKET/mixcut/ | tail -5"
ssh "$SOURCE_HOST" "ossutil ls oss://$OSS_BUCKET/forge/videos/ | tail -5"

log "完成。下一步："
log "  1) /etc/aistareco/server.env：AEP_CDN_DRIVER=oss + OSS 6 个 env 填好"
log "  2) ssh $SOURCE_HOST 'systemctl restart aistareco-server'"
log "  3) 浏览器打 https://cdn.aistar.com/forge/videos/showreel-01.mp4 验证"
log "  4) SQL 替换 aep_forge_results.video_url（见本脚本顶部注释）"
log "  5) 验证完后可删 $SOURCE_ROOT/cdn-mock + 缩 $SOURCE_ROOT/static/videos 备份"
