# apps/web_new — Next.js 14 port of the Figma prototype

> 线上部署、`/web` 子路径访问、共享视频静态资源 `/static/videos`、以及本地联调方式见 [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)。

本项目是 Figma Make 原型（导出在 `../../figma/`）的 Next.js 14（App Router）重写版本，与 `apps/web` 并存，共享 `apps/server` 后端。

**当前版本：v2.7.0（2026-05-06）**
v2.7 AI 明星专区（Celebrity Zone）从零搭起：8 位真人明星 × 4 态授权流转 × 五页主流程（市场 / 详情 / 工作台 / 项目 / 项目详情）+ 视频库 / 商品库 / 数据中心三个聚合 Tab；模板 + 盲盒双模式生成工作台带分阶段过渡层与结果预览；视频缩略全部走 `<video>` 真实可播放（Pexels portrait livestreaming-selling 资源池）；引擎成本改为后端可配的「✦ 积分」单价并接入钱包余额 gating；新增独立商品库领域（types/mocks/api 全套 + localStorage write-through + 视频生成自动落库）。详见 `src/components/celebrity-zone/`、`src/types/{celebrity-zone,product}.ts`、`src/api/{celebrity-zone,products}.ts`。
v2.6 形象锻造「保存 + 关联短视频」：`POST /appearance-forge/save`（upsert）把一次锻造候选正式入库并为其分配 `videoUrl`，供艺人画廊 3D 视频预览消费；AI 视频生成未接入前，后端从 `DEMO_VIDEO_POOL` 两段本地 showreel mp4 中随机挑一个；三端 ForgeResult 契约同步补 `videoUrl?` 字段，openapi.yaml 首次落 Forge 域全部 schema + 5 个 path。
v2.5 经纪大盘拆分：经纪大盘 ↔ 艺人视图解耦（公司视角 / 个体视角两入口），新建 `components/producer/dashboard/`（hook + charts + roster + AgencyOverview + ArtistOverview），修复饼图 hover 深色底文字不可见、切片无反馈、窄屏塌缩等交互问题；经纪大盘新增状态分布 / 收入来源 / Top Performers / 旗下艺人矩阵。
v2.4（2026-04-19）创作工坊 LLM Playground：新建 `generation` 领域五件套；StudioPage 从 ProducerDashboard 抽离并重写，接入 `AIGenerationPanel`（阶段 stepper + typewriter 流式对话 + 结构化 draft 采纳）；作品列表改为按 `activeArtist.id` 过滤真实 Song；侧栏新增"音乐工坊"入口指向 `MusicBusiness`。
v2.3（2026-04-19）音乐工坊 P1：新增歌曲详情抽屉（改标题/曲风/封面/歌词 + 只读扣费信息）、近 30 天播放/收入趋势折线图、已发布歌曲"分发"按钮跳转 `?tab=distribution`。v2.2（2026-04-18）打通了 P0 主动脉：Song 绑定 artistId、"开始创作"→ `MusicGenerationDialog` → `MusicApi.createSong` → 内联试听；Album 降级为"歌手歌单"，Concert 仅保留线上直播占位。见 product_spec.md §10。
自 v2 起，前端以 `src/types/*` 为数据契约的唯一真值源。后端 `specs/openapi.yaml` 与前端的差异记录于 [`specs/FRONTEND_CONTRACT_DIFF.md`](specs/FRONTEND_CONTRACT_DIFF.md)。

## 快速开始

```bash
cd apps/web
npm install
cp .env.example .env.local    # 按需填写 NEXT_PUBLIC_API_BASE_URL
npm run dev                   # http://localhost:3002/web
npm run build
npm test
```

### 环境变量

| 变量 | 作用 | 默认 |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | 置 `1` 时 API 层直接返回 `src/mocks/` 静态数据，不发请求 | `0` |
| `NEXT_PUBLIC_API_BASE_URL` | 后端基础地址 | `/api` |
| `NEXT_PUBLIC_SERVER_API_BASE` | 旧式 `/api/server/**` 反向代理目标（legacy） | `http://localhost:8080` |
| `NEXT_PUBLIC_FORGE_VIDEO_BASE` | AI 形象锻造视频静态资源基路径；本地推荐 `/web/videos`，线上默认 `/static/videos` | `/static/videos` |

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

### v2.7.0 — 2026-05-06（本次）

#### AI 明星专区（Celebrity Zone）— 完整 B 端 SaaS 模块

