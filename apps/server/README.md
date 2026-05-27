# AI Star Eco Server

> 线上部署、增量发布 SOP、`/static/videos` 共享静态资源说明，以及本地联调方式见 [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md)。
>
> **v0.34+**: 阿里云 ECS + RDS + OSS 的完整版本化基础设施在 [`../../infra/`](../../infra/README.md)。
> 新机器拉起 / RDS 切换 / OSS 上云请按 [`../../infra/MIGRATION.md`](../../infra/MIGRATION.md)。

Spring Boot 后端服务，承载账户注册、权益管理、许可证（秘钥）、积分钱包、审计日志等核心业务。

## 版本日志

- **v0.34（2026-05-27）**：
  - 引入 **Flyway**（`db/migration/V<N>__xxx.sql`）；首启 baseline-on-migrate 自动到 V1，后续 schema 改动走 V2+
  - 演示数据 seeder 全部加 `aep.seed.dev-data.enabled` gate（mysql profile 默认 `false`），生产空库不会写入 admin/admin123 等演示账号
  - **密钥 fail-fast**：mysql/prod profile 启动时检测到 `AEP_JWT_SECRET` / `AEP_SECRET_KEY` 仍是 dev default → 立即抛异常拒绝启动
  - HikariCP 显式参数化（maximum-pool-size 等），便于按 RDS 规格调
  - 完整 deploy 模板在 `infra/`

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

### 环境变量

| 变量 | 用途 | 必配？ |
|---|---|---|
| `AEP_SECRET_KEY` | AES-GCM 对称密钥（加密 `AiModelProvider.apiKey` 等敏感字段；32 字节，短/长会用 SHA-256 派生）。生产**必须**配；dev 缺省时回退到固定字符串。 | 生产**必配**；dev 可缺省 |
| `aep.secret.key` | 同上的系统属性别名（`-Daep.secret.key=...`）；优先级低于环境变量 | 可选 |
| `SPRING_PROFILES_ACTIVE` | `dev`（默认）或 `mysql` | 看部署环境 |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | mysql profile 时的数据源 | mysql profile 必配 |

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

**v0.34+ 本地用 mysql profile 联调的最小 env 集**（必须 export 后再 mvn 启动，否则
JwtUtil / AepCryptoUtil 启动时 fail-fast 抛 IllegalStateException）：

```bash
export AEP_JWT_SECRET='dev-local-jwt-secret-≥32-chars-aaaaaaaa'   # 至少 32 字符
export AEP_SECRET_KEY='dev-local-aes-key-32bytes-bbbbbbbb'        # 任意 ≥1 字符，内部会 SHA-256 派生
export AEP_SEED_DEV_DATA_ENABLED=true                              # 想要本地有 admin/admin123 等演示数据
mvn spring-boot:run -Dspring.profiles.active=mysql
```

为什么：mysql profile 被设计为「生产形态」，启动时拒绝 dev-default 密钥；上面三个 env
让本机也能用 mysql profile 联调。生产 server.env 用真正高熵密钥（见
`infra/env/server.env.example`）。

MySQL 默认连接配置（可在 `application-mysql.yml` 中修改）：

| 参数 | 默认值 |
|------|--------|
| host | localhost:3306 |
| database | aistareco |
| username | root |
| password | root |
| charset | utf8mb4 |
| timezone | Asia/Shanghai |

`ddl-auto: update` 会自动建表。

**v0.34+ 重要变化**：演示数据 seeder（`DataInitializer` 等）受 `aep.seed.dev-data.enabled` 控制：
- `application.yml` 默认 `true`（H2 dev / 联调环境会自动种 admin/admin123 + 演示明星 + license keys）
- `application-mysql.yml` 默认 **`false`**（**生产空库不会**自动种）

生产首次部署后建第一个 SUPER_ADMIN：

