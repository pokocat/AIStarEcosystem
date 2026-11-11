#!/bin/sh
set -eu
# Run through devq (remote by default). Keep all runtime dependencies out of the source tree.
: "${STUDIO_DEPTH_HOME:?Set STUDIO_DEPTH_HOME to an isolated absolute runtime directory}"
case "$STUDIO_DEPTH_HOME" in /*) ;; *) echo 'STUDIO_DEPTH_HOME must be absolute' >&2; exit 2;; esac
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
mkdir -p "$STUDIO_DEPTH_HOME"
if command -v uv >/dev/null 2>&1; then
  uv venv --python 3.12 --allow-existing "$STUDIO_DEPTH_HOME/venv"
  uv pip install --python "$STUDIO_DEPTH_HOME/venv/bin/python" -r "$script_dir/requirements.txt"
else
  "${PYTHON_BIN:-python3}" -c 'import sys; assert sys.version_info >= (3,10), "Python >=3.10 required; install a portable Python or uv first"'
  "${PYTHON_BIN:-python3}" -m venv "$STUDIO_DEPTH_HOME/venv"
  "$STUDIO_DEPTH_HOME/venv/bin/python" -m pip install -r "$script_dir/requirements.txt"
fi
mkdir -p "$STUDIO_DEPTH_HOME/weights"
# 中国大陆的机器直连 huggingface.co 常被限流（429）：按 ReShot 文档先 export HF_ENDPOINT=https://hf-mirror.com 再运行本脚本。
"$STUDIO_DEPTH_HOME/venv/bin/python" - "$STUDIO_DEPTH_HOME/weights" <<'PY'
import sys
from huggingface_hub import hf_hub_download
path = hf_hub_download('depth-anything/Video-Depth-Anything-Small', 'video_depth_anything_vits.pth', local_dir=sys.argv[1])
print('Checkpoint:', path)
# DWPose (ReShot --control pose): person detector + whole-body estimator, ~340 MB, downloaded once here, never at request time.
for name in ('yolox_l.onnx', 'dw-ll_ucoco_384.onnx'):
    print('Pose weights:', hf_hub_download('yzd-v/DWPose', name, local_dir=sys.argv[1] + '/dwpose'))
PY
"$STUDIO_DEPTH_HOME/venv/bin/reshot" --version
if command -v uv >/dev/null 2>&1; then
  uv pip freeze --python "$STUDIO_DEPTH_HOME/venv/bin/python" > "$STUDIO_DEPTH_HOME/installed-requirements.txt"
else
  "$STUDIO_DEPTH_HOME/venv/bin/python" -m pip freeze > "$STUDIO_DEPTH_HOME/installed-requirements.txt"
fi
