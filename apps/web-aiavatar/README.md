# AiAvatar 形象资产管理中心 · web-aiavatar

> AI Star Eco 第四个独立 web 子产品（Next 16 + React 19 + Tailwind v4 + pnpm，port **3013**）。
> 真人授权复刻 / 纯 AI 原创 → 打样 → 草稿迭代 → 精调 → 模板出图 → 定稿 → 衍生 3D/视频 → 入库。
>
> 业务规格见任务书；架构 / mock 取舍见 [`DECISIONS.md`](DECISIONS.md)；进度台账见 [`../../docs/AIAVATAR_PROGRESS.md`](../../docs/AIAVATAR_PROGRESS.md)。

## 技术栈

| 维度 | 选型 |
|---|---|
| 前端 | Next.js 16.2.6（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind v4 + 自托管设计令牌（**精致浅色工作台 · 冷调中性 + 克制琥珀**，`src/styles/tokens.css` + `src/styles/app.css` 组件原语） |
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
| `/library` | **资产库**（IA 主线的家）：卡片 / 列表 / 画廊三视图 + 搜索 + 状态/含3D 筛选 + 进行中任务条 |
| `/create` | **新建**：真人复刻 / AI 原创两路径分流 |
| `/avatar/[id]` | **资产详情**（单个 AiAvatar 的生产工作台）：链路 + **当前阶段行动区（下一步主操作置为焦点，衍生内嵌）** + 3 个检视标签（产出 / 版本时间线 / 输入与授权） |
| `/refine` | **人像精调工作台**：几何（**真实实时液化**）/ 外观 / 语言 / 局部 四模式 + 前后对比 |
| `/templates` | **模板库**（配套工具，导航降一级） |
| `/licenses` | **授权总览**（跨资产只读汇总，配套工具） |
| `/jobs` | **任务中心**：实时进度 + 重试 + 取消 + 批量操作 |
| `/health` | **能力状态**：每能力 mock/真实来源可观测（镜像 `GET /api/aiavatar/health/providers`） |

导航分两层：**主线**（资产库 + 新建 CTA）+ **工具**（任务 / 模板 / 授权 / 能力，视觉降一级）。
打样 / 草稿迭代 / 精调 / 模板美化 / 定稿 / 衍生 等动作从资产详情页「当前阶段」行动区 + 对应 dialog 完成。

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

- **v0.2（2026-06-01）— 前端整体重设计（精致浅色工作台 + IA 主线重整）**。仅 web-aiavatar 改动，
  后端 / API 契约 / `packages/types` / openapi 零变化。
  - **视觉系统**：`tokens.css` 重写为冷调中性浅色 + 克制琥珀（琥珀只用于主操作 / 当前选中 / 当前链路步 / 品牌标识）；
    状态色与品牌解耦（蓝=进行中 · 绿=完成 · 橙=待处理 · 红=失败 · 灰=草稿/归档）。`app.css` 新增一套统一组件原语
    （`.btn` / `.aa-input` / `.chip` / `.seg` / `.aa-card` / `.src-badge` / `.ph` / `.meta`），删除旧"深色 utility 再覆盖"
    的脆弱重映射层；`data-theme` 由 `aiavatar-dark` 更名为 `aiavatar`。
  - **IA 主线重整**（解决"页面/状态机/tab 太多、找不到主线"）：导航由 3 组 7 项收敛为两层（主线：资产库 + 新建；
    工具：任务 / 模板 / 授权 / 能力）；资产详情由 7 个并列 Tab 重构为「**当前阶段行动区**（下一步主操作为焦点，
    衍生内嵌）+ 3 检视标签（产出 / 版本 / 输入与授权）」。
  - **去 AI-demo 化**（贴合 PRODUCT.md「安静高级、专业」）：去掉满屏琥珀辉光、对角斜纹占位图、当装饰的等宽字体；
    MOCK 角标改安静中性，REAL 用语义绿；landing 改影像优先；修复 license 表单内联深色 hex 与 `alert()`（改内联报错）。
  - 校验：`pnpm --filter @ai-star-eco/web-aiavatar typecheck` + `build`（11 路由）全绿；Chromium 实截图核验
    桌面 + 移动端全部页面。
- **v0.1（2026-05-30）** — 首版交付。后端 aiavatar 领域（8 实体 / 13 能力 Provider / 监控线程 / 6 控制器）+
  前端 10 页面 6 模块 + 共享类型 `ai-avatar.ts`。测试：后端 40 例 + 前端 7 例全绿；
  H2 + MySQL 双 profile E2E 通过。
