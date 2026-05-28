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
/poses               ← 动作姿态库
/asset-center  ★v0.39 ← 素材中心（数字资产库 + 文案库 双 tab）
/production    ★v0.39 ← 制作工坊（切片制作 + AI 数字人 + 混剪批量 三 tab）
/studio              ← 音乐工坊（MusicLibrary + 生成 dialog）
/music               ← 单曲详情入口（SongDetailDrawer）
/copyright           ← 版权 / NFT（NFTMintingDialog）
/notices             ← 商业邀约
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

### v0.39 · 2026-05-28 · figma MCN 运营端「素材中心 + 制作工坊」迁入 {#v039}

按页迁移第一批：从 figma Make 原型 `it1dxlMSY0ph39pBCawC8i` 迁入 `mcn/AssetCenter`（含 AssetVault + CopyVault）和 `mcn/ProductionWorkshop`（含 ClipStudio + DigitalPersonHub + BatchMixStudio）。**零影响既有 15 个路由**，sidebar 内容创作组顺序插入 2 项。

**新增路由**：

| 路由 | 复合页 | 子 tab | 数据模型（packages/types） |
|---|---|---|---|
| `/asset-center` | AssetCenterPage | 数字资产库 / 文案库 | `asset` / `copy` |
| `/production`   | ProductionWorkshopPage | 切片制作 / AI 数字人 / 混剪批量 | `clip-studio` / `digital-person` / `batch-mix` |

**新增文件**（38 个）：

- **packages/types（5）**：`asset.ts` / `copy.ts` / `clip-studio.ts` / `digital-person.ts` / `batch-mix.ts` + `index.ts` 追加 5 行 export
- **apps/web-music/src/mocks（5）**：每页一份样本（与 figma 原型一一对齐）
- **apps/web-music/src/constants（5）**：UI 色板 + 图标 + 三阶段审批步骤定义 + 默认质检项模板
- **apps/web-music/src/api（5）**：USE_MOCK 分支齐全；约定后端端点：
  - `GET/POST /me/assets` + `POST .../{id}/freeze`
  - `GET/POST /me/copies` + `POST .../{id}/approve`（推进或驳回三阶段）
  - `GET/POST /me/clip-tasks` + `POST .../{id}/submit-qc`
  - `GET/POST /me/person-models` + `GET/POST /me/digital-person/gen-tasks` + `POST .../push-to-pool`
  - `GET/POST /me/mix-templates` + `GET/POST /me/batch-tasks` + `POST .../start` + `POST .../push-to-pool`
- **apps/web-music/src/api/index.ts** — 追加 5 namespace（AssetApi / CopyApi / ClipStudioApi / DigitalPersonApi / BatchMixApi）
- **apps/web-music/src/components/producer（7）**：5 个 panel 子组件 + 2 个 composer page
- **apps/web-music/src/app/(workspace)（2）**：路由 shell

**关键业务规则（来自 figma 原型注释，已沉淀到 packages/types JSDoc）**：

1. **文案三阶段审批**：`ops_review → partner_review → legal_review → approved`，任一阶段驳回即 `rejected` 终态；`approved` 自动锁定 version（content 不可改）
2. **6 项强制质检**：切片任务必须通过 黑屏/字幕/画幅/敏感词/品牌露出/授权范围 6 项，全过才可入池
3. **数字人生成门禁**：`copy.stage === "approved"` + 形象/声音模型 `status === "active"` 才可发起生成；frozen 模型禁用
4. **数字资产授权校验**：`Asset.authStatus === "expired" | "none"` 自动 `status = "frozen"`，所有引用方（混剪槽位、数字人生成）禁用

**迁入工程约束**（与 figma 原型的差异）：

- i18n 全部剥离（中文单语）
- 类型上提到 packages/types（前端 TS 是契约真源）
- mock / constants / api 完全外抽
- 数值字段一律 `number`（秒数 / 元 / 评分）；展示走 `lib/format` 或本地 `fmtClock` helper
- `"use client"` 全加
- 跨页引用（partnerName / authContract / copyVersion）暂用字符串标签；待对应主题页面（Partner / ContentLicense / CopyItem 的 CRUD 页面）迁入后升级为 ID 引用

**验收**：
- ✅ `pnpm typecheck:all` 7 个 workspace 全绿
- ✅ `pnpm build` web-music 21 routes 全部静态预渲染（含新 2 个）