```sql
INSERT INTO admin_users (id, username, password_hash, role, status, created_at)
VALUES (
  UUID(),
  'your-admin',
  '<bcrypt-hash-of-your-password>',   -- 用 BCryptPasswordEncoder 离线生成
  'super_admin',
  'active',
  NOW()
);
```

或临时启用 seeder 跑一次（不推荐，因为会一并种全部演示数据）：

```bash
AEP_SEED_DEV_DATA_ENABLED=true java -jar ...   # 启动一次
# 然后 admin/admin123 登录 → 立即改密码 + 新建生产管理员 → 删 admin/operator 演示账号
```

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
| `SUPER_ADMIN` | 超级管理员，拥有所有数据操作权限 |
| `OPERATOR` | 平台运营，拥有所有数据操作权限 |

> v0.6+ 计划拆分为 `PLATFORM_OPERATOR / FINANCE_ADMIN`（职责分离）。当前 `AdminUser.AdminRole` enum 实际是 `{SUPER_ADMIN, OPERATOR}`。

开发环境默认账户（由 `DataInitializer` seed）：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | SUPER_ADMIN |
| `operator` | `operator123` | OPERATOR |

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

### 管理后台（需 Bearer Token，SUPER_ADMIN / OPERATOR）

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
| GET | `/api/admin/social-accounts` | sau 绑定的社交账号审计（含昵称 / 平台账号号 / 头像；不含 storage_state） |
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
| `SUPER_ADMIN` | 系统管理员 | 所有数据操作权限，管理后台登录 |
| `OPERATOR` | 系统管理员 | 平台运营，管理后台登录 |
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

### v0.5 新增表（明星带货线）

> 全部由 v0.5.0 ~ v0.5.3 落地。详细字段与契约见 `/product_spec_ai_celebrity.md`。

| 表 | 用途 |
|---|---|
| `celebrity_star_authorizations` | 用户 × 明星授权关系（4 态状态机；unique(user_id, star_id)） |
| `recharge_packages` | 充值套餐（admin CRUD；软删走 `active=false`；落账走 `LedgerEntry`） |
| `template_scripts` | 模板脚本（双模 text / video_ref；同 templateId 仅一条 PUBLISHED；JSON 列容纳 persona/scenes/variables/engineAdapters/durationVariants/postProcess/safety/referenceClip 等） |
| `ai_model_providers` | 大模型 provider 配置（OpenAI 兼容 API token；apiKey 列存 AES-GCM 密文，永不明文返回） |
| `user_bot_read_state` | per-user-per-bot lastReadAt（驱动消息首页未读 dot 与 chat 已读机制） |
| `celebrity_stars` 扩字段 | bio / location / fans / cooperation_count / avg_gmv / photos_json / videos_json |
| `celebrity_templates` 扩字段 | preview_cover / preview_video_url / duration_sec |
| `aep_notifications` 扩字段 | bot_id（关联 5 个 AI Bot 同事；v0.5.2 拉模式后保留作扩展点） |
| `aep_social_accounts` | sau 绑定账号，存 `display_name` / `platform_account_id` / `avatar_url` 清洁 profile；`storage_state_encrypted` 为 AES-GCM 密文且不出 DTO |
| `mixcut_render_output` 扩字段 (v0.19) | `publish_count`（INT NOT NULL DEFAULT 0）/ `last_published_at`（OffsetDateTime nullable）—— `MixcutPublishService` 每次派单成功后按 target 数累加；视频库 UI 用此显示「已发 ×N」徽标，允许同一变体再次分发 |
| `mixcut_render_output` 扩字段 (v0.21) | `deleted_at`（OffsetDateTime nullable）—— 用户在「视频库」点删除后置非空；DTO 转换过滤 `deletedAt != null` 的 output；`MixcutOutputCleanupScheduler @Scheduled(cron="0 30 3 * * *")` 每日凌晨清理 30 天前软删行（本地 mp4 / CDN / DB 全删） |
| `mixcut_asset` 扩字段 (v0.21) | `is_official`（BOOLEAN NOT NULL DEFAULT false）/ `official_category`（直播切片 / 综艺 / 访谈…）/ `related_star_id`（关联 `celebrity_stars.id`，可空）—— 运营后台上传的「官方明星片段」，端点 `POST /api/admin/mixcut/official-clips`；用户端只读 `GET /api/mixcut/assets/official-clips` |
| `products` 扩字段 (v0.28) | `price_cents`（INT nullable）/ `commission_rate`（INT nullable, 0-100 整数百分比）—— 选品表格导入 + 抖音链接解析的价格 / 佣金信息 |
| `mixcut_asset` 扩字段 (v0.28) | `related_product_id`（VARCHAR(64), 关联 `products.id`，可空）/ `subkind`（VARCHAR(32), 区分 `"user-upload"` / `"product-photo"` / `"product-video"` / `"ai-marketing-video"`）—— 商品链接解析时把外网 CDN 图片直接登记为 MixcutAsset 行，create 页 `?product_id=X` 按此过滤「本商品素材」 |
| `mixcut_render_job` 扩字段 (v0.28) | `product_id`（VARCHAR(64), 关联 `products.id`，可空）—— 从商品库「生成视频」入口透传，分发抽屉用它反查 Product 自动 prefill 抖音商品挂载字段（productLink / productTitle） |

