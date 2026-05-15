# AI 音乐人 · Music Studio

面向 MCN 的歌手类 AI 数字人 IP + 音乐工作台。Next 16.2.6 + React 19 + Tailwind v4 + pnpm workspace。

## 启动

```bash
# 在仓库根目录
pnpm install
pnpm dev:music       # http://localhost:3010
pnpm --filter @ai-star-eco/web-music typecheck
pnpm --filter @ai-star-eco/web-music build
```

USE_MOCK 默认开启（`@ai-star-eco/api-client` 导出的 `USE_MOCK` 读 `NEXT_PUBLIC_USE_MOCK`，无 `.env.local` 时按 mock 走）。所有 `src/api/*.ts` 在 mock 模式下命中本地数据；real 模式走 `apiFetch` → Next rewrites → `apps/server:8080`。

## 路由结构

不带 `/console` 前缀，公开页与工作区共存：

```
/                    ← 公开 landing（ProductLanding 原语 + postLoginPath="/dashboard"）
/login               ← 公开
/dashboard           ← 工作区总览（AgencyOverview + ActivityFeed）
/artist              ← 单艺人聚焦视图（默认选中 IP）
/artists             ← 艺人矩阵（MCNMatrix）
/incubator           ← 新艺人孵化向导（IncubationWizardV2 多步表单 + draft 持久化）
/appearance          ← 形象锻造（AppearanceForge.v3，Coze event stream 占位）
/wardrobe            ← 戏服 / 道具（WardrobeSystem，上传 + 分配）
/studio              ← 音乐工坊（MusicLibrary + 生成 dialog）
/music               ← 单曲详情入口（SongDetailDrawer）
/copyright           ← 版权 / NFT（NFTMintingDialog）
/distribution        ← 多平台分发
/community           ← 粉丝社区（mock-only，OpenAPI 未覆盖）
/finance             ← 财务中心（充值 / 提现 / 流水）
/settings            ← 工作室设置
```

`/console`、`/console?tab=xxx`、`/console/*` 通过 `src/proxy.ts` 308 重定向到对应新路径。`TAB_MAP` 覆盖 13 个旧 tab id；下一版本（无残留旧书签时）删除。

## 共享组件

- `src/components/producer/` — 工作台主组件（22 个 + `dashboard/` 子目录）：`AppearanceForge.v3` / `IncubationWizardV2` / `MCNMatrix` / `MusicLibrary` / `WardrobePageV2` / `StudioPage` / `CopyrightPage` / `DistributionPage` / `CommunityPage` / `FinancePage` / `SettingsPage` / `CommandPalette` / `NotificationPanel` / `SkeletonLoader` 等。
- `src/components/landing/` — landing page 模块（强制 `"use client"`，避免 Server→Client 传递 LucideIcon 函数）。
- `src/components/` 根目录 — 跨页面 dialog / drawer：`MusicGenerationDialog` / `NFTMintingDialog` / `ArtistSigningDialog` / `ArtistListingDialog` / `GlobalAudioPlayer` / `OnboardingGuide` / `ThemeSwitcher` / `ToastNotification` / `PoseLibrary`。
- `@ai-star-eco/ui`（共享包）— 48 个 shadcn 原语 + `ThemeProvider` + Tailwind v4 globals.css。字体由 root layout 通过 `next/font/google` 注入（Inter + Space_Grotesk）。
- `@ai-star-eco/api-client`（共享包）— `apiFetch` / `AuthProvider` / `USE_MOCK` / `mockDelay`，token 仍 localStorage（cookie SSO TODO 见 `packages/api-client/src/_client.ts`）。

`(workspace)/layout.tsx` 提供独立 sidebar + topbar shell（`producer-shell-context.tsx` 的 `navigate(page)` 实现 id→href 映射：`overview → /dashboard`，其余 `/${id}`）；登录态由 `app/providers.tsx` 的 `AuthProvider` 承担（`publicPrefixes=["/","/login","/activate"]`，`loginPath="/login"`，`"/"` exact-match）。

## Mock 数据写入层

