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

### v0.60 · 2026-06-10 · 数字人收敛：艺人形象统一引用 AiAvatar {#v060}

- 「艺人管理」创建入口改为 **从 AiAvatar 引入数字人**（两步 picker：选数字人 → 选首要展示图，
  展示图候选 = 定妆照 / 造型 looks / 场景图 derivatives；缺图深链 AiAvatar 渲染）；
  详情弹窗可「更换展示图」（PATCH dapDisplayRef）
- 引用不复制：`Artist.dapDisplayImageUrl` 由 server 实时派生签名 URL，AiAvatar 重渲染自动跟随；
  `ArtistAvatar` 全 app 优先该字段
- sidebar 下线「AI艺人孵化」「AI形象锻造」；/incubator /appearance 保留路由 → RetiredFeatureNotice
  提示页（向导/锻造源码保留一版后删）
- 新增 `api/dap-avatars.ts`（/v1/avatars 系列，直调 dap 域）+ `mocks/dap-avatars.ts`；
  `.env.example` 增 `NEXT_PUBLIC_AIAVATAR_URL`

### v0.43 · 2026-05-29 · 形象锻造接平台大模型 + 登录与平台访问隔离 {#v043}

- ✅ **形象锻造接大模型**：`/appearance` 的对话从 Coze-only 改为**优先走平台大模型**（后端 `ForgeChatService`：`invokeChat` 取整段方案 + 服务端切流成 SSE，Coze 回退）。前端 `api/appearance-forge` 改打 `/appearance-forge/chat/*`；`AppearanceForge.v3` 聊天框接**真流式回复**（实时回写气泡，可多轮打磨）；全量去技术化文案（Coze/Mock → 大模型/演示模式）。
- ✅ **登录与平台隔离**：登录页改用共享 `AuthScreen`（手机号登录/注册/体验账号三 tab）；workspace 在「账号未开通 AI 音乐人」时拦截。注册透传 `platform=music`。
- 联调：后端 `aep.dev-fake-llm` + `scripts/dev-fake-llm-server.mjs`，无真实 key 也能跑通。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.43。

### v0.41 · 2026-05-28 · 前后端连通性全面修复 {#v041}

针对全面连通性审计发现的漂移 bug 做修复。发布中心（distribution）暂跳过（后续复用
celebrity 分发中心能力）；v0.39 五个 mock-only 模块按「仅补 openapi + 保持 mock」处理。

**bug A · music.ts 4/5 endpoints 死路 → 已修**

server 端 `AccountController` 补 4 个 endpoint（openapi 早已声明，缺的是实现）：
- `GET /me/albums` —— 当前用户名下所有艺人的专辑（owned artistIds 过滤）
- `GET /me/concerts` —— 演唱会（artistIds 命中任一即归属）
- `POST /me/songs/{id}/advance` —— 状态机 recording → mixing → released，释放落 releaseDate
- `GET /me/music/trends?range=30d` —— 无逐日埋点表，按用户歌曲播放/收入总量派生确定性累计曲线（接入真实埋点后替换为日维聚合）
- 新增 DTO `MusicTrendPointDto`（字段对齐 TS `MusicTrendPoint`）

**bug B · products.ts 5/7 走错域 → 删除整模块**

products 写动作 v0.31 已收紧到 `/admin/products/*`，且 music 子产品业务上不应有商品库
写入入口。审计确认 `ProductsApi` 被零组件引用 → 删除 `api/products.ts` + `mocks/products.ts`
+ `api/index.ts` 的 export。

**bug E · wardrobe `/generate-look` 缺实现 → 已落地**

`WardrobeController.generateLook`（被 WardrobePageV2.tsx:257 调用，原 USE_MOCK=0 会 404）：
取稀有度最高的已装备单品图作 hero 主图，prompt 拼接单品名，返回 `ForgeResultDto`
（草稿语义，不落库；入库走 `/appearance-forge/save`）。

**bug D · generation.ts `/me/generation/run` → 维持现状**

确认是文档化的后端锚点 stub（openapi 已声明 + 零组件调用），非破损路径，保留。

**v0.39 五模块（素材/文案/切片/数字人/混剪批量）→ 补 openapi path 占位**

`specs/openapi.yaml` 新增 13 个 path（18 个 method-operation）声明，标注「mock-only · v0.39」。
contract gate 现在 web-music **100% 通过**；schema 待 server 落地时补全。前端保持 mock-only。

