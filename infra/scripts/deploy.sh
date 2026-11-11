#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${1:-server}" != server ]]; then
  echo "双机发布入口当前只验收 server。前端/SAU 发布需使用各自完成验收的集群入口，禁止回退旧机。" >&2
  exit 1
fi
if [[ $# -gt 0 ]]; then shift; fi
exec python3 "$REPO_ROOT/infra/scripts/cluster/release.py" "$@"
