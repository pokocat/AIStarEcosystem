# AI Star Eco Server

> 线上部署、增量发布 SOP、`/static/videos` 共享静态资源说明，以及本地联调方式见 [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)。

Spring Boot 后端服务，承载账户注册、权益管理、许可证（秘钥）、积分钱包、审计日志等核心业务。

## 技术栈

| 组件 | 版本 |
|------|------|
| Java | 17 |
| Spring Boot | 3.3.5 |
| Spring Security | JWT (JJWT 0.12.6) + BCrypt |
| ORM | Spring Data JPA / Hibernate |
| 数据库 | H2（本地开发） / MySQL 8（生产） |
| 构建 | Maven |
| 端口 | 8080 |

## 快速启动

### 本地开发（默认，无需数据库）

```bash
cd apps/server
mvn spring-boot:run
```

默认激活 `dev` profile，使用 **H2 内存数据库**（`MODE=MySQL` 兼容模式）。启动即用，每次重启自动 seed 种子数据。

启动后可访问：
- API: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console（JDBC URL: `jdbc:h2:mem:aistareco`，用户名 `sa`，密码留空）

### MySQL 环境

```bash
# 1. 建库
mysql -u root -p -e "CREATE DATABASE aistareco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 启动（指定 mysql profile）
mvn spring-boot:run -Dspring.profiles.active=mysql
```

MySQL 默认连接配置（可在 `application-mysql.yml` 中修改）：

| 参数 | 默认值 |
|------|--------|
| host | localhost:3306 |
| database | aistareco |
| username | root |
| password | root |
| charset | utf8mb4 |
| timezone | Asia/Shanghai |

`ddl-auto: update` 会自动建表，首次启动后 `DataInitializer` 会自动写入种子数据。

## Profile 配置说明

| 文件 | 用途 |
|------|------|
| `application.yml` | 公共配置（端口、JPA、Jackson、JWT、日志） |
| `application-dev.yml` | H2 内存数据库，本地开发默认激活 |
| `application-mysql.yml` | MySQL 数据源，联调/生产使用 |

切换方式：

```bash
# 方式一：命令行参数
mvn spring-boot:run -Dspring.profiles.active=mysql

# 方式二：环境变量
export SPRING_PROFILES_ACTIVE=mysql
mvn spring-boot:run

# 方式三：修改 application.yml 中的 spring.profiles.active
```

## 认证体系

### 管理员登录

管理后台（`apps/admin`）通过用户名密码登录，仅允许以下角色访问：

| 角色 | 说明 |
|------|------|
| `PLATFORM_OPERATOR` | 系统管理员，拥有所有数据操作权限 |
| `FINANCE_ADMIN` | 财务管理员，拥有所有数据操作权限 |

开发环境默认账户：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | PLATFORM_OPERATOR |
| `finance` | `finance123` | FINANCE_ADMIN |

登录流程：`POST /api/admin/auth/login` -> 返回 JWT Token -> 前端存储并在后续请求中通过 `Authorization: Bearer <token>` 传递。

### 用户注册（秘钥激活）

普通用户通过秘钥（License Key）激活注册，不需要密码：

```
POST /api/auth/activate
Content-Type: application/json

{
  "code": "原始秘钥明文",
  "username": "用户名",
  "email": "可选",
  "phone": "可选"
}
```

激活流程：秘钥 SHA-256 匹配 -> 校验状态 -> 创建用户 + 租户 + 钱包 + 权益 -> 激活秘钥 -> 返回 JWT Token。

秘钥来源：
- **后台导入**：管理员通过 `POST /api/admin/license-batches` 创建批次，自动生成秘钥
- **外部 CRM 对接**：预留 `channelPartnerId` 字段，后续实现同步

## API 端点

以 `/api/admin/**` 为前缀的接口对齐 `apps/admin` 运营后台；`/api/**`（不含 `admin/`）给终端用户使用（`apps/web`）。列表响应走 `PageEnvelope`，单体响应走 `ApiResponse`，见 product_spec.md §6.4。

### 公开端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录（用户名/密码 → JWT） |
| POST | `/api/auth/activate` | 用户侧秘钥激活注册 |

