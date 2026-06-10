# AI 音乐人 · 产品 & 设计约束

> 子产品：**AI Music Studio** — 面向 MCN 机构的歌手类数字人 IP 工作台。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec.md`](../../product_spec.md)（数字人/数字 IP 主线，v2.7）。

**Last reviewed**: 2026-05-28（v0.39 · 素材中心 + 制作工坊 figma 迁入）

---

## 1. 产品定位

**目标用户**：MCN 机构的制作人、经纪人、内容运营。

**价值主张**：从「零孵化 AI 歌手」到「全网发行变现」的一体化工坊。

**核心链路**：

```
引入数字人（AiAvatar 创建形象）  →  创作（音乐工坊 / 单曲）  →  发行（多平台分发）  →  变现（版权 / 财务）
```

**与其他子产品的边界**：

- **vs AI 短剧** — drama 聚焦短剧项目流水线（脚本 → 项目 → 分发）；music 聚焦单曲音乐资产
- **vs AI 明星带货** — celebrity 用真人明星授权 + AI 复刻做带货短视频；music 用纯虚拟数字人做音乐 IP

---

## 2. 业务领域

类型源：`@ai-star-eco/types`（packages/types）。核心实体：

| 领域 | 实体 | 在 web-music 的作用 |
|---|---|---|
| `artist` | `Artist`、`ArtistStats`、`TalentProfile` | 数字人歌手主体；type ∈ {singer, actor, dancer, idol, host, entertainer, all_rounder} |
| `music` | `Song`、`Album`、`Concert`、`MusicGenre` | 单曲 / 专辑 / 演出 |
| `wardrobe` | `ClothingItem`、`ClothingCategory`、`EquipSlot` | 戏服 / 道具 / 装备槽 |
| `appearance-forge` | `ForgeTemplate`、`ForgeResult`、`ForgeMode` | 形象锻造（**v0.60 已下线**，遗留数据只读） |
| `pose / expression / gesture` | `Pose`、`Expression`、`Gesture` | 动作表现库 |
| `distribution` | `Platform`、`DistributionContent` | 多平台分发渠道 |
| `community` | `FanTier`、`FanGrowthPoint`、`FanActivity` | 粉丝社群（当前全 mock） |
| `settings` | `CreditPack`、`RechargeRecord` | 充值 / 财务 |

后端 API 在 [`/api/...`](../../specs/openapi.yaml)（按 tag 分组：music / singers / coach / wardrobe / poses / expressions / gestures / distribution / community / settings）。当前 `community` 与 `appearance-forge` 走 mock-only，OpenAPI 尚未覆盖。

---

## 3. 路由 & 页面清单

route group `(workspace)` 不出现在 URL；公开路径：`/`（landing）、`/login`、`/activate`。

| 路径 | 模块 | 功能 |
|---|---|---|
| `/dashboard` | 工作台 | 经纪大盘（AgencyOverview + ActivityFeed） |
| `/artist` | 工作台 | 单艺人聚焦视图（默认进入当前在管艺人） |
| `/artists` | 工作台 | MCN 艺人矩阵（多艺人对比） |
| `/incubator` | 艺人管理 | **v0.60 已下线** → 提示页（数字人统一在 AiAvatar 创建后引入） |
| `/appearance` | 艺人管理 | **v0.60 已下线** → 提示页（同上；艺人管理内可「引入数字人 / 更换展示图」） |
| `/wardrobe` | 艺人管理 | 戏服 / 道具管理 + 装备槽 |
| `/poses` | 艺人管理 | **v0.60 已下线** → 提示页（动作姿态随形象渲染统一在 AiAvatar 完成） |
| `/asset-center` ★ | 内容创作 | 素材中心（数字资产库 + 文案库 双 tab） |
| `/production` ★ | 内容创作 | 制作工坊（切片制作 + AI 数字人 + 混剪批量 三 tab） |
| `/studio` | 内容创作 | 创作工坊（label 随艺人类型切换：「音乐工坊」「直播工坊」…） |
| `/music` | 内容创作 | 单曲商业详情（流量 / 收益 / 平台） |
| `/copyright` | 内容创作 | 版权登记 / NFT 铸造 |
| `/notices` | 商业运营 | 商业邀约 |
| `/distribution` | 商业运营 | 多平台分发（B 站 / 网易云 / QQ 音乐 / 抖音…） |
| `/community` | 商业运营 | 粉丝社群（mock-only） |
| `/finance` | 商业运营 | 财务中心（充值 / 提现 / 流水） |
| `/settings` | 系统 | 工作室设置 / 团队成员 |

★ = v0.39 新增。详见 [`README.md` 版本日志](README.md#v039)。

详见 [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) `SIDEBAR_GROUPS`。

**Sidebar 分组**（4 组）：

1. **工作台** — dashboard / artist / artists
2. **艺人管理** — artists / wardrobe（incubator / appearance / poses 已于 v0.60 下线）
3. **内容创作** — **asset-center** ★ / **production** ★ / studio / music / copyright
4. **商业运营** — notices / distribution / community / finance

`/settings` 单独挂在 footer 区。

### 跨页数据联动（v0.39 待升级，当前用字符串标签）

```
Asset.partnerName     ┐
Asset.authStatus      │
CopyItem.partnerScope │ ← 暂用字符串；待 Partner / ContentLicense 页面
ClipTask.partnerName  │   迁入后升级为 ID + denormalized name
ClipTask.authContract │
ClipTask.copyVersion  │
PersonModel.partnerName ┘
GenTask.copyTitle     ← 与 CopyItem.title 字符串匹配（业务约束：copy.stage === "approved" 才可用）
BatchTask.slotBindings → 槽位绑定 Asset.id / CopyItem.id
* → PublishPool（「入池」按钮，目标页面尚未迁入）
```

每条引用都在 packages/types/src/<domain>.ts 顶部注释里说明"当前 string，待对应页面迁入升级为 ID"。

---

## 4. 设计约束

### 4.1 视觉系统

**主题**：Restrained dark（克制紫；覆盖 `packages/ui` 残留的 cyberpunk 霓虹）。

**核心 CSS 变量**（[`src/styles/app.css`](src/styles/app.css)）：

| 变量 | 值 | 用途 |
|---|---|---|
| `--background` | `oklch(0.135 0.008 285)` | tinted neutral 近黑（页面底） |
| `--foreground` | `oklch(0.95 0.01 285)` | 主文字 |
| `--primary` | `oklch(0.66 0.13 285)` | 克制紫 accent |
| `--card` | 实底，不用玻璃 | 卡片背景 |
| `--sidebar` | 独立配色 | 侧栏专用 |

**禁用**：玻璃质感（glass-blur backdrop）、霓虹辉光、cyberpunk 配色。这套视觉只在 web-drama 使用。

### 4.2 字体

由 root layout（[`src/app/layout.tsx`](src/app/layout.tsx)）通过 `next/font/google` 注入：

- **Inter** → 主正文 / UI label（CSS `--font-sans`）
- **Space_Grotesk** → 备用（仅显式 className 时启用）

无 display font / serif 强调（drama 才有）。

### 4.3 布局

- **Sidebar**：220px 固定宽，垂直 4 分组
- **Topbar**：48px，breadcrumb + 搜索 + accent CTA + 钱包余额 + 头像
- **主体**：响应式 grid，最大宽度 1600px，padding 24-28px

### 4.4 组件分层

```
@ai-star-eco/ui          — shadcn 48 个原语（共享，勿手改）
@ai-star-eco/api-client  — apiFetch / AuthProvider / format
src/components/producer/ — 业务组件（22 个 + dashboard 子目录）
                          — AppearanceForge.v3 / IncubationWizardV2 / MCNMatrix / MusicLibrary
