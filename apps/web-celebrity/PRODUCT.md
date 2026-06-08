# AI 明星带货 · 产品 & 设计约束

> 子产品：**AI Celebrity Studio** — 基于真人明星授权的 AI 复刻 IP 带货平台。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec_ai_celebrity.md`](../../product_spec_ai_celebrity.md)（AI 明星带货主线，v0.5.x）。

**Last reviewed**: 2026-05-30

---

## 1. 产品定位

**目标用户**：MCN 制作人、明星经纪人、电商带货团队。

**价值主张**：从「明星授权获取」到「AI 复刻视频量产」到「全网带货分发」的链路工作台。

**核心链路**：

```
浏览明星市场（market）  →  申请授权（apply）  →  AI 生成带货视频（generate / mixcut）  →  项目管理（projects）  →  视频库（library）  →  数据中心（data）
```

**与其他子产品的边界**：

- **vs AI 音乐人** — music 用纯虚拟数字人做音乐 IP；celebrity 用**真人明星授权 + AI 复刻**做电商带货
- **vs AI 短剧** — drama 用虚拟演员做剧情短剧；celebrity 用真人明星的电商带货短视频
- **vs 小程序（消费方）** — 微信小程序 [`apps/miniprogram`](../miniprogram) 是「带货方」用户端；web-celebrity 是「制作人 / MCN」的工作台

---

## 2. 业务领域

类型源：`@ai-star-eco/types`（packages/types）核心域 `celebrity-zone`。

| 领域 | 实体 | 在 web-celebrity 的作用 |
|---|---|---|
| `celebrity-zone` | `CelebrityStar`、`CelebrityStarAuthorization`、`CelebrityProject`、`ProjectVideo`、`Template` | 明星 IP / 授权关系 / 项目 / 生成视频 / 模板 |
| `product` | `Product`、`ProductCategory`、`ProductInput` | 商品库（带货商品） |
| `mixcut` | `RenderJob`、`RenderOutput`、`Template`、`MixcutDraft`、`SlotBinding`、`StarClip`、`ProductClip`、`Asset` | 混剪专区：模板 → 实例（草稿）→ 渲染任务 |
| `wallet` | `Wallet`、`LedgerEntry`、`RechargeOrder` | 积分钱包（topbar 显示）；v0.56 起充值走「下单 → 运营核准入账」，钱包页含「我的充值订单」 |
| `account` | `AepUser`、`Tenant` | 工作室 / 多租户 |

**授权状态机**（`CelebrityAuthStatus`，wire 全小写）：

```
unauthorized  →  pending  →  authorized
                                 │
                                 ↓
                              expired
```

详见 [`product_spec_ai_celebrity.md`](../../product_spec_ai_celebrity.md) §授权状态机。

---

## 3. 路由 & 页面清单

route group `(workspace)` 不出现在 URL；公开路径：`/`（landing）、`/login`、`/activate`。

### 3.1 主工作台

| 路径 | 模块 | 功能 |
|---|---|---|
| `/dashboard` | 工作台 | 今日总览（KPI / 待办 / 进行中任务） |
| `/market` | 工作台 | 明星市场（浏览所有可申请明星；**运营**额外有「新增 / 编辑 / 删除明星」入口，v0.55） |
| `/cast` | 工作台 | 我的明星（已授权明星墙） |
| `/star/[starId]` | 详情 | 明星详情（含授权状态、可申请档位、过往项目；**运营**额外有「编辑 / 删除明星」，v0.55） |
| `/star/[starId]/apply` | 详情 | 授权申请表单（定价档位选择） |
| `/star/[starId]/generate` | 详情 | 生成工作流（模板 / 盲盒选择 → AI 生成视频） |
| `/projects` | 制作 | 我的项目（多项目管理） |
| `/projects/[projectId]` | 制作 | 项目详情（视频管理 / 状态推进） |
| `/products` | 制作 | 商品库（v0.31 起公共池只读：浏览 / 筛选 / 「生成视频」入口；CRUD / 抖音链接建档 / 刷新图片由运营在 admin 管理） |
| `/library` | 制作 | 视频库（v0.44 聚合三类成片，只读浏览：来源 Tab `?source=project\|material\|mixcut` = 明星视频 / 脚本视频 / 混剪成片） |
| `/data` | 洞察 | 数据中心（分发占比 / 转化率） |

### 3.2 混剪专区（v0.7 内嵌 + v0.8 真后端）

| 路径 | 模块 | 功能 |
|---|---|---|
| `/mixcut` | 制作 | 混剪首页（KPI + 热门模板 + 最近任务） |
| `/mixcut/templates` | 制作 | 模板库（筛选 / 搜索；**运营**额外有「新建 / 删除工厂模板」入口，v0.55） |
| `/mixcut/templates/[id]` | 制作 | 模板详情（slot schema + 扰动变体预览；**运营**保存=就地写工厂模板（全员可见）+ 可删除工厂模板，v0.55） |
| `/mixcut/create/[id]` | 制作 | 新建渲染任务（slot 填充 + perturbation profile + 变体数）；`?draft_id=X` 恢复实例填充态（v0.48）；「保存草稿」/「改模板（先存草稿）」 |
| `/mixcut/drafts` | 制作 | 草稿箱 / 我的实例（v0.48）—— 保存的填充配置，可继续编辑 / 直接生成 / 删除 |
| `/mixcut/jobs` | 制作 | 渲染任务列表 |
| `/mixcut/jobs/[id]` | 制作 | 任务详情（进度 + 产出 + 槽位绑定 + 扰动详情 + 水印追溯） |
| `/mixcut/library` | 制作 | 混剪素材库（v0.44 起仅制作素材三 tab：我的素材 / 商品素材 / 官方明星片段；成片视频已迁到 `/library?source=mixcut`） |

**Sidebar 分组**（[`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) 第 37-63 行）：

1. **工作台** — `/dashboard` / `/market` / `/cast`
2. **制作** — `/projects` / `/library` / `/products` / `/mixcut`
3. **洞察** — `/data`

详情页 `/star/<id>`、`/projects/<id>`、`/mixcut/*` 子路由不挂在 sidebar 父级（设计选择 —— 避免与 list 父级竞争高亮）。

