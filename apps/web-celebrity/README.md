# AI 明星带货 · Celebrity Studio

基于真人明星授权的 AI 复刻 IP 带货平台。Next 16.2.6 + React 19 + Tailwind v4 + pnpm workspace。

## 启动

```bash
# 在仓库根目录
pnpm install
pnpm dev:celebrity   # http://localhost:3012
pnpm --filter @ai-star-eco/web-celebrity typecheck
pnpm --filter @ai-star-eco/web-celebrity build
```

USE_MOCK 默认开启（`@ai-star-eco/api-client` 导出的 `USE_MOCK` 读 `NEXT_PUBLIC_USE_MOCK`，无 `.env.local` 时按 mock 走）。所有 `src/api/*.ts` 在 mock 模式下命中本地数据；real 模式走 `apiFetch` → Next rewrites → `apps/server:8080`。

## 路由结构

不带 `/console` 前缀，公开页与工作区共存。包含三个动态段（`star/[starId]`、`star/[starId]/apply|generate`、`projects/[projectId]`）：

```
/                          ← 公开 landing（ProductLanding + postLoginPath="/dashboard"）
/login                     ← 公开
/dashboard                 ← 今日总览
/market                    ← 明星市场（CelebrityMarket + CelebrityMarketHero + 盲盒 / 模板 gallery）
/cast                      ← 我的明星（已授权艺人卡片墙）
/star/[starId]             ← 明星详情（CelebrityStarDetail，授权状态护卫）
/star/[starId]/apply       ← 授权申请表单（CelebrityApplyForm，STAR_DETAIL_MAP 查询 + notFound）
/star/[starId]/generate    ← 生成工作区（CelebrityGenerationWorkspace，未授权 redirect 回详情页）
/projects                  ← 项目流水线（CelebrityMyProjects + NewProjectDialog）
/projects/[projectId]      ← 项目详情（CelebrityProjectDetail，状态机推进）
/products                  ← 商品库（CelebrityProductLibrary + ProductFormDialog）
/library                   ← 视频中心（CelebrityVideoLibrary + 水印 / 缩略图组件）
/data                      ← 数据中心（CelebrityDataCenter）
/mixcut                    ← 混剪专区首页（KPI + 热门模板 + 最近任务）
/mixcut/templates          ← 模板库（含筛选 / 搜索）
/mixcut/templates/[id]     ← 模板详情（slot schema + 扰动变体预览）
/mixcut/create/[id]        ← 新建渲染任务（slot 填充 + 扰动 profile + 变体数）
/mixcut/jobs               ← 渲染任务列表
/mixcut/jobs/[id]          ← 任务详情（进度 / 产出 / 槽位绑定 / 扰动详情 / 水印追溯）
/mixcut/library            ← 素材库（明星 / 商品 / 贴图 / BGM 四 tab）
```

`/console`、`/console?tab=xxx`、`/console/*` 通过 `src/proxy.ts` 308 重定向：
- 旧 tab id（market / cast / projects / products / library / data）→ 对应顶层路径
- 详情页 `/console/star/<id>` → `/star/<id>`、`/console/projects/<id>` → `/projects/<id>`
- 透传其它 query（如 `?tier=trial`、`?action=distribute`）

下一版本（无残留旧书签时）删除。

## 共享组件

- `src/components/celebrity-zone/` — 33 个工作台主组件（从 `apps/web/src/components/celebrity-zone/` Phase 4b 迁入）：`CelebrityMarket` / `CelebrityStarDetail` / `CelebrityApplyForm` / `CelebrityGenerationWorkspace` / `CelebrityProjectDetail` / `CelebrityProductLibrary` / `CelebrityVideoLibrary` / `CelebrityDataCenter` / `CelebrityWatermarkVideo` / `CelebrityHeroCta` / `CelebrityAuthBanner` / `CelebrityPricingTierCard` / `CelebrityTemplateGallery` 等。
- `src/components/mixcut-zone/` — 混剪专区（v0.7 从独立项目 `mixcut/frontend/` 内嵌）：`template-preview.tsx` / `slot-input.tsx` 两个业务组件 + `ui/` 下 12 个 shadcn 原语 + `lib/utils.ts` + `types.ts`。独立一份 UI，避免与 celebrity-zone 共用 `@ai-star-eco/ui` 时的样式漂移。
- `src/components/creator/` — 设计原语：`Button` / `GradientBlock` 等（系统化 inline style，多层 gradient 叠加）。
- `src/components/console/` — `(workspace)/layout.tsx` 引用的 sidebar + topbar shell（`CelebrityShellProvider`，复用 `useAuth` 的 logout / wallet）。
- `@ai-star-eco/ui`（共享包）— 48 个 shadcn 原语 + `ThemeProvider` + Tailwind v4 globals.css。字体使用 `public/fonts` 下的自托管 woff2，避免依赖 Google Fonts。
- `@ai-star-eco/api-client`（共享包）— `apiFetch` / `AuthProvider` / `USE_MOCK` / `mockDelay`，token 仍 localStorage（cookie SSO TODO 见 `packages/api-client/src/_client.ts`）。

`(workspace)/layout.tsx` 提供独立 shell（`CelebrityShellProvider`）；登录态由 `app/providers.tsx` 的 `AuthProvider` 承担（`publicPrefixes=["/","/login","/activate"]`，`loginPath="/login"`，`"/"` exact-match）；landing CTA 通过 `ProductLanding.postLoginPath="/dashboard"` 让登录后落到工作台。

## Mock 数据写入层

