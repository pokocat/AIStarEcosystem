#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/init.sh — 交互式生成部署配置
#
# 提示输入 ECS / RDS / OSS / SMS / Coze 等参数，自动用 openssl 生成 JWT/AES/INTERNAL
# 密钥，渲染 server.env / sau-service.env / nginx config 到 infra/.local/
# （已 gitignored），让你 review 后手动 scp 到 ECS。
#
# 用法：
#   ./infra/scripts/init.sh           # 全交互
#   ./infra/scripts/init.sh --force   # 覆盖已存在的 infra/.local/*（默认会提示）
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INFRA="$REPO_ROOT/infra"
OUT="$INFRA/.local"

FORCE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE=1; shift;;
    -h|--help) sed -n '2,12p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

# ── 颜色 ─────────────────────────────────────────────────────────────────
G=$'\033[1;32m'; R=$'\033[1;31m'; Y=$'\033[1;33m'; C=$'\033[1;36m'; B=$'\033[1m'; N=$'\033[0m'

banner() { echo; echo "${C}━━━ $1 ━━━${N}"; }
hint()   { echo "${Y}  ↳ $1${N}"; }
say()    { echo "${G}$1${N}"; }

# ── 检测前置 ─────────────────────────────────────────────────────────────
for bin in openssl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "${R}缺工具：$bin${N}（先跑 ./infra/scripts/preflight.sh）"; exit 1; }
done

# ── 检测既有输出 ─────────────────────────────────────────────────────────
if [[ -d "$OUT" && -n "$(ls -A "$OUT" 2>/dev/null)" && $FORCE -eq 0 ]]; then
  echo "${Y}infra/.local/ 已有内容：${N}"
  ls -la "$OUT"
  echo
  read -rp "覆盖 (y/N)? " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "已退出。如要覆盖加 --force"; exit 0; }
fi
mkdir -p "$OUT"

# ── 帮助函数：必填读取 / 默认值读取 / 隐藏读取 ────────────────────────────
ask_required() {  # ask_required VAR "prompt"
  local var="$1" prompt="$2" val=""
  while [[ -z "$val" ]]; do
    read -rp "  ${prompt}: " val
    [[ -z "$val" ]] && echo "  ${R}必填${N}"
  done
  printf -v "$var" '%s' "$val"
}

ask_default() {  # ask_default VAR "prompt" "default"
  local var="$1" prompt="$2" def="$3" val=""
  read -rp "  ${prompt} [${C}${def}${N}]: " val
  printf -v "$var" '%s' "${val:-$def}"
}

ask_secret() {  # ask_secret VAR "prompt"
  local var="$1" prompt="$2" val=""
  while [[ -z "$val" ]]; do
    read -rsp "  ${prompt} (隐藏输入): " val; echo
    [[ -z "$val" ]] && echo "  ${R}必填${N}"
  done
  printf -v "$var" '%s' "$val"
}

ask_yn() {  # ask_yn VAR "prompt" "default y|n"
  local var="$1" prompt="$2" def="$3" val=""
  read -rp "  ${prompt} (y/n) [${C}${def}${N}]: " val
  val="${val:-$def}"
  [[ "$val" =~ ^[Yy]$ ]] && printf -v "$var" '%s' "yes" || printf -v "$var" '%s' "no"
}

# 用 openssl 生成 base64 密钥，去掉换行 / + / = / 截到指定长度
gen_secret() {  # gen_secret <length>
  openssl rand -base64 64 | tr -d '\n+/=' | head -c "$1"
}

# ─────────────────────────────────────────────────────────────────────────
# 开始收集参数
# ─────────────────────────────────────────────────────────────────────────

echo "${B}AI Star Eco — 部署配置交互式生成${N}"
echo "本脚本仅在 ${C}本机${N} 生成 env / nginx 文件到 ${C}infra/.local/${N}。"
echo "之后请 review 并自行 scp 到目标 ECS（脚本不主动推送）。"

