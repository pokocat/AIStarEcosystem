# AI 短剧 · 产品 & 设计约束

> 子产品：**AI Drama Studio** — 演员 IP 阵容 + 脚本工坊 + 短剧项目 + 多平台分发，一体化短剧工坊。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec.md`](../../product_spec.md)（数字人/数字 IP 主线，v2.7）。

**Last reviewed**: 2026-06-12（v0.63 短剧工坊 v4:全局功能区导航 + AI 对话首页 + 剧本分镜合并 + 视频工厂 + 短视频工坊 / 模板库 / 剧本审阅 / 素材库）

---

## 1. 产品定位

**目标用户**：MCN 中的内容创作者、编导、短剧制作团队。

**价值主张**：以演员 IP 阵容为核心，AI 辅助完成「脚本撰写 → 形象锻造 → 项目排期 → 全网分发」闭环。

**核心链路（v0.63 / 设计稿 v4 重构后,主线）**：

```
首页（/dashboard，AI 对话框:短视频/短剧 双类型 + 近期热点 + 创意推荐）
  ├─ 短剧:开拍 / 套爆款模板 / 跟 AI 聊出故事
  │   →  短剧工坊（/projects，多集连续短剧资产库 + 继续上次）
  │   →  短剧工作台（/projects/<id>，沉浸式接管）
  │       · 项目设置(跨集共享):选题立项 → 大纲分集(试水 6 集/完整铺) → 角色与资产
  │       · 剧集制作(逐集推进,左侧分集导航 + 顶部步骤页签):
  │         ① 剧集脚本(结构化分镜表单:基础通用信息 + 逐镜【时间线/画面/人声·音效·BGM/
  │            镜头参数/特效氛围/参考素材】;输入 @ 引用素材;左下悬浮 AI 对话
  │            【衍生上一集/给我惊喜】;逐镜可先渲首帧再出成片)
  │         ② 视频工厂(每镜双路径:先渲首帧 2 分稳妥 / 直出视频 9 分快;
  │            首帧 4 选 1 → 锁定 → 渲动态 → 验收入片;生成设置:模型/画幅/分辨率 + @素材参考)
  │         ③ 成片配方(@图片N 渲染数字人头像缩略图,四段式可复制导出)
  │       · 一键连跑可加速跑完剩余阶段;每步可锁定/回改
  └─ 短视频:开做 →  短视频制作（/shorts/make,左 AI 对话 + 右口播脚本表 → 视频工厂）
      →  短视频工坊（/shorts,短视频 + 宣传片/自传等单集作品资产库;从短剧切片推广）
```

**提效与素材（跨项目复用）**：模板库（templates，多集/单集筛选 + 统一预览 + 运营身份可新建模板）/ 剧本审阅（review，跨项目待审队列 + Excel 式平铺表格）/ 素材库（assets，标签化图片视频:人物/场景/道具,生成时 @ 作参考）/ 演员 IP 阵容（cast）/ 戏服与道具（wardrobe）/ 跨项目脚本归档（scripts）。形象创建（孵化 / 锻造炉）已于 v0.60 收敛至 AiAvatar。


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

| 路径 | 模块 | 功能 |
|---|---|---|
| `/dashboard` | 创作 | **首页 · AI 开拍（v0.63）**:居中 AI 对话框（短视频/短剧切换 + 近期热点 + 今日灵感）+ 封面式创意推荐（统一预览弹窗）+ 继续上次 |
| `/projects` | 创作 | **短剧工坊**:多集连续短剧资产库（继续上次大卡 + 紧凑竖版网格 + 套模板开剧/从零开剧） |
| `/projects/new` | 创作 | 新建短剧（选类型 → AI 引导式三步 / 爆款模板式） |
| `/projects/[id]` | 创作 | **短剧工作台（沉浸式,v4 形态）**:项目设置走左阶段轨;剧集制作走左分集导航 + 顶部步骤页签（剧集脚本 → 视频工厂 → 成片配方） |
| `/projects/[id]/distribute` | 创作 | 项目多平台发布 |
| `/shorts` | 创作 | **短视频工坊（v0.63 新增）**:短视频 + 宣传片/自传等单集作品资产库;从短剧切片推广入口 |
| `/shorts/make` | 创作 | **短视频制作（v0.63 新增）**:左 AI 对话 + 右结构化分镜表单（时间线/画面/人声·音效·BGM/镜头参数/特效氛围/参考,@ 引用素材）→ 视频工厂双路径出片 → 合成成片 |
| `/templates` | 提效 | **模板库（v0.63 新增）**:多集短剧/单集短视频形态筛选 + 类型筛选 + 统一预览（封面/描述/估时大纲);运营身份可新建模板/爆款拆解入库 |
| `/review` | 短剧工坊内 | **剧本审阅（v0.63 新增;补丁后从一级菜单收进 /projects 入口卡）**:跨项目待审队列 → Excel 式平铺表格,逐场 通过/改一下,意见发给 AI 重写 |
| `/assets` | 素材 | **素材库（v0.63 新增）**:标签化图片/视频（人物/场景/道具/其他)增删改查 + AI 自动打标 + 详情(关联使用);与视频工厂 @ 参考、脚本 [参考N] 同源 |
| `/cast` | 素材 | 演员阵容（多艺人卡片墙） |
| `/cast/[id]` | 素材 | 演员详情（履历 / 装备 / 历史项目） |
| `/cast/[id]/generate` | 素材 | 演员形象生成（针对某角色） |
| `/incubator` | — | **v0.60 已下线** → 提示页（数字人统一在 AiAvatar 创建后引入） |
| `/forge` | — | **v0.60 已下线** → 提示页（同上；cast 内可「引入数字人 / 更换展示图」） |
| `/wardrobe` | 素材 | 戏服 / 道具上传 + 分配给演员 |
| `/scripts` | 素材 | 脚本库（多版本对比） |
| `/scripts/[id]` | 素材 | 脚本编辑器（**版本树 + AI 续写**） |
| `/short-drama` | — | **已退役** → 跳转 `/projects`（单页生成被 6 阶段工作台取代） |
| `/distribution` | 分发与洞察 | 分发总览（跨项目聚合） |
| `/insights` | 分发与洞察 | 数据洞察（窗口选择 + 维度切换） |
| `/trends` | 分发与洞察 | 趋势雷达（行业 / 题材热度） |
| `/finance` | 账户 | 财务（充值 / 提现 / 流水） |
| `/settings` | 账户 | 工作室 / 团队成员 |

详见 [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) GROUPS 定义。

**Sidebar 分组**（5 组,v0.63 / 设计稿 v4 形态）：

1. **创作**（3 项）— 首页 / 短剧工坊 / 短视频工坊
2. **提效**（1 项）— 模板库（剧本审阅已收进短剧工坊页内入口卡,带待审角标）
3. **素材**（4 项）— 素材库 / 演员 IP 阵容 / 戏服与道具 / 脚本工坊
4. **分发与洞察**（3 项）— distribution / insights / trends
5. **账户**（2 项）— finance / settings

底部另有「运营身份」开关（演示;开启后模板库出现「新建模板」与爆款拆解入库入口）。

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
