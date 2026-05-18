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
- `@ai-star-eco/ui`（共享包）— 48 个 shadcn 原语 + `ThemeProvider` + Tailwind v4 globals.css。字体由 root layout 通过 `next/font/google` 注入（Inter + Space_Grotesk）。
- `@ai-star-eco/api-client`（共享包）— `apiFetch` / `AuthProvider` / `USE_MOCK` / `mockDelay`，token 仍 localStorage（cookie SSO TODO 见 `packages/api-client/src/_client.ts`）。

`(workspace)/layout.tsx` 提供独立 shell（`CelebrityShellProvider`）；登录态由 `app/providers.tsx` 的 `AuthProvider` 承担（`publicPrefixes=["/","/login","/activate"]`，`loginPath="/login"`，`"/"` exact-match）；landing CTA 通过 `ProductLanding.postLoginPath="/dashboard"` 让登录后落到工作台。

## Mock 数据写入层

- `src/api/_client.ts` 重导出 `USE_MOCK` / `mockDelay`，业务 api/*.ts 顶部分支：`if (USE_MOCK) { ... } else { return apiFetch(...) }`。
- `src/api/celebrity-zone.ts` — 13 个函数已铺 USE_MOCK switch（市场 / 我的明星 / 项目 / 视频 / 数据中心 / 授权申请 / 生成 job）。
- `src/api/products.ts` — 商品 CRUD（USE_MOCK 走本地可变缓存）。
- `src/api/mixcut.ts` — 混剪专区：`listJobs / getJob / createJob / updateJobProgress` + `hasSeenIntro / setSeenIntro`。USE_MOCK 走 localStorage write-through，key：`aistareco.web.mixcut.jobs.v1` / `aistareco.web.mixcut.has-seen-intro.v1`。
- 真后端尚未上线，USE_MOCK=0 分支保留 `apiFetch` 占位（507/501 后端原因）。

## 版本日志

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