**v0.28 新增端点**：

```
POST /api/me/products/parse-link    仅解析（preview，不写库）
POST /api/me/products/from-link     解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)
GET  /api/mixcut/assets?related_product_id=X    按商品过滤素材（自动短路 listVisibleTo）
```

server 内部 `aep/service/productlink/ProductLinkHandler` 是策略链接口，Spring 按 `@Order` 注入有序列表：
- `DouyinQueryEmbeddedHandler` @Order(10) — query 内嵌 `goods_detail` JSON 时直接 URLDecode + parse
- `DouyinHtmlScrapeHandler` @Order(20) — host 白名单 `*.jinritemai.com|*.douyin.com`（防 SSRF），HttpClient GET（UA=desktop Chrome, timeout=8s），正则抓 og tags + `window.__INITIAL_STATE__`

新平台扩展只加 handler；不动 `ProductLinkController` / 前端。`ProductLinkPersistService` 串起 ProductService.createWithId + `MixcutAssetService.registerExternalUrl(userId, kind, subkind, externalUrl, productId)`，单事务，图片登记单条失败 log + 继续。

### v0.5 关键服务

- `PromptAssemblyService` —— 按需把 TemplateScript 装配为引擎请求体（变量替换 + 引擎 adapter + 风控）
- `NotificationService` —— Bot 消息按需查询合成（5 composer，零事件总线）
- `AiModelInvocationService` —— OpenAI / OPENAI_COMPATIBLE 的 chat 调用 + provider 测试连通
- `RechargeService` —— 充值落账（recharge 主分录 + 可选 gift bonus 副分录）
- `CelebrityZoneService` —— 引擎价格 in-memory（`mutablePricing`）+ JOBS in-memory（重启失效；v0.6 落表）
- `MixcutPublishService` (v0.15 / v0.19 / v0.20) —— 混剪批量派单。v0.20 新加 `expandSchedule(spec, n) → Instant[]`：把顶层 `ScheduleSpec`（`immediate / single / daily_recurring`）算成 outputs.size 长的 `scheduledAt` 数组，daily_recurring 按 `outputs[i] → slots[i%K]` 在 `startDate + ⌊i/K⌋` 天起飞，过去 slot clamp 到 `now()`，可选 `jitter_minutes` 加 [-N, +N] 分钟随机偏移。`PublishJob` / `PublishJobScheduler` 零改动 —— 错峰 `scheduledAt` 直接走现有 10s tick。

### 通用工具

- `AepCryptoUtil`（`com.aistareco.common`）—— AES-GCM 加密/脱敏；密钥从 `AEP_SECRET_KEY` 读
