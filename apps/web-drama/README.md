# AI 短剧 · Drama Studio

面向 MCN 的演员类 AI 数字人 IP + 短剧工作台。Next 16.2.6 + React 19 + Tailwind v4 + pnpm workspace。

## 启动

```bash
# 在仓库根目录
pnpm install
pnpm dev:drama       # http://localhost:3011
pnpm --filter @ai-star-eco/web-drama typecheck
pnpm --filter @ai-star-eco/web-drama build
```

USE_MOCK 默认开启（无需 `.env.local`）。所有读写都走 `src/api/*.ts` 内存可变缓存，关掉浏览器后重置。

## 路由结构

不带 `/console` 前缀，公开页与工作区共存：

```
/                    ← 公开 landing
/login               ← 公开
/dashboard           ← 工作区总览
/cast                ← 演员 IP 阵容
/cast/[id]           ← 演员详情
/cast/[id]/generate  ← 形象生成
/incubator           ← 孵化新演员（多步表单 + localStorage 草稿）
/forge               ← 形象锻造炉（批量应用到演员）
/wardrobe            ← 戏服 / 道具（上传 + 分配）
/create              ← 短剧创作（v0.7 统一入口：?mode=express|pro；极速整包生成 / 专业分步流水线，逐集出片）
/topics              ← 智能选题（AI 题材推荐 + 自定义题材/人设/框架 → 带入极速模式）
/projects            ← 作品与项目（成片归集 + 状态机推进）
/projects/[id]       ← 项目详情（状态机推进）
/projects/[id]/distribute ← 多平台发布
/assets              ← 素材资产（占位，即将上线）
/distribution        ← 分发总览
/insights            ← 数据洞察（窗口 + 维度切换，URL 持久化）
/trends              ← 趋势雷达
/finance             ← 财务中心（充值 / 提现 / 流水）
/settings            ← 工作室设置（账户 + 团队）
```

`/console`、`/console/*` 通过 `src/proxy.ts` 308 重定向到新路径，下一版本删除。
`/scripts`、`/short-drama`（v0.6/v0.45 旧入口）通过 `next.config.mjs` 308 重定向到 `/create`。

## 共享组件

- `src/components/common/` — `Dialog` / `ConfirmDialog` / `FormDialog` / `Field` / `EmptyState` / `LoadingBlock` / `ErrorBlock` / `StatusBadge` / `ViewHeader` / `SectionHeader`
- `src/components/premium/` — `Button` / `Card` / `Chip` / `KpiCard` / `Meter`（Studio 纸感淡色主题）
- `src/lib/drama-query.ts` — 极轻量 client cache（`useAsync` / `usePageData` / `invalidate` / `mutate` / `clearAll`），避免引 React Query。
- 全局 Sonner toast 挂在 `app/providers.tsx`。

## Mock 数据写入层

- `api/artists.ts` / `api/film.ts` / `api/scripts.ts` / `api/distribution.ts` / `api/finance.ts` 顶部建立 mutable 副本。
- CRUD（create / patch / archive / delete / commitVersion / publishJob 等）会直接改 cache，前端列表立即反映。
- 发布任务 `createPublishJob` 启动 `setTimeout` 轮询推进，UI 自动从 queued → uploading → live。
- 真后端尚未上线，USE_MOCK=0 分支会保留 `apiFetch` 占位（507/501 后端原因）。

## 版本日志

### v0.7 · 2026-05-31 · 短剧创作动线统一 + 纸感淡色主题

- **信息架构重构**：把分工不清的「脚本工坊 `/scripts`」「短剧生成 `/short-drama`」「项目流水线 `/projects`」收敛为
  - 单一创作主线 **`/create`**（极速 / 专业双模式），
  - **作品与项目** `/projects`（成片归集 + 生命周期），
  - 新增 **智能选题** `/topics`（AI 题材推荐，原模板广场）与 **素材资产** `/assets`（占位）。
