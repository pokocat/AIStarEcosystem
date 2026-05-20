#!/bin/bash
# sau-service 快速启动脚本
# 用于一键安装依赖、配置环境并启动服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 解析命令行参数：第一个位置参数选 mock/real；--headed 可选 flag
RUN_MODE="mock"
HEADED=0
for arg in "$@"; do
    case "$arg" in
        real|--real) RUN_MODE="real" ;;
        mock|--mock) RUN_MODE="mock" ;;
        --headed)    HEADED=1 ;;
        -h|--help)
            echo "用法: $0 [mock|real] [--headed]"
            echo ""
            echo "  mock      - Mock 模式（默认，快速启动，用于开发测试）"
            echo "  real      - 真实模式（需要 patchright chromium，用于真实上传）"
            echo "  --headed  - real 模式下显示浏览器窗口（默认 headless 不弹）"
            exit 0
            ;;
        *)
            echo "未知参数: $arg" >&2
            echo "用法: $0 [mock|real] [--headed]" >&2
            exit 1
            ;;
    esac
done

# 加载 dev 默认配置（入仓共享；本地可改不入 commit）
if [ -f ".env.dev" ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env.dev
    set +a
    echo "✅ 已加载 .env.dev 默认配置"
fi

echo "============================================="
echo "     🚀 启动 sau-service 服务"
echo "============================================="
echo "📋 启动模式: $RUN_MODE"
echo ""

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 Python 3，请先安装 Python 3.10 或更高版本"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✅ 检测到 Python 版本: $PYTHON_VERSION"
echo ""

# 创建虚拟环境（如果不存在）
if [ ! -d ".venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv .venv
    echo "✅ 虚拟环境创建成功"
fi

# 激活虚拟环境
echo "🔧 激活虚拟环境..."
source .venv/bin/activate

# 检查 pip
pip install --upgrade pip -q

# 安装依赖
echo "📦 安装项目依赖..."
pip install -e ".[real,dev]" -q
echo "✅ 依赖安装完成"

# 真实模式：安装 patchright chromium
if [ "$RUN_MODE" = "real" ]; then
    echo ""
    echo "🔍 检查 patchright chromium..."
    if [ ! -d "/Users/donis/Library/Caches/ms-playwright/chromium-1208" ]; then
        echo "📥 正在安装 patchright chromium（约 200MB）..."
        patchright install chromium
        echo "✅ Chromium 安装完成"
    else
        echo "✅ Chromium 已安装"
    fi
fi

echo ""

# Mock 模式才运行测试
if [ "$RUN_MODE" = "mock" ]; then
    echo "🧪 运行测试..."
    pytest -q
    echo ""
    echo "============================================="
    echo "     ✨ 测试通过！"
    echo "============================================="
    echo ""
fi

# 启动服务
if [ "$RUN_MODE" = "real" ]; then
    # --headed 显式开启则覆盖 .env.dev 默认；否则跟随 .env.dev（默认 headless=1）
    if [ "$HEADED" = "1" ]; then
        export SAU_REAL_LOGIN_HEADLESS=0
        HEADLESS_HINT="🎮 显示浏览器窗口（--headed）"
    else
        : "${SAU_REAL_LOGIN_HEADLESS:=1}"
        export SAU_REAL_LOGIN_HEADLESS
        if [ "$SAU_REAL_LOGIN_HEADLESS" = "1" ]; then
            HEADLESS_HINT="👻 headless 模式（不弹浏览器；要看用 --headed）"
        else
            HEADLESS_HINT="🎮 显示浏览器窗口（来自 .env.dev）"
        fi
    fi

    export SAU_MOCK_MODE=0
    : "${SAU_INTERNAL_SECRET:=aep-dev-internal-secret-change-in-prod}"
    export SAU_INTERNAL_SECRET

    echo "🎬 启动 sau-service 服务（真实模式）..."
    echo "📡 服务将运行在: http://localhost:8090"
    echo "🔍 健康检查端点: http://localhost:8090/healthz"
    echo "⚙️  内部密钥: $SAU_INTERNAL_SECRET"
    echo "$HEADLESS_HINT"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo "============================================="
    echo ""

    uvicorn sau_service.main:app --host 0.0.0.0 --port 8090 --reload
else
    export SAU_MOCK_MODE=1
    : "${SAU_INTERNAL_SECRET:=aep-dev-internal-secret-change-in-prod}"
    export SAU_INTERNAL_SECRET

    echo "🎬 启动 sau-service 服务（Mock 模式）..."
    echo "📡 服务将运行在: http://localhost:8090"
    echo "🔍 健康检查端点: http://localhost:8090/healthz"
    echo "⚙️  内部密钥: $SAU_INTERNAL_SECRET"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo "============================================="
    echo ""

    uvicorn sau_service.main:app --host 0.0.0.0 --port 8090 --reload
fi
