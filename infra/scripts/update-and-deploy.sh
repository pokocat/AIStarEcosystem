#!/usr/bin/env bash
# One-command ECS-local update and deploy.
#
# This script is for the case where you have already SSH'd into the production
# host and the repo exists on disk. It installs missing host dependencies, pulls
# the current branch with a safe fast-forward update, then execs deploy-local.sh.
#
# Usage:
#   sudo ./infra/scripts/update-and-deploy.sh all
#   sudo ./infra/scripts/update-and-deploy.sh server,admin
#   sudo ./infra/scripts/update-and-deploy.sh server,admin --no-verify
#   sudo ./infra/scripts/update-and-deploy.sh all --branch=main
#
# Dirty worktrees are not overwritten. Use --reset-to-origin only when you
# explicitly want to discard local server-side repo changes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

RAW_SERVICES=""
DEPLOY_ARGS=()
BRANCH="${BRANCH:-}"
RESET_TO_ORIGIN=0
DO_DEPS=1

usage() {
  cat <<'EOF'
Usage:
  sudo ./infra/scripts/update-and-deploy.sh all
  sudo ./infra/scripts/update-and-deploy.sh server,admin
  sudo ./infra/scripts/update-and-deploy.sh server,admin --no-verify
  sudo ./infra/scripts/update-and-deploy.sh all --branch=main

Behavior:
  Installs missing host dependencies, runs git pull --ff-only, then execs deploy-local.sh.
  Dirty worktrees are not overwritten. Use --reset-to-origin only when explicitly discarding server-side repo changes.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --branch=*) BRANCH="${arg#--branch=}" ;;
    --reset-to-origin) RESET_TO_ORIGIN=1 ;;
    --no-deps)
      DO_DEPS=0
      DEPLOY_ARGS+=("$arg")
      ;;
    --help|-h) usage; exit 0 ;;
    --*)
      DEPLOY_ARGS+=("$arg")
      ;;
    *)
      RAW_SERVICES="${RAW_SERVICES} ${arg}"
      DEPLOY_ARGS+=("$arg")
      ;;
  esac
done

RAW_SERVICES="$(printf "%s" "${RAW_SERVICES:-${SERVICES:-all}}" | xargs)"
if [[ "${#DEPLOY_ARGS[@]}" -eq 0 ]]; then
  DEPLOY_ARGS=("all")
fi

GREEN=$'\033[1;32m'
RED=$'\033[1;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[1;36m'
RESET=$'\033[0m'

log() { printf "${CYAN}[update-deploy]${RESET} %s\n" "$*"; }
ok() { printf "${GREEN}[update-deploy]${RESET} %s\n" "$*"; }
fail() { printf "${RED}[update-deploy] %s${RESET}\n" "$*" >&2; exit 1; }

stat_user() {
  stat -c '%U' "$1" 2>/dev/null || stat -f '%Su' "$1" 2>/dev/null || true
}

REPO_OWNER="${REPO_OWNER:-$(stat_user "$REPO_ROOT/.git")}"
if [[ -z "$REPO_OWNER" || "$REPO_OWNER" == "UNKNOWN" ]]; then
  REPO_OWNER="$(id -un)"
fi

run_git() {
  if [[ "$(id -u)" -eq 0 && "$REPO_OWNER" != "root" ]]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo -H -u "$REPO_OWNER" git -C "$REPO_ROOT" "$@"
    elif command -v runuser >/dev/null 2>&1; then
      runuser -u "$REPO_OWNER" -- git -C "$REPO_ROOT" "$@"
    else
      local repo_q arg_q quoted_args=""
      printf -v repo_q "%q" "$REPO_ROOT"
      for arg in "$@"; do
        printf -v arg_q "%q" "$arg"
        quoted_args="${quoted_args} ${arg_q}"
      done
      su -s /bin/bash "$REPO_OWNER" -c "cd ${repo_q} && git${quoted_args}"
    fi
  else
    git -C "$REPO_ROOT" "$@"
  fi
}

if [[ "$DO_DEPS" == "1" ]]; then
  log "ensure host dependencies for: $RAW_SERVICES"
  "$REPO_ROOT/infra/scripts/install-host-deps.sh" "$RAW_SERVICES"
else
  log "skip host dependency install (--no-deps)"
fi

command -v git >/dev/null 2>&1 || fail "git is missing after host dependency install"
run_git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not a git worktree: $REPO_ROOT"

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(run_git symbolic-ref --quiet --short HEAD || true)"
fi
[[ -n "$BRANCH" ]] || fail "cannot determine current branch; pass --branch=<name>"

log "update repo as $REPO_OWNER on branch $BRANCH"
run_git fetch --prune origin

if [[ "$RESET_TO_ORIGIN" == "1" ]]; then
  log "reset worktree to origin/$BRANCH"
  run_git reset --hard "origin/$BRANCH"
else
  if [[ -n "$(run_git status --short)" ]]; then
    run_git status --short
    fail "worktree is dirty; commit/stash server-side changes or rerun with --reset-to-origin"
  fi
  run_git pull --ff-only origin "$BRANCH"
fi

ok "repo at $(run_git rev-parse --short HEAD)"

log "exec deploy-local.sh ${DEPLOY_ARGS[*]}"
exec "$REPO_ROOT/infra/scripts/deploy-local.sh" "${DEPLOY_ARGS[@]}"
