#!/bin/sh
set -eu
[ "${SPRING_PROFILES_ACTIVE:-}" = postgres ] || { echo 'Only the postgres production profile is allowed' >&2; exit 64; }
[ -n "${DB_URL:-}" ] && [ -n "${DB_USERNAME:-}" ] && [ -n "${DB_PASSWORD:-}" ] || { echo 'Explicit database credentials required' >&2; exit 64; }
TRUSTSTORE=${AISTAR_JAVA_TRUSTSTORE:-/etc/aistar/java-truststore}
[ -r "$TRUSTSTORE" ] || { echo 'Read-only Java truststore with the official Tair CA required' >&2; exit 64; }
exec java -Djavax.net.ssl.trustStore="$TRUSTSTORE" -Djavax.net.ssl.trustStorePassword=changeit -Duser.timezone=Asia/Shanghai -Xms128m -Xmx1024m -jar /app/app.jar "$@"
