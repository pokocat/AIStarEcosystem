#!/bin/sh
# Run through the host's devq heavy-task queue. Reuses an already verified JAR.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
JAR=${1:?Usage: build.sh VERIFIED_JAR IMAGE_TAG PINNED_JAVA_BASE PINNED_NODE_BASE}
TAG=${2:?Explicit image tag required}
BASE=${3:?Digest-pinned Java base required}
NODE_BASE=${4:?Digest-pinned official Node base required}
case "$NODE_BASE" in node@sha256:*|node:*@sha256:*|docker.io/library/node@sha256:*|docker.io/library/node:*@sha256:*) ;; *) echo 'Official Node base must be pinned by digest' >&2; exit 64;; esac
case "$BASE" in *@sha256:*) ;; *) echo 'Base must be pinned by digest' >&2; exit 64;; esac
[ -f "$JAR" ] || exit 66
CONTEXT=$(mktemp -d)
trap 'rm -rf "$CONTEXT"' EXIT HUP INT TERM
cp "$ROOT/infra/images/server/Dockerfile" "$ROOT/infra/images/server/entrypoint.sh" "$CONTEXT/"
cp "$JAR" "$CONTEXT/app.jar"
SHA=$(shasum -a 256 "$CONTEXT/app.jar" | awk '{print $1}')
docker build --platform linux/amd64 --build-arg "JAVA_BASE=$BASE" --build-arg "NODE_BASE=$NODE_BASE" --build-arg "APP_SHA256=$SHA" --tag "$TAG" "$CONTEXT"
printf 'artifact_sha256=%s\n' "$SHA"
docker image inspect --format '{{.Id}}' "$TAG"
