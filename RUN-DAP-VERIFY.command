#!/bin/bash
# 数字人资产平台 · 一键联调验证（由 Claude 通过 Finder 启动）
# 实际逻辑全部在 scripts/dap-verify.sh，本文件只是 Finder 可双击的入口。
cd "$(dirname "$0")"
# 可选本地覆盖（数据库账号等）：.dap-verify.env
[ -f .dap-verify.env ] && set -a && source .dap-verify.env && set +a
echo "================ dap-verify 开始（PROFILE=mysql, AGNES=real）================"
PROFILE=${PROFILE:-mysql} AGNES=${AGNES:-real} bash scripts/dap-verify.sh
RC=$?
echo ""
echo "================ 结束（exit=$RC）。报告：.dap-verify/report.txt ================"
exit $RC