把 figma「AI 明星专区 - 生成工作台 v3」与「AI 明星专区 - 线框 v2」两份原型工程化为可运行的完整模块，覆盖**真人明星授权 → AI 带货视频生成 → 项目管理 → 数据归因**全链路。

**信息架构**

`/producer/celebrity-zone` 顶部 5 Tab + 嵌套真实路由（侧栏始终高亮明星专区）：

| 路由 / Tab | 内容 |
|---|---|
| `?tab=market`（默认） | 顶部 Hero（累计播放/转化/活跃明星）+「我的授权明星」+「全部明星」分组网格，类目筛选 + 热度/价格排序 |
| `/star/[starId]` | 明星详情（已授权 → 醒目 Hero CTA + 已购套餐用量；未授权/已过期/审核中 → 三档套餐对比 + 申请 CTA） |
| `/star/[starId]/generate` | 模式选择（模板 / 盲盒）→ 配置 → 生成中冻结过渡层（5 阶段进度）→ 结果预览（采纳/重生成/再来一条/下载/分发） |
| `/star/[starId]/apply` | 商务合作申请页：公司 / 品牌 / 场景 / 月预算表单 |
| `?tab=projects`、`/projects/[projectId]` | 项目列表（状态 Tab + 新建 Dialog）+ 项目详情（72/28 分栏：视频网格 + 渠道接入 + 额度 + 快捷操作） |
| `?tab=products` | 商品库：类目筛选 + 搜索 + 网格 + 快速录入 / 编辑 / 删除 |
| `?tab=library` | 视频库：跨项目聚合，状态/明星/项目/排序 多维筛选 |
| `?tab=data` | 数据中心：Hero 大盘 + 明星榜 + 7 日趋势柱 + 渠道占比 |

**数据契约（前端真值源）**

- `src/types/celebrity-zone.ts` — `CelebrityStar / CelebrityCategory / CelebrityAuthStatus（4 态）/ CelebrityPricingTier / CelebritySampleVideo / CelebrityTemplate / CelebrityProject / CelebrityProjectVideo / ChannelStatus / CelebrityShowcase / CelebrityProductInput / CelebrityGenerationRequest / EngineMeta（含 cost + creditPrice）/ CelebrityZoneOverview`。
- `src/types/product.ts`（**新增领域**）— `Product / ProductCategory（8 类）/ ProductSource / ProductInput`。商品库后端尚未实现，server JPA 实体留待下一期对齐。
- `src/constants/celebrity-zone-ui.ts` — `ENGINE_META`（KeLing ✦50 / HiGen ✦120 / MiniMax ✦300）/ `AUTH_STATUS_META`（4 态横幅元数据）/ `PROJECT_STATUS_BADGE` / `VIDEO_STATUS_BADGE` / `ZONE_TABS` / `CATEGORY_BADGE_CLASS`。

**API 封装**

- `src/api/celebrity-zone.ts` — `listStars / getStar / listProjects / getProject / listProjectVideos / listAllVideos / createProject / batchDistribute / startGeneration / listTemplates / listTemplateShowcases / listBlindboxShowcases / getZoneOverview / getEnginePricing`（后者作为后端配置接口预留）。
- `src/api/products.ts`（**新增**）— `listProducts / getProduct / createProduct / updateProduct / deleteProduct / upsertFromGeneration / extractSellingPoints`。USE_MOCK 模式下**自带 localStorage write-through**（key `aistareco.web.products.v1`），刷新后状态保留。
- `src/api/index.ts` 追加 `CelebrityZoneApi / ProductsApi` 命名空间导出。

**4 态授权流转**

`unauthorized | pending | authorized | expired` 四态各自的徽章、横幅、CTA、套餐区呈现均统一从 `AUTH_STATUS_META` 取文案，避免散落硬编码。`unauthorized` 强引导双 CTA（「申请商务合作」+「购买体验版」），`expired` 提示「立即续约」，`pending` 给出预计审核耗时；服务端 `star/[starId]/generate/page.tsx` 用 `redirect()` 拦截非 authorized 状态，避免直接拼 URL 越过授权。

**生成工作台**

`CelebrityGenerationWorkspace` 状态机扩展为 `mode → templateGallery / templateConfig / blindbox → 生成过渡（pendingJob）→ result 预览`。

