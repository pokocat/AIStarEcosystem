#!/usr/bin/env bash
# Install host-level dependencies needed to build and run the single-host
# production deployment. This script is intended to run on ECS directly.
#
# It is idempotent: existing commands and acceptable versions are kept.
#
# Usage:
#   sudo ./infra/scripts/install-host-deps.sh all
#   sudo ./infra/scripts/install-host-deps.sh server,web-aiavatar

set -euo pipefail

DEFAULT_SERVICES="server web-celebrity web-aiavatar admin sau-service"
RAW_SERVICES="${1:-${SERVICES:-all}}"
NODE_VERSION="${NODE_VERSION:-24.14.1}"
PNPM_VERSION="${PNPM_VERSION:-10.33.2}"
INSTALL_OPTIONAL="${INSTALL_OPTIONAL:-0}"
ALLOW_DOCKER_CONVENIENCE_SCRIPT="${ALLOW_DOCKER_CONVENIENCE_SCRIPT:-1}"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

GREEN=$'\033[1;32m'
RED=$'\033[1;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[1;36m'
RESET=$'\033[0m'

log() { printf "${CYAN}[host-deps]${RESET} %s\n" "$*"; }
ok() { printf "${GREEN}[host-deps]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[host-deps] %s${RESET}\n" "$*" >&2; }
fail() { printf "${RED}[host-deps] %s${RESET}\n" "$*" >&2; exit 1; }

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
elif command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  fail "root or sudo is required to install host dependencies"
fi

run_root() {
  "${SUDO[@]}" "$@"
}

normalize_services() {
  local raw="${1//,/ }"
  local out="" item
  for item in $raw; do
    case "$item" in
      all) out="$out $DEFAULT_SERVICES" ;;
      server|web-celebrity|web-aiavatar|admin|sau-service) out="$out $item" ;;
      "") ;;
      *) fail "unknown service '$item' (expected server|web-celebrity|web-aiavatar|admin|sau-service|all)" ;;
    esac
  done

  local seen=" " deduped=""
  for item in $out; do
    case "$seen" in
      *" $item "*) ;;
      *) seen="$seen$item "; deduped="$deduped $item" ;;
    esac
  done
  printf "%s\n" "$deduped" | xargs
}

SERVICES_LIST="$(normalize_services "$RAW_SERVICES")"
[[ -n "$SERVICES_LIST" ]] || fail "no services selected"

has_service() {
  local needle="$1" item
  for item in $SERVICES_LIST; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

needs_node() {
  has_service web-celebrity || has_service web-aiavatar || has_service admin
}

needs_java() {
  has_service server
}

needs_docker() {
  has_service sau-service
}

OS_ID="unknown"
OS_LIKE=""
OS_VERSION_ID=""
OS_PRETTY="unknown"
if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_LIKE="${ID_LIKE:-}"
  OS_VERSION_ID="${VERSION_ID:-}"
  OS_PRETTY="${PRETTY_NAME:-$OS_ID $OS_VERSION_ID}"
fi

PKG_MANAGER=""
if command -v dnf >/dev/null 2>&1; then
  PKG_MANAGER="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG_MANAGER="yum"
elif command -v apt-get >/dev/null 2>&1; then
  PKG_MANAGER="apt"
else
  fail "unsupported host image: no dnf, yum, or apt-get found"
fi

APT_UPDATED=0
apt_update_once() {
  if [[ "$APT_UPDATED" == "0" ]]; then
    run_root env DEBIAN_FRONTEND=noninteractive apt-get update
    APT_UPDATED=1
  fi
}

install_packages() {
  [[ $# -gt 0 ]] || return 0
  case "$PKG_MANAGER" in
    dnf) run_root dnf install -y "$@" ;;
    yum) run_root yum install -y "$@" ;;
    apt)
      apt_update_once
      run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
      ;;
  esac
}

try_install_packages() {
  install_packages "$@" >/dev/null 2>&1
}

version_ge() {
  local have="${1#v}" want="${2#v}"
  local ha hb hc wa wb wc
  IFS=. read -r ha hb hc <<< "$have"
  IFS=. read -r wa wb wc <<< "$want"
  ha="${ha:-0}"; hb="${hb:-0}"; hc="${hc:-0}"
  wa="${wa:-0}"; wb="${wb:-0}"; wc="${wc:-0}"
  (( ha > wa )) && return 0
  (( ha < wa )) && return 1
  (( hb > wb )) && return 0
  (( hb < wb )) && return 1
  (( hc >= wc ))
}

