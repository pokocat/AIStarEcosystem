# AGENTS.md

> 给所有 AI coding agent（Claude Code、Cursor、Aider、Continue、自建 SDK agent…）的统一指引。
> Claude Code 仍然通过 `CLAUDE.md` 注入，但 `CLAUDE.md` 是本文件的 symlink —— 只需维护一份。

**Single sources of truth**

| 维度 | 真值文件 | 备注 |
|---|---|---|
| 项目结构 / 工作流 | 本文件（**AGENTS.md**） | 给 agent 看的执行约束 |
| 数字人/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) | v2.7（2026-05-06） |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) | v0.5.x 滚动 |
| 后端 API 契约 | [`specs/openapi.yaml`](specs/openapi.yaml) + [`specs/BUSINESS_RULES.md`](specs/BUSINESS_RULES.md) | CI 守门 |
| 子应用产品 / 设计约束 | `apps/<sub-app>/PRODUCT.md` | music / drama / celebrity 各一份 |
| 子应用技术 onboarding | `apps/<sub-app>/README.md` | 启动 / 技术栈 / 版本日志 |
| 完整文档地图 | [`docs/INDEX.md`](docs/INDEX.md) | "我想找 X 在哪" |

**核心信息（避免新 agent 反复翻仓）**：

- 后端 server: Spring Boot 3.3.5 + Java 17，port **8080**，H2 (dev) / MySQL (prod)
- 三个新 web app: **web-music**（3010）/ **web-drama**（3011）/ **web-celebrity**（3012）
- 遗留 web app: **apps/web**（3002，即将删除）/ **apps/admin**（3003，独立升级中）
- 小程序: **apps/miniprogram**（微信小程序，AI 明星带货线消费方）

---

## 1. 仓库形态 & 进度

### 当前结构

```
Aisingerecosystem/
├── apps/
│   ├── server/             # 后端：Spring Boot 3.3.5 (Java 17) — port 8080
│   ├── web/                # 遗留用户前端：Next.js 14 — port 3002（Phase 5 将删）
│   ├── admin/              # 管理后台：Next.js 14 — port 3003（独立升级中）
│   ├── miniprogram/        # AI 明星带货 · 微信小程序
│   ├── web-music/          # AI 音乐人（Next 16 / React 19 / Tailwind v4）— port 3010
│   ├── web-drama/          # AI 短剧（同上）— port 3011
│   └── web-celebrity/      # AI 明星带货（同上）— port 3012
├── packages/               # pnpm workspace 共享包（新代码真源）
│   ├── types/              # @ai-star-eco/types（22 域类型定义）
│   ├── ui/                 # @ai-star-eco/ui（48 shadcn + ThemeProvider + globals.css）
│   ├── api-client/         # @ai-star-eco/api-client（apiFetch + AuthProvider + format）
│   └── landing/            # @ai-star-eco/landing（ProductLanding 原语）
├── specs/                  # 后端契约（openapi + 业务规则）
├── docs/                   # 跨应用文档（INDEX 索引 + ADMIN_PRODUCT_SPEC 等）
├── figma/                  # ⚠️ Figma Make 一次性导出，仅 UI 原型参考
└── .claude/skills/         # AI agent 技能（figma-migrate 等）
```

### Monorepo 拆分进度（Phase 0a → 6）

