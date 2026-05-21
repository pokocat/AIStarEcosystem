# sau-service

Stateless Python + Playwright worker that bridges `apps/server` (Spring Boot) and the
[social-auto-upload (sau)](https://github.com/dreammis/social-auto-upload) library.

> **Scaling roadmap**: `/accounts/verify` 每次都 spawn 一个 chromium，并发起来会压宿主机。
> v0.5.x 已加 **前端串行 + 10min TTL skip + server Semaphore(1)** 短期保护。
> 中期（浏览器进程复用 worker）+ 长期（HTTP-only 探测）方案详见 [TODO.md](../../TODO.md) 的 `### 基础设施收敛` 段。

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

Real mode (`SAU_MOCK_MODE=0`) dispatches to per-platform drivers in
`login_pool.py` (扫码绑定) and `uploader.py` (视频派发) which wrap the patched
[`pokocat/social-auto-upload`](https://github.com/pokocat/social-auto-upload)
fork pinned in `pyproject.toml`.

## Supported platforms (v1)

| Platform | wire | Bind (QR) | Upload | SMS interaction |
|---|---|---|---|---|
| 抖音 | `douyin` | ✅ `DouyinDriver` | ✅ `DouYinVideo` + productLink/productTitle | ✅ `_DouyinSmsDriver` (live selectors) |
| 视频号 | `shipinhao` | ✅ `ShipinhaoDriver` | ✅ `TencentVideo` | ⚠️ `_PlaceholderSmsDriver` — no real selectors |
| 快手 | `kuaishou` | ✅ `KuaishouDriver` | ✅ `KSVideo` | ⚠️ `_PlaceholderSmsDriver` — no real selectors |
| 小红书 | `xiaohongshu` | ✅ `XiaohongshuDriver` | ✅ `XiaoHongShuVideo` | ⚠️ `_PlaceholderSmsDriver` — no real selectors |

The four `enabledInV1()=true` platforms (defined server-side in
`SocialPlatform.java`) all have full wire-up: `/login/start` returns a real
QR `<img>` src, `/login/poll` watches the platform driver's `is_logged_in`
signal, `/accounts/verify` round-trips storage_state, and `/upload` invokes
the upstream class with timeout/cancel/SMS scaffolding from
`_run_upstream_upload`.

Platforms NOT wired (`enabledInV1()=false`; server rejects with
`BUSINESS_ERROR` before dispatch):

- `bilibili` — upstream's `main.py` entry was 404 at the pinned SHA; likely
  driven via API rather than Playwright.
- `tiktok` — upstream goes through `await page.pause()` interactive login,
  incompatible with our QR-and-poll flow.
- `baijiahao` — no upstream uploader.
- `youtube` — enum stub only; upstream has no driver in the pinned tree.

## Known gaps & operator upgrade path

**SMS / 二次验证 selectors** — `interaction.py` currently has live DOM
selectors only for 抖音 (`#uc-second-verify`). Shipinhao / kuaishou /
xiaohongshu use `_PlaceholderSmsDriver`, so if a real-mode upload triggers
风控 there, the watcher won't detect the modal — the task will run out
the `SAU_UPLOAD_TIMEOUT_S` budget and fail with `UPLOAD_TIMEOUT`.

To upgrade a platform's SMS driver:

1. Launch a headed real-mode upload against the target platform
   (`./start.sh real --headed`).
2. Force trigger 风控 (sometimes by changing IP / using a fresh account).
3. Set `SAU_SMS_CAPTURE=1` — the placeholder driver's `_capture_sms_dom_if_enabled`
   helper writes sanitized DOM snapshots to
   `$TMPDIR/sau-service/sms-capture/<platform>-<ts>-<digest>.json`.
4. Inspect the snapshot, identify wrapper / phone-text / "获取验证码" /
   code-input / "确认" selectors.
5. Replace `_PlaceholderSmsDriver("<platform>")` in `SMS_DRIVERS` with a
   real subclass — `_DouyinSmsDriver` is the working template.

**QR / profile selector freshness** — All four `PlatformDriver` subclasses
in `login_pool.py` mirror upstream `pokocat/social-auto-upload` selectors
at the pinned SHA. If a platform redesigns its login or creator-center
header, the fix is in **one file, one class** — no cross-cutting changes
needed. Symptoms to watch for:

- `extract_qr_data_url` raises `<platform>: QR src not found …` →
  iframe / wrapper selector drifted; inspect element + update CSS chain.
- `extract_profile` returns null `displayName` / `platformAccountId` →
  creator-center header DOM changed; update `DISPLAY_SELECTORS` /
  `ACCOUNT_ID_SELECTORS` tuples.
- `is_logged_in` returns False after a successful scan → URL-prefix or
  login-modal selector drifted.

**Upstream class constructor drift** — Each `_upload_<platform>` catches
`TypeError` separately and surfaces `UPSTREAM_SIGNATURE_MISMATCH` so the
operator can pinpoint which upstream class needs investigating after a
pinned-SHA bump.

**Advanced fields not plumbed** — None of `category` (shipinhao),
`thumbnail_path`, `publish_strategy` (xiaohongshu's scheduled-publish),
`short_title`, or `is_draft` are forwarded from `UploadRequest` to the
upstream constructors. Default values work for the common case; plumb
on operator demand.

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
| `SAU_UPLOAD_TIMEOUT_S` | `180` | 单条 upstream `<Platform>Video.upload()` 的总超时（秒，4 平台共用）。超时强制 cancel + 推 `status=failed errorCode=UPLOAD_TIMEOUT`。防止上游 `while True` 发布按钮循环卡死。**计时暂停**：`status=awaiting_user` 期间不计入本超时，避免用户输入验证码的时间占用平台操作预算。 |
| `SAU_UPLOAD_PUBLISHING_AFTER_S` | `60` | 上传持续这么久还没返回时，推送 `status=publishing progress=80` 让 UI 区分"传字节"与"等平台发布"。纯时间启发，upstream 是 atomic 调用没法精确感知阶段切换。 |
| `SAU_INTERACTION_USER_TIMEOUT_S` | `300` | 短信验证码 / 人机交互弹窗出现后，等用户从前端提交响应的最长时长（秒）。超时则任务标 `status=failed errorCode=AWAIT_USER_TIMEOUT`，cancel 上游 upload。必须与前端 `SmsInteractionDialog.USER_INPUT_TIMEOUT_S` 同步。 |
| `SAU_INTERACTION_POLL_INTERVAL_S` | `2.0` | SMS watcher 轮询 Playwright Page 检查 SMS 弹窗的间隔（秒）。值越小用户越快看到 awaiting_user，但与上游 upload 自身的 page 操作竞争越激烈。 |

**dev 配置入口**：`.env.dev`（入仓默认值）。`start.sh` 启动前自动 `source` 这个文件；想改默认就改这里，不要硬编码到 `start.sh`。

## Tests

```bash
pip install -e '.[dev]'
pytest
```