### 管理后台（需 Bearer Token，PLATFORM_OPERATOR / FINANCE_ADMIN）

#### 平台账户 / 权益

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/auth/me` | 当前登录管理员信息 |
| GET | `/api/admin/stats` | 仪表盘统计（用户/作品/收益聚合） |
| GET · POST · PUT · PATCH · DELETE | `/api/admin/users/**` | `AepUser` CRUD；`GET /{id}/wallet`；`POST /{id}/credits/adjust` 调账 |
| GET · POST · PUT · PATCH | `/api/admin/tenants/**` | `Tenant` 列表 / 创建 / 更新 |
| GET | `/api/admin/memberships` | `Membership` 列表，支持 `?tenantId` / `?userId` 过滤 |
| GET · POST · PUT · PATCH | `/api/admin/studios/**` | `Studio` CRUD；`GET` 返回 `AdminStudioDto`（含聚合指标） |
| GET | `/api/admin/license-batches` | 秘钥批次列表 |
| POST | `/api/admin/license-batches` | 新建批次 |
| GET | `/api/admin/license-batches/{id}/keys` | 批次下的秘钥 |
| GET | `/api/admin/license-keys` | 秘钥全局列表（支持 `batchId` / `status`） |
| PUT | `/api/admin/license-keys/{id}/revoke` | 吊销秘钥 |

#### 财务 / 钱包

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/wallets` | 钱包列表（`WalletDto`） |
| GET | `/api/admin/wallets/{userId}` | 按用户查钱包 |
| GET | `/api/admin/ledger-entries` | 点数流水，支持 `walletId` / `userId` 过滤 |
| GET | `/api/admin/finance/transactions` | 业务交易（由 `LedgerEntry` 派生，见 product_spec §9.7） |
| GET | `/api/admin/finance/revenue/monthly` | 近 6 月入账趋势 |
| GET | `/api/admin/finance/revenue/sources` | 入账来源饼图 |

#### 内容 / IP / 分发

| 方法 | 路径 | 说明 |
|------|------|------|
| GET · POST · PUT · PATCH · DELETE | `/api/admin/digital-ips/**` | AI 艺人档案 |
| GET · POST | `/api/admin/music/songs`<br>`POST /songs/{id}/approve`<br>`POST /songs/{id}/reject` | 歌曲管理 + 人工复核 |
| GET | `/api/admin/music/albums` · `/concerts` · `/genres` | 专辑 / 演唱会 / 曲风 |
| GET · POST · PUT | `/api/admin/film/**` | 短剧 / 电影 / 广告 / 配音 |
| GET · POST · PUT | `/api/admin/distribution/**` | 渠道接入与发行队列 |
| GET · POST · DELETE | `/api/admin/store/**` | NFT / 点数包 / 商品 |
| GET · POST · PUT | `/api/admin/community/**` | 动态 / 活动审核 |
| GET · POST | `/api/admin/fan/**` | 粉丝域（档案/等级/活动） |
| GET · POST | `/api/admin/coach/**` | 教练与培训 |
| GET · POST | `/api/admin/appearance-forge/**` | 形象工坊模板 / 蓝图 |

#### 平台配置 / 审计 / 消息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET · POST · PUT | `/api/admin/settings/**` | 平台设置 |
| GET · POST · PUT | `/api/admin/platform-configs/**` | 键值配置项 |
| GET | `/api/admin/audit-logs` | 审计日志 |
| GET | `/api/admin/notifications` | 运营推送 |
| GET · POST · DELETE | `/api/admin/staff/**` | 后台运营账号（P2） |

> 响应约定：分页接口返回 `{ success, data, pagination }`（`PageEnvelope`）；其余返回 `{ success, data }`（`ApiResponse`）。前端 `apiFetch` 只解 `data`。

## 项目结构

```
src/main/java/com/aistareco/aep/
├── AiStarEcoApplication.java              # 入口
├── config/
│   ├── AepSecurityConfig.java             # Spring Security 配置
│   ├── JwtUtil.java                       # JWT 生成/验证
│   ├── JwtAuthenticationFilter.java       # JWT 过滤器
│   └── DataInitializer.java               # 种子数据
├── controller/                            # REST 控制器
│   ├── AdminAuthController.java           # 管理员认证
│   ├── AdminStatsController.java          # 仪表盘统计
│   ├── AdminUserController.java           # 平台账号
│   ├── AdminTenantController.java         # 机构
│   ├── AdminMembershipController.java     # 用户-机构归属（只读列表）
│   ├── AdminStudioController.java         # 业务主体（含聚合指标）
│   ├── AdminLicenseController.java        # 秘钥批次 / 单码
│   ├── AdminCreditController.java         # 钱包 / 点数流水
│   ├── AdminFinanceController.java        # 业务交易 / 入账趋势 / 来源饼图
│   ├── AdminDigitalIpController.java      # AI 艺人档案
│   ├── AdminMusicController.java          # 歌曲 / 专辑 / 演唱会
│   ├── AdminFilmController.java           # 短剧 / 电影 / 广告 / 配音
│   ├── AdminDistributionController.java   # 分发渠道 / 队列
│   ├── AdminStoreController.java          # NFT / 商品
│   ├── AdminCommunityController.java      # 动态 / 活动审核
│   ├── AdminFanController.java            # 粉丝域
│   ├── AdminCoachController.java          # 教练
│   ├── AdminForgeController.java          # 形象工坊
│   ├── AdminSettingsController.java       # 平台设置
│   ├── AdminPlatformConfigController.java # 配置键值
│   ├── AdminAuditController.java          # 审计日志
│   ├── AdminNotificationController.java   # 运营推送
│   ├── AdminStaffController.java          # 运营账号
│   └── LicenseActivationController.java   # 秘钥激活（公开）
├── model/         # JPA 实体（AepUser / Tenant / Membership / Studio / LicenseBatch / LicenseKey / Wallet / LedgerEntry / DigitalIp / Song / ...）
├── repository/    # Spring Data JPA 仓库
├── service/       # 业务逻辑层（StudioService / TenantService / LicenseService / CreditService / AdminFinanceService / ...）
└── dto/           # 传输对象（含 PageEnvelope / ApiResponse）
```

## 数据模型

### 角色体系

| 角色 | 类型 | 说明 |
|------|------|------|
| `PLATFORM_OPERATOR` | 系统管理员 | 所有数据操作权限，管理后台登录 |
| `FINANCE_ADMIN` | 系统管理员 | 所有数据操作权限，管理后台登录 |
| `PRODUCER` | 普通用户 | 制作人，通过秘钥注册 |
| `COACH` | 普通用户 | 掌门人，通过秘钥注册 |
| `FAN` | 普通用户 | 粉丝，通过秘钥注册 |

### 核心表（账户与计费域）

> 已废弃：`aep_products` / `aep_plans` / `aep_features` / `aep_plan_features` / `aep_entitlements` —— 订阅 / 权益模型被「一次性点数发放 + License」替代，见 product_spec.md §0.1、§0.2。

| 表 | 说明 |
|------|------|
| `aep_users` | 用户（含 `password_hash` 供管理员使用） |
| `aep_tenants` | 机构（PLATFORM / PERSONAL / ORGANIZATION），承载 License 发放方统计 |
| `aep_memberships` | 用户 ↔ 机构 关系（含 `source` / `license_key_id`） |
| `aep_studios` | 业务主体（1:1 AepUser，kind: personal_creator / music_studio / drama_studio / variety_studio / agency / mcn） |
| `aep_license_batches` | 秘钥批次（含 `initial_credit_grant`） |
| `aep_license_keys` | 秘钥单码 |
| `aep_wallets` | 钱包（license / recharge / gift / pending 四科目，`total_balance` = 前三项之和） |
| `aep_ledger_entries` | 不可变点数流水，Admin Finance 图表由此派生 |
| `aep_audit_logs` | 审计日志 |

内容/IP 域相关表（`digital_ips` / `aep_songs` / `aep_albums` / `aep_concerts` / `aep_dramas` / `aep_movies` / `aep_advertisements` / `aep_voice_works` / `copyright_items` / `distribution_*` / `nft_items` / `community_*` / …）见 product_spec.md §4–§5。
