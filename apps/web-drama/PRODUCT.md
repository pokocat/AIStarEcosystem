# AI 短剧 · 产品 & 设计约束

> 子产品：**短剧工坊**（AI Drama Studio）— 用 AI 做多集短剧和单条短视频：和 AI 聊出故事、逐镜出首帧和视频、合成成片；数字人演员跨剧复用。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec.md`](../../product_spec.md)（数字人/数字 IP 主线，v2.7）。

**Last reviewed**: 2026-09-28（v0.197 文案 / 用户路径 / 响应式收口：术语表与导航决定见 [`docs/drama-ux-copy-pass.md`](../../docs/drama-ux-copy-pass.md)；§3 路由表、侧栏分组已按新叫法重写）

> ⚠️ **v0.98（2026-06-30）阶段调整**：短剧项目从 6 阶段收敛为 **5 阶段**——删除独立「**视频工厂**」阶段，**逐镜出片（出图 4 版 / AI 拆镜首尾帧 / 出视频 / 验收）全部并入「剧集脚本」的分镜表内**（脚本表 = 唯一逐镜工作面，更直观）。下文若仍提「视频工厂」为独立阶段，一律以本条为准（其能力已在剧集脚本分镜表）。「成片合成」前移为剧集第 2 步。剧集脚本不再锁定、可随时回改。真源 [`../../docs/drama-storyboard-consistency.md`](../../docs/drama-storyboard-consistency.md)。

---

## 1. 产品定位

**目标用户**：MCN 中的内容创作者、编导、短剧制作团队。

**价值主张**：用 AI 写剧本、出画面、拼成片，一个人也能做多集短剧和单条短视频；数字人演员在每一镜、每一部剧里长相保持一致。

**核心链路（v0.197，叫法以 [`docs/drama-ux-copy-pass.md`](../../docs/drama-ux-copy-pass.md) §2 术语表为准）**：

```
首页 /dashboard
  ├─ 还没想好 → 和 AI 聊（?b=<id>）→ 故事大纲 → 做成：多集短剧 / 单条短视频
  └─ 已经想好了？直接开始
       ├─ 做一部多集短剧 → /projects/new（新建不花积分）
       ├─ 从一句话做短视频 → /shorts/new
       └─ 粘贴写好的脚本 → /shorts/prompt（拆解免费）

多集短剧：我的短剧 /projects → 工作台 /projects/<id>
  · 短剧设定（所有集通用）：故事大纲 → 分集剧情 → 角色与场景（绑定数字人 / 定妆照 / 场景图）
  · 逐集制作 · 第 N 集：① 分镜（每镜：先出首帧 → 生成视频 → 就用这版；也可跳过首帧出视频）
                        ② 合成成片（有视频的镜头都会拼进去）→ 下载；发布到平台即将上线

单条短视频：/shorts/new 或 /shorts/prompt → 开始制作（扣一次开始制作费）→ 制作页 /shorts/make
  · AI 对话改脚本 + 分镜表逐镜出首帧 / 生成视频 / 就用这版（合成要求每一镜都点过，见 TODO）
  · 有台词的要先绑定数字人才能配音 → 合成成片 → 落在 /shorts?open=<id> 直接看成片