# ── A. 部署形态 + 域名 ───────────────────────────────────────────────────
banner "A. 部署形态"
echo "  1) HTTP / 单 IP（首次部署 / 内网联调）"
echo "  2) HTTPS / 多子域（生产）"
ask_default DEPLOY_MODE "选择 (1/2)" "1"
case "$DEPLOY_MODE" in
  1) NGINX_TEMPLATE="ai.conf.example"; NGINX_OUT="ai.conf";;
  2)
    NGINX_TEMPLATE="ai.aibuzz.cn.conf.example"
    ask_default ROOT_DOMAIN "根域名" "aibuzz.cn"
    NGINX_OUT="ai.${ROOT_DOMAIN}.conf"
    ;;
  *) echo "${R}无效选择${N}"; exit 1;;
esac
ask_required ECS_HOST "目标 ECS（如 root@1.2.3.4）"

# ── B. RDS ────────────────────────────────────────────────────────────────
banner "B. RDS MySQL 8.0"
hint "建议用 RDS 内网 endpoint（无流量费）；端口默认 3306"
ask_required RDS_HOST "RDS endpoint（如 rm-xxx.mysql.rds.aliyuncs.com）"
ask_default DB_USERNAME "应用账号 username" "aistareco_app"
ask_secret DB_PASSWORD "应用账号 password"

# ── C. OSS ────────────────────────────────────────────────────────────────
banner "C. OSS Bucket"
hint "endpoint 必须用内网形态（避免流量费 + 降延迟）"
ask_default OSS_ENDPOINT "OSS endpoint" "oss-cn-hangzhou-internal.aliyuncs.com"
ask_default OSS_BUCKET "OSS bucket 名" "aistareco-prod"
ask_required OSS_AK_ID "OSS RAM 子用户 AccessKey ID"
ask_secret OSS_AK_SECRET "OSS RAM 子用户 AccessKey Secret"
default_cdn="https://cdn.${ROOT_DOMAIN:-aibuzz.cn}"
ask_default OSS_CDN_URL "CDN 公开 URL（OSS 回源）" "$default_cdn"
ask_default OSS_KEY_PREFIX "OSS 对象 key 前缀" "mixcut"

# ── D. SMS（可选） ───────────────────────────────────────────────────────
banner "D. SMS（阿里云短信）"
ask_yn SMS_ENABLE "启用阿里云 SMS？（n = 仍打 server log）" "n"
if [[ "$SMS_ENABLE" == "yes" ]]; then
  ask_required SMS_AK_ID "SMS RAM 子用户 AccessKey ID"
  ask_secret SMS_AK_SECRET "SMS RAM 子用户 AccessKey Secret"
  ask_required SMS_SIGN_NAME "SMS 签名（控制台备案过的企业名）"
  ask_required SMS_TEMPLATE_CODE "SMS 模板代码（如 SMS_xxxxx）"
  SMS_DRIVER="aliyun"
else
  SMS_DRIVER="log"
  SMS_AK_ID=""; SMS_AK_SECRET=""; SMS_SIGN_NAME=""; SMS_TEMPLATE_CODE=""
fi

# ── E. Coze（可选） ──────────────────────────────────────────────────────
banner "E. Coze（LLM 对话）"
ask_yn COZE_ENABLE "启用 Coze？" "n"
if [[ "$COZE_ENABLE" == "yes" ]]; then
  ask_required COZE_TOKEN "Coze API token"
  ask_required COZE_BOT_ID "Coze bot_id"
else
  COZE_TOKEN=""; COZE_BOT_ID=""
fi

# ── F. CORS ──────────────────────────────────────────────────────────────
banner "F. CORS"
if [[ "$DEPLOY_MODE" == "2" ]]; then
  CORS_DEFAULT="https://${ROOT_DOMAIN},https://*.${ROOT_DOMAIN}"
else
  CORS_DEFAULT="http://localhost:*,http://127.0.0.1:*"
fi
ask_default CORS_PATTERN "AllowedOriginPatterns" "$CORS_DEFAULT"