**运营内嵌管理（v0.55）**：登录账号 `operatorRole ∈ {operator, super_admin}`（判定见 [`src/lib/operator-role.ts`](src/lib/operator-role.ts) `canUseOperatorTools`）时，在 web-celebrity 内直接获得「商品库（v0.31）/ 明星（v0.55）/ 混剪工厂模板（v0.55）」的写入口；写操作走 `/api/admin/**`，server `hasAnyRole(SUPER_ADMIN, OPERATOR)` 兜底。**运营管理的是共享池** —— 编辑/删除工厂模板与明星对全员生效。普通用户（STUDIO）：明星只读、模板仅浏览 + 用模板创建任务（模板写入口关闭）。

### 3.3 路由兼容

[`src/proxy.ts`](src/proxy.ts) 308 重定向：

```
/console               → /dashboard
/console?tab=<id>      → /<id>（market / cast / projects / products / library / data）
/console/star/<id>     → /star/<id>
/console/projects/<id> → /projects/<id>
```

旧 `/producer/celebrity-zone/*` 链接已统一替换为新顶层路径。下个版本删除 proxy.ts。

---

## 4. 设计约束

### 4.1 视觉系统

**主题**：Creator-Friendly（紫罗兰 accent + 奶油底 + 暖米色阶；中性化 + 创作友好）。

**核心 CSS 变量**（[`src/styles/tokens.css`](src/styles/tokens.css) + [`src/styles/app.css`](src/styles/app.css)）：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#faf7f2` | 奶油底（页面背景） |
| `--bg-1` / `--bg-2` | 暖米浅 / 暖米中 | 卡片 / 强调区 |
| `--fg-0` / `--fg-1` / `--fg-2` / `--fg-3` | 深 → 浅 | 文字 4 级 |
| `--accent` | `#7c5cff` | 紫罗兰 accent |
| `--accent-soft` | 浅紫 hint | 选中态 / hover |
| `--accent-strong` | 深紫强调 | 钱包数字 / KPI 高亮 |
| `--line` / `--line-2` | 浅米 / 米深 | 边框 |
| `--extra-rose` | `#ff5b8a` | 危险 / 标签 romance |
| `--extra-peach` | `#ff8a5b` | extra 桃 |

**Tailwind v4 palette 映射**（[`src/styles/app.css`](src/styles/app.css) `@theme {}`）：

把 Tailwind 默认调色板「对接」到 Creator 主题：

```
zinc-*      → 暖米/sand 阶（与 cream bg-0 协调）
violet-*    → 紫罗兰 accent
emerald-*   → success 青绿
amber-*     → warning 琥珀
pink-*      → tag-romance / danger
rose-*      → 同 pink
orange-*    → extra-peach
brand-*     → 紫罗兰（mixcut 兼容映射，见 §5）
fuchsia-*   → 紫罗兰深档
```

这意味着 celebrity-zone 业务组件用任意 Tailwind 颜色（`bg-zinc-100`、`text-violet-600`）都会落到 Creator 主题色，主题切换时业务组件免改色。

### 4.2 字体

由 root layout（[`src/app/layout.tsx`](src/app/layout.tsx)）注入：

- **Inter** → 主正文 / UI label
- **Space_Grotesk** → display / 标题强调

无 serif（drama 才有）。

### 4.3 布局

- **Sidebar**：220px 固定宽，3 分组（工作台 / 制作 / 洞察）
- **Topbar**：48px，breadcrumb + 搜索 + 导出按钮 + accent CTA「新建项目」+ 钱包余额 + 头像 + 退出
- **主体**：max-w 1600px，padding 24-28px

### 4.3.1 移动端 H5（v0.45+）

- **断点 768px**：`useIsMobile()`（[`@ai-star-eco/ui/ui/use-mobile`](../../packages/ui/src/ui/use-mobile.ts)）在窄屏把 `(workspace)` 桌面 shell 整体换成 [`MobileShell`](src/components/creator/MobileShell.tsx)（精简顶栏 + 固定底部 Tab Bar「今日 / 市场 / 混剪 / 分发 / 更多」+「更多」打开复用桌面 `Sidebar` 的左侧 `Sheet` 抽屉）。桌面 220px 栅格分支不变。
- **新页面/改页面约束**：避免内联 style 写死的多列栅格（`gridTemplateColumns: "repeat(N,1fr)"`/`"1.4fr 1fr"` 等）在窄屏溢出。统一手法 —— 给该 grid 附加 `.stack-mobile`（塌 1 列）或 `.stack-mobile-2`（塌 2 列）类（定义在 [`styles/app.css`](src/styles/app.css)，`!important` 仅 <768px 生效，桌面不受影响）；密集表格在窄屏用横向滚动容器或卡片列表。优先用 Tailwind 响应式断点（`sm:`/`md:`）写新组件。
- **安全区**：`app/layout.tsx` 的 `viewport` 设 `viewport-fit=cover`；移动 shell 顶/底用 `env(safe-area-inset-*)`。
- **重型编辑器**（模板画布编辑器 / 脚本双栏编辑器）移动端先做「查看 + 轻编辑」，复杂排版引导桌面（v0.45 范围，后续增量）。

### 4.4 组件分层

```
@ai-star-eco/ui           — shadcn 48 个原语（共享）
@ai-star-eco/api-client   — apiFetch / AuthProvider / format / useAuth
src/components/creator/   — 业务原语本地包装：
                            Avatar / Button / Card / Chip / DataTable / GradientBlock
                            Input / KpiCard / Meter / Sidebar / Tabs / Topbar
src/components/celebrity-zone/  — 33 个业务组件（从 apps/web 迁入 Phase 4b）：
                            CelebrityMarket / CelebrityStarDetail / CelebrityApplyForm
                            CelebrityGenerationWorkspace / CelebrityProjectDetail
                            CelebrityProductLibrary / CelebrityVideoLibrary / CelebrityDataCenter
                            CelebrityWatermarkVideo / 等
src/components/mixcut-zone/     — 混剪专区（v0.7 从 mixcut/frontend 内嵌）：
                            template-preview.tsx / slot-input.tsx
                            ui/ 子目录 12 个 shadcn 原语（独立一份避免样式漂移）
                            lib/utils.ts / types.ts
```