模板广场 /templates：做同款（单条走开始制作的同一个确认；多集直接新建，不花积分）
```

**素材与账户**：素材库（assets）/ 数字人演员（cast，从 AiAvatar 引入）/ 积分钱包（wallet）/ 收入与提现（finance）。
多平台发布、数据分析、趋势雷达、脚本库、戏服与道具在侧栏「即将上线」分组里，页面保留并如实说明哪部分还没做。形象创建（孵化 / 锻造炉）已于 v0.60 收敛至 AiAvatar。


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

**短剧工作台内部业务结构**（前端 mock 数据：`mocks/drama-workshop/`，按项目隔离）：

| 实体 | 在工作台的作用 |
|---|---|
| `DramaProjectSummary` | 短剧工坊项目卡 |
| `ContentType` / `Template` | 新建短剧的内容类型 + 爆款模板库（v0.63 增单集模板 t8-t11 + `TplMeta` 封面描述/估时大纲） |
| `ProjectInfo` | 项目信息条（标题/类型/集数/时长/画幅/logline/mainline） |
| `TopicCard` | 选题方向卡（AI 引导式三步的产物） |
| `EpisodeOutline` | 分集大纲（钩子/梗概/beat;v0.63 起也驱动左侧分集导航） |
| `CharacterDef` | 项目内角色（关键/龙套 + 数字人 avatar key 绑定） |
| `ScriptScene` / `ScriptLine` | 剧集脚本场景（v0.63 与分镜合并呈现;场景挂 `refs`(素材引用)/`sub`(字幕开关)） |
| `BoardScene` / `BoardShot` | 分镜（含 size/move/dur/engine/cast/line/voice/moods/done/overLimit;视频工厂逐镜推流水） |
| `PromptShot` | 成片配方（style/timeline/sound/refs 四段式） |
| `Material` / `MAT_CATS` | 素材库（标签:人物/场景/道具/其他;图片+视频;脚本 [参考N] 与工厂 @ 参考共用） |
| `ShortFormat` / `ShortVideoItem` | 短视频五种格式（带分镜节拍）+ 我的短视频资产 |
| `ReviewItem` | 剧本审阅队列（跨项目待审） |
| `IdeaRec` / `HOT_TOPICS` | 首页创意推荐池 + 近期热点 |

**后端契约不变**：仍走 `POST /api/me/drama/scripts*` + `POST /api/me/drama/episodes/generate`（v0.43）。前端 6 阶段工作台属于 UI 编排层，富数据先以 mock 演示，持久化由 `DramaScript.scenes[]` 承接（结构化扩展见 v0.45+ 后端契约规划）。

后端 API 在 [`/api/film/**`](../../specs/openapi.yaml)（按 tag 分组：film / wardrobe / appearance-forge / settings）。

---

## 3. 路由 & 页面清单

route group `(workspace)` 不出现在 URL；公开路径：`/`（landing）、`/login`、`/activate`。

| 路径 | 侧栏 | 功能 |
|---|---|---|
| `/dashboard` | 创作 · 首页 | **首页**：居中「和 AI 聊」对话框（还没想好的那条路，近期热点 +「随机来一个」）+「已经想好了？直接开始」三张卡（做一部多集短剧 → `/projects/new` 新建不花积分 / 从一句话做短视频 → `/shorts/new` / 粘贴写好的脚本 → `/shorts/prompt` 拆解免费）+ 热门模板 + 继续上次。聊天页 `?b=<id>`：对话 → 故事大纲 → 做成多集短剧或单条短视频 |
| `/projects` | 创作 · 我的短剧 | 多集短剧列表（继续上次 + 竖版网格）；「新建短剧」→ `/projects/new` |
| `/projects/new` | —（我的短剧内） | 新建短剧：一句话 + 类型 + 「互动剧」开关；「还没想清楚？先和 AI 聊聊」→ 聊天页。新建不花积分 |
| `/projects/[id]` | 沉浸式 | **短剧工作台**：「短剧设定」（故事大纲 / 分集剧情 / 角色与场景，所有集通用）→「逐集制作 · 第 N 集」两步：① 分镜（逐镜出首帧、生成视频、就用这版）② 合成成片。互动剧多一个「互动编排」。≤860 阶段轨变顶部横条、≤720 分集轨变集选择器 |
| `/projects/[id]/distribute` | 通用外壳 | 发布到平台（**即将上线**：分发仍是服务端模拟，页面如实说明） |
| `/shorts` | 创作 · 我的短视频 | 单条短视频列表；两张对照式入口卡「从一句话开始」/「粘贴写好的脚本」；`?open=<id>` 自动弹出该条成片预览（合成完成后落在这里） |
| `/shorts/new` | —（我的短视频内） | 从一句话开始：写一句想法，AI 写口播脚本和分镜；可从模板「做同款」带入 |
| `/shorts/prompt` | —（我的短视频内） | **粘贴写好的脚本**（v0.143 上线时叫「提示词直出」，v0.197 改名）：脚本、分镜稿、AI 视频提示词都行 → AI 按原文拆成人物与画面设定 + 逐镜分镜 → 预览改 → 开始制作。拆解免费，开始制作扣 `drama.credit.short-entry` |
| `/shorts/make` | —（我的短视频内） | 制作短视频：AI 对话 + 分镜表（逐镜首帧 / 视频 / 就用这版）→ 配音 → 合成成片。≤1024 变「对话 / 分镜」页签 |
| `/templates` | 创作 · 模板广场 | 官方与用户发布的模板（v0.75 起叫「创意市场」，v0.197 改名）；「做同款」：单条扣开始制作费（与 `/shorts/new` 同一个确认），多集新建不花积分 |
| `/templates/published` | 模板广场 · 我发布的模板 | 本人发布的模板按状态分档（审核中 / 已公开 / 未通过 / 平台邀请待你授权 / 已谢绝） |
| `/assets` | 素材 · 素材库 | 图片素材（人物 / 场景 / 道具 / 其他）增删改查 + AI 打标 |
| `/cast` · `/cast/[id]` | 素材 · 数字人演员 | 从 AiAvatar（数字人平台）引入的数字人演员与详情（v0.197 前叫「演员 IP 阵容」） |
| `/cast/[id]/generate` | — | **已下线**（v0.60 形象锻造）→ 提示页，去 AiAvatar 做新造型 |
| `/review` | —（无入口） | 剧本审阅。没有后端队列，入口隐藏，见 TODO |
| `/distribution` | 即将上线 · 多平台发布 | 平台连接与发布记录；**服务端仍是模拟**，页面顶部如实说明 |
| `/insights` | 即将上线 · 数据分析 | 如实空态（原页面是写死的假数据，v0.197 删除） |
| `/trends` | 即将上线 · 趋势雷达 | 占位 |
| `/scripts` · `/scripts/[id]` | 即将上线 · 脚本库 | 独立脚本（还不能带进某部短剧）；删除为真删，无版本历史 |
| `/wardrobe` | 即将上线 · 戏服与道具 | 只读浏览；上传未上线，引导去素材库 |
| `/wallet` | 账户 · 积分钱包 | 余额（各分项加起来 = 总余额）+ 买积分 + 积分明细 + 充值订单；顶栏余额点进来 |
| `/wallet/checkout` | — | 收银台 |
| `/finance` | 账户 · 收入与提现 | 作品收入与提现记录（v0.197 前叫「财务中心」），不再重复展示积分余额 |
| `/settings` | 账户 · 工作室设置 | 工作室 / 团队成员 |
| `/operations` | 运营 · 热点与推荐 | 仅运营身份可见 |
| `/incubator` · `/forge` · `/short-drama` | — | 已下线 / 已退役的提示页或跳转 |

详见 [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) GROUPS 定义。

**侧栏分组**（v0.197，术语与改动理由见 [`docs/drama-ux-copy-pass.md`](../../docs/drama-ux-copy-pass.md) §2–§3）：

1. **创作** — 首页 / 我的短剧 / 我的短视频 / 模板广场（子项「我发布的模板」）
2. **素材** — 素材库 / 数字人演员
3. **账户** — 积分钱包 / 收入与提现 / 工作室设置
4. **运营**（仅 `operatorRole`）— 热点与推荐
5. **即将上线**（灰一点、不带「建设中」胶囊；页面保留并如实说明哪部分还没做）— 多平台发布 / 数据分析 / 趋势雷达 / 脚本库 / 戏服与道具

Logo 与品牌名「短剧工坊」只作品牌，点 Logo 回首页；它不再是任何一个菜单项的名字。

---

## 4. 设计约束

### 4.1 视觉系统

**主题**：**明亮创意风**（v0.44 起,设计真源「短剧工坊」styles.css）—— 暖白底 + 橙红双点缀,
大圆角 + 柔和多层阴影,明亮通透留白足;视觉主角是缩略图卡片与竖屏 9:16 预览。
坚决避免后台管理系统的灰沉感、重边框、高饱和铺底。

**核心 CSS 变量**（[`src/styles/tokens.css`](src/styles/tokens.css)）：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg` | `#fafaf9` | 暖白页面底 |
| `--surface` / `--surface-2` | `#ffffff` / `#f5f5f4` | 卡片面 / 次级面 |
| `--accent` | `#f97316` | 暖橙主点缀 |
| `--accent-2` | `#e11d48` | 玫红次点缀 |
| `--accent-soft` | `color-mix(in oklch, accent 13%, #fff)` | 浅底 |
| `--ink` / `--ink-2` / `--ink-3` | `#1c1917 / #57534e / #a8a29e` | 三级文字灰 |
| `--radius-lg/--radius/--radius-sm/--radius-xs` | 22 / 16 / 11 / 8px | 偏大圆角 |
| `--shadow*` | 柔和多层 | 卡片 / 浮层 |
| `--gradient-hero` | 橙 → 玫红 | CTA / logo / 高亮 |

**关键特征**：

- 设计真源通用类全量可用：`.btn(-grad/-primary/-line/-ghost) .chip .tag .card .thumb .cost .overlay .fade-up .pop-in .slide-in-r .skel .home-blob .gen-range .ws-flush` 等（[`src/styles/app.css`](src/styles/app.css)）
- 橙红渐变作为 CTA accent，避免与 music（紫）/ celebrity（紫罗兰）撞色

### 4.2 字体

由 [`src/styles/tokens.css`](src/styles/tokens.css) 定义：

- 正文 `--font`：-apple-system → PingFang SC → HarmonyOS Sans SC → MiSans → 雅黑 → Noto Sans SC（中文友好回退链）
- 数字 / 集数 / 时长 `--font-num`：**Quicksand**（`tnum` 等宽数字,`.num` 类）

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
