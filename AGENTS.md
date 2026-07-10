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

### 飞书 CLI

- 已配置飞书 CLI app：`cli_aaa471e87738dbdb`（brand: `feishu`）；后续先跑 `lark-cli doctor`，不要重复 `lark-cli config init --new`；禁止记录 `appSecret` / access token / refresh token。

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
- `finance / finance123` — FINANCE_ADMIN（v2 §9 资金面 + 大额复核；dev 由 `ensureFinanceAdminSeed` 幂等补）

> 角色拆分进度：`FINANCE_ADMIN` **已落地**（`AdminUser.AdminRole` enum + `AepSecurityConfig` authority + seed `finance/finance123` + `apps/admin/src/types/account.ts` + **v2 §6 资金财务控制台**：nav `roles` 门控 + `useAdminRole` 归一 + 资金面 controller `@PreAuthorize`）；`PLATFORM_OPERATOR` 仍未拆（暂用 `OPERATOR`）。

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

7. **wholesale JSON 文档（`payloadJson` 等）里的资产 URL 出 wire 必须重签**（v0.98 教训，**强制**）。
   当资产 URL 不是独立 DTO 字段、而是塞在一个整存整取的 JSON 文档里（如 `DramaProject.payloadJson`
   的 `frameUrls` / `videoUrl` / `endFrameUrl` / `lastFrameUrl` / 场景图 / 角色图；`DramaShort` 同理），
   **签名 URL 有 TTL（`AEP_CDN_SIGNED_URL_TTL_SECONDS`，默认 3600s）；存下来原样返回 → 1h 后签名过期
   → 403 图裂**。这类文档字段容易绕过 §4.7.4/§4.7.5（那两条针对 DTO record/列），必须额外守：
   - 文档里存的 URL 一律视为「非真值、会过期」，**禁止**原样 `return`。
   - service 在**出 wire 的唯一漏斗**（如 `toDetail`）里对整棵 JSON **递归 `signer.maybeSign(...)`
     重签所有资产 URL**（`maybeSign` 从 URL 反抽 key 重签，对已过期 URL 同样有效）；driver=local 的
     相对 `/cdn` 路径不匹配 OSS base → 原样返回，dev 不受影响。范式见 `DramaProjectService.resignAssetUrls`。
   - 新代码首选：文档里存 **cdnKey** 而非 URL，出 wire 时 `signer.signKey(key)` 派生。

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
- service 把 `payloadJson` / JSON 文档里存的签名 URL 原样 `return`（未在出 wire 漏斗里
  `signer.maybeSign(...)` 递归重签、或未改存 cdnKey 派生）→ review reject（签名 TTL 过期会图裂，
  v0.98 教训，§4.7.7）。

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

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / **资金财务**（v2 §6：FINANCE_ADMIN 专属 —— `/finance` 控制台 + 充值订单/退款/对账/结算/异常风控/充值套餐，OPERATOR 看不到且后端 403）/ **积分运营**（OPERATOR 可见：调差/赠送）/ Notifications / Audit / 平台 > AI 模型 / Prompt 管理 / Agent 平台 / 销售渠道 / 后台管理员 / 账号登录日志。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

**未完成事项**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、Cookie SSO 跨子域（Phase 5）、K8s ACK（Phase 6）。

### 最近 5 版速览（详情见 VERSION_HISTORY.md）