- `CelebrityGenerationProgress` —— 全屏冻结弹层；5 阶段（提交 / 脚本 / 合成 / 渲染 / 后期）+ requestAnimationFrame 平滑进度条 + 旋转环；按引擎档位推算 6/8/10s 总耗时；生成中禁止后退。
- `CelebrityGenerationResult` —— 9:16 大预览（自定义 play/mute）+ 视频信息卡 + 主动作（采纳并保存 / 重新生成同参数）+ 次动作（立即分发 / 下载草稿 / 再来一条）。
- `startJob` 同步 `void ProductsApi.upsertFromGeneration(...)` —— 商品名/链接匹配既有商品则 `usageCount++`，否则自动建档并标记 `source='auto-from-generation'`，**不阻塞**生成主流程。
- 模板配置页 / 盲盒页 CTA 下方接入钱包余额 + 套餐余量双 gating：`creditPrice > walletBalance` → 黄色「立即充值」提示；`cost > remaining` → 「将使用积分扣费」提示。复用 `apps/web/src/components/producer/WardrobePageV2.tsx:152` 同款判定模板。

**视频可播放化（Pexels 资源池）**

新增 `CelebrityVideoPlayer`（`thumbnailMode=true`：海报 + 中央 ▶︎，点击切到 `<video controls preload="metadata" autoPlay>`，避免列表里同时加载几十路视频流）。Pexels portrait livestreaming-selling 公开样片池 `PEXELS_PORTRAIT_VIDEOS`（10 条）按 ID 哈希分配。生产替换为 AI 生成后存储的静态资源链接即可，组件无需改动。

替换覆盖 6 处历史占位：`CelebrityProjectVideoCard / CelebrityStarDetail / CelebrityBlindBox / CelebrityTemplateConfig / CelebrityTemplateGallery / CelebrityModeSelect`；`CelebrityGenerationResult` 自带专属播放器保留。

**真人明星头像 / 封面**

8 位明星（李诞 / 伊能静 / 刘涛 / 沈腾 / 那英 / 宁泽涛 / 李宇春 / 贾玲）头像与封面来自 Wikimedia Commons 公开图（6/8 位有 wiki 公开像，刘涛 / 贾玲暂用 picsum 占位待商务团队补充）。Mocks 顶部 JSDoc 标注「内部演示用途，不对外发布、不构成商业授权关系」。

**商品库（独立领域）**

- `CelebrityProductLibrary` —— 类目 Tab + 搜索框 + 网格（图片缩略 + 名称 + 类目 + 引用次数 + 编辑/删除）+ 空态友好引导。
- `ProductFormDialog` —— 快速录入弹窗：名称（必填）/ 类目下拉 / 链接 / 图片 URL 列表（按回车批量添加）/ 卖点 textarea。
- `ProductPickerDialog` —— 在 `CelebrityProductForm` 顶部「📚 从商品库选择」按钮触发；选中后名称/链接/卖点/图片一键回填生成表单。
- `mocks/products.ts` 12 条种子覆盖全部 8 个类目；与 `PROJECT_VIDEOS_MAP` 中提到的商品名（玻尿酸口红 / 气泡水 / 压缩长袖速干衣等）对齐。

**「AI 提取卖点」按钮 gating**

仅当**商品名 + 商品链接**都填写后才可点击。禁用态置灰 + tooltip + 表单下方提示行「💡 想用 AI 自动抽卖点？请先填好商品名称和商品链接 →」；点击调 `ProductsApi.extractSellingPoints(...)`（mock 800ms 延迟），抽取结果回写 textarea。

**模式选择卡对齐**

把模板生成 / AI 自主生成两卡抽到统一 `ModeCard`：顶部固定区（图标 + 标题 + 描述 + tags）+ 中段 `h-[176px]` 媒体区（模板卡 3 缩略视频 / 盲盒卡「?」圆环）+ 底部 `mt-auto` CTA。三段完美对齐，模板卡媒体区视频用 `h-full w-auto shrink-0` 让宽度从高度反推（避免列宽撑爆 9:16 容器溢出卡片边框，参见 commit `ef5494d`）。

**徽章可读性**

明星卡片封面右上的「热门 / 已授权 / 待审核 / 已过期 / 未授权」徽章改为实色背景 + 白字 + 黑色投影 + 白色 1px 描边的胶囊形，确保在亮色（云朵 / 白墙）封面上也清晰。

**Tab 404 修复**