- `src/api/_client.ts` 重导出 `USE_MOCK` / `mockDelay`，业务 api/*.ts 顶部分支：`if (USE_MOCK) { ... } else { return apiFetch(...) }`。
- `src/api/celebrity-zone.ts` — 13 个函数已铺 USE_MOCK switch（市场 / 我的明星 / 项目 / 视频 / 数据中心 / 授权申请 / 生成 job）。
- `src/api/products.ts` — 商品 CRUD（USE_MOCK 走本地可变缓存）。
- `src/api/mixcut.ts` — 混剪专区：`listJobs / getJob / createJob / updateJobProgress` + `hasSeenIntro / setSeenIntro`。USE_MOCK 走 localStorage write-through，key：`aistareco.web.mixcut.jobs.v1` / `aistareco.web.mixcut.has-seen-intro.v1`。
- 真后端尚未上线，USE_MOCK=0 分支保留 `apiFetch` 占位（507/501 后端原因）。

## 版本日志

### v0.55 · 2026-06-07 · 运营内嵌管理「明星」+「混剪工厂模板」

- **背景**：运营角色（`operatorRole`）此前在 web-celebrity 只对**商品库**有内嵌写权限（v0.31），但无法编辑明星、也无法编辑/删除工厂模板。本版把同一套 `canUseOperatorTools(role)` 门控扩展到明星与混剪工厂模板。
- **角色判定集中化**：新增 [`src/lib/operator-role.ts`](src/lib/operator-role.ts) 的 `canUseOperatorTools(role)`（`"operator" | "super_admin"` → true），并回填到既有所有 `!!user?.operatorRole` 判断点（商品库 / 商品详情 / 素材提卖点 / 视频库删除等）。
- **明星（全 CRUD，纯前端）**：`api/celebrity-zone.ts` +`createStar/updateStar/deleteStar/uploadCelebrityImage`（URL → `/admin/celebrity/*`，server `hasAnyRole` 兜底，后端无改动）。新 [`StarFormDialog`](src/components/celebrity-zone/StarFormDialog.tsx)（移植自 admin + 图片上传）。`CelebrityMarket`「新增明星」、`CelebrityStarCard` 封面覆盖「编辑/删除」、`CelebrityStarDetail` header「编辑/删除」，删除走 `useConfirm`。普通用户只读。
- **混剪工厂模板（前端 + 后端）**：运营「保存=就地写工厂模板（全员可见）」、可删工厂模板；走 `api/mixcut.ts` 的 `saveFactoryTemplate/deleteFactoryTemplate`（→ `/admin/mixcut/templates`，server 新 `AdminMixcutTemplateController`）。模板新建/编辑/删除入口统一 `canManageTemplates` 门控；普通用户仅浏览 + 用模板创建任务。USE_LOCAL 用 localStorage「已删 id 集合」模拟「删了全员看不到」。
- 详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.55。

### v0.45 · 2026-05-30 · 移动端 H5（自适应 shell + 全页响应式 + 编辑器降级，Phase 1–4）

- **背景**：工作台是桌面优先 —— `(workspace)/layout.tsx` 写死 `gridTemplateColumns: "220px 1fr"` 固定栅格 + 220px 侧栏 + ⌘K 搜索；大量页面用内联 style 的固定多列栅格（`repeat(4/5,1fr)`、`1.4fr 1fr`、账本 `150px 120px 1fr 120px 110px`），在手机上溢出/挤压，基本不可用。
- **方案（同一 app 自适应改造，零后端/契约改动）**：业务逻辑已与表现解耦（数据走 `@ai-star-eco/api-client` namespace API + `AuthProvider`），移动化只换一层表现。用 `useIsMobile()`（`@ai-star-eco/ui/ui/use-mobile`，768 断点）在窄屏切换到移动 shell，桌面 220px 栅格分支原样保留。
- **P1 移动 shell**：新增 [`components/creator/MobileShell.tsx`](src/components/creator/MobileShell.tsx) —— 精简顶栏（iP 标 + 当前页标题 + 钱包 chip + 头像）+ 固定**底部 Tab Bar**（今日 / 市场 / 混剪 / 分发 / 更多）+「更多」打开左侧 `Sheet` 抽屉。抽屉**直接复用桌面 `creator/Sidebar`**，把 layout 已算好的 `buildGroups()` 原样喂入（导航数据零重复），点链接冒泡自动收起。顶/底含 `env(safe-area-inset-*)` 安全区。
- **P0 响应式地基**：`app/layout.tsx` 加 `viewport`（`width=device-width, viewport-fit=cover`）+ `theme-color`；`styles/app.css` 加 `.stack-mobile` / `.stack-mobile-2` 工具类 —— `!important` 仅在 <768px 覆盖内联 `gridTemplateColumns`（带 `!important` 的作者样式优先级高于不带 `!important` 的内联声明），把多列塌成 1 / 2 列，**桌面端一字不改**。
- **P2 全页响应式（约 24 文件）**：`/dashboard`、`/wallet`（账本表格→横向滚动）、公开 landing（hero/案例/主线/能力/合规多栏塌列 + 顶栏导航 `hidden md:flex`）；组件层 `celebrity-zone`（6）/ `material-ops`（9，含 ScriptLibrary/LoopScreen 固定列表格→`overflow-x` 横滚）/ `distribution`（3）/ `mixcut-zone`（1）统一：内联栅格挂 `stack-mobile*`、Tailwind 网格改 mobile-first（`grid-cols-2 md:grid-cols-4` 等保桌面列数）、固定宽弹窗/抽屉加 `max-w-[95vw]`、密集表格包横滚、`space-between` 头部 `flex-wrap`。
- **P3 中等页**：`/mixcut/create/[id]`（主双栏已 `grid-cols-1 lg:grid-cols-[440px_1fr]`，移动单列）、`/mixcut/jobs/[id]`（进度步骤 `grid-cols-2 sm:grid-cols-4`，产出表已在 `overflow-x-auto`）。
- **P4 重型编辑器（移动「查看 + 轻编辑」）**：`template-detail-client.tsx` 主双栏已 `grid-cols-1` 基（移动单列），编辑态加 `md:hidden` 提示「画布精排建议桌面」；`WorkshopScreen.tsx` 双栏（`minmax(0,1fr) 320px`）+ block 双栏 + 商品头挂 `stack-mobile`，Agent/校验面板落到编辑器下方。
- **不在本期**：P5 PWA（安装）+ Web Push（生成完成 / 待审核 / 分发结果）；模板画布拖拽定位 slot 的移动重交互。
- **验证**：`typecheck` + `build` 全绿（36 路由）；产物 CSS 确含 `@media (max-width:767px){.stack-mobile{grid-template-columns:1fr!important}…}`，预渲染 HTML（dashboard/index/wallet）已带 `stack-mobile*` 类，viewport/theme-color meta 入 head，dev server `✓ Ready`。移动 shell SSR/首屏走桌面分支（`useIsMobile` 初值 false，hydration 一致），挂载后切移动，无 mismatch。交互式真机视口验证需在浏览器 DevTools 设备模式 / 真机进行。

### v0.44 · 2026-05-30 · 三类成片视频聚合进一级「视频库」(/library)

- **背景**：「看成片视频」的入口散在三处、数据模型各异，用户找视频要在多个菜单间跳：视频中心 `/library`（明星项目成片 `CelebrityProjectVideo`）、混剪·我的视频 `/mixcut/library?tab=videos`（混剪成片 `RenderOutput`）、商品素材库 `/material/assets`（脚本派生带货视频 `MaterialVideo`）。
- **方案**：把三类**成片**聚合进现有左侧一级入口「视频库」(`/library`)，顶层「来源 Tab」区分（明星视频 / 脚本视频 / 混剪成片），URL `?source=project|material|mixcut` 软同步，默认 `project`。**全部只读浏览**；三类数据各读各的现有 API，不融合数据模型。纯前端信息架构重组，**不动** server / api 调用层 / `packages/types` / openapi。
- **来源 Tab body**：
  - 明星视频 → 复用 `CelebrityVideoLibrary`（零改动），数据加载移入壳内 `ProjectVideosTab`。
  - 脚本视频 → 新 `components/celebrity-zone/ScriptVideosTab.tsx`：只读聚合 `MaterialOpsApi.listVideos()`，渲染中 3s 轮询；卡片点击跳 `/material/assets`（带 `?product=`）到商品素材库做派生 / 详情 / AI 提卖点。
  - 混剪成片 → 新 `components/mixcut-zone/MixcutOutputsTab.tsx`：从原 `MyVideosTab` 抽只读版，保留「第 N 条」「已分发 ×N」徽标 + 搜索，**去掉软删按钮**（删除迁回混剪任务详情页；后端 `DELETE /mixcut/outputs/{id}` 端点保留）。
  - 仅渲染当前 active 来源，避免首屏同时打三套接口。
- **混剪专区瘦身**：`/mixcut/library` 删「我的视频」tab，剩「我的素材 / 商品素材 / 官方明星片段」三素材 tab；标题改「混剪素材库」+ 加「前往视频库 →」链接；`?tab=videos` 旧深链 `router.replace("/library?source=mixcut")` 兼容。
- **生产功能与原始素材保留不动**：素材运营→脚本工坊 / **商品素材库**(`/material/assets`，含全部派生 / 详情 / AI 提卖点) / 混剪素材，各归原菜单。
- **导航**：侧栏「制作」组「视频中心」→ 改名「视频库」、去 `badge:4`；面包屑同步。`DistributeWorkbench` 右栏「视频库」超链 → `/library?source=mixcut`。

### v0.42 · 2026-05-29 · 素材运营带货视频生成接真后端 + 脚本预览修复

- **脚本预览关联商品修复**：`/material/workshop/{id}` 预览 / 编辑页之前用 `MATERIAL_PRODUCTS.find(...) ?? MATERIAL_PRODUCTS[0]` 兜底，选了非 6 个内置商品时显示成 `MATERIAL_PRODUCTS[0]`（错商品）。`api/material-ops.ts` 新增 `resolveProductForScript` / `resolveProductById`，按 `product_id` 查全量商品库（`ProductsApi.getProduct` → `toMaterialProduct`），查不到给中性占位；preview-client / editor-client / ProductMaterial 派生入口均改走它。
- **基线生成直给**（issue 2）：`VideoGenDialog` baseline 模式去掉 6 轴 + 18 项参数，改「脚本+商品摘要 + 一句话补充要求 + 生成」直接生成；画面维度 6 轴选项移到**派生**时（`DeriveVariablesPanel` 折叠「画面维度」区）。
- **派生接真后端 + 轮询**（issue 3）：派生面板进入不再自动跑 AI（改「AI 识别变量」按钮 + 可重新识别）；「生成 N 条」= 真实提交 `POST /material/videos/generate`（不再 mock 进度动画）→ generating 阶段轮询每个任务、出片内嵌 `<video>` 播放 + 支持「重新生成」。任务也进素材库（库 3s 轮询），关弹窗不影响。
- `api/material-ops.ts` +`submitVideoJobs` / `getVideoJob` / `listVideoJobs`；`listVideos`（live）合并真实任务卡。`lib.ts` +`buildVideoPrompt` / `buildJobRequests`。`types.ts` MaterialVideo +`video_url`/`thumbnail_url`/`error_message`；+`VideoGenJobRequest`。
- **配置**：视频大模型 token 在后台「AI 模型」页配（用途「视频生成」），不在前端 / env 配 token。未配前端会显示「未配置」明确错误。详见 [`AGENTS.md`](../../AGENTS.md) §v0.42。

### v0.41 · 2026-05-29 · 素材库改为视频为主（商品作筛选）+ 对齐商品库 + 修复弹窗卡死

**A. 商品素材库 IA 重构：视频为主，商品降级为筛选条件**

- **改动**：`ProductMaterial` 从「左商品目录 → 下钻看该商品视频」改为**全局历史视频库**（默认按时间倒序列出所有视频）。商品成为筛选维度之一：顶部工具条 `ProductFilter` 可搜索下拉（全部商品 / 未关联·已删除商品 / 逐个商品，带视频计数）；视图三态「全部 / 按商品分组 / 按脚本分组」；叠加状态筛选 + 搜索 + 排序。跨商品（全部）视图下视频卡片标注所属商品名。
- **选中某商品时浮出该商品 hero**（价格 / 佣金 / 卖点 / AI 提取卖点入口 + 视频/渲染中/已发布/总播放统计）；「全部 / 未关联」视图则显示聚合 `StatBar`。
- **商品目录直读系统商品库** `ProductsApi.listProducts()`（`/api/products`，经 `toMaterialProduct` 映射含真实图/价格/佣金/卖点），与商品库严格对齐；拉取失败回退本地 mock，不阻断视频库。
- **商品库是唯一真源**：已在商品库删除的商品不再出现在筛选项里；其孤儿视频归入「未关联 / 已删除商品」筛选项（视频不丢、但不冒充存在的商品）。素材运营本地富数据也复用商品库里的真实选品 id，避免再引入 p1–p6 这类平行演示商品。
- 删除旧的 `ProductDirectory` 左栏；`VideoLibraryView` 重构为全局 `GlobalVideoLibrary` + `ProductHero` + `ProductFilter` + `ProductGroupCard`。

**B. 修复：弹窗内调起确认框导致整页卡死**

- **症状**：素材库点「生成基线视频」（及其它在自定义全屏弹窗内调起 `useConfirm` 的入口）后整页卡死、无法点击。
- **根因**：共享 `AlertDialog`（`useConfirm` 用）的遮罩 + 内容默认 `z-50`，而 `VideoGenDialog` 等自定义弹窗是 `z-80/90`，确认框被盖在下面看不见、点不到；同时 Radix 锁了页面 `pointer-events` + focus，`await confirm(...)` 永远等不到点击 → 整页"卡死"。
- **修复**：`components/common/confirm-dialog.tsx` 的 `ConfirmHost` 把遮罩 + 内容统一抬到 `z-[200]`，确认框始终位于最上层。配套给共享 `packages/ui` 的 `AlertDialogContent` 增可选 `overlayClassName`（透传遮罩层 className；加性变更，不影响既有调用）。覆盖**所有** `useConfirm` 在高 z-index 弹窗内调起的场景，非仅基线视频。

### v0.40 · 2026-05-29 · 素材运营文本三件接真 LLM

- 起稿中心「AI 生成」`DraftingHub` 的 `AIPicker.run` 接 `POST /material/scripts/ai-draft`（真 LLM 起稿候选）。**失败不静默兜底**：直接展示后端明确报错（token 未配 / prompt 未配 / 模型异常）+ 重试。USE_MOCK 模式不打后端、用本地占位池 `aiCandidates`。
- 派生变体 `DeriveVariablesPanel` 挂载时拉 `POST /material/scripts/{id}/variables`（真 LLM 抽变量）；即时用正则结果占位，AI 回来非空则升级；AI 失败显式警示（保留正则结果可继续编辑）。
- 卖点提取（商品表单「AI 提取卖点」）后端换真实现（端点不变）；失败 inline 报错。
- `api/material-ops.ts` +`aiDraftScripts` / `extractScriptVariables`（USE_MOCK → `[]`；live 失败抛 `ApiError`，由调用方展示）。
- prompt（system+user）由 admin `/platform/prompts` 管理；server 侧见 `MaterialAiService` / `PromptService` / `prompt_template` 表。方案见 [`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](../../docs/MATERIAL_OPS_AI_TEXT_PLAN.md)。

### v0.31 · 2026-05-24 · 账户隔离收口：商品库公共池只读 + 写收归 admin

商品库前端不再暴露写入入口。`/products` 列表 / 详情页保留浏览 + 「生成视频」入口，
删除：

- 顶部「📋 从抖音链接快速建档」/「批量录入」/「快速录入」按钮
- 行级 / 详情页「编辑」/「删除」/「刷新图片」按钮
- 删除 `ProductFormDialog.tsx` / `ProductBatchImportDialog.tsx`
- `CelebrityProductForm.tsx`（per-generation 字段收集器）删除 AI 卖点抽取按钮
- `CelebrityGenerationWorkspace` 不再 fire-and-forget 调
  `/products/upsert-from-generation`；商品 +usageCount 由 server 端在 `MixcutJobService.create`
  内部按 productId 自动累加（详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.31）。
- `api/products.ts` 仅保留 `listProducts` / `getProduct` / `parseProductLink`。

所有写动作迁至 `apps/admin/src/app/celebrity/products/page.tsx`。

**v0.31 同日补丁**：保留 web-celebrity 端的商品录入入口，但**用账号角色门控**：
当前登录账号 `operatorRole` 非空（运营身份）时，列表 + 详情页都显示「新建 / 编辑 /
删除 / 批量录入 / 抖音链接建档 / 刷新图片 / AI 卖点抽取」全套写按钮；普通用户只读。
写按钮点击直接调 `/api/admin/products/**`，server 端 hasAnyRole 兜底。dev 环境 seed
账号 `celebrity_operator`（kind=studio + operatorRole=OPERATOR）可在 dev-login 下拉里
选择。详见 [`AGENTS.md`](../../AGENTS.md) §v0.31 增量节。

### v0.28 · 2026-05-23 · 商品主线贯穿（素材统一 + 链接解析 + 生成-分发桥接）

把过去四块独立的「商品库 / 素材库 / 混剪 / 分发」按"商品"为主线连起来，新增双向桥接 + 抖音商品链接解析能力。

**新增**：

```
packages/types : Product +priceCents +commissionRate；新增 product-link.ts (ProductLinkInfo)；MixcutAsset +related_product_id +subkind；RenderJob +product_id
server         : Product +priceCents +commissionRate 列；MixcutAsset +relatedProductId +subkind 列；MixcutRenderJob +productId 列
               : aep/service/productlink/* —— ProductLinkHandler 接口 + DouyinQueryEmbeddedHandler(@Order(10), query 内嵌 goods_detail) + DouyinHtmlScrapeHandler(@Order(20), HTML 抓 og tags + window.__INITIAL_STATE__；host 白名单 *.jinritemai.com|*.douyin.com 防 SSRF)
               : ProductLinkService 编排 chain；ProductLinkPersistService 解析 → 落 Product + 把图片登记为 MixcutAsset(subkind=product-photo) 统一素材体系
               : POST /api/me/products/parse-link（仅解析）+ POST /api/me/products/from-link（解析+落库）
               : MixcutAssetService +registerExternalUrl(userId, kind, subkind, externalUrl, productId) —— 外网 CDN URL 直接登记，不本地化
               : MixcutAssetController list 加 related_product_id query 过滤
               : CelebrityProductSeeder @Order(30) —— 首次启动 product 表为空时种 6 行抖音选品样例
web-celebrity  : ProductFormDialog +「📋 从抖音链接解析」按钮（覆盖空字段）+ 价格 / 佣金 数字输入
               : CelebrityProductLibrary 顶部 +「从抖音链接快速建档」入口；行 +「生成视频」按钮；表格 + 网格视图加 价格 / 佣金 / CTA 列
               : ProductGenerateDialog（新）—— 选模板 + 跳 /mixcut/create/{tplId}?product_id=X
               : ProductBatchImportDialog mapHeaderToField 识别 商品价格 / 佣金 列；表格 UI 加两列；TSV 占位符改为抖音选品库格式
               : create-client.tsx 读 useSearchParams.product_id；并发拉 product + listAssets(relatedProductId)；applyProductHeuristics 按 slot_id/label/fill_strategy 自动绑 image/picgen_text/text slot；顶部 chip「已从商品库带入 + 价格佣金 + 关联素材 N 张 + 一键清除」；提交 RenderJob 透传 product_id
               : BatchPublishDrawer 自动 prefill 抖音商品挂载（productLink / productTitle），UI 显示「📌 已从商品库带入」chip
               : mocks/products.ts 替换为 6 行抖音选品样例（与 server seed 同源）
openapi        : Product / ProductInput schema 加 priceCents / commissionRate；ProductLinkInfo + ProductLinkParseRequest 新 schema；/me/products/parse-link + /me/products/from-link 两个新 path
tests          : DouyinQueryEmbeddedHandlerTest（4 测）+ ProductLinkServiceTest（7 测）—— 全绿
```

**整体设计原则**：

- **MixcutAsset 是唯一素材表**：商品的图片 / 视频 / 未来 AI 生成片段统一作为 MixcutAsset 行存储，用 relatedProductId 标记归属（沿用 v0.21 relatedStarId 同模式，不发明新表）。`Product.images` 保留作向后兼容快照；新代码读取走 listAssets({ relatedProductId }) 查询。
- **productId 是生成-分发的贯穿键**：MixcutRenderJob.productId 透传商品上下文，BatchPublishDrawer 打开时反查 Product 自动填挂载字段（用户仍可覆盖）。PublishJob 暂**不**加 productId 列，按 sourceMixcutJobId 反查即可。
- **前端不区分 URL 形态**：单一调用点 `POST /me/products/parse-link`；server 内部 handler chain 按 @Order 决定路径。新平台只加 handler，不动 controller / 前端。
- **外网 CDN URL 直接登记**：解析出的图片 URL 直接落到 MixcutAsset.fileUrl，不下载本地。渲染时 AssetDownloader 按需拉。生产化备份是 future 范围。

**注意事项**：

- DouyinHtmlScrapeHandler 走 HttpClient GET（UA=desktop Chrome, timeout=8s），host 必须命中 `*.jinritemai.com|*.douyin.com` 白名单防 SSRF。
- ProductLinkPersistService 整体单事务；图片登记失败 log + 不回滚（图片不全比完全失败要好）。
- ProductLinkController 挂在 `/api/me/products/*`，受 `/api/me/**` 已有 `.authenticated()` 规则保护。
- **CelebrityProductSeeder 改用「版本号守门 + 一次性 reset」**：启动时读 `aep_platform_configs.aep.celebrity.products.seed-version`，与代码内 `SEED_VERSION = "v0.28-2026-05-23"` 不匹配则 **清空 product 表 + 所有 relatedProductId 关联的 MixcutAsset 行** + 重新种 6 行 + 写回新版本号；匹配则跳过。升级 seed 数据只需 bump `SEED_VERSION`，下次启动自动 reset。这是用户「初始化系统数据，把以前老的都删掉」的语义实现 —— 注意此 reset 会清掉运营手动录入的商品，生产化需用 source 字段区分 seed vs manual。**仅** Product + 关联 MixcutAsset 行，不抓图片（避免启动打外网；用户首次访问可手动触发解析回填）。
- 前端 `STORAGE_KEY` 同步 bump 到 `aistareco.web.products.v2`，老 v1 缓存在 `loadStore()` 启动时被 `removeItem("aistareco.web.products.v1")` 清理，mock 模式下自动回退到 `SEED_PRODUCTS` 6 行。
- 启发式 slot 绑定按 slot_id / label / fill_strategy 子串匹配，模板命名规范越好命中率越高；不命中保留空让用户手填。
- 「商品ID」列在批量导入时被识别但**不持久化**（server 自己生成 id）；运营手粘表格时 ID 仅作 link URL 的参考。
- MixcutRenderJob.productId 是软引用字符串（无 FK 约束），reset 时残留指向被删商品的 job 不清理 —— 下游 BatchPublishDrawer fetch product null 时优雅降级（不 prefill），不会崩。

**契约状态**：`(cd apps/web && npm run check:api-contract)` ✅ OK · `pnpm typecheck:all` ✅ 七 workspace 全绿 · `./mvnw compile` + `./mvnw test -Dtest='DouyinQueryEmbeddedHandlerTest,ProductLinkServiceTest'` ✅ 11 测全绿。

### v0.27 · 2026-05-22 · 混剪创建页 UX 重构（分步导引 / 渐进披露 / 焦点强化）

用户反馈三个问题：① 分段步骤引导不够；② 右侧参数过早全部暴露，认知负担高；③ 操作时焦点区域提示弱。本次围绕"create page 是个明确的两步工作流（① 填素材 → ② 设置并生成）"做信息架构重构，无任何契约 / server 改动。

**A. 显式两步导引**

- 中列 header 加 `①` 圆形数字徽章 + "填入素材"；右侧 aside 主卡 header 加 `②` 圆形数字徽章 + "设置并生成"。两个数字徽章字号、形状一致，跨列扫读时能立刻识别出"流程到这一步"。
- 必填进度从一行小字升级为彩色 chip（emerald = 已就绪 / amber = 还差 N 项），跟着 header 走，永远在视口里。

**B. 右栏渐进披露 · 大幅降低默认认知负担**

旧版 aside 是一张"批量生成参数"巨型卡（≈200 行 JSX / 25+ 控件）一次性炸开。新版：

- **主卡 ② 设置并生成**（默认展开 · 永远可见）：仅含用户每次必调的字段 —— 数量（大字号 + slider + 4 preset chip 行内）、差异化强度（3 pill, no description）、消耗摘要（消耗 / 月余 / 出片 三列扫读）、超额警告、主 CTA。
- **折叠卡「高级处理」**（默认收起）：6 个画面处理 checkbox（整段画面 4 + 逐素材抖动 2）+ 扰动贴图池。trigger 行显示摘要 `画面 6/6 · 贴图池已启用`，状态变更后摘要实时反映。
- **折叠卡「关联商品（选填）」**（已选时默认展开）：商品 picker 全套 UI。trigger 行显示当前商品名 or "选填 · 仅做参考"。
- **Pro 速度卡**：从全宽 Card 压缩为单行 banner，置于 aside 底部。

中列对应清理：扰动贴图池 + 关联商品两张卡迁出，中列从今往后只剩"填素材"一件事。

**C. 焦点区域强化**

- `TemplatePreview` 新增 `focusDim` prop。开启后：当 `selectedSlotId` 非空，所有未选中 slot 的 rect 整体 opacity 降到 0.30 + 微缩 0.985，已选中 slot 上方加一枚浮动 pill `正在编辑 · {label}`（带阴影 + ring，pill 自动根据 slot 在画布顶部位置切换上/下放置）。
- 创建页传 `focusDim`，模板编辑器 / 任务详情预览不传，行为零影响。
- 中列被点开的 slot 所属场景块继续保留 ring + 浅紫底（v0.26 既有）。

**D. 场景 tab 进度可视化**

每个场景 tab 加 1.5px 进度 dot（按必填进度）：
- `emerald` = 该段必填全部已填
- `amber + animate-pulse` = 部分已填
- `rose` = 一项都没填
- 灰 = 该段无必填项（光看就行）

tab strip header 加全局摘要 `N/M 段已就绪`；当前 active 段在底部加 2px 紫色强调线（比单纯换底色更明确"我在这"）。

**注意事项**：

- 重构纯 UI 层，不改任何状态名、不改 mock / api / 类型。线上行为完全等价。
- 折叠卡用 `@ai-star-eco/ui/ui/collapsible`（radix-based），无控件状态需手管。
- "Pro 速度"位置降权到 banner —— 既然付费功能不挡免费用户路径，就不该用整卡占第一屏。
- 不引入 framer-motion 等动画库；fade 用 tailwindcss-animate 既有 utilities，符合"product motion = state, ≤250ms"原则。

### v0.26 · 2026-05-22 · 混剪创建页加场景导航

接着 v0.25 把后端按场景渲染补齐后，前端创建任务页（`/mixcut/create/[id]`）还有遗留 UX 问题 —— `TemplatePreview` 用 `flatSlotsOf(template)` 把所有场景的 slot rect 全部叠加到同一画框上，五个场景的标题 / 商品位会糊成一团；中列素材输入虽然 v0.22 起按场景分组，但缺一个「切到下一段」的明确动作。

**改动**：

- `create-client.tsx` 加 `activeSceneIdx` state；多场景模板在画布上方渲染一条紧凑场景 tab 栏（pill 形式，展示 "第N段 · label · Ns"），点 tab 同时切画布 + 滚动中列对应场景块进视口。
- `TemplatePreview` 接收的不再是原 template，而是用 `previewTemplate = { ...template, scenes: [activeScene], canvas.duration: activeScene.duration }` 收窄过的。`flatSlotsOf` 现在只返回当前场景的 slot，画布不再叠加。
- 用户在中列点开某个 slot 输入控件（`focusedSlot` 变化）→ effect 反查所属场景 → 自动 `setActiveSceneIdx`。"我在填的内容"和"画布显示的画面"始终对齐。
- 中列每个场景块加 `id={\`scene-block-${scene.id}\`}` + `scroll-mt-24`（sticky topbar 偏移）；当前激活场景块加紫色描边 + 浅紫底 + 「画布正在显示」徽标；标题行整体变 button，点也能切到该场景。
- 单场景模板（最常见的工厂模板）→ tab 栏不渲染，行为与旧版完全一致。

**注意事项**：

- `useEffect` 监听 `focusedSlot` 同步 active scene；`activeSceneIdx` 没进依赖（用户主动点 tab 切场景时不应被 focusedSlot 又反推回去），刻意 eslint-disable react-hooks/exhaustive-deps。
- 音频 slot 渲染在画布下方的 chip 区，现在也只显示当前场景的 audio slot；这是预期行为 —— audio 槽位通常单场景才出现，多场景模板里 BGM 一般跨场景共享时应放在第一个场景的 audio slot。
- 与 v0.25 后端按场景渲染配套：前端预览的"分段视觉"和最终 ffmpeg 输出的"分段视频"一一对应，用户在哪段填的素材就在哪段出。

### v0.25 · 2026-05-22 · 混剪按场景渲染（多段落 bug 修复）

修复模板里配了多个场景但最终视频永远只有 2 段的根因。从模板编辑到 ffmpeg 拼接的整链路把"场景"作为一等公民贯穿。

**bug 现象**：

- 用户在模板编辑器里配 5 个场景（如开场 3s + 主体 8s + 卖点 3s + CTA 2s + 结尾 2s），混剪生成的视频里**永远**只用 2 段视频拼，每段 7.5s，与模板里配的 `scene.duration` 完全无关。
- 模板里把同一 slot 放在不同场景给不同时段播也无效 —— overlay 整片可见。

**根因**：

- `MixcutRenderingService.renderOneVariant` 第 918 行（v0.24 及之前）硬编 `segCount = Math.min(2, sources.size())`，`segDuration = maxOutputDurationSec / segCount`。
- 前端 `SlotSnapshot` 没有 `time_range` 字段、`RenderJob` 没有 `scenes_snapshot` 字段；模板里 `scenes[]` 的场景边界在序列化为 `slot_bindings` + `slots_snapshot` 时被 `flatSlotsAbsolute()` 拍平成无场景结构的扁平 slot 列表，渲染器收到时已经不知道场景在哪。

**修复（v0.25）**：

- `types.ts` 新增 `SceneSnapshot { id, label?, duration_sec, slot_ids[] }`；`RenderJob.scenes_snapshot?: SceneSnapshot[]`；`SlotSnapshot.time_range?: [number, number]` 也补回。
- `create-client.tsx` 提交 job 时直接从 `template.scenes` 构造 `scenes_snapshot`（按顺序）；`slots_snapshot` 同时带上绝对 `time_range`。
- server `MixcutRenderJob.scenesSnapshotJson` 新 TEXT 列；DTO 双向透传（`MixcutCreateJobRequest` + `MixcutRenderJobDto.from`）。
- `MixcutRenderingService`：
  - `RenderContext` 加 `scenes: List<SceneSpec>`；`buildContext` 解 `scenesSnapshotJson`，单场景长度 clamp 到 `[1, maxOutputDurationSec]`，总和超出 max 时按比例缩放。
  - `renderOneVariant` 引入 `useSceneSchedule` 分支：`segCount = scenes.size()`（不再硬编 2）、`segDurations[i] = scene.durationSec`、每段独立 `-ss`/`-t`；`totalDuration` 改成段长之和。
  - 构建 `slotToWindow: Map<slotId, [start,end]>`，给 overlay filter 末尾追加 `:enable='between(t,start,end)'`，把 overlay 限制在所属场景时段内显示。
  - 缺省（旧任务 / 空 scenes_snapshot）→ 走 v0.24 回退路径（`Math.min(2, sources.size())`），完全向后兼容。
- `applied_transforms` 新增 `scene_schedule: "per_scene" | "legacy_2seg"` + `total_duration_sec`，每段 detail 追加 `scene_id` / `output_start` / `output_end`，前端可观测。

**注意事项**：

- 字段是**加性兼容**：scenes_snapshot 为空时渲染器行为与 v0.24 完全一致，不影响历史任务。
- 总和超出 `aep.mixcut.max-output-duration-sec`（默认 60s）时按比例缩放后再渲染；想要更长片需要调高这个上限。
- 源视频 round-robin：scene[i] 对应 `sources[(variantIndex + i) % sources.size()]`，5 场景 + 2 视频会循环复用，5 视频 + 2 场景每变体只用 2 个。
- 当一个 slot_id 不属于任何场景的 `slot_ids[]`（前端漏发？模板异常？）→ 该 overlay 整片可见（旧行为），不会丢失内容。

### v0.24 · 2026-05-21 · 混剪 / 分发融合商品库（showcase MVP）

把已有 **商品库**（[`Product`](../../packages/types/src/product.ts) 实体 + admin CRUD + `ProductsApi`）接到混剪创建页与分发流程上。**纯前端拼装，零后端 / openapi / schema 改动**。

- ✅ **混剪创建页加「关联商品」Card**（[`create-client.tsx`](src/app/(workspace)/mixcut/create/%5Bid%5D/create-client.tsx) 中段，扰动贴图池上方）：点「从商品库选择」打开复用的 [`ProductPickerDialog`](src/components/celebrity-zone/ProductPickerDialog.tsx)；选中后显示商品卡片（图 / 名 / 类目 badge / 卖点 line-clamp / 链接）作为填槽时的参考资料。**当前不自动填充任何 slot，不绑定到 RenderJob**，提交后 state 丢弃。
- ✅ **抖音商品挂载支持从商品库选择**：[`BatchPublishDrawer`](src/components/mixcut-zone/BatchPublishDrawer.tsx)（混剪任务详情 + 分发工作台）与 [`ManualDistributeDialog`](src/components/distribution/ManualDistributeDialog.tsx)（上传链接分发）的「抖音商品挂载」section 都新增「从商品库选择」按钮，选完 `productLink ← product.link`、`productTitle ← product.name`（截断至 50 字）。任一字段为空时 sau-service 静默忽略挂件（v0.22 既有行为不变）。
- ✅ **零新组件**：全程复用既有的 `ProductPickerDialog`（原仅给 `CelebrityProductForm` 用）+ `ProductsApi.listProducts`。

**MVP 定位与未来改进**：

- 当前实现是**展示性的最小可用版本**：把库已经备好的商品资料接入到两个高频入口，先把交互链路跑通，验证「先选商品，再生成视频 / 派单」的工作流。
- 未来若要把绑定关系真正落库，需要：MixcutRenderJob 加 `productId` 列 + DTO + openapi schema + admin 反查；同步 `Product.usageCount` 在分发成功时自增（可调既有 `ProductsApi.upsertFromGeneration`）。
- 自动填充素材槽（按 slot label 关键词或 slot 层显式「绑定字段」下拉）也是未来改进项，本次刻意留给运营人工敲。
- picker 后续可考虑「最近使用」「热度排序」「多商品挂件」等增强。
- 若 drama / music 子应用未来也接带货，把 `ProductPickerDialog` 上提到 `packages/ui` 共享。

### v0.23 · 2026-05-21 · 任务追踪按批次聚合 + 批量操作

分发中心「任务追踪」从平铺 `PublishJob` 列表升级为按 `project_id` 聚合的批次卡片，配合服务端分页 + 批次级批量操作，避免 N×M 派单后列表爆炸。

- ✅ **批次卡片列表**（`BatchTrackingTab` + `BatchSummaryCard`）：每张卡 = 一个 projectId 下所有 PublishJob 的汇总（progress / statusCounts / 调度区间 / 平台列表 / 来源徽章）。源徽章按 projectId 前缀派生：`mixcut-batch-*` → 混剪批次；`manual-batch-*` → 手动分发；其他 → 历史散件。
- ✅ **批次级批量操作**：取消整批（非终止态 → cancelled，保留每条 best-effort `sau.cancelTask`）/ 重试失败（FAILED → QUEUED，每条扣费一次）/ 重新调度未开始（QUEUED 子集换新 ScheduleSpec）。前端调 `POST /me/publish-jobs/batches/{projectId}/{cancel|retry-failed|reschedule}`。
- ✅ **详情 Drawer**（`BatchDetailDrawer`）：右侧滑出嵌套现有 `PublishJobList projectId={...}` —— 复用 2.5s 轮询 + 行级 start/cancel/retry/interact，无需重写。
- ✅ **重新调度对话框**（`RescheduleBatchDialog`）：复用从 `BatchPublishDrawer` 抽出的 `ScheduleEditor` 共享组件；只允许 single / daily_recurring 两种 strategy（重新调度场景里"立即"等价于让调度器下个 tick 起飞）。
- ✅ **服务端分页**（默认 limit=20）：新 `apiFetchPaginated<T>` helper 返回 `PaginatedResponse<T>`，保留 PageEnvelope 的 `pagination` 元数据（page/limit/total/totalPages/hasNext/hasPrev）。
- ✅ **手动分发批次化**：`ManualDistributeDialog` 不再硬编 `projectId="manual"`；server `PublishJobService.createBatch` 收到 null/blank/旧 "manual" 占位时自动生成 `manual-batch-<userId>-<yyyyMMddHHmmss>`，每次手动分发提交自成一批。
- ✅ **ScheduleEditor 共享**：抽自 `BatchPublishDrawer.tsx`（行为零变化），放到 `src/components/distribution/ScheduleEditor.tsx`；混剪批量发布 + 任务追踪重新调度共用同一份 UI + 前后端 expandSchedule 算法对齐。

**注意事项**：

- 历史数据 `project_id="manual"` 行会聚合成一张「历史散件」徽章的卡片。不做回填迁移；新数据自然分流到不同 `manual-batch-*` 桶。
- 服务端 `PublishJobBatchService.listBatches` 走两步查询：先 GROUP BY projectId 拿本页 projectId（分页），再 IN 查这些 projectId 下所有 row 在 Java 层 fold 成 `PublishBatchSummaryDto`。比单查 8 个 `SUM(CASE)` 列更可维护，rows 上限可控（一页 20 × 单批典型 30 行）。
- 轮询策略：列表里任一 batch `hasInflight=true` → 5s 重拉；Drawer 打开 + 内部 PublishJobList 仍跑 2.5s（行级粒度）。全部 batch 终止则停。
- v0.20 `MixcutPublishService.expandSchedule` 私有方法迁出到 `service/publish/ScheduleExpander.java` 公共 util；混剪批量发布 + 任务追踪 reschedule 都注入它，避免前后端 / 不同入口实现漂移。

### v0.22 · 2026-05-21 · 混剪 / 分发用户视角文案 + 视频库 + 官方明星片段

把混剪与分发模块从「工程师视角」整改为「运营 / 用户视角」，并补两个新模块（视频库 + 官方明星片段）。详见根 [`AGENTS.md`](../../AGENTS.md) v0.21 章节。

- ✅ **文案术语全面 review**：「变体 → 视频」「派单 → 分发」「立即派单/定时派单/铺开派单 → 立即分发/定时分发/分期分发」「手动分发 → 上传链接分发」；删 CDN / sau / cookie / 渲染节点等技术词；详见 [`AGENTS.md`](../../AGENTS.md) v0.21A
- ✅ **混剪本月配额下线**：`MixcutHomePage` 删 `QuotaIndicator`，换为「本月已生成 N 条视频 + 累计 M 个任务」纯统计；积分余额走 app 顶部钱包入口
- ✅ **混剪视频库**（`/mixcut/library` 改造）：顶层 tab「我的素材 / 我的视频 / 官方明星片段」；「我的视频」展示已生成的渲染产出，支持单条软删 → server 30 天后物理清理
- ✅ **官方明星片段专区**：admin 后台上传，web-celebrity 用户只读消费；分类筛选（直播切片 / 综艺 / 访谈等）
- ✅ **新建模板不再自动落库**：新增 `/mixcut/templates/new` 路由 + `TemplateDetailClient` 加 `mode="new"` 内存模式；第一次保存才创建，取消则直接返回列表无残留
- ✅ **任务详情页清理**：删「全部打包下载 / 再生成一批 / 顶部 Trash2」三个空 onClick 按钮；Copy 按钮接 `navigator.clipboard.writeText(job.id)`；删「渲染节点」row；「本次消耗 X 条额度」→「X 积分」
- ✅ **分发工作台默认按任务视图**：`DistributeWorkbench.tsx` ViewMode 初值改为 `"group"`；右栏 help 加超链 `/mixcut/library?tab=videos`

**注意事项**：

- 软删 30 天物理清理靠 `MixcutOutputCleanupScheduler`（`@Scheduled(cron="0 30 3 * * *")`）。多实例部署需 ShedLock（与 PublishJobScheduler 同样的待办）。
- 模板新建 `mode="new"` 下 template_id 是前端 nanoid 生成的；第一次 saveTemplate 后 `router.replace(/mixcut/templates/{id}/edit)`，从此沿用 mode="view" + initialEdit 路径。
- 官方明星片段与 v0.13 扰动贴图池（`isPreset`）是两套互斥标记。

### v0.21 · 2026-05-21 · 混剪文字生图 overlay 不被丢弃 · 修复

混剪渲染管线的 ffmpeg filter 能力探测在某些 vendor 定制 build 上漏检 `overlay` filter，导致用户在 create 页填了「文字生图（picgen）」槽位、后端 `picgen_count` 计数器证明 PNG 已生成，但最终视频里什么都没贴 —— 24KB 空视频 + `贴图来源: disabled-missing-filter`。

- ✅ **三阶段 filter 探测**（`apps/server/.../FfmpegRunner.java`）：
  1. 严格正则 `FILTER_LINE` 解析 `ffmpeg -filters` 输出（既有逻辑）
  2. 宽松正则 `FILTER_LINE_LOOSE` 在同一输出上补一遍 —— 仍强制要求 ffmpeg signature 列（`A->A` / `VV->V` / `|->A` 等），避免随便一行 3 token 都被误当 filter
  3. 对仍未命中的 18 个关键 filter（`CRITICAL_FILTERS` = overlay / scale / crop / eq / hflip / setpts / aresample / ...）走 `ffmpeg -h filter=<name>` 单条权威 probe；每次 probe ~30-80ms，首次 boot 多花 ≤1s
- ✅ **picgen overlay fail-fast**（`MixcutRenderingService.renderOneVariant`）：当用户绑定了 overlay（包括 picgen）但探测后 `caps.overlay` 仍 false，直接抛 RuntimeException 让任务失败并提示安装完整 ffmpeg —— 不再静默丢弃产出空视频
- ✅ **诊断日志增强**：filter 集合最终化时打印 `strict=X, loose+=Y, probe+=Z` 三阶段数量；任何关键 filter 通过 probe 兜底恢复都会 WARN 一行点出 vendor build 偏离上游格式

### v0.20 · 2026-05-20 · 分发定时策略升级（每日铺开 + 随机抖动）

- ✅ **三选一调度策略**：批量发布抽屉的「定时发布」checkbox 退役，换成「立即发布 / 单次定时 / 每日定时铺开」三选一 pill。`single` 分支保留 v0.15 的 `datetime-local`。
- ✅ **「每日定时铺开」核心新功能**：起始日期 + 时段池（支持「每天 3 次 09/12/18」「每天 2 次 12/19」「每天 1 次 19」「晚间高峰 19/21/22:30」四套预设 + 自定义 HH:MM chip 编辑）+「直到视频用完 / 持续 N 天」容量模式 + 可选「±N 分钟随机抖动」。
- ✅ **自动建议天数**：当切到「持续 N 天」模式且用户未手改过 maxDays 时，根据 `ceil(选中变体数 / 时段数)` 自动建议（cap 30 天）。用户一旦手改即停止覆盖。
- ✅ **实时预览**：`共 X 条 · 跨 Y 天 · 首条 今 09:00 · 末条 5月23日 18:00 · ±15 分钟抖动` 实时跟随选中变体 + 时段变化。过去 slot 标「立即」。
- ✅ **容量超限校验**：「持续 N 天」模式下若选中变体 > maxDays × 时段数，红字阻拦提交并解释 `N > D×K = M`。
- ✅ **服务端铺开（新 ScheduleSpec API）**：`MixcutPublishBatchRequest` 顶层增 `schedule: ScheduleSpec` 多态字段（Jackson `@JsonTypeInfo` discriminator `strategy`，sealed `Immediate / Single / DailyRecurring`）；`TargetItem` 移除 `scheduled_at`（时间不再 per-account）。`MixcutPublishService.expandSchedule` 把 spec 算成 outputs.size 长的 Instant[] 数组，校验失败 400 拒绝在任何 DB 写入前。`PublishJobScheduler` / `PublishJob` 零改动 —— 错峰 `scheduledAt` 直接生效。
- ✅ **projectId 防撞**：调用方未指定 projectId 时，服务端拼 `mixcut-batch-<source>-<yyyyMMddHHmmss>`，避免同源混剪任务多次铺开撞同一 project_id。
- ✅ **过去 slot clamp**：起始日期填昨天，前几个 slot 已过时间 → 自动 clamp 到 `now()`，调度器下个 tick 立刻起飞，避免 UI 显示「-3 天 09:00」。

### v0.19 · 2026-05-20 · 视频库允许再次分发 · 派发计数落库

- ✅ **去掉「已发布默认隐藏」**：v0.16 引入的 localStorage 去重（`aep:distribute:published-output-ids`）已删除。视频库默认显示全部可发变体，包括已经派过单的；同一变体可再次分发到新账号 / 新时间窗。
- ✅ **派发计数 + 最近时间落库**：`MixcutRenderOutput` 增 `publishCount` (`@ColumnDefault("0")`，现存行自动落 0) 与 `lastPublishedAt` 两列；`MixcutPublishService.batchPublish` 每条 output 派单成功后按 target 数累加并刷新时间。tracker 写库失败只 log，不影响派单结果。
- ✅ **DTO + 前端类型对齐**：`MixcutRenderOutputDto` 新增 `publish_count` / `last_published_at`；`mixcut-zone/types.ts#RenderOutput` 同步两个可选字段。
- ✅ **DistributeWorkbench UI 翻新**：缩略图徽标由「已发」→「已发 ×N」（hover tooltip 显示「已派单 N 次 · 最近：xx前」相对时间）；工具条按钮翻为「显示全部 / 仅未发布」二态切换（默认 OFF = 显示全部）；派单成功后立刻 `load()` 重新拉 jobs 列表，徽标实时升级。
- ✅ **空态文案**：仅在「仅未发布」过滤下且全部已发时，提示用户回到「显示全部」即可再次分发。
- ✅ **失败任务重试按钮修复**：混剪任务列表 `/mixcut/jobs` 与详情 `/mixcut/jobs/[id]` 的「重渲」按钮（共 3 处）改名为「重新生成」（自然中文），并接上 onClick——`router.push("/mixcut/create/<template_id>")` 跳到新建页用相同模板重做一批。之前点击无反应（onClick 仅 `e.preventDefault() / stopPropagation()`，无业务行为）。

- 分发短信验证码交互

抖音 / 视频号上传过程中触发的「请输入短信验证码」弹窗，现在能在前端弹起输入框让用户提交，而不再让任务静默卡死在 publishing。

- ✅ **新状态 `awaiting_user`**：PublishJobStatus 加入；server / sau-service / packages/types / web 各 layer 同步。状态机：UPLOADING/TRANSCODING/PUBLISHING ↔ AWAITING_USER ↔ UPLOADING/PUBLISHING/LIVE；超时 → FAILED with `AWAIT_USER_TIMEOUT`。
- ✅ **SmsInteractionDialog**（`components/distribution/SmsInteractionDialog.tsx`）：
  - 默认 `awaiting_user` 出现时自动弹出（用户关闭后不再自动弹）
  - 显示平台 + 脱敏手机号尾号 + 5 分钟倒计时
  - 6 位数字输入（auto-complete one-time-code），Enter 直接提交
  - 提交后立即刷新 PublishJobList
- ✅ **新接口 `POST /me/publish-jobs/{id}/interact { code }`**：仅在 awaiting_user 状态有效；server 转发到 sau-service `POST /tasks/{id}/interaction`，由 sau-service 把 code 填进 page 关闭弹窗，上游 upload retry 循环自然继续。
- ✅ **PublishJobList 行扩展**：awaiting_user 行显示「输入验证码」按钮 + interaction prompt + 手机号；任务列表的「取消」也接受 awaiting_user 状态。
- ⚠️ **MVP selector 占位**：sau-service `interaction.py` 的 `_PlaceholderSmsDriver` 永远返回"无 SMS 检测"。需要在抖音 / 视频号真实触发风控 → 抓取弹窗 DOM 后填入实际 selector。整个 stack 已通，selector 一接上立即可用。

### v0.18 · 2026-05-20 · 社交账号 profile 增强

- ✅ **账号辨识度**：`SocialAccount` 增 `platformAccountId`，与已有 `displayName` / `avatarUrl` 一起展示。
- ✅ **分发中心 UI**：账号管理列表显示平台账号号；项目分发 / 手动分发 / 混剪批量发布的选账号 UI 均展示昵称 + 平台账号号。
- ✅ **契约来源**：字段来自 server 清洁 DTO，不包含 storage_state；平台差异由 sau-service 各平台 driver 提取。

### v0.17 · 2026-05-20 · 混剪三项优化

- ✅ **新建模板 404 修复**：`mixcut/create/[id]` 之前用 `MixcutApi.getTemplateSync()`（只查 localStorage + mocks），USE_MOCK=0 模式下找不到 server 刚 PUT 的新模板。改为 await `getTemplate()` 后与 `template-detail-client` 对齐。
- ✅ **素材选择 UI 统一**：新建 `media-slot-input.tsx` 替代 `UploadSlotInput` + `LibrarySlotInput`。image / video / audio / sticker 槽位全部走同一组件，三种模式 `upload | library | both` 由 `fill_strategy` 推导。顺手修复 `image + library_select`（非 sticker）当前不渲染的 bug。
- ✅ **picgen 文字转图集成（纯 Java2D 内部渲染，无外部依赖）**：
  - `BannerRenderer`（Java2D）：从原 pic-gen 项目移植 16 套配色 SCHEMES，画背景渐变 + 双层描边主标题 + 渐变填充 + 副标题 ribbon + 倾斜标签胶囊。完全 in-process，零网络/零子进程；
  - `PicgenClient` 是对 `BannerRenderer` 的薄封装，对外签名不变；上游 `MixcutRenderingService` 和 `MixcutPicgenController` 无感切换；
  - `aep.picgen.*` 配置精简到 `enabled` + `output-dir` + `preview-dir` + `preview-public-url-base`（不再有 base-url / timeout-ms）；
  - 模板编辑器加 `picgen_text` strategy；`PicgenSlotInput` 让用户填主标题/副标题/标签 + 一键生成预览图，UI 明确提示"正式渲染时每条会再换版式"；
  - `MixcutRenderingService.resolveBindings` 增 picgen 通道；变体循环前为每个 picgen slot 用 seed=hash(jobId, variantIndex, slotId) 调一次 `BannerRenderer.render`，得到的 PNG 合入 overlays（按 z_index 重排）；
  - 失败兜底：单张渲染异常只 log + 跳过，不让任务整体 fail。
- ℹ️ **中文字体**：Java 渲染用逻辑字 `SansSerif` Bold，靠 JVM 自动 fallback 到 OS CJK 字体（macOS=PingFang SC、Windows=Microsoft YaHei、Linux=Noto Sans CJK）。生产 Linux 部署 **必须** 装 `fonts-noto-cjk` 或同等中文字体包，否则中文字会被绘制成方框。


### v0.16 · 2026-05-19 · 分发工作台迁入分发中心 + 分发中心 IA 升级

把 v0.15 落在 `/mixcut/publish` 的「分发工作台」迁入分发中心 `/distribution`，让混剪只负责制作、分发中心统一收口「批量制作 → 绑账号 → 派单」的用户路径。

- ✅ **新核心组件**：`components/distribution/DistributeWorkbench.tsx`
  - 双视图：`grid`（默认，所有可发变体平铺；缩略图顶贴任务名 chip + 底贴 v 编号）/ `group`（按任务卡片，可展开变体；同 v0.15 行为）
  - 跨任务搜索 + 已发布过滤 *（v0.16 行为；v0.19 起视频库不再默认隐藏已发布变体，开关改为「显示全部 / 仅未发布」二态，详见 v0.19 节）*
  - Sticky right rail：已选缩略图九宫格（>8 折叠为 +N）+ 清空 + 「继续配置发布 (N)」CTA
  - 派单复用现有 `BatchPublishDrawer`（items[] 模式），不重复造选账号 / 文案 / 定时 UI
- ✅ **DistributionPage IA 升级**：`components/distribution/DistributionPage.tsx`
  - 顶部状态条：已绑账号 / 可发变体 / 进行中任务 三个 StatChip（点击切对应 tab）
  - Tabs：分发工作台（默认）/ 账号管理 / 任务追踪；URL 同步 `?tab=workbench|accounts|tracking`
  - 「手动分发」按钮上移到 header 右上，跨 tab 常驻；创建成功后自动切到「任务追踪」tab 触发刷新
  - 用 `<Suspense>` 包 `useSearchParams` 避免 Next 16 build 警告
- ✅ **深链支持**：`/distribution?from_job=<mixcutJobId>` 进入时自动 `workbench` tab + `group` 视图 + 展开该任务 + 勾选其全部可发变体 + smooth scroll 到目标卡片（卡片紫边高亮 + 「来自混剪」chip）
- ✅ **mixcut 路由收口**：
  - `app/(workspace)/mixcut/publish/page.tsx` 改为 `redirect("/distribution?tab=workbench")`；删除 `publish-workbench-client.tsx`
  - `app/(workspace)/layout.tsx` 移除 mixcut 二级菜单的「发布工作台」+ 面包屑映射
  - `app/(workspace)/mixcut/jobs/[id]` 详情页保留单任务批量发布 drawer（行为不变），新增 ghost 按钮「去分发中心 →」深链 `/distribution?from_job=<id>`，引导用户认识统一出口
- ✅ **行为路径**：制作（`/mixcut/*`）→ 绑账号（`/distribution?tab=accounts`）→ 分发（`/distribution`）线性闭环，三个状态条数同时可见
- ➖ **不做**：手动 URL 输入 inline 合并进工作台（保留独立 `ManualDistributeDialog`，因为字段差异大 — 封面 / 商品挂载 / 视频号 category 等专属字段塞进通用工作台会复杂）

### v0.15 · 2026-05-19 · 混剪 → 发布桥接 + 定时

- ✅ **publish-batch 接口**：`POST /api/me/mixcut/publish-batch` 一次性把 N 变体 × M 账号派单 N×M 条 PublishJob。outputs[].cdn_url 必填；缺失计入 `failed_items[].reason="MISSING_CDN_URL"`。
- ✅ **后端调度器**：`PublishJobScheduler @Scheduled(fixedDelay=60s, initialDelay=30s)` 扫 status=QUEUED 且 scheduledAt≤now 的任务，自动调 startJob。`AiStarEcoApplication` 加 `@EnableScheduling`。复用 QUEUED 状态，不新增 SCHEDULED。
- ✅ **前端三入口**：
  - `/mixcut/jobs/[id]` 成功态加「批量发布」按钮 → `BatchPublishDrawer`
  - `/mixcut/publish` 新工作台：跨任务挑 cdn 变体 → 同 drawer（items 模式）
  - `/distribution` 顶部加「从混剪库选视频发布 →」紫色按钮 → 跳 `/mixcut/publish`
- ✅ **BatchPublishDrawer**：变体多选 grid + 社交账号多选 + title/description/tags + datetime-local 定时（显式 toISOString 转 UTC）+ 部分成功结果展示。
- ✅ **类型**：`types.ts` 的 `RenderOutput` 增 `cdn_url/cdn_key/cdn_thumbnail_url/cdn_uploaded_at` 字段。

### v0.14 · 2026-05-19 · CDN 抽象 + 渲染产物自动上传

- ✅ **CdnUploader 接口**：`apps/server/.../service/cdn/CdnUploader.java` + `LocalFakeCdnUploader`（@ConditionalOnProperty `aep.cdn.driver=local` 默认）+ `AliyunOssCdnUploader` stub。
- ✅ **本地 fake-CDN**：复制到 `./cdn-mock/<key>`，对外 `/cdn/<key>`（默认相对路径，nginx / Next rewrite same-origin）。`CdnWebConfig` 注册静态资源 handler。路径穿越校验。
- ✅ **MixcutRenderOutput**：加 `cdnUrl / cdnKey / cdnThumbnailUrl / cdnUploadedAt` 列。`MixcutRenderingService.renderOneVariant` 末尾串行 `uploadWithRetry(mp4)` + `uploadWithRetry(jpg)`，失败 1 次重试后仅 WARN 不阻塞。
- ✅ **失败清理**：`markFailed` 增 CDN 孤儿删除（按 cdnKey 调 uploader.delete）。
- ✅ **配置**：`application.yml` 加 `aep.cdn.driver/local-root/public-base-url + oss.{endpoint,bucket,base-url}`。

### v0.13 · 2026-05-19 · 扰动贴图池 + 安全前置

- ✅ **预置素材**：`MixcutAsset` 加 `isPreset / presetGroup / previewUrl` 列。Repository 加 `findByIsPresetTrue*` 查询。Service `listVisibleTo(userId, kind, preset, group)` 合并用户私有 + 预置池。
- ✅ **DataInitializer seed**：`MixcutPresetSeeder @Order(10)` —— ① 扫 `classpath:preset-stickers/<group>__<name>.gif` 复制到 fs + 注册 DB；② 若 DB 中预置为空，ffmpeg lavfi 程序化生成 5 张 demo（sparkle x2 / ribbon x2 / emoji_burst）作兜底，零依赖跑通。
- ✅ **GIF overlay**：`MixcutRenderingService.buildVariantStickers` 按 (jobId+variantIndex) seed 随机抽样 + `renderOneVariant` 用 `-stream_loop -1` 让 GIF demuxer 循环 + filter `format=yuva420p,scale=W:-2,colorchannelmixer=aa=opacity` → `overlay enable=between(t,start,end)`。GIF 二值 alpha 限制（半透明 = 整体调薄）已在 UI 提示。
- ✅ **模板 sticker_pool**：`MixcutRenderJob` 加 `stickerPoolJson TEXT` 列；结构 Map<slotId, {pool_ids, coverage∈{intro,outro,loop,random_3s}, opacity, scale_pct, pick_count}>。DTO 同步。
- ✅ **前端 picker**：`sticker-pool-picker.tsx` —— 4 group tab + 多选 grid + 时间覆盖 4 段 + 不透明度/大小 slider + 抽样数 1/2。集成在 `/mixcut/create/[id]` 工作台右侧（写到 `sticker_pool["_global"]`）。
- ✅ **安全前置（v0.13.0）**：探查发现 `MixcutController` 全部方法之前未接 `Principal` —— 任何登录用户可越权访问他人 job。同 commit 修：所有方法加 Principal + service 层 userId 过滤 + 上传 / 删除 ownership 校验。

### v0.9 · 2026-05-17 · 混剪用户素材上传 + 真实素材渲染

- ✅ **真后端素材表**：`MixcutAsset` entity（id / userId / kind ∈ {video / image / sticker / bgm} / name / fileUrl / localPath / mimeType / fileSize / duration / tags / uploadedAt）+ JpaRepository。
- ✅ **上传 API**：`POST /api/mixcut/assets`（multipart），`GET /api/mixcut/assets?kind=&user_id=`，`GET /api/mixcut/assets/{id}`，`DELETE /api/mixcut/assets/{id}`。
- ✅ **AssetUploadService**：multipart → 落本地 `./mixcut-assets/<userId>/<id>.<ext>`，含 mime / size / kind 校验、文件名 sanitize、ffprobe 探测时长。
- ✅ **静态资源**：`MixcutAsyncConfig` 加 `/static/mixcut-assets/**` 映射到本地目录。`web-celebrity` 的 `next.config.mjs` 的 `/static/:path*` rewrite 自动覆盖。
- ✅ **multipart 限额**：`application.yml` 加 `spring.servlet.multipart.max-file-size=200MB`、`file-size-threshold=4MB`，环境变量 `AEP_UPLOAD_MAX_FILE_SIZE` 可覆盖。
- ✅ **render worker 改造**：`MixcutRenderingService.resolveBindings()` 把 slot_binding 真实解析为本地文件：
  - `binding.asset_id` → 查 `MixcutAsset` 表拿 `localPath`
  - `binding.file_url` → 若是本 server `/static/mixcut-assets/...` 直接 resolve；否则 HTTP 下载
  - 都找不到才 fallback 到 demo showreel
- ✅ **真实贴图叠加**：`renderOneVariant` 把用户上传的 image/sticker 真实 `overlay` 到底层视频上（不再是固定半透明色卡）。最多 3 张，按「单张 → 底部中」「两张 → 顶 + 底」「三张 → 左上 / 右上 / 底中」分布；ffmpeg 自动 scale 到不超过 60% 画面宽。
- ✅ **前端 API 层**：`api/mixcut.ts` 增 `MixcutAssetsApi`（`listAssets / uploadAsset / deleteAsset`）；`uploadAsset` 直接用 `fetch + FormData`（不能走 apiFetch 默认 JSON）；`deleteAsset / listAssets` 走 apiFetch。
- ✅ **前端类型**：`components/mixcut-zone/types.ts` 加 `MixcutAssetKind` + `MixcutAsset`。
- ✅ **SlotInput 真上传**：`user_upload` 策略真实调 `uploadAsset` → 拿到 file_url；"从我的素材选" 调 `listAssets({ kind })` 拉真后端列表（不再 import mock）。
- ✅ **SlotInput 真素材库**：`library_select` 策略 `star_clips` / `bgm` / `sticker` 全部走 `listAssets({ kind: 映射 })`；面板里内置上传按钮（即上即用）。
- ✅ **`/mixcut/library` 真 CRUD**：4 tab（video / image / sticker / bgm）懒加载、上传 dialog、删除 confirm、视频 hover 自动播放、图片缩略图、BGM audio 控件。
- ⚠️ **生产化未做**：OSS（仍本地 fs）；`/api/mixcut/assets/**` permitAll → 应改 `.authenticated()` + `ownerUserId` 校验；视频自动抽帧缩略图；分片上传 / 断点续传。

**新增配置**（默认值即可，按需通过 env 覆盖）：

```yaml
spring.servlet.multipart:
  max-file-size: 200MB        # AEP_UPLOAD_MAX_FILE_SIZE
  max-request-size: 200MB     # AEP_UPLOAD_MAX_REQUEST_SIZE

aep.mixcut:
  asset-dir: ./mixcut-assets               # AEP_MIXCUT_ASSET_DIR
  asset-public-url-base: /static/mixcut-assets  # AEP_MIXCUT_ASSET_URL_BASE
```

**E2E 验证**：
- 前端 `/mixcut/library` 上传贴图 → 真落 `./mixcut-assets/<userId>/<id>.png` + DB 入库
- `/mixcut/create/<id>` 中 user_upload slot 上传视频 → 拿到 asset_id 写入 binding
- 提交任务 → worker 用真实视频 + 真实贴图 ffmpeg 渲染 → `applied_transforms.overlay_source = "user-upload"` + `overlays_detail` 写明实际叠加文件名

### v0.8 · 2026-05-17 · 混剪专区真后端（ffmpeg 渲染）

- ✅ **后端实施**：`apps/server` 新增完整 mixcut 渲染管线（不再 mock）：
  - **Entity / Repo**：`MixcutRenderJob` + `MixcutRenderOutput`（JPA auto-update 自动建表 `mixcut_render_job` / `mixcut_render_output`）
  - **Service**：`MixcutJobService`（CRUD，事务内 dispatch；用 `TransactionSynchronization.afterCommit` 等事务提交后再触发 worker，避免新事务读不到 job）
  - **Worker**：`MixcutRenderingService` `@Async("mixcutExecutor")` —— 真实 ffmpeg CLI 编排（拼接 / 贴图 / 随机剪切 + perturbation 参数随机化）
  - **CLI 包装**：`FfmpegRunner`（ProcessBuilder + 超时 / stderr 收集）+ `AssetDownloader`（HTTP 下载 + SHA-256 cache）
  - **Controller**：`MixcutController` — `GET/POST/PATCH /api/mixcut/jobs{/{id}{/progress}}`
  - **静态服务**：`MixcutAsyncConfig` 实现 `WebMvcConfigurer.addResourceHandlers` 把 `/static/mixcut/**` 映射到外部目录 `./mixcut-output`
- ✅ **真实 ffmpeg pipeline 演示**：每个变体真做 3 件事：
  - **视频拼接** — `concat` filter 串接 2 个不同明星片段（每段 7.5s）
  - **图片贴图** — `overlay` 半透明色卡 + `drawbox` 装饰条带（注：`drawtext` 需 ffmpeg + libfreetype，brew 默认不带；已退化为色块）
  - **随机剪切** — 每段 `-ss` 随机 offset，每个变体不同 (`segments_detail` 记录起始时间)
  - **Perturbation** — `eq=brightness:saturation` + 可选 `hflip` + `setpts=*PTS` 速度变化，参数幅度按 light/moderate/aggressive 三档
- ✅ **前端开关**：`src/api/mixcut.ts` 加 `NEXT_PUBLIC_MIXCUT_USE_REAL=1` 独立开关；不设时回退 USE_MOCK 全局行为。当前 `.env` 已 `USE_MOCK=0` —— 全 app 走真后端。
- ✅ **前端 rewrite**：`next.config.mjs` 追加 `/static/:path*` → `${apiBase}/static/:path*`，让 mp4 通过 Next dev 代理（不直暴 8080）。
- ✅ **新配置**：`apps/server/src/main/resources/application.yml` 加 `aep.mixcut.*`（output-dir / work-dir / ffmpeg-bin / public-url-base / max-concurrent / max-output-duration-sec / max-asset-bytes / ffmpeg-timeout-ms）。
- ✅ **本地依赖**：`/opt/homebrew/bin/ffmpeg` 8.1.1；demo 素材回退到 `apps/web/public/videos/showreel-0[1-5].mp4`。
- ⚠️ **生产化未做**：OSS 对象存储（仅本地 fs）；`drawtext` 中文字幕（需 libfreetype + 字体）；watermark 像素水印（仅 metadata token）；多 worker 并发上限（当前 2）。

**启动流程**：
```bash
# 终端 1：后端（启动一次即可，会自动建表）
cd apps/server && ./mvnw spring-boot:run

# 终端 2：前端
pnpm dev:celebrity     # http://localhost:3012

# 浏览器：进入 /mixcut/templates/<id> → /mixcut/create/<id> → 提交 → 跳转 /mixcut/jobs/<jobId>
# 等 5~15s 看到 success + 2 个变体；点击产出可播放真实 ffmpeg 渲染结果。
```

### v0.7 · 2026-05-17 · 混剪专区内嵌

- ✅ **整体内嵌**：把独立项目 `/Users/donis/dev/mixcut/frontend`（Next 14 + Tailwind 3 + Zustand + 13 页）裁到核心 7 页，作为 `(workspace)/mixcut/*` 子树挂入本 app。
- ✅ **范围裁剪**：保留 dashboard / templates / templates[id] / create[id] / jobs / jobs[id] / library；丢弃 courses / account / agent / admin/trace / activate（与本 app 已有功能重复或非核心）。
- ✅ **Next 16 适配**：3 个 `[id]` 动态段全部拆分为 server outer + client inner（`page.tsx` 中 `await params`，client 中 `useState/useEffect` 读 store）。
- ✅ **Tailwind v4 适配**：`src/styles/app.css` `@theme {}` 追加 `--color-brand-{50..950}` + `--color-fuchsia-{300..600}` 映射到紫罗兰 accent；mixcut 业务字面量 `bg-brand-500` / `from-brand-500 to-fuchsia-500` 自动落到 Creator 主题。新增 `@utility scrollbar-thin / text-balance / grid-pattern / gradient-radial` + `animate-fade-in / animate-shimmer`。
- ✅ **Zustand 拆除**：`mixcut/lib/store.ts` 完全弃用 → `src/api/mixcut.ts` 单一访问点 + localStorage write-through（同 `api/products.ts` 范式）；激活码 / 设备 / 登录态由 celebrity 的 `AuthProvider` 接管，mock 演示态用固定 `mockActivationCode`。
- ✅ **UI 自带一份**：mixcut 用到的 12 个 shadcn 原语（badge / button / card / checkbox / input / label / progress / separator / slider / tabs / textarea / tooltip）复制到 `components/mixcut-zone/ui/`，独立于 `@ai-star-eco/ui` 避免样式漂移（与 celebrity-zone 同模式）。`button.tsx` 与 `badge.tsx` 中 `from-brand-500 to-fuchsia-500` 改为 `from-brand-500 to-brand-700` 保留紫罗兰明暗渐变。
- ✅ **sidebar 接入**：`(workspace)/layout.tsx` 「制作」组追加「混剪专区」入口（`Scissors` 图标）；selected 判定 `pathname === "/mixcut" || pathname.startsWith("/mixcut/")` 支持子路径高亮；`CrumbsFromPathname()` 补 6 条 mixcut 子路径 breadcrumb 映射。
- ✅ **依赖**：本 app `package.json` 显式追加 `@radix-ui/react-{checkbox,label,progress,separator,slider,slot,tabs,tooltip}` + `class-variance-authority` / `clsx` / `tailwind-merge` / `nanoid`；不引入 zustand。
- ✅ **测试门**：`pnpm --filter @ai-star-eco/web-celebrity typecheck` 零错误。

### v0.6 · 2026-05-15 · README 落地 + tsconfig 收尾

- ✅ **CG-1**：`tsconfig.json` 加 `"ignoreDeprecations": "6.0"`，消除 TS 7.0 baseUrl 弃用警告。
- ✅ **CG-5**：补本 README，对齐 drama README 的版本日志纪律。
- 备注：本工程是三个新 app 里最干净的 —— 0 处 TODO / FIXME / `as any` / `@ts-ignore`。仅 `src/constants/celebrity-zone-ui.ts:165` 的 `hint: "尚未对您授权"` 是业务文案，不算技术债。

### v0.5 · 2026-05-13 · Phase 4b · celebrity-zone 迁入

- ✅ **组件迁入**：`apps/web/src/components/celebrity-zone/` 33 个组件 → `apps/web-celebrity/src/components/celebrity-zone/`。
- ✅ **路由生产级化**：工作台路由采用 route group `(workspace)`（不出现在 URL），顶层路径：`/dashboard`（今日总览）、`/market`（明星市场）、`/cast`（我的明星）、`/projects` + `/projects/[projectId]`、`/products`（商品库）、`/library`（视频中心）、`/data`（数据中心）；明星详情独立段 `/star/[starId]` + `/star/[starId]/apply` + `/star/[starId]/generate`。
- ✅ **shell**：`(workspace)/layout.tsx` 提供独立 sidebar + topbar（`CelebrityShellProvider`，复用 `useAuth` 的 logout / wallet）。
- ✅ **鉴权**：由 `app/providers.tsx` 的 `AuthProvider`（publicPrefixes `["/","/login","/activate"]`，`"/"` exact-match）承担。
- ✅ **landing CTA**：`ProductLanding.postLoginPath="/dashboard"` 让登录后落到工作台。
- ✅ **链接统一**：所有组件 / mocks 里 hard-coded 的 `/producer/celebrity-zone/...` 与旧 `/console/...` 链接统一替换为新顶层路径。旧 `/console[?tab=xxx]` 由 `src/proxy.ts` 308 重定向兼容。
- ✅ **测试门**：`pnpm typecheck:all` 七个 workspace 全绿；`pnpm dev:celebrity` 后 `/`、`/dashboard`、`/market`、`/star/star-liu-tao` 均 HTTP 200。

### v0.4 · 2026-05-09 · Phase 4a shell

- 三个新 web app shell + landing 全部 dev HTTP 200；root layout 注入 Inter + Space_Grotesk；`AppProviders` 包 `ThemeProvider` + `AuthProvider`；landing page 强制 `"use client"`。

## 待办

完整待办（含 C-1 ~ C-2 + 跨工程 CG-* 状态）见仓库根 [`TODO.md`](../../TODO.md) §「三子产品 web app 待办」。本 README 不再独立维护待办，避免与根 TODO 漂移。