**显式 out-of-scope**：
- apps/admin / apps/server 三端同步（等用户明确需求后再补）
- `specs/openapi.yaml` 端点定义（等 server 落地）
- 跨页 ID 引用升级（等 Partner / ContentLicense / CopyItem 的 CRUD 主页面也迁入）
- PublishPool（「入池」按钮目标页）

### v0.6 · 2026-05-15 · README 落地 + tsconfig 收尾 + any 大清扫

- ✅ **CG-1**：`tsconfig.json` 加 `"ignoreDeprecations": "6.0"`，消除 TS 7.0 baseUrl 弃用警告。
- ✅ **CG-5**：补本 README，对齐 drama README 的版本日志纪律。
- ✅ **M-2 部分**：23 处 `any` → 5 处（清扫 18 处，约 78%）：
  - 7 处 `icon: any` → `LucideIcon`：`OnboardingGuide` / `ActivityFeed` / `AgencyOverview` / `layout.tsx`（SidebarItemDef + getIcon item + iconMap Record）
  - 5 处 `activeSinger/artist: any` → `Artist`（已验证字段：name / avatar / level / talents）：`WardrobeSystem` / `PoseLibrary` / `NoticeBoard`
  - 3 处 `catch (e: any)` → `catch (e: unknown)` + `e instanceof Error ? e.message : 默认值`：`WardrobeSystem` / `PoseLibrary` / `SettingsPage`
  - 3 处 `typeConf: any` → `TypeConfig`（已验证 talentCaps / icon / extraPersona / primaryTalents 字段访问全兼容）+ `radarData: any[]` → 具体形状：`IncubationWizardV2` 全部 4 处
  - 2 处 cast 窄化：`MCNMatrix` `key as any` → `keyof typeof TALENT_LABELS`，`sortBy as any` → `'name' \| 'level' \| 'revenue'`
  - 1 处 `(slots as any)[k]` → `slots[k as EquipSlot]`：`WardrobeSystem`
- ⏳ **M-2 剩余 5 处**（保留理由明确）：
  - `NFTMintingDialog:25` `track?: any` / `MusicGenerationDialog:21+39` / `MusicBusiness:126 generated: any` —— 这 4 处的 mock track shape 用 `style` 字段而 `Song` 类型用 `genre`，且 `duration` 字符串/数字混用。要清需先 schema 对齐（或在 dialog 内部定义独立的 `GeneratedTrack` interface），属下一轮独立工作。
  - `TypeDistributionPie:41` `ActiveSliceShape(props: any)` —— recharts ActiveShape 形参类型由内部 sector 数据 + 用户配置 prop 混合，业内多保留 any，留作单独减债。
- ⏳ **M-1 评估**：原 backlog 6 处中只有 3 处是真 TODO（`translations.ts` 中文单语化清理 / `api/community.ts` OpenAPI 覆盖 / `api/appearance-forge.ts` AI 视频生成接入），且都是有依赖的后端任务；另 3 处（`AgencyOverview.tsx:11` 是 IA 设计注释、`IncubationWizardV2.tsx:923` 与 `AppearanceForge.v3.tsx:925` 是运行时 UI 文案）**不是代码 TODO，本次仅做 backlog 描述修正**。真 TODO 不动。
- ⏳ 仍未做：M-3（193 处 inline style）、M-4（52 处 img alt 审）。

### v0.5 · 2026-05-13 · Music 路由生产级化

- ✅ **路由重构**：`apps/web-music/src/app/console/*` → `(workspace)/*`，去 `/console` 前缀；overview 路径 `/console` → `/dashboard`。
- ✅ **shell context**：`producer-shell-context.tsx` 的 `navigate(page)` 改为 id→href 映射；layout legacy `?tab=` redirect 块删除，统一交给 `src/proxy.ts` 308 重定向兼容旧链接。
- ✅ **登录跳转**：`postLoginPath` / `defaultPostLoginPath` 改为 `/dashboard`。
- ✅ **三个子 app 统一**：music / drama / celebrity 现已全部统一为「`(workspace)` route group + 顶层语义化路径 + 旧 `/console` 由 `proxy.ts` 兼容」形态。

### v0.4 · 2026-05-09 · Phase 4a shell

- 三个新 web app shell + landing 全部 dev HTTP 200；root layout 注入 Inter + Space_Grotesk；`AppProviders` 包 `ThemeProvider` + `AuthProvider`；landing page 强制 `"use client"`。

## 待办

完整待办（含历史 M-1 ~ M-4 + 跨工程 CG-* 状态）见仓库根 [`TODO.md`](../../TODO.md) §「三子产品 web app 待办」。本 README 不再独立维护待办，避免与根 TODO 漂移。
