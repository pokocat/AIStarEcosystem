# AI 短剧 · 产品 & 设计约束

> 子产品：**AI Drama Studio** — 演员 IP 阵容 + 脚本工坊 + 短剧项目 + 多平台分发，一体化短剧工坊。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec.md`](../../product_spec.md)（数字人/数字 IP 主线，v2.7）。

**Last reviewed**: 2026-05-31

---

## 1. 产品定位

**目标用户**：MCN 中的内容创作者、编导、短剧制作团队。

**价值主张**：以演员 IP 阵容为核心，AI 辅助完成「短剧创作 → 形象锻造 → 项目归集 → 全网分发」闭环。短剧创作走一条清晰动线，区分极速（小白一句话出片）与专业（从业者分步精修）双模式。

**核心链路**：

```
智能选题（topics，AI 题材推荐 + 自定义）
  →  短剧创作（create：极速一句话整包出片 / 专业分步流水线 —— 选题 → 角色 → 脚本（剧本=分镜，prompt 驱动）→ 生成（逐集任务）→ 成片）
  →  作品与项目（projects，成片归集 + 多状态推进）
  →  多平台分发（distribute）
  →  数据洞察（insights / trends）
```

> v0.7 重构：原「脚本工坊 /scripts」与「短剧生成 /short-drama」合并为统一的「短剧创作 /create」主线（旧链接 308 重定向）；项目流水线重定位为「作品与项目」收口区；整体改纸感淡色主题（保留金/琥珀 accent）。

**与其他子产品的边界**：

- **vs AI 音乐人** — music 聚焦单曲音乐资产 + 音乐工坊；drama 聚焦剧本 + 多镜剧集 + 项目化排期
- **vs AI 明星带货** — celebrity 用真人明星授权 + 模板化带货短视频；drama 用纯虚拟演员做剧情短剧

---

## 2. 业务领域

类型源：`@ai-star-eco/types`（packages/types）。核心实体：

| 领域 | 实体 | 在 web-drama 的作用 |
|---|---|---|
| `artist` | `Artist`、`ArtistStatus`、`ArtistQuality` | 演员 IP（虚拟人 / 数字 IP） |
| `film` | `Drama`、`Movie`、`Advertisement`、`VoiceWork` | 短剧 / 电影 / 广告 / 配音剧 |
| `wardrobe` | `ClothingItem`、`ClothingCategory`、`EquipSlot` | 戏服 / 道具（演员可装备） |
| `appearance-forge` | `ForgeRequest`、`ForgeResult`、`ForgeMode` | 形象锻造（批量生成多角色形象） |
| `account` | `AepUser`、`Studio`、`Tenant` | 工作室 / 团队 / 多租户 |
| `settings` | `CreditPack`、`RechargeRecord` | 充值 / 流水 |

后端 API 在 [`/api/film/**`](../../specs/openapi.yaml)（按 tag 分组：film / wardrobe / appearance-forge / settings）。

---

## 3. 路由 & 页面清单

route group `(workspace)` 不出现在 URL；公开路径：`/`（landing）、`/login`、`/activate`。

| 路径 | 模块 | 功能 |
|---|---|---|
| `/dashboard` | 工作台 | 总览（项目 KPI / 待办 / 近期产出） |
| `/cast` | 演员与形象 | 演员阵容（多艺人卡片墙） |
| `/cast/[id]` | 演员与形象 | 演员详情（履历 / 装备 / 历史项目） |
| `/cast/[id]/generate` | 演员与形象 | 演员形象生成（针对某角色） |
| `/incubator` | 演员与形象 | 多步孵化器（localStorage 草稿保留） |
| `/forge` | 演员与形象 | 形象锻造（**v0.43 对话式 AI 形象顾问**，接平台大模型流式生成；影院风独立 UI） |
| `/wardrobe` | 演员与形象 | 戏服 / 道具上传 + 分配给演员 |
| `/create` ★ | 工作台 | **短剧创作 · 统一入口（v0.7）**：`?mode=express\|pro`。两模式只是「生成脚本的方式」不同，产物同为 `DramaScript`（多集时为同一 series 的多个脚本）。<br>**极速模式**：一句话 / 选题 → 一次性生成完整脚本包（人物 / 分镜 / 场景，可选 1–8 集）→ 剧集总览逐集「一集一任务」派发视频。<br>**专业模式**：线性流水线 选题 → **角色** → **脚本（剧本=分镜不分开**：`SceneEditor` 编辑 ⇄ 竖屏分镜预览；每个场景的剧情/画面/台词即分镜 prompt，渲染时逐镜驱动）+ 长文本编剧室 `ScriptProsePanel`（版本树 / AI 续写）→ 生成（风格变体 + 积分预估）→ 成片 → 审核（占位）。后端复用 `/api/me/drama/*` + `/api/me/scripts/*`，无契约变更 |
| `/topics` ★ | 工作台 | 智能选题（原「模板广场」）：AI 题材推荐（热门题材 + 爆款选题）+ 自定义题材 / 人设 / 故事框架 → 带入极速模式（`/create?mode=express&tpl=` 或 `&theme=&genre=`）；实时热度榜占位 |
| `/projects` | 工作台 | **作品与项目**（原「项目流水线」）：成片归集 + 状态机（选角 / 拍摄 / 后期 / 上线） |
| `/projects/[id]` | 工作台 | 项目详情（演员表 / 排期 / 资产 / 分发） |
| `/projects/[id]/distribute` | 工作台 | 项目多平台发布 |
| `/assets` ★ | 工作台 | 素材资产中心（占位：云端存储 / 检索 / 团队共享即将上线） |
| `/distribution` | 分发与洞察 | 分发总览（跨项目聚合） |
| `/insights` | 分发与洞察 | 数据洞察（窗口选择 + 维度切换） |
| `/trends` | 分发与洞察 | 趋势雷达（行业 / 题材热度） |
| `/finance` | 系统 | 财务（充值 / 提现 / 流水） |
| `/settings` | 系统 | 工作室 / 团队成员 |

详见 [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) GROUPS 定义。

**Sidebar 分组**（v0.7，4 组）：

1. **工作台**（5 项）— dashboard / **create（短剧创作）** / **topics（智能选题）** / **projects（作品与项目）** / **assets（素材资产）**
2. **演员与形象**（4 项）— cast / incubator / forge / wardrobe
3. **分发与洞察**（3 项）— distribution / insights / trends
4. **系统**（2 项）— finance / settings

> 旧入口 `/scripts`、`/short-drama` 已合并入 `/create`，`next.config.mjs` 配 308 重定向到 `/create`。

---

## 4. 设计约束

### 4.1 视觉系统

**主题**：**Studio · 纸感淡色（v0.7）**。在纸感淡底上保留金/琥珀 accent（品牌延续，与 music=紫 / celebrity=紫罗兰 区隔由 accent 承担）。整页主题集中在 [`src/styles/tokens.css`](src/styles/tokens.css) 的 `:root, [data-theme="premium"]` 块；组件内原大量 `rgba(255,255,255,.0x)` 暗底面已统一换成中性 token（`--surface-1/2`、`--track`、`--overlay-scrim`）。

> 淡色配方参考同仓 `apps/web-celebrity` 的 `[data-theme="creator"]`；drama 保留金色而非紫色。root `layout.tsx` 已移除 `dark` class（让 `@ai-star-eco/ui` 继承淡色），`themeColor` 改 `#f7f3ec`。

**核心 CSS 变量**（[`src/styles/tokens.css`](src/styles/tokens.css)）：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#f7f3ec` 纸感淡底 | 页面底 |
| `--bg-1` | `#ffffff` | 卡片 / 输入面 |
| `--fg-0` | `#221c14` 深墨 | 主文字 |
| `--accent` | `#c79a4e` 金/琥珀 | accent（CTA 用更亮的 `--gradient-gold`） |
| `--surface-1/2`、`--track` | 深墨低透明 | 中性面 / 进度轨（淡底专用） |
| `--overlay-scrim` | `rgba(40,34,24,.45)` | 弹窗 / 抽屉遮罩 |
| `--video-letterbox` | `#1a1712` | 视频播放器黑边（唯一保留深色处） |
| `--radius-md / lg / pill` | 12 / 20 / 999px | 圆角体系 |

**关键特征**：

- 纸感淡底 + 柔和投影 + 大圆角；玻璃质感 `.glass` 改为淡底白玻璃
- 金/琥珀作为 CTA accent，避免与 music 的紫色 / celebrity 的紫罗兰撞色
- `.text-gradient-gold` 用更深的金渐变以保证淡底上的文字对比

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

- 后端 `/api/film/*` 真后端覆盖度提升（v0.45 已补 Drama 增删改 + 详情；Movie/Ad/VoiceWork 仍只读）
- 项目状态机正式落表（当前 Drama 行 + 内存推进）
- 跨子域 SSO（同 music / celebrity）
- **v0.45 生产硬化项**：`/api/film/**`、`/api/distribution/**` 当前 permitAll（无 owner 隔离，沿用 demo 姿态）—— 生产应迁 `/api/me/film`、`/api/me/distribution` 并强制认证
- **drama 发布任务为进度模拟**（`DramaPublishJob` 读时推进 queued→…→live，无真发布）；要真发到平台需接 sau（同 celebrity 的社媒账号绑定 + PublishJob 体系）
- ~~脚本工坊 `/scripts` 与短剧 `/short-drama` 是两套脚本~~ **（v0.7 已解决）**：两者合并入统一的 `/create` 主线 —— 结构化分镜（`DramaScript`，生成真源）为主，长文本 + 版本树（`Script`/`ScriptsApi`）作为「剧本」步内的编剧室 `ScriptProsePanel` 并行存在；`/scripts`、`/short-drama` 308 重定向到 `/create`
- v0.7 占位（即将上线，非造假）：`/create` 的「审核（合规预审）」步、「剪辑微调」、`/assets` 素材资产中心、`/topics` 实时热度榜；当前已落地的生成 / 分发链路是真的（复用 celebrity `material_video_job` 管线）
- **多集生成的诚实边界**：后端无「跨集续写剧情」端点，极速「多集」是对草稿端点逐集调用（live LLM 各集不同；mock 内容相近）。真正的剧情连续多集需新增后端，超出本期范围

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
