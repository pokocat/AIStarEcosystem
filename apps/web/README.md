# apps/web_new — Next.js 14 port of the Figma prototype

本项目是 Figma Make 原型（导出在 `../../figma/`）的 Next.js 14（App Router）重写版本，与 `apps/web` 并存，共享 `apps/server` 后端。

**当前版本：v2.4.0（2026-04-19）**
v2.4 创作工坊 LLM Playground：新建 `generation` 领域五件套；StudioPage 从 ProducerDashboard 抽离并重写，接入 `AIGenerationPanel`（阶段 stepper + typewriter 流式对话 + 结构化 draft 采纳）；作品列表改为按 `activeArtist.id` 过滤真实 Song；侧栏新增"音乐工坊"入口指向 `MusicBusiness`。
v2.3（2026-04-19）音乐工坊 P1：新增歌曲详情抽屉（改标题/曲风/封面/歌词 + 只读扣费信息）、近 30 天播放/收入趋势折线图、已发布歌曲"分发"按钮跳转 `?tab=distribution`。v2.2（2026-04-18）打通了 P0 主动脉：Song 绑定 artistId、"开始创作"→ `MusicGenerationDialog` → `MusicApi.createSong` → 内联试听；Album 降级为"歌手歌单"，Concert 仅保留线上直播占位。见 product_spec.md §10。
自 v2 起，前端以 `src/types/*` 为数据契约的唯一真值源。后端 `specs/openapi.yaml` 与前端的差异记录于 [`specs/FRONTEND_CONTRACT_DIFF.md`](specs/FRONTEND_CONTRACT_DIFF.md)。

## 快速开始

```bash
cd apps/web_new
npm install
cp .env.example .env.local    # 按需填写 NEXT_PUBLIC_API_BASE_URL
npm run dev                   # http://localhost:3002
npm run build
npm test
```

### 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | 置 `1` 时 API 层直接返回 `src/mocks/` 静态数据，不发请求 | `0` |
| `NEXT_PUBLIC_API_BASE_URL` | 后端基础地址 | `/api` |
| `NEXT_PUBLIC_SERVER_API_BASE` | 旧式 `/api/server/**` 反向代理目标（legacy） | `http://localhost:8080` |

## 目录结构（v2）

按领域组织，每个业务域统一由三件套组成：`types/<domain>.ts`（类型）、`mocks/<domain>.ts`（样本数据）、`constants/<domain>-ui.ts`（UI 静态配色 / 图标 / 标签）。

```
src/
├── app/                    # Next.js 路由
│   ├── page.tsx            # /
│   ├── portal/             # /portal
│   ├── fan/                # /fan
│   ├── producer/           # /producer
│   ├── producer-intro/     # /producer-intro
│   └── coach/              # /coach
│
├── types/                  # 【真值源】前端定义的领域模型
│   ├── _shared.ts          # Rarity / ID / ISODateTime / Money / ApiResponse / PaginationMeta / ListQuery
│   ├── artist.ts           # Artist + 7 类 ArtistType + 6 维 TalentProfile
│   ├── music.ts            # Song / Album / Concert / MusicGenre
│   ├── film.ts             # Drama / Movie / Advertisement / VoiceWork
│   ├── wardrobe.ts         # ClothingItem / EquippedSlots / SavedOutfit
│   ├── pose.ts             # Pose / Expression / Gesture
│   ├── fan.ts              # FanArtist / TrackItem / NFTItem / FanProfile
│   ├── coach.ts            # SignedArtist / DistributionQueueItem / CopyrightItem
│   ├── distribution.ts     # Platform / DistributionContentItem
│   ├── community.ts        # FanTier / FanActivity / CommunityEvent
│   ├── finance.ts          # Transaction / MonthlyRevenuePoint / RevenueSource
│   ├── notification.ts     # Notification
│   ├── settings.ts         # SubscriptionPlan / BillingRecord
│   └── navigation.ts       # CommandItem（全局命令面板）
│
├── mocks/                  # 样本数据（中文）
│   └── (与 types/ 同构：artists, music, film, wardrobe, pose, fan, coach,
│         distribution, community, finance, notifications, settings)
│
├── constants/              # UI 静态资源
│   ├── *-ui.ts             # 每个域的配色 / 图标 / 标签映射
│   ├── command-items.ts    # 命令面板页面清单
│   ├── fab-actions.ts      # 浮动操作按钮
│   ├── settings-sections.ts
│   └── nft-dialog-ui.ts    # NFT 铸造对话框文案 + 稀有度图标
│
├── api/                    # ★ v2 新增：API 封装层
│   ├── _client.ts          # apiFetch + USE_MOCK 开关 + ApiError
│   ├── artists.ts          # 统一签名：async function xxx(): Promise<T>
│   ├── music.ts
│   ├── film.ts
│   ├── fan.ts
│   ├── coach.ts
│   ├── wardrobe.ts
│   ├── pose.ts
│   ├── distribution.ts
│   ├── community.ts
│   ├── finance.ts
│   ├── notifications.ts
│   ├── settings.ts
│   └── index.ts            # 以命名空间聚合：ArtistsApi / MusicApi / ...
│
├── components/             # 业务组件
│   ├── ui/                 # 46 个 shadcn/ui 基础组件
│   ├── producer/           # Producer 后台子页面
│   └── ...                 # 顶层页面组件（FanAppFull / CoachDashboardFull / ...）
│
├── lib/
│   ├── api.ts              # legacy fetcher → /api/server/**（留作兼容）
│   └── ...
│
└── styles/
    ├── app.css
    └── globals.css         # 设计令牌（从 Figma 原样复制）
```