---

## 5. 混剪专区（v0.7 / v0.8）

> 完整功能：模板化的 AI 复刻短视频量产；每个变体真实做视频拼接 + 图片贴图 + 随机剪切 + perturbation。

### 5.1 用户旅程

1. 进入 `/mixcut` 看首页 KPI 与热门模板
2. `/mixcut/templates` 浏览模板，按品类 / tier 筛选
3. 点开模板详情 `/mixcut/templates/<id>` 查看 slot 结构 + 扰动变体预览
4. 点「使用此模板创建」进入 `/mixcut/create/<id>`
5. 填充 slot（明星片段 / 商品图 / 文本 / 贴图）+ 选 perturbation profile（light / moderate / aggressive）+ 选变体数（1-20）
6. （可选，v0.48）点「保存草稿」把这份填充存为**实例**；想改模板时点「改模板（先存草稿）」避免内容丢失。实例进 `/mixcut/drafts` 草稿箱，可继续编辑 / 反复生成
7. 提交 → 后端 ffmpeg 真渲染 → 跳到 `/mixcut/jobs/<jobId>`；从实例生成的任务带 `draft_id`，详情页显示「来自实例」可深链回去继续编辑
8. 实时进度推进（轮询 GET /api/mixcut/jobs/<id>）
9. 完成后看产出网格（N 个 mp4 变体），每个有不同的 phash / 应用扰动算子
10. 下载单个 / 全部（ZIP）/ 重渲

> **v0.48 模版 → 实例 → 生成任务**：实例（`MixcutDraft`）是模版与任务之间的持久化中间层 ——
> 「针对某模版配好的素材绑定 + 扰动设置」。解决「改模板就把填的内容全丢了」+ 让同一份配置可
> 反复生成、可回溯。端点 `/api/mixcut/drafts`（CRUD + `/{id}/generate`）。实例是 opt-in：不点
> 保存就维持 v0.47 行为（生成任务无 draft_id）。

### 5.2 数据模型（前端）

定义在 [`src/components/mixcut-zone/types.ts`](src/components/mixcut-zone/types.ts)：

| 类型 | 关键字段 |
|---|---|
| `Template` | `template_id`、`canvas`、`slots`、`perturbation_profile`、`output_variants_default`、`quality_gate` |
| `TemplateSlot` | `slot_id`、`layer_type`（video / image / sticker / text / audio / digital_human）、`z_index`、`rect`、`time_range`、`fill_strategy`、`perturbation` |
| `SlotBinding` | 4 种：`{source:"library", asset_id}` / `{source:"upload", file_url}` / `{source:"input", text}` / `{source:"fixed"}` |
| `RenderJob` | `id`、`template_id`、`slot_bindings`、`perturbation_profile`、`output_variants`、`status`、`progress`、`outputs` |
| `RenderOutput` | `variant_index`、`file_url`、`thumbnail_url`、`file_size`、`duration`、`phash_signature`、`phash_distance_to_source`、`applied_transforms`、`watermark_token` |

**Perturbation profile**：

| profile | 速度 | 亮度 | 饱和度 | 镜像 |
|---|---|---|---|---|
| `light` | ±5% | ±0.05 | 1.0（不变） | 不镜像 |
| `moderate` | ±10% | ±0.10 | ±0.10 | 50% 概率 |
| `aggressive` | ±20% | ±0.15 | ±0.15 | 50% 概率 |

### 5.3 后端真渲染管线（v0.8）

**Spring Boot 实施**（apps/server）：

```
config/
  MixcutProperties.java        — aep.mixcut.* 配置
  MixcutAsyncConfig.java       — @EnableAsync + ThreadPool + /static/mixcut/** 资源映射
model/
  MixcutRenderJob.java         — 任务表（status / progress / slot_bindings_json / output_variants）
  MixcutRenderOutput.java      — 输出表（variant_index / file_url / applied_transforms_json）
repository/
  MixcutRenderJobRepository    + MixcutRenderOutputRepository
dto/
  MixcutRenderJobDto + MixcutRenderOutputDto + MixcutCreateJobRequest + MixcutUpdateProgressRequest
  (用 @JsonProperty 把 Java camelCase 映射回前端 snake_case)
service/mixcut/
  FfmpegRunner.java            — ProcessBuilder 包装：runFfmpeg(args) / probeDurationSec
  AssetDownloader.java         — HTTP 下载到 work-dir，SHA-256 缓存
  MixcutJobService.java        — CRUD + TransactionSynchronization.afterCommit 触发 worker
  MixcutRenderingService.java  — @Async 实际 ffmpeg pipeline
controller/
  MixcutController.java        — REST：GET / POST / PATCH /api/mixcut/jobs[/{id}{/progress}]
```

**ffmpeg pipeline**（每变体真做）：

1. **拼接**：concat 2+ 个明星片段（每段 trim 7.5s，每变体不同起始 offset）
2. **贴图**：`overlay` 半透明色卡（紫罗兰 #7c5cff@0.55，480×120）+ `drawbox` 装饰条带（顶/底色条 + 中央高光条）
3. **剪切**：每段 `-ss <random_offset>` 随机起始 + `-t <duration>` 截取
4. **Perturbation**：`eq=brightness:saturation` + 可选 `hflip` 镜像 + `setpts=*PTS` 速度变化
5. **编码**：libx264 ultrafast crf=24 yuv420p +faststart

**输出文件结构**：

```
mixcut-output/
  <jobId>/
    v1.mp4   ← 变体 1（720×1280, h264, 30fps, ~10MB）
    v2.mp4   ← 变体 2（参数不同）
    ...
```

通过 [`MixcutAsyncConfig`](../../apps/server/src/main/java/com/aistareco/aep/config/MixcutAsyncConfig.java) 的 `WebMvcConfigurer.addResourceHandlers`，外部目录映射到 `/static/mixcut/**` URL。

### 5.4 关键配置（[`apps/server/src/main/resources/application.yml`](../../apps/server/src/main/resources/application.yml)）

