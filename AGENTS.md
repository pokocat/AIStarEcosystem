# AGENTS.md

> 给所有 AI coding agent（Claude Code、Cursor、Aider、Continue、自建 SDK agent…）的统一指引。
> Claude Code 仍然通过 `CLAUDE.md` 注入，但 `CLAUDE.md` 是本文件的 symlink —— 只需维护一份。

**Single sources of truth**

| 维度 | 真值文件 | 备注 |
|---|---|---|
| 项目结构 / 工作流 | 本文件（**AGENTS.md**） | 给 agent 看的执行约束 |
| AiAvatar/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) | v2.7（2026-05-06） |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) | v0.5.x 滚动 |
| 后端 API 契约 | [`specs/openapi.yaml`](specs/openapi.yaml) + [`specs/BUSINESS_RULES.md`](specs/BUSINESS_RULES.md) | CI 守门 |
| 子应用产品 / 设计约束 | `apps/<sub-app>/PRODUCT.md` | music / drama / celebrity 各一份 |
| 子应用技术 onboarding | `apps/<sub-app>/README.md` | 启动 / 技术栈 / 版本日志 |
| 完整文档地图 | [`docs/INDEX.md`](docs/INDEX.md) | "我想找 X 在哪" |

**核心信息（避免新 agent 反复翻仓）**：

- 后端 server: Spring Boot 3.3.5 + Java 17，port **8080**，H2 (dev) / MySQL (prod)
- 五个新 web app: **web-music**（3010）/ **web-drama**（3011）/ **web-celebrity**（3012）/ **web-aiavatar**（3013）/ **web-star**（3014，明星商务工作台）
- 遗留 web app: **apps/web**（3002，即将删除）/ 管理后台 **apps/admin**（3003，已升级到 pnpm + Next 16）
- 小程序: **apps/miniprogram**（微信小程序，AI 明星带货线消费方）

---

## 1. 仓库形态 & 进度

### 当前结构

