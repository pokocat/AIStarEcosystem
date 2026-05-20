# sau-service real-mode runbook

Default sau-service runs with `SAU_MOCK_MODE=1` and a synthetic uploader, which
is what apps/server's automated integration tests rely on. This document walks
through enabling the real Playwright path on top of the patched
[pokocat/social-auto-upload](https://github.com/pokocat/social-auto-upload) fork.

v1 ships real-mode for **抖音 (douyin)** and **视频号 (shipinhao)**. The other
v1-enabled platforms (`kuaishou`, `xiaohongshu`) return `PLATFORM_REAL_NOT_WIRED`
on `/login/start` and `/upload` until their selectors are validated against
real accounts.

| 平台 | 真实登录 (QR) | 真实上传 | verify | 备注 |
| --- | --- | --- | --- | --- |
| douyin | ✅ | ✅ | ✅ | creator.douyin.com；进入 `/creator-micro` 视为登录成功 |
| shipinhao | ✅ | ✅ | ✅ | channels.weixin.qq.com；QR 在 open.weixin.qq.com iframe；进入 `/platform` 视为登录成功；上传走 `uploader.tencent_uploader.main.TencentVideo` |
| kuaishou | ⏳ | ⏳ | ⏳ | 待 selectors 验证 |
| xiaohongshu | ⏳ | ⏳ | ⏳ | 待 selectors 验证 |

---

## 1. 本地开发：直接 venv 跑（推荐）

本地调试不要走 Docker —— 镜像构建慢、改一行代码要 rebuild、headed chromium 看不见。venv 直跑：

### 1.1 一次性准备

```bash
cd apps/sau-service

# venv（如果还没有）
python3.11 -m venv .venv
.venv/bin/pip install --upgrade pip

# 装运行时依赖 + 真实模式 extra（包括 patchright + 上游 fork）
.venv/bin/pip install -e ".[real,dev]"

# 关键：装 patchright 自带的 patched chromium（约 200MB，下到 ~/.cache/ms-playwright/）
.venv/bin/patchright install chromium
```

> **为什么不用本地系统 Chrome**：patchright 反检测靠的是改过的 chromium binary（隐藏 `navigator.webdriver`、CDP fingerprint 等）。系统 Chrome 没打 patch，登录抖音/视频号会被识别为自动化触发风控。这是 ~200MB 的一次性下载（vs Docker 镜像 ~1.5GB）。

### 1.2 起 sau-service 真实模式

```bash
cd apps/sau-service
SAU_MOCK_MODE=0 \
SAU_INTERNAL_SECRET=aep-dev-internal-secret-change-in-prod \
SAU_REAL_LOGIN_HEADLESS=0 \
.venv/bin/sau-service
```

| env | 作用 |
| --- | --- |
| `SAU_MOCK_MODE=0` | 关 mock，走 patchright |
| `SAU_INTERNAL_SECRET` | 必须和 server 的 `AEP_INTERNAL_SECRET` 完全一致（默认值就匹配） |
| `SAU_REAL_LOGIN_HEADLESS=0` | **本地调试推荐 0** —— chromium 弹窗你能直接看到登录页 / 上传页的实时状态。CI / 生产保持默认 1 |

### 1.3 起 Spring Boot 和前端（**和 mock 模式一样**）

real-mode 切换对 server 完全透明，server 启动命令不变：

```bash
# 终端 2
cd apps/server
./mvnw spring-boot:run   # 或 mvn spring-boot:run，端口 8080

# 终端 3
cd <repo-root>
pnpm dev:celebrity        # web-celebrity 在 :3012
```

### 1.4 sanity check

```bash
# sau-service 应该报 mockMode:false
curl -fsS -H "X-Internal-Secret: aep-dev-internal-secret-change-in-prod" \
  http://localhost:8090/healthz
# → {"ok":true,"mockMode":false,"version":"0.1.0"}

# server 健康
curl -fsS http://localhost:8080/api/auth/dev-accounts | head -c 200
```

打开 http://localhost:3012 → 登录 → `/distribution` → 点 "绑定账号" → 选抖音 → 看 chromium 弹出 creator.douyin.com → 拿手机抖音 App 扫码 → 回到 UI 看账号状态翻成 active。

---

## 2. 用 UI 走全链路

sau-service 接管 QR 登录：用户在 `/distribution` 点 "绑定账号" → server 调 sau `/login/start` → sau 起 patchright chromium 加载 `creator.douyin.com` → 截 QR PNG 返回 → 前端展示 → 用户扫码 → sau `/login/poll` 监测 `page.url` 跳到 `/creator-micro` 等 fragment → 收 `context.storage_state()` + 清洁 `profile`（昵称 / 抖音号 / 头像），关 chromium。

| 步骤 | UI 操作 | 预期 |
|---|---|---|
| 1 | 登录 `/distribution` → 点 "绑定账号" → 抖音 → 输入别名 → 确认 | 弹出 QR 图（chromium 截图） |
| 2 | 手机抖音 App 扫码确认 | UI 轮询 2-3 次 → status `active` → 账号出现在 `已绑定账号`，并显示能抓到的昵称 / 抖音号 / 头像 |
| 3 | 进任意项目 → 点 "批量分发" → 选视频 / 平台 / 账号 → 创建任务 | 跳到 `/distribution`，看到 queued 行 |
| 4 | 点 ▶ 开始 | 扣 20 积分；状态 queued → uploading → publishing → live；如果开了 headless=0 能看到 chromium 在真实抖音上传页操作 |
| 5（可选）| 点账号行的 "验证" 按钮 | 调 `/me/social-accounts/{id}/verify`；cookie 还在则 status 留 active + lastVerifiedAt 更新；失效则翻 expired |

### 2.1 运维 tunables

| var | default | 含义 |
| --- | --- | --- |
| `SAU_LOGIN_TICKET_TTL_S` | `300` | 单 QR session 寿命；过期 chromium 自动 teardown |
| `SAU_REAL_LOGIN_HEADLESS` | `1` | 本地调试翻 `0` 看 chromium |
| `SAU_MAX_CONCURRENCY` | `2` | 同时上传任务数；chromium 内存 ~600MB / 实例，按机器算 |
| `SAU_DEFAULT_UPLOAD_COST` | `20` | server 侧每个 publish-job 扣多少积分 |
| `SAU_UPLOAD_TIMEOUT_S` | `180` | 单条 `DouYinVideo.upload()` / `TencentVideo.upload()` 总超时（秒）。上游发布按钮循环是 `while True`，没有保护，平台 selector 失效会卡死整个任务 — 这个超时强制 cancel + 标 FAILED。 |
| `SAU_UPLOAD_PUBLISHING_AFTER_S` | `60` | upload 持续这么久还没返回 → 推 `status=publishing progress=80`，让 UI 区分"传字节"与"等平台审核/发布"。 |

QR 只在 `/login/start` 截一次。用户扫太慢 → 页面侧 QR 过期 → 重新点 "绑定账号" 拿新 session。

---

## 3. 生产部署（Docker）

本地 venv 是开发流；生产 / CI 用容器隔离的话用 Docker。

```bash
cd apps/sau-service

# 一次性构建（约 10-20min，镜像 ~1.5GB；不带 INSTALL_REAL 就是 250MB mock-only 镜像）
docker build --build-arg INSTALL_REAL=1 -t aistareco/sau-service:real .

# 跑
docker run -d --name sau-real \
  -p 8090:8090 \
  --tmpfs /dev/shm:rw,size=2g \
  -e SAU_INTERNAL_SECRET="$AEP_INTERNAL_SECRET" \
  -e SAU_MOCK_MODE=0 \
  aistareco/sau-service:real

# 健康
docker logs sau-real | tail
curl -fsS -H "X-Internal-Secret: $AEP_INTERNAL_SECRET" http://localhost:8090/healthz
```

容器和宿主机 server 通信时注意 callback URL：
```bash
# server 侧（不论 native 还是 docker）
export SAU_CALLBACK_BASE_URL=http://host.docker.internal:8080/api/internal/sau
# 否则容器里的 localhost ≠ 宿主机，sau 回调不到 server
```

镜像构建路径（`apps/sau-service/Dockerfile`）：
- `INSTALL_REAL=1` → 拉 patchright + pinned upstream fork + `patchright install chromium`
- 不传或 `=0` → 只装 FastAPI + httpx 等核心，mock-only

升级上游 SHA：编辑 `pyproject.toml` → `[project.optional-dependencies].real` →
`social-auto-upload @ git+...@<SHA>`。
当前 pin：`721476f7b49c2c8c4625ea9b053745b89138d5d8` (main as of 2026-05-17)。

---

## 4. 手工导入 cookie（快手 / 小红书 fallback）

`kuaishou` / `xiaohongshu` 仍返回 `PLATFORM_REAL_LOGIN_NOT_WIRED`。绑这两个平台的账号，目前只能：

### 4.1 用上游脚本拿 storage_state

```bash
# 在 sau-service venv 里（已装 [real]）
cd apps/sau-service
.venv/bin/python -c "
import asyncio
from uploader.ks_uploader.main import ks_cookie_gen   # 名字按 fork 实际为准
asyncio.run(ks_cookie_gen('/tmp/ks-team1.json'))
"
# 弹出 chromium，扫码，保存到 /tmp/ks-team1.json
```

> 上述类名 / 函数名按 fork 实际为准。upstream `pokocat/social-auto-upload` 通常有 `uploader.ks_uploader.main.cookie_auth / ks_cookie_gen`、`uploader.xhs_uploader.main.*`。运行前 `python -c "from uploader.ks_uploader import main; print(dir(main))"` 看一眼实际导出。

### 4.2 把 cookie 加密入库

后端目前没有 admin 导入端点（**TODO**），暂时手工写 SQL：

```bash
# apps/server/，AEP_SECRET_KEY 必须与运行中 server 一致
mvn -q exec:java \
  -Dexec.mainClass=com.aistareco.tools.EncryptStorageState \
  -Dexec.args="/tmp/ks-team1.json"
# 输出 base64 ciphertext
```

(That helper main class doesn't ship yet — paste the one-liner from
`apps/server/src/main/java/com/aistareco/common/AepCryptoUtil.java`'s
`encrypt(String)` into a scratch class until the admin tool lands.)

INSERT 到 DB：

```sql
INSERT INTO aep_social_accounts
    (id, user_id, platform, account_name, status,
     display_name, avatar_url, storage_state_encrypted,
     bound_at, last_verified_at, created_at, updated_at)
VALUES
    ('sa-' || lower(hex(randomblob(8))),
     '<aep_users.id of the owner>',
     'KUAISHOU',
     'producer-team-1',
     'ACTIVE',
     '团队主号 (manual import)',
     NULL,
     '<base64 ciphertext from above>',
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

H2 console（dev profile）直接接受。MySQL prod 把 `randomblob` 换 `UUID()`、`CURRENT_TIMESTAMP` 换 `NOW()`。

---

## 5. End-to-end smoke（curl 版，跳过 UI）

```bash
# server :8080，sau-service :8090 (mock_mode=0)
JWT="<jwt-for-owner>"
H="Authorization: Bearer $JWT"

# 5.1 列已绑定账号
curl -fsS -H "$H" http://localhost:8080/api/me/social-accounts
# → 数组，含目标账号 status=active

# 5.2 验证 cookie（本会话刚接通的 verify 真实模式）
curl -fsS -X POST -H "$H" \
  http://localhost:8080/api/me/social-accounts/<id>/verify
# → cookie 还活的话 status 留 active + lastVerifiedAt 更新；失效则 status=expired

# 5.3 创建发布任务
curl -fsS -X POST -H "$H" -H "Content-Type: application/json" \
  -d '{
    "projectId": "<existing-celebrity-project-id>",
    "videoUrl": "https://<your-cdn>/video.mp4",
    "title": "测试发布",
    "description": "sau real-mode smoke",
    "tags": ["test"],
    "targets": [{"platform":"douyin","socialAccountId":"<id>"}]
  }' \
  http://localhost:8080/api/me/publish-jobs

