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
```

`/console`、`/console?tab=xxx`、`/console/*` 通过 `src/proxy.ts` 308 重定向：
- 旧 tab id（market / cast / projects / products / library / data）→ 对应顶层路径
- 详情页 `/console/star/<id>` → `/star/<id>`、`/console/projects/<id>` → `/projects/<id>`
- 透传其它 query（如 `?tier=trial`、`?action=distribute`）

下一版本（无残留旧书签时）删除。

## 共享组件

- `src/components/celebrity-zone/` — 33 个工作台主组件（从 `apps/web/src/components/celebrity-zone/` Phase 4b 迁入）：`CelebrityMarket` / `CelebrityStarDetail` / `CelebrityApplyForm` / `CelebrityGenerationWorkspace` / `CelebrityProjectDetail` / `CelebrityProductLibrary` / `CelebrityVideoLibrary` / `CelebrityDataCenter` / `CelebrityWatermarkVideo` / `CelebrityHeroCta` / `CelebrityAuthBanner` / `CelebrityPricingTierCard` / `CelebrityTemplateGallery` 等。
- `src/components/creator/` — 设计原语：`Button` / `GradientBlock` 等（系统化 inline style，多层 gradient 叠加）。
- `src/components/console/` — `(workspace)/layout.tsx` 引用的 sidebar + topbar shell（`CelebrityShellProvider`，复用 `useAuth` 的 logout / wallet）。
- `@ai-star-eco/ui`（共享包）— 48 个 shadcn 原语 + `ThemeProvider` + Tailwind v4 globals.css。字体由 root layout 通过 `next/font/google` 注入（Inter + Space_Grotesk）。
- `@ai-star-eco/api-client`（共享包）— `apiFetch` / `AuthProvider` / `USE_MOCK` / `mockDelay`，token 仍 localStorage（cookie SSO TODO 见 `packages/api-client/src/_client.ts`）。

`(workspace)/layout.tsx` 提供独立 shell（`CelebrityShellProvider`）；登录态由 `app/providers.tsx` 的 `AuthProvider` 承担（`publicPrefixes=["/","/login","/activate"]`，`loginPath="/login"`，`"/"` exact-match）；landing CTA 通过 `ProductLanding.postLoginPath="/dashboard"` 让登录后落到工作台。

## Mock 数据写入层

- `src/api/_client.ts` 重导出 `USE_MOCK` / `mockDelay`，业务 api/*.ts 顶部分支：`if (USE_MOCK) { ... } else { return apiFetch(...) }`。
- `src/api/celebrity-zone.ts` — 13 个函数已铺 USE_MOCK switch（市场 / 我的明星 / 项目 / 视频 / 数据中心 / 授权申请 / 生成 job）。
- `src/api/products.ts` — 商品 CRUD（USE_MOCK 走本地可变缓存）。
- 真后端尚未上线，USE_MOCK=0 分支保留 `apiFetch` 占位（507/501 后端原因）。

## 版本日志

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

## 待办（下一轮）

- ⏳ **C-3 inline style 收敛**：约 28 文件 `style={{}}`，集中在 `creator/Button.tsx`（微调 fontSize / padding 12.5/13.5/14.5）和 `creator/GradientBlock.tsx`（多层 gradient 叠加，动态值难替）。可缓做。
- ⏳ **CG-2 test 脚本**：与 music / drama 共同决策是否引入 vitest。
- ⏳ **CG-3 types 上推**：本工程暂无 drama 那样的本地待上推 types，但 `celebrity-zone` 域接入 OpenAPI 时同步上推到 `packages/types`，并同步 admin / server 字段对齐（CLAUDE.md 硬规则 1）。
- ⏳ **CG-4 proxy.ts /console 兼容**：观察期后删除（无旧书签来源后）。
- ⏳ **真后端落地**：13 个 celebrity-zone 函数 + products CRUD 等需 apps/server 配套 Spring 实体 + REST + DTO（field 命名严格 mirror TS interface）。