# ── 自动生成密钥 ─────────────────────────────────────────────────────────
banner "G. 密钥自动生成（openssl rand）"
JWT_SECRET=$(gen_secret 48)
INTERNAL_SECRET=$(gen_secret 32)
AES_KEY=$(gen_secret 32)
say "  ✓ AEP_JWT_SECRET / AEP_INTERNAL_SECRET / AEP_SECRET_KEY 已生成"

# ─────────────────────────────────────────────────────────────────────────
# 渲染模板（bash 内置字符串替换，规避 sed 元字符）
# ─────────────────────────────────────────────────────────────────────────

render_server_env() {
  local infile="$INFRA/env/server.env.example" out="$OUT/server.env"
  local line
  while IFS= read -r line; do
    line="${line//<FILL_RDS_INTERNAL_HOST>/$RDS_HOST}"
    line="${line//<FILL_RDS_APP_PASSWORD>/$DB_PASSWORD}"
    line="${line//<FILL_32_CHAR_HIGH_ENTROPY_SECRET>/$JWT_SECRET}"
    line="${line//<FILL_INTERNAL_SECRET>/$INTERNAL_SECRET}"
    line="${line//<FILL_32_BYTE_RANDOM_BASE64>/$AES_KEY}"
    line="${line//<FILL_OSS_AK_ID>/$OSS_AK_ID}"
    line="${line//<FILL_OSS_AK_SECRET>/$OSS_AK_SECRET}"
    line="${line//<FILL_SMS_AK_ID>/$SMS_AK_ID}"
    line="${line//<FILL_SMS_AK_SECRET>/$SMS_AK_SECRET}"
    line="${line//<FILL_企业签名（如：星耀生态）>/$SMS_SIGN_NAME}"
    line="${line//<FILL_SMS_TEMPLATE_CODE（如：SMS_xxxxx）>/$SMS_TEMPLATE_CODE}"
    line="${line//<FILL_COZE_API_TOKEN>/$COZE_TOKEN}"
    line="${line//<FILL_COZE_BOT_ID>/$COZE_BOT_ID}"

    # 简单同名 key 覆盖（=右边整体替换）
    case "$line" in
      DB_USERNAME=*)                    line="DB_USERNAME=$DB_USERNAME";;
      AEP_SMS_DRIVER=*)                 line="AEP_SMS_DRIVER=$SMS_DRIVER";;
      AEP_CDN_OSS_ENDPOINT=*)           line="AEP_CDN_OSS_ENDPOINT=$OSS_ENDPOINT";;
      AEP_CDN_OSS_BUCKET=*)             line="AEP_CDN_OSS_BUCKET=$OSS_BUCKET";;
      AEP_CDN_OSS_BASE_URL=*)           line="AEP_CDN_OSS_BASE_URL=$OSS_CDN_URL";;
      AEP_CDN_PUBLIC_BASE_URL=*)        line="AEP_CDN_PUBLIC_BASE_URL=$OSS_CDN_URL";;
      AEP_CDN_OSS_KEY_PREFIX=*)         line="AEP_CDN_OSS_KEY_PREFIX=$OSS_KEY_PREFIX";;
      AEP_COZE_ENABLED=*)               line="AEP_COZE_ENABLED=$([[ $COZE_ENABLE == yes ]] && echo true || echo false)";;
      AEP_CORS_ALLOWED_ORIGIN_PATTERNS=*) line="AEP_CORS_ALLOWED_ORIGIN_PATTERNS=$CORS_PATTERN";;
    esac
    printf '%s\n' "$line"
  done < "$infile" > "$out"
  chmod 600 "$out"
}

render_sau_env() {
  local infile="$INFRA/env/sau-service.env.example" out="$OUT/sau-service.env"
  local line
  while IFS= read -r line; do
    line="${line//<FILL_INTERNAL_SECRET>/$INTERNAL_SECRET}"
    printf '%s\n' "$line"
  done < "$infile" > "$out"
  chmod 600 "$out"
}

