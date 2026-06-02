#!/usr/bin/env bash
# Install system CJK fonts for Java2D, ffmpeg drawtext, headless browsers, and
# other server-side renderers. Idempotent: exits successfully if a CJK font is
# already visible to fontconfig.

set -euo pipefail

GREEN=$'\033[1;32m'
RED=$'\033[1;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[1;36m'
RESET=$'\033[0m'

log() { printf "${CYAN}[cjk-fonts]${RESET} %s\n" "$*"; }
ok() { printf "${GREEN}[cjk-fonts]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[cjk-fonts] %s${RESET}\n" "$*" >&2; exit 1; }

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
elif command -v sudo >/dev/null 2>&1; then
  SUDO=(sudo)
else
  fail "root or sudo is required to install system fonts"
fi

CJK_FONT_RE='Noto (Sans|Serif) CJK|Source Han|WenQuanYi|WenQuan Yi|Microsoft YaHei|SimHei|PingFang'

has_cjk_font() {
  command -v fc-list >/dev/null 2>&1 || return 1
  fc-list :lang=zh family 2>/dev/null | grep -Eiq "$CJK_FONT_RE"
}

show_font_match() {
  if command -v fc-match >/dev/null 2>&1; then
    fc-match 'Noto Sans CJK SC:lang=zh-cn' 2>/dev/null || true
  fi
}

install_rpm_fonts() {
  local manager="$1"
  "${SUDO[@]}" "$manager" install -y fontconfig \
    google-noto-sans-cjk-sc-fonts google-noto-serif-cjk-sc-fonts && return 0
  "${SUDO[@]}" "$manager" install -y fontconfig google-noto-cjk-fonts && return 0
  "${SUDO[@]}" "$manager" install -y fontconfig wqy-microhei-fonts wqy-zenhei-fonts && return 0
  return 1
}

install_apt_fonts() {
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get update
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    fontconfig fonts-noto-cjk fonts-noto-cjk-extra && return 0
  "${SUDO[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    fontconfig fonts-wqy-microhei fonts-wqy-zenhei && return 0
  return 1
}

if has_cjk_font; then
  ok "CJK fonts already available"
  show_font_match
  exit 0
fi

log "CJK fonts missing; installing system font packages"
if command -v dnf >/dev/null 2>&1; then
  install_rpm_fonts dnf || fail "dnf could not install CJK font packages"
elif command -v yum >/dev/null 2>&1; then
  install_rpm_fonts yum || fail "yum could not install CJK font packages"
elif command -v apt-get >/dev/null 2>&1; then
  install_apt_fonts || fail "apt-get could not install CJK font packages"
else
  fail "unsupported package manager; install Noto CJK or WenQuanYi fonts manually"
fi

if command -v fc-cache >/dev/null 2>&1; then
  log "refreshing fontconfig cache"
  "${SUDO[@]}" fc-cache -f
fi

if has_cjk_font; then
  ok "CJK fonts available"
  show_font_match
else
  printf "${YELLOW}[cjk-fonts] fc-list :lang=zh output:${RESET}\n" >&2
  fc-list :lang=zh family 2>/dev/null | head -20 >&2 || true
  fail "CJK font installation did not produce a usable fontconfig match"
fi
