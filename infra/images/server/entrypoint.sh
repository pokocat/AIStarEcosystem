#!/bin/sh
set -eu
[ "${SPRING_PROFILES_ACTIVE:-}" = postgres ] || { echo 'Only the postgres production profile is allowed' >&2; exit 64; }
[ -n "${DB_URL:-}" ] && [ -n "${DB_USERNAME:-}" ] && [ -n "${DB_PASSWORD:-}" ] || { echo 'Explicit database credentials required' >&2; exit 64; }
exec java -Duser.timezone=UTC -Xms128m -Xmx1024m -jar /app/app.jar "$@"