```yaml
aep:
  mixcut:
    output-dir: ${AEP_MIXCUT_OUTPUT_DIR:./mixcut-output}     # 输出目录
    work-dir: ${AEP_MIXCUT_WORK_DIR:./mixcut-work}            # 素材下载临时区
    ffmpeg-bin: ${AEP_FFMPEG_BIN:ffmpeg}                      # ffmpeg 可执行路径
    ffprobe-bin: ${AEP_FFPROBE_BIN:ffprobe}
    public-url-base: ${AEP_MIXCUT_PUBLIC_URL_BASE:/static/mixcut}
    max-concurrent: ${AEP_MIXCUT_MAX_CONCURRENT:2}            # 并发渲染数
    max-output-duration-sec: ${AEP_MIXCUT_MAX_OUTPUT_DURATION_SEC:15}
    max-asset-bytes: ${AEP_MIXCUT_MAX_ASSET_BYTES:104857600}  # 100 MB
    ffmpeg-timeout-ms: ${AEP_MIXCUT_FFMPEG_TIMEOUT_MS:120000} # 2 分钟
```

### 5.5 前端配置

**独立开关**（[`src/api/mixcut.ts`](src/api/mixcut.ts)）：

```ts
const REAL_BACKEND = process.env.NEXT_PUBLIC_MIXCUT_USE_REAL === "1";
const USE_LOCAL = USE_MOCK && !REAL_BACKEND;
```

可在 `USE_MOCK=1`（其他模块走 mock）时仅让 mixcut 切到真后端。

**Next rewrites**（[`next.config.mjs`](next.config.mjs)）：

```js
{ source: "/api/:path*",    destination: `${apiBase}/api/:path*` }
{ source: "/static/:path*", destination: `${apiBase}/static/:path*` }  // mp4 通过 Next 代理
```

### 5.6 wire 命名规范

**例外**：mixcut 全套使用 **snake_case**（沿用 mixcut 原型），与本仓库其他模块的 `camelCase` 不同。后端用 `@JsonProperty` 显式映射；前端 TS 字段也是 snake_case。

理由：mixcut 是独立项目内嵌（v0.7），代码大批量沿用原命名 —— 全改 camelCase 工作量过大且不必要。新模块**不要**学这个，仍走 `camelCase`。

### 5.7 用户素材库（v0.9 新增）

**数据模型**（[`MixcutAsset.java`](../../apps/server/src/main/java/com/aistareco/aep/model/MixcutAsset.java)）：

```
id           : asset_<16 hex>
user_id      : sanitize 过的用户 ID（暂未接 JWT principal，由 form 字段传）
kind         : video / image / sticker / bgm
name         : 用户填或文件名
file_url     : /static/mixcut-assets/<user>/<id>.<ext>
local_path   : 服务器本地绝对路径（worker 用）
mime_type    : 原 Content-Type
file_size    : 字节数
duration     : 视频/音频时长（ffprobe 探测）；图片为 0
tags         : 逗号分隔（可选）
uploaded_at  : ISO-8601 OffsetDateTime
```

**REST API**：

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/mixcut/assets`（multipart） | 上传：字段 `file` `kind` `user_id?` `name?` `tags?` |
| `GET` | `/api/mixcut/assets?kind=&user_id=` | 列表，可按 kind / userId 筛选 |
| `GET` | `/api/mixcut/assets/{id}` | 详情 |
| `DELETE` | `/api/mixcut/assets/{id}` | 删除（含本地文件） |

**MIME 白名单**：

| kind | 接受 mime |
|---|---|
| video | mp4 / mov / webm / mkv |
| image, sticker | png / jpeg / webp / gif |
| bgm | mp3 / wav / aac / m4a / ogg |

超过 `aep.mixcut.max-asset-bytes`（默认 100 MB）拒收；Spring multipart 整体上限 `spring.servlet.multipart.max-file-size`（默认 200 MB）。

**渲染管线消费方式**（[`MixcutRenderingService.resolveBindings`](../../apps/server/src/main/java/com/aistareco/aep/service/mixcut/MixcutRenderingService.java)）：

```
binding.asset_id → MixcutAsset.local_path  （首选，最稳）
binding.file_url → 若是本 server 的 /static/mixcut-assets/<u>/<f> 直接 resolve
                 → 否则 HTTP 下载（AssetDownloader）
