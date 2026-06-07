#!/usr/bin/env bash
# ============================================================
# 拉取 MediaPipe Face Landmarker 自托管资产 → public/mediapipe/
#   端上精调（BeautyStudio）的人脸关键点依赖；仓库已随库提交一份，
#   升级版本 / 资产损坏时执行本脚本重新拉取。
#   用法：bash apps/web-aiavatar/scripts/fetch-mediapipe-assets.sh [version]
# ============================================================
set -euo pipefail

VERSION="${1:-0.10.35}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/public/mediapipe"
CDN="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}"
MODEL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

mkdir -p "$DIR/wasm"
echo "→ tasks-vision@${VERSION} → $DIR"

curl -fSL -o "$DIR/vision_bundle.mjs" "$CDN/vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  curl -fSL -o "$DIR/wasm/$f" "$CDN/wasm/$f"
done
curl -fSL -o "$DIR/face_landmarker.task" "$MODEL"

echo "✓ done:"
ls -la "$DIR" "$DIR/wasm"
echo
echo "注意：升级版本后同步 src/proto/beauty/landmarks.ts 的 MP_VERSION。"
