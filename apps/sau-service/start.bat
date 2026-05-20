@echo off
REM sau-service Windows 快速启动脚本
REM 用于一键安装依赖、配置环境并启动服务

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo =============================================
echo      🚀 启动 sau-service 服务
echo =============================================
echo.

REM 检查 Python 环境
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Python，请先安装 Python 3.9 或更高版本
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo ✅ 检测到 Python 版本: %PYTHON_VERSION%
echo.

REM 创建虚拟环境（如果不存在）
if not exist ".venv" (
    echo 📦 创建虚拟环境...
    python -m venv .venv
    echo ✅ 虚拟环境创建成功
)

REM 激活虚拟环境
echo 🔧 激活虚拟环境...
call .venv\Scripts\activate.bat

REM 更新 pip
python -m pip install --upgrade pip -q

REM 安装依赖
echo 📦 安装项目依赖...
pip install -e ".[dev]" -q
echo ✅ 依赖安装完成
echo.

REM 运行测试
echo 🧪 运行测试...
pytest -q

echo.
echo =============================================
echo      ✨ 测试通过！
echo =============================================
echo.

REM 启动服务
echo 🎬 启动 sau-service 服务（mock 模式）...
echo 📡 服务将运行在: http://localhost:8090
echo 🔍 健康检查端点: http://localhost:8090/healthz
echo ⚙️  内部密钥: aep-dev-internal-secret-change-in-prod
echo.
echo 按 Ctrl+C 停止服务
echo =============================================
echo.

set SAU_MOCK_MODE=1
uvicorn sau_service.main:app --host 0.0.0.0 --port 8090 --reload

pause