找不到 → fallback 到 apps/web/public/videos/showreel-*.mp4
```

按后缀分类：`.mp4/.mov/.webm/.mkv` 进底层视频拼接；`.png/.jpg/.jpeg/.webp/.gif` 进 overlay 链。最多 3 张 overlay，分布策略：

| overlay 数 | 位置 |
|---|---|
| 1 张 | 底部居中 |
| 2 张 | 顶部中 + 底部中 |
| 3 张 | 左上 + 右上 + 底中 |

每张 scale 到不超过画面 60% 宽。

### 5.8 v0.13 扰动贴图池

每变体在已有 image overlay 之上**再叠一层动效 GIF**，按 (jobId+variantIndex) 作 seed 从 preset 池随机抽样。提升「同模板生成的若干变体」之间的视觉差异度，绕开平台同质化判定。

**数据**：

- `MixcutAsset` 加 `isPreset / presetGroup / previewUrl` 列。预置素材 `ownerUserId=null`，所有用户可见。
- `MixcutRenderJob.stickerPoolJson` 结构：`Map<slotId, { pool_ids[], coverage, opacity, scale_pct, pick_count }>`。`_global` 键表示不绑定具体 slot（整片随机位置）。

**预置 GIF 来源**（双轨）：

1. `apps/server/src/main/resources/preset-stickers/<group>__<name>.gif` —— `MixcutPresetSeeder` 启动时复制到 fs + 入库
2. **空池兜底**：DB 中 preset 为 0 时，ffmpeg lavfi 程序化生成 5 张 demo（黄色星星 / 粉色脉冲 / 蓝色色带 / 紫色脉冲 / 彩虹角标），保证 dev 环境零依赖跑通

**ffmpeg 渲染**：`-stream_loop -1` 让 GIF demuxer 循环到 totalDuration → filter `format=yuva420p,scale=W:-2,colorchannelmixer=aa=opacity` → `overlay=x=...:y=...:enable='between(t,start,end)':format=auto`。

**已知限制**：GIF 二值 alpha → `colorchannelmixer=aa=0.7` 只把"已不透明像素"调成 70% 透明（透明像素保持透明），等于"贴图整体调薄"，不是边缘羽化。生产需要 alpha 渐隐时升级到 .mov ProRes4444 或 .webm vp9-alpha。

### 5.9 v0.14 CDN 抽象

渲染产物先落本地 `mixcut-output/<jobId>/v<N>.mp4`，再串行上传到 `CdnUploader`。dev 用 `LocalFakeCdnUploader`（复制到 `./cdn-mock/<key>`，URL `/cdn/<key>`，server 自带静态 handler，nginx / Next rewrite 走 same-origin）；生产换 `AliyunOssCdnUploader`（v0.16+ 实现）。

- `MixcutRenderOutput` 加 `cdnUrl / cdnKey / cdnThumbnailUrl / cdnUploadedAt` 列。
- 上传失败 1 次重试；再失败保留 `fileUrl` 仅 WARN（不阻塞 job 状态推进）。
- job 失败时按 `cdnKey` 调 `uploader.delete` 清理孤儿。
- 配置：`aep.cdn.driver=local|oss`、`aep.cdn.local-root`、`aep.cdn.public-base-url`（默认 `/cdn`，相对路径走 same-origin；绝对 URL 由外部 OSS 直供）。

### 5.10 v0.15 混剪 → 发布桥接 + 定时

**Server**：
- `POST /api/me/mixcut/publish-batch` —— body `{ outputs: [{output_id, cdn_url, thumbnail_url}], title, description?, tags?, cover_url?, targets: [{platform, social_account_id, scheduled_at?}], source_mixcut_job_id? }`。outputs[].cdn_url 必填，缺失计入 `failed_items[].reason="MISSING_CDN_URL"`。
- 部分成功语义：每 output 独立 try/catch + 调 `PublishJobService.createBatch`；单条失败不影响其他 output。
- **定时调度**：`AiStarEcoApplication` 加 `@EnableScheduling`；`PublishJobScheduler @Scheduled(fixedDelay=60s, initialDelay=30s)` 扫 `status=QUEUED AND scheduledAt<=now()` 自动调 `startJob`。复用 QUEUED，不新增 SCHEDULED 状态。

**前端入口（v0.15 初版）**：单任务详情 / `/mixcut/publish` 跨任务 / `/distribution` 反向跳。
**v0.16 调整**：见 §5.12 — 跨任务工作台迁入分发中心，混剪只负责制作。

**定时 UI（v0.15 初版）**：`<input type="datetime-local">` + 提交时 `new Date(local).toISOString()` 显式转 UTC。提示文本注明本地时区 + 60s 调度延迟。
**v0.20 升级**：见 §5.13 — 「定时」checkbox 退役，换三选一策略（立即 / 单次定时 / 每日铺开），支持时段池 + 容量模式 + 随机抖动。

### 5.12 v0.16 分发工作台迁入分发中心

把 v0.15 的跨任务工作台 `/mixcut/publish` 迁入 `/distribution`，让用户行为路径「批量制作 → 绑账号 → 派单」线性闭环在分发中心收口；混剪只负责制作。

**新 IA**（`components/distribution/DistributionPage.tsx`）：

| 区域 | 内容 |
|---|---|
| Header | 标题 + 「手动分发」常驻按钮（右上） |
| 状态条 | 已绑账号 / 可发变体 / 进行中任务 三个 StatChip（点击切对应 tab） |
| Tabs | 分发工作台（默认）· 账号管理 · 任务追踪 |

URL：`?tab=workbench|accounts|tracking`；workbench 是默认 tab，URL 省略。

**核心：分发工作台**（`components/distribution/DistributeWorkbench.tsx`）

主区双视图切换：
- `grid`（默认）：所有任务的可发变体平铺成统一网格（按 `created_at` 倒序），缩略图顶贴任务名 chip + 底贴 v 编号。像「选照片」一样勾视频，混任务对比体验最好。
- `group`：按任务卡片（同 v0.15 行为），任务名 / created_at / 可发数 / 已选数 + 「全选本任务」+ 展开变体；任务多于 5 条变体时折叠收起。

工具条：搜索框（模板名 / 任务 ID）· 视图切换 · 「显示全部 / 仅未发布」过滤开关（v0.19 起，默认 OFF = 显示全部）· 刷新。
统计条：`X 条可发布变体（Y/Z 任务）` + 「全选当前 X 条」。

Sticky right rail：
- 已选缩略图九宫格（>8 折叠为 `+N`）+ 清空选择
- 「继续配置发布 (N)」CTA → 弹出现有 `BatchPublishDrawer`（items[] 模式）配账号 + 文案 + 定时 → 派单
- 帮助提示 + 「账号管理」深链

**深链：从混剪深链进入**

`/distribution?from_job=<mixcutJobId>` 触发：
- 强制 `workbench` tab + `group` 视图
- 自动展开目标任务、勾选其全部可发变体
- smooth scroll 到该任务卡片
- 卡片紫边 ring + 「来自混剪」chip 高亮

入口位置：`/mixcut/jobs/[id]` 详情页保留单任务「批量发布」drawer（行为不变），同时新增 ghost 按钮「去分发中心 →」深链。

**派发计数（v0.19+ 替代 v0.16 的 localStorage 去重）**

视频库默认显示全部可发变体（含已派发过的），允许同一变体再次分发到新账号或新时间窗。派发记忆改走 server：

- `MixcutRenderOutput` 新增 `publishCount` (`@ColumnDefault("0")`) 与 `lastPublishedAt` 两列。
- `MixcutPublishService.batchPublish` 每条 output 派单成功后按 target 数累加 `publishCount` 并刷新 `lastPublishedAt`。tracker 写库失败只 log，不阻塞派单。
- DTO 出 wire 为 `publish_count` / `last_published_at`，前端 `RenderOutput` 同名读。
- 缩略图徽标：`publish_count > 0` 时渲染绿色「已发 ×N」，hover tooltip 给出「已派单 N 次 · 最近：xx前」相对时间。
- 「显示全部 / 仅未发布」过滤开关默认 OFF（显示全部）。用户主动切到「仅未发布」时按 `publish_count === 0` 收窄。

废止的 v0.16 localStorage key（`aep:distribute:published-output-ids`）已彻底删除，前端不再读写。

**路由收口**

- `/mixcut/publish` → `redirect("/distribution?tab=workbench")`（保留作为旧链兼容）
- `app/(workspace)/layout.tsx` 移除 mixcut 二级菜单的「发布工作台」+ 面包屑映射
- `apps/web-celebrity/src/components/distribution/DistributeWorkbench.tsx` —— 工作台真源
- `apps/web-celebrity/src/components/distribution/DistributionPage.tsx` —— IA 容器

### 5.13 v0.17 社交账号 profile 增强

账号绑定成功后，分发中心不再只显示用户自填别名。`SocialAccount` 增加 `platformAccountId`，并继续使用已有 `displayName` / `avatarUrl`：

- 账号管理列表：显示平台、昵称、平台账号号（如「抖音号 1794189054」）、头像、状态和上次验证时间。
- 项目分发 / 手动分发 select：选项用「昵称（平台账号号 xxx）」增强辨识度。
- 混剪批量发布抽屉：账号卡片显示平台、昵称、平台账号号和状态。

字段为空时保持可用，不阻断绑定 / 发布；平台差异由 sau-service 各平台 driver 处理，前端只消费统一 `SocialAccount` DTO。

### 5.14 v0.20 定时策略升级（每日铺开 + 随机抖动）

v0.15 的「定时发布」checkbox 只能一次性 —— N×M 派单同一时刻起飞。v0.20 引入完整 cadence 策略，让 N 条 mixcut 变体按节奏铺到未来若干天。

**API 契约（破坏性，无线上外部消费方）**：

`MixcutPublishBatchRequest` 顶层增 `schedule: ScheduleSpec`（必填，默认 `{strategy:"immediate"}`）；`TargetItem` 删掉 `scheduled_at` 字段（时间不再 per-account）。

```ts
type ScheduleSpec =
  | { strategy: "immediate" }
  | { strategy: "single"; at: string /* ISO 8601 */ }
  | {
      strategy: "daily_recurring";
      start_date: string;       // "YYYY-MM-DD" in timezone
      time_slots: string[];     // HH:MM 24h，后端排序去重
      timezone: string;         // IANA, default = 浏览器时区
      max_days?: number;        // 缺省 = 直到 outputs 用完
      jitter_minutes?: number;  // 0..30；缺省 / 0 = 无抖动
    };
