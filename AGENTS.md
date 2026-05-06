# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Repository Overview

**AI Star Eco** — AI 虚拟艺人孵化与发行平台。三种用户角色：Fan（粉丝）、Producer（制作人）、Coach（掌门人/MCN）。平台包含用户前端、管理后台、后端服务三端，数据模型完整对齐。

***

## Monorepo Structure

```
Aisingerecosystem/
├── apps/
│   ├── server/          # 后端: Spring Boot 3.3.5 (Java 17) — port 8080
│   ├── web/             # 用户前端: Next.js 14 (TypeScript) — port 3000
│   └── admin/           # 管理后台: Next.js 14 (TypeScript) — port 3001
├── figma/               # ⚠️ Figma Make 导出的原型代码（非正式应用代码）
└── .claude/
    └── skills/
        └── figma-migrate/SKILL.md   # Figma → 三端迁移技能文档
```

> **重要**: `figma/` 目录是 Figma Make 的一次性导出，仅供 UI 原型参考。所有正式代码在 `apps/` 下。

***

## 三端数据流转架构

```
┌─────────────┐    rewrite /api/*    ┌──────────────────────────────┐
│  web        │ ──────────────────→ │                              │
│  :3000      │  proxy               │  Spring Boot server :8080   │
│  用户前端    │                      │                              │
└─────────────┘                      │  /api/me/*      (用户自身)   │
                                     │  /api/auth/*    (鉴权)       │
┌─────────────┐    rewrite /api/*    │  /api/admin/*   (管理端)     │
│  admin      │ ──────────────────→ │  /api/singers/* (legacy)     │
│  :3001      │  proxy               │  /api/tracks/*  (legacy)     │
│  管理后台    │                      │                              │
└─────────────┘                      └──────────────────────────────┘
```

- web 用户端接口：`/api/me/*`（登录用户自己的数据）
- admin 管理端接口：`/api/admin/*`（全平台数据 CRUD，需 SUPER_ADMIN / OPERATOR 角色）
- 两端通过 `next.config.mjs` rewrites 代理到后端
- 认证：Spring Security + JWT（JJWT 0.12.6），无状态 session

### Mock / Live 切换

两个前端均通过 `.env.local` 的 `NEXT_PUBLIC_USE_MOCK` 控制：
- `=1`：纯前端开发，使用 `mocks/` 静态数据
- `=0`：前后端联调，调用真实后端 API

***

## 领域模型完整对齐表（20 个领域）

每个领域在三端的文件位置：

| 领域 | web types | web api | web mocks | admin types | admin api | admin mocks | server model | server dto | server controller |
|------|-----------|---------|-----------|-------------|-----------|-------------|-------------|-----------|-------------------|
| account | ✅ | ✅ | ✅ | ✅ (+AdminUser) | ✅ users | ✅ | AepUser, AdminUser | ✅ | AccountController, AdminUserController |
| artist (DigitalIp) | ✅ | ✅ | ✅ | ✅ | ✅ digital-ips | ✅ | DigitalIp | ✅ | AdminDigitalIpController |
| wallet / ledger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Wallet, LedgerEntry | ✅ | AdminCreditController |
| license | ✅ | ✅ auth | — | ✅ | ✅ | ✅ | LicenseBatch, LicenseKey | ✅ | AdminLicenseController |
| studio | ✅ | — | — | ✅ (AdminStudio) | ✅ | ✅ | Studio | StudioDto, AdminStudioDto | AdminTenantController |
| auth | ✅ | ✅ | — | ✅ | ✅ | — | — | — | AdminAuthController, LicenseActivationController |
| audit | — | — | — | ✅ | ✅ | ✅ | AuditLog | ✅ | AdminAuditController |
| notification | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Notification | ✅ | AdminNotificationController |
| music | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Song, Album, Concert, MusicGenre | ✅ | AdminMusicController |
| film | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Drama, Movie, Advertisement, VoiceWork | ✅ | AdminFilmController |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | SignedArtist, DistributionQueueItem, CopyrightItem | ✅ | AdminCoachController |
| fan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — (view DTOs) | ✅ | AdminFanController |
| community | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | FanTier, FanGrowthPoint, FanActivity, CommunityEvent | ✅ | AdminCommunityController |
| distribution | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Platform, DistributionContent | ✅ | AdminDistributionController |
| finance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — (view DTOs from LedgerEntry) | ✅ | AdminFinanceController |
| settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | CreditPack, RechargeRecord | ✅ | AdminSettingsController |
| wardrobe | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | WardrobeItem (legacy) | ✅ | — (legacy) |
| pose/expr/gesture | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Pose, Expression, Gesture (legacy) | ✅ | — (legacy) |
| appearance-forge | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ForgeTemplate, ForgeResult | ✅ | AdminForgeController |
| stats | — | — | — | — | ✅ | — | — | AdminStatsDto | AdminStatsController |

