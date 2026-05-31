# AiAvatar 形象资产管理中心 · web-aiavatar

> AI Star Eco 第四个独立 web 子产品（Next 16 + React 19 + pnpm，port **3013**，深色琥珀主题）。
> 真人授权复刻 / 纯 AI 原创 → 打样 → 草稿迭代 → 精细化精调 → 模板美化出图 → 定稿 → 衍生 3D/视频 → 入库。
>
> 业务规格见任务书；架构 / mock 取舍 / 真实-vs-mock 能力映射见 [`DECISIONS.md`](DECISIONS.md)；
> 进度台账见 [`../../docs/AIAVATAR_PROGRESS.md`](../../docs/AIAVATAR_PROGRESS.md)。

## 技术栈

| 维度 | 选型 |
|---|---|
| 前端 | Next.js 16.2.6（App Router）+ React 19 + TypeScript |
| 样式 | **纯设计令牌（CSS 变量）+ 内联样式**（深色 + 琥珀，`src/styles/tokens.css` 从原型 1:1 移植，token 不改）。**不引 Tailwind/shadcn** —— 设计高度定制，自洽更忠实（见 DECISIONS §A2） |
| 真实算法 | MediaPipe FaceMesh 478 关键点（`@mediapipe/tasks-vision`）+ 确定性液化形变（`src/lib/face-warp.ts`）；客户端 beauty 磨皮/美白（`src/lib/beauty.ts`） |
| 数据层 | mock ↔ live 双路径（`src/api/ai-avatar.ts`），mock 引擎 `src/mocks/store.ts`（8 态状态机 + 异步任务 ticker + 版本快照） |
| 共享包 | `@ai-star-eco/types`（类型契约）+ `@ai-star-eco/api-client`（apiFetch + AuthProvider + 登录） |
| 后端 | 共享 `apps/server`（Spring Boot 3.3.5 / Java 17，port 8080），领域包 `com.aistareco.aep.aiavatar.*`，表 `aiavatar_*`，账户复用 `aep_users` |

## 启动

### dev / 演示（纯前端 mock，可离线整跑，**默认**）

```bash
pnpm install
pnpm dev:aiavatar          # http://localhost:3013
```

`.env.development` 已设 `NEXT_PUBLIC_USE_MOCK=1` —— 所有数据走 `src/mocks/store.ts` 内存引擎，
种子用 `public/seed/portrait-*.jpg`（12 张开源真人照片），**无需后端、可断网整跑全链路**。
登录页选「体验账号 → 进入工作台」即可（mock 拦截 dev-login）。

### 联调 / 生产（真实后端 server）

```bash
# 1) 起后端（H2 dev / MySQL prod）
cd apps/server && ./mvnw spring-boot:run

# 2) 起前端 live 模式（/api/* 经 next.config rewrites 代理到 :8080）
NEXT_PUBLIC_USE_MOCK=0 pnpm dev:aiavatar
```

登录走 `@ai-star-eco/api-client` 的 SMS 验证码 / 注册 / dev-login（与三端一致）。

### 校验

```bash
pnpm --filter @ai-star-eco/web-aiavatar typecheck       # 0 error
pnpm --filter @ai-star-eco/web-aiavatar build           # 17 路由编译
cd apps/web-aiavatar && pnpm test                       # 25 vitest（几何形变 13 + beauty 6 + landmark 6）
cd apps/web-aiavatar && pnpm test:e2e                   # 3 Playwright（总库种子 + 两条创建路径到归档）
```

> E2E 前置：先 `NEXT_PUBLIC_USE_MOCK=1 pnpm build && NEXT_PUBLIC_USE_MOCK=1 pnpm start`（或 `pnpm dev`）起 :3013，再 `pnpm test:e2e`。

## 路由（10 核心页面 + 6 配套模块）

| 路由 | 说明 |
|---|---|
| `/` | 已登录跳 `/library`，否则跳 `/login` |
| `/login` | 手机号验证码登录 / 注册 / 体验账号（dev）三 tab |
| `/library` | **资产总库**：卡片 / 列表 / 画廊三视图 + 搜索 + 真人/AI/含3D 筛选 + 进行中任务条 |
| `/create` | **创建选择**（STEP 01）：真人授权复刻 / 纯 AI 原创 → 建草稿 → 进入素材准备 |
| `/avatars/[id]/material` | **素材准备**（STEP 02）：真人多图上传 + InsightFace 合规 + 电子肖像授权签署；AI 人设文案 |
| `/avatars/[id]/sampling` | **打样**（STEP 03）：5 版方案，网格 / 并排 / 滑块叠加三种对比，单选进入草稿 |
| `/avatars/[id]/drafting` | **草稿迭代**（STEP 04）：自然语言指令多轮生成，每轮存版本 |
| `/avatars/[id]/studio` | **精细化精调工作台**（STEP 05）：几何（**真实 MediaPipe + 实时液化**）/ 外观 / 语言 / 局部 + 前后对比 + 三布局 + 实现方式面板 |
| `/avatars/[id]/output` | **模板美化 · 标准出图**（STEP 06）：美颜模板可叠加（**真实 canvas beauty**）+ 标准构图批量出图 |
| `/avatars/[id]/finalize` | **定稿确认**（STEP 07）：逐张确认 → 锁定版本、冻结草稿链路 |
| `/avatars/[id]/derive` | **衍生**（STEP 08）：3D（TripoSR/FLAME+3DGS）+ 视频（SVD），分任务进度，可交互预览，入库归档 |
| `/avatars/[id]` | **资产详情**：标准图集 / 3D / 视频 / 版本时间线 / 授权信息 Tab + 右信息栏 + 另存为/下载/继续编辑 |
| `/templates` | **AI 模板中心**：美颜 / 风格模板 预览 · 收藏 · 复制 |
| `/tasks` | **异步任务中心**：实时进度 + 重试 + 取消 + 批量操作 |
| `/licenses` | **真人授权管理**：跨资产授权总览 + 到期提醒 + 凭证下载 |
| `/health` | **能力健康**：每能力 mock/真实来源可观测（镜像 `GET /api/aiavatar/health/providers`） |

