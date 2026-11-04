#!/bin/bash
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "没有找到 Python 3。请先到 https://www.python.org/downloads/ 安装后再打开。"
  read -r -p "按回车关闭"
  exit 1
fi
python3 -I serve.py
