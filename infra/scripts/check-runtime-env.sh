#!/usr/bin/env bash
# Validate runtime env files and release build-time env before restarting
# production services. Values are never printed; diagnostics name only keys.
#
# Usage:
#   sudo ./infra/scripts/check-runtime-env.sh server,admin --release-dir dist/deploy/<release>
#
# Override paths:
#   SERVER_ENV_FILE=/etc/aistareco/server.env
#   SAU_ENV_FILE=/etc/aistareco/sau-service.env

set -euo pipefail

DEFAULT_SERVICES="server web-celebrity web-aiavatar admin sau-service"
RAW_SERVICES=""
RELEASE_DIR=""
SERVER_ENV_FILE="${SERVER_ENV_FILE:-/etc/aistareco/server.env}"
SAU_ENV_FILE="${SAU_ENV_FILE:-/etc/aistareco/sau-service.env}"
WARN_ONLY="${ENV_CHECK_WARN_ONLY:-0}"

usage() {
  cat <<'EOF'
Usage:
  sudo ./infra/scripts/check-runtime-env.sh server,admin --release-dir dist/deploy/<release>

Checks:
  /etc/aistareco/server.env, /etc/aistareco/sau-service.env, and release manifest build-time env.
  Values are never printed; diagnostics name only keys.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-dir=*) RELEASE_DIR="${1#--release-dir=}"; shift ;;
    --release-dir)
      [[ $# -ge 2 ]] || { echo "--release-dir requires a path" >&2; exit 2; }
      RELEASE_DIR="$2"
      shift 2
      ;;
    --warn-only) WARN_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "unknown option: $1" >&2; exit 2 ;;
    *) RAW_SERVICES="${RAW_SERVICES} ${1}"; shift ;;
  esac
done

RAW_SERVICES="$(printf "%s" "${RAW_SERVICES:-${SERVICES:-all}}" | xargs)"

GREEN=$'\033[1;32m'
RED=$'\033[1;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[1;36m'
RESET=$'\033[0m'

FAILS=0
WARNS=0

log() { printf "${CYAN}[env-check]${RESET} %s\n" "$*"; }
ok() { printf "${GREEN}[env-check]${RESET} %s\n" "$*"; }
warn() { printf "${YELLOW}[env-check] WARN: %s${RESET}\n" "$*" >&2; WARNS=$((WARNS + 1)); }
err() {
  if [[ "$WARN_ONLY" == "1" ]]; then
    warn "$*"
  else
    printf "${RED}[env-check] ERROR: %s${RESET}\n" "$*" >&2
    FAILS=$((FAILS + 1))
  fi
}

normalize_services() {
  local raw="${1//,/ }"
  local out="" item
  for item in $raw; do
    case "$item" in
      all) out="$out $DEFAULT_SERVICES" ;;
      server|web-celebrity|web-aiavatar|admin|sau-service) out="$out $item" ;;
      "") ;;
      *) err "unknown service '$item' (expected server|web-celebrity|web-aiavatar|admin|sau-service|all)" ;;
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
[[ -n "$SERVICES_LIST" ]] || err "no services selected"

has_service() {
  local needle="$1" item
  for item in $SERVICES_LIST; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

needs_server_env() {
  has_service server || has_service admin || has_service web-celebrity || has_service web-aiavatar || has_service sau-service
}

needs_release_manifest() {
  has_service admin || has_service web-celebrity || has_service web-aiavatar
}

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || true
}

check_env_file() {
  local file="$1" label="$2" mode
  if [[ ! -f "$file" ]]; then
    err "$label env file missing: $file"
    return 1
  fi
  if [[ ! -r "$file" ]]; then
    err "$label env file is not readable by current user: $file"
    return 1
  fi
  mode="$(file_mode "$file")"
  if [[ -n "$mode" && "$mode" != "600" && "$mode" != "400" ]]; then
    warn "$label env file mode is $mode; recommended 600"
  fi
  ok "$label env file present"
}