**验收**：
- ✅ `apps/server` `mvn compile` clean（AccountController / WardrobeController / MusicTrendPointDto 编译通过，.class 产出）
- ✅ `pnpm typecheck:all` 7 workspaces clean
- ✅ `pnpm check:api-contract` web-music **0 失败**（剩余 18 个失败全部属 web-drama，非本次范围）
- ⚠️ **未做运行时联调**：本环境 maven 离线无法拉取 spring-boot 运行时依赖（h2 / hibernate / byte-buddy 等未缓存 + 网络策略禁外网），server 编译通过但无法 `spring-boot:run` 启动。新 endpoint 严格复用既有 endpoint 的 ownership 校验 + DTO + ApiResponse 包壳模式，但建议在有完整后端环境时跑一次 dev-login → curl 实测。

**显式 out-of-scope**：
- distribution（发布中心）—— 后续复用 celebrity 分发中心
- v0.39 五模块的真后端落地 —— 等产品方向确认
- web-drama 的 18 个 contract gate 失败 —— 非 music 范围
- `check:api-contract` 接入 git pre-push hook（建议作为后续 CI 加固）
- `.env` 的 `USE_MOCK=0` 默认值（联调真后端时正确，保留）

### v0.40 · 2026-05-28 · 孵化向导 AI 顾问融合 + 形象锻造左对话右渲染 {#v040}

把 figma 「AI 艺人孵化工坊」原型中间栏的 `WizardInlineChat` 对话框融合进 web-music
现有的 `/incubator`（IncubationWizardV2），同步把 `/appearance`（AppearanceForge.v3）
从 3 栏布局（左表单 / 中渲染 / 右对话）翻转为业界通用的 2 栏 **左对话、右渲染**
（ChatGPT / Midjourney / Claude 图像生成同款）。

**新增文件**：

- `src/components/producer/WizardChatPanel.tsx` —— 7 步上下文（与 IncubationWizardV2
  的 SECTIONS origin/form/psyche/talent/craft/fandom/lore 一一对齐）的 AI 顾问聊天面板。
  从 figma `mcn/WizardInlineChat.tsx` 移植，i18n 剥离为中文单语，色彩从 cyan/gray
  字面色换成 app.css token（--card / --border / --primary / --muted）。
  - props: `{ step: number }` —— 跟随当前章节切换 STEP_CONTEXT，自动重置 chat
  - 内置 typing 动画 / quick tips / quick tags / 回车发送 / 重置按钮

**修改文件**：

- `src/components/producer/IncubationWizardV2.tsx`
  - 右栏宽度 320 → 360px；从单 `<SummaryPanel>` 改为 shadcn `<Tabs>`
    切换：「档案预览」(默认) ↔ 「AI 顾问」(`<WizardChatPanel step={section} />`)
  - 用户切换章节时，advisor tab 内的 chat 自动按新步骤重置

- `src/components/producer/AppearanceForge.v3.tsx`
  - 3 栏 `[300px form][1fr canvas][320px chat]` → 2 栏 `[420px chat][1fr canvas]`
  - 原 LEFT 列「素材与约束」表单（锻造模式 / 身份气质 / 参考照片 / 模版-参考混合 /
    发型发量 / 风格标签 / 面部微调）整体 stash 到 shadcn `<Sheet side="left">`
    抽屉，由工具条新增的「形象参数」按钮唤起（默认收起）
  - 原 RIGHT 列「对话 / 历史 / 流」3 tab dock 加 `lg:order-1`，视觉上靠左
  - 原 CENTER 列「工具条 / 模版条 / 画布」加 `lg:order-2`，视觉上靠右
  - 表单状态全部保留（mode / gender / age / region / vibe / uploadedPhoto /
    fusionRatio / selectedHair / hairVolume / selectedTags / faceValues /
    lockedFeatures 等 12 项），抽屉关闭后改动依然影响下一次锻造

**验收**：
- ✅ `pnpm typecheck:all` 7 workspaces clean
- ✅ `pnpm build` web-music 21 routes static
- ✅ dev `curl /` `/incubator` `/appearance` `/asset-center` `/production` 全部 200，无运行时错误

**显式 out-of-scope**：
- chat 的真后端接入（当前是 mock 响应：每步 3-4 句预设回复轮换）
- chat 历史持久化（每次切步骤即重置；如需保留，需要外置 store 或 localStorage）
- chat 与表单的双向联动（advisor 给的建议不会自动回填 wizard 表单）

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
