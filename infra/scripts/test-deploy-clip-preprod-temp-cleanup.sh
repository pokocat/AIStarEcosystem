#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/infra/scripts/deploy-clip-preprod.sh"

bash -n "$SCRIPT"

grep -Fq "find /tmp -maxdepth 1 -type f -user \"\$(id -un)\" -name 'aistareco-clip-*.jar' -mmin +60 -delete" "$SCRIPT"
grep -Fq 'trap cleanup_stage EXIT' "$SCRIPT"
grep -Fq 'rm -f "$tmp"' "$SCRIPT"

echo '3 clip preprod temp-cleanup guards passed'