env_value() {
  local file="$1" key="$2"
  awk -v key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/\r$/, "", line)
      eq=index(line, "=")
      if (eq == 0) next
      k=substr(line, 1, eq - 1)
      gsub(/^[ \t]+|[ \t]+$/, "", k)
      if (k == key) {
        v=substr(line, eq + 1)
        gsub(/^[ \t]+|[ \t]+$/, "", v)
        if ((substr(v,1,1) == "\"" && substr(v,length(v),1) == "\"") ||
            (substr(v,1,1) == "'"'"'" && substr(v,length(v),1) == "'"'"'")) {
          v=substr(v, 2, length(v) - 2)
        }
        value=v
        found=1
      }
    }
    END {
      if (found) {
        print value
        exit 0
      }
      exit 1
    }
  ' "$file"
}

get_env() {
  env_value "$1" "$2" 2>/dev/null || true
}

is_placeholder() {
  local value="$1"
  case "$value" in
    ""|*"<FILL"*|*"FILL_"*|*"CHANGE_ME"*|*"change-in-prod"*|*"NOT-FOR-PROD"*|*"dev-local-"*|*"aep-dev-"*)
      return 0
      ;;
  esac
  return 1
}

to_lower() {
  printf "%s" "$1" | tr '[:upper:]' '[:lower:]'
}

require_key() {
  local file="$1" key="$2" value
  value="$(get_env "$file" "$key")"
  if is_placeholder "$value"; then
    err "$key is missing or still uses a placeholder"
    return 0
  fi
  ok "$key set"
}