仓库从「单 apps/web + 单 apps/admin + 单 apps/server」拆为「三个独立 web app + packages/* 共享层 + 共享 server（按子产品分租户）」。

| Phase | 状态 | 描述 |
|---|---|---|
| **0a-b** | ✅ | pnpm workspace 脚手架（根 `package.json` + `pnpm-workspace.yaml` + `.npmrc`） |
| **1** | ✅ | 四个共享包就位（types / ui / api-client / landing）且 typecheck 全绿 |
| **2-4a** | ✅ | 三个新 web app shell + landing 全部 dev HTTP 200 |
| **4b** | ✅ | celebrity-zone 33 组件从 apps/web 迁入 web-celebrity；music / drama / celebrity 三端统一 `(workspace)` route group + 顶层语义化路径 |
| **v0.7** | ✅ | mixcut 内嵌为 web-celebrity 的「混剪专区」子功能（7 页 / 12 个 UI 原语 / Tailwind v4 brand-* 映射） |
| **v0.8** | ✅ | mixcut 真后端落地（Spring Boot @Async + ffmpeg 实拼接 / 实贴图 / 实剪切；不再 mock） |
| **v0.13** | ✅ | 扰动贴图池（preset GIF + DataInitializer 自动 seed + ffmpeg -stream_loop -1 overlay）+ MixcutController 安全前置（Principal 校验） |
| **v0.14** | ✅ | CdnUploader 抽象 + LocalFakeCdnUploader（./cdn-mock → /cdn）+ MixcutRenderOutput.cdnUrl 列 + 渲染后串行上传 |
| **v0.15** | ✅ | 混剪 → 发布桥接（/api/me/mixcut/publish-batch）+ @Scheduled 定时发布 + 三入口（jobs 详情按钮 / distribution 跳转 / /mixcut/publish 工作台） |
| **v0.17** | ✅ | 社交账号绑定 profile 落库（昵称 / 平台账号号 / 头像），sau-service 各平台 driver 独立提取 |
| **5** | ⏳ | 删除 `apps/web`（待三新 app 验证完整） |
| **6** | ⏳ | server 按子产品分租户（DB migration 级别） |
| **Cookie SSO** | ⏳ | 当前 token 仍 localStorage，不跨子域；改造点见 [`packages/api-client/src/_client.ts`](packages/api-client/src/_client.ts) TODO |
| **apps/admin 升级** | ⏳ | 仍 Next 14，独立于本次拆分 |

### 技术栈分代（**重要**）

| 代次 | 仓 | 栈 |
|---|---|---|
| 新代码 | `packages/*` + `apps/web-{music,drama,celebrity}` | Next **16.2.6** + React **19** + Tailwind **v4** + **pnpm** |
| 遗留 | `apps/web` | Next 14.2 + React 18 + npm（不动） |
| 遗留 | `apps/admin` | Next 14.2 + React 18 + npm（后续升级） |
| 后端 | `apps/server` | Spring Boot 3.3.5 + Java 17 |
| 小程序 | `apps/miniprogram` | 微信小程序原生 |

### Next 16 必知陷阱（新 app 写代码前必读）

- **中间件文件名 `proxy.ts`**（不是 `middleware.ts`，v16 重命名）
- **`cookies()` / `headers()` / `params` / `searchParams` 都是 Promise**，必须 `await`
- 客户端组件读 `params` 用 `use(params)` (React 19) 或拆 server outer + client inner
- 新 app 不属 workspace 时不要混 npm/pnpm；`pnpm-workspace.yaml` 仅纳入 `packages/*` + 三个新 web app

### Auth 多域规划

同根域名 + 三子域名（music.aistar.com / drama.aistar.com / celebrity.aistar.com）+ cookie sharing（domain=.aistar.com）。当前 dev/local 走子端口而非子域名。

---

## 2. Daily Commands

### 后端 Spring Boot

```bash
cd apps/server
./mvnw spring-boot:run                                    # dev profile，H2 in-memory，seeds on boot
./mvnw spring-boot:run -Dspring.profiles.active=mysql     # MySQL profile
./mvnw compile -q -o                                      # 离线编译检查（快）
./mvnw test                                               # JUnit
./mvnw -Dtest=ClassName#method test                       # 单测
```

### 三个新 web app（pnpm workspace，根目录运行）

```bash
pnpm install                                  # 装所有 workspace 依赖
pnpm dev:music                                # web-music — http://localhost:3010
pnpm dev:drama                                # web-drama — http://localhost:3011
pnpm dev:celebrity                            # web-celebrity — http://localhost:3012

pnpm typecheck:all                            # 七个 workspace 一次性 typecheck
pnpm --filter @ai-star-eco/web-celebrity typecheck    # 单个 app typecheck
pnpm --filter @ai-star-eco/web-celebrity build        # 单个 app 生产构建
```

### 遗留 apps/web 与 apps/admin（独立 npm）

```bash
cd apps/web                # port 3002
npm install
npm run dev
npx tsc --noEmit
npm run build
npm test                   # vitest
npx vitest run path/to/file.test.ts

cd apps/admin              # port 3003
npm install
npm run dev
npm run typecheck
npm run build
```

### 三端编译门（提交前必须全绿）

```bash
(cd apps/web   && npx tsc --noEmit) && \
(cd apps/admin && npx tsc --noEmit) && \
(cd apps/server && ./mvnw compile -q -o) && \
(cd apps/web   && npm run check:api-contract)
```

新 app 额外门：`pnpm typecheck:all`。

---

## 3. 三端架构

### 数据流转

```
┌─────────────┐    rewrite /api/*    ┌──────────────────────────────┐
│  web (3002) │ ──────────────────→ │                              │
│  web-music  │                      │  Spring Boot server :8080   │
│  web-drama  │                      │                              │
│  web-      │                      │  /api/auth/*    permitAll    │
│  celebrity  │                      │  /api/me/*      authenticated │
└─────────────┘                      │  /api/celebrity/*            │
                                     │  /api/mixcut/*  (v0.8 新增)  │
┌─────────────┐    rewrite /api/*    │  /api/admin/*   SUPER_ADMIN  │
│ admin (3003)│ ──────────────────→ │                  / OPERATOR  │
└─────────────┘                      │                              │
                                     │                              │
┌─────────────┐  wx.request /api/*   │                              │
│ miniprogram │ ──────────────────→ │                              │
│ (微信小程序)  │                      │                              │
└─────────────┘                      └──────────────────────────────┘
```

- 前端通过 `next.config.mjs` 的 `rewrites` 把 `/api/*` 转发到 8080
- 静态文件（如 mixcut 渲染产出 `/static/mixcut/*`）也由 server 暴露 + 前端 rewrite
- 认证：Spring Security + JWT（JJWT 0.12.6），无状态 session
- 小程序通过 `wx.request` 直接调 `apiBaseUrl + /api/*`

### Mock vs Live 切换

所有前端走 `.env.local` 的 `NEXT_PUBLIC_USE_MOCK`：

- `=1` → `api/*.ts` 顶部 `if (USE_MOCK)` 分支命中，使用 `mocks/*.ts` 静态数据，无网络
- `=0` → 走 `apiFetch` → Next rewrites → server

**陷阱**：组件做默认视图渲染时应**直接 `import { DATA } from "@/mocks/xxx"`**，不要走 `api/*`；后者在 USE_MOCK=0 但 server 没起时会 404。

**个别模块独立开关**：v0.8 mixcut 加了 `NEXT_PUBLIC_MIXCUT_USE_REAL=1`，可在 USE_MOCK=1 时仅让 mixcut 走真后端，不影响其他模块。

---

## 4. 硬规则（违反会 break）

### 4.1 类型真值源

- **前端 TS 是契约真源**：`apps/web/src/types/*`（遗留）/ `packages/types/src/*`（新代码）
- Spring `*Dto.java` record 字段名**必须与 TS interface 完全一致**
- JPA entity 字段名可以不同，由 DTO `from()` 方法做映射
- enum 出 wire 时**全小写**：Java `ACTIVE` → JSON `"active"`；含连字符用 `wire` 字段
- admin types 与 web types **保持一致**（直接复制）；admin 独有字段用 `interface AdminXxx extends Xxx`

### 4.2 积分账本不可变

所有钱包余额变动**必须经 `LedgerEntry`**（不可变账本）：

- **禁止**直接 `UPDATE wallet SET balance = ...`
- `total_balance = license + recharge + gift`（`pending` 桶不计入）
- 实现见 [`apps/server/src/.../aep/service/CreditService.java`](apps/server/src/main/java/com/aistareco/aep/service/CreditService.java)

### 4.3 API 响应壳

```
单资源       → { success: true, data: T, message?: string }     # ApiResponse<T>
分页列表      → { success: true, data: T[], pagination: {...} } # PageEnvelope<T>（不嵌套 ApiResponse）
```

`apiFetch` 自动解包 `data`；调用方拿到 `T` / `T[]`。失败 `{ success: false, error: { code, message } }`。

### 4.4 安全模型

```
/api/auth/**               → permitAll（注册 / 激活）
/api/admin/auth/login      → permitAll（管理员登录）
/api/me/**                 → authenticated（JWT；controller 必须校验 ownerUserId == principal.id）
/api/admin/**              → hasAnyRole("SUPER_ADMIN", "OPERATOR")
/api/internal/**           → hasRole("INTERNAL")（X-Internal-Secret 校验）
其他                        → permitAll
```

Dev 种子账号（[`DataInitializer.java`](apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java)）：

- `admin / admin123` — SUPER_ADMIN
- `operator / operator123` — OPERATOR

> 角色拆分计划（v0.6+）：拆分为 `PLATFORM_OPERATOR` / `FINANCE_ADMIN`。到时同步 4 个位置：`AdminUser.AdminRole` enum + `AepSecurityConfig.hasAnyRole` + `DataInitializer` seed + `apps/admin/src/types/account.ts`。

### 4.5 数值字段

存原始整数，格式化在展示层（`apps/web/src/lib/format.ts` / `packages/api-client/src/format.ts`）：

```
fans: 128_000          → formatCompactNumber → "128K"
revenue: 452_000       → formatCredits        → "452,000"
priceCents: 9_900      → formatCurrency       → "¥99.00"
duration: 7820         → formatDuration       → "2h 10min"
```

**禁止**类型定义里用预格式化字符串（如 `fans: "128K"`）。

### 4.6 中文单语

前端文案全部中文。删除 `{ zh: 'X', en: 'Y' }` 字典和 `lang === 'zh' ? ... : ...` 三元。Legacy `src/translations.ts` 已 tombstoned。

---

## 5. 新增领域 SOP

新增领域 `<domain>` 必须按以下顺序操作（前端真源先定，后端再 mirror，契约文档最后同步）：

### Step 1 — 前端真源

```
[新代码]
packages/types/src/<domain>.ts        ← 类型定义（唯一事实源）

[遗留 apps/web]
apps/web/src/types/<domain>.ts
apps/web/src/mocks/<domain>.ts        ← USE_MOCK=1 时的样本
apps/web/src/constants/<domain>-ui.ts ← UI 配置（图标 / 颜色 / 文案）
```

### Step 2 — 前端调用层

```
apps/web/src/api/<domain>.ts          ← apiFetch + USE_MOCK 开关
apps/web/src/api/index.ts             ← 追加 `export * as XxxApi`
```

### Step 3 — 后端 mirror（字段名必须 1:1 匹配 TS）

```
apps/server/.../aep/model/<Entity>.java               ← JPA 实体
apps/server/.../aep/dto/<Entity>Dto.java              ← DTO record，字段名 = TS
apps/server/.../aep/repository/<Entity>Repository.java
apps/server/.../aep/controller/<Domain>Controller.java
```

### Step 4 — admin 镜像（URL 前缀 `/admin/`）

```
apps/admin/src/types/<domain>.ts      ← 与 web 同名同字段（直接复制）
apps/admin/src/mocks/<domain>.ts
apps/admin/src/api/<domain>.ts        ← URL: /admin/...
apps/admin/src/api/index.ts
```

### Step 5 — 契约文档（CI 强制）

```
specs/openapi.yaml                    ← components.schemas 加 schema；paths 加 path
specs/BUSINESS_RULES.md               ← 可选：openapi 表达不了的约束（扣费、状态机、跨字段）
```

> v2.7 起取消"契约 diff 文档"。drift 由 [`apps/web/scripts/check-api-contract.mjs`](apps/web/scripts/check-api-contract.mjs) 守门 —— 任一 `apiFetch(...)` URL 在 openapi.yaml 找不到对应 path → gate fail。

### Step 6 — 四门验证

```bash
(cd apps/web   && npx tsc --noEmit)
(cd apps/admin && npx tsc --noEmit)
(cd apps/server && ./mvnw compile -q -o)
(cd apps/web   && npm run check:api-contract)
```

> 对于 Figma 原型变更（新页面 / 新组件），调 [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) 技能。它把上述六步包成 web → admin → server 同步 SOP。

---

## 6. 三个新 web app 子产品

每个子产品独立 brand / 路由 / 业务领域，但共享 server + 共享 packages 层。

| 子产品 | 路径 | Port | 产品规格 | 设计约束 | 主入口 |
|---|---|---|---|---|---|
| **AI 音乐人** | `apps/web-music/` | 3010 | [`apps/web-music/PRODUCT.md`](apps/web-music/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 短剧** | `apps/web-drama/` | 3011 | [`apps/web-drama/PRODUCT.md`](apps/web-drama/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 明星带货** | `apps/web-celebrity/` | 3012 | [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |

三个 app 路由形态一致：

```
/                          ← 公开 landing（ProductLanding，postLoginPath="/dashboard"）
/login                     ← 公开
/activate                  ← 公开
/dashboard …               ← 工作台（route group `(workspace)`，不出现在 URL）
```

详见各 PRODUCT.md。

---

## 7. v0.5 → v0.16 增量

> 连续多版本：明星带货线 + 混剪专区。新人 agent 不必翻 commit history，本节列出新实体 / 路由 / 决策。

### v0.5（2026-05-08 ~ 05-09）— AI 明星带货线落地

**新增 server 实体**（详见 [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md)）：

| 实体 | 用途 |
|---|---|
| `CelebrityStarAuthorization` | 用户×明星授权关系（unique(user_id, star_id) + 4 态状态机） |
| `RechargePackage` | 充值套餐（admin CRUD，软删 active=false） |
| `TemplateScript` | 模板脚本（双模 text/video_ref + 6 类 ChatMessage 块；JSON 列） |
| `AiModelProvider` | 大模型 provider（OpenAI 兼容；apiKey 用 AES-GCM 加密） |
| `UserBotReadState` | per-user-per-bot lastReadAt（驱动 Bot 红点） |

**新增 server 端点**（节选；详见 [`specs/openapi.yaml`](specs/openapi.yaml)）：

```
GET  /me/messages-overview                        # 待办 + Bot 会话预览（按需合成）
GET  /celebrity/dictionaries                      # UI 字典
GET  /celebrity/jobs/{jobId}                      # 视频生成异步任务进度
POST /me/wallet/recharge                          # 充值落账（走 LedgerEntry）
POST/PUT/DELETE /admin/celebrity/stars[/{id}]
POST/PUT/DELETE /admin/celebrity/templates[/{id}]
POST /admin/template-scripts/{id}/{submit-review|publish|rollback|dry-run|draft-with-ai|upload-clip}
GET/POST/PUT/DELETE /admin/ai-models[/{id}]
```

**关键决策**：

- **Bot 消息走拉模式**：5 个 composer 按需查询业务态合成 `BotConversationDto`；零事件总线
- **小程序近实时同步**：app-level 15s 兜底轮询 + chat 页 5s 子轮询 + 关键点立即触发
- **AES-GCM 加密**：`AepCryptoUtil` 读 `AEP_SECRET_KEY` 环境变量；**生产必须配**，否则 admin 改 apiKey 后重启无法解密
- **engine-pricing / JOBS 当前 in-memory**：admin PUT 立即生效但重启丢失。v0.6 落 `PlatformConfig` / `generation_jobs` 表

### v0.7（2026-05-17）— 混剪专区内嵌 web-celebrity

把独立项目 `/Users/donis/dev/mixcut/frontend`（Next 14 + Tailwind 3 + Zustand + 13 页）裁到核心 7 页，作为 `(workspace)/mixcut/*` 子树挂入 web-celebrity。详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.9（2026-05-17）— 混剪用户素材上传 + 真实素材消费

`apps/server` 新增完整的用户上传素材管线 + 渲染 worker 真消费这些素材。

**新增**：

```
server  : MixcutAsset entity + MixcutAssetRepository（表：mixcut_asset）
        : MixcutAssetService（multipart 上传 + 本地 fs + ffprobe 探时长）
        : MixcutAssetController (/api/mixcut/assets POST/GET/GET[id]/DELETE)
        : MixcutAsyncConfig 加 /static/mixcut-assets/** 资源映射
        : MixcutRenderingService.resolveBindings() — 真实解析 binding.asset_id / file_url
        : MixcutRenderingService.renderOneVariant() — 真叠加用户上传的 image/sticker
        : application.yml 加 spring.servlet.multipart.* + aep.mixcut.asset-dir / asset-public-url-base

web-celebrity:
        : api/mixcut.ts 增 listAssets / uploadAsset / deleteAsset
        : components/mixcut-zone/types.ts 增 MixcutAsset / MixcutAssetKind
        : SlotInput 重写 user_upload + library_select 走真后端
        : /mixcut/library 重写为真后端 CRUD（4 tab + 上传 dialog + 删除 confirm）
```

**注意**：

- 上传 wire 例外：multipart 表单 + snake_case 字段（`user_id` / `kind` / `file` / `name` / `tags`）
- 安全模型仍 permitAll —— 生产化必须 `.authenticated()` + 校验 `ownerUserId == principal.id`
- 详见 [`apps/web-celebrity/PRODUCT.md` §5.7](apps/web-celebrity/PRODUCT.md)

### v0.8（2026-05-17）— 混剪专区真后端（ffmpeg 渲染）

`apps/server` 新增完整 mixcut 渲染管线（不再 mock）。每个任务变体真做三件事：

- **视频拼接** — concat 2 个明星片段
- **图片贴图** — overlay 半透明色卡 + drawbox 装饰条带
- **随机剪切** — 每段 `-ss` 随机 offset；变体间 perturbation 参数（速度/亮度/饱和度/镜像）随机

**新增**：

```
server  : MixcutRenderJob + MixcutRenderOutput 两张表（JPA auto-update）
        : FfmpegRunner + AssetDownloader + MixcutJobService + MixcutRenderingService (@Async)
        : MixcutController (/api/mixcut/jobs[/{id}{/progress}])
        : MixcutAsyncConfig (静态资源 /static/mixcut/** → 外部目录)
        : application.yml 加 aep.mixcut.* 配置

web-celebrity: api/mixcut.ts 加 NEXT_PUBLIC_MIXCUT_USE_REAL=1 独立开关
             : next.config.mjs 加 /static/:path* rewrite
```

**注意事项**：

- ffmpeg CLI 必须在 server 运行环境可用（`brew install ffmpeg`）
- `drawtext` filter 需 libfreetype（brew 默认不带），当前用 drawbox 色条替代
- 输出文件存本地 `mixcut-output/<jobId>/v<N>.mp4`；OSS 集成是 v0.9+
- 生产环境 `/api/mixcut/**` 应改为 `.authenticated()`，当前 MVP 是 permitAll

详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.13（2026-05-19）— 扰动贴图池 + 安全前置

`apps/server` + `apps/web-celebrity` 在 mixcut 链路上加扰动贴图池。每变体按 (jobId+variantIndex) 随机抽样 GIF overlay，叠在已有 image overlay 之上。

**新增 / 修改**：

```
server  : MixcutAsset +isPreset/+presetGroup/+previewUrl 列；MixcutAssetRepository 加 findByIsPreset* 查询
        : MixcutAssetService listVisibleTo / getVisibleTo / deleteOwned (preset 公共可见，user 私有受 principal 校验)
        : MixcutAssetService uploadPreset + registerPresetRow (admin / DataInitializer 路径)
        : MixcutPresetSeeder (@Order(10))：扫 classpath:preset-stickers/*.gif → fs+DB；空池时 ffmpeg lavfi 程序化生成 5 张 demo
        : MixcutRenderJob +stickerPoolJson TEXT 列（结构 Map<slotId, {pool_ids, coverage, opacity, scale_pct, pick_count}>）
        : MixcutRenderingService.buildVariantStickers + renderOneVariant 整合 GIF overlay (-stream_loop -1, format=yuva420p, colorchannelmixer=aa)
        : MixcutController + MixcutAssetController 全部方法接 Principal（v0.13.0 安全前置：之前裸调 service，无 ownerUserId 校验）

web-celebrity: types.ts +StickerPoolBinding，MixcutAsset +is_preset/+preset_group/+preview_url
             : sticker-pool-picker.tsx 新组件（4 group tab，多选 + 时间覆盖/不透明度/大小/抽样数）
             : api/mixcut.ts +listPresetStickers，AssetFilter 加 preset/presetGroup
             : create/[id]/create-client.tsx 加扰动贴图池 Card（写到 sticker_pool["_global"]）
```

### v0.14（2026-05-19）— CDN 上传抽象

新增 CDN 抽象层。dev 用 `LocalFakeCdnUploader`（复制到 `./cdn-mock`，公开为 `/cdn/<key>`），生产换 `AliyunOssCdnUploader`（stub，v0.16 候选）。Render 完每个变体串行上传 mp4 + jpg。

**新增 / 修改**：

```
server  : service/cdn/CdnUploader 接口 + CdnUploadResult record
        : LocalFakeCdnUploader @ConditionalOnProperty(aep.cdn.driver=local 默认)：路径穿越校验 + publicUrlFor
        : AliyunOssCdnUploader stub（v0.16+）
        : config/CdnWebConfig @ConditionalOnBean(LocalFakeCdnUploader)：注册 /cdn/** → ./cdn-mock
        : MixcutRenderOutput +cdnUrl/+cdnKey/+cdnThumbnailUrl/+cdnUploadedAt 列
        : MixcutRenderingService 注入 CdnUploader（required=false），renderOneVariant 末尾 uploadWithRetry
        : markFailed 增 CDN 孤儿清理（按 cdnKey 调 uploader.delete）
        : application.yml 加 aep.cdn.driver/local-root/public-base-url + oss.*
```

### v0.15（2026-05-19）— 混剪 → 发布 桥接 + 定时

`AiStarEcoApplication` 加 `@EnableScheduling`。新调度器 `PublishJobScheduler` 每 60s 扫 `status=QUEUED AND scheduledAt<=now` 自动 startJob。新增 `/api/me/mixcut/publish-batch` 一次性把 N 变体 × M 账号派单。前端三入口 + 定时 UI。

**新增**：

```
server  : @EnableScheduling on AiStarEcoApplication
        : PublishJobScheduler (@Scheduled fixedDelay=60_000, initialDelay=30_000)
        : PublishJobRepository.findByStatusAndScheduledAtLessThanEqual
        : MixcutPublishService.batchPublish (逐 output 独立 try/catch，部分成功)
        : MixcutPublishController POST /api/me/mixcut/publish-batch
        : DTO MixcutPublishBatchRequest / MixcutPublishBatchResultDto
        : 复用现有 QUEUED 状态（不新增 SCHEDULED）

web-celebrity: api/mixcut.ts +publishBatch
             : mixcut-zone/BatchPublishDrawer.tsx（变体多选 + 账号多选 + 文案 + datetime-local 定时）
             : mixcut/jobs/[id] 加「批量发布」按钮 → 开 drawer
             : /mixcut/publish 新页：跨任务挑选所有 cdn 变体 → 同一 drawer
             : distribution 顶部加「从混剪库选视频发布 →」入口 → /mixcut/publish
             : datetime-local 提交时 new Date(local).toISOString() 显式转 UTC
```

**注意事项**：

- 定时调度 @Scheduled 默认串行同 bean；多实例部署需 ShedLock（v0.17 候选）
- BatchPublishDrawer 双模：`job` prop（单任务）或 `items[]` prop（跨任务），后者优先级高
- 部分成功语义：响应 200 + `failed_items[]` 数组，按 `MISSING_CDN_URL` / `BUSINESS_ERROR` / `INTERNAL_ERROR` 三类原因
- v0.13.0 安全前置发现 MixcutController 之前根本没接 Principal —— 同 commit 顺手补上，service 全加 userId 过滤

### v0.16（2026-05-19）— 分发工作台迁入分发中心

把 v0.15 落在 `/mixcut/publish` 的「分发工作台」迁入 `/distribution`。混剪只负责制作；分发中心统一收口「批量制作 → 绑账号 → 派单」的用户路径。**仅 web-celebrity 改动，server / api 契约零变化**。

**新增 / 修改（web-celebrity）**：

```
components/distribution/DistributeWorkbench.tsx  (新)
  · 双视图 grid / group；跨任务搜索 + 已发布过滤（localStorage 去重）
  · Sticky right rail：已选缩略图九宫格 + 「继续配置发布 (N)」
  · 复用 BatchPublishDrawer (items[] 模式) 完成账号 / 文案 / 定时 / 派单
  · 深链入参 fromJobId — 预选 + 滚动定位

components/distribution/DistributionPage.tsx     (重写 IA)
  · header 状态条 StatChip ×3：已绑账号 / 可发变体 / 进行中任务（点切 tab）
  · Tabs：分发工作台（默认）/ 账号管理 / 任务追踪
  · 「手动分发」上移 header 右上，跨 tab 常驻
  · useSearchParams 包 <Suspense> （Next 16 build 警告）
  · URL 同步 ?tab=workbench|accounts|tracking + ?from_job=<id>

app/(workspace)/mixcut/publish/page.tsx          (改 redirect)
  · 删除 publish-workbench-client.tsx
  · 改为 redirect("/distribution?tab=workbench") 兼容旧链

app/(workspace)/layout.tsx
  · 移除 mixcut 二级菜单的「发布工作台」+ 面包屑映射

app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx
  · 保留单任务「批量发布」drawer（行为不变）
  · 新增 ghost 按钮「去分发中心 →」深链 /distribution?from_job=<id>
```

**注意事项**：

- 已派发去重是纯前端 localStorage（key `aep:distribute:published-output-ids`），跨浏览器 / 清缓存失效。稳态去重需 server 加 `mixcut_output.last_published_at` 列
- 手动 URL 输入暂未 inline 合并进工作台（保留 `ManualDistributeDialog` 独立弹窗）—— 手动场景字段差异大（封面 / 商品挂载 / 视频号 category 等专属字段），强行合并会复杂
- 三个新 web app 中只 celebrity 做了改动；drama / music 暂未涉及发布流程

### v0.17（2026-05-20）— 社交账号 profile 增强

绑定社交账号成功后，sau-service 从已登录的创作者中心页面 best-effort 提取账号辨识信息并随 `/login/poll` 的 `profile` 返回；server 加密 storage_state 的同时落库这些清洁字段，前端在账号管理 / 发布选账号 UI 中展示。

**新增 / 修改**：

```
packages/types: SocialAccount +platformAccountId
server        : SocialAccount +platformAccountId 列；SocialAccountDto / SocialAccountService 同步
sau-service   : PlatformDriver.extract_profile 统一返回 {displayName, platformAccountId, avatarUrl}
              : DouyinDriver 从创作者中心 header 抓昵称 / 抖音号 / 头像，body 文本兜底解析「抖音号：...」
web-celebrity : 账号列表、手动分发、项目分发、BatchPublishDrawer 展示平台账号号
admin         : 社交账号审计页展示 platformAccountId
openapi       : SocialAccount schema 增 platformAccountId
```

**注意事项**：

- 这是 best-effort profile：平台 DOM 或权限不同会导致字段为空；禁止用 `accountName` 伪装平台昵称。
- 各平台 driver 各自实现选择器和文本解析。抖音字段叫「抖音号」，小红书 / 视频号等平台可继续映射到统一 `platformAccountId`。

### v0.17.1（2026-05-21）— sau-service 视频号 / 快手 / 小红书 profile 拉齐 + 诊断回填

v0.17 落地时只有 DouyinDriver 走完了「retry-poll + selector 多兜底 + body 文本反向抽 ID」全链路；ShipinhaoDriver / KuaishouDriver / XiaohongshuDriver 还是单次 read，遇到 SPA 慢挂或哈希 class 漂移就拿不到 `platformAccountId`。本次把 Douyin 的 pattern 抽成模块级共享 helper，并加 selector miss 时的 DOM 诊断 dump，避免靠人肉重做 QR 绑定才能拿到现网 class：

```
sau-service : login_pool.py +_poll_extract_profile（time-bounded 重试，任意标识字段非空即返回）
            : login_pool.py +_dump_profile_dom_hints —— 重试耗尽仍空时，按 label_hints
            :   ("视频号 ID" / "快手号" / "小红书号" / "抖音号") 在 body DOM 里反向搜
            :   text 包含该 label 的节点，WARNING 吐 URL + body[:500] + 命中节点的
            :   tag / class / outerHTML[:800]。运维拿到这条日志即可在不重做绑定的前
            :   提下把真实 class / 真 label 回填到 driver 的 *_SELECTORS / body label。
            : DouyinDriver.extract_profile 改用共享 helper（无行为变化）+ 接 label_hints
            : ShipinhaoDriver 加 PROFILE_READY_TIMEOUT_S / DISPLAY/ACCOUNT_ID/AVATAR_SELECTORS
            :   selectors 覆盖 [class*='finder-nickname'] / [class*='finder-uniq-id']
            :   body 兜底解析「视频号 ID: …」/「原始 ID: …」
            : KuaishouDriver 扩 selectors（[class*='kwaiId'] / [class*='userInfo']…）+ body 兜底 "快手号"
            : XiaohongshuDriver 扩 selectors（[class*='redId'] / [class*='red-book-id']…）+ body 兜底 "小红书号"
tests       : test_smoke.py +test_non_douyin_profile_text_helpers_parse_creator_headers
```

**注意事项**：

- 当前 selectors 是基于上游 sau / 常见 emotion class 命名套路猜的，**首次真实绑定后必须按诊断 WARNING 回填一次**。日志样式：
  ```
  [shipinhao] extract_profile empty after retry budget; url=https://channels... body[:500]='...' label_hits=3
    [shipinhao][0] tag=SPAN cls='nickname-xxx' text='视频号 ID: shipinhao_demo_001' parentTag=DIV parentCls='header-yyy' outerHTML='<span class="nickname-xxx">视频号 ID: shipinhao_demo_001</span>'
  ```
  操作员/agent 取 cls 改 driver 的 `ACCOUNT_ID_SELECTORS`，取 parentCls / text 形态改 body 兜底 label。
- 重试上限 10s + 0.5s 间隔 = 最多 20 次 poll；不会卡住 `/login/poll` 整体超时（外层 30s+）。
- 诊断 dump 不读 cookie / storage_state；仅 DOM。封顶 5 个 hit + 单节点 outerHTML 800 字，日志总量可控。
- 没有 schema 变更：server / openapi / 前端契约不动；仅 driver 内部成功率提升 + 自诊断。

### v0.17.2（2026-05-21）— sau-service 小红书 profile 主动导航 + 部分命中诊断

v0.17.1 给 XHS 加了 selector + label 兜底，但实际 QR 绑定后发现 platform_account_id 仍然空：原因是 创作者中心 post-login landing（`/creator-center/post-creation` 之类）顶部 chrome 只有 avatar，没有 nickname / 小红书号 在 DOM 触手可及 —— selector 再多也没用。

引入 `PlatformDriver.prepare_profile_view(page)` 钩子：在 `_poll_real` 拿 storage_state 之前给 driver 一次主动 navigate / 点 UI 的机会。`XiaohongshuDriver` 实现按 `[/creator/home, /setting/profile, /account/personal-data, /creator-center/profile]` 顺序探，命中标志是 body 含「小红书号」且未被反弹回 /login。

同时升级 `_poll_extract_profile` 的成功判定 + 诊断 dump：

```
sau-service : login_pool.py +PlatformDriver.prepare_profile_view (默认 noop)
            : login_pool.py XiaohongshuDriver +PROFILE_VIEW_URL_CANDIDATES (4 条) +prepare_profile_view
            : login_pool._poll_real 在 storage_state() 之前调 prepare_profile_view(page)
            :   —— 多吃一次 cookie 刷新；XHS 必须导航否则 小红书号 不在 DOM
            : routes/accounts.py verify path 同步加 prepare_profile_view 调用
            : login_pool._poll_extract_profile 成功判定从「displayName OR platformAccountId」
            :   收紧为「displayName AND platformAccountId」—— 部分命中也会跑满 deadline
            :   → 触发诊断 dump（之前 displayName 命中后立刻 return，platformAccountId 永远空也不报）
            : login_pool._dump_profile_dom_hints +missing_fields=(...) 入参 + header chrome 第二 pass
            :   pass-1: 含 label 文本的节点；pass-2: header / userInfo / avatar 容器 outerHTML
            :   日志 line 改 "incomplete after retry budget; missing=displayName,platformAccountId"
tests       : test_smoke.py +test_xiaohongshu_overrides_prepare_profile_view
            :   断言 XHS 重写了 hook、其它 driver 仍为 noop（避免无谓导航开销）
```

**注意事项**：

- 候选 URL 是基于公开经验猜的；首次真实绑定后看日志「[xiaohongshu] prepare_profile_view ok via <url>」就知道哪条命中。若全部失败 → log "all candidates failed" + extract 仍跑（fallback 是 landing 页 best-effort）。
- 收紧成功判定后，**已知 selector 错的平台首次绑定会跑满 10s** 才退（之前 displayName 一命中就 return）。这是诊断 dump 的必要前提；selector 修对后两项一起来 → fast-bail。
- `prepare_profile_view` 失败一律不抛（外层有 try/except wrapping），不影响 storage_state 捕获 + 业务返回 success。
- verify path 同步加了 prepare_profile_view 调用，老 cookie 再 verify 时也会刷新 profile —— 用户重新点「验证账号」按钮即可让 profile 字段回填，不用重新扫码。

### v0.17.3（2026-05-21）— sau-service QR 提取失败时落盘 snapshot

XHS（也可能将来视频号 / 快手）`/login` 页 DOM 经常漂 —— class hash 改、tab 布局换、整页换 modal 之类的。`extract_qr_data_url` 抛 `RuntimeError("QR src not found ...")` 时之前是干抛，运维只能瞎猜 selector。这次：

```
sau-service : login_pool.py +_dump_qr_extraction_failure(page, platform, msg)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.png  (full_page screenshot)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.html  (page.content())
            :   - WARNING log 含 URL + body[:500] + 所有 data:image/<img> 的 size/class/parent
            :   - 落盘目录可用 SAU_DEBUG_SNAPSHOT_DIR 覆盖（docker mount 用）
            : XiaohongshuDriver.extract_qr_data_url 在 raise 前调 helper，把 snapshot 路径塞 msg
            : login_pool._start_real 兜底：任何 driver 的 QR 提取异常都触发 snapshot
            :   （XHS 自己已经塞过路径 → 跳过；其它 driver 飘了也能拿到现网快照）
```

**注意事项**：

- snapshot 文件包含 cookie 之前的 /login 页面 —— 没有任何用户敏感数据（页面是未登录态的 QR 卡片）。
- 默认目录 `./sau-debug-snapshots/` 是相对启动 CWD；docker 部署务必设 `SAU_DEBUG_SNAPSHOT_DIR=/data/sau-debug` 并挂卷，否则容器重启就丢。
- WARNING log 里的 `data:image candidates=N` 列表是诊断关键 —— 真 QR 一般 180-220px 见方，列表里能直接看出来哪个 img 是 QR、它的 class 是什么。
- XHS 长期还是建议改用 `xhs-toolkit.XhsClient.get_qrcode()` API 路径替代 DOM scrape —— 上游 `pokocat/social-auto-upload` 的 `xhs_uploader/xhs_login_qrcode.py` 走的就是这条 API；DOM scrape 是临时活路。

### v0.18（2026-05-20）— sau-service 上传超时保护

`pokocat/social-auto-upload` 上游的 `DouYinVideo.upload()` / `TencentVideo.upload()` 内部"点击发布按钮"是 `while True` 无限循环，平台 selector 失效或视频审核久挂时会一直输出 `🏃 小人正在冲刺发布视频` 卡死。sau-service 包一层 timeout + cancel-aware race + publishing watchdog。

**新增 / 修改**：

```
sau-service : uploader.py +_run_upstream_upload helper (asyncio.wait race + sliced loop)
            : publishing watchdog（60s 后 push status=publishing/80）
            : cancel_event race（用户取消能真打断进行中的 upstream upload）
            : SAU_UPLOAD_TIMEOUT_S / SAU_UPLOAD_PUBLISHING_AFTER_S 两 env
```

### v0.19（2026-05-20）— 视频库允许再次分发 + 发布短信验证码人机交互

两块独立子改动归到同一 v 节（README.md / 部署日志已经合并）：

**A. 视频库允许再次分发 · 派发计数落库**

废止 v0.16 的 localStorage 去重（`aep:distribute:published-output-ids` 已彻底删除）。视频库默认显示全部可发变体（含已派发过的），同一变体可再次分发到新账号 / 新时间窗。派发记忆改走 server。

```
server        : MixcutRenderOutput +publishCount (@ColumnDefault("0")) / +lastPublishedAt 列
              : MixcutRenderOutputDto 同步 publish_count / last_published_at
              : MixcutPublishService 注入 MixcutRenderOutputRepository
              :   每条 output 派单成功后按 target 数累加 publishCount + setLastPublishedAt(now)
              :   tracker 写库失败只 log（不阻塞派单结果）
web-celebrity : mixcut-zone/types.ts#RenderOutput +publish_count? / +last_published_at?
              : distribution/DistributeWorkbench.tsx 删除 PUBLISHED_KEY / publishedIds / loadPublished / persistPublished
              :   工具条按钮翻为「显示全部 / 仅未发布」二态（默认 OFF = 显示全部）
              :   GridView / GroupView 用 output.publish_count 渲染「已发 ×N」徽标 + hover tooltip 相对时间
              :   handlePublished 改为 load() 重新拉 jobs，徽标实时升级
```

**B. 发布短信验证码人机交互**

平台风控触发"输入短信验证码"弹窗时，sau-service 检测后推 `awaiting_user` 状态到 server，前端弹起输入框让用户提交；提交回 sau-service 把 code 填进 page、关闭弹窗，上游 upload retry 循环自然继续。MVP 整 stack 通；selector 占位待真实 DOM 抓取后接入。

```
packages/types : PublishJobStatus +awaiting_user；InteractionRequired；SubmitPublishJobInteractionInput
                : PublishJob.interactionRequired?，PublishJobCallback.interactionRequired?
server          : PublishJobStatus +AWAITING_USER（状态机双向：UPLOADING/TRANSCODING/PUBLISHING ↔ AWAITING_USER ↔ UPLOADING/PUBLISHING/LIVE）
                : PublishJob +interaction_required（TEXT JSON 列）
                : POST /api/me/publish-jobs/{id}/interact { code }
                : SauServiceClient.submitInteraction
sau-service     : interaction.py（SmsInteractionDriver Protocol + _PlaceholderSmsDriver）
                : uploader.py 加 SMS watcher coroutine（detect → request_sms → await user code → submit_code → is_cleared）
                : _hook_chromium_for_page_capture context manager（monkey-patch playwright.chromium.launch 抓取上游 page）
                : POST /tasks/{id}/interaction { code }
                : SAU_INTERACTION_USER_TIMEOUT_S / SAU_INTERACTION_POLL_INTERVAL_S 两 env
                : awaiting_user 期间 UPLOAD_TIMEOUT_S 暂停计时
web-celebrity   : SmsInteractionDialog 弹窗（脱敏手机号、6 位输入、5min 倒计时、Enter 提交、auto-complete one-time-code）
                : PublishJobList awaiting_user STATUS_META、行内「输入验证码」按钮、自动弹窗
admin           : PublishJobStatus +awaiting_user、PUBLISH_JOB_STATUS 表加 "待输入验证码"、tab + inflight 计数同步
openapi         : PublishJobStatus enum 加 awaiting_user；InteractionRequired schema；/me/publish-jobs/{id}/interact path
```

**注意事项**：

- 入库默认值靠 Hibernate `@ColumnDefault("0")`；ddl-auto=update 时 H2/MySQL 都能为现存行补 0。
- `bumpPublishTracker` 单条 try/catch；output 不存在或保存失败只 log，业务结果不回滚。
- BatchPublishDrawer 接口不变；唯一行为变化是它的 onPublished 回调里上游会 refetch jobs。
- 「显示全部」是默认 / 推荐状态。「仅未发布」仅在用户主动收窄时启用，按 `publish_count === 0` 过滤。
- **MVP selector 占位**：`_PlaceholderSmsDriver.detect()` 永远返回 None，所以 awaiting_user 路径在生产**还不会触发**。整 stack 已联通；要真启用需要在抖音/视频号触发风控、抓 SMS 弹窗 DOM、替换 placeholder 为真实 selector driver。
- **upstream 不暴露 page**：`DouYinVideo.upload(playwright)` 把 browser/context/page 全留在局部变量。我们靠 `_hook_chromium_for_page_capture` monkey-patch `chromium.launch` 捕获 Browser 引用，poll `browser.contexts → pages` 拿 page。per-task scope（finally 复原），不影响并发，但耦合 upstream 当前用 `launch()` 而非 `launch_persistent_context()`。如果上游改了，需要更新 helper。长期方案是 fork upstream patch `upload()` 接受 `on_page` callback。
- **超时倒计时双源**：前端 `SmsInteractionDialog.USER_INPUT_TIMEOUT_S=300` 必须与 sau-service `SAU_INTERACTION_USER_TIMEOUT_S=300` 同步；否则会出现一端认为已超时而另一端还在等待的撕裂。

### v0.20（2026-05-20）— 分发定时策略升级（每日铺开 + 随机抖动）

v0.15 的「定时发布」只支持一个 `datetime-local` —— N×M 派单同一时刻起飞。v0.20 引入完整 cadence 策略：把 N 条 mixcut 变体按「每天 K 次 × D 天」铺到未来时间槽，可选随机抖动。`PublishJob` / `PublishJobScheduler` 零改动，错峰 `scheduledAt` 直接走现有调度。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +schedule: ScheduleSpec 顶层字段（sealed interface +
        :   Immediate / Single(at) / DailyRecurring(startDate, timeSlots, timezone, maxDays, jitterMinutes)）
        : MixcutPublishBatchRequest.TargetItem -scheduledAt （时间不再 per-account）
        : MixcutPublishService.expandSchedule —— 把 spec 算成 outputs.size 长的 Instant[]
        :   (timeSlots 排序去重、ZoneId 解析、LocalDate.parse、jitter 范围 0..30、容量校验)
        :   过去 slot clamp 到 now；jitter 用 ThreadLocalRandom（不可重放）
        : MixcutPublishService.batchPublish 改用 perOutputAt[i] 注入到 per-output targets
        : projectId 兜底拼 "mixcut-batch-<source>-<yyyyMMddHHmmss>" 防撞
web-celebrity:
        : api/mixcut.ts +ScheduleSpec discriminator union, -MixcutPublishTarget.scheduled_at
        : BatchPublishDrawer.tsx 状态层换成 strategy/singleAt/startDate/timeSlots/capMode/maxDays/jitter*
        :   抽 ScheduleEditor 子组件 + StrategyPill + sortDedupSlots / expandDailyRecurringPreview / slotToDate
        :   4 套预设 chip (每天 3 次 / 每天 2 次 / 每天 1 次 / 晚间高峰) + 自定义 HH:MM 编辑
        :   实时预览行 + 容量超限红字阻拦 + auto-suggest maxDays
        : distribution/DistributeWorkbench.tsx 右栏帮助文案加一行 cadence 提示
```

**注意事项**：

- API 是破坏性变更（drop `targets[].scheduled_at`，要求顶层 `schedule`）—— 无线上外部消费方，干净切换，不做向后兼容 shim。
- 前后端铺开算法（`expandSchedule` vs `expandDailyRecurringPreview`）必须严格对齐：前端只算「理论 slot 时间」用作预览，**不**模拟抖动；后端是真值源。`slotToDate` 在浏览器本机 tz 与 schedule.timezone 不同时做一次反向偏移修正，DST 边界可能差 1 小时（服务端不受影响）。
- `outputs[]` 顺序变成业务语义：i 决定 day_offset 与 slot 索引。前端勾选顺序即铺开顺序，PRODUCT.md / 抽屉提示均说明「按勾选顺序铺开」。
- jitter 用 `ThreadLocalRandom`：不可重放。未来若要可复算，引 `seed = hash(projectId, i)`。
- 显式 out-of-scope：campaign 级别取消（`/distribution?tab=tracking` 单条 cancel 仍可用）、ShedLock、跨账号错峰、interval / random_window / weekly 等扩展策略（discriminator 预留扩展位）。

### v0.28（2026-05-23）— 商品主线贯穿（素材统一 + 链接解析 + 生成-分发桥接）

把过去四块独立的「商品库 / 素材库 / 混剪 / 分发」按「商品」为主线连起来：从抖音商城链接解析 → 落 Product + 关联素材到 MixcutAsset → 混剪以商品为入口自动填 slot → 抖音分发自动带商品链接。仅 celebrity 子产品改动。

**核心设计原则**：

- **MixcutAsset 是唯一素材表**：用 `relatedProductId` 标记商品归属（沿用 v0.21 `relatedStarId` 同模式，不发明新表）。`Product.images` 字段渐进废止，新代码读取走 `listAssets({ relatedProductId })`。
- **productId 是生成-分发的贯穿键**：MixcutRenderJob 加 `productId`；BatchPublishDrawer 打开时反查 Product 自动 prefill 抖音商品挂载字段。PublishJob 不加冗余列。
- **前端不区分 URL 形态**：单一调用 `POST /api/me/products/parse-link`；server 内部 handler chain 按 `@Order` 决定路径，新平台只加 handler。
- **外网 CDN URL 直接登记**：抖音商品图直接作为 MixcutAsset.fileUrl，不下载本地。

**新增 / 修改**：

```
types          : Product +priceCents +commissionRate; +product-link.ts(ProductLinkInfo);
                 MixcutAsset +related_product_id +subkind; RenderJob +product_id
server         : Product / MixcutAsset / MixcutRenderJob 三张表加新列
               : aep/service/productlink/* —— Handler 接口 + DouyinQueryEmbeddedHandler(@Order(10),
                 query 内嵌 goods_detail) + DouyinHtmlScrapeHandler(@Order(20), HTML 抓 og tags +
                 window.__INITIAL_STATE__；host 白名单防 SSRF)
               : ProductLinkService 编排 chain; ProductLinkPersistService 衔接 ProductService +
                 MixcutAssetService.registerExternalUrl(...)
               : POST /api/me/products/parse-link（仅解析）+ /api/me/products/from-link（解析+落库）
               : MixcutAssetController list 加 related_product_id 过滤
               : CelebrityProductSeeder @Order(30) —— 首次启动 product 表为空时种 6 行抖音选品样例
web-celebrity  : ProductFormDialog +「📋 从抖音链接解析」+ 价格 / 佣金 输入
               : CelebrityProductLibrary +「从抖音链接快速建档」入口 + 行「生成视频」按钮 + 价格 / 佣金 列
               : ProductGenerateDialog（新）—— 选模板跳 /mixcut/create/{tplId}?product_id=X
               : ProductBatchImportDialog 识别 商品价格 / 佣金 列；占位符改抖音选品库 TSV 格式
               : create-client.tsx 读 useSearchParams.product_id；并发拉 product + listAssets;
                 applyProductHeuristics 自动绑 image/picgen_text/text slot; 顶部 chip + 提交透传 product_id
               : BatchPublishDrawer 自动 prefill productLink/productTitle，显示「已从商品库带入」chip
               : mocks/products.ts 替换为 6 行抖音选品样例（与 server seed 同源）
openapi        : Product/ProductInput +priceCents/commissionRate; 新 ProductLinkInfo schema;
                 新 /me/products/parse-link + /me/products/from-link path
tests          : DouyinQueryEmbeddedHandlerTest + ProductLinkServiceTest — 11 测全绿
```

**注意事项**：

- 启发式 slot 绑定按 `slot_id / label / fill_strategy` 子串命中（product|商品|图 → 商品图槽，title|标题 → 标题槽，point|卖点|desc → 卖点槽）；只覆盖 prev 中未绑或绑 `fixed` 的 slot，用户已改不动。模板命名越规范命中率越高。
- DouyinHtmlScrapeHandler 在 host 白名单外直接返回 empty（防 SSRF）；URL scheme 仅允许 http/https。
- CelebrityProductSeeder 仅 Product 行，**不**触发外网图片抓取；运营首次访问 UI 后手动点「📋 从抖音链接解析」回填。
- ProductLinkPersistService 单事务，图片登记单条失败 log + 继续，整体不回滚。
- BatchPublishDrawer prefill 仅在 `sourceJob.productId` 非空时触发；用户清空 chip 后可手动覆盖，不影响业务。
- 「商品ID」列在批量导入时识别但**不持久化**（server 自己生成 id）；保留是为兼容抖音表格直接粘贴。
- **未实现**：AI 生成带货视频（仅在 MixcutAsset.subkind 预留 `"ai-marketing-video"` 占位）；抖音以外平台的 handler；商品图本地化备份；PublishJob.productId 冗余列。

### v0.25（2026-05-22）— 混剪按场景渲染（多段落 bug 修复）

模板里 `scenes[]` 数据完整（每场景独立 duration + slots[]），但渲染器无视场景结构，硬编 `segCount = Math.min(2, sources.size())` + `segDuration = maxOutputDurationSec / segCount`，导致**无论模板配几个场景，最终视频永远只有 2 段**（每段 7.5s）。前端 `flatSlotsAbsolute()` 把场景拍平时丢了边界信息，渲染器收到的 `slots_snapshot` 完全没有场景概念。本次把"场景"作为一等公民贯穿整链路。

**新增 / 修改**：

```
types.ts          : +SceneSnapshot {id, label?, duration_sec, slot_ids[]}
                  : RenderJob +scenes_snapshot?: SceneSnapshot[]
                  : SlotSnapshot +time_range?: [number, number]（之前漏掉 → 这是 bug 根因之一）
create-client.tsx : 提交 job 时直接从 template.scenes 构造 scenes_snapshot（按顺序）
server model      : MixcutRenderJob +scenesSnapshotJson TEXT 列（@Lob）
server dto        : MixcutCreateJobRequest +scenes_snapshot；MixcutRenderJobDto +scenes_snapshot 回包
server service    : MixcutJobService.create 透传 scenes_snapshot
MixcutRenderingService :
  - RenderContext +scenes: List<SceneSpec>; SceneSpec { id, durationSec, slotIds }
  - buildContext 解 scenesSnapshotJson；单场景 clamp [1, maxOutputDurationSec]，总和 > max 按比例缩放
  - renderOneVariant +useSceneSchedule 分支：segCount = scenes.size()（不再硬编 2），
    segDurations[i] = scene.durationSec，每段独立 -ss/-t，totalDuration = 段长之和
  - +slotToWindow: Map<slotId, [start,end]>，给 overlay filter 追加 :enable='between(t,a,b)'
    把 overlay 限制在所属场景时段（v0.24 之前 overlay 整片可见）
  - applied_transforms +scene_schedule + total_duration_sec；每段 detail +scene_id/output_start/output_end
  - 缺省（scenes_snapshot 空 / 旧任务）→ 回退 v0.24 路径（最多 2 段）
```

**注意事项**：

- 字段全部加性兼容：scenes_snapshot 为空时渲染器行为与 v0.24 完全一致，历史任务不受影响。
- 总和超出 `aep.mixcut.max-output-duration-sec`（默认 15s）按比例缩放后再渲染；想要更长视频需调高上限。
- 源视频 round-robin：scene[i] → `sources[(variantIndex + i) % sources.size()]`；5 场景 + 2 视频会循环复用，5 视频 + 2 场景每变体只用 2 个。
- overlay enable 用单引号包 `between(...)`，防止表达式里的逗号被 ffmpeg 当成 filter-chain 分隔符。
- 一个 slot_id 不属于任何场景的 `slot_ids[]`（前端漏发？模板异常？）→ 该 overlay 整片可见（旧行为），不会丢失内容。
- openapi.yaml `/mixcut/jobs` 当前只有 path 骨架（无 request/response schema），contract gate 只校验 path 存在 → 不需要改 openapi。

### v0.23（2026-05-21）— 任务追踪按批次聚合 + 批量操作

celebrity 子产品的「分发中心 → 任务追踪」从平铺 PublishJob 列表升级为按 `project_id` 聚合的批次卡片 + 服务端分页 + 批次级批量操作（取消整批 / 重试失败 / 重新调度未开始）。N×M 派单后列表不再爆炸，运营一键搞定整批。

**新增 / 修改**：

```
server  : service/publish/ScheduleExpander.java（抽自 MixcutPublishService.expandSchedule，公共 util）
        : service/PublishJobBatchService.java（listBatches / cancelBatch / retryFailedBatch / rescheduleBatch）
        : controller/PublishJobBatchController.java → /api/me/publish-jobs/batches/*
        : dto/PublishBatchSummaryDto.java + dto/RescheduleBatchInputDto.java
        : repository/PublishJobRepository 加 findBatchProjectIdsByUserId(Pageable) + findByUserIdAndProjectIdInOrderByCreatedAtAsc
        : service/PublishJobService.createBatch projectId fallback：null/blank/"manual" → "manual-batch-<userId>-<yyyyMMddHHmmss>"

shared  : packages/types/src/publish-job.ts +PublishBatchSource/+PublishBatchSummary/+RescheduleBatchInput；ScheduleSpec 提升为共享类型
        : packages/api-client +apiFetchPaginated<T>（保留 PageEnvelope 的 pagination 元数据）
        : PublishJobApi +listBatches/+getBatch/+cancelBatch/+retryFailedBatch/+rescheduleBatch

web-celebrity:
        : components/distribution/ScheduleEditor.tsx（抽自 BatchPublishDrawer，行为零变化）
        : components/distribution/BatchTrackingTab.tsx + BatchSummaryCard.tsx + BatchDetailDrawer.tsx + RescheduleBatchDialog.tsx
        : DistributionPage tracking tab 由 <PublishJobList /> 换成 <BatchTrackingTab />
        : ManualDistributeDialog 删 MANUAL_PROJECT_SENTINEL，让服务端兜底
        : mixcut-zone/BatchPublishDrawer.tsx 改 import 抽出的 ScheduleEditor，删本地重复 420 行
openapi : 新增 5 paths（/me/publish-jobs/batches*）+ 2 schemas（PublishBatchSummary / PublishBatchSource）
        : ScheduleSpec / ScheduleSpecImmediate / ScheduleSpecSingle / ScheduleSpecDailyRecurring 正式入 schema
        : CreatePublishJobInput.projectId 改 optional + 注释手动分发自动生成
```

**注意事项**：

- 服务端 listBatches 走两步查询（GROUP BY → IN）+ Java 层 fold；不在 DB 落实体表，纯派生汇总。
- ScheduleSpec 持久化策略：**不存**。reschedule 让用户重新填一份新 spec 作用于 QUEUED 子集，不读老 spec。
- 历史 `project_id="manual"` 行聚合成单张「历史散件」徽章卡，不做回填迁移；新数据自然分流到不同 `manual-batch-*` 桶。
- 轮询：列表 5s（仅当有 hasInflight 时）；Drawer 内 PublishJobList 仍跑 2.5s（行级）。Drawer 关闭即 unmount，effect cleanup 自动停轮询。
- 重新调度只对 status=queued 生效；已开始 / 终态行原样保留。

### v0.21（2026-05-21）— 混剪 / 分发用户视角文案 + 视频库 + 官方明星片段

Celebrity 子产品的混剪与分发交互整改一次性合并：术语全面 review、清理无效按钮、引入「视频库 + 软删」与「官方明星片段」两个新模块、配额条下线、模板新建不再有副作用。

**A. 文案与术语全面 review（仅 web-celebrity）**

| 旧术语 | 新术语 |
|---|---|
| 变体 / variant / output | 视频 / 第 N 条 |
| 派单 / 发布 / 分发 | 统一对外「分发」；后台执行说「发布到 XX 平台」 |
| 任务 / job | 「生成任务」（混剪侧）/「分发任务」（分发侧） |
| 手动分发 | 上传链接分发 |
| CDN 已就绪 | 已生成 · 可立即分发 |
| cookie 加密存储 | 账号凭据已加密存储 |
| 立即派单 / 定时派单 / 铺开派单 | 立即分发 / 定时分发 / 分期分发 |
| 渲染节点 / sau-service / 轮询 2.5 秒 | 不暴露 |

涉及文件：`DistributionPage` / `DistributeWorkbench` / `BatchPublishDrawer` / `PublishJobList` / `SocialAccountList` / `ManualDistributeDialog` / `BindAccountDialog` / `mixcut/jobs/[id]/job-detail-client`。

**B. 混剪本月配额下线**

- 删 `MixcutHomePage` 的 `QuotaIndicator`，换为纯统计 `MonthlyStats`（本月已生成 N 条视频 + 累计 M 个任务）。
- 积分余额由 app 顶部钱包入口统一承载，不再混进混剪工作台。

**C. 混剪视频库 + 已生成视频软删（30 天硬删）**

- server: `MixcutRenderOutput` +`deletedAt`；新 `DELETE /api/me/mixcut/outputs/{outputId}`；DTO 转换层过滤 `deletedAt != null` 的 output。
- 新文件 `apps/server/.../service/mixcut/MixcutOutputCleanupScheduler.java`：`@Scheduled(cron="0 30 3 * * *")` 每日 03:30 扫 30 天前软删行 → 删本地 mp4 / 缩略图 → 调 `CdnUploader.delete(cdnKey)` → 删 DB 行（best-effort）。
- web-celebrity: `/mixcut/library` 改造顶层 tab「我的素材 / 我的视频 / 官方明星片段」；新 `MyVideosTab` 列已生成视频卡片网格 + 单条删除（confirm 文案明示「30 天可恢复」）。
- `DistributeWorkbench` 右栏 help 加超链 `/mixcut/library?tab=videos`。

**D. 官方明星片段专区（运营上传 / 用户只读）**

- server: 复用 `MixcutAsset` +`isOfficial` / `officialCategory` / `relatedStarId`。新 admin endpoints `/api/admin/mixcut/official-clips`（POST multipart / GET / PUT / DELETE）+ 公开 `GET /api/mixcut/assets/official-clips?category=&star_id=`。文件落 `./mixcut-assets/official/<category>/`。
- admin: 新页 `apps/admin/src/app/celebrity/mixcut-official-clips/page.tsx`（列表 + 上传 dialog + 行级编辑 + 删除）；`apps/admin/src/constants/nav.ts` 在「明星带货」组追加菜单。
- web-celebrity: `OfficialClipsTab` 真后端拉取 + 分类 chip 筛选 + 只读卡片网格。

**E. 新建模板不再自动落库**

- 模板列表「新建」按钮改为 `router.push("/mixcut/templates/new")`，不再调 `saveTemplate`。
- 新文件 `apps/web-celebrity/src/app/(workspace)/mixcut/templates/new/page.tsx` 渲染 `<TemplateDetailClient mode="new" />`。
- `template-detail-client.tsx` 加 `mode?: "view" | "new"` prop：new 模式用 `useMemo` 生成内存默认模板、跳过 server fetch、自动进编辑态、顶部草稿横幅、保存按钮 → `router.replace("/mixcut/templates/{id}/edit")`、取消按钮 → 返回列表无残留。
- 隐藏「另存为」「删除」按钮（草稿不适用）。

**F. 任务详情页清理无效按钮**

`apps/web-celebrity/src/app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx`：
- 删「全部打包下载」/「再生成一批」/顶部 Trash2 三个空 onClick 按钮。
- 复制按钮 onClick 接 `navigator.clipboard.writeText(job.id)`。
- 「渲染节点」row 删除（内部信息），「本次消耗 X 条额度」改「X 积分」。

**G. 分发工作台默认按任务视图**

`DistributeWorkbench.tsx` L78：`useState<ViewMode>("grid")` → `"group"`。

**H. 分发工作台 → 视频库超链入口** （已在 C 中覆盖）

**API 契约同步**：

- `DELETE /me/mixcut/outputs/{outputId}` — 已生成视频软删
- `GET /mixcut/assets/official-clips?category=&star_id=` — 公开列表
- `GET/POST /admin/mixcut/official-clips` + `PUT/DELETE /admin/mixcut/official-clips/{id}` — 运营管理
- `MixcutAsset` schema 加 `is_official / official_category / related_star_id`
- `MixcutRenderOutput` schema 加 `deleted_at`

**注意事项**：

- 软删 30 天保留期靠 `@Scheduled` cron。多实例部署需 ShedLock（沿用 PublishJobScheduler 同样的待办）。
- `MixcutOutputCleanupScheduler` 单条 IO 失败 log + 继续，DB 行保留下次重试。
- 「我的视频」tab 直接 `MixcutApi.listJobs()` 拍平所有 outputs（DTO 已过滤软删），不新增专门 endpoint。
- 官方明星片段与 v0.13 的 `isPreset`（扰动贴图池）是两套互斥标记：`isPreset=true` → GIF overlay；`isOfficial=true` → 用户可用作混剪源的明星视频片段。
- 模板新建走 `/mixcut/templates/new` 路由，详情页 `mode="new"` 时 template_id 是前端 nanoid 生成的，第一次 saveTemplate 时 server 以该 id upsert。取消则前端 state 丢弃，**完全不落库**。

### v0.22（2026-05-21）— 混剪批量发布支持抖音商品挂载

v0.15 起 `/api/me/mixcut/publish-batch` 派单时硬编 `productLink=null, productTitle=null`（v0.16 注释明示「暂不携带商品挂载；操作员后续手工编辑或走手动分发补登」）。这次把两字段拉到 `MixcutPublishBatchRequest` 顶层，沿着既有单条 PublishJob path 透传给 sau-service → `DouYinVideo(productLink=..., productTitle=...)`，触发抖音视频画面下方「立即购买」挂件。

批量场景的本质是「同一商品挂到 N 条混剪变体上」，所以字段是顶层 string 而非 per-output。非 douyin 平台目标 sau-service 静默忽略。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +productLink / +productTitle 两顶层字段
        : MixcutPublishService.batchPublish 改透传（删 "暂不携带商品挂载" hardcode null,null）
        :   CreatePublishJobInputDto 第 7/8 参拿 req.productLink() / req.productTitle()
        :   PublishJob 落库 → PublishJobService.startJob 已有的 sau-service 透传逻辑生效

web-celebrity:
        : api/mixcut.ts MixcutPublishBatchRequest +product_link? / +product_title? 可选
        : BatchPublishDrawer.tsx
        :   + productLink / productTitle state（drawer open 时复位为空）
        :   + douyinSelected memo（accounts × selectedAccountIds 任一 douyin 即真）
        :   + 「抖音商品挂载」<section> 仅当 douyinSelected 时渲染（mirror ManualDistributeDialog）
        :   + submit 时 carryProduct = douyinSelected && link && title; 半残则整组 undefined
```

**注意事项**：

- 字段语义对齐单条 path：两项都非空才透传，半残（只有 link 没有 title 或反之）整组丢弃 —— 上游 sau 挂件需要两项齐全。
- `MixcutPublishBatchRequest` 是破坏性扩展但向后兼容：旧客户端不传两字段 → record 字段为 null → service 透传 null → 行为与 v0.21 相同。
- openapi.yaml `/me/mixcut/publish-batch` 当前只声明了 path 骨架（无 request schema）；contract gate 只校验 path 存在，所以这次不需要改 openapi。后续 schema 化时再补 `product_link / product_title` 字段。
- 非 douyin 平台填了也无效但不报错（sau-service _upload_shipinhao/_upload_kuaishou 不消费这两字段）。
- UI 隐藏逻辑只看 `accounts.platform === "douyin"`；若未来扩 tiktok 也有商品挂载，要重做这个 visibility predicate。

### admin sidebar 启用状态

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / Finance（含 recharge-packages）/ Notifications / Audit / 平台 > AI 模型。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

### v0.34（2026-05-27）— 阿里云部署架构（infra/ + Flyway + seeder gate + 密钥 fail-fast）

为阿里云 **ECS + RDS + OSS** 提供一套版本化、可一键复制的部署基础设施。范围 Phase 0+1+2：
基础设施版本化、生产硬伤修复、RDS/OSS 配置就绪。Phase 3（全栈容器化 + CI/CD）、Phase 4
（用户上传素材 OSS 化）、Phase 5（多实例 Redis + ShedLock）留作 v0.35+。

**A. 基础设施版本化（Phase 0）**

新增 `infra/` 目录把部署资产纳入 git：

```
infra/
├── README.md                    ← 入口 + 拓扑图 + 一次性环境拉起 SOP + FAQ（单一真值源）
├── env/                         ← 7 份 *.env.example（server / sau-service / 5 个 web app）
├── nginx/                       ← ai.conf.example（HTTP 入口）+ ai.aistar.com.conf.example（HTTPS 多子域）
├── systemd/                     ← 7 个 *.service.example
├── rds/                         ← 00_create_database.sql + 01_create_app_user.sql + README
├── oss/                         ← ram-policy.json + cors-config.json + lifecycle.xml + README
└── scripts/                     ← deploy.sh / rollback.sh / verify.sh
```

**B. 生产硬伤修复（Phase 1）**

```
server : pom.xml +flyway-core +flyway-mysql
       : src/main/resources/db/migration/V1__baseline.sql (空文件 + 注释；baseline 占位)
       : application.yml +spring.flyway.{enabled,baseline-on-migrate=true,baseline-version=1,locations}
       : application.yml +aep.seed.dev-data.enabled: ${AEP_SEED_DEV_DATA_ENABLED:true}
       : application-mysql.yml +aep.seed.dev-data.enabled: ${AEP_SEED_DEV_DATA_ENABLED:false}（生产覆盖）
       : application-mysql.yml +spring.datasource.hikari.{maximum-pool-size,minimum-idle,...} 显式参数
       : DataInitializer / CelebrityZoneDataInitializer / CelebrityProductSeeder /
         DataSeeder / AiModelProviderDataInitializer / MixcutTemplateSeeder
         全部 +@ConditionalOnProperty(aep.seed.dev-data.enabled, true, matchIfMissing=true)
         （DemoCatalogSeeder 已 @Profile({"dev","test"}) 不动；MixcutPresetSeeder 是平台基础数据不动）
       : JwtUtil 加 Environment 注入 + 启动时 mysql/prod profile 看到 dev default secret → 抛
         IllegalStateException 阻止启动；同时校验 secret 长度 ≥ 32
       : AepCryptoUtil 在 static {} 块加同样校验（读 SPRING_PROFILES_ACTIVE env 变量）
miniprogram : 新增 config/env.example.js（apiBaseUrl + useMock 多环境配置）；
              app.js 改用 try { require("./config/env.js") } catch fallback：默认 useMock=true
              + apiBaseUrl=http://localhost:8080/api（首次 clone 无需配置即可跑 mock）
.gitignore  : +apps/miniprogram/config/env.js  +infra/env/*.env （保留 *.example）
docs/INDEX.md : 部署段重写指向 infra/README.md（旧 DEPLOYMENT.md / aliyun-deploy skill 整体废弃删除）
```

**C. RDS / OSS 配置就绪（Phase 2）**

代码层面已就绪（v0.14 `AliyunOssCdnUploader` + v0.31 `AliyunSmsSender` 都是完整实现，不是 stub），
本次只补：
- `infra/env/server.env.example` 完整含 RDS endpoint / OSS 6 个 env / SMS 4 个 env 的占位 + 注释
- `infra/rds/` 建库 + 应用账号 SQL + 阿里云 RDS 控制台操作 SOP
- `infra/oss/` RAM 最小权限策略 + CORS 规则 + 生命周期规则 + bucket / CDN 创建 SOP

**注意事项**：

- **Flyway baseline 当前是空文件**（仅占位）。Flyway 启动时看到现存 schema 但无 schema_history
  会自动 baseline 到 V1，**不执行**本文件 → 兼容已存在的库。真正 schema 改动从 V2__xxx.sql 起。
  RDS 切到 ddl-auto=validate 前需要先把生产 schema mysqldump 出来填入 V1。
- **dev-data gate 用 `matchIfMissing=true`**：不显式配 yaml 也默认开（兼容现有 H2 / unit test 行为）；
  application-mysql.yml 显式 false 才会让生产关掉。`AEP_SEED_DEV_DATA_ENABLED` env 可覆盖。
- **DataInitializer.ensureCelebrityOperatorSeed 也被 gate 一并关掉**。生产环境真的运营人员通过
  admin /admin/celebrity/operators 页面手动给 aep_user 升级 OperatorRole，不再依赖 seeder 兜底。
- **JwtUtil 密钥校验在 Spring 构造 bean 时**（fail-fast 时机正确）；AepCryptoUtil 是 static util，
  校验在 static {} 块通过读 `SPRING_PROFILES_ACTIVE` env 变量 best-effort。systemd `EnvironmentFile`
  形式部署完全覆盖；命令行 `-D` / `--arg` 形式校验会跳过（只剩 dev 警告），不抛假阳性。
- **OSS bucket 必须用内网 endpoint**（`oss-cn-hangzhou-internal.aliyuncs.com`）写到 server.env。
  公网 endpoint 会算流量费 + 增延迟 + 暴露 AK 风险面。
- **RDS 应用账号最小权限**：Flyway 接管前需要 CREATE/ALTER/DROP，落 V1 完整 baseline + 切
  ddl-auto=validate 后可降权为 SELECT/INSERT/UPDATE/DELETE + EXECUTE。
- **deploy.sh 走 rsync + ssh**（轻量、不依赖 CI）；后续容器化 + GitHub Actions 是 Phase 3。
- **未涉及**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、Cookie SSO 跨子域（Phase 5）、
  K8s ACK（Phase 6）、MixcutAsset 上传 OSS 化（Phase 4）。

### v0.32（2026-05-25）— admin 后台「秘钥铸码 UI」+「管理员账号 CRUD UI」补全 + DataInitializer 明文激活码日志

之前 server 端 `/api/admin/license-batches/{id}/mint-keys`（v0.31 落地）和 `/api/admin/staff/**`
endpoints 都可用，但前端没接入：批次新建按钮无 onClick；铸码只能 curl；管理员账号管理无入口。
DataInitializer.seedSampleKeys 在 dev 首启时生成 10 把测试激活码但未打印明文，DB 只存 sha256
→ 想拿明文必须重置 H2 重新种码。

```
server : DataInitializer.seedSampleKeys 改返回 List<String> rawCodes（之前 void）；
       :   两处调用点收集后调 logSeedRawCodes(batch, rawCodes) 用 WARN level 横幅打印
       :   ("⚠️  DEV-SEED LICENSE CODES — DO NOT USE IN PRODUCTION" + 批次名 + 单包点数 + 每码)
       : AepSecurityConfig 新增 .requestMatchers("/api/admin/staff/**").hasRole("SUPER_ADMIN")
       :   排在通用 /api/admin/** hasAnyRole 之前；之前 OPERATOR 也能 CRUD admin 账号（漏洞）

admin  : api/licenses.ts +mintKeys(batchId, count): MintKeysResult；createBatch 入参收紧为
       :   CreateBatchInput record（name / issuerTenantId / initialCreditGrant / totalCount /
       :   validFrom? / validTo?）
       : app/platform/licenses/page.tsx 新建批次按钮接入 CreateBatchDialog（4 字段 + 等级 →
       :   单包点数派生）；批次行追加「铸码」按钮 → MintKeysDialog → 提交后弹 RawCodesDialog
       :   一次性展示明文 + 「复制全部」按钮（用户点「我已保存」关闭后不可恢复）
       :   撤回按钮的 onConfirm 真正接通 revokeKey（之前只弹框无落库）
       : api/staff.ts 新文件 — listStaff / createStaff / updateStaff / deleteStaff；
       :   API 边界把 server 返回的小写 role ("super_admin"/"operator") 归一化为前端约定
       :   大写 ("SUPER_ADMIN"/"OPERATOR")
       : api/index.ts +export * as StaffApi
       : mocks/staff.ts 新文件 — 2 条样本（与 DataInitializer 种子账号对齐）
       : app/platform/staff/page.tsx 新页 — admin_users 列表（搜索 + 角色筛选）+ 新建 +
       :   编辑（含重置密码 / 角色切换 / 状态切换）+ 删除（ActionDialog requireReason）
       : constants/nav.ts 「平台账户」组追加「后台管理员」入口（roles: ["SUPER_ADMIN"]）
       : lib/useAdminRole.ts 顺手修复 — cachedRole = u.role.toUpperCase()（之前 AdminUserDto
       :   返回小写 / 前端约定大写 → role-gated 菜单对真实超管也是隐藏的；v0.30 的
       :   /platform/error-logs gate 之前只在 USE_MOCK=1 时生效）

apps/admin/README.md  : 版本日志 + sidebar 段同步
```

**注意事项**：

- 「明文一次性返回」是核心安全约定：server 只存 sha256_hex；调用方拿到 raw 后负责安全分发（线下 / IM / 邮件 / 工单等）。`RawCodesDialog` 关闭即丢；用户必须主动「复制全部」才能保存。
- `CreateBatchDialog` 提交时**不**自动调 mint-keys —— 批次本身创建时 server 已经预铸 `totalCount` 把 key（沿用 LicenseService.createBatch 既有行为）但这批 key 的明文没暴露。如果新建后想拿明文，要单独点行内「铸码」按钮再多铸 N 把（这是 v0.31 mint-keys endpoint 的设计意图）。
- 单批一次最多 100 把：server `mintKeysAndReturnRawCodes` 已有 1..100 校验；前端 dialog 也加了同样上界，避免请求被 400。
- `/api/admin/staff/**` 安全收紧是破坏性变更：之前 OPERATOR 能调（hasAnyRole），现在只 SUPER_ADMIN（hasRole）。线上没有外部消费方，干净切换。
- DataInitializer 用 WARN level + 横幅故意「在生产意外触发时也极其显眼」：admin_users 表为空 → 误以为是首启 → 跑 seed → 日志里 5 行 WARN「DEV-SEED」立刻让运维发现。
- AdminUserDto.from() 把 role / status enum 转小写 —— 这是当前仓库的 wire 约定（AGENTS.md §4.1「enum 出 wire 时全小写」）。admin 前端约定的 AdminRole = "SUPER_ADMIN" | "OPERATOR" 是历史遗留，v0.32 不动 TS 类型，而是在 API 边界 normalize（`useAdminRole` + `staff.ts.normalize()`）。后续可以 v0.33+ 把 admin TS 类型也改成小写跟其它 enum 一致。
- 当前 admin 自己也能删/降级**自己**的账号（server 无 self-protect 校验）。前端 `handleEdit` 用了 loose `isSelf` 判断禁用删除按钮，但 username == role 这种 hack 判断仅当 username 字段碰巧等于角色名时触发 —— 等同于「无防护」。真正的 self-protect 在 server `AdminStaffController` 里加 `if (id.equals(principal.getName())) throw ...` 才合适，v0.33+ 候选。

### v0.31（2026-05-24）— celebrity 账户体系收口：商品库公共池 / 内嵌运营角色 / 手机号 SMS 登录

一次性把 celebrity 子产品的「数据隔离 + 登录注册 + 运营管理」三件事补齐。背景：审计
发现 `/api/products/**` 完全无认证，匿名能 CRUD；同时只有 dev-login 入口，prod 无
真实登录路径。本节按四块改动组织（独立、可分别理解），最后给统一的配置 / 注意事项。

---

**📋 改动总览**

| 子模块 | 关键改动 |
|---|---|
| **A. 商品库公共池化** | 写动作收归 admin；普通用户只读；按 productId 自动 bump usageCount |
| **B. 内嵌运营角色** | `AepUser.operatorRole` 字段；JWT 透传；web-celebrity 按角色条件渲染写按钮 |
| **C. admin 操作员管理页** | `/admin/celebrity/operators`：list aep_users + 切角色按钮 |
| **D. 手机号 + SMS 登录 / 注册** | LogSmsSender（默认）/ AliyunSmsSender（手撸 REST，零 SDK 依赖）；双因素注册（SMS + License） |

---

#### A. 商品库公共池化（写归 admin）

**审计漏洞**：

1. `/api/products/**` 落在 `AepSecurityConfig` 的 `anyRequest().permitAll()` 兜底
   规则下，匿名用户即可 CRUD 全部商品；
2. `Product` 表无 `ownerUserId` 列，任意登录用户能改 / 删他人引用的商品；
3. `/api/me/products/from-link` / `/api/me/products/{id}/refresh-images` 虽已认证，
   但任意登录用户均可往公共池写入；
4. 商品库前端入口（「新建商品」/「📋 从抖音链接快速建档」/「编辑」/「删除」/
   「刷新图片」）让普通用户自由 CRUD。

**决策**：商品库保持「公共商品池」语义；写动作（CRUD + from-link + refresh-images +
extract-selling-points）全部收归 `/api/admin/products/**`，仅 SUPER_ADMIN / OPERATOR
可调（用户的 operatorRole 也满足，见 B 节）。普通用户只读 + 调
`/me/products/parse-link` 预览（不写库）。

```
server  : ProductsController 精简为只读（GET /api/products + GET /api/products/{id}）
        : AdminProductsController 承载 POST/PATCH/DELETE + extract-selling-points +
          from-link + refresh-images（hasAnyRole 自动继承）
        : ProductLinkController 精简为仅 POST /api/me/products/parse-link
        : AepSecurityConfig +.requestMatchers("/api/products/**").authenticated()
        : ProductService +bumpUsageCountByProductId(productId)
                        +bumpUsageCountByLinkOrName(link, name) — 找不到返回 null
        : MixcutJobService.createInternal 创建任务时按 productId 内部 bump（取代
          v0.28 前端 fire-and-forget /products/upsert-from-generation）
admin   : api/products.ts 全 URL 改 /admin/products；+parseLink / fromLink /
          refreshImages / extractSellingPoints
        : types/product.ts +priceCents / commissionRate / ProductLinkInfo
        : celebrity/products/page.tsx 顶部「从抖音链接建档」+「新建商品」+ 行内
          「编辑」「刷新图片」「删除」+ 两个 dialog
openapi : drop /products POST / PATCH / DELETE / upsert-from-generation /
                extract-selling-points / /me/products/from-link / refresh-images
        : add /admin/products/* 完整 schema
```

**行为变化**：以前用户在生成视频时随手填的商品名会自动沉淀到公共池；v0.31 起
不会。usageCount 仍会 +1，但只覆盖**已存在**的商品（按 productId 精确匹配）。

---

#### B. 内嵌运营角色（AepUser.operatorRole）

**问题**：A 节把商品库写动作锁死在 hasAnyRole(SUPER_ADMIN, OPERATOR) 后，celebrity
端用户即使是平台运营人员，登 web-celebrity 也看不到写按钮 —— 因为他们的 JWT.role
是 STUDIO，且 admin_users 是另一套表。

**决策**：给 `aep_users` 加 `operatorRole` 字段（独立于 admin_users），让 celebrity
体系内部能识别「我是平台运营」。JWT 在 operatorRole 非空时优先用它作 role claim
（命名故意与 AdminUser.AdminRole 对齐 → 同一 role 字符串能复用 hasAnyRole 门禁）。

```
server  : AepUser +operatorRole 列（enum OPERATOR / SUPER_ADMIN, nullable）
        : AepUserDto / MeDto +operatorRole 字段（"operator" / "super_admin" / null）
        : DevAuthController.dev-login + LicenseActivationService.activate +
          SmsAuthController.verify —— operatorRole 非空时作 JWT.role 优先值
        : DataInitializer.ensureCelebrityOperatorSeed 幂等 seed 一个
          celebrity_operator（kind=studio, operatorRole=OPERATOR），dev-login
          下拉可见；老 H2 文件落库环境第一次启动 v0.31 也会自动补这条
shared  : packages/types/src/account.ts AepUser +operatorRole?: OperatorRole | null
        : packages/api-client useAuth() 返回的 user 自带 operatorRole
web-celebrity:
        : api/products.ts 写入 helper（createProduct / updateProduct / deleteProduct /
          parseAndCreateProduct / refreshProductImages / extractSellingPoints）URL 全
          走 /admin/products/**
        : CelebrityProductLibrary / Detail / Form 用 useAuth().user.operatorRole
          条件渲染所有写按钮 + Empty state 文案双态切换
        : 重新挂载 ProductFormDialog / ProductBatchImportDialog（仅 canManage 时）
```

**两套体系对照**：

| 维度 | admin 后台 | celebrity / 用户子产品 |
|---|---|---|
| 用户表 | `admin_users` | `aep_users` |
| 登录端点 | `POST /api/admin/auth/login`（密码） | SMS / dev-login / license 激活 |
| 接入前端 | apps/admin | apps/web-celebrity（及历史 apps/web） |
| 角色字段 | `AdminUser.role` enum | `AepUser.kind` + `AepUser.operatorRole` |
| JWT.role claim | `admin.role.name()` | `operatorRole.name()` 优先；否则 `STUDIO`/`USER` |

**升级粒度**：v0.31 的 operatorRole 是**全局角色**（不分租户）。`Tenant` /
`Membership` 表存在但只做 License 核销归属统计，不做运行时权限切片。

---

#### C. admin 操作员管理页

**问题**：B 节 operatorRole 落库后无 UI 维护，初期靠 H2 console SQL 或重启
DataInitializer 才能给真实用户授权。

```
server  : AdminAepUsersController
            GET  /api/admin/aep-users?q=&hasOperator=
            PATCH /api/admin/aep-users/{id}/operator-role { operatorRole }
admin   : /admin/celebrity/operators 新页面：list + 「运营 / 超管 / 移除」按钮组
        : sidebar「明星带货」组新增「平台运营」入口
        : api/aep-users.ts + types/account.ts +operatorRole
```

⚠️ 当前**允许 OPERATOR 自己改自己 / 改他人**的 operatorRole（继承 hasAnyRole 门禁）。
如要严格「只 SUPER_ADMIN 能授权」，在 PATCH 端点加 `@PreAuthorize("hasRole('SUPER_ADMIN')")`。

---

#### D. 手机号 + SMS 验证码 登录 / 注册（celebrity 主入口）

**问题**：dev-login 仅 dev profile 可用；prod 无任何真实登录入口。

**抽象层**：`SmsSender` 接口 + 两个实现（@ConditionalOnProperty 互斥）：

| Driver | 实现 | 用途 |
|---|---|---|
| `log`（默认） | `LogSmsSender` | 验证码打到 server log（dev / 联调 / 阿里云未备案时占位） |
| `aliyun` | `AliyunSmsSender` | 调阿里云 SMS REST API；**零 SDK 依赖**（手撸 POP RPC 签名 + JDK HttpClient + javax.crypto.Mac.HmacSHA1） |

> 为什么不引 `com.aliyun:dysmsapi20170525` SDK：当前环境 maven mirror 拉不到这个
> artifact。手撸 REST 100 行内搞定且零依赖；后续 mirror 通了想切回 SDK 只需替换
> 这一个文件。

**端点**（全部 permitAll）：

| 端点 | 用途 |
|---|---|
| `POST /api/auth/sms/request-code { phone }` | 发码；返回 `{ sent: true }` |
| `POST /api/auth/sms/verify { phone, code }` | 登录；用户必须已注册；404 USER_NOT_FOUND 引导走 register |
| `POST /api/auth/sms/register { phone, code, licenseKey, studioName, displayName? }` | **双因素注册**：SMS 验证码 + License 激活码同时通过；复用 LicenseActivationService.activate；username 自动 `phone_<手机号>`；phoneVerified=true |
| `POST /api/admin/license-batches/{id}/mint-keys?count=N` | （配套）admin 一次性铸 N 把 key 并**返回 raw codes**（write-once；DB 只存 sha256） |

**SmsCodeService**（in-memory + 节流）：

- ConcurrentHashMap 存 `phone → { code, sentAt, failures, lockedUntil }`
- 60s 速率限制（单 phone）
- 5 次错误自动锁定 30 分钟
- 验证码 5 分钟 TTL；成功后**立即删除** entry（防重放）
- @Scheduled 60s 清理过期 entry

**web-celebrity `/login` 三 tab**：

| tab | 用途 |
|---|---|
| **手机号登录** | phone + 验证码 + 60s 倒计时发码按钮；失败 USER_NOT_FOUND 自动切到注册 |
| **注册** | phone + 验证码 + 激活码 + studioName + displayName? |
| **dev** | 保留原 dev-login 下拉（dev profile only） |

**`packages/api-client/src/api/auth.ts`** 新增 `smsRequestCode` / `smsLogin` / `smsRegister`。

**openapi.yaml**: `/auth/sms/*` 与 `/admin/aep-users/*` 路径全部入 schema。

---

#### 配置（application.yml）

```yaml
aep:
  sms:
    driver: ${AEP_SMS_DRIVER:log}        # log（默认）或 aliyun
    code:
      length: 6
      ttl-seconds: 300                   # 验证码 5 分钟有效
      rate-limit-seconds: 60             # 同 phone 60s 不能重发
      max-failures: 5                    # 错 5 次锁
      lock-seconds: 1800                 # 锁 30 分钟
      # dev 联调专用：driver=log + 非空 才生效；driver=aliyun 时忽略并 WARN
      dev-fixed: ${AEP_SMS_DEV_FIXED_CODE:}
    aliyun:
      access-key-id: ${ALIYUN_SMS_ACCESS_KEY_ID:}
      access-key-secret: ${ALIYUN_SMS_ACCESS_KEY_SECRET:}
      sign-name: ${ALIYUN_SMS_SIGN_NAME:}
      template-code: ${ALIYUN_SMS_TEMPLATE_CODE:}
```

**dev-fixed 双门禁**：必须 `driver=log` + 非空才生效；启动 banner 会 WARN
「DEV-FIXED CODE ENABLED — all phones will receive code=xxxxxx」。配错（非纯数字 /
长度不匹配 code.length）直接 fail-fast。`driver=aliyun` 时 dev-fixed 即使配了也
被忽略并 WARN，防 prod 误开。

**生产切换路径**：
1. 阿里云控制台备案签名 + 创建模板（带 `${code}` 变量）+ RAM 给 SMS FullAccess
2. `export AEP_SMS_DRIVER=aliyun ALIYUN_SMS_*=...`
3. 重启 server，`AliyunSmsSender` bean 注入，`LogSmsSender` 自动停用

---

#### 当前 dev 账号清单

| 账号 | 表 | 登录方式 | JWT.role | 用途 |
|---|---|---|---|---|
| `admin` / `admin123` | admin_users | `/api/admin/auth/login` | SUPER_ADMIN | admin 后台超管 |
| `operator` / `operator123` | admin_users | `/api/admin/auth/login` | OPERATOR | admin 后台运营 |
| `celebrity_operator` | aep_users | `/api/auth/dev-login`（dev免密） | **OPERATOR** | web-celebrity 内嵌运营（管商品库） |
| `creator_luna` | aep_users | dev-login | STUDIO | 普通工作室 |
| `studio_starlight` | aep_users | dev-login | STUDIO | 普通工作室 |
| `agency_moonrise` | aep_users | dev-login | STUDIO | 普通工作室 |

prod 部署时 `dev-login` 关闭（`@ConditionalOnProperty aep.dev-auth.enabled=false`），
DataInitializer 不跑，真实运营账号通过 admin `/celebrity/operators` 页升级。

---

#### 跨节注意事项

- **AepUser.operatorRole 与 admin_users 独立**：两套表不互通，但 JWT.role 字符串
  对齐（OPERATOR / SUPER_ADMIN）→ 同 hasAnyRole 门禁均可通过。
- **operatorRole 变更不会主动 invalidate 旧 JWT**：用户被升级后，旧 JWT 里 role
  还是 STUDIO，要等 JWT 过期（1h）或重新登录才生效。当前是「告知用户重登」；
  改进路径：admin layout 加 setInterval 60s refresh /api/me 检测变化弹 toast；
  长期：Redis token 黑名单（v0.32+ 候选）。
- **SMS 验证码 in-memory**：单实例 ok；多实例 prod 部署前必须换 Redis（验证码 +
  失败次数 + 锁定状态都要共享）。
- **`/auth/sms/verify` 404 时验证码已消费**（防爆破）—— 用户切到注册需重新发码。
- **`/auth/sms/register` username 自动 `phone_<手机号>`**，用户不能自选。
- **`AliyunSmsSender` 手撸签名**：HMAC-SHA1 + Base64 + URL encode；如后续要切回
  SDK，只需替换这一个文件。
- **`AdminProductsController.from-link` 的 userId 语义**：parseAndPersist 内部
  用 userId 给商品图作为 MixcutAsset 注册时打 owner 标记。admin 调用时素材归到
  admin 自己名下；用户从混剪消费走 isOfficial / public 路径，不按 owner 过滤。
- **DataInitializer.ensureCelebrityOperatorSeed 幂等**：按 username 检查，已存在
  跳过。老 H2 文件落库环境第一次启动 v0.31 也能自动补 celebrity_operator。
- **`CelebrityProductSeeder` 保持现状**：seed 6 行商品到公共池无 owner，合理。
- **前端角色门只是 UX 防御**：普通用户绕过 UI 直接 curl /api/admin/products →
  server 端 hasAnyRole 仍会 403。
- **本节不动其他端点**：mixcut / 发布 / 钱包 / 社交账号 等 user 私有数据已按
  ownerUserId 严格隔离（pre-v0.31），无需改动。

### v0.30（2026-05-23）— 混剪任务「重跑」入口（fork 新 job + 缺素材严格阻拦）

用户反馈「生成任务重跑时应该可以用当时的元素和配置重新生成」。诊断：任务态实际**已基本快照化**（v0.25+ 累积），缺的是「重跑入口」+「缺素材保护」。前端原「重新生成」按钮只跳 `/mixcut/create/<template_id>`，丢弃所有 binding 等于从零做。

**设计决策**（用户已确认）：
- 重跑 → **fork 新 job**（带 `forked_from_job_id` 指回原任务，保留 lineage）
- 缺素材 → **严格阻拦**（409 + missing_assets，不让 demo 沉默串进用户预期）
- 可调字段 → **仅 variants + profile**（其它快照原样复用；要换素材请走 create 页）

```
server : MixcutRenderJob +forked_from_job_id (length=64, nullable, 无外键约束)
       : MixcutRenderJobDto +forked_from_job_id
       : 新 MixcutRerunJobRequest(outputVariants?, perturbationProfile?) record
       : 新 MissingAssetItem(slotId, assetId, source, kind) record
       : 新 MissingAssetsException extends RuntimeException, carries List<MissingAssetItem>
       : MixcutJobService 注入 MixcutAssetRepository；create() 抽出 createInternal/createForked
       : 新 MixcutJobService.rerun(originalJobId, principalUserId, overrides):
           - findById + owner 校验（不属于则 404 MIXCUT_JOB_NOT_FOUND，不暴露存在性）
           - collectMissingAssets(slotBindingsJson): 遍历 binding，source∈{upload,library} 且
             带 asset_id 的条目 → assetRepo.findAllById 比对 → 缺失 throw MissingAssetsException
           - 通过 → 构造 MixcutCreateJobRequest（所有快照原样，仅 variants/profile 用 overrides）→ createForked
       : MixcutController +POST /api/mixcut/jobs/{jobId}/rerun（body 可空）
       : GlobalExceptionHandler +@ExceptionHandler(MissingAssetsException.class) → 409，
         body = { error: { code: "MISSING_ASSETS", message, details: { missing_assets: [...] } } }

specs  : openapi.yaml /mixcut/jobs/{jobId}/rerun (POST, tag mixcut, operationId rerunMixcutJob)

web-celebrity:
       : types.ts RenderJob +forked_from_job_id?: string；
         +MixcutRerunJobRequest / +MissingAssetItem 类型
       : api/mixcut.ts +rerunJob(jobId, overrides?): Promise<RenderJob>（USE_LOCAL 克隆 mock job）
       : 新组件 components/mixcut-zone/RerunJobDialog.tsx
           - shadcn Dialog + RadioGroup（来自 @ai-star-eco/ui/ui/*）
           - 两表单字段：output_variants (1-10) + perturbation_profile (light/moderate/aggressive)
           - 提交成功 → router.push(/mixcut/jobs/<new-id>)
           - 错误 409 MISSING_ASSETS → 切错误态视图，列出缺失 slot/asset，
             给「去素材库重传」(/mixcut/library?tab=assets) / 「用模板从头做」
             (/mixcut/create/<templateId>) 两按钮
       : jobs/[id]/job-detail-client.tsx:
           - 顶部 action 区加「重跑」按钮（completed/failed 都显示）
           - 现有「重新生成」按钮改名「换素材重做」→ 跳 create 页（与重跑互补）
           - 头部 status chip 区加「由 #xxxxxx 重跑」徽章（仅当 forked_from_job_id 非空）
```

**注意事项**：

- **不重算** `source_phash`：fork 新 job → 渲染流水线自然算（首段视频 aHash）。
- **不允许覆盖**其它快照字段：rerun 只接 variants + profile；要改 binding 请走 create 页。
- 缺素材检测**只覆盖 source ∈ {upload, library} 且 asset_id 非空**的条目；picgen/input/fixed 不涉及素材表，跳过。
- ApiError.details 字段是 unknown：前端 `(e.details as { missing_assets?: MissingAssetItem[] })?.missing_assets ?? []` 解结构。
- USE_LOCAL（mock）路径**跳过缺素材校验** —— mock 模式没真实 asset 表，直接克隆 mock job + 改 id + 标 forked_from_job_id 返回。要测缺素材态需 NEXT_PUBLIC_MIXCUT_USE_REAL=1。
- 老任务 fork：原 job 的 `slotBindingsJson` 缺 `asset_id`（v0.16 之前 binding 结构）→ collectMissingAssets 跳过 → 不阻拦。会用 file_url / picgen 等 fallback 路径继续渲。
- JPA `ddl-auto=update` 自动加列；H2 dev / MySQL prod 双兼容；不写 flyway/liquibase migration（与 v0.19 加 publishCount / v0.21 加 deletedAt 同惯例）。

**显式 out-of-scope**：sticker_pool 可视化重编、基于 job 预填 create 页 deep link、追加同 job 语义、多实例 ShedLock（rerun 是同步派单，不涉及 @Scheduled）。

### v0.29（2026-05-23）— 混剪主视频按 scene 严格匹配（fix v0.25 盲点）+ 模板预览中性化 + 段时长联动素材

三块独立小改动合并到一节，全部仅 web-celebrity + server，无契约 / DB schema 变更。

**A. 致命 bug 修复：混剪主视频跨段串色（v0.25 漏修）**

v0.25 把场景切分（segCount = scenes.size + per-scene durationSec）和 overlay 时段限制（enable=between(t,a,b)）做了，但 `MixcutRenderingService.renderOneVariant` 的主视频取源仍是平铺 round-robin：

```java
File src = sources.get((variantIndex + i) % sources.size()); // ❌ 跨段串色
```

`resolveBindings` 把所有 user-bound video slot 文件拍平进 `List<File> videos`，丢失了「哪条视频绑给哪个 scene」的归属。结果：

- 用户给 scene 1 绑 A，scene 2 没绑 → `videos=[A]` → 两段都拿 A 不同随机片段 → 视觉上 A 贯穿全片
- 用户 scene 1 绑 A、scene 2 绑 B → variantIndex=1 时取序变成 `[B, A]`

**修复（server 内部重构，无 API 变化）**：

```
server : ResolvedBindings +videoBySlotId: Map<String, File> +demoPool: List<File>
       : resolveBindings 在 VIDEO_LAYERS 分支同时写入 videoBySlotId.put(slotId, local)
       : resolveBindings 始终预填 demoPool（不只是 videos.isEmpty 时），useSceneSchedule
         scene 没绑 video 不能再回退到用户其它 video（会串色），改走 demoPool
       : renderOneVariant 签名 +Map<String, File> videoBySlotId / +List<File> demoPool
       : renderOneVariant 在 segment loop 之前算 perSegSrc[segCount] —— 按 scene.slotIds
         反查 video layer slot → videoBySlotId 取文件；未命中 → demoPool round-robin；
         demoPool 也空 → 最最兜底退回旧 sources round-robin
       : segments_detail 加 video_match 诊断字段：user_slot / demo_fallback / legacy_roundrobin
```

**注意事项**：

- 兜底链严格：未命中的 scene 走 demoPool（与用户视频隔离），永远不回填到用户其它 scene 的 video。这是修复的核心 —— scene 隔离不再被破坏。
- legacy 路径（useSceneSchedule=false，老任务 scenes_snapshot 为空）保持原 round-robin 行为，零回归风险。
- `apps/web/public/videos/showreel-*.mp4` 缺失（极少）→ demoPool 为空 → 退回 sources round-robin（与 v0.25 行为相同，不会比 v0.25 更糟）。
- 无 schema / API / openapi 改动；纯 server 内部逻辑修复。

**B. 模板预览统一中性配色（去除工厂 mock 色噪声）**

模板缩略图（列表 / 首页推荐）+ 模板详情/编辑器 + 创建页四处的 `TemplatePreview`，原本都吃 `template.canvas.background_color`（mock seed 各色不同 → 黄/绿/蓝灰拼盘）+ `BLUEPRINT_LAYER_STYLES` 按 layer_type 上色（sky/emerald/rose/violet），视觉极杂乱。用户无法在创建模板时指定 canvas 色 → 这套染色既无产品意义又拉低视觉一致性。

```
web-celebrity:
  template-preview.tsx
    - 删 canvas style 的 backgroundColor: template.canvas.background_color
      (className 已有 bg-black 兜底；数据真值保留，server ffmpeg 渲 mp4 仍按各模板自身 background_color 走)
    - BLUEPRINT_LAYER_STYLES 抽出 NEUTRAL_BLUEPRINT_FRAME = { bg: white/4%, border: white/30%,
      text: white/80% }，4 个 layer_type 共用同一套描线，仅 icon 字段按类型区分
```

效果：所有预览统一黑底 + 灰白虚线框 + 类型 icon；编辑器内 violet ring 选中态成为唯一彩色高亮，注意力不被无产品语义的颜色干扰。

**C. 模板编辑器：场景时长改动联动 slot.time_range**

`updateScene` 原本是机械合 patch，改场景时长（SceneFlowEditor 输入框 → onChange(idx, { duration: v })）后 slot.time_range 不动，导致：
1. 视觉脱钩（slot 还在老时间格上）
2. 触发 validateTimeRanges 的「结束时间超本场景时长」保存校验失败

```
web-celebrity:
  template-detail-client.tsx
    + rescaleSceneSlots(scene, newDuration) helper —— ratio = new/old 等比例缩放
      所有 slot.time_range，clamp 到 [0, newDuration]；旧时长 ≤ 0 兜底拍平到 [0, new]
    : updateScene 检测 patch.duration !== sc.duration 时先 rescale 再合 patch
  scene-flow-editor.tsx
    + 时长输入框下加一行 hint「改时长后，本段内的素材时长会按比例同步缩放」
```

策略选择：**等比例缩放**而非仅 clamp —— 用户改时长一般是整体节奏调整（"这段做短"），而非"保留前 N 秒砍后面"。要精修单 slot 端点可单独编辑 time_range。

---

## 8. 约定与陷阱（违反会 review reject）

### 跨 app 约定

- **shadcn 原语**：放在 `components/ui/`（apps/web）/ `packages/ui/src/ui/`（共享包）；不要手改，要扩展用 wrapper
- **`"use client"`**：apps/web 所有 `components/*` 都有（历史 Figma-port 修复）；新 client 组件保留
- **新代码 API 形态**：`async function xxx(): Promise<T>`，聚合为 namespace 导出（`MusicApi`, `CelebrityZoneApi`, `MixcutApi`, …）
- **mock 与 api 分工**：组件默认渲染 import mocks，用户动作走 api
- **OffsetDateTime / ISO 8601**：所有时间字段在 wire 上是 ISO 字符串，DB 是 OffsetDateTime（H2 / MySQL 都支持）
- **禁止用浏览器原生 `confirm()` / `alert()` / `prompt()`** ⚠️（v0.23 起强制）。
  - 原因：(1) 浏览器原生样式割裂 + 移动端 H5 上观感极差；(2) 按钮文案不可本地化（Chrome 显示英文 "OK / Cancel"）；(3) 同步阻塞 React render；(4) 缺 ARIA / focus trap / Enter-Esc 默认绑定。
  - 替代方案：
    - 二次确认弹窗 → `apps/web-celebrity/src/components/common/confirm-dialog.tsx` 的 `useConfirm()`（基于 shadcn `AlertDialog`）。Promise-based、可声明 `tone: "danger"`、可注入 ReactNode 描述。
    - 错误提示 → 组件内 inline error / toast（**禁止** `alert(e.message)`）。
    - 输入采集 → 弹一个真正的 `<Dialog>` 带 `<Input>` 表单，不要 `prompt()`。
  - PR review reject 规则：任意 `apps/**/*` 文件出现 `window.confirm` / 裸 `confirm(` / `window.alert` / 裸 `alert(` / `window.prompt` / 裸 `prompt(` 必须改成上述对应组件后才能 merge。
  - 历史欠债：`apps/admin/**` 还有数处 `confirm()` / `alert()` 调用未迁移（v0.23 单独成 backlog item），新代码不能再增加。

### 新代码（packages + web-{music,drama,celebrity}）特有

- **`proxy.ts` 替代 `middleware.ts`**（Next 16）
- **`params` / `searchParams` / `cookies()` / `headers()` 必须 await**
- **route group `(workspace)`** — URL 不出现，仅做布局复用
- **CSS 变量优先**：Creator 主题用 `var(--accent)` / `var(--bg-0)` 等；Tailwind v4 `@theme` 块映射 Tailwind palette
- **不混 npm/pnpm**：新 app 都用 pnpm；遗留 apps/web、apps/admin 沿用 npm

---

## 9. 文档同步纪律（**Strict — agent 必读**）

> 文档 drift 是这个仓库历史上最容易踩的坑（v0.5.4 文档审计：CLAUDE.md / apps/server/README.md 的角色名长达 2 周与代码不一致）。
>
> **每次大版本变更必须把文档作为 commit 的一部分一起改**。"代码先 merge，文档之后补" → **drift 源头，禁止**。

### "大版本"的定义

在 `product_spec*.md` 追加新版本节，或新增 / 修改 / 删除任何 server 实体 / API 路径 / 表结构，即视为大版本。

### 必更新清单（同 commit）

| 触发 | 必同步的文档 |
|---|---|
| 加 / 改 / 删 server 实体或表 | `apps/server/README.md` 数据模型段；`product_spec*.md`；本文件 v 增量节；`docs/INDEX.md` last-reviewed |
| 加 / 改 server 接口路径 | `specs/openapi.yaml`（CI 守门）；`product_spec*.md` 接口节；本文件 v 增量节 |
| 加 / 删子应用页面或大模块 | `apps/<sub-app>/PRODUCT.md` 模块清单；`apps/<sub-app>/README.md` 版本日志 |
| 加 / 删 admin 页面 | `apps/admin/README.md` sidebar 段；`docs/ADMIN_PRODUCT_SPEC.md`（如属新规划） |
| 加 / 改 / 删小程序页面 | `apps/miniprogram/README.md` 版本日志；`product_spec_ai_celebrity.md` 版本节；平台坑同步到 `apps/miniprogram/agent.md` |
| 加新文档 | 同时在 `docs/INDEX.md` 添加一行（含 last-reviewed 日期） |
| 删旧文档 | 先 `git grep -n '<filename>' -- '*.md'` 改指真源；再 `git rm`，依赖 git history 留底 |
| 改环境变量 / 部署需求 | `apps/server/README.md` 环境变量段；`DEPLOYMENT.md` v0.x 部署变更段 |

### 验收

每次 v 升级 commit 之前：

```bash
# 1) 文档与代码一致性
git grep -nE 'PLATFORM_OPERATOR|FINANCE_ADMIN' -- '*.md'   # 0 命中（除非 v0.6+ 真做了拆分）
git grep -nE 'port 300[01]' -- '*.md'                       # 0 命中

# 2) 接口契约
(cd apps/web && npm run check:api-contract)

# 3) 三端编译
(cd apps/web && npx tsc --noEmit) && (cd apps/admin && npx tsc --noEmit) && (cd apps/server && ./mvnw compile -q -o)

# 4) pnpm workspace
pnpm typecheck:all
```

### Staleness check（agent 在引用前的自检）

本文件可能在 commit 之间 drift。引用前先验证真值源：

- **端口** → `apps/<app>/package.json` 的 `dev` 脚本 `-p` flag
- **Admin 角色名** → `apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java` 的 `.hasAnyRole(...)` + `AdminUser.AdminRole` enum
- **种子账号** → `apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java`
- **域清单** → 各 app 的 `src/types/` 目录（不是本文件的快照）
- **路由列表** → 各 app 的 `src/app/` 目录树

如果发现 drift，**同 commit 修两边**。

---

## 10. Pointers — 想查 X 在哪

| 问题 | 答案 |
|---|---|
| 完整文档地图 | [`docs/INDEX.md`](docs/INDEX.md) |
| 后端 API 列表 + schema | [`specs/openapi.yaml`](specs/openapi.yaml) + [`specs/README.md`](specs/README.md) |
| 后端业务规则（校验 / 计算 / 状态机 / 错误码） | [`specs/BUSINESS_RULES.md`](specs/BUSINESS_RULES.md) |
| 数字人/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) |
| 子应用产品功能 / 设计约束 | `apps/<sub-app>/PRODUCT.md` |
| 子应用启动 / 版本日志 | `apps/<sub-app>/README.md` |
| 部署流程 / 生产配置 | `DEPLOYMENT.md` |
| Figma 原型迁移 | [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) |
| 待办 / v0.6 候选 | `TODO.md` |
