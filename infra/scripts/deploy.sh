#!/usr/bin/env bash
# Build a release locally and deploy it to the production host.
#
# This is a convenience wrapper around:
#   infra/scripts/build-release.sh
#   infra/scripts/deploy-release.sh
#
# Usage:
#   DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/path/key.pem ./infra/scripts/deploy.sh all
#   ECS_HOST=ecs-user@47.98.162.120 ./infra/scripts/deploy.sh server

set -euo pipefail

SERVICE="${1:-all}"
TAG="${2:-}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${RELEASE_ID:-}" ]]; then
  if [[ -n "$TAG" ]]; then
    export RELEASE_ID="$TAG"
  else
    export RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
  fi
fi

"$REPO_ROOT/infra/scripts/build-release.sh" "$SERVICE"
"$REPO_ROOT/infra/scripts/deploy-release.sh" "$REPO_ROOT/dist/deploy/$RELEASE_ID" "$SERVICE"