require_min_len() {
  local file="$1" key="$2" min_len="$3" value
  value="$(get_env "$file" "$key")"
  if is_placeholder "$value"; then
    err "$key is missing or still uses a placeholder"
    return 0
  fi
  if (( ${#value} < min_len )); then
    err "$key is too short; expected at least $min_len characters"
    return 0
  fi
  ok "$key length ok"
}

expect_value() {
  local file="$1" key="$2" expected="$3" value
  value="$(get_env "$file" "$key")"
  if [[ "$(to_lower "$value")" != "$(to_lower "$expected")" ]]; then
    err "$key must be '$expected'"
    return 0
  fi
  ok "$key=$expected"
}

warn_unless_value() {
  local file="$1" key="$2" expected="$3" value
  value="$(get_env "$file" "$key")"
  if [[ "$(to_lower "$value")" != "$(to_lower "$expected")" ]]; then
    warn "$key is not '$expected'"
  else
    ok "$key=$expected"
  fi
}

require_int() {
  local file="$1" key="$2" value
  value="$(get_env "$file" "$key")"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    err "$key must be an integer"
  else
    ok "$key integer ok"
  fi
}

require_url_prefix() {
  local file="$1" key="$2" value
  value="$(get_env "$file" "$key")"
  if is_placeholder "$value"; then
    err "$key is missing or still uses a placeholder"
  elif [[ ! "$value" =~ ^https?:// && ! "$value" =~ ^/ ]]; then
    err "$key must be an http(s) URL or an absolute path"
  else
    ok "$key format ok"
  fi
}

check_server_env() {
  check_env_file "$SERVER_ENV_FILE" "server" || return 0

  expect_value "$SERVER_ENV_FILE" SPRING_PROFILES_ACTIVE mysql
  require_key "$SERVER_ENV_FILE" DB_URL
  require_key "$SERVER_ENV_FILE" DB_USERNAME
  require_key "$SERVER_ENV_FILE" DB_PASSWORD
  require_min_len "$SERVER_ENV_FILE" AEP_JWT_SECRET 32
  require_min_len "$SERVER_ENV_FILE" AEP_INTERNAL_SECRET 16
  require_min_len "$SERVER_ENV_FILE" AEP_SECRET_KEY 24
  expect_value "$SERVER_ENV_FILE" AEP_DEV_AUTH_ENABLED false
  warn_unless_value "$SERVER_ENV_FILE" AEP_SEED_DEV_DATA_ENABLED false

  local db_url sms_driver cdn_driver signed_strategy coze_enabled
  db_url="$(get_env "$SERVER_ENV_FILE" DB_URL)"
  if [[ "$db_url" != jdbc:mysql://* ]]; then
    err "DB_URL must start with jdbc:mysql://"
  fi
  if [[ "$db_url" != *"characterEncoding=UTF-8"* || "$db_url" != *"useUnicode=true"* ]]; then
    warn "DB_URL should include characterEncoding=UTF-8 and useUnicode=true"
  fi
  if [[ "$db_url" != *"utf8mb4"* ]]; then
    warn "DB_URL should include an utf8mb4 connection collation"
  fi

  cdn_driver="$(to_lower "$(get_env "$SERVER_ENV_FILE" AEP_CDN_DRIVER)")"
  if [[ "$cdn_driver" != "oss" ]]; then
    warn "AEP_CDN_DRIVER is not 'oss'; production persistent assets may fall back to local disk"
  else
    ok "AEP_CDN_DRIVER=oss"
    require_key "$SERVER_ENV_FILE" AEP_CDN_OSS_ENDPOINT
    require_key "$SERVER_ENV_FILE" AEP_CDN_OSS_BUCKET
    require_key "$SERVER_ENV_FILE" AEP_CDN_OSS_ACCESS_KEY_ID
    require_key "$SERVER_ENV_FILE" AEP_CDN_OSS_ACCESS_KEY_SECRET
    require_url_prefix "$SERVER_ENV_FILE" AEP_CDN_OSS_BASE_URL
    require_url_prefix "$SERVER_ENV_FILE" AEP_CDN_PUBLIC_BASE_URL
    signed_strategy="$(to_lower "$(get_env "$SERVER_ENV_FILE" AEP_CDN_SIGNED_URL_STRATEGY)")"
    case "$signed_strategy" in
      cdn)
        require_int "$SERVER_ENV_FILE" AEP_CDN_SIGNED_URL_TTL_SECONDS
        require_min_len "$SERVER_ENV_FILE" AEP_CDN_SIGNED_URL_CDN_AUTH_KEY 16
        ;;
      oss)
        require_int "$SERVER_ENV_FILE" AEP_CDN_SIGNED_URL_TTL_SECONDS
        ;;
      none|"")
        err "AEP_CDN_SIGNED_URL_STRATEGY must not be 'none' in production"
        ;;
      *)
        err "AEP_CDN_SIGNED_URL_STRATEGY must be one of cdn, oss, none"
        ;;
    esac
  fi

  sms_driver="$(to_lower "$(get_env "$SERVER_ENV_FILE" AEP_SMS_DRIVER)")"
  case "$sms_driver" in
    aliyun)
      ok "AEP_SMS_DRIVER=aliyun"
      require_key "$SERVER_ENV_FILE" ALIYUN_SMS_ACCESS_KEY_ID
      require_key "$SERVER_ENV_FILE" ALIYUN_SMS_ACCESS_KEY_SECRET
      require_key "$SERVER_ENV_FILE" ALIYUN_SMS_SIGN_NAME
      require_key "$SERVER_ENV_FILE" ALIYUN_SMS_REGISTER_TEMPLATE_CODE
      ;;
    log|disabled|none|"")
      err "AEP_SMS_DRIVER must be aliyun for production SMS"
      ;;
    *)
      err "AEP_SMS_DRIVER has unsupported value"
      ;;
  esac

  coze_enabled="$(to_lower "$(get_env "$SERVER_ENV_FILE" AEP_COZE_ENABLED)")"
  if [[ "$coze_enabled" == "true" || "$coze_enabled" == "1" ]]; then
    require_key "$SERVER_ENV_FILE" AEP_COZE_TOKEN
    require_key "$SERVER_ENV_FILE" AEP_COZE_BOT_ID
  fi

  require_key "$SERVER_ENV_FILE" SAU_SERVICE_URL
  require_key "$SERVER_ENV_FILE" SAU_CALLBACK_BASE_URL
  require_int "$SERVER_ENV_FILE" SAU_REQUEST_TIMEOUT_MS
}