```

Java 端：`ScheduleSpec` 是 `sealed interface`，Jackson `@JsonTypeInfo` discriminator `strategy`，三个 record（`Immediate / Single / DailyRecurring`）。

**铺开算法**（`MixcutPublishService.expandSchedule`）：

`outputs[i]` 在 `timeSlots[i % K]` 时段、`startDate + ⌊i/K⌋` 天起飞（K=时段数）。可选 `jitter_minutes` 给每条 slot 加 [-N, +N] 分钟随机偏移。过去 slot clamp 到 `now()`（调度器下一个 10s tick 即起飞）。`PublishJobScheduler` / `PublishJob` 实体零改动。

**校验（DB 写入前一次性返回 400）**：

- `time_slots` 非空、每条匹配 `^([01]\d|2[0-3]):[0-5]\d$`、排序去重。
- `timezone` 用 `ZoneId.of(...)` 解析。
- `start_date` 用 `LocalDate.parse(...)`（过去日期允许）。
- `jitter_minutes` 在 `[0, 30]`。
- `max_days != null && outputs.size > max_days * K` → `OUTPUTS_EXCEED_CAPACITY`。

**前端 UI**（`BatchPublishDrawer.tsx#ScheduleEditor`）：

- 三选一 pill：立即发布 / 单次定时 / 每日铺开。
- `single`：保留 `datetime-local`（v0.15 体验）。
- `daily_recurring`：起始日期 + 时段池（4 套预设 chip + 自定义 HH:MM 编辑） + 容量模式（直到视频用完 / 持续 N 天）+ 可选随机抖动。
- 自动建议 `maxDays = ⌈N / K⌉`（cap 30），用户手改后停止 auto-suggest（`maxDaysDirtyRef`）。
- 实时预览：`共 X 条 · 跨 Y 天 · 首条 今 09:00 · 末条 5月23日 18:00 · ±15 分钟抖动`。
- 容量超限：红字阻拦提交 + 明确数学解释。

**projectId 防撞**：调用方未指定时拼 `mixcut-batch-<source>-<yyyyMMddHHmmss>`，避免同源混剪任务多次铺开撞同一 project_id（影响 `/distribution?tab=tracking` 的 campaign 视角）。

**显式 out-of-scope**：campaign 级别取消（单条 cancel 仍可用）、ShedLock 多实例调度、跨账号错峰、interval / random_window / weekly 等策略（`strategy` discriminator 预留扩展位）。

### 5.15 v0.24 商品库联动（showcase MVP）

把已有 **商品库**（`Product` 实体 + admin CRUD + 既有 `ProductsApi`）接到混剪创建页与分发流程，免去重复敲商品资料的工作。**纯前端拼装，零后端 / openapi / schema 改动**；定位为展示性的最小可用版本，先把工作流跑通。

**新增 / 修改**：

```
web-celebrity:
  app/(workspace)/mixcut/create/[id]/create-client.tsx
    +关联商品 Card（扰动贴图池上方）
    +linkedProduct / productPickerOpen state；提交时不读，纯展示
    +挂载 <ProductPickerDialog />（复用既有组件）
  components/mixcut-zone/BatchPublishDrawer.tsx
    抖音商品挂载 section 加「从商品库选择」按钮
    onPick → setProductLink(p.link ?? "") + setProductTitle(p.name.slice(0,50))
  components/distribution/ManualDistributeDialog.tsx
    抖音商品挂载 section 加「从商品库选择」按钮
    同上 onPick 行为
```

**用户旅程**：

