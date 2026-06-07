# AI Star Eco Server

> 阿里云 **ECS + RDS + OSS** 部署的完整版本化基础设施在 [`../../infra/`](../../infra/README.md)。
> 新机器从零拉起、env / nginx / systemd / RDS / OSS 模板、deploy 脚本均在该目录。

Spring Boot 后端服务，承载账户注册、权益管理、许可证（秘钥）、积分钱包、审计日志等核心业务。

## 版本日志

- **v0.43（2026-05-29）**：三子产品平台访问隔离 + 音乐/短剧形象锻造接平台大模型 + 短剧脚本化生成。
  - **平台隔离**：`AepUser` +`platforms` 列（CSV；空=全部可访问），`/api/me` 透出；`PlatformAccessService` 按 `aep.platform.dev-grant-all`（默认 true=一处注册三端可用 / false=按注册来源 `platform` 授予）决定注册授予。拦截在前端，后端不做逐接口平台门禁。
  - **形象锻造**：`AiModelPurpose` +`APPEARANCE_FORGE`；`ForgeChatService` 混合通道（大模型优先 `invokeChat`+服务端切流 SSE，Coze 回退，都没配 503）；`ForgeController` +`/appearance-forge/chat/{status,stream}`（`/coze/*` 保留为别名）。music + drama 共用。
  - **短剧生成**：新实体 `DramaScript`（`drama_scripts` 表）+ `DramaScriptService`（CRUD 软删 + `aiDraft` 大模型起草分场景脚本 + `generateEpisodes` 委派 `MaterialVideoJobService`）+ `DramaController`（`/api/me/drama/scripts*` + `/episodes/{generate,jobs}`）；`AiModelPurpose` +`DRAMA_SCRIPT_DRAFT`。视频生成复用 `material_video_job`，以 `kind="drama-episode"` + `scriptId` 区分带货视频。
  - **联调**：`DevFakeAiSeeder`（`aep.dev-fake-llm.enabled`，dev 默认开）一键接入 fake 端点 + 绑定用途；配套 `scripts/dev-fake-llm-server.mjs`。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.43。
- **v0.42（2026-05-29）**：素材运营「带货视频生成」接真后端（异步 submit + 轮询）。新实体 `MaterialVideoJob`（`material_video_job` 表）+ `MaterialVideoModelClient`（视频大模型「提交+轮询」HTTP 客户端，单一可替换点；端点取自后台「AI 模型与 Key」用途 `VIDEO_GENERATION` 的绑定，submit/poll 协议走 `aep.material.video.*`，默认对齐 智谱 CogVideoX 异步约定；未配 → `VIDEO_NOT_CONFIGURED` 503）+ `MaterialVideoJobService`（提交扣费+派发 / 查询 / wire 映射）+ `MaterialVideoWorker`（`@Async("materialVideoExecutor")` 服务端轮询直到出片/超时，成功 `commitHold` / 失败 `releaseHold`）。`AiModelPurpose` +`VIDEO_GENERATION`；`CelebrityActionPricingService` +action `material.video-generate`（默认 30/条）。`MaterialOpsController` +`/material/videos/generate` + `/material/videos/jobs[/{id}]`。配套修脚本预览关联商品错配（前端按 `product_id` 查全量商品库）+ 基线生成直给。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.42。
- **v0.41（2026-05-29）**：合并「AI 模型」+「LLM 网关 Key」为统一的**模型接入端点 + Key**，并加**大模型用量统计**。
  - 实体 `AiModelProvider` → `AiModelEndpoint`（表名仍 `ai_model_providers`，复用列 `api_key_encrypted`/`default_model`）：一行 = 固定 {上游密钥 + 单模型 + 地址}，**折叠** `LlmApiKey` 的网关 Key（`key_prefix`/`key_hash`/`owner_user_id`/`total_tokens`/`total_calls`/`last_used_at`/`key_revoked_at`）；删 `purposes`/`priority` 字段（物理列残留无害）。
  - 新增 `ai_app_binding` 表（用途 `AiModelPurpose` 作主键 → `endpoint_id`）：每个 AI 应用固定绑**一个**端点，**无优先级/无 5xx 兜底**。`AiModelInvocationService` 改 `resolveEndpoint(purpose)` 单端点解析（`hasProviderFor`→`hasEndpointFor`）。
  - 内部/网关链统一走端点：`/api/internal/llm-keys/{validate,usage}` 与 `/api/internal/ai-models/upstreams` 改由 `AiModelEndpoint` 派生（URL/返回体形状不变，llm-gateway 零改）；validate 命中端点（`owner_user_id` 非空才扣钱包，空=平台级仅累计），**未命中回退旧 `LlmApiKey`**（兼容 1 版）。
  - 新端点 `POST /api/admin/ai-models/{id}/mint-key`（铸网关 Key，明文一次）/ `revoke-key`；新 `GET /api/admin/ai-app-bindings` + `PUT/DELETE /api/admin/ai-app-bindings/{purpose}`。删 `AdminLlmApiKeyController`（admin CRUD 折叠进端点页）。
  - 迁移 `AiModelEndpointBindingSeeder`（@Order 55）：旧 provider 行按 `models[0]` 回填 `model`，按旧 `purposes`/`priority` 升序回填绑定（首个最低 priority 胜）；全新 DB 无旧列时静默跳过。
  - **大模型用量统计（自建 token 流水）**：新增 `ai_model_usage_record` 表（`AiModelUsageRecord`：providerId(=端点 id) / providerName / model / purpose / prompt/completion/total Tokens / success / createdAt）+ `AiModelUsageRecordRepository`（Object[] 聚合）+ `AiModelUsageService`（`record(...)` best-effort 落库 + `report(days)`/`reportForProvider(id, days)` 聚合，days 缺省 30 封顶 365）。`AiModelInvocationService.doChat` 解析 `prompt_tokens`/`completion_tokens` 并在末尾落流水（`REQUIRES_NEW` 独立事务 + try/catch，绝不阻断 chat）。新增 `GET /api/admin/ai-models/usage` + `GET /api/admin/ai-models/{id}/usage`。把响应里返回的 `usage` 自行落库聚合（对所有 OpenAI 兼容端点通用，不依赖各家计费接口）；仅记成功调用。
