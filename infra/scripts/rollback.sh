#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# infra/scripts/rollback.sh — 回滚单个 service 到指定 tag
#
# 用法：
#   ECS_HOST=root@... ./infra/scripts/rollback.sh <service> <tag>
#
# 当前实现：基于 git 回滚（git checkout <tag> → rebuild → deploy.sh）
# 后续容器化后改为：docker pull aistareco/<service>:<tag> → 重启
#
# **重要**：本地工作区必须无未提交改动；本脚本会 stash 改动后切 tag，结束时 stash pop
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SERVICE="${1:?usage: rollback.sh <service> <tag>}"
TAG="${2:?usage: rollback.sh <service> <tag>}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# stash 当前工作区
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[rollback] stashing uncommitted changes..."
  git stash push -m "rollback-stash-$(date +%s)"
  STASHED=1
else
  STASHED=0
fi

CURRENT=$(git rev-parse HEAD)
trap 'echo "[rollback] restoring HEAD=$CURRENT"; git checkout "$CURRENT"; [[ $STASHED -eq 1 ]] && git stash pop' EXIT

echo "[rollback] checkout $TAG..."
git checkout "$TAG"

echo "[rollback] deploy $SERVICE @ $TAG..."
"$REPO_ROOT/infra/scripts/deploy.sh" "$SERVICE" "$TAG"

echo "[rollback] done — git HEAD will be restored to $CURRENT on exit"