```
Aisingerecosystem/
├── apps/
│   ├── server/             # 后端：Spring Boot 3.3.5 (Java 17) — port 8080
│   ├── web/                # 遗留用户前端：Next.js 14 — port 3002（Phase 5 将删）
│   ├── admin/              # 管理后台：Next.js 16 / React 19 — port 3003（pnpm workspace）
│   ├── miniprogram/        # AI 明星带货 · 微信小程序
│   ├── web-music/          # AI 音乐人（Next 16 / React 19 / Tailwind v4）— port 3010
│   ├── web-drama/          # AI 短剧（同上）— port 3011
│   ├── web-celebrity/      # AI 明星带货（同上）— port 3012
│   ├── web-aiavatar/       # AiAvatar 数字人资产平台（移动端 H5/小程序形态 SPA）— port 3013
│   └── web-star/           # 明星商务工作台（明星/经纪团队审核中枢，浅色主题）— port 3014
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
| **apps/admin 升级** | ✅ | Next 16.2.6 + React 19，纳入 pnpm workspace |

### 技术栈分代（**重要**）

| 代次 | 仓 | 栈 |
|---|---|---|
| 新代码 | `packages/*` + `apps/web-{music,drama,celebrity,star}` + `apps/admin` | Next **16.2.6** + React **19** + Tailwind **v4** + **pnpm** |
| 遗留 | `apps/web` | Next 14.2 + React 18 + npm（不动） |
| 后端 | `apps/server` | Spring Boot 3.3.5 + Java 17 |
| 小程序 | `apps/miniprogram` | 微信小程序原生 |

### Next 16 必知陷阱（新 app 写代码前必读）

- **中间件文件名 `proxy.ts`**（不是 `middleware.ts`，v16 重命名）
- **`cookies()` / `headers()` / `params` / `searchParams` 都是 Promise**，必须 `await`
- 客户端组件读 `params` 用 `use(params)` (React 19) 或拆 server outer + client inner
- 新 app 不属 workspace 时不要混 npm/pnpm；`pnpm-workspace.yaml` 纳入 `packages/*`、四个新 web app、`apps/admin`

### Auth 多域规划

同根域名 + 四子域名（music.aibuzz.cn / drama.aibuzz.cn / celebrity.aibuzz.cn / aiavatar.aibuzz.cn）+ cookie sharing（domain=.aibuzz.cn）。当前 dev/local 走子端口而非子域名。

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

### pnpm workspace app（根目录运行）

```bash
pnpm install                                  # 装所有 workspace 依赖
pnpm dev:music                                # web-music — http://localhost:3010
pnpm dev:drama                                # web-drama — http://localhost:3011
pnpm dev:celebrity                            # web-celebrity — http://localhost:3012
pnpm dev:aiavatar                             # web-aiavatar — http://localhost:3013
pnpm dev:star                                 # web-star — http://localhost:3014
pnpm dev:admin                                # apps/admin — http://localhost:3003

pnpm typecheck:all                            # workspace 一次性 typecheck
pnpm --filter @ai-star-eco/web-celebrity typecheck    # 单个 app typecheck
pnpm --filter @ai-star-eco/web-aiavatar typecheck      # AiAvatar app typecheck
pnpm typecheck:admin                                  # admin typecheck
pnpm --filter @ai-star-eco/web-celebrity build        # 单个 app 生产构建
pnpm --filter @ai-star-eco/web-aiavatar build         # AiAvatar app 生产构建
pnpm --filter @ai-star-eco/admin-new build            # admin 生产构建
```

### 遗留 apps/web（独立 npm）

```bash
cd apps/web                # port 3002
npm install
npm run dev
npx tsc --noEmit
npm run build
npm test                   # vitest
npx vitest run path/to/file.test.ts
```

### 三端编译门（提交前必须全绿）

```bash
(cd apps/web   && npx tsc --noEmit) && \
pnpm typecheck:admin && \
(cd apps/server && ./mvnw compile -q -o) && \
pnpm check:api-contract                          # 扫四个活跃子应用 + api-client（不再扫 apps/web）
```

workspace 额外门：`pnpm typecheck:all`。

---

## 3. 三端架构

### 数据流转

```
┌─────────────┐    rewrite /api/*    ┌──────────────────────────────┐
│  web (3002) │ ──────────────────→ │                              │
│  web-music  │                      │  Spring Boot server :8080   │
│  web-drama  │                      │                              │
│  web-       │                      │  /api/auth/*    permitAll    │
│  celebrity  │                      │  /api/me/*      authenticated │
│  web-       │                      │  /api/aiavatar/health/** permitAll │
│  aiavatar   │                      │  /api/aiavatar/** authenticated │
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
/api/star/**               → authenticated（v0.60 明星商务工作台；controller 按 StarAccount 绑定校验归属）
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

### 4.7 资产存储默认 OSS（v0.47+ 强制）

**所有持久化的「资产 / 文件 / 媒体」（图片、音频、视频、模型文件、PDF、用户上传素材、AI 生成产出等）
在生产环境的真值存储必须是阿里云 OSS**，不再写 ECS 本机文件系统。本机仅作短时临时区
（ffmpeg / Python 子进程中转）+ dev/local 联调 fallback。

**实现规则**：

1. **新增任何资产字段必须经 `CdnUploader`**。新代码不允许直接写 `/data/...` / `./xxx-assets/`
   做长期存储；ECS 本机目录只允许做 ffmpeg 渲染 / Python worker 子进程的临时工作区
   （tmp dir / pre-upload staging），完成后调 `cdnUploader.upload(...)` 推到 OSS，
   DB 存 OSS key + 派生的 CDN URL。

2. **生产用 OSS，dev fallback 本地**。统一靠 `aep.cdn.driver`：
   - `aep.cdn.driver=oss` → 注入 `AliyunOssCdnUploader`，所有 `cdnUploader.upload(...)`
     落 OSS；URL 出 wire 时经 `CdnUrlSigner` 加时效签名（防流量盗刷）。
   - `aep.cdn.driver=local`（默认 / dev / 未配 OSS） → 注入 `LocalFakeCdnUploader`，
     文件落 `./cdn-mock/`，URL 形如 `/cdn/<key>`（server 自带静态 mount）。
     上游业务代码完全不感知差异 —— 这就是 fallback 的实现位置。

3. **生产 server.env 必须**：
   ```
   AEP_CDN_DRIVER=oss
   AEP_CDN_OSS_BUCKET / ENDPOINT / ACCESS_KEY_ID / ACCESS_KEY_SECRET / BASE_URL
   AEP_CDN_OSS_KEY_PREFIX=media               # 多业务共享 bucket 时按前缀隔离
   AEP_CDN_SIGNED_URL_STRATEGY=cdn            # 防 hot-link 流量盗刷
   AEP_CDN_SIGNED_URL_TTL_SECONDS=3600
   AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<...>      # Aliyun CDN URL 鉴权 Type A
   ```
   未配 `AEP_CDN_DRIVER=oss` 的生产实例 = **配置错误**（启动会 WARN，但不阻断；
   线上巡检脚本应将 `aep.cdn.driver=local` 视作部署事故 P1）。

4. **DB 真值是 key，URL 是派生值**（v0.47F+ 强制规则）。
   所有 OSS-bound 资产字段的真值是「OSS object key」，URL 是出 wire 时由
   `CdnUrlSigner.signKey(cdnKey)` 实时构造的派生值，**不**作为 DB 真值。
   - **新增字段必须**：`cdnKey VARCHAR(512) NOT NULL`；不要再加 `cdnUrl` 列
   - **DTO 出 wire**：`signer.signKey(o.getCdnKey())` → 返回签名 URL；signer 失败/NOOP 时
     才退到 fallback（读老 `cdnUrl` 列）
   - **写库**：`cdnUploader.upload(...)` 返回 `CdnUploadResult.key()` 作为真值落库；
     `cdnUrl` 字段在过渡期内可双写但不再依赖
   - **不允许把裸 `https://cdn.xxx.cn/...` 直接塞进 response body** —— 必须经 signer

   收益：driver 切 local↔oss / CDN 域名换 / key-prefix 调整 → DB 零迁移，自动适配。

5. **DTO 出 wire 必经 `CdnUrlSigner`**。所有新增的 DTO 字段如果暴露资产 URL：
   - 在 DTO 工厂方法签名里加 `CdnUrlSigner signer` 参数
   - 优先 `signer.signKey(cdnKey)`（key → 派生 + 签名）；老 row 缺 cdnKey 时
     fallback `signer.maybeSign(storedUrl)`（URL → 抽 key → 重签）
   - 调用方（service）注入 `CdnUrlSigner` Bean
   - 当前已落地：`MixcutRenderOutputDto.from(o, mapper, signer)` 走 cdnKey 优先

6. **现有「local-only」字段必须分阶段迁移到 OSS**（按 §4.7.4 key-only 规则）：
   - `MixcutAsset.fileUrl`（用户上传素材，当前 `/static/mixcut-assets/...` 本地）
   - `MaterialVideoJob.videoUrl`（素材运营生成视频）
   - ~~AiAvatar 数字人资产~~ ✅ 已合规（2026-06-10 审计：dap 域全部走 `FileStorageService`
     —— DB 存 key、`cdn.upload()` 推 CDN、出 wire 经 `storage.signedUrl()` 签名；
     无任何绕过 FileStorageService 的直接文件写入。仓库无 `AiAvatarAsset` 实体，
     真实实体为 `DapAvatar` / `DapLook` / `DapDerivative` 等 `dap_*` 表）
   - `ForgeResult` 视频 URL

   迁移姿势：业务 service 在 `upload(...)` / `save(...)` 时调 `cdnUploader.upload(...)`，
   返回的 `CdnUploadResult.key()` 落 DB 的 `cdnKey` 列；DTO 出 wire 时由 signer 派生 URL。
   旧本地路径字段保留一两版做 fallback 读，然后删。

6. **本地短时临时区必须 gitignored 且不进备份**。当前已 ignore：
   - `apps/server/mixcut-assets/` / `mixcut-output/` / `mixcut-work/`
   - `apps/server/dh-assets/` / `dh-work/`
   - `apps/server/aiavatar-assets/` / `aiavatar-work/`
   - `apps/server/cdn-mock/`（dev fake CDN）

   新增临时目录默认按这条规则 gitignore，**不要 commit 任何资产文件到 git**。

**Review reject 规则**：

- PR 中出现 `Files.copy(... new File("/data/..."))` / `new FileOutputStream("./xxx-assets/...")`
  并把 path 落 DB 当 wire-out URL 用 → review reject，要求改 `cdnUploader.upload(...)`。
- DTO `record` 里直接落 `https://cdn.xxx.cn/...` 字符串且未经 `CdnUrlSigner` →
  review reject，要求改 `signer.signKey(...)` 派生（首选）或 `signer.maybeSign(...)` 重签。
- 新增 entity 加 `cdnUrl` 列（不带 `cdnKey`）→ review reject，要求把 key 列做真值，
  URL 改为 DTO 出 wire 时派生（v0.47F+ key-only 规则，§4.7.4）。
- 配置生产部署但 `AEP_CDN_DRIVER=local` 或缺 `AEP_CDN_SIGNED_URL_STRATEGY` →
  review reject，要求补 OSS 配置。

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

> v2.7 起取消"契约 diff 文档"。drift 由 [`scripts/check-api-contract.mjs`](scripts/check-api-contract.mjs) 守门（**v0.57 起**改扫四个活跃子应用 `web-{music,drama,celebrity,aiavatar}` + `packages/api-client`，方法级匹配；aiavatar 的 `/api/v1` 前缀已处理；不再扫即将废弃的 `apps/web`）—— 任一 `apiFetch(...)` 的 URL/method 在 openapi.yaml 找不到对应 path → gate fail。根目录跑 `pnpm check:api-contract`。

### Step 6 — 四门验证

```bash
(cd apps/web   && npx tsc --noEmit)
(cd apps/admin && npx tsc --noEmit)
(cd apps/server && ./mvnw compile -q -o)
pnpm check:api-contract
```

> 对于 Figma 原型变更（新页面 / 新组件），调 [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) 技能。它把上述六步包成 web → admin → server 同步 SOP。

---

## 6. 四个新 web app 子产品

每个子产品独立 brand / 路由 / 业务领域，但共享 server + 共享 packages 层。

| 子产品 | 路径 | Port | 产品规格 | 设计约束 | 主入口 |
|---|---|---|---|---|---|
| **AI 音乐人** | `apps/web-music/` | 3010 | [`apps/web-music/PRODUCT.md`](apps/web-music/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 短剧** | `apps/web-drama/` | 3011 | [`apps/web-drama/PRODUCT.md`](apps/web-drama/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 明星带货** | `apps/web-celebrity/` | 3012 | [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AiAvatar** | `apps/web-aiavatar/` | 3013 | [`apps/web-aiavatar/README.md`](apps/web-aiavatar/README.md) | [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md) | `/`（移动端 SPA） |
| **明星商务工作台** | `apps/web-star/` | 3014 | [`apps/web-star/PRODUCT.md`](apps/web-star/PRODUCT.md) | 同 PRODUCT.md §4 | `/dashboard`（浅色桌面端） |

前三个业务 app 路由形态一致：

```
/                          ← 公开 landing（ProductLanding，postLoginPath="/dashboard"）
/login                     ← 公开
/activate                  ← 公开
/dashboard …               ← 工作台（route group `(workspace)`，不出现在 URL）
```

详见各 PRODUCT.md。

---

## 7. 版本增量历史

> 详尽的连续多版本增量日志（新实体 / 路由 / 决策 / 注意事项）已拆分到 [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md)。本节仅保留**当前态运营要点**和**最近 5 版的一句话摘要**；查具体版本细节请打开 VERSION_HISTORY.md。

### admin sidebar 启用状态（当前）

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / Finance（含 recharge-packages）/ Notifications / Audit / 平台 > AI 模型 / Prompt 管理 / Agent 平台 / 销售渠道 / 后台管理员 / 账号登录日志 / 充值订单。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

**未完成事项**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、Cookie SSO 跨子域（Phase 5）、K8s ACK（Phase 6）。

### 最近 5 版速览（详情见 VERSION_HISTORY.md）

| 版本 | 日期 | 主题 |
|---|---|---|
| **v0.73** | 2026-06-13 | 抽 skill 飞轮（Recipe MVP·后端抽取核心）：新实体 `DramaRecipe`（`drama_recipes`，payloadJson={mainline,beats[],characters[],hooks[],notes}）+ 抽取器 `DramaRecipeService.extractFromProject`（把爆款 ProjectData 喂新 prompt `drama.recipe_extract` 去具体化蒸馏成可复用配方，落库 status=submitted）+ 端点 `POST /me/drama/projects/{id}/extract-recipe`。§8.0 全守（端点/ prompt 未配、缺大纲、LLM 失败各自带 code）。复用 DRAMA_SCRIPT_DRAFT 端点。`DramaRecipeServiceTest` 5/5。**待续**：运营审核发布 `/admin/drama/recipes*` + web-drama「抽成模板」入口 + 创意库一键套用 |
| **v0.72** | 2026-06-13 | 图像/视频 prompt 服务端化：把 3 处前端写死的出图/出片拼接（`factory.tsx` `shotPrompt`、`epscript.tsx`、`shorts/make`）抽到 server 模板 —— 新增 key `drama.frame_image`/`drama.clip_video`（工作台）+ `drama.short_frame_image`/`drama.short_clip_video`（短视频），单 prompt 无 system。`DramaRenderService.buildMediaPrompt` 按 `body.kind`(shot/short) 选模板 → resolve+fill+清残留占位符，`origin=code`→`PROMPT_NOT_CONFIGURED`。前端 `render.ts` 入参 `prompt`→`{kind,vars}`，三处改传结构化 vars（输出 1:1）。admin `/drama/prompts` 这 4 个 media key 隐藏 system/调参只露模板。路径不变（请求体变，openapi summary 同步） |
| **v0.71** | 2026-06-13 | 短剧工作台 prompt 数据化 + 短剧专区「提示词设置」后台：① `DramaProjectService` 4 段写死 LLM prompt（大纲/整集分场分镜/单场拆镜/选角）抽进统一 `PromptService`，新增 key `drama.{outline,epscript,split_scene,cast}` + resource 默认 `prompts/material/drama.*.md`（占位符 `{{title}}` 等，可选片段 Java 拼 `{{xxxClause}}`，行为 1:1）；4 prompt 共用 `DRAMA_SCRIPT_DRAFT` 端点但各自可配 ② `temperature/maxTokens/jsonMode` 运营可设（留空回落推荐默认 0.9/0.85/0.8/0.9）③ §8.0：prompt 未配置 origin=code → `PROMPT_NOT_CONFIGURED` 不扣费 ④ admin 新页 `/drama/prompts`（复用 `/api/admin/prompts` 按 `drama.*` 过滤 + 参数人性化说明 + 试运行）。无新表/端点。v0.72 待做：图像/视频 prompt 服务端化 |
| **v0.66** | 2026-06-12 | 短剧扣费体验+按集隔离+成片合成：① LLM 动作 server 真扣积分（hold→commit/失败 release，`DRAMA_AI` 流水）+ 小额免打扰（消耗<阈值不弹确认，阈值与各动作单价进 admin 新「短剧专区·个性化配置」，存 PlatformConfig `drama.credit.*`，`GET /me/drama/config` 消费）② `ProjectData.episodeDocs` 按集存档修「切集互相覆盖」③ 「成片配方」退役→「成片合成」（`POST /me/drama/projects/{id}/assemble`：ffmpeg concat 已出片分镜→CDN，复用 mixcut FfmpegRunner）④ 删一键连跑 / 顶栏新建短剧 |
| **v0.65** | 2026-06-12 | 短剧全站接真后端（server 模式所有接口真连，与 mock 完全隔离）：剧集脚本/分场分镜/拆镜/选角 AI（`/me/drama/projects/{id}/epscript,cast`）+ 分镜**首帧图像**渲染（新用途 `IMAGE_GENERATION` → CDN，按次扣积分）+ **直出/动态视频**（复用 MaterialVideoJob，kind=drama-shot，轮询）`/me/drama/render/{frame,clip}` + 分发真后端（`DramaPublishJob`/`DramaPlatformConnection` + `/me/distribution/**` 平台连接/发布任务 @Scheduled 状态机）+ 提现 `CreditService.withdraw` + `/me/wallet/withdraw`。**真模型实测**：agnes-image 出真 720×1280 首帧、agnes-video 真 submit+poll。删死代码 `generation.ts`/旧 distribution 函数 |
| **v0.64** | 2026-06-12 | 短剧「六阶段项目工作台」接真后端：新实体 `DramaProject`（`drama_projects` 表，整套 `ProjectData` JSON-document）+ `DramaProjectService` + `DramaProjectController`（`/api/me/drama/projects*` + `/{id}/outline/ai-draft` 大模型起草分集大纲，复用 `DRAMA_SCRIPT_DRAFT` 端点）；web-drama 列表/新建/工作台加载/保存/大纲 AI 全部从 mock 切真（`ProjectsApi`）。dev 用 `scripts/dev-fake-llm-server.mjs`(:8091) 联调大模型链路 |
| **v0.62** | 2026-06-11 | 明星档案编辑权移交 star 端：web-star 新增 `/profile` 档案设置（14+1 模块）+ `PUT /api/star/profile` + `POST /api/star/profile/uploads`；下线 admin / web-celebrity 运营「编辑明星」入口与 `PUT /admin/celebrity/stars/{id}`（新增/软删保留）；api-client `apiFetch` 支持 FormData |
| **v0.60-补丁** | 2026-06-10 | 收敛 Phase 2 ①：aiavatar 反向「应用于」视图（`GET /v1/avatars/{id}/references` + 详情页 MAppliedTo 卡片，展示数字人被哪些 music/drama 艺人壳引用） |
| **v0.61** | 2026-06-10 | 数字人收敛：music/drama 艺人形象统一引用 AiAvatar（`POST /me/digital-ips/import-avatar` 引入 + `dapDisplayRef` 指定展示图；本地孵化/锻造入口下线） |
| **v0.60** | 2026-06-10 | 第五子应用「明星商务工作台」web-star（3014，浅色主题，13+1 模块）+ `/api/star/**` 域（12 实体）+ celebrity↔star 双端打通（入驻上架明星市场 / 带货授权审批 / 商品报备 6 步入库）+ SubProduct/PlatformSupport 加 `star` 平台 |
| **v0.59** | 2026-06-10 | 账号停用/恢复完整链路（/admin/users/{id}/suspend·reactivate + 审计 + 短信登录补停用闸）+ 消息中心未读角标 + 砍掉重复的 /base/credit-packs 页 |
| **v0.58** | 2026-06-10 | admin 消息中心真实化（NotificationPublisher：充值下单/取消、新用户激活 → 运营收件箱 `__admin__`；核准/驳回 → 用户站内消息）+ 结算中心流水补全（账号登录名/昵称、精确余额、秒级时间、真 CSV 导出） |

> 阅读建议：先看本表定位到目标版本，再到 VERSION_HISTORY.md 全文搜索 `### vX.YY`。

## 8. 约定与陷阱（违反会 review reject）

### 8.0 生产模式禁止静默降级（v0.51+ 强制，全仓适用）

> 背景：dap 占位生成曾出现「未配 AGNES_API_KEY → 默默产出灰底剪影占位图 + 照常扣费」；
> 卖点提取曾「AI 失败 → 默默返回规则模板假文案」。生产环境绝不允许这类行为。

**硬规则**：任何依赖外部服务 / 凭据的业务能力（大模型、OSS、短信、支付、渲染引擎、
sau-service…），当依赖**未配置**或**调用失败**时，在生产 profile（mysql / prod）下
**禁止**自动回退到 mock / 占位产物 / 规则模板 / 本地实现。必须二选一：

1. **启动期 fail-fast**：配置缺失即拒绝启动（如 `JwtUtil` / `AepCryptoUtil` 生产拒绝
   dev 默认密钥；`CdnUrlSigner` strategy=cdn 缺 auth-key 拒启）。适用于「没有它服务
   就不该跑」的硬依赖。
2. **请求期明确报错**：对用户动作抛**带错误码**的 4xx/5xx（如 503 `AI_NOT_CONFIGURED` /
   `DAP_ENGINE_NOT_CONFIGURED`、502 `AI_CALL_FAILED`），且**不扣费、不落假数据**；
   错误文案给出运维指引（去 admin 哪里配什么）。适用于按需使用的能力。

**降级仅允许 dev / 联调**，且必须同时满足四条件：
(a) 显式开关（如 `aep.dap.allow-placeholder`），生产 profile 默认关闭；
(b) 启动 banner 警示（生产 profile 下误开 → ERROR 横幅，如 `LogSmsSender` /
    `LocalFakeCdnUploader` 的 mysql-profile 横幅）；
(c) 降级产物打显式标记（`mock=true` → 前端 MOCK 角标），绝不与真产物混淆；
(d) 联调脚本里显式 export 开关（如 dap-verify.sh `AGNES=none` 路径），不靠默认值。

**允许的例外（仅观测类 best-effort）**：审计日志 / 用量统计 / 发布计数等**旁路写入**
失败时可吞异常仅 WARN（不阻塞业务主链路）；`CdnUrlSigner` 签名失败回退未签名 URL
（可用性优先于防盗刷）。例外仅限「丢观测数据」，**绝不允许**伪造业务产物、跳过扣费
校验或返回假内容。

**Review reject 规则**：
- 新增 `isConfigured() ? 真实现 : 占位实现` 类分支，而占位分支没有生产 profile 门控
  （开关 + 默认关 + ERROR 横幅）→ reject；
- `try { ai调用 } catch { return 模板/规则兜底 }` 把假内容当真产物返回 → reject，
  改为抛带 code 的 BusinessException；
- 新增外部依赖 driver（`xxx.driver=local|log|fake` 形态）但生产 profile 默认值仍是
  fake 形态且无启动横幅 → reject。

**现存门禁 / 开关审计表**（新增依赖时照此登记）：

| 能力 | 未配置时（生产） | dev 降级开关 / 兜底 |
|---|---|---|
| JWT / AES 密钥 | 启动 fail-fast | dev 默认密钥仅 dev profile |
| dap 数字人生成 | 503 DAP_ENGINE_NOT_CONFIGURED（不扣费） | `aep.dap.allow-placeholder`（dev true / mysql false） |
| 文本三件 / 短剧脚本 / 形象锻造 | 503 AI_NOT_CONFIGURED · 502 AI_CALL_FAILED | dev-fake-llm（默认 false，显式开） |
| 素材视频生成 | 503 VIDEO_NOT_CONFIGURED | 同上 |
| 卖点提取 | 同文本三件（v0.51 起删规则模板兜底） | — |
| SMS 验证码 | driver=log 时 mysql profile ERROR 横幅（待运维改 aliyun） | log driver + dev-fixed 双门禁 |
| 资产存储 CDN | driver=local 时 mysql profile ERROR 横幅（P1） | local fake-CDN（dev 默认） |
| dev 免密登录 | `aep.dev-auth.enabled` 默认关 | 显式开 |
| 演示数据 seeder | mysql 默认 `AEP_SEED_DEV_DATA_ENABLED=false` | dev 自动 seed |
| music 形象锻造成片视频 | v0.60 已随形象锻造入口下线（债务以退役方式清除；遗留数据只读） | — |

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
- **不混 npm/pnpm**：workspace app（web-music / web-drama / web-celebrity / web-aiavatar / admin）都用 pnpm；遗留 apps/web 沿用 npm

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
| 改环境变量 / 部署需求 | [`infra/README.md`](infra/README.md)；[`.claude/skills/aliyun-deploy/SKILL.md`](.claude/skills/aliyun-deploy/SKILL.md)；必要时同步 `infra/env/*.env.example` |

### 验收

每次 v 升级 commit 之前：

```bash
# 1) 文档与代码一致性
git grep -nE 'PLATFORM_OPERATOR|FINANCE_ADMIN' -- '*.md'   # 0 命中（除非 v0.6+ 真做了拆分）
git grep -nE 'port 300[01]' -- '*.md'                       # 0 命中

# 2) 接口契约
pnpm check:api-contract

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
| AiAvatar/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) |
| 子应用产品功能 / 设计约束 | `apps/<sub-app>/PRODUCT.md` |
| 子应用启动 / 版本日志 | `apps/<sub-app>/README.md` |
| 部署流程 / 生产配置 | [`infra/README.md`](infra/README.md) + [`.claude/skills/aliyun-deploy/SKILL.md`](.claude/skills/aliyun-deploy/SKILL.md) |
| Figma 原型迁移 | [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) |
| 待办 / v0.6 候选 | `TODO.md` |