`apps/web/src/app/producer/layout.tsx` 中的 legacy `?tab=` → `/producer/<id>` 重定向之前对所有嵌套页都生效，把 `/producer/celebrity-zone?tab=projects` 误改写到 `/producer/projects` 导致 404。修复为只在 `pathname === '/producer'` 根路径触发。

**关键文件清单**

新增 13：

```
apps/web/src/types/product.ts
apps/web/src/mocks/products.ts
apps/web/src/api/products.ts
apps/web/src/components/celebrity-zone/CelebrityVideoPlayer.tsx
apps/web/src/components/celebrity-zone/CelebrityHeroCta.tsx
apps/web/src/components/celebrity-zone/CelebrityAuthBanner.tsx
apps/web/src/components/celebrity-zone/CelebrityGenerationProgress.tsx
apps/web/src/components/celebrity-zone/CelebrityGenerationResult.tsx
apps/web/src/components/celebrity-zone/CelebrityProductLibrary.tsx
apps/web/src/components/celebrity-zone/ProductFormDialog.tsx
apps/web/src/components/celebrity-zone/ProductPickerDialog.tsx
apps/web/src/components/celebrity-zone/CelebrityApplyForm.tsx
apps/web/src/app/producer/celebrity-zone/{layout?,star/[starId]/{page,apply,generate},projects/[projectId]/page}.tsx
```

外加既有的 P1 P5 组件 `CelebrityMarket / CelebrityStarCard / CelebrityStarDetail / CelebrityMyProjects / CelebrityProjectCard / CelebrityProjectDetail / CelebrityProjectVideoCard / CelebrityVideoLibrary / CelebrityDataCenter / CelebrityZoneTabs / CelebrityMarketHero / NewProjectDialog / CelebrityPricingTierCard`。

**三端同步状态**

本期纯 web 前端。商品库后端 JPA 实体 + Controller、celebrity-zone 后端模型与 admin 镜像留待下一期；当前 `apps/server` 不动。

### v2.6.0 — 2026-04-19（前一版）
- **AI 形象锻造「保存 → 关联短视频资产」闭环**：`AppearanceForge` 生成结束后新增「保存到艺人画廊」按钮；保存成功在结果卡上变绿色「已保存」+ 底部栏提示「已为该形象关联 AI 视频资产」。
- **新接口 `POST /api/appearance-forge/save`**（`ForgeController.saveResult`）—— upsert 行为：body.resultId 命中 DB 就更新，否则按 body 的 `artistId / image / prompt / mode / locked / createdAt` 新建。幂等：已有 `videoUrl` 不会被覆盖；传 `reassign=true` 可强制重抽。这一设计是因为 `AppearanceForge.runGenerate` 当前仅在本地构建 `ForgeResult`、从不调 `/generate` 落库，因此 `/save` 兼做首次入库。
- **fake 视频资产池**：AI 视频生成尚未接入，`ForgeController.DEMO_VIDEO_POOL` 维护两个固定 URL：`/videos/showreel-01.mp4` / `/videos/showreel-02.mp4`（文件托管在 `apps/web/public/videos/` 下）。后端随机挑一个写入 `ForgeResult.videoUrl`。mock 模式下 `DEMO_FORGE_VIDEO_POOL` + `pickDemoForgeVideo()` 在 `mocks/appearance-forge.ts` 行为一致。接入真实 AI 后替换为触发生成任务 + 回填对象存储 URL。
- **契约对齐**：
  - `ForgeResult` 增 `videoUrl?: string` + `artistId?: ID`（admin 同步）。
  - server `ForgeResult` 加 `videoUrl` 列，`ForgeResultDto` 暴露 `artistId / videoUrl`。
  - `specs/openapi.yaml` 首次落 Forge 域：`ForgeMode / ForgeTemplate / ForgeLabeledOption / ForgeFaceSlider / ForgeColorScheme / ForgeOptions / ForgeRequest / ForgeResult / ForgeAppearanceStatus / ForgeAppearanceMarketplace / ForgeBlueprint` 共 11 个 schema + `options / history / generate / save / blueprint` 共 5 个 path。
  - `specs/FRONTEND_CONTRACT_DIFF.md` 形象锻造附录从「OpenAPI 完全缺失」改为「已对齐」，追加 `/save` 的 fake 实现 + upsert 说明 + 接入 AI 后的替换路径。