- `src/api/_client.ts` 重导出 `USE_MOCK` / `mockDelay`，业务 api/*.ts 顶部分支：`if (USE_MOCK) { ... } else { return apiFetch(...) }`。
- `community.ts` / `appearance-forge.ts` 标注「OpenAPI 尚未覆盖」/「AI 视频生成尚未接入」—— 全 mock，`USE_MOCK=0` 时仍走 `DEMO_VIDEO_POOL` 等本地池。
- `music.ts` / `artists.ts` / `wardrobe.ts` / `distribution.ts` / `finance.ts` / `copyright.ts`（store / products / pose / generation / notifications / settings 同节奏）—— 真后端落地后切实数据源，mock 分支保留。

## 版本日志

### v0.6 · 2026-05-15 · README 落地 + tsconfig 收尾

- ✅ **CG-1**：`tsconfig.json` 加 `"ignoreDeprecations": "6.0"`，消除 TS 7.0 baseUrl 弃用警告。
- ✅ **CG-5**：补本 README，对齐 drama README 的版本日志纪律。
- ⏳ 仍未做：M-1（6 处显式 TODO）/ M-2（26 处 `as any` 收敛）/ M-3（193 处 inline style 渐进迁移 Tailwind v4 token）。

### v0.5 · 2026-05-13 · Music 路由生产级化

- ✅ **路由重构**：`apps/web-music/src/app/console/*` → `(workspace)/*`，去 `/console` 前缀；overview 路径 `/console` → `/dashboard`。
- ✅ **shell context**：`producer-shell-context.tsx` 的 `navigate(page)` 改为 id→href 映射；layout legacy `?tab=` redirect 块删除，统一交给 `src/proxy.ts` 308 重定向兼容旧链接。
- ✅ **登录跳转**：`postLoginPath` / `defaultPostLoginPath` 改为 `/dashboard`。
- ✅ **三个子 app 统一**：music / drama / celebrity 现已全部统一为「`(workspace)` route group + 顶层语义化路径 + 旧 `/console` 由 `proxy.ts` 兼容」形态。

### v0.4 · 2026-05-09 · Phase 4a shell

- 三个新 web app shell + landing 全部 dev HTTP 200；root layout 注入 Inter + Space_Grotesk；`AppProviders` 包 `ThemeProvider` + `AuthProvider`；landing page 强制 `"use client"`。

## 待办（下一轮）

- ⏳ **M-1**：6 处显式 TODO 收尾 —— `translations.ts:2`（中文单语化兜底清理）、`api/community.ts:3` + `api/appearance-forge.ts:87`（OpenAPI 覆盖 / AI 视频生成接入）、`components/producer/dashboard/AgencyOverview.tsx:11`（待办建议数据源）、`IncubationWizardV2.tsx:923`（第一章校验）、`AppearanceForge.v3.tsx:925`（Coze event stream 实现）。
- ⏳ **M-2**：26 处 `: any` 集中清理，主要在 `IncubationWizardV2.tsx` / `MCNMatrix.tsx` / `WardrobeSystem.tsx` / `NFTMintingDialog.tsx` / `MusicGenerationDialog.tsx` / `OnboardingGuide.tsx`。先补 type 定义文件（`mbti.ts` / `radar.ts` / `track.ts`），逐文件替换。
- ⏳ **M-3**：约 193 处 `style={{}}` 渐进迁移到 Tailwind v4 token；高 ROI 集中点是 `AppearanceForge.v3.tsx` / `IncubationWizardV2.tsx` / `MCNMatrix.tsx`。颜色 / 间距优先；动态计算值（百分比、translate）保留 inline。
- ⏳ **M-4**：约 52 处 `<img>` 未确认 alt，跑 `pnpm lint` 借 `jsx-a11y/alt-text` 自动审。
- ⏳ **CG-3 types 上推**：本工程暂无 drama 那样的本地待上推 types，但 community / appearance-forge 域接入 OpenAPI 时同步上推到 `packages/types`。
- ⏳ **CG-4 proxy.ts /console 兼容**：观察期后删除（无旧书签来源后）。
