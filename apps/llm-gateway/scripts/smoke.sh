#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# smoke.sh — 对运行中的 llm-gateway（默认 127.0.0.1:8081）跑火山 + 千问 真实接口
# 用法：
#   export LLM_GATEWAY_VOLCENGINE_KEY=...
#   export LLM_GATEWAY_DASHSCOPE_KEY=...
#   # 1) 先在另一个终端跑：
#   #    cd apps/llm-gateway && ./mvnw spring-boot:run
#   # 2) 再跑：
#   ./scripts/smoke.sh
#
# 可选 env：
#   GATEWAY_URL（默认 http://127.0.0.1:8081）
#   GATEWAY_TOKEN（业务侧 sk-aep-* 鉴权 key；Phase C 之前可留空）
#   DOUBAO_MODEL（默认 doubao-1-5-pro-32k）
#   QWEN_MODEL（默认 qwen-plus）
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8081}"
GATEWAY_TOKEN="${GATEWAY_TOKEN:-sk-aep-anonymous}"
DOUBAO_MODEL="${DOUBAO_MODEL:-doubao-1-5-pro-32k}"
QWEN_MODEL="${QWEN_MODEL:-qwen-plus}"

echo "▶ healthz"
curl -fsS "${GATEWAY_URL}/v1/healthz"; echo

echo
echo "▶ 火山 / Doubao（非流式）model=${DOUBAO_MODEL}"
curl -fsS "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${DOUBAO_MODEL}\",
    \"messages\": [{\"role\":\"user\",\"content\":\"用一句话自我介绍\"}]
  }" | head -c 500; echo

echo
echo "▶ 千问 / Qwen（流式）model=${QWEN_MODEL}"
curl -fsSN "${GATEWAY_URL}/v1/chat/completions" \
  -H "Authorization: Bearer ${GATEWAY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"${QWEN_MODEL}\",
    \"stream\": true,
    \"messages\": [{\"role\":\"user\",\"content\":\"用一句话介绍你自己\"}]
  }" | head -c 1500; echo

echo
echo "✓ smoke ok"
