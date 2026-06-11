# AI 短剧 · 产品 & 设计约束

> 子产品：**AI Drama Studio** — 演员 IP 阵容 + 脚本工坊 + 短剧项目 + 多平台分发，一体化短剧工坊。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec.md`](../../product_spec.md)（数字人/数字 IP 主线，v2.7）。

**Last reviewed**: 2026-06-01（v0.44 短剧工坊视觉与业务流重构）

---

## 1. 产品定位

**目标用户**：MCN 中的内容创作者、编导、短剧制作团队。

**价值主张**：以演员 IP 阵容为核心，AI 辅助完成「脚本撰写 → 形象锻造 → 项目排期 → 全网分发」闭环。

**核心链路（v0.44 重构后,主线）**：

```
我的短剧（/projects）  →  新建短剧（/projects/new，选类型→AI引导/模板）
                       →  短剧工作台（/projects/<id>，沉浸式 6 阶段流水线）
                          · 选题立项 → 大纲分集 → 角色与资产（项目级·跨集共享）
                          · 单集剧本 → 分镜工作台 → 成片配方（剧集级·针对当前集）
                          · 一键连跑可加速跑完剩余阶段;每步可锁定/回改
                       →  成片配方（@图片N 渲染数字人头像缩略图，配方可直接拿去开拍）
                       →  [出片 / 多平台分发 — 下游能力，Phase 2]