check_sau_env() {
  check_env_file "$SAU_ENV_FILE" "sau-service" || return 0

  expect_value "$SAU_ENV_FILE" SAU_MOCK_MODE 0
  require_min_len "$SAU_ENV_FILE" SAU_INTERNAL_SECRET 16
  require_key "$SAU_ENV_FILE" SAU_DEFAULT_CALLBACK_BASE
  require_int "$SAU_ENV_FILE" SAU_REQUEST_TIMEOUT_MS
  require_int "$SAU_ENV_FILE" SAU_LOGIN_NAV_TIMEOUT_MS
  require_int "$SAU_ENV_FILE" SAU_UPLOAD_TIMEOUT_S
  require_int "$SAU_ENV_FILE" SAU_INTERACTION_USER_TIMEOUT_S

  if [[ -r "$SERVER_ENV_FILE" ]]; then
    local server_secret sau_secret
    server_secret="$(get_env "$SERVER_ENV_FILE" AEP_INTERNAL_SECRET)"
    sau_secret="$(get_env "$SAU_ENV_FILE" SAU_INTERNAL_SECRET)"
    if ! is_placeholder "$server_secret" && ! is_placeholder "$sau_secret"; then
      if [[ "$server_secret" != "$sau_secret" ]]; then
        err "SAU_INTERNAL_SECRET must match AEP_INTERNAL_SECRET"
      else
        ok "SAU_INTERNAL_SECRET matches AEP_INTERNAL_SECRET"
      fi
    fi
  fi
}

manifest_value() {
  local key="$1"
  [[ -n "$RELEASE_DIR" && -f "$RELEASE_DIR/manifest.env" ]] || return 1
  get_env "$RELEASE_DIR/manifest.env" "$key"
}

check_release_manifest() {
  if ! needs_release_manifest; then
    return 0
  fi
  if [[ -z "$RELEASE_DIR" ]]; then
    warn "release manifest not checked because --release-dir was not provided"
    return 0
  fi
  if [[ ! -f "$RELEASE_DIR/manifest.env" ]]; then
    err "release manifest missing: $RELEASE_DIR/manifest.env"
    return 0
  fi

  ok "release manifest present"
  local use_mock api_base server_base mixcut_real
  use_mock="$(manifest_value NEXT_PUBLIC_USE_MOCK || true)"
  api_base="$(manifest_value NEXT_PUBLIC_API_BASE_URL || true)"
  server_base="$(manifest_value NEXT_PUBLIC_SERVER_API_BASE || true)"
  mixcut_real="$(manifest_value NEXT_PUBLIC_MIXCUT_USE_REAL || true)"

  if [[ "$use_mock" != "0" ]]; then
    err "NEXT_PUBLIC_USE_MOCK must be 0 in production release manifest"
  else
    ok "NEXT_PUBLIC_USE_MOCK=0"
  fi
  if [[ "$api_base" != "/api" ]]; then
    warn "NEXT_PUBLIC_API_BASE_URL is not /api"
  else
    ok "NEXT_PUBLIC_API_BASE_URL=/api"
  fi
  if is_placeholder "$server_base"; then
    err "NEXT_PUBLIC_SERVER_API_BASE is missing in release manifest"
  else
    ok "NEXT_PUBLIC_SERVER_API_BASE set"
  fi
  if has_service web-celebrity; then
    if [[ "$mixcut_real" != "1" ]]; then
      err "NEXT_PUBLIC_MIXCUT_USE_REAL must be 1 for web-celebrity production release"
    else
      ok "NEXT_PUBLIC_MIXCUT_USE_REAL=1"
    fi
  fi
}

log "checking services: $SERVICES_LIST"
if needs_server_env; then
  check_server_env
fi
if has_service sau-service; then
  check_sau_env
fi
check_release_manifest

if (( FAILS > 0 )); then
  printf "${RED}[env-check] FAILED: %d error(s), %d warning(s)${RESET}\n" "$FAILS" "$WARNS" >&2
  exit 1
fi

if (( WARNS > 0 )); then
  printf "${YELLOW}[env-check] OK with %d warning(s)${RESET}\n" "$WARNS"
else
  printf "${GREEN}[env-check] ALL GREEN${RESET}\n"
fi