render_nginx() {
  local infile="$INFRA/nginx/$NGINX_TEMPLATE" out="$OUT/$NGINX_OUT"
  if [[ "$DEPLOY_MODE" == "2" && "$ROOT_DOMAIN" != "aibuzz.cn" ]]; then
    # HTTPS 模板里所有 aibuzz.cn 占位替换为用户域名
    sed "s/aibuzz\.cn/${ROOT_DOMAIN//./\\.}/g" "$infile" > "$out"
  else
    cp "$infile" "$out"
  fi
}

write_secrets_backup() {
  local out="$OUT/secrets-backup.txt"
  cat > "$out" <<EOF
# AI Star Eco 密钥备份 — $(date '+%Y-%m-%d %H:%M:%S')
#
# ⚠️  立即备份到密码管理器（1Password / Vault / KMS），然后 rm 本文件
# ⚠️  这些密钥写入 server.env 后，rm 本文件不会影响 server 运行
# ⚠️  丢失 AEP_SECRET_KEY 会导致 AiModelProvider.apiKey / 社交账号 storage_state 不可解
# ⚠️  丢失 AEP_JWT_SECRET 会导致所有在线 JWT 失效（用户需重新登录，可恢复）

AEP_JWT_SECRET=$JWT_SECRET
AEP_INTERNAL_SECRET=$INTERNAL_SECRET
AEP_SECRET_KEY=$AES_KEY

# 应用账号密码（DB_PASSWORD / OSS_AK / SMS_AK）已写入 server.env，自行从那里拷贝
EOF
  chmod 600 "$out"
}

banner "渲染配置 → infra/.local/"
render_server_env;   say "  ✓ infra/.local/server.env"
render_sau_env;      say "  ✓ infra/.local/sau-service.env"
render_nginx;        say "  ✓ infra/.local/$NGINX_OUT"
write_secrets_backup; say "  ✓ infra/.local/secrets-backup.txt"

# ─────────────────────────────────────────────────────────────────────────
# 下一步指引
# ─────────────────────────────────────────────────────────────────────────

echo
echo "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo "${G}✓ 配置已生成${N}"
echo "${B}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${N}"
echo
echo "${Y}⚠️  立刻打开 infra/.local/secrets-backup.txt 备份到密码管理器，然后删除！${N}"
echo
echo "${C}下一步：${N}"
echo
echo "  ${B}1)${N} review 生成的文件"
echo "     vim infra/.local/server.env"
echo "     vim infra/.local/sau-service.env"
echo "     vim infra/.local/$NGINX_OUT"
echo
echo "  ${B}2)${N} scp 到 ECS（先在 ECS 上 mkdir -p /etc/aistareco）"
echo "     ssh $ECS_HOST 'mkdir -p /etc/aistareco /etc/nginx/conf.d/snippets'"
echo "     scp infra/.local/server.env      $ECS_HOST:/etc/aistareco/server.env"
echo "     scp infra/.local/sau-service.env $ECS_HOST:/etc/aistareco/sau-service.env"
echo "     scp infra/.local/$NGINX_OUT      $ECS_HOST:/etc/nginx/conf.d/$NGINX_OUT"
echo "     scp infra/nginx/snippets/proxy-defaults.conf $ECS_HOST:/etc/nginx/conf.d/snippets/"
echo
echo "  ${B}3)${N} ssh 上 ECS：systemd 单元落位 + nginx reload"
echo "     ssh $ECS_HOST 'chmod 600 /etc/aistareco/*.env && nginx -t && systemctl reload nginx'"
echo "     (首次部署还要 cp infra/systemd/*.example /etc/systemd/system/ + daemon-reload + enable)"
echo
echo "  ${B}4)${N} 本机部署 + 验证"
echo "     ECS_HOST=$ECS_HOST ./infra/scripts/deploy.sh all"
echo "     ECS_HOST=$ECS_HOST ./infra/scripts/verify.sh"
echo
echo "  ${B}5)${N} 完成后清理本机敏感文件"
echo "     rm infra/.local/secrets-backup.txt"
echo