```

**辅助素材库（跨项目复用）**：演员 IP 阵容（cast，演员经「从 AiAvatar 引入数字人」创建）/ 戏服与道具（wardrobe）/ 跨项目脚本归档（scripts），在 sidebar「创作素材」组。形象创建（孵化 / 锻造炉）已于 v0.60 收敛至 AiAvatar。


**与其他子产品的边界**：

- **vs AI 音乐人** — music 聚焦单曲音乐资产 + 音乐工坊；drama 聚焦剧本 + 多镜剧集 + 项目化排期
- **vs AI 明星带货** — celebrity 用真人明星授权 + 模板化带货短视频；drama 用纯虚拟演员做剧情短剧

---

## 2. 业务领域

类型源：`@ai-star-eco/types`（packages/types）。核心实体：

| 领域 | 实体 | 在 web-drama 的作用 |
|---|---|---|
| `artist` | `Artist`、`ArtistStatus`、`ArtistQuality` | 演员 IP（虚拟人 / 数字 IP），跨项目复用 |
| `film` | `Drama`、`Movie`、`Advertisement`、`VoiceWork` | 短剧 / 电影 / 广告 / 配音剧 |
| `wardrobe` | `ClothingItem`、`ClothingCategory`、`EquipSlot` | 戏服 / 道具（演员可装备） |
| `appearance-forge` | `ForgeRequest`、`ForgeResult`、`ForgeMode` | 形象锻造（**v0.60 已下线**，遗留数据只读） |
| `script` | `Script`、`ScriptVersion`、`ScriptKind` | 跨项目脚本归档（剧集/广告/宣传片/配音） |
| `account` | `AepUser`、`Studio`、`Tenant` | 工作室 / 团队 / 多租户 |
| `settings` | `CreditPack`、`RechargeRecord` | 充值 / 流水 |

**v0.44 短剧工作台内部业务结构**（前端 mock 数据：`mocks/drama-workshop/`，按项目隔离）：

| 实体 | 在工作台的作用 |
|---|---|
| `DramaProjectSummary` | 我的短剧首页项目卡 |
| `ContentType` / `Template` | 新建短剧的内容类型 + 爆款模板库 |
| `ProjectInfo` | 项目信息条（标题/类型/集数/时长/画幅/logline/mainline） |
| `TopicCard` | 选题方向卡（AI 引导式三步的产物） |
| `EpisodeOutline` | 分集大纲（钩子/梗概/beat） |
| `CharacterDef` | 项目内角色（关键/龙套 + 数字人 avatar key 绑定） |
| `ScriptScene` / `ScriptLine` | 单集剧本（分场景 + 台词行） |
| `BoardScene` / `BoardShot` | 分镜（含 size/move/dur/engine/cast/line/voice/moods/done/overLimit） |
| `PromptShot` | 成片配方（style/timeline/sound/refs 四段式） |

**后端契约不变**：仍走 `POST /api/me/drama/scripts*` + `POST /api/me/drama/episodes/generate`（v0.43）。前端 6 阶段工作台属于 UI 编排层，富数据先以 mock 演示，持久化由 `DramaScript.scenes[]` 承接（结构化扩展见 v0.45+ 后端契约规划）。

后端 API 在 [`/api/film/**`](../../specs/openapi.yaml)（按 tag 分组：film / wardrobe / appearance-forge / settings）。

---

## 3. 路由 & 页面清单

route group `(workspace)` 不出现在 URL；公开路径：`/`（landing）、`/login`、`/activate`。

| 路径 | 模块 | 功能 |
|---|---|---|
| `/dashboard` | 工作台 | 总览（项目 KPI / 待办 / 近期产出） |
| `/cast` | 工作台 | 演员阵容（多艺人卡片墙） |
| `/cast/[id]` | 工作台 | 演员详情（履历 / 装备 / 历史项目） |
| `/cast/[id]/generate` | 工作台 | 演员形象生成（针对某角色） |
| `/incubator` | 工作台 | **v0.60 已下线** → 提示页（数字人统一在 AiAvatar 创建后引入） |
| `/forge` | 工作台 | **v0.60 已下线** → 提示页（同上；cast 内可「引入数字人 / 更换展示图」） |
| `/wardrobe` | 工作台 | 戏服 / 道具上传 + 分配给演员 |
| `/scripts` | 工作台 | 脚本库（多版本对比） |
| `/scripts/[id]` | 工作台 | 脚本编辑器（**版本树 + AI 续写**） |
| `/short-drama` ★ | 工作台 | **短剧生成（v0.43）**：AI 起草分场景脚本 → 保存 → 生成短剧视频（异步轮询）。后端 `/api/me/drama/*`，复用 celebrity 视频管线 |
| `/projects` | 工作台 | 项目管线（状态机：草稿 / 选角 / 拍摄 / 后期 / 上线） |
| `/projects/[id]` | 工作台 | 项目详情（演员表 / 排期 / 资产） |
| `/projects/[id]/distribute` | 工作台 | 项目多平台发布 |
| `/distribution` | 分发与洞察 | 分发总览（跨项目聚合） |
| `/insights` | 分发与洞察 | 数据洞察（窗口选择 + 维度切换） |
| `/trends` | 分发与洞察 | 趋势雷达（行业 / 题材热度） |
| `/finance` | 系统 | 财务（充值 / 提现 / 流水） |
| `/settings` | 系统 | 工作室 / 团队成员 |

详见 [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) GROUPS 定义（第 47-75 行）。

**Sidebar 分组**（3 组）：

1. **工作台**（7 项）— dashboard / cast / incubator / forge / wardrobe / scripts / projects
2. **分发与洞察**（3 项）— distribution / insights / trends
3. **系统**（2 项）— finance / settings

---

## 4. 设计约束

### 4.1 视觉系统

**主题**：**Premium Cinematic**（金色 accent 在深紫近黑画布上，配合玻璃质感和粉紫青大渐变。源自「AI IP Design Directions 03」）。

**核心 CSS 变量**（[`src/styles/tokens.css`](src/styles/tokens.css)）：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg-0` | 深紫近黑 | 页面底 |
| `--accent` | `#d4af6a` | 金色 accent |
| `--gradient-hero` | 粉紫青大渐变 | landing hero 区 |
| `--gradient-gold` | 金色光斑 | CTA / KPI 高亮 |
| `--glass-bg` | 半透明 + 20px blur | 卡片玻璃质感 |
| `--radius-md` | 12px | 卡片圆角 |
| `--radius-lg` | 20px | 大模块圆角 |
| `--radius-pill` | 999px | 胶囊按钮 |

**关键特征**：

- 玻璃质感 `.glass` 类（与 web-music 的 "no glass" 相反 —— 这里**有意**用玻璃）
- 大圆角（电影海报感）
- 金色作为 CTA accent，避免与 music 的紫色撞色

### 4.2 字体

由 root layout（[`src/app/layout.tsx`](src/app/layout.tsx)）注入：

- **Plus_Jakarta_Sans** → 主正文 / display（`--font-sans` / `--font-display`）
- **Instrument_Serif** → 点缀（标题 / 强调短句，`--font-serif`）
- **JetBrains_Mono** → 数据 / 代码（`--font-mono`）

注：drama 是三个新 app 里**唯一**用 serif 作为重音的（电影感）。music / celebrity 都是 sans-only。

### 4.3 布局

- **Sidebar**：240px 固定宽（比 music 的 220px 稍宽，容纳更长 label）
- **Topbar**：48px，breadcrumb + 搜索 + accent CTA + 钱包余额
- **主体**：响应式 grid，max-w 1600px

### 4.4 组件分层

```
@ai-star-eco/ui          — shadcn 48 个原语
@ai-star-eco/api-client  — apiFetch / format
src/components/premium/  — 业务原语（本地）：Button / Card / Chip / KpiCard / Meter
                          — 与 music 的 producer/ 对应，但 premium 风格 + 玻璃质感
src/components/common/   — 通用：Dialog / ConfirmDialog / FormDialog / Field / EmptyState
                          — LoadingBlock / ErrorBlock / StatusBadge / ViewHeader / SectionHeader
src/lib/drama-query.ts   — 极轻量客户端缓存：useAsync / usePageData / invalidate / mutate
                          — 不引入 React Query / TanStack Query
```

---

## 5. UI 模式约定

- **数值字段存原始整数**，格式化在展示层
- **状态机可视化**：项目管线 `/projects` 用横向流水标识（草稿 / 选角 / 拍摄 / 后期 / 上线 / 已下线）
- **版本树**：`/scripts/[id]` 用版本树形展示 + AI 续写按钮
- **客户端 mutation**：API 层的内存可变缓存改完后，UI 立即反映（不重新 fetch）；用 `mutate` / `invalidate` 控制
- **Toast**：[Sonner](https://sonner.emilkowal.ski/) 挂在 `app/providers.tsx`；任何 mutation 完成 → toast
- **`"use client"`**：所有交互组件必加；纯展示页可以 server component（17 页都 SSR 预渲染通过）

---

## 6. Mock / 真后端策略

`USE_MOCK=1` 默认（[`README.md`](README.md) 启动指南）：

- `src/api/artists.ts` / `film.ts` / `scripts.ts` / `distribution.ts` / `finance.ts` 顶部建立 **mutable 副本**
- CRUD 直接改缓存，UI 即时反映（无需 refetch）
- 发布任务启动 `setTimeout` 轮询推进项目状态（模拟后端 worker）

切真后端：`.env.local` 设 `NEXT_PUBLIC_USE_MOCK=0`。当前 backend 对 drama 的覆盖度有限（部分模块仅 mock）。

---

## 7. 路由兼容 & 迁移

**遗留链接重定向**（[`src/proxy.ts`](src/proxy.ts)）：

```
/console               → /dashboard
/console?tab=<id>      → /<id>
/console/<sub-path>    → /<sub-path>
```

旧书签 308 兼容；下个版本删除 proxy.ts。

---

## 8. 关键约束 & 注意事项

### 8.1 与其他子产品的视觉隔离

- drama 的**金色 accent**不要泄漏到 music（紫色）或 celebrity（紫罗兰）
- drama 的**玻璃质感** `.glass` 是 drama 专属；music 用实底卡片
- drama 的 **serif 字体** Instrument_Serif 不要在其他 app 使用

### 8.2 客户端缓存

`src/lib/drama-query.ts` 是极轻量自研，**不要替换为 React Query / SWR / TanStack Query**。原因：drama 的 mutation 多是本地内存（mock 模式），重型库不划算。

### 8.3 已知待办

- 后端 `/api/film/*` 真后端覆盖度提升（当前许多模块仍 mock）
- 项目状态机正式落表（当前内存）
- 跨子域 SSO（同 music / celebrity）

---

## 9. 索引

| 文件 | 用途 |
|---|---|
| [`README.md`](README.md) | 启动 / 技术栈 / 版本日志 |
| [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) | sidebar 配置 + topbar + 鉴权 wall |
| [`src/styles/tokens.css`](src/styles/tokens.css) | 设计令牌（accent / gradient / radius） |
| [`src/styles/app.css`](src/styles/app.css) | Tailwind v4 `@theme` 映射 |
| [`src/lib/drama-query.ts`](src/lib/drama-query.ts) | 自研客户端缓存 |
| [`src/components/premium/`](src/components/premium/) | 业务原语（Premium 风格） |
| [`src/components/common/`](src/components/common/) | 通用 dialog / 状态 |
| [`src/proxy.ts`](src/proxy.ts) | 旧 `/console` 链接兼容 |
| [`../../product_spec.md`](../../product_spec.md) | 业务规格（数字人主线） |
| [`../../specs/openapi.yaml`](../../specs/openapi.yaml) | 后端 API 契约 |
| [`../../AGENTS.md`](../../AGENTS.md) | 跨 app agent 指引 |
