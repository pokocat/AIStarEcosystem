@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (py -3 -I serve.py & goto :eof)
where python >nul 2>nul && (python -I serve.py & goto :eof)
echo 没有找到 Python 3。请先到 https://www.python.org/downloads/ 安装，安装时勾选 Add Python to PATH。
pause