## mock ↔ 真实 调用路径区分（任务书 §6）

- **全局开关**：`NEXT_PUBLIC_USE_MOCK=1|0`（前端）。后端 `AiAvatarProviderRegistry` 按 `aep.aiavatar.app-mode` + 每能力 `aep.aiavatar.providers.<cap>` 选实现。
- **可观测**：`/health` 页镜像 `GET /api/aiavatar/health/providers`，逐能力显示 `mode + 引擎 + 实现类别 + healthcheck`。
- **前端可见**：右下角常驻 `DEV MOCK` / `LIVE 后端` 指示；生成结果卡片 / 任务行用 **MOCK 角标 / 引擎名** 标注来源（`SourceBadge`）。
- **几何形变 faceWarp 始终真实**（客户端 MediaPipe + 液化），即使在 mock 模式。

## 关键设计（详见 DECISIONS.md）

- **几何形变是真实算法**（§4 硬要求）：`src/lib/face-warp.ts` 浏览器 canvas 实时液化 + `src/lib/face-landmarks.ts` MediaPipe 478 关键点，检测不可用回退启发式锚点；13 vitest 守门。
- **美颜是真实算法**：`src/lib/beauty.ts` 客户端磨皮（保边 box-blur + 肤色权重）/ 美白 / 暖色 / 亮度，确定性、离线可跑；6 vitest 守门。评估过 Banuba beauty-web（需 client token，无法 keyless 运行）→ 采用本开源 canvas 路径。
- **设计 1:1 移植**：从上传原型（`数字人资产平台.html` + `app/*.jsx` + `tokens.css`）逐屏还原视觉 / 交互 / 文案 / 状态机。
- **后端能力接入**：登录（SMS / dev-login）走 `@ai-star-eco/api-client`；35+ 个 `/api/me/aiavatar/*` 端点已就绪，`NEXT_PUBLIC_USE_MOCK=0` 即切真实后端。

## 运营配置（operatorRole 门控）

侧栏「运营配置」仅平台运营（`operatorRole` 非空）可见，入口 `/config`，四区：

| 区 | 配置内容 | 后端存储 |
|---|---|---|
| Prompt 模板 | 5 个对接大模型动作的 system/user/params + 启用 + 试运行 + version 灰度 | 共享 `prompt_template`（key=`aiavatar.*`，复用 PromptService / AdminPromptController） |
| 风格 / 妆造模板 | 名称/描述/img2img prompt/样片上传/启用（CRUD） | `aiavatar_template` category=STYLE |
| 美颜模板 | 磨皮/美白/色温/亮度参数（CRUD） | `aiavatar_template` category=BEAUTY |
| 构图 / 快捷指令 | 标准构图 CRUD + 草稿/精调快捷指令 + 默认人设 + 局部重绘默认词 | `aiavatar_template` category=COMPOSITION + PlatformConfig `aiavatar.ui-config` |

改动即时对创作者生效（精调模板面板 / 草稿快捷指令 / 创建默认人设 / 出图构图）。
**dev mock 运营身份**：登录页 dev tab 勾「以平台运营身份进入」。**live** 由后端 JWT.role（OPERATOR/SUPER_ADMIN）决定，运营授权走 admin `/celebrity/operators`。

## 版本日志

- **v0.46（2026-05-31）** — 大模型对接配置化 + 内嵌运营配置能力。所有对接大模型/模板处从硬编码抽取到可配置数据层（prompt → 共享 prompt_template；风格/美颜/构图 → aiavatar_template；快捷指令/默认人设 → PlatformConfig）；新增 `/config` 运营页（operatorRole 门控）；消费屏改「配置层读 + 出厂常量兜底」。后端 mirror：PromptService +5 aiavatar.* key + 基线 .md、BackendNluProvider 抽 prompt、AiAvatarTemplateSeeder 重写为 18 工厂模板、ui-config 端点。验证：typecheck 0 / build 18 路由 / 26 vitest / 7 Playwright E2E / 后端 mvn compile 全绿。
- **v0.45.1（2026-05-31）** — 前端重建（按上传原型 1:1）。10 页面 + 6 模块；纯 CSS 令牌 + 内联样式（无 Tailwind）；mock↔live 双路径数据层 + localStorage mock 引擎；种子用 12 张开源真人照片；真实 MediaPipe 几何形变 + 真实 canvas beauty。验证：typecheck 0 error / build 17 路由 / 25 vitest / 3 Playwright E2E（两条创建路径从新建到归档）全绿。后端 aiavatar 领域（v0.45）不变。