# 5.4 启动（扣 20 积分）
curl -fsS -X POST -H "$H" http://localhost:8080/api/me/publish-jobs/<jobId>/start

# 5.5 观察
watch -n 2 "curl -fsS -H '$H' http://localhost:8080/api/me/publish-jobs/<jobId>"
```

`/dev/shm` 或 sau-service 进程的 `SAU_TMPFS_DIR`（默认 `/dev/shm`）在 venv 模式下也用同一路径 —— 任务期间存 video + state.json，完成后 unlink。

---

## 6. What still needs work (Phase B)

- `kuaishou`, `xiaohongshu` upstream wrappers — both upload
  (`_upload_<platform>` in `uploader.py`) and login (`LOGIN_PAGE_URLS` +
  `LOGGED_IN_URL_FRAGMENTS` + `QR_SELECTORS` entries in `login_pool.py`).
- 视频号 "作品分类" (category) field: `_upload_shipinhao` currently passes
  `category=None`, which works for general accounts but accounts enrolled
  in 商品橱窗 / 知识付费 require an explicit category. If we see
  `CATEGORY_REQUIRED` in upstream errors, add a field on `UploadRequest`
  and pipe it through.
- Admin endpoint to import a storage_state without raw SQL (replaces §4.2).
- Per-platform pricing via `PlatformConfig`; v1 hardcodes 20 credits per
  upload in `apps/server/src/main/resources/application.yml` (`sau.default-upload-cost`).
- Scheduled cron-style verify sweep: server-side `@Scheduled` job that
  calls `/accounts/verify` on every `active` account daily and emails
  the owner before a cookie actually dies.