### 组件如何访问数据

```ts
// ✅ v2 推荐
import { MusicApi } from "@/api";
const songs = await MusicApi.listSongs();  // USE_MOCK=1 时走 mocks/music.ts

// ✅ 直接用 mock（测试 / SSG）
import { SONGS } from "@/mocks/music";

// ✅ 类型
import type { Song } from "@/types/music";
```

## 后端契约对齐

- 真值源：`src/types/*`
- 参考契约：`../../specs/openapi.yaml`
- 差异清单：[`specs/FRONTEND_CONTRACT_DIFF.md`](specs/FRONTEND_CONTRACT_DIFF.md)

后端接入时请按 `FRONTEND_CONTRACT_DIFF.md` 推进。前端仅需修改 `src/api/*` 的请求路径与解包逻辑，业务组件无需改动。

## 架构要点

- **Next.js 14 App Router** — 每个顶层页面对应一条路由（`/`, `/portal`, `/fan`, `/producer-intro`, `/producer`, `/coach`）。
- **Tailwind v4** 经 `@tailwindcss/postcss`；设计令牌来自 Figma（OKLCH + Inter / Space Grotesk）。
- **shadcn/ui primitives** — 46 个 Radix 基础组件。
- **中文单语** — 自 v2 起移除多语言切换，全部页面与文案统一使用简体中文。原 `src/translations.ts` / `lang-context` 仍保留但不再被任何业务组件读取（等待清理）。
- **主题系统** — `src/components/ThemeProvider.tsx`（6 套主题：cyberpunk / glassmorphism / gradient / neumorphism / terminal / minimal）。
- **Figma 源码修复** — 移植过程修正了三处 TS 严格模式下无法编译的缺陷（见版本日志 v1）。

## 版本日志

### v2.4.0 — 2026-04-19（本次）
- **创作工坊 LLM Playground**：StudioPage 从 `ProducerDashboard.tsx` 拆出为 `src/components/producer/StudioPage.tsx`，接入新 `AIGenerationPanel`，模拟与大模型对话逐段流式生成数字音乐草案；采纳后走 `MusicApi.createSong` 落库为新 Song。
- **新增 generation 领域五件套**
  - `src/types/generation.ts` — `GenerationStage`、`StreamStage`、`GenerationMessage`、`GeneratedMusicDraft`、`GenerationRequest`、`GenerationResult`。
  - `src/mocks/generation.ts` — `STAGE_SEQUENCE`、`STAGE_SCRIPT`（5 阶段分组脚本，支持 `{{prompt}}` / `{{artist}}` 插值）、`MOCK_DRAFTS`（4 条候选产物）。
  - `src/constants/generation-ui.ts` — `STAGE_CONFIG`（图标 + 色板）、`STREAM_CHUNK_SIZE`、`STREAM_INTERVAL_MS`、`STAGE_HOLD_MS`、`PRE_ANALYZE_MS`。
  - `src/api/generation.ts` — `runGeneration(req)` 预埋后端对接锚点（组件侧走 typewriter 本地模拟，未 import）。
  - `src/api/index.ts` — `export * as GenerationApi from "./generation";`
- **新增 `src/components/producer/AIGenerationPanel.tsx`**：阶段 stepper、typewriter 吐字、光标闪烁、采纳 / 再生成 / 停止按钮、模型与深度选择（复用 `MODEL_VERSION_OPTIONS` / `THINK_DEPTH_OPTIONS`）。
- **作品列表真数据驱动**：按 `activeArtist.id` 过滤 `MusicApi.listSongs()` 结果，AI 生成新歌立即 prepend。
- **ProducerDashboard**：
  - 删除原 inline `StudioPage`（130 行旧 UI 废弃）。
  - 侧栏新增 `{ id: 'music', icon: Music, zh: '音乐工坊' }`，挂接 `MusicBusiness`。
