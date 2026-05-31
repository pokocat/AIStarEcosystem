# AiAvatar 形象资产管理中心 · web-aiavatar

> AI Star Eco 第四个独立 web 子产品（Next 16 + React 19 + Tailwind v4 + pnpm，port **3013**）。
> 真人授权复刻 / 纯 AI 原创 → 打样 → 草稿迭代 → 精调 → 模板出图 → 定稿 → 衍生 3D/视频 → 入库。
>
> 业务规格见任务书；架构 / mock 取舍见 [`DECISIONS.md`](DECISIONS.md)；进度台账见 [`../../docs/AIAVATAR_PROGRESS.md`](../../docs/AIAVATAR_PROGRESS.md)。

## 技术栈

| 维度 | 选型 |
|---|---|
| 前端 | Next.js 16.2.6（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind v4 + 自托管设计令牌（深色 + 琥珀，`src/styles/tokens.css`） |
| 状态 | React state + 轮询 hooks（`src/lib/use-job-poll.ts`） |
| 共享 | `@ai-star-eco/{types,ui,api-client,landing}`（pnpm workspace） |
| 后端 | 共享 `apps/server`（Spring Boot 3.3.5 / Java 17，port 8080），领域包 `com.aistareco.aep.aiavatar.*`，表 `aiavatar_*`，账户复用 `aep_users` |

## 启动

### dev（纯前端 mock，可离线整跑）

```bash
pnpm install
pnpm dev:aiavatar          # http://localhost:3013
```

`.env.local` 默认 `NEXT_PUBLIC_USE_MOCK=1` —— 所有数据走 `src/mocks/store.ts` 内存引擎
（8 态状态机 + 异步任务进度推进 + 版本快照 + 占位图），无需后端、可断网。
开发登录入口默认显示（`next dev`）。

### 联调 / 生产（真实后端 server + H2/MySQL）

1. 起后端：
   ```bash
   cd apps/server
   # dev（H2 内存，免密 dev-login）
   AEP_DEV_AUTH_ENABLED=true mvn spring-boot:run -Dspring-boot.run.profiles=dev
   # 或 prod（MySQL）
   mvn spring-boot:run -Dspring-boot.run.profiles=mysql
   ```
2. 起前端（live 模式）：
   ```bash
   # .env.local 设 NEXT_PUBLIC_USE_MOCK=0；联调开发登录可加 NEXT_PUBLIC_ENABLE_DEV_LOGIN=1
   NEXT_PUBLIC_USE_MOCK=0 pnpm dev:aiavatar
   ```
   前端 `/api/*`、`/static/*` 经 `next.config.mjs` rewrites 代理到 `NEXT_PUBLIC_SERVER_API_BASE`（默认 8080）。

### 校验

```bash
pnpm --filter @ai-star-eco/web-aiavatar typecheck     # 0 error
pnpm --filter @ai-star-eco/web-aiavatar build         # 11 路由编译
pnpm --filter @ai-star-eco/web-aiavatar exec vitest run   # 几何形变 7 例
```

## 页面（10 核心 + 6 模块）

| 路由 | 说明 |
|---|---|
| `/` | 公开 landing |
| `/login` | dev-login + 手机号验证码登录 |
| `/library` | **资产总库**：卡片 / 列表 / 画廊三视图 + 搜索 + 状态/含3D 筛选 + 进行中任务条 |
| `/create` | **创建选择 + 素材授权填写**：真人复刻 / AI 原创两路径分流 |
| `/avatar/[id]` | **资产详情**：图集/3D/视频/版本时间线/素材/授权/衍生 7 Tab + 7 步工作流动作区 + 实现方式面板 |
| `/refine` | **人像精调工作台**：几何（**真实实时液化**）/ 外观 / 语言 / 局部 四模式 + 前后对比 |
| `/templates` | **AI 模板中心** |
| `/licenses` | **真人授权管理**（跨资产总览） |
| `/jobs` | **异步任务中心**：实时进度 + 重试 + 取消 + 批量操作 |
| `/health` | **能力健康**：每能力 mock/真实来源可观测（镜像 `GET /api/aiavatar/health/providers`） |

打样 / 草稿迭代 / 精调-外观 / 模板美化 / 定稿 / 衍生 等动作通过详情页工作流动作区 + 对应 dialog 完成。

## Provider 模式（mock ↔ 真实，一键切换）

后端 `AiAvatarProviderRegistry` 按 `aep.aiavatar.app-mode`（mock/live）+ 每能力 `aep.aiavatar.providers.<cap>` 选实现。
前端在结果卡片 / 任务行 / 能力健康页用 **MOCK 角标 / 引擎名** 标注来源。

| 能力 | live 默认 | 配置方式 |
|---|---|---|
| `faceWarp` 几何形变 | **真实**（确定性液化，前后端同算法） | 始终真实 |
| `nlu` 人设解析 | Backend（LLM 网关） | admin 绑定 `AIAVATAR_PERSONA_PARSE` |
| `txt2img`/`faceClone`/`img2img`/`inpaint`/`makeup`/`hair`/`restore` | Backend（LLM 图像网关） | admin 绑定 `AIAVATAR_PROMPT_REWRITE` + `AIAVATAR_IMAGE_GENERATION` / `AIAVATAR_IMAGE_EDIT` / `AIAVATAR_STANDARD_SHOTS` |
| `img23d`/`img2video`/`faceDetect`/`segment` | selfhost | `AEP_AIAVATAR_PROVIDERS_<CAP>=selfhost` + `AEP_AIAVATAR_SELFHOST_BASE_URLS_<CAP>=http://...` |

详见 [`DECISIONS.md`](DECISIONS.md) §B。

## 关键设计

- **几何形变是真实算法**（任务书 §4 硬要求）：`src/lib/face-warp.ts` 浏览器 canvas 实时液化，
  与后端 `AiAvatarGeometryWarp` 同族；7 个 vitest 用例守门。
- **真人照片加密存储**：原图 AES-GCM 落 `aiavatar-assets/secure/`，UI 仅脱敏预览。
- **监控线程**（用户附加要求）：后端 `AiAvatarJobWatchdog` 每小时巡检，异常中断的任务自动续跑（有重试上限）。
- **禁用浏览器原生 confirm/alert**：用 `useConfirm()`（`src/components/common/confirm-dialog.tsx`）。

## 版本日志

- **v0.1（2026-05-30）** — 首版交付。后端 aiavatar 领域（8 实体 / 13 能力 Provider / 监控线程 / 6 控制器）+
  前端 10 页面 6 模块 + 共享类型 `ai-avatar.ts`。测试：后端 40 例 + 前端 7 例全绿；
  H2 + MySQL 双 profile E2E 通过。
