#!/usr/bin/env bash
# 构建并部署当前工作区的 Spring Boot clip 后台到军师预发同机隔离实例。
# 不访问/重启 AIStar 生产，不改军师生产；真实 env 必须预先安全落到远端。
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-ecs-user@8.136.36.175}"
SSH_KEY="${SSH_KEY:-/Users/donis/dev/aliyun/aiartist.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/aistareco-clip-preprod}"
ENV_FILE="${ENV_FILE:-/etc/aistareco/clip-preprod.env}"
SERVICE="${SERVICE:-aistareco-clip-preprod}"
TEST_MEDIA_MODE="${TEST_MEDIA_MODE:-true}"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
DIRTY="$(git -C "$ROOT" status --porcelain --untracked-files=no | head -1)"
RELEASE_ID="${SHA}$([ -n "$DIRTY" ] && printf '%s' '-dirty')-$(date -u +%Y%m%dT%H%M%SZ)"
JAR="$ROOT/apps/server/target/ai-star-eco-server-1.0.0.jar"
REMOTE_TMP="/tmp/aistareco-clip-${RELEASE_ID}.jar"

log(){ printf '\033[1;36m[clip-preprod]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[clip-preprod] %s\033[0m\n' "$*" >&2; exit 1; }
[ -f "$SSH_KEY" ] || die "SSH key 不存在：$SSH_KEY"
case "$TEST_MEDIA_MODE" in true|false) ;; *) die "TEST_MEDIA_MODE 只能是 true 或 false" ;; esac

log "构建 server artifact（RELEASE_ID=${RELEASE_ID}）"
(cd "$ROOT/apps/server" && ./mvnw -q -DskipTests clean package)
[ -f "$JAR" ] || die "server jar 未生成"

log "预检远端 Java、机密配置与 FFmpeg 质量滤镜（TEST_MEDIA_MODE=${TEST_MEDIA_MODE}）"
ssh -i "$SSH_KEY" -o BatchMode=yes "$DEPLOY_HOST" bash -s -- "$ENV_FILE" "$TEST_MEDIA_MODE" <<'REMOTE_PREFLIGHT' \
  || die "远端缺 Java 17、机密配置或 FFmpeg signalstats/metadata/loudnorm；先按 infra/README.md 的 clip 预发步骤初始化"
set -Eeuo pipefail
env_file="$1"
test_media_mode="$2"
command -v java >/dev/null
sudo test -s "$env_file"
if sudo grep -qE '^AEP_CLIP_FORCE_MOCK=' "$env_file"; then
  sudo sed -i -E "s#^AEP_CLIP_FORCE_MOCK=.*#AEP_CLIP_FORCE_MOCK=${test_media_mode}#" "$env_file"
else
  printf 'AEP_CLIP_FORCE_MOCK=%s\n' "$test_media_mode" | sudo tee -a "$env_file" >/dev/null
fi
sudo chmod 600 "$env_file"
ffmpeg_bin="$(sudo awk -F= '$1 == "AEP_CLIP_FFMPEG_BIN" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")"
ffprobe_bin="$(sudo awk -F= '$1 == "AEP_CLIP_FFPROBE_BIN" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")"
ffmpeg_bin="${ffmpeg_bin:-ffmpeg}"
ffprobe_bin="${ffprobe_bin:-ffprobe}"
command -v "$ffmpeg_bin" >/dev/null
command -v "$ffprobe_bin" >/dev/null
filters="$("$ffmpeg_bin" -hide_banner -filters 2>/dev/null)"
for required_filter in signalstats metadata loudnorm; do
  printf '%s\n' "$filters" | grep -Eq "[[:space:]]${required_filter}[[:space:]]"
done
REMOTE_PREFLIGHT

log "上传并原子落位"
scp -q -i "$SSH_KEY" "$JAR" "$DEPLOY_HOST:$REMOTE_TMP"
ssh -i "$SSH_KEY" -o BatchMode=yes "$DEPLOY_HOST" bash -s -- "$REMOTE_TMP" "$REMOTE_ROOT" "$ENV_FILE" "$SERVICE" "$RELEASE_ID" <<'REMOTE'
set -Eeuo pipefail
tmp="$1"; root="$2"; env_file="$3"; service="$4"; release="$5"
sudo install -d -o junshi -g junshi -m 0750 "$root/server" "$root/data" "$root/cdn" "$root/file-storage"
sudo install -o junshi -g junshi -m 0640 "$tmp" "$root/server/app.jar.new"
sudo mv "$root/server/app.jar.new" "$root/server/app.jar"
printf '%s\n' "$release" | sudo tee "$root/.deploy-version" >/dev/null
sudo systemctl restart "$service"
for _ in $(seq 1 45); do
  if sudo systemctl is-active --quiet "$service"; then
    service_token="$(sudo awk -F= '$1 == "AEP_CLIP_SERVICE_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")"
    body="$(curl -fsS --max-time 8 -H "Authorization: Bearer $service_token" -H 'X-External-Owner-Id: preprod-smoke' http://127.0.0.1:8081/api/me/clip/templates 2>/dev/null || true)"
    count="$(printf '%s' "$body" | python3 -c 'import json,sys; x=json.load(sys.stdin); print(len(x.get("data") or []))' 2>/dev/null || true)"
    if [ "${count:-0}" -ge 3 ]; then printf 'templates=%s\n' "$count"; exit 0; fi
  fi
  sleep 2
done
sudo journalctl -u "$service" -n 100 --no-pager
exit 1
REMOTE

log "完成：${RELEASE_ID}（仅 clip 预发实例，TEST_MEDIA_MODE=${TEST_MEDIA_MODE}）"