- **v0.40（2026-05-29）**：素材运营「文本三件」接真 LLM（脚本起稿 / 卖点提取 / 变量抽取）—— 复用 `AiModelInvocationService.invokeChat`（+SELLING_POINTS/VARIABLE_EXTRACT purpose、response_format 透传），新增 `MaterialAiService`（解析/校验/自修复重试；**不静默兜底**：provider/prompt 未配或调用/解析失败抛带 code 的明确错误 `AI_NOT_CONFIGURED`/`PROMPT_NOT_CONFIGURED`/`AI_CALL_FAILED`/`AI_BAD_OUTPUT`，便于定位配置问题）。prompt（system+user 模板）建 `prompt_template` 表，`PromptService` 解析（DB→resource→代码兜底，1min 缓存）+ `PromptTemplateSeeder`（缺行才插）+ `AdminPromptController`（/api/admin/prompts CRUD + dry-run）。`MaterialOpsController` +`/material/scripts/ai-draft` + `/material/scripts/{id}/variables`。脚本起稿计费（后端可配置）：`CelebrityActionPricingService` +action `material.script-draft`（默认 0=不计费），`MaterialOpsService.draftScripts` 走 `CreditService` hold(单价×稿数)→commit/release，余额不足抛 402。方案见 [`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](../../docs/MATERIAL_OPS_AI_TEXT_PLAN.md)。
- **v0.39（2026-05-28）**：Agent 平台（Coze）配置化。
  - 新增 `agent_bot_providers` 表 + `/api/admin/agent-bots/**`（CRUD + `/scenes` 场景目录）。把「形象锻造」这类挂在 Coze 等 agent 平台上的会话能力从 env 写死改为后台可配；token AES-GCM 加密落库，永不明文返回；一个 `sceneKey` 唯一对应一个 bot。
  - `ForgeCozeService` 改为按 sceneKey（`appearance-forge`）从 DB 解析 bot 配置（token / botId / apiBase / userIdPrefix），**env 兜底**保持老部署不破；按 (apiBase, token) 缓存 Coze client。
  - 前端 `apps/web-music` 的形象锻造已自带 `USE_MOCK` 开关（mock 本地回放 / live 走真实 SSE），本期未改；live 路径自动用后台配置的 bot。
  - `platform` 字段预留 DIFY / CUSTOM 扩展位（本期仅 COZE 真实接通）。
  - `AgentBotProvider` 加可选 `spaceId`：仅供 admin 拼 Coze 控制台 bot 配置页深链（`{console}/space/{spaceId}/bot/{botId}`，console 由 apiBase 推断 coze.cn/coze.com），不参与调用。
- **v0.38（2026-05-28）**：大模型配置化收口。
  - 删除 `AiModelProviderDataInitializer`（不再 seed 占位 provider）——provider 完全走 admin 配置，dev / prod 不再区分。
  - 内置常见服务商**预设**（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI）：`GET /api/admin/ai-models/presets`，admin 选中即填 baseUrl / 默认模型，补 apiKey 即可建档。
  - **模型发现**：`POST /api/admin/ai-models/discover-models`（新建前用表单 baseUrl+apiKey 拉 `GET /models`）与 `POST /api/admin/ai-models/{id}/fetch-models`（已存 provider 用落库密钥拉），解析 `data[].id` 并过滤 `status=Shutdown/Retiring`。
  - `AiModelProviderDto` / upsert 新增 `models`（落 `ai_model_providers.models_json`），可视化挑选默认模型。
  - `AiModelInvocationService` providerType 兼容集放宽：除 `ANTHROPIC` / `AZURE_OPENAI` 外均走 OpenAI 兼容 wire（含 VOLCENGINE / ALIYUN / MOONSHOT / DEEPSEEK / BAIDU / TENCENT）。
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
| `AEP_SECRET_KEY` | AES-GCM 对称密钥（加密 `AiModelEndpoint` 上游 apiKey 等敏感字段；32 字节，短/长会用 SHA-256 派生）。生产**必须**配；dev 缺省时回退到固定字符串。 | 生产**必配**；dev 可缺省 |
| `aep.secret.key` | 同上的系统属性别名（`-Daep.secret.key=...`）；优先级低于环境变量 | 可选 |
| `SPRING_PROFILES_ACTIVE` | `dev`（默认）或 `mysql` | 看部署环境 |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | mysql profile 时的数据源 | mysql profile 必配 |
| `AEP_VIDEO_*`（`_SUBMIT_PATH` / `_POLL_PATH` / `_POLL_INTERVAL_SEC` / `_MAX_WAIT_SEC` / `_MAX_CONCURRENT` / `_DEFAULT_MODEL` …） | v0.41 带货视频生成（`aep.material.video.*`）协议 / 轮询调参。**视频大模型 token 不在这里配**，走后台「AI 模型」页（用途 `VIDEO_GENERATION`）。换厂商一般只改 submit/poll 子路径。 | 可选（有默认值） |

启动后可访问：
- API: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console（JDBC URL: `jdbc:h2:mem:aistareco`，用户名 `sa`，密码留空）

### MySQL 环境

```bash
# 1. 建库
mysql -u root -p -e "CREATE DATABASE aistareco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 启动（指定 mysql profile）
# ⚠️ Spring Boot 3.x maven plugin 用 -Dspring-boot.run.profiles（dash 不是 dot）
#    旧写法 -Dspring.profiles.active=mysql 在 3.x 不生效，会回退到 dev profile + H2
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

**v0.34+ 本地用 mysql profile 联调的最小 env 集**（必须 export 后再 mvn 启动，否则
JwtUtil / AepCryptoUtil 启动时 fail-fast 抛 IllegalStateException）：

```bash
export AEP_JWT_SECRET='dev-local-jwt-secret-≥32-chars-aaaaaaaa'   # 至少 32 字符
export AEP_SECRET_KEY='dev-local-aes-key-32bytes-bbbbbbbb'        # 任意 ≥1 字符，内部会 SHA-256 派生
export AEP_SEED_DEV_DATA_ENABLED=true                              # 想要本地有 admin/admin123 等演示数据
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
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
# 方式一：spring-boot-maven-plugin 专属参数（注意 dash `-` 不是 dot `.`）
# 旧写法 -Dspring.profiles.active=mysql 在 Spring Boot 3.x 不生效（plugin fork
# 子进程不继承 JVM system property），会回退到 application.yml 的默认 dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=mysql

# 方式二：环境变量（推荐，2.x / 3.x 都通）
SPRING_PROFILES_ACTIVE=mysql mvn spring-boot:run

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
| GET · POST · PUT · DELETE | `/api/admin/ai-models/**` | 大模型 provider 配置（含 `/presets` 预设、`/discover-models` 与 `/{id}/fetch-models` 模型发现、`/{id}/test` 连通测试） |
| GET · POST · PUT · DELETE | `/api/admin/agent-bots/**` | Agent 平台 bot 配置（Coze 等；含 `/scenes` 场景目录；按 sceneKey 绑定业务功能如形象锻造） |
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

### 数字人资产平台域（dap_*，v0.51）

> 服务 apps/web-aiavatar（/api/v1/**）。账户复用 aep_users + 钱包；大模型走 Agnes（AGNES_API_KEY）。

| 表 | 说明 |
|------|------|
| `dap_avatar` | 数字人本体（8 态状态机 draft→…→archived；def/deriv/counts JSON；imageKey/variantKeys/shotKeys 存 storage key） |
| `dap_avatar_version` | 版本时间线（init/iterate/refine/template/finalize/archive 事件 + 当时主图） |
| `dap_look` | 造型（design 描述 / scene 场景替换，异步生成） |
| `dap_derivative` | 衍生产物（atlas/expr/scene/ward/d3/video 单条文件 + bytes 存储统计） |
| `dap_license` | 真人肖像电子授权（捕获核验自动登记；HTML 凭证 certKey） |
| `dap_job` | 异步作业（wire 三态 running/done/failed；cost + hold referenceId=jobId:rN） |
| `dap_voice` | 我的声线（克隆采样加密存档，试听=采样回放） |
| `dap_capture` | 真人捕获会话（footage + ffmpeg 抽帧 frameKey） |
| `dap_photo` | 形象照片素材（上传照片复刻输入） |

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
| `ai_model_providers` | **AI 模型接入端点**（v0.41，实体 `AiModelEndpoint`）：固定 {上游密钥 + 单模型 + 地址}，含内嵌网关 Key（`key_*`/`owner_user_id`/usage 列）；上游 apiKey 列存 AES-GCM 密文，网关 Key 存 bcrypt，均永不明文返回。旧 `purposes`/`priority` 列弃用 |
| `ai_app_binding` | v0.41：AI 应用（`AiModelPurpose` 作主键）→ 端点（`endpoint_id`）绑定，一用途一端点、无兜底 |
| `ai_model_usage_record` | 大模型调用用量流水（v0.41；每次成功 chat 落一行，记端点/model/purpose + prompt/completion/total tokens；只追加，供 admin 用量统计聚合） |
| `llm_api_keys` | **弃用（v0.41）**：网关 Key 已折叠进 `ai_model_providers`；保留 1 版作旧 `sk-aep-*` 验证回退 |
| `agent_bot_providers` | Agent 平台 bot 配置（Coze 等；token 列存 AES-GCM 密文；sceneKey 唯一，绑定业务功能如形象锻造） |
| `user_bot_read_state` | per-user-per-bot lastReadAt（驱动消息首页未读 dot 与 chat 已读机制） |
| `drama_scripts` | **短剧脚本**（v0.43，drama 子产品）：`ownerUserId`/`title`/`genre`/`durationSec`/`status` + `payloadJson`（完整脚本含 `scenes[]`：heading/summary/shot(画面)/dialogue(台词)/duration_sec）+ 软删 `deletedAt`。短剧视频生成复用 `material_video_job`（kind=`drama-episode`） |
| `aep_users.platforms` | **平台访问授权列**（v0.43）：CSV（`music,drama,celebrity` 子集；空=全部可访问）。`/api/me` 透出 effective 列表，前端按本子产品判断放行 |
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
| `mixcut_draft`（v0.48 新表） | 混剪「实例 / 草稿」—— 模版与生成任务之间的中间层。字段与 `MixcutRenderJob` 快照列对齐（`slot_bindings_json` / `canvas_snapshot_json` / `slots_snapshot_json` / `scenes_snapshot_json` / `perturbation_overrides_json` / `sticker_pool_json` / `perturbation_profile` / `output_variants` / `product_id`）+ `name` / `template_version` / `status`（draft）/ `generated_job_count` / `last_generated_at`。`userId` 隔离。端点 `/api/mixcut/drafts`（CRUD + `/{id}/generate`）。保存填了一半的配置 → 可继续编辑 / 反复生成 |
| `mixcut_render_job` 扩字段 (v0.48) | `draft_id`（VARCHAR(64), 关联 `mixcut_draft.id`，可空）—— 从实例 / 草稿生成时填入；任务详情页据此显示「来自实例」徽章并深链回 create 页继续编辑该实例。`MixcutJobSchemaMigration` 兜底加列 |
| `mixcut_asset` 扩字段 (v0.49) | `cdn_key`（VARCHAR(512), 可空）—— 用户上传素材经统一 `FileStorageService` 推 OSS 得到的 object key。出 wire 时 `MixcutAssetDto` 用 `CdnUrlSigner.signKey` 签成 `cdn_url`（素材库展示走 CDN，省 ECS 带宽 + 防盗刷）；渲染仍读 `localPath`。`MixcutJobSchemaMigration` 兜底加列 |

**v0.49 统一文件存储门面 `service/storage/FileStorageService`**：全系统「上传 / 生成 / 大模型返回」的图片/视频/音频/模型文件存储收口入口 —— `store(MultipartFile/byte[])` / `storeExisting(Path)` → `StoredFile{key,url,signedUrl,localPath,bytes,mime}`；`signedUrl(key)` / `delete(key)` / `openForRead(key)`。统一 key 约定 `<category>/<owner?>/<uuid>.<ext>`，底层委托 `service/cdn/*`（driver + 签名）。已收口：用户上传素材（`MixcutAssetService.upload`）+ celebrity 档案图（`AdminCelebrityUploadController`）从本地裸写改为推 OSS。已在 `CdnUploader` 层的 material video / aiavatar / mixcut 成片暂不强迁（cosmetic）。配置 `aep.storage.*`。

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