- **两套脚本合并**：结构化分镜（`DramaScript`，生成真源）为主线；长文本 + 版本树 + AI 续写并入「脚本」步的编剧室组件 `components/short-drama/script-prose-panel.tsx`（原 `scripts/[id]` 逻辑迁入，`window.confirm` 换成 `ConfirmDialog`）。`/scripts`、`/short-drama` → `/create` 308 重定向。
- **双模式只是「生成脚本的方式」不同，产物同为 `DramaScript`**：`create/_flow/`（`ModePicker` / `ExpressMode` / `ProMode` / `Stepper` / `steps/*`）共用 `useDramaDraft` 控制器（从原 `short-drama/page.tsx` 抽出）。
  - **极速**：`expressGenerate(集数)` 一次性生成完整脚本包（人物/分镜/场景，多集为同一 series）→ 剧集总览逐集「一集一任务」派发视频（`generateForEpisode`，控制器用 `jobsByScript` 多集并行轮询）。
  - **专业**：线性步进 **选题 → 角色 → 脚本（剧本=分镜不分开，`SceneEditor` 编辑 ⇄ 竖屏分镜预览 `storyboard-grid`）→ 生成 → 成片 → 审核（占位）**。
- **占位诚实**：新增 `components/common/ComingSoon.tsx`；审核 / 剪辑 / 素材中心 / 实时热度榜标「即将上线」，不造假；生成与分发链路是真的（复用 celebrity `material_video_job` 管线）。多集生成无「跨集续写」后端，逐集调草稿端点（live 各集不同 / mock 相近）。
- **纸感淡色主题**：`styles/tokens.css` 翻为淡底（参考 celebrity `[data-theme="creator"]`，保留金/琥珀 accent）+ 新增中性 token（`--surface-1/2` / `--track` / `--overlay-scrim` / `--video-letterbox`）；组件内 `rgba(255,255,255,.0x)` 暗底面全量 sweep；root `layout.tsx` 去 `dark` class、`themeColor` 改 `#f7f3ec`。
- **复用 + 零契约变更**：仅前端 IA/UX/主题；后端 `/api/me/drama/*` + `/api/me/scripts/*` 既有端点复用，openapi / contract gate 不动。typecheck + `next build`（18 页）通过。

### v0.45 · 2026-05-31 · 前后端数据对齐补齐 + 短剧「完整创作工作流」

- **数据对齐**：`USE_MOCK=0` 下补齐一批拉不到数据的页面（除数字人 `/cast`、形象锻造 `/forge`）：
  - 脚本工坊 `/scripts`（后端新建 `/api/me/scripts/**` + 版本树 + AI 续写）；
  - 项目流水线 `/projects`（`/api/film/dramas` 增删改 + 详情）；
  - 多平台分发 `/distribution`（`/api/distribution/jobs/**` 发布任务，进度模拟）；
  - 财务中心 `/finance`（`/api/me/wallet/withdraw` 提现）；
  - 短剧 / 影视 / 社区 / 分发内容等空数据源由 `DramaDemoSeeder` 种入（dev/test）。
- **短剧生成重建**为多阶段工作流：题材灵感 → AI 多稿起草 → 分场景编辑器（增删改 / 调序 / 景别·运镜·时长 / 逐镜配音开关 / 逐镜 AI 重写）→ 角色与演员绑定（接入 `/cast` 虚拟演员）→ 剧集(多集)管理 → 风格与变体生成 + 积分预估 → 生成视频 → 视频库 → 归入项目 / 去分发。
- 新组件 `components/short-drama/{scene-editor,character-panel,video-library}.tsx`；`api/short-drama.ts` 扩类型 + `rewriteScene` / `listSeriesEpisodes` / `publishToProject`。
- 详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.45。

### 2026-05-31 · 移动端浏览适配（响应式）

把 web-drama 从「桌面固定 240px 侧栏」改造为可在手机 / 平板浏览的响应式布局。**纯前端，无 API / 数据模型变更；`tsc --noEmit` 绿。**