src/components/landing/  — MusicLanding 本地实现（不复用 packages/landing.ProductLanding）
src/components/          — 全局 dialog / drawer（MusicGenerationDialog / NFTMintingDialog / GlobalAudioPlayer）
```

> **不要直接修改 `@ai-star-eco/ui`**。需要变体时在 `components/producer/` 包一层。

---

## 5. UI 模式约定

- **数值字段存原始整数**：格式化用 `@ai-star-eco/api-client/format`（`formatCredits` / `formatCompactNumber` / `formatCurrency` / `formatDuration`）
- **空状态 / 加载状态 / 错误态**：用 `src/components/common/*`（EmptyState / LoadingBlock / ErrorBlock）
- **dialog 居中弹层**：`MusicGenerationDialog` / `NFTMintingDialog` 全局挂 providers
- **音频播放**：`GlobalAudioPlayer` 在 app shell；任何卡片点播放都触发它
- **中文单语**：所有文案中文；不要 `{ zh, en }` 字典
- **`"use client"`**：交互组件必加；纯展示 server component 不加

---

## 6. Mock / 真后端策略

环境变量 `NEXT_PUBLIC_USE_MOCK`（`.env.local`）：

- `=1`（默认）→ `src/api/*.ts` 顶部 `if (USE_MOCK)` 命中本地 mock + 内存可变缓存
- `=0` → `apiFetch` 走 Next rewrites → `http://localhost:8080`

**特殊**：

- `community` 模块 OpenAPI 尚未覆盖 → 全 mock
- `appearance-forge` 走 Coze SSE，部分 mock 部分实接
- 默认视图渲染用 `import { DATA } from "@/mocks/xxx"`；用户动作走 `api/*`

---

## 7. 路由兼容 & 迁移

**遗留链接重定向**（[`src/proxy.ts`](src/proxy.ts)）：

```
/console               → /dashboard
/console?tab=<id>      → /<id>（13 个 tab 映射）
/console/<sub-path>    → /<sub-path>
```

旧书签 308 重定向兼容；下个版本删除 proxy.ts。

---

## 8. 关键约束 & 注意事项

### 8.1 与共享层的关系

- **types** 必须来自 `@ai-star-eco/types`，**不**在本 app 内 inline 定义业务类型
- 仅本 app 私有的展示型类型（如 `MusicGenerationDialogProps`）可在 `src/types/` inline
- 不向 packages/types 上提非必要类型（避免污染其他 app）

### 8.2 与 server 的关系

- 大部分模块走真后端契约（`/api/music/*`、`/api/coach/*`、`/api/singers/*`、…）
- 新增端点必须先改 [`specs/openapi.yaml`](../../specs/openapi.yaml) 再写 controller，否则 `check:api-contract` 拒绝
- 详见 [`AGENTS.md` §5 新增领域 SOP](../../AGENTS.md)

### 8.3 已知待办

- Cookie SSO 跨子域：当前 token 仍 localStorage，刷新页面 OK 但跨域 fails；改造点见 [`packages/api-client/src/_client.ts`](../../packages/api-client/src/_client.ts) TODO
- `community` 模块从 mock 切真后端（依赖 server `/api/community/*` 完整化）
- 真实音频生成接入（Coze / Suno / 自训模型）

---

## 9. 索引

| 文件 | 用途 |
|---|---|
| [`README.md`](README.md) | 启动 / 技术栈 / 版本日志 |
| [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) | sidebar 配置 + topbar + 鉴权 wall |
| [`src/styles/app.css`](src/styles/app.css) + [`src/styles/tokens.css`](src/styles/tokens.css) | 设计令牌 |
| [`src/api/`](src/api/) | 14 个域 API（USE_MOCK 分支） |
| [`src/components/producer/`](src/components/producer/) | 22 个业务组件 |
| [`src/proxy.ts`](src/proxy.ts) | 旧 `/console` 链接兼容 |
| [`../../product_spec.md`](../../product_spec.md) | 业务规格（数字人主线） |
| [`../../specs/openapi.yaml`](../../specs/openapi.yaml) | 后端 API 契约 |
| [`../../AGENTS.md`](../../AGENTS.md) | 跨 app agent 指引 |