- **admin 镜像** — `apps/admin/src/types/generation.ts`（新增 `GenerationJob` 审计实体：userId/artistId/prompt/status/creditsSpent/resultSongId 等）、`mocks/generation.ts`（4 条覆盖 running/done/aborted/error 的样本）、`api/generation.ts`（`listJobs`、`getJob`、`abortJob`、`refundJob`）、`api/index.ts` 追加 `GenerationApi`。
- **契约增量**：`POST /me/generation/run`（预留后端钩子）、`GET/POST /admin/generation/jobs[/:id][/abort|/refund]`（admin 审计）。

### v2.3.0 — 2026-04-19
- **音乐工坊 P1 三件**：（1）歌曲详情抽屉；（2）近 30 天趋势折线图；（3）分发跳转。
- **types** — `src/types/music.ts` 新增 `MusicTrendPoint`。
- **mocks** — `src/mocks/music.ts` 新增 `MUSIC_TRENDS_30D`（合成 30 天趋势，周末系数 +25% 作为波动示例）。
- **api** — `src/api/music.ts` 新增 `updateSong(id, patch)` / `listTrends30d()`。
- **components**
  - 新增 `src/components/producer/SongDetailDrawer.tsx`：shadcn Sheet 抽屉，允许修改 title / genre / coverUrl / lyrics；展示只读的状态、扣费、模型、深度、统计。
  - 新增 `src/components/producer/MusicTrendChart.tsx`：recharts AreaChart，支持 plays / revenue 维度切换。
  - `MusicBusiness.tsx`：每张歌曲卡片加 Edit3 图标按钮 → 打开抽屉；overview Tab 插入趋势图卡片；released 状态的"分发"按钮调 `router.push('?tab=distribution&songId=...')`。
- **server** — `AccountController` 新增 `PATCH /api/me/songs/{id}`（校验 artistId → DigitalIp.ownerUserId，允许改 title/genre/coverUrl/lyrics/duration）。
- **admin/三端同步** — 本次仅前端改动；admin types/mocks 已在 v2.2 对齐。

### v2.2.0 — 2026-04-18
- **音乐工坊 P0 主动脉打通**（see product_spec.md §10）：`MusicBusiness.tsx` 里原本死掉的"开始录制 / 继续制作 / 推广售票"按钮接入真实流程。
- **types** — `src/types/music.ts`：`Song` 增 `artistId`（必填）/ `audioUrl` / `coverUrl` / `lyrics` / `modelVersion` / `thinkDepth` / `creditsSpent` / `createdAt`；`Album` 降级为 "AI 歌手歌单"（删 `trackCount`/`status`/`sales`/`revenue`，改用 `artistId` + `trackIds`）；`Concert` 简化为 `artistIds` + `streamUrl`。新增 `CreateSongRequest` / `ThinkDepth`。
- **mocks** — `src/mocks/music.ts`：每首 Song 绑定 `artistId`，`audioUrl` 使用占位 URL（未来迁 OSS）。
- **constants** — `src/constants/music-ui.ts`：移除 Album 状态色，新增 `SONG_STATUS_LABEL` / `CONCERT_STATUS_LABEL` / `PLACEHOLDER_AUDIO_URL` / `MODEL_VERSION_OPTIONS` / `THINK_DEPTH_OPTIONS` / `mockCreditsFor()`。
- **api** — `src/api/music.ts`：新增 `createSong(req)` / `advanceSongStatus(id, next)`；list 端点迁至 `/me/*`。
- **component** — `src/components/MusicBusiness.tsx` 重写：按当前 artist 过滤作品；"开始创作"接入 `MusicGenerationDialog`；内联 `<audio>` 播放；状态流转（recording → mixing → released）；"歌单 / 线上直播"Tab 改文案。
- **三端同步** — `apps/admin/src/types|mocks/music.ts` 同步新字段（遗留字段标 @deprecated 供过渡页面）；`apps/server` Song 新增列 + SongDto 扩展 + AccountController 增 `GET /api/me/songs` 与 `POST /api/me/songs`（校验艺人 ownership + 占位扣 credits）。
- **契约差异** — `specs/FRONTEND_CONTRACT_DIFF.md` 将追加"音乐工坊 §10"小节。

