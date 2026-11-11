#!/bin/bash
# 生产机 /opt/studio-depth/reshot-remote 通过 ssh 调这里，参数原样交给 ReShot（2026-11-11）。
# reshot 用户的进程整体限 2 核、6G（systemd user slice），线程数跟着设成 2；超时兜底，生产机断开后不留僵尸任务。
set -euo pipefail
export OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2
exec timeout --kill-after=30 1800 nice -n 10 /opt/studio-depth/venv/bin/reshot "$@"