1. **混剪创建页**：进入 `/mixcut/create/{templateId}` → 主区中段看到「关联商品」Card → 点「从商品库选择」→ Picker 弹窗（搜索 + 类目过滤 + 商品卡 grid，全部来自 [`ProductsApi.listProducts`](../../apps/web-celebrity/src/api/products.ts)）→ 选中后 Card 切换为商品详情视图（缩略图 / 名 / 类目 badge / 卖点 / 「查看商品页」外链 / 「更换」「清除」按钮）。
2. **批量发布抽屉**：勾抖音账号 → 抖音商品挂载 section 出现 → 「从商品库选择」一键填入 `商品链接` / `商品名`；商品无链接时给 amber 提示「该商品未填链接，挂件不会触发」。
3. **上传链接分发**：行为镜像 BatchPublishDrawer，douyin 平台选账号后浮现商品挂载 section 与「从商品库选择」按钮。

**显式边界**（当前 MVP）：

- 混剪侧的关联商品**不绑定到 RenderJob**：state 仅前端生命周期，提交后丢弃。任务详情、分发抽屉都不知道这个商品。
- 混剪侧**不自动填充任何 slot**：商品资料仅作为视觉参考，标题 / 描述等素材槽仍由用户手工敲。
- 分发侧虽然把 `productLink` / `productTitle` 自动填入两个 input，但用户可继续手改；提交逻辑沿用 v0.22 既有路径，sau-service 仍只挂抖音。

**未来改进**（按从小到大列）：

1. **picker 增强**：按「最近使用」/ 引用次数热度排序；支持多商品挂件（抖音允许多链接挂件）。
2. **分发成功自动累计**：派单成功时调 [`ProductsApi.upsertFromGeneration`](../../apps/web-celebrity/src/api/products.ts) 让 `Product.usageCount` 真累计起来，picker 排序更有意义。
3. **自动填充素材槽**：按 slot label 关键词（"标题/品名" → `product.name`、"卖点/描述" → `sellingPoints`、"链接" → `link`），或在 slot 层加显式「绑定到商品字段」下拉。
4. **任务侧落库**：[`MixcutRenderJob.java`](../../apps/server/src/main/java/com/aistareco/aep/model/MixcutRenderJob.java) 加 `productId` 列 + DTO + openapi schema 同步；分发抽屉打开时读 `job.product_id` 自动预选，省一步操作。
5. **跨子应用复用**：若 drama / music 也接带货分发，把 [`ProductPickerDialog`](../../apps/web-celebrity/src/components/celebrity-zone/ProductPickerDialog.tsx) 上提到 `packages/ui`。

### 5.11 已知限制

| 限制 | 影响 | v0.16+ 计划 |
|---|---|---|
| `drawtext` filter 不可用 | 当前用 drawbox 色条替代文字水印 | brew 装 `ffmpeg --with-freetype` 或换 build；加中文字体 |
| `AliyunOssCdnUploader` stub | 生产 CDN 切换需实现 | 接入 aliyun-oss-sdk + bucket public-read 配置（v0.16 候选） |
| `@Scheduled` 单实例约束 | 多实例部署会重复触发定时发布 | ShedLock 加分布式锁（v0.16 候选） |
| 视频无自动缩略图 | 列表里 video tile 用 `<video preload="metadata">` hover-play 兜底 | ffmpeg 抽帧首帧 → static 服务（已在 cdn 路径上传） |
| 单线程并发 = 2 | 高并发场景排队 | 升 Redis queue + 多 worker |
| watermark 仅 metadata token | 没真在像素里嵌水印 | 像素水印 + SHA-256 文件哈希 |
| 无分片上传 / 断点续传 | 大文件失败要从头来 | tus.io / 分片协议 |
| GIF 二值 alpha | 半透明 = 整体调薄，不是边缘羽化 | 升级到 .mov ProRes4444 / .webm vp9-alpha |
| 模板编辑页未集成扰动贴图池 | 仅 create 页可配置（写到 `_global`） | 模板 slot 级 picker（已留 `perturbation_sticker_pool` 字段） |
| Admin 预置贴图管理 UI 缺失 | 仅 DataInitializer 自动生成 / classpath 文件入库 | `apps/admin` 新页 + `/api/admin/mixcut/preset-stickers` CRUD（v0.16 候选） |

---

## 6. UI 模式约定

- **数值字段存原始整数**，格式化用 `@ai-star-eco/api-client/format`
- **空状态 / 加载态**：用 `src/components/celebrity-zone/` 内的统一组件（CelebrityEmptyState 等）
- **状态机 Badge**：CelebrityAuthBanner / CelebrityPricingTierCard 等用统一 tone 系统（`brand` / `success` / `warning` / `danger` / `muted`）
- **`"use client"`**：apps/web 时代约定，celebrity-zone 33 个组件都保留；新加客户端组件继续加
- **CSS 变量优先**：跨主题敏感的颜色用 `var(--accent)` 而非 hard-coded hex

---

## 7. Mock / 真后端策略

**全局**：`NEXT_PUBLIC_USE_MOCK`（`.env` 当前 `=0`，全 app 走真后端）。

**模块级覆盖**：

- **celebrity-zone** — `src/api/celebrity-zone.ts` 13 个函数都有 `if (USE_MOCK)` 分支，mock 走 `src/mocks/celebrity-zone.ts`
- **products** — `src/api/products.ts` USE_MOCK 模式走 localStorage write-through（key: `aistareco.web.products.v1`）
- **mixcut** — `src/api/mixcut.ts` 走 `NEXT_PUBLIC_MIXCUT_USE_REAL=1` 独立开关，USE_MOCK 时也可强制真后端

**默认视图渲染**：组件直接 `import { DATA } from "@/mocks/xxx"`；用户动作走 `api/*`。

---

## 8. 关键约束 & 注意事项

### 8.1 与共享层

- types 必须来自 `@ai-star-eco/types/celebrity-zone`（packages/types）
- celebrity-zone 业务组件可以 import packages/ui 的 shadcn 原语
- **mixcut-zone 是独立子树**：UI 原语独立一份（避免与 celebrity-zone 共用 packages/ui 时 Tailwind v3/v4 编译差异）

### 8.2 与 server

- API 路径 `/api/celebrity/*` 已在 [`specs/openapi.yaml`](../../specs/openapi.yaml)
- mixcut 路径 `/api/mixcut/*` v0.8 新增，**snake_case wire 例外**，记入 [`specs/README.md`](../../specs/README.md)
- 任何新端点必须先改 openapi.yaml 再写 controller（CI 守门）