java_major() {
  java -version 2>&1 | awk -F '"' '/version/ {
    split($2, parts, ".")
    if (parts[1] == "1") print parts[2]; else print parts[1]
    exit
  }'
}

ensure_base_packages() {
  log "host image: $OS_PRETTY; package manager: $PKG_MANAGER"
  case "$PKG_MANAGER" in
    dnf|yum)
      install_packages ca-certificates git curl rsync tar gzip unzip xz procps-ng which shadow-utils
      ;;
    apt)
      install_packages ca-certificates git curl rsync tar gzip unzip xz-utils procps
      ;;
  esac
  ok "base packages ready"
}

ensure_java() {
  local major="0"
  if command -v java >/dev/null 2>&1; then
    major="$(java_major || echo 0)"
    major="${major:-0}"
  fi
  if command -v java >/dev/null 2>&1 && [[ "$major" -ge 17 ]]; then
    ok "java ready ($(java -version 2>&1 | head -1))"
    return 0
  fi

  log "install Java 17 JDK"
  case "$PKG_MANAGER" in
    dnf|yum) install_packages java-17-openjdk-devel ;;
    apt) install_packages openjdk-17-jdk-headless ;;
  esac

  command -v java >/dev/null 2>&1 || fail "java is still missing after install"
  major="$(java_major || echo 0)"
  major="${major:-0}"
  [[ "$major" -ge 17 ]] || fail "java version is below 17 after install"
  ok "java ready ($(java -version 2>&1 | head -1))"
}

ensure_nginx() {
  if ! command -v nginx >/dev/null 2>&1; then
    log "install nginx"
    install_packages nginx
  fi
  ok "nginx ready ($(nginx -v 2>&1))"
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files nginx.service >/dev/null 2>&1; then
    run_root systemctl enable nginx >/dev/null 2>&1 || true
  fi
}

install_ffmpeg_rpm_fallback() {
  if command -v ffmpeg >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$PKG_MANAGER" != "dnf" && "$PKG_MANAGER" != "yum" ]]; then
    return 1
  fi

  if try_install_packages ffmpeg; then
    return 0
  fi

  if [[ "$OS_ID" == "alinux" || "$OS_ID" == "alibaba" || "$OS_LIKE" == *"rhel"* || "$OS_LIKE" == *"centos"* || "$OS_LIKE" == *"fedora"* ]]; then
    warn "ffmpeg package was not available from current repos; trying epel-release"
    try_install_packages epel-release || true
    try_install_packages ffmpeg && return 0
  fi

  return 1
}

ensure_ffmpeg() {
  if command -v ffmpeg >/dev/null 2>&1; then
    ok "ffmpeg ready ($(ffmpeg -version 2>&1 | head -1))"
    return 0
  fi

  log "install ffmpeg"
  case "$PKG_MANAGER" in
    dnf|yum) install_ffmpeg_rpm_fallback || true ;;
    apt) install_packages ffmpeg ;;
  esac

  command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg is still missing after install; enable an ffmpeg repo for $OS_PRETTY"
  ok "ffmpeg ready ($(ffmpeg -version 2>&1 | head -1))"
}

node_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf "x64" ;;
    aarch64|arm64) printf "arm64" ;;
    *) fail "unsupported CPU architecture for Node.js binary: $(uname -m)" ;;
  esac
}

install_node_tarball() {
  local arch tarball url tmpdir install_dir
  arch="$(node_arch)"
  tarball="node-v${NODE_VERSION}-linux-${arch}.tar.xz"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
  tmpdir="$(mktemp -d)"
  install_dir="/opt/node-v${NODE_VERSION}-linux-${arch}"

  log "install Node.js v${NODE_VERSION} (${arch})"
  curl -fsSL "$url" -o "$tmpdir/$tarball"
  if [[ ! -d "$install_dir" ]]; then
    run_root mkdir -p /opt
    run_root tar -xJf "$tmpdir/$tarball" -C /opt
  fi
  rm -rf "$tmpdir"

  run_root ln -sfn "$install_dir" /opt/node-current
  for bin in node npm npx corepack; do
    run_root ln -sfn "/opt/node-current/bin/$bin" "/usr/local/bin/$bin"
  done

  # Compatibility for existing systemd units that point at the nvm-style path.
  run_root mkdir -p "/root/.nvm/versions/node/v${NODE_VERSION}/bin"
  for bin in node npm npx corepack; do
    run_root ln -sfn "/opt/node-current/bin/$bin" "/root/.nvm/versions/node/v${NODE_VERSION}/bin/$bin"
  done

  hash -r
}