***

## apps/server — Spring Boot 后端

### 启动命令

```bash
cd apps/server
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # 开发模式 (H2)
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql  # MySQL 模式
./mvnw compile -q -o                                      # 编译检查（离线）
./mvnw test                                               # 运行测试
```

### 技术栈

- **Spring Boot 3.3.5** + **Java 17**
- **Spring Data JPA** + **Hibernate** (ddl-auto: update)
- **Spring Security** + **JWT** (JJWT 0.12.6) — 无状态认证
- **H2** (开发) / **MySQL** (生产)
- **Lombok** — 减少样板代码
- **Jackson** — JSON 序列化（default-property-inclusion: non_null）

### 包结构

```
com.aistareco/
├── AiStarEcoApplication.java
├── common/
│   ├── ApiResponse.java           # { success: true, data: T, message? }
│   ├── StringListConverter.java   # JPA: List<String> ↔ TEXT (JSON)
│   └── GlobalExceptionHandler.java
├── config/
│   └── CorsConfig.java           # CORS (localhost:* + credentials)
├── controller/                    # Legacy 控制器 (singers, tracks, marketplace, nft)
├── model/                         # Legacy JPA 实体
├── dto/                           # Legacy DTOs
└── aep/                           # ★ AEP 平台（新架构）
    ├── config/
    │   ├── AepSecurityConfig.java     # Security filter chain + JWT
    │   └── JwtAuthenticationFilter.java
    ├── model/                     # 33 个 JPA 实体
    ├── dto/                       # 50 个 DTO records
    ├── repository/                # 33 个 JPA 仓储
    ├── service/                   # 业务逻辑层
    └── controller/                # 21 个 REST 控制器
```

### API 响应格式

**普通接口**（包在 `ApiResponse` 里）：
```json
{ "success": true, "data": <T>, "message": null }
```