| 版本 | 日期 | 主题 |
|---|---|---|
| **v0.101** | 2026-07-10 | 短剧一致性引擎 **C-2**（角色/场景实体化 + 多角度参考图集，真源 [`docs/[Fabel5]drama-consistency-engine-design.md`](docs/%5BFabel5%5Ddrama-consistency-engine-design.md) §4）：L0 地基。把散落 `DramaProject.payloadJson` 的角色/场景升级为独立表 **`drama_character` / `drama_scene`**（字段名对齐前端 `CharacterDef`/`SceneAsset`；`ref_images_json`=多角度参考图集 `[{cdnKey,angle,label}]`，真值 cdnKey，出 wire signer 派生 url，软删随项目）。渲染真值改读实体：**懒回填**（`getProject` 前 `ensureBackfilled`，老项目文档→实体，单图 `refCdnKey`→`refImages[0]{front}` 迁移，幂等闸=项目实体行是否存在）+ **双写**（`saveProject` 后 `syncFromDoc`——**§6.1 只 upsert 实体表、不重写 payloadJson**，收敛并发面，增/改名/软删对齐，doc 缺 refImages 保留实体）+ **出 wire overlay**（`toDetail` 把实体 refImages 叠加进文档，前端看到产物）。新端点 **`POST /me/drama/projects/{id}/characters/{charId}/reference-sheet`**（body `{angles?,ratio?,appearanceHint?}` → `{characterId,refImages,cost}`）：复用 `IMAGE_GENERATION`+`drama.character_frame_image`（模板加 `{{angleClause}}` 注角度、锁脸用定妆图），**计费 hold→逐角度 commit**（hold 总额=`drama.credit.frame`×角度数，逐张 commit，部分失败剩余 release，全失败 release 全额+抛错——与 renderFrame 一次性 `debit` 有意分裂，见 TODO 待收敛）；§8.0 preflight 在 hold 前，端点/提示词未配 → 503 不冻结不扣费。类型沿用 drama 本地约定（`mocks/drama-workshop/types.ts`+`api/*`，不进 packages/types）。前端角色卡「一键三视图」按钮+正/侧/全身缩略图墙。门禁：server test-compile + `DramaReferenceAssetServiceTest`(8)/`DramaProjectServiceTest`/`MaterialAiE2ETest`（37 全绿）+ web-drama typecheck/build(31) + `typecheck:all` 8/8 + contract 全绿；openapi 加 reference-sheet 端点。 |
| **v0.100** | 2026-07-10 | 短剧一致性引擎 **D-11**（一用途多候选端点 + capability + 出片模型下拉，真源 [`docs/[Fabel5]drama-consistency-engine-design.md`](docs/%5BFabel5%5Ddrama-consistency-engine-design.md) §3）：把「用途→单端点」升级为「用途→N 候选端点」。**新表** `ai_app_endpoint_candidate`（purpose×endpoint 交点 + capability〔maxRefImages/supportsFirstLastFrame/supportsSubjectReference/maxDurationSec〕+ 单价 override + enabled/sortOrder）；`AiAppBinding` **保持不变**（= 默认端点），`resolveEndpoint(purpose)` 行为零变化；`AiAppCandidateSeeder`（@Order 60）幂等回填现有绑定为置顶候选。`AiModelInvocationService.resolveEndpoint(purpose, endpointId)` 重载（白名单未命中 → 503 `ENDPOINT_NOT_ALLOWED` 不回退默认、不扣费，§8.0）+ `listCandidates`。新端点 `GET /me/drama/render/models`（image+video 候选 + capability + isDefault）；`/render/{frame,clip}` body 加 `endpoint_id`（命中 candidate 单价 override 覆盖用途默认单价，frame debit / clip item credit_cost）。**视频线 endpoint_id 透传**（§6.4 四层串联）：`renderClip` 存 `variant_config` → `MaterialVideoWorker` 抽出 → `MaterialVideoModelClient.pickEndpoint(endpointId)`（`SubmitResult` 带 endpointId，poll 落同一端点）；**celebrity 素材线不传 → 默认端点、默认路径不变**（`MaterialVideoWorkerTest` 回归）。前端 `render-model-select`（分镜表/短视频「出图/出片模型」下拉，替代 v0.98 假下拉，候选≤1 不渲染、能力进 hover、宽度防溢出）+ admin「候选端点与能力」编辑块（禁用原生 confirm）。门禁：server test-compile + 单测（`AiModelInvocationServiceTest`+6 / `AiAppCandidateSeederTest` 2 / `DramaRenderServiceTest`+2 非法 endpoint_id→503 且 0 扣费 / `MaterialAiE2ETest`+`MaterialVideoModelClientTest` 回归）+ web-drama typecheck/build + `typecheck:all` 10/10 + `typecheck:admin` + contract 全绿；openapi 加 `/render/models`、`/admin/ai-app-bindings/{purpose}/candidates[/{endpointId}]`。 |
| **v0.99** | 2026-07-10 | 短剧一致性引擎 **C-1**（末帧 CDN 镜像 + 参考生效回报，真源 [`docs/[Fabel5]drama-consistency-engine-design.md`](docs/%5BFabel5%5Ddrama-consistency-engine-design.md) §2，修审计 G-6）：① `MaterialVideoJob` 新列 `lastFrameCdnKey`（§4.7.4 真值），worker 成功分支把上游临时末帧（seedance `return_last_frame`）镜像到 CDN（`material-videos/<jobId>/last-frame.*`），链式承接不过期；镜像失败 = best-effort（§8.0 观测类旁路例外）仅 WARN + 保留上游 URL，绝不 markFailed / 退积分。② `toCard` 注入 `CdnUrlSigner`：`last_frame_url` = `signKey(lastFrameCdnKey)` fallback `maybeSign(lastFrameUrl)`；**范围选择**：`video_url`/`thumbnail_url` 仅 `maybeSign` 兜底（local 零影响），完整 URL→key 迁移留独立 PR。③ `/render/{frame,clip}` 返回体加 `applied_refs`（`{requested,applied,items[{role,url,applied,reason}]}`，reason=`local_unfetchable`/`model_no_flf`…；C-1 frame 的 `ref_images` 统一 role=`ref`，精确槽位待 C-3；clip 首尾帧标准确 role，末帧按端点静态协议判定 agnes 无尾帧）。④ 前端 `renderFrame` 返回体 → `{frames,cost,appliedRefs}`；`FormShot`/`BoardShot` 加 `appliedRefs` round-trip；分镜表首帧格「参考 N/M 生效」chip（仅部分生效时显示，定宽+ellipsis，原因放 hover，不暴露内部枚举）。门禁：test-compile + 单测 21 + 回归 29 + web-drama typecheck/build + contract 全绿（无新 path，两 summary 更新）。 |
| **v0.98** | 2026-06-30 | 短剧工作台收敛为「剧集脚本分镜表 = 唯一逐镜工作面」（真源 [`docs/drama-storyboard-consistency.md`](docs/drama-storyboard-consistency.md)）：项目 6 阶段 → **5 阶段**（删独立「视频工厂」，逐镜出片全在剧集脚本分镜表内）。**Epic-1** 抽 `use-shot-render` 共享渲染引擎。**Epic-2** 脚本分镜表升级为强渲染面：`FormShot` 补 cast/camId/首尾帧/拆镜字段并 round-trip（修 sfx/bgm/fx 回读丢字段）；首帧格加 4 版挑选 + AI 拆镜 + 首帧▷末帧双联 + hover 预演（P3 aha）+ 镜间一致性承接开关。**Epic-3** 删 factory 阶段/抽屉/源码（`stages-config` 去 factory，成片合成前移为剧集第 2 步）。**P1** epscript 不再 lock、脚本始终可编辑（CTA 改「保存·去成片合成」）。**P5** 删左下 AI 浮窗（`ai-chat-panel`），改分镜表行级 Wand2 就地改写本镜（新端点 `POST /me/drama/projects/{id}/shot/rewrite` + `drama.shot_rewrite` + `drama.credit.shot-rewrite`；整篇重写仍在顶部）。**P6** 短视频面包屑按 pathname 派生 + beat 改 AI 逐镜生成（去写死）。**P4** 假模型下拉随工厂删除已消失（§8.0 不再有假选项）；真·多模型（一用途多候选端点 + 按模型计费，改共享 `AiAppBinding`）拆独立 PR（TODO D-11）。门禁：server compile（Central 镜像）+ web-drama typecheck/build（30 路由）+ contract 全绿；openapi 加 `/shot/decompose`、`/shot/rewrite`、clip 加 `last_frame_url`。 |
| **v0.97** | 2026-06-30 | 短剧分镜一致性优化（借鉴 [ViMax](https://github.com/HKUDS/ViMax)，真源 [`docs/drama-storyboard-consistency.md`](docs/drama-storyboard-consistency.md)）：一致性靠视觉生成层（参考图复用 + 关键帧锚定 + 镜间链式参考），非 storyboard 文本。**P0** 镜间承接：`factory.tsx` 出首帧 `ref_images`=角色参考图+场景参考图+同场上一镜画面（成片真实末帧优先），「镜间一致性承接」开关 + 「场景参考绑定」面板（`BoardScene.sceneRefId` 显式 + 名称兜底）；纯前端零契约（`ref_images` 管道早已通到 `extra_body.image`）。**P1** `drama.epscript`/`drama.split_scene` 补电影语言规则（叙事目的/机位复用/画面位置/摄像机vs画面内运动）+ `BoardShot.camId` + `normalizeShot` 透传。**P2** `MaterialVideoModelClient.PROTOCOL_SEEDANCE`（火山方舟 content 数组 first/last_frame + `return_last_frame` + `/contents/generations/tasks`）+ GENERIC 补 image/end_image（修复 seedance 落 GENERIC 连首帧都没传）；`MaterialVideoJob.lastFrameUrl`→任务卡→前端 `BoardShot.lastFrameUrl` 链式承接闭环；新节点 `drama.decompose`（`POST /me/drama/projects/{id}/shot/decompose` + `drama.credit.decompose`=3，单镜→ff/lf/motion/variation + 角色名校验，§8.0 未配 503 不扣费）。下游不支持首尾帧→字段忽略不报错（§8.0 传入不生效≠静默伪造）。门禁：server 35/35 + `typecheck:all` 10/10 + web-drama build(31 路由) + contract 全绿；openapi 加 `/shot/decompose`、clip 加 `last_frame_url`。 |
| **v0.94** | 2026-06-29 | 支付多渠道直连（删 jeepay 聚合 + 微信支付 V3 直连 + 运行时 admin 可配 + 用户收银台自选）：① 删休眠的 jeepay 网关/验签/回调+测试，清理全仓引用。② 新 `PaymentChannelConfig`（`aep_payment_channels`，机密 AES-GCM 加密）+ `PaymentChannelConfigService`/`PaymentChannelCatalog`/`PaymentGatewayRegistry`；网关去 `@ConditionalOnProperty` 改运行时按渠道选（Alipay 惰性重配全局 Factory；Shadow 由 `aep.payment.shadow.enabled` 门控）；`PaymentService`/`PaymentReconcileService` 按渠道路由；env 仅 bootstrap 种子。③ `WechatPaymentGateway`（`wechatpay-java` 0.2.15：Native/JSAPI/H5 + 查单）+ `WechatNotifyController`（V3 验签+AES-GCM 解密+幂等 settle）。④ admin「资金财务 · 支付配置」页（渠道启用/沙箱/机密运行时配，机密脱敏，自检）。⑤ 收银台前端动态拉渠道、用户自选，按 payDataType 渲染（表单/本地二维码/跳转/影子）。入账幂等不变（`settlePaidOrder` 条件 UPDATE）；机密缺失 → 503 不回退（§8.0）。门禁：支付单测 8 类全绿 + `typecheck:all` 10/10 + celebrity/drama build(+vitest 35) + contract；openapi 加 channels/wechat-notify/admin-payment、删 jeepay-notify。 |
| **v0.88** | 2026-06-28 | 短剧工作台对齐设计稿（全栈 · 所有渲染数据后端读取 · 所有编辑落库草稿态）：① **短剧设定单页**（合并 选题/大纲/角色场景，左轨两步 短剧设定/剧集工作台）—— 场景升级为后端持久化 `ProjectData.scenes`（promote 时由大纲「取景参考」预填；name/mood 可编辑、生成参考图、加/删，落库），大纲 AI 参数 `outlinePrefs{scope,dur}` 落库。② **剧集脚本 平铺分镜表**（新 `StoryboardTable`：镜号/时长/首帧/画面内容/镜头/台词·音频[台词+音效+BGM]/特效氛围，**每格结构化可编辑→喂视频生成提示词**；`BoardShot` 加结构化 `sfx/bgm/fx`），本集叙事/作品风格/出场人物落库 `episodeDocs[ep].meta`（此前仅内存即丢）。③ **首帧 AI 改图弹窗**（左指令对话+右 9:16 预览+版本号，复用 `/me/drama/render/frame` + ref 图迭代回填落库）。④ **短视频 `/shorts/make` 单页化**（去 脚本/工厂 步骤切换 → 单页：左口播对话 / 右 短视频大纲[口播种草+beat 流] + 分镜脚本逐镜内联出片；`meta.style` 可编辑落库；每镜 beat 标签）。后端：`seedProjectData` 加 `scenes`/`outlinePrefs`、`normalizeShot` 加 `sfx/bgm/fx`、`DramaBrainstormService.promote` 预填 scenes —— 均在 wholesale `payloadJson` 文档内，无新端点。`dev-fake-llm` 图像端点出可见占位图（出图/参考图/改图链路通）。门禁：`typecheck:all` 10/10 + web-drama build（29 路由）+ contract + **74 drama 单测**全绿；**真实 server+fake-llm CDP 浏览器可视验收**（首页脑暴 / 短剧设定 / 分镜表 / AI 改图 截图）+ **持久化 API E2E**（场景/参数/本集 meta/结构化 sfx-bgm-fx 落库恢复全过）。 |
| **v0.87** | 2026-06-28 | 首页「跟 AI 聊出故事」脑暴链路（按设计稿 `AI短剧工作台.dc.html` 还原 首页→对话→剧本/分镜生成 整链）：**立项之前的可恢复草稿** —— 新实体 `DramaBrainstorm`（`drama_brainstorms` 表，`payloadJson`=BrainstormData{`messages[]`,`outline`,`settings{form,ratio,episodes}`}）+ `DramaBrainstormService`/`Controller`（`/api/me/drama/brainstorms/**`：CRUD + `/chat` AI 对话 + `/outline` 生成故事大纲 + `/promote` 去制作）。AI 对话/大纲**免费**（复用 `DRAMA_SCRIPT_DRAFT` 端点 + 新 prompt key `drama.brainstorm_{chat,outline}`，§8.0 未配置 503 不产假数据）；chat/outline **不落库**（前端合并后 PUT 自动保存，与 outline/epscript AI 同惯例，防前后端并发覆盖）。「去制作」按形态 promote：series→`createProject`（免费立项，预填 `characters` from 大纲 roles）/ single→`createShort`（扣 short-entry），脑暴标 `promoted`（幂等）。前端：`api/brainstorm.ts`（TS 契约真源）+ 重建 `/dashboard`（chatOff 落地：一句话输入+近期热点+开始脑暴+爆款配方+继续脑暴；chatOn `?b=<id>`：左 AI 脑暴对话 / 右可编辑故事大纲→去制作；防抖自动保存、刷新可恢复）。门禁：server **74 drama 单测**（含 `DramaBrainstormServiceTest` 15）+ `typecheck:all` 10/10 + web-drama build（29 路由）+ contract 全绿；**真实 server + fake-llm API 级 E2E 24 断言**（dev-login→脑暴→对话→大纲→落库→恢复→promote 项目/单片→真实实体 + 幂等）。openapi 加 6 path stub；`dev-fake-llm-server.mjs` 加脑暴 chat/outline 分支。 |
| **v0.86** | 2026-06-27 | admin 财务工作台辨识用户身份：充值订单 + 结算中心（钱包·流水·业务交易三 Tab）+ 充值核准弹窗 + 对账 CSV 展示用户**手机号**（与登录名分列）。四个财务 DTO（`RechargeOrderDto`/`WalletDto`/`LedgerEntryDto`/`TransactionDto`）加 `phone`，沿用 v0.58 read-time 回填（`owner.getPhone()`；`listForAdmin` 批量 `usersByIds`）—— **无新表 / 无快照列**、旧订单也显示、手机号最新；用户自查 owner=null 省略（`@JsonInclude.NON_NULL`）。前端 `packages/types` + admin `types/{wallet,finance,recharge-order}` 加 `phone?`，`ledger` `AccountCell` 三 Tab + `recharge-orders` 用户列/确认弹窗 + CSV 展示。门禁：server test-compile + 42 单测（RechargeService 16/CreditOps 15/AlipayNotify 5/PayNotify 6）+ typecheck:all（10/10）+ contract 全绿；openapi 四 schema 加 phone。充值套餐同期改：不再 seed（删 `seedRechargePackages`），上线纯靠 admin 后台配置；celebrity/drama 卡片价格按钮底部对齐修复。 |
| **v0.84** | 2026-06-22 | 验证码登录未注册时免重输验证码（注册凭证 register ticket）：手机号验证码登录通过但未注册 → 切到注册填激活码时不必再输一遍验证码。根因①`SmsCodeService.verifyCode` 成功即销毁码（防重放）②发码绑定 `purpose`，登录码无法用于注册校验——故带旧码无用。方案：`JwtUtil.generateRegisterTicket(phone)`/`verifyRegisterTicket`（HMAC 签名 `typ=sms-register`，TTL 10 分钟）；`POST /auth/sms/verify` 未注册时签发凭证放进 404 `error.details={registerTicket,phone}`；`POST /auth/sms/register` 加可选 `registerTicket`，带有效凭证且手机号一致 → 跳过短信码校验，否则走原验证码路径，凭证无效/过期且未退回手输 → 401 `REGISTER_TICKET_EXPIRED`。前端三处登录页（web-celebrity 独立 / 共享 `landing/AuthScreen`(music+drama) / web-aiavatar `screen-login`）：登录捕获 `USER_NOT_FOUND` 取 `details` 切注册页预填手机号（只读）+「✓ 手机号已验证」替换验证码框，提交带凭证，过期回退手输；手动点注册 tab 走全新流程。api-client `SmsRegisterPayload.code` 改可选+加 `registerTicket?`。门禁：server compile + `JwtUtilTest` 5/5 + `SmsAuthControllerTest` 10/10（含**端到端 happy path**：未注册→短信登录拿凭证→带该凭证激活码注册登录成功；+ 登录-未注册/已注册 + 注册带凭证跳验码/无凭证走验码/凭证无效回退/手机号不符 401/缺激活码/已注册冲突/验码失败；**SMS 发码验码全 mock**）+ web-{celebrity,aiavatar,music,drama} typecheck + contract 全绿。契约：`sms/register` 加 `registerTicket`/`code` 改可选/`platform` enum 补 `aiavatar`/加 401。 |
| **v0.79** | 2026-06-15 | 互动剧（剧情互动短剧）集成进短剧工坊（不另起炉灶）：互动剧 = `DramaProject` 的形态（`mode=interactive`），**不是独立实体**——剧集（图节点）即项目大纲分集，**每集仍走六阶段「剧集脚本→视频工厂→成片合成」**（单集 AI 出脚本/分镜/出片全复用），分支编排叠加在 `ProjectData.interactive`（`{enabled,startEpisodeId,globalFlags,nodes:{epId→{interactions[],nextVideoId,isEnding,endingLabel}}}`，无新表）。① 新阶段 `stages/branch.tsx`「互动编排」（`scope=互动`，仅互动剧项目左轨显示）：自绘 SVG 分支图（BFS 分层 + 选项连线标文案 + 起始/结局/孤立高亮 + 拉线接分支）+ 图/列表双视图 + 单集时间轴互动点编辑（触发秒·选择/输入/倒计时·条件·选项→目标集+`setFlags`）+ 全局标记 + 结构校验 + 试玩走查 + 导出；点节点「去制作这一集」`dispatch setEp+jump epscript` 进六阶段。② `lib/interactive-types.ts`（契约真源）+ `lib/interactive-graph.ts`（BFS 可达性/校验/`buildStoryConfig` 导出 + `projectToStory`/`writeStoryToProject`/`defaultOverlay` 适配器；story 每集 `videoUrl/durationSec` 取自 `episodeDocs[no].assembled` 成片）。③ 两入口：新建对话框「互动剧」开关（`mode=interactive`，直落互动编排）/ 既有线性短剧左轨「转换为互动剧」（`defaultOverlay` 铺线性链）。④ AI 起草整张图：新端点 `POST /me/drama/projects/{id}/interactive/draft`（复用 `DRAMA_SCRIPT_DRAFT` + 新提示词 `drama.interactive_draft`，§8.0 未配置→503 不扣费；单价 `drama.credit.interactive-draft` 默认 18），返回 `{episodes,interactive}` 未落库前端合并存。⑤ 导出 Story Config v2（校验通过才可下发抖音/TikTok 播放器：起点可达/选项接线齐/有可达结局/`triggerTime≤成片时长`/标记先声明）。**删**前版独立实现（`DramaInteractive` 实体+repo+svc+controller+test、`/interactive` 路由+api+mocks、`drama.interactive_clip_video`、侧栏一级入口）。门禁：web-drama typecheck/build(27 路由) + typecheck:admin + server compile + contract 全绿；server drama 51/51（`DramaProjectServiceTest` 16，含 3 互动剧）；真机全链路验收通过 |
| **v0.78** | 2026-06-14 | 统一 TipTap 输入组件 + 短视频新建流程重做（去重 + 引用 chip + 进工作台真扣费）：① 新建复用组件 `DramaComposer`（`@tiptap/*@2.27`，`immediatelyRender:false` 适配 Next 16 SSR）—「引用 chip 托盘 + 富文本正文」，`ComposerRef{kind,...}`+`COMPOSER_REF_META` 注册表（加类型只动一处），命令式 `setText/focus/clear`、回车提交、输入法合成中不拦截；本版先接入短视频新建，余 20+ 输入后续迁。② 短视频新建去重：新建 `ShortCreateConsole`（`variant=home|standalone`）为短视频创建唯一真源（创意市场**单集创意** `listPublished` 过滤 `episodes≤1` + 对话框 + 给我灵感 + 开始制作），首页短视频 tab 与 `/shorts/new` 都复用它，**删 `short-create-dialog.tsx`**（写死 `SHORT_FORMATS`、非创意中心的重复实现）；短/剧共用的 `recipe*` 预览工具抽到 `recipe-preview.ts`。③ 交互：点创意卡 → 预览弹窗下方**只一个「试试同款」**→ 以引用 chip 进对话框（可再补主题）→ 开始制作进工厂，自由主题经 `sessionStorage` 注入创意草稿，工厂据「创意风格 + 你的主题」起草。④ **进工作台真扣费**：原首页「10」只是确认弹窗展示数字、进工作台不真扣（`createShort` 无 CreditService、`aiDraft` 出脚本也免费，仅逐镜出图/片收费）→ 现「新建草稿 = 进工作台」走后端真扣一笔 `drama.credit.short-entry`（默认 10，admin「短剧专区」可配，`withEntryCharge` hold→commit，refType `DRAMA_SHORT`；重开已有草稿不计费），`createShort` + `createFromRecipe` 各计一次。门禁：server drama 48/48（`DramaShortServiceTest` 8）+ typecheck:admin + contract + web-drama typecheck/vitest 28/28/build 全绿 |
| **v0.77** | 2026-06-14 | 创意市场「套用」按单 / 多集分流（路径不变，仅响应体）：`DramaRecipeService.applyToNewProject`→`applyRecipe`，多集（&gt;1）→ 六阶段 `DramaProject` `{kind:"project",projectId}`，单集（≤1，如官方 19 条风格短片）→ `DramaShort` 草稿 `{kind:"short",shortId}`（`createFromRecipe` 把说明+主线蒸成 `styleRef`/`styleName`，不套短视频模版）。前端按 `kind` 分跳 `/shorts/make?draft=` / `/projects/{id}` |
| **v0.76** | 2026-06-13 | 短剧 / 短视频制作支持「草稿」（做到一半刷新/返回/换设备都能接着做）：① 短视频制作此前**零持久化**（`/shorts/make` 整页纯 React 内存态，刷新即丢）→ 新实体 `DramaShort`（`drama_shorts` 表，ddl-auto 建；整页编辑态 `payloadJson`=ShortDraftData{step,meta,shots[],chat[],refs}，列表核心列回算 title/durationSec/shotCount/doneCount/progress/status）+ `DramaShortService`/`DramaShortController`（`/api/me/drama/shorts/**` CRUD，属主隔离 + 软删）。前端 `/shorts/make` 进页即建/读草稿（id 入 URL）+ 防抖自动保存 + 「合成成片」标 done；`/shorts` 列表改读真后端草稿卡。② 短剧大纲此前**漏存**（调序/加一集/手改梗概都不落库，只 AI 生成 / 锁定才存）→ outline 调序 / 加一集 / 钩子梗概行内编辑全部即时落库。③ 共用 `useSaveStatus`（「保存中 / 已自动保存」指示器 + 离开提醒兜底）。新 8 文件 + `DramaShortServiceTest` 4/4 + 全链路真机浏览器验收（短视频建→编辑→刷新恢复；短剧加一集→刷新仍在）。**版本号注**：本特性原在并行分支 `competent-cartwright` 记 v0.74，并入本线后顺延 **v0.76**（v0.74/0.75 已被「官方配方 seeder / 创意市场」占用） |
| **v0.75** | 2026-06-13 | 模板库 →「创意市场」（官方内置 + 用户发布统一，基于已发布 `DramaRecipe`）+ 子页「我发布的创意」。双通道入市（用户决策「两者都要」）：① 用户自助（「抽成模板」改名「发布到创意市场」→submitted→运营审核）② 运营从用户作品精选（`GET /candidates` 跨用户池 → `POST /invite` 蒸馏成 `invited`+站内信 → 作者 `POST /{id}/respond`{approve} → published/consentAt 或 declined）③ 运营手建内置（`POST /builtin` → origin=official 直接发布）。`DramaRecipe` 加列 `authorName`/`invitedBy`/`consentAt`，status 增 `invited`\|`declined`，origin 增 `featured`；`distillAndSave` 公共蒸馏 + `resolveAuthorName`(AepUserRepository) + `NotificationPublisher` 旁路站内信。前端：创意市场网格（源标 官方/来自@xx + scope/题材/搜索 + 套用开拍）、`/templates/published` 我发布的创意（状态分档 + invited 授权/谢绝）、**工坊删「创意库·爆款模板」块**（删 `RecipeLibrarySection`，只在新建时选）、侧栏「创意市场+我发布的创意」二级 + 戏服与道具/脚本工坊/多平台分发「建设中」标。门禁 server 32/32（`DramaRecipeServiceTest` 19/19）+ contract + web-drama typecheck/build 全绿，真机浏览器全链路验收通过 |
| **v0.74** | 2026-06-13 | 官方内置配方 seeder：`DramaRecipeSeeder`(@Order 72) 声明式幂等 upsert `resources/seed/drama-recipes-official.json`（19 条 origin=official / owner=`__official__` / 直接 published，按 id 更新内容保留 useCount+createdAt）；`DramaRecipe` 加 `coverImage` 列（官方真实预览图 `/recipes/<id>.webp` 落 web-drama/public，空则回退 cover 渐变） |
| **v0.73** | 2026-06-13 | 抽 skill 飞轮（Recipe MVP，全链路通）：新实体 `DramaRecipe`（`drama_recipes`，payloadJson={mainline,beats[],characters[],hooks[],notes}）；抽取器 `DramaRecipeService`（爆款 ProjectData 喂 `drama.recipe_extract` 去具体化蒸馏；+listPublished/listForReview/publish/reject/applyToNewProject）；`DramaRecipeController`（`/me/drama/recipes/**`，运营 review/publish/reject 走 `requireOperator`，**在 web-drama 运营后台不进 admin**）。前端：`/operations` 配方审核（operatorRole 可见）+ 已完成项目「抽成模板」+ `/projects` 创意库一键套用（预填新项目 mainline+分集骨架，mode=template）。§8.0 全守。`DramaRecipeServiceTest` 10/10 + 全链路真机浏览器验收通过（抽取→审核发布→套用→新项目）。`SEED_VERSION`→v7 |
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
| 支付渠道（v0.94 多渠道）| 渠道启用但机密缺失 → 下单/回调期 503 PAYMENT_CHANNEL_NOT_CONFIGURED（不入账、不回退）；机密走 admin 后台「支付配置」DB（加密），env 仅 bootstrap | shadow 影子渠道 `aep.payment.shadow.enabled`（dev true / mysql false，启用打 ERROR 横幅） |
| dev 免密登录 | `aep.dev-auth.enabled` 默认关 | 显式开 |
| 演示数据 seeder | mysql 默认 `AEP_SEED_DEV_DATA_ENABLED=false` | dev 自动 seed |
| music 形象锻造成片视频 | v0.60 已随形象锻造入口下线（债务以退役方式清除；遗留数据只读） | — |

### 跨 app 约定

- **UI 文案：用户友好 + 不溢出** ⚠️（v0.98 起强制，全前端适用；所有将来变更都要遵守）。
  - **用户友好**：界面可见文字必须是终端用户看得懂的话，**禁止暴露内部黑话 / 字段名 / 枚举原值**（如 `variation_type`=small/medium/large、`ff/lf`/首末帧内部叫法、`frameLocked`、`flow`、技术 id、后端错误码原文等）。用业务语言表达；技术细节放 hover `title` / 说明里，不要塞进主可视文案。
  - **不溢出**：任何可能变长或宽度受限的可视文字（表格单元格、卡片、标签、chip、按钮、徽标），必须约束宽度并防溢出——`maxWidth` +（父级）`minWidth:0` + `overflow:hidden` + `textOverflow:"ellipsis"`（单行）或允许换行；超出部分进 `title`/tooltip。不要假设文字一定短。
  - **反例**：`已出末帧 · 变化小`（暴露「变化」黑话 + `whiteSpace:nowrap` 无溢出兜底）。**正例**：可视 `首尾帧就绪`（定宽 + ellipsis），「运动幅度：小幅/中幅/大幅 + 运动描述」放 hover `title`。
  - Review reject：新增/改动 UI 出现内部黑话可视文案，或宽度受限处的可变长文字没做溢出约束 → reject。
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
| **完成 / 搁置 / 新发现任一待办，或审计发现 TODO 与代码 drift** | **`TODO.md`（与产品说明、版本历史同等纪律，同 commit 改）** —— 详见下「TODO.md 维护纪律」 |

#### TODO.md 维护纪律（**Strict**）

`TODO.md` 是「已定位但未修的问题 + 候选排期」的真源，和 `product_spec*.md` / `apps/*/README.md` 版本日志一样，**必须随代码同 commit 维护**，不允许「修完代码 TODO 不勾」。规则：

- **完成一个待办** → 把对应条目改成 `- [x] ~~标题~~`（删除线），后接「**vX.YY 完成 / 已澄清**，YYYY-MM-DD」+ 一句落地说明（关键实体 / 端点 / 测试）。**不要删除条目**（保留可追溯）。
- **审计发现 TODO 与代码不符**（描述过时 / 其实早已做） → 同样标 `[x]` 并注「**审计确认**，YYYY-MM-DD：原描述过时，实际……」。本轮 v0.80 就发现 engine-pricing / operator 自授权 / recharge 三条已过时——**先核对真源再动手，避免照过时清单白做**。
- **新发现一个待办**（顺手定位但本轮不修） → 按主题段追加 `- [ ]`，带精确定位（`file:符号` / 错误码 / 触发条件），不要只写一句模糊描述。
- **降优先级 / 改判**（如「非漏洞，可后置」） → 保留 `[ ]` 但在标题后加判定 + 日期 + 理由，别让后人重复评估。
- 条目按现有主题段归并（持久化 / 安全 / sau-service / 通知 …），不要散落到版本日志里被忘掉。

### 验收

每次 v 升级 commit 之前：

```bash
# 0) TODO.md 已随本次改动维护？（完成项已勾 [x] + 注 vX.YY/日期；过时项已改正；新待办已追加）
git diff --name-only | grep -q '^TODO.md$' || echo '⚠️ 本次若动了待办相关代码，确认 TODO.md 是否需要同 commit 更新'

# 1) 文档与代码一致性
git grep -nE 'PLATFORM_OPERATOR' -- '*.md'                  # 0 命中（FINANCE_ADMIN 已拆分落地，docs 提及它不再算 drift）
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