- ✅ **工作台 shell 响应式**（`(workspace)/layout.tsx`）：`.ws-shell` 栅格在 ≤860 收起侧栏；顶栏新增汉堡按钮唤起浮层抽屉（`.ws-drawer`，点导航 / 遮罩即关 + 锁背景滚动）。
- ✅ **顶栏自适应**：≤860 隐藏全局搜索、缩小留白；≤560 折叠「/ 工作台」副标题与「新建项目」按钮文字（保留图标）。
- ✅ **内容区栅格折叠**：因本应用大量使用内联样式，用「`.ws-content` / `.public-page` 作用域 + `[style*=…]` 属性选择器 + `!important`」在 ≤1024（4 列降 2 列）/ ≤720（多列折单列）统一收口，一处覆盖全部工作台子页的内联 `gridTemplateColumns`；`auto-fill minmax` 栅格保持原生自适应不动。
- ✅ **公开落地页**（`page.tsx`）：hero 字号 / 留白改 `clamp()`，页头页脚 `flex-wrap`，卡片栅格随 `.public-page` 折叠。
- ✅ **视口元信息**（`app/layout.tsx`）：新增 `export const viewport`（`width=device-width` + `viewport-fit=cover` + 主题色）；并加 `100dvh`、`overflow-x:hidden`、`img/video max-width` 等移动端安全兜底。
- 响应式样式集中在 [`src/styles/app.css`](src/styles/app.css) 末尾「移动端适配」段；桌面端表现与改造前一致。

### v0.43 · 2026-05-29 · 短剧生成 + 形象锻造接大模型 + 平台访问隔离

- ✅ **短剧生成**（新 `/short-drama`）：脚本化表达 —— AI 起草分场景脚本（场景/分镜 shot/台词 dialogue）→ 保存 → 生成短剧视频（异步轮询回显）。后端 `/api/me/drama/*`，复用 celebrity 视频任务管线。参考 celebrity 商品视频脚本方案。
- ✅ **形象锻造**（`/forge`）：从 mock 渐变批量生成 重写为 **对话式 AI 形象顾问**（接平台大模型流式生成），与 AI 音乐人同逻辑、影院风 UI 独立；移除原 `window.prompt` 预设命名（违禁原生弹窗）。
- ✅ **登录与平台隔离**：登录页改用共享 `AuthScreen`（手机号登录/注册/体验账号三 tab）；workspace 在「账号未开通 AI 短剧」时拦截。注册透传 `platform=drama`。
- 详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.43。

### v0.6 · 2026-05-14 · 全交互化

- ✅ **路由重构**：废弃 `?tab=` query 模式，按页面切真实路由段；用 Next App Router route group `(workspace)` 共享 sidebar/topbar shell。
- ✅ **17 个 page.tsx 全部接 onClick / dialog / 路由跳转 / loading / toast**：dashboard / cast / cast/[id] / cast/[id]/generate / incubator / forge / wardrobe / scripts / scripts/[id] / projects / projects/[id] / projects/[id]/distribute / distribution / insights / trends / finance / settings。
- ✅ **核心交互流**：
  - 新增 / 归档演员（confirm dialog）；
  - 多步孵化（localStorage 草稿）；
  - 锻造炉批量应用到演员；
  - 戏服上传（FileReader 预览）+ 分配到演员；
  - 脚本工坊：新建 / 克隆 / 归档 / 导出 .fountain / AI 续写 / 提交审稿 / 通过审稿 / 版本树切换；
  - 项目状态机推进（CASTING → FILMING → POST → RELEASED）；
  - 多平台发布（带轮询 1.3s 推进进度）+ 取消 / 重试；
  - 充值 / 提现（钱包 + 流水 mock 联动）；
  - 工作室设置 + 团队邀请 / 移除。
- ✅ **基础设施**：Sonner toast、ConfirmDialog、FormDialog、EmptyState/LoadingBlock/ErrorBlock；Button 加 `loading` 防双提交；`drama-query` 轻量缓存 + invalidate。
- ✅ **/console 兼容**：`src/proxy.ts` 把旧链接 308 到新路径。
- ✅ **测试门**：`pnpm --filter @ai-star-eco/web-drama typecheck` 绿；`pnpm --filter @ai-star-eco/web-drama build` 17 个 page 全 prerender / SSR 通过。

### v0.5 · 2026-05-13 · landing + console shell（前一轮）

- 240px sidebar + topbar + 钱包异步拉取；登录 → console；premium cinematic 设计 token。
- 11 个 view 组件（CastView / IncubatorView / …）— 已在 v0.6 重写为 page.tsx + 删除原 view 文件。

## 待办

完整待办（含 D-1 ~ D-7 + 跨工程 CG-* 状态）见仓库根 [`TODO.md`](../../TODO.md) §「三子产品 web app 待办」。本 README 不再独立维护待办，避免与根 TODO 漂移。