### 8.3 与小程序

celebrity 工作台是「制作方」视角；小程序 [`apps/miniprogram`](../miniprogram) 是「消费方」用户端（带货）。两者共享 server 的 `/api/celebrity/*` 端点，但消费侧用 `/api/me/*`（如 `/me/messages-overview`、`/me/wallet/recharge`），数据视图不同。

### 8.4 已知待办

- Cookie SSO 跨子域
- mixcut OSS 化（v0.9）
- engine-pricing / JOBS 落表持久化
- 真实视频生成引擎接入（当前 mixcut 用 ffmpeg 真做但素材是固定 demo；celebrity-zone 的 `/star/<id>/generate` 仍是 mock）

---

## 8.5 商品主线（v0.28+）

celebrity 子产品按「商品」为主线把「商品库 / 素材库 / 混剪 / 分发」连成一条流：

```
            ┌──────────────── Product ────────────────┐
            │ id / name / link / priceCents / commission│
            │ images[] (snapshot) / sellingPoints       │
            └────────────────┬──────────────────────────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
        MixcutAsset       MixcutRenderJob   PublishJob
        relatedProductId  productId         (无冗余列)
        subkind=          (来自 ?product_id  反查
        product-photo     URL 参数)         sourceJob.productId
```

**录入入口**：

- **商品库顶部「📋 从抖音链接快速建档」** → 弹粘贴框 → 调 `POST /api/me/products/from-link` → 解析 + 落 Product + 把图片登记为 MixcutAsset(subkind=product-photo)
- **快速录入 / 编辑弹窗里「📋 从抖音链接解析」** → 调 `POST /api/me/products/parse-link` → **仅覆盖空字段**（用户已填的不动）
- **批量录入「粘贴 Excel」** tab → 识别抖音选品库 TSV 表头：`商品ID / 商品名称 / 商品链接 / 商品价格 / 佣金`

**URL 解析（server 策略链）**：

| handler | @Order | 触发 | 实现 |
|---|---|---|---|
| DouyinQueryEmbeddedHandler | 10 | URL query 含 `goods_detail` | URLDecode → JSON parse → 抽 title/img.url_list/min_price/max_price/sales |
| DouyinHtmlScrapeHandler | 20 | host 命中 `*.jinritemai.com\|*.douyin.com` 白名单 | HttpClient GET（UA=desktop Chrome, timeout=8s）→ 正则抓 og:image/og:title + window.__INITIAL_STATE__ |

**生成视频入口**：

- 商品库行 / 卡片「生成视频」按钮 → `<ProductGenerateDialog>` 选模板 → `router.push(/mixcut/create/{tplId}?product_id=X)`
- create-client.tsx 自动：
  - 并发 fetch product + `MixcutApi.listAssets({ relatedProductId: X })`
  - `applyProductHeuristics(prev, template, product, assets)` 按 slot_id/label/fill_strategy 自动绑：
    - layer_type=image 命中 `product|商品|图|cover|poster|main|hero` → 用 product 关联 MixcutAsset.id（fallback `product.images[0]`）
    - fill_strategy=picgen_text → picgen { title=name, subtitle=sellingPoints[:30], tag=category }
    - layer_type=text + user_input 命中 `title|标题|name` → input { text: name }
    - 命中 `point|卖点|desc|描述|subtitle` → input { text: sellingPoints || name }
  - 只覆盖未绑 / 绑 fixed 的 slot；用户改过的不动
  - 顶部 chip「已从商品库带入：xxx · 价格 · 佣金 · 关联素材 N 张 · 清除」
- 提交 RenderJob 时透传 `product_id` 到 MixcutRenderJob.productId

**分发自动 prefill**：

BatchPublishDrawer 打开时若 `sourceJob.productId` 非空，反查 Product → 用 `product.link / product.name` 自动填 productLink/productTitle，UI 显示「📌 已从商品库带入」chip。用户仍可手动覆盖；非抖音平台 sau-service 静默忽略两字段。

**未实现 / 显式 out-of-scope**：

- AI 生成带货视频（MixcutAsset.subkind 预留 `"ai-marketing-video"` 占位，无实现）
- 抖音以外平台（淘宝 / 京东 / 拼多多）的解析 handler
- 商品图本地化备份（外网 CDN URL 直接登记，未来「同步备份」按钮可补）
- PublishJob.productId 冗余列（按 sourceMixcutJobId 反查即可）

---

## 9. 索引

| 文件 | 用途 |
|---|---|
| [`README.md`](README.md) | 启动 / 技术栈 / 版本日志（v0.5 → v0.8） |
| [`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) | sidebar + topbar shell + 鉴权 wall |
| [`src/styles/tokens.css`](src/styles/tokens.css) | Creator 主题设计令牌 |
| [`src/styles/app.css`](src/styles/app.css) | Tailwind v4 `@theme` 调色板映射 + mixcut 兼容 utility |
| [`src/api/celebrity-zone.ts`](src/api/celebrity-zone.ts) | 13 个 celebrity domain API |
| [`src/api/products.ts`](src/api/products.ts) | 商品库（localStorage write-through） |
| [`src/api/mixcut.ts`](src/api/mixcut.ts) | 混剪 API（独立开关 NEXT_PUBLIC_MIXCUT_USE_REAL） |
| [`src/components/celebrity-zone/`](src/components/celebrity-zone/) | 33 个业务组件 |
| [`src/components/mixcut-zone/`](src/components/mixcut-zone/) | 混剪专区组件（含 12 个 UI 原语） |
| [`src/proxy.ts`](src/proxy.ts) | 旧 `/console` 链接兼容 |
| [`next.config.mjs`](next.config.mjs) | API + /static rewrites |
| [`../../product_spec_ai_celebrity.md`](../../product_spec_ai_celebrity.md) | 业务规格（AI 明星带货主线） |
| [`../../specs/openapi.yaml`](../../specs/openapi.yaml) | 后端 API 契约 |
| [`../../AGENTS.md`](../../AGENTS.md) | 跨 app agent 指引 |
