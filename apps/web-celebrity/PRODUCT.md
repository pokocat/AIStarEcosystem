# AI 明星带货 · 产品 & 设计约束

> 子产品：**AI Celebrity Studio** — 基于真人明星授权的 AI 复刻 IP 带货平台。
> 本文件是产品形态 + 设计约束的真值源。技术 onboarding 在 [`README.md`](README.md)，业务规格在仓库根 [`product_spec_ai_celebrity.md`](../../product_spec_ai_celebrity.md)（AI 明星带货主线，v0.5.x）。

**Last reviewed**: 2026-05-17

---

## 1. 产品定位

**目标用户**：MCN 制作人、明星经纪人、电商带货团队。

**价值主张**：从「明星授权获取」到「AI 复刻视频量产」到「全网带货分发」的链路工作台。

**核心链路**：

```
浏览明星市场（market）  →  申请授权（apply）  →  AI 生成带货视频（generate / mixcut）  →  项目管理（projects）  →  视频中心（library）  →  数据中心（data）
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
| `mixcut` | `RenderJob`、`RenderOutput`、`Template`、`SlotBinding`、`StarClip`、`ProductClip`、`Asset` | 混剪专区：模板渲染任务 |
| `wallet` | `Wallet`、`LedgerEntry` | 积分钱包（topbar 显示） |
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
| `/market` | 工作台 | 明星市场（浏览所有可申请明星） |
| `/cast` | 工作台 | 我的明星（已授权明星墙） |
| `/star/[starId]` | 详情 | 明星详情（含授权状态、可申请档位、过往项目） |
| `/star/[starId]/apply` | 详情 | 授权申请表单（定价档位选择） |
| `/star/[starId]/generate` | 详情 | 生成工作流（模板 / 盲盒选择 → AI 生成视频） |
| `/projects` | 制作 | 我的项目（多项目管理） |
| `/projects/[projectId]` | 制作 | 项目详情（视频管理 / 状态推进） |
| `/products` | 制作 | 商品库（CRUD + 卖点抽取） |
| `/library` | 制作 | 视频中心（跨项目聚合产出） |
| `/data` | 洞察 | 数据中心（分发占比 / 转化率） |

### 3.2 混剪专区（v0.7 内嵌 + v0.8 真后端）

| 路径 | 模块 | 功能 |
|---|---|---|
| `/mixcut` | 制作 | 混剪首页（KPI + 热门模板 + 最近任务） |
| `/mixcut/templates` | 制作 | 模板库（筛选 / 搜索） |
| `/mixcut/templates/[id]` | 制作 | 模板详情（slot schema + 扰动变体预览） |
| `/mixcut/create/[id]` | 制作 | 新建渲染任务（slot 填充 + perturbation profile + 变体数） |
| `/mixcut/jobs` | 制作 | 渲染任务列表 |
| `/mixcut/jobs/[id]` | 制作 | 任务详情（进度 + 产出 + 槽位绑定 + 扰动详情 + 水印追溯） |
| `/mixcut/library` | 制作 | 素材库（明星 / 商品 / 贴图 / BGM 四 tab） |

**Sidebar 分组**（[`src/app/(workspace)/layout.tsx`](src/app/(workspace)/layout.tsx) 第 37-63 行）：

1. **工作台** — `/dashboard` / `/market` / `/cast`
2. **制作** — `/projects` / `/library` / `/products` / `/mixcut`
3. **洞察** — `/data`

详情页 `/star/<id>`、`/projects/<id>`、`/mixcut/*` 子路由不挂在 sidebar 父级（设计选择 —— 避免与 list 父级竞争高亮）。

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
6. 提交 → 后端 ffmpeg 真渲染 → 跳到 `/mixcut/jobs/<jobId>`
7. 实时进度推进（轮询 GET /api/mixcut/jobs/<id>）
8. 完成后看产出网格（N 个 mp4 变体），每个有不同的 phash / 应用扰动算子
9. 下载单个 / 全部（ZIP）/ 重渲

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

### 5.7 已知限制

| 限制 | 影响 | v0.9+ 计划 |
|---|---|---|
| `drawtext` filter 不可用 | 当前用 drawbox 色条替代文字水印 | brew 装 `ffmpeg --with-freetype` 或换 build；加中文字体 |
| 仅本地 fs 存储 | 部署到生产需要本地磁盘 | OSS（Aliyun）集成 |
| `/api/mixcut/**` permitAll | MVP 安全模型；任何人能 POST | 改 `.authenticated()` + `ownerUserId` 校验 |
| 素材源回退 demo | 前端 mock 的 `asset_id` 后端不查库，使用本地 showreel | 真接素材库 + OSS 上传 |
| 单线程并发 = 2 | 高并发场景排队 | 升 Redis queue + 多 worker |
| watermark 仅 metadata token | 没真在像素里嵌水印 | 像素水印 + SHA-256 文件哈希 |

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
