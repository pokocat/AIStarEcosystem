#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/preflight.sh — 前置工具检测
#
# 用法：
#   ./infra/scripts/preflight.sh                    # 检测本机（开发者打包 + 推送侧）
#   ./infra/scripts/preflight.sh --remote root@HOST # ssh 过去检 ECS（部署目标侧）
#
# 退出码：
#   0 = 全部齐备
#   1 = 至少一项缺失（required）
#   2 = 仅 optional 缺失
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

REMOTE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) REMOTE="$2"; shift 2;;
    --remote=*) REMOTE="${1#--remote=}"; shift;;
    -h|--help) sed -n '2,12p' "$0"; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

# 颜色 + 计数
GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; YELLOW=$'\033[1;33m'; CYAN=$'\033[1;36m'; RESET=$'\033[0m'
MISSING_REQUIRED=0
MISSING_OPTIONAL=0

# 用法: check <required|optional> <cmd> [<version-flag>] [<install-hint>]
check() {
  local kind="$1" cmd="$2" verflag="${3:-}" hint="${4:-}"
  local label="${cmd}"
  local ok="no" output=""

  if [[ -n "$REMOTE" ]]; then
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE" "command -v $cmd >/dev/null 2>&1"; then
      ok="yes"
      if [[ -n "$verflag" ]]; then
        output=$(ssh "$REMOTE" "$cmd $verflag 2>&1 | head -1" || true)
      fi
    fi
  else
    if command -v "$cmd" >/dev/null 2>&1; then
      ok="yes"
      if [[ -n "$verflag" ]]; then
        output=$(eval "$cmd $verflag 2>&1 | head -1" || true)
      fi
    fi
  fi

  if [[ "$ok" == "yes" ]]; then
    printf "  ${GREEN}✓${RESET} %-15s ${CYAN}%s${RESET}\n" "$label" "$output"
  else
    if [[ "$kind" == "required" ]]; then
      printf "  ${RED}✗${RESET} %-15s ${YELLOW}缺失${RESET}  install: %s\n" "$label" "$hint"
      MISSING_REQUIRED=$((MISSING_REQUIRED+1))
    else
      printf "  ${YELLOW}!${RESET} %-15s 可选未装  install: %s\n" "$label" "$hint"
      MISSING_OPTIONAL=$((MISSING_OPTIONAL+1))
    fi
  fi
}

# ── 头 ─────────────────────────────────────────────────────────────────────
if [[ -n "$REMOTE" ]]; then
  echo "[preflight] 检测远端 ${CYAN}$REMOTE${RESET}（部署目标侧）"
  if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE" "true" 2>/dev/null; then
    echo "${RED}✗ 无法 ssh 到 $REMOTE${RESET}（确保 ssh key 已加 + 主机已在 known_hosts）"
    exit 1
  fi
else
  echo "[preflight] 检测本机（开发者打包 + 推送侧）"
fi
echo

# ── 必备工具 ──────────────────────────────────────────────────────────────
echo "${CYAN}[必备]${RESET}"
if [[ -n "$REMOTE" ]]; then
  # ECS 侧：跑 server / web / docker-sau-service 所需
  check required java   "-version"  "yum install -y java-17-openjdk-headless  # 或 apt install openjdk-17-jre-headless"
  check required nginx  "-v"        "yum install -y nginx                     # 或 apt install nginx"
  check required docker "-v"        "curl -fsSL https://get.docker.com | sh"
  check required ffmpeg "-version"  "yum install -y ffmpeg                    # 或 apt install ffmpeg"
  check required node   "-v"        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 24"
  check required systemctl "--version" "（systemd 应该是 OS 自带）"
  check required rsync  "--version"  "yum install -y rsync"
  check required curl   "--version" "yum install -y curl"
else
  # 本机侧：build + deploy 所需
  check required bash    "--version" "（应该是 OS 自带；macOS 推荐 brew install bash 升 5.x）"
  check required openssl "version"   "yum install -y openssl  # 或 brew install openssl"
  check required ssh     "-V"         "（OS 自带；macOS 自带）"
  check required rsync   "--version"  "brew install rsync  # 或 yum install rsync"
  check required git     "--version"  "brew install git"
  check required mvn     "-v"         "brew install maven  # 或 apt install maven  # 编译 server jar"
  check required java    "-version"   "brew install openjdk@17  # 或 yum install java-17-openjdk"
  check required node    "-v"         "https://nodejs.org/  # 或 nvm install 24"
  check required pnpm    "-v"         "npm install -g pnpm@10  # build 三个新 web app"
  check required npm     "-v"         "（随 node 一起装）"
fi

# ── 可选工具 ──────────────────────────────────────────────────────────────
echo
echo "${CYAN}[可选]${RESET}"
if [[ -n "$REMOTE" ]]; then
  check optional mysql "--version" "yum install -y mariadb  # 仅初始化 RDS 时用"
  check optional ossutil "--version" "curl -sLo /usr/local/bin/ossutil https://gosspublic.alicdn.com/ossutil/1.7.18/ossutilv1-1.7.18-linux-amd64 && chmod +x /usr/local/bin/ossutil"
else
  check optional mysql "--version" "brew install mysql-client  # 初始化 RDS 时用"
  check optional ossutil "--version" "https://help.aliyun.com/zh/oss/developer-reference/ossutil-installation"
fi

# ── 总结 ──────────────────────────────────────────────────────────────────
echo
if [[ $MISSING_REQUIRED -gt 0 ]]; then
  echo "${RED}[preflight] FAIL${RESET} — 缺失 ${MISSING_REQUIRED} 个必备工具"
  exit 1
elif [[ $MISSING_OPTIONAL -gt 0 ]]; then
  echo "${YELLOW}[preflight] OK（${MISSING_OPTIONAL} 个可选工具未装，仅在 RDS/OSS 一次性初始化时需要）${RESET}"
  exit 2
else
  echo "${GREEN}[preflight] ALL GREEN${RESET}"
  exit 0
fi
