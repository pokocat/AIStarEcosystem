# sau-service

Stateless Python + Playwright worker that bridges `apps/server` (Spring Boot) and the
[social-auto-upload (sau)](https://github.com/dreammis/social-auto-upload) library.

## Why a separate service

Java cannot drive Playwright directly. `apps/server` owns the source of truth (DB,
encrypted cookies, jobs, ledger) and delegates the browser-automation step to this
worker over HTTP. The worker is stateless — Playwright contexts only live in memory
during a single login flow or upload task, and tmpfs (`/dev/shm`) holds video files
and storage_state JSON for the duration of an upload.

```
  apps/server (8080)              sau-service (8090)
  ┌────────────────────┐  POST   ┌────────────────────────┐
  │ SauServiceClient   │ ──────▶ │ FastAPI shim           │
  │ AES-decrypt cookie │         │  /login/{start,poll}   │
  │ start-job tx       │         │  /accounts/verify      │
  └──────┬─────────────┘         │  /upload (taskId)      │
         │  POST                 │  /tasks/{id}, cancel   │
         │  /api/internal/sau    │  ──┐                   │
         ◀───────────────────────┘    │ Playwright in     │
         job-callback (idempotent)    │ memory + tmpfs    │
                                      └───────────────────┘
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/healthz` | Liveness — returns `{ok: true, mockMode}` |
| `POST` | `/login/start` | Open platform login page, capture QR, return ticket + base64 QR |
| `GET`  | `/login/poll?ticket=…` | Returns `{status, storageStatePlain?, profile?}` (success returns plaintext storage_state once; `profile` is clean metadata only) |
| `POST` | `/accounts/verify` | Run a verify pass against existing storage_state; may return refreshed cookie + clean profile |
| `POST` | `/upload` | Submit an upload task; returns `{taskId}`. Progress streams back via `callbackUrl` |
| `GET`  | `/tasks/{taskId}` | Resume sweep — current status snapshot |
| `POST` | `/tasks/{taskId}/cancel` | Best-effort cancel |

All routes require the `X-Internal-Secret` header (shared with `apps/server`'s
`InternalAuthFilter`).

## Cookie & storage_state handling

- Cookies (Playwright `storage_state` JSON) **never persist** in this service.
- Login flow: capture in memory inside a Playwright context, hand the JSON back to
  the server in the `/login/poll` response, then drop the context.
- Profile flow: each platform driver best-effort extracts clean page metadata
  (`displayName`, `platformAccountId`, `avatarUrl`) from the logged-in creator
  center. These fields may be null and never include cookies.
- Upload flow: the server sends the plaintext JSON in the `/upload` request body,
  sau-service writes it to `/dev/shm/{taskId}-state.json`, hands the path to the
  uploader, and unlinks the file when the task finishes (success or failure).
- No PVC, no on-disk persistence — by design.

## v1 mock mode

Set `SAU_MOCK_MODE=1` (default) to skip real Playwright work. The mock uploader
returns synthetic QR codes / synthetic storage_state / synthetic upload progress,
which is enough for `apps/server` to exercise the full state machine.

Slice 5 of the rollout swaps `uploader.py` and `qr.py` over to the patched
[`pokocat/social-auto-upload`](https://github.com/pokocat/social-auto-upload) fork.

## Local dev

### 快速启动（推荐）

使用我们的一键启动脚本：

**macOS / Linux:**
```bash
cd apps/sau-service
./start.sh           # mock 模式，默认
./start.sh real      # 真模式，headless 不弹浏览器（来自 .env.dev）
./start.sh real --headed   # 真模式，显示浏览器窗口（调试 QR 抓取异常时用）
```

**Windows:**
```cmd
cd apps\sau-service
start.bat
```

启动脚本会自动：
- ✅ 检查 Python 环境
- 📦 创建虚拟环境（如需要）
- 📦 安装所有依赖
- 🧪 运行测试
- 🎬 启动服务（mock 模式）
- 📋 加载 `.env.dev` 默认配置（含 `SAU_REAL_LOGIN_HEADLESS=1` 不弹浏览器）

### 手动启动

```bash
cd apps/sau-service
docker compose up --build
# or, without docker:
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
SAU_MOCK_MODE=1 uvicorn sau_service.main:app --reload --port 8090
```

Smoke test:

```bash
curl -H 'X-Internal-Secret: aep-dev-internal-secret-change-in-prod' \
     http://localhost:8090/healthz
```

## Configuration

| Env | Default | Purpose |
|---|---|---|
| `SAU_INTERNAL_SECRET` | `aep-dev-internal-secret-change-in-prod` | Shared with apps/server `aep.internal.secret` |
| `SAU_MOCK_MODE` | `1` | `1` skips Playwright (Slice 3); `0` routes to forked sau (Slice 5+) |
| `SAU_MAX_CONCURRENCY` | `2` | asyncio worker pool size for `/upload` |
| `SAU_LOGIN_TICKET_TTL_S` | `300` | seconds before in-memory login context is dropped |
| `SAU_REAL_LOGIN_HEADLESS` | `1` | `1` = headless（不弹浏览器，dev 默认）；`0` = headed（看 QR 抓取过程） |
| `SAU_TMPFS_DIR` | auto | 视频 / cookie 中转目录。未设时：Linux 用 `/dev/shm`（POSIX 共享内存）；macOS / Windows 回退到 `<tempdir>/sau-service`。生产可显式指定挂载点。 |
| `SAU_DEFAULT_CALLBACK_BASE` | unset | optional default for the callback URL if server omits it |
| `SAU_UPLOAD_TIMEOUT_S` | `180` | 单条 upstream `DouYinVideo.upload()` / `TencentVideo.upload()` 的总超时（秒）。超时强制 cancel + 推 `status=failed errorCode=UPLOAD_TIMEOUT`。防止上游 `while True` 发布按钮循环卡死。 |
| `SAU_UPLOAD_PUBLISHING_AFTER_S` | `60` | 上传持续这么久还没返回时，推送 `status=publishing progress=80` 让 UI 区分"传字节"与"等平台发布"。纯时间启发，upstream 是 atomic 调用没法精确感知阶段切换。 |

**dev 配置入口**：`.env.dev`（入仓默认值）。`start.sh` 启动前自动 `source` 这个文件；想改默认就改这里，不要硬编码到 `start.sh`。

## Tests

```bash
pip install -e '.[dev]'
pytest
```