- **画廊渲染优先级**：`AppearanceGallery.pickVideoFor` 改为先读 `appearance.videoUrl`，未保存形象走原哈希回退池兜底；种子数据未跑 save 时渲染与之前一致。
- **三端同步** — `apps/admin/src/types/appearance-forge.ts` 同步补 `videoUrl?: string` + `artistId?: ID` 保持契约 straight-copy。

### v2.5.0 — 2026-04-19
- **经纪大盘拆分为"经纪大盘" + "艺人视图"两视图**（公司视角 / 个体视角解耦）；sidebar 总览分组新增 `{ id: 'artist', icon: UserCircle, label: '艺人视图' }`，`ProducerPage` 联合字面量增加 `'artist'`。`overview` 路由不再要求 `activeArtist`，0 艺人也能进入。
- **新建 `src/components/producer/dashboard/`**
  - `hooks/use-producer-dashboard.ts` — 集中拉取 `artists / songs / monthlyRevenue` 供两个视图共用；通知/钱包仍由 `ProducerDashboard` 直接管理。
  - `charts/TypeDistributionPie.tsx` — 通用分布饼，通过 props 复用（类型分布 / 状态分布 / 收入来源）。
  - `charts/RevenueAreaChart.tsx` — 月度收入面积图。
  - `charts/StatusDistribution.tsx` — 艺人状态分布；非零切片 < 3 时自动降级为横向 pill 条（避免"两块饼"视觉单调）。
  - `charts/RevenueSourcePie.tsx` — 接入原未使用的 `FinanceApi.getRevenueSources()`。
  - `roster/ArtistMatrixGrid.tsx` — 签约艺人小卡网格；点击即切 `activeArtist` 并跳转艺人视图。
  - `roster/TopPerformersTable.tsx` — 本月营收 Top 3 艺人榜。
  - `AgencyOverview.tsx` — 经纪大盘（公司视角）。
  - `ArtistOverview.tsx` — 艺人视图（个体视角）。
- **图表交互修复**（原内联实现的通病一次性清理）：
  - 饼图 hover tooltip 深色底下文字不可见 → 显式 `itemStyle={{ color: '#e5e7eb' }}` / `labelStyle`。
  - 切片无 hover 反馈 → `activeIndex` + `activeShape` 放大 4px 扇形。
  - 密集切片（≥ 5 块）光标穿过 `paddingAngle=3` 空隙丢 hover → 自动降到 `paddingAngle=1`。
  - `ResponsiveContainer` 窄屏塌缩 → 统一补 `minHeight`。
  - 手搓 `flex-wrap` legend → 改为结构化图例行。
- **艺人视图内容**：Hero（头像 / 姓名 / Lv 进度条 / 稀有度 / 状态 / Bio / 艺人切换 `<select>`）；复用 `ArtistRadarCard`；个人 KPI 四格（本月营收 / 粉丝 / 人气值 / 代言数）+ 发行/参演/综艺三计数；孵化参数卡（从 `artist.incubationParams` 挑 9 个"面向经纪人"字段：面孔风格 / 时尚风格 / 视觉年龄 / 身高 / 甜度 / 能量 / 神秘感 / 自信度 / 额外设定）；AI 形象 / 造型道具 / 音乐作品 三张快照卡（只读缩略 + CTA 跳深度页）；5 个快捷工作流入口；近期里程碑占位（等后端 `/me/digital-ips/:id/timeline`）。
- **ProducerDashboard 瘦身**：旧 inline `OverviewPage`（230+ 行）+ 三处 useEffect + `SONG_STATUS_LABEL` / `OVERVIEW_TASKS` 常量全部迁出；本文件回归"壳 + 路由"的职责。
- **三端同步** — 本次纯前端改动，未涉及 admin / server 契约；无新增后端端点。

### v2.4.0 — 2026-04-19
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
npm run build    : ✓ 28 routes — 含 5 个新增 celebrity-zone 路由
                   /producer/celebrity-zone                          14.5 kB / 162 kB
                   /producer/celebrity-zone/star/[starId]              9.1 kB / 144 kB
                   /producer/celebrity-zone/star/[starId]/generate    18.2 kB / 166 kB
                   /producer/celebrity-zone/star/[starId]/apply        3.7 kB / 100 kB
                   /producer/celebrity-zone/projects/[projectId]       5.8 kB / 109 kB
vitest run       : ✓ 现有 3 个用例通过（src/lib/api.test.ts）
```
