#!/usr/bin/env bash
# 固定 release + SHA；只下载 SDK 制品，不把平台业务源码导入应用仓库。
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
version=0.1.0
jar_sha=e006985c833ed057fbb9aa258e572971445dc7f5e81b8dd242f74730d0337566
pom_sha=e277eccacda56ed92aba59014bf2a7a05bcf92e9a014ae0ee4a049e817721a2f
cache="${MAVEN_REPO_LOCAL:-$HOME/.m2/repository}/cn/aibuzz/platform-sdk/$version"
check_hash() { [[ -f "$1" ]] && [[ "$(shasum -a 256 "$1" | awk '{print $1}')" == "$2" ]]; }
if check_hash "$cache/platform-sdk-$version.jar" "$jar_sha" && check_hash "$cache/platform-sdk-$version.pom" "$pom_sha"; then exit 0; fi
command -v gh >/dev/null || { echo '固定 SDK 制品缺失，请安装 GitHub CLI 并以仓库读取权限登录' >&2; exit 1; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
gh release download java-sdk-v0.1.0 --repo pokocat/aibuzz-platform --dir "$tmp" --pattern "platform-sdk-$version.jar" --pattern "platform-sdk-$version.pom"
check_hash "$tmp/platform-sdk-$version.jar" "$jar_sha" && check_hash "$tmp/platform-sdk-$version.pom" "$pom_sha" || { echo 'SDK release checksum mismatch' >&2; exit 1; }
args=()
[[ -z "${MAVEN_REPO_LOCAL:-}" ]] || args+=("-Dmaven.repo.local=$MAVEN_REPO_LOCAL")
(cd "$repo_root/apps/server" && ./mvnw -q "${args[@]}" org.apache.maven.plugins:maven-install-plugin:3.1.3:install-file -Dfile="$tmp/platform-sdk-$version.jar" -DpomFile="$tmp/platform-sdk-$version.pom")