**分页接口**（直接返回 `PageEnvelope`，不嵌套 `ApiResponse`）：
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 0, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false }
}
```

### 安全模型

```
/api/auth/**          → permitAll（注册/激活）
/api/admin/auth/login → permitAll（管理员登录）
/api/me/**            → authenticated（需 JWT）
/api/admin/**         → hasRole(SUPER_ADMIN, OPERATOR)
其他                   → permitAll
```

### DTO 命名规则

DTO record 的字段名**必须与前端 TypeScript interface 完全一致**。Java model 字段可以不同，由 `from()` 方法做映射：

```java
// Model: description → DTO: desc
// Model: artistName  → DTO: artist
// Model: contentType → DTO: type
// Enum: POST_PRODUCTION → wire: "post-production"（含连字符用 wire 模式）
```

***

## apps/web — 用户前端

### 启动命令

```bash
cd apps/web
npm install
npm run dev        # 开发服务器 port 3000
npx tsc --noEmit   # 类型检查
npm run build      # 生产构建
```

### 技术栈

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix UI)
- **Recharts** — 图表
- **Lucide React** — 图标
- **Motion (Framer Motion)** — 动画

### 目录结构

```
apps/web/src/
├── types/           # 20 个领域类型文件（唯一事实源）
│   ├── _shared.ts   # ID, ISODateTime, Rarity, Money, ApiResponse, PaginationMeta
│   ├── artist.ts    # Artist, ArtistStats, TalentProfile
│   ├── account.ts   # AepUser, Tenant, Membership
│   ├── wallet.ts    # Wallet, LedgerEntry
│   ├── music.ts     # Song, Album, Concert, MusicGenre
│   ├── film.ts      # Drama, Movie, Advertisement, VoiceWork
│   └── ...          # 其余 14 个领域
├── mocks/           # 静态样本数据（USE_MOCK=1 时使用）
├── api/             # API 封装层（USE_MOCK 开关切换 mock/live）
│   ├── _client.ts   # apiFetch + USE_MOCK + mockDelay
│   ├── account.ts   # /me, /me/wallet, /me/ledger
│   ├── artists.ts   # /me/digital-ips
│   ├── auth.ts      # /auth/activate
│   └── ...          # 其余领域
├── constants/       # UI 配置（图标/颜色/文案映射）
├── components/      # 业务组件
│   ├── ui/          # shadcn/ui 原子组件（勿直接修改）
│   └── producer/    # 制作人面板组件
│       └── dashboard/  # 经纪大盘 / 艺人视图（v2.5 拆分）
│           ├── hooks/  # use-producer-dashboard
│           ├── charts/ # TypeDistributionPie / RevenueAreaChart / StatusDistribution / RevenueSourcePie
│           ├── roster/ # ArtistMatrixGrid / TopPerformersTable
│           ├── AgencyOverview.tsx  # 经纪大盘（公司视角）
│           └── ArtistOverview.tsx  # 艺人视图（个体视角）
├── lib/
│   └── format.ts    # 统一格式化（formatCredits, formatCompactNumber, formatDuration）
└── app/             # Next.js App Router 路由
```

### 数值字段规范

所有数值字段存**原始整数**，展示时由 `lib/format.ts` 格式化：
- `fans: 128_000` → `formatCompactNumber()` → `"128K"`
- `revenue: 452_000` → `formatCredits()` → `"452,000"`
- `priceCents: 9_900` → `formatCurrency()` → `"¥99.00"`

**严禁**在类型定义中使用预格式化字符串（如 `fans: "128K"`）。

***

## apps/admin — 管理后台

### 启动命令

```bash
cd apps/admin
npm install
npm run dev -- -p 3001   # 开发服务器 port 3001
npx tsc --noEmit         # 类型检查
```

### 技术栈

与 web 相同（Next.js 14 + TypeScript + Tailwind + shadcn/ui）。UI 风格为浅色数据密集型管理界面。

### 目录结构

```
apps/admin/src/
├── types/           # 21 个领域类型文件（与 web 一致 + audit.ts）
├── mocks/           # 管理视图样本数据（可含 userId 等管理字段）
├── api/             # 22 个 API 文件（路径用 /admin/... 前缀）
│   ├── _client.ts   # 与 web 相同的 apiFetch 底座
│   ├── users.ts     # /admin/users
│   ├── digital-ips.ts  # /admin/digital-ips
│   ├── licenses.ts  # /admin/license-batches, /admin/license-keys
│   ├── audit.ts     # /admin/audit-logs
│   └── ...          # 其余领域
├── components/      # 管理组件
├── constants/       # 状态/枚举配置
└── app/             # 路由页面
    ├── page.tsx             # Dashboard 首页
    ├── artists/             # 艺人管理
    │   ├── roster/          # 花名册
    │   └── lifecycle/       # 生命周期
    ├── platform/            # 平台管理
    │   ├── users/           # 用户列表
    │   ├── tenants/         # 机构管理
    │   ├── studios/         # 工作室管理
    │   └── licenses/        # License 管理
    ├── content/             # 内容管理
    ├── finance/             # 财务管理
    ├── monetization/        # 变现管理
    └── base/                # 基础数据
```

### admin 与 web 的类型关系

- admin 的 types 文件与 web **完全一致**（直接复制）
- admin 独有的扩展类型用 `interface AdminXxx extends Xxx`（如 `AdminStudio extends Studio`）
- admin 独有的类型放在单独文件中（如 `audit.ts`、`AdminUser` in `account.ts`）

***

## 关键约定

### 数据模型对齐规则

1. **三端同步**：web 新增/变更任何领域类型，必须同步到 admin 和 server
2. **admin 覆盖 web 所有领域**：admin 是 web 的管理后台，web 的所有数据都需要在 admin 里管理
3. **DTO 字段名 = 前端 TS 字段名**：server DTO 的 record 字段必须与前端 interface 完全一致
4. **数值存原始整数**：`number` 不是 `string`，格式化在展示层完成
5. **enum 小写**：Java enum `ACTIVE` → DTO 输出 `"active"`；含连字符的用 wire 模式

### 新增领域 SOP

当需要新增一个领域 `<domain>` 时，必须按以下顺序操作（顺序很重要：前端真值源先定，后端再 mirror，契约文档最后同步）。

#### 第 1 步：前端真值源

```
web/src/types/<domain>.ts          ← 类型定义（唯一事实源）
web/src/mocks/<domain>.ts          ← 样本数据（USE_MOCK 模式回退）
web/src/constants/<domain>-ui.ts   ← UI 配置（图标 / 颜色 / 标签）
```

#### 第 2 步：前端调用层

```
web/src/api/<domain>.ts            ← apiFetch + USE_MOCK 开关；返回类型 = TS 接口
web/src/api/index.ts               ← 追加 export * as XxxApi
```

#### 第 3 步：后端 mirror（按 web/src/types/<domain>.ts 字段名严格复刻）

```
server/.../aep/model/<Entity>.java               ← JPA 实体
server/.../aep/dto/<Entity>Dto.java              ← DTO record，字段名必须与 TS 完全一致
server/.../aep/repository/<Entity>Repository.java  ← 仓储
server/.../aep/controller/<Domain>Controller.java  ← REST 端点（用户域用 /me/**；管理域用 /admin/**）
```

#### 第 4 步：admin 镜像（与 web 接口完全相同的类型，路径前缀 /admin/）

```
admin/src/types/<domain>.ts        ← 与 web 同名同字段（直接复制；admin 专属字段以 AdminXxx 扩展）
admin/src/mocks/<domain>.ts        ← 管理视图样本
admin/src/api/<domain>.ts          ← apiFetch URL 用 /admin/...
admin/src/api/index.ts             ← 追加 export
```

#### 第 5 步：契约文档（强制；CI 校验）

```
specs/openapi.yaml                 ← 在 components.schemas 加 schema、在 paths 加 path
specs/BUSINESS_RULES.md            ← （可选）若有非平凡业务规则（扣费、状态机、跨字段约束）
```

> 不要再写「契约 diff 文档」—— v2.7 起这套被废弃。drift 由 CI 守护：

#### 第 6 步：本地验证（必须全绿才能提交）

```bash
(cd apps/web && npx tsc --noEmit)             # web 类型门
(cd apps/admin && npx tsc --noEmit)           # admin 类型门
(cd apps/server && ./mvnw compile -q -o)      # server 类型门
(cd apps/web && npm run check:api-contract)   # apiFetch URL ↔ openapi.yaml paths 漂移校验
```

> 实现细节见 `apps/web/scripts/check-api-contract.mjs`。任一前端 `apiFetch` URL 在 openapi.yaml 找不到对应 path 时，gate fail。

### 编译验证

```bash
cd apps/web && npx tsc --noEmit       # web 类型检查
cd apps/admin && npx tsc --noEmit     # admin 类型检查
cd apps/server && ./mvnw compile -q -o # server 编译
```

三端必须全部零错误。

### 其他约定

- **API 响应壳**：成功 `{ success: true, data: T }`；分页用 `PageEnvelope`（不嵌套 `ApiResponse`）
- **不可直接改余额**：所有积分变动必须经过 `LedgerEntry`（不可变账本），禁止直接更新余额字段
- **所有权检查**：`/api/me/*` 端点必须校验 `ownerUserId == currentUser.id`
- **中文单语**：前端文案全部中文，删除 `{ zh: 'X', en: 'Y' }` 字典和 `lang === 'zh' ? ... : ...` 三元
- **组件直读 mocks**：组件直接 `import { DATA } from "@/mocks/xxx"`，不在 UI 路径调 API 层（避免 USE_MOCK=0 时 404）
- **迁移技能**：Figma 原型变更时，按 `.claude/skills/figma-migrate/SKILL.md` 执行三端同步
