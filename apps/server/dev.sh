#!/usr/bin/env bash
# 本地开发启动脚本：H2 dev profile + 调试登录入口 + 本地视频基路径
# 用法：./dev.sh

set -e
cd "$(dirname "$0")"

export AEP_DEV_AUTH_ENABLED=true
export AEP_FORGE_VIDEO_BASE=/web/videos

exec ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev "$@"