ensure_node() {
  local nvm_node="/root/.nvm/versions/node/v${NODE_VERSION}/bin/node"
  if command -v node >/dev/null 2>&1 && version_ge "$(node -v)" "20.9.0" && [[ -x "$nvm_node" ]]; then
    ok "node ready ($(node -v))"
  else
    install_node_tarball
    command -v node >/dev/null 2>&1 || fail "node is still missing after install"
    version_ge "$(node -v)" "20.9.0" || fail "node $(node -v) is below required >=20.9"
    ok "node ready ($(node -v))"
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1 && version_ge "$(pnpm -v)" "10.0.0"; then
    ok "pnpm ready ($(pnpm -v))"
    return 0
  fi

  log "install pnpm ${PNPM_VERSION}"
  if [[ -x /opt/node-current/bin/npm ]]; then
    run_root /opt/node-current/bin/npm install -g "pnpm@${PNPM_VERSION}"
    run_root ln -sfn /opt/node-current/bin/pnpm /usr/local/bin/pnpm
    run_root ln -sfn /opt/node-current/bin/pnpx /usr/local/bin/pnpx 2>/dev/null || true
  else
    run_root npm install -g "pnpm@${PNPM_VERSION}"
  fi

  # Keep the nvm-style path complete for units or manual sessions using it.
  if [[ -x /opt/node-current/bin/pnpm ]]; then
    run_root ln -sfn /opt/node-current/bin/pnpm "/root/.nvm/versions/node/v${NODE_VERSION}/bin/pnpm"
  fi

  hash -r
  command -v pnpm >/dev/null 2>&1 || fail "pnpm is still missing after install"
  version_ge "$(pnpm -v)" "10.0.0" || fail "pnpm $(pnpm -v) is below required >=10"
  ok "pnpm ready ($(pnpm -v))"
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "install docker"
    if [[ "$PKG_MANAGER" == "dnf" || "$PKG_MANAGER" == "yum" ]]; then
      try_install_packages docker || try_install_packages docker-ce || true
    elif [[ "$PKG_MANAGER" == "apt" ]]; then
      try_install_packages docker.io || true
    fi

    if ! command -v docker >/dev/null 2>&1; then
      if [[ "$ALLOW_DOCKER_CONVENIENCE_SCRIPT" == "1" ]]; then
        warn "package manager did not provide docker; using get.docker.com convenience installer"
        curl -fsSL https://get.docker.com -o /tmp/aistareco-get-docker.sh
        run_root sh /tmp/aistareco-get-docker.sh
        rm -f /tmp/aistareco-get-docker.sh
      else
        fail "docker is missing and package-manager install failed"
      fi
    fi
  fi

  command -v docker >/dev/null 2>&1 || fail "docker is still missing after install"
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files docker.service >/dev/null 2>&1; then
    run_root systemctl enable --now docker
  fi
  ok "docker ready ($(docker --version))"
}

ensure_fonts() {
  case "$PKG_MANAGER" in
    dnf|yum) install_packages fontconfig ;;
    apt) install_packages fontconfig ;;
  esac

  local script_dir
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  if [[ -f "$script_dir/install-cjk-fonts.sh" ]]; then
    bash "$script_dir/install-cjk-fonts.sh"
  else
    warn "install-cjk-fonts.sh not found; skipped CJK font install"
  fi
}

ensure_optional() {
  [[ "$INSTALL_OPTIONAL" == "1" ]] || return 0
  case "$PKG_MANAGER" in
    dnf|yum) try_install_packages mariadb || true ;;
    apt) try_install_packages default-mysql-client || try_install_packages mysql-client || true ;;
  esac
}

ensure_base_packages
ensure_nginx

if needs_java; then
  ensure_java
fi

if needs_node; then
  ensure_node
  ensure_pnpm
fi

ensure_ffmpeg
ensure_fonts

if needs_docker; then
  ensure_docker
fi

ensure_optional

ok "host dependencies ready for: $SERVICES_LIST"