### v2.1.0 — 2026-04-18
- **新增**：Producer 侧 "AI 形象锻造炉"（原 Figma 新增 `AppearanceForge`）。
- **types** — `src/types/appearance-forge.ts`：`ForgeMode` / `ForgeTemplate` / `LabeledOption` / `FaceSlider` / `ColorScheme` / `ForgeRequest` / `ForgeResult` / `ForgeOptions`。
- **mocks** — `src/mocks/appearance-forge.ts`：6 套模版、6 款发型、6 款瞳色、8 类风格标签、6 项面部滑块、4 套主题配色。
- **constants** — `src/constants/appearance-forge-ui.ts`：4 种锻造模式的 icon/渐变/文案；伪异步时长、历史缓存上限。
- **api** — `src/api/appearance-forge.ts`：`getForgeOptions` / `listForgeHistory` / `generateForge` / `saveForgeBlueprint`，以 `USE_MOCK` 切换；API 入口追加 `AppearanceForgeApi` 命名空间。
- **component** — `src/components/producer/AppearanceForge.tsx`：zh-only；`ProducerDashboard` 左侧栏"艺人管理"分组加入 `AI形象锻造`（id=`appearance`）。
- **契约差异** — `specs/FRONTEND_CONTRACT_DIFF.md` 新增 "AppearanceForge" 章节，标记为"仅前端存在（后端待补）"。

### v2.0.0 — 2026-04-17
- **重构目标**：将前端建立为数据契约的唯一真值源，为后端接入铺设可切换的 API 封装层。
- **P0 领域骨架** — 新建 `src/types/_shared.ts`（`Rarity` / `ID` / `ISODateTime` / `Money` / `ApiResponse` / `PaginationMeta` / `ListQuery`）。
- **P1 艺人域** — `src/types/artist.ts` + `src/mocks/artists.ts`；支持 7 类艺人、6 维才艺、稀有度四档。
- **P2 Producer 子页面** — 拆出 `navigation.ts`（命令面板）、`fab-actions.ts`（浮动按钮）、`settings.ts`（订阅 / 账单）。
- **P3 顶层业务域** — 新建 music / film / wardrobe / pose / fan / coach 六套三件套；`CommunityHubFull` / `MonetizationSuite` / `DistributionHub` 配套数据也独立成域。组件从内联数据改为从 `@/mocks/*` 导入。
- **P4 NFT 对话框** — 从 `NFTMintingDialog.tsx` 抽出 `nft-dialog-ui.ts`（55 项中文文案 + 稀有度 icon 配置），删除组件内 `lang` 参数。
- **P5 契约对比** — 生成 `specs/FRONTEND_CONTRACT_DIFF.md`，记录与 `specs/openapi.yaml` 的 62 项字段差异、14 个领域的对齐状态，以及后端待补项（film / community 两大空白域）。
- **P6 API 层** — 新建 `src/api/*`；统一 `apiFetch` + `USE_MOCK` 开关。组件只需调用 `MusicApi.listSongs()` 等命名空间函数，切换前端 / 后端数据源零成本。
- **i18n 清理** — 所有组件中的 `zh ? xxx : yyy` 三元已消除，切语按钮仍保留但已无实际作用（待下一次迭代彻底移除）。

### v1.x — 移植自 Figma 原型（历史）
- 去除 Figma Make 的版本化导入（`@radix-ui/react-slot@1.1.2` → `@radix-ui/react-slot`）。
- 为 `src/components/` 下所有文件加 `"use client"`。
- `Portal` / `ProducerIntro` 从 Figma `App.tsx` 抽成独立文件。
- 修复三个 TS 严格模式编译缺陷：
  - `PoseLibrary.tsx:11` — lucide-react 无 `Peace`，改为 `HandMetal as Peace`。
  - `producer/ArtistRadarCard.tsx:151` — `TypeConfig` 无 `textColor` 字段，改用 `color`。
  - `producer/SettingsPage.tsx:208` — `<ThemeSwitcher />` 缺 `lang` prop，补齐。

## 与 Figma 原型的已知差异

- **路由切换动画** — Figma 在整棵应用外包 `<AnimatePresence>` 做页面淡入淡出；App Router 独立渲染每个路由，跨页动画消失，页面内动画保留。
- **`<img>` 直用 Unsplash** — 未替换为 `next/image`；`npm run lint` 会告警但不阻塞构建。
- **Supabase 边缘函数** — `figma/src/supabase/` 未移植，统一使用 `apps/server`。
- **Google Fonts** — 经 `@import` 写在 `globals.css`，与 Figma 一致；Next 的 CSS 优化会提示 `@import` 应置于其它规则之前，为无害警告。
- **无鉴权** — `apiFetch` 尚未处理 token / session，与 `apps/server` 当前 Phase 1 阶段保持一致。

## 构建与测试结果（本次版本）

```
npx tsc --noEmit : ✓ 0 errors
npm run build    : ✓ 7 routes — producer 298 kB / coach 250 kB / fan 146 kB / home 162 kB
vitest run       : ✓ 现有 3 个用例通过（src/lib/api.test.ts）
```
