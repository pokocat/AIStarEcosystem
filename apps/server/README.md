# AI Star Eco Server

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

### 公开端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录 |
| POST | `/api/auth/activate` | 秘钥激活注册 |

### 管理后台（需 Bearer Token，PLATFORM_OPERATOR / FINANCE_ADMIN）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/auth/me` | 当前登录管理员信息 |
| GET | `/api/admin/stats` | 仪表盘统计 |
| GET/POST/PUT/PATCH/DELETE | `/api/admin/users/**` | 用户管理 |
| GET/POST/PUT/DELETE | `/api/admin/entitlements/**` | 权益配置 |
| GET/POST | `/api/admin/license-batches` | 许可证批次 |
| GET | `/api/admin/license-keys` | 许可证密钥 |
| PUT | `/api/admin/license-keys/{id}/revoke` | 吊销密钥 |
| GET | `/api/admin/products` | 产品列表 |
| GET | `/api/admin/plans` | 套餐列表 |
| GET | `/api/admin/tenants` | 租户列表 |
| GET | `/api/admin/credits/wallets` | 钱包列表 |
| GET | `/api/admin/credits/ledger` | 账本流水 |
| GET | `/api/admin/audit` | 审计日志 |

所有响应统一包装为 `{"data": ...}` 格式。

## 项目结构

```
src/main/java/com/aistareco/
├── AiStarEcoApplication.java          # 入口
├── aep/                               # 账户与权益平台模块
│   ├── config/
│   │   ├── AepSecurityConfig.java     # Spring Security 配置
│   │   ├── JwtUtil.java               # JWT 生成/验证
│   │   ├── JwtAuthenticationFilter.java # JWT 过滤器
│   │   └── DataInitializer.java       # 种子数据
│   ├── controller/                    # REST 控制器
│   │   ├── AdminAuthController.java   # 管理员认证
│   │   ├── AdminUserController.java   # 用户管理
│   │   ├── AdminEntitlementController.java  # 权益管理
│   │   ├── AdminLicenseController.java      # 许可证管理
│   │   ├── AdminProductController.java      # 产品管理
│   │   ├── AdminCreditController.java       # 积分管理
│   │   ├── AdminTenantController.java       # 租户管理
│   │   ├── AdminStatsController.java        # 统计
│   │   ├── AdminAuditController.java        # 审计日志
│   │   └── LicenseActivationController.java # 秘钥激活（公开）
│   ├── model/          # JPA 实体（AepUser, Tenant, Entitlement, LicenseBatch, LicenseKey, Wallet, ...）
│   ├── repository/     # Spring Data JPA 仓库
│   ├── service/        # 业务逻辑层
│   └── dto/            # 数据传输对象
├── common/             # 通用工具（ApiResponse, GlobalExceptionHandler）
├── controller/         # 歌手生态业务控制器（Singer, Track, Marketplace, ...）
├── model/              # 歌手生态实体
├── repository/         # 歌手生态仓库
├── service/            # 歌手生态服务
└── dto/                # 歌手生态 DTO
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

### 核心表

| 表 | 说明 |
|------|------|
| `aep_users` | 用户（含 `passwordHash` 供管理员使用） |
| `aep_tenants` | 租户（PERSONAL / ORGANIZATION / CHANNEL） |
| `aep_memberships` | 用户-租户关系 |
| `aep_products` | 产品 |
| `aep_plans` | 套餐 |
| `aep_features` | 功能定义 |
| `aep_plan_features` | 套餐-功能映射 |
| `aep_entitlements` | 权益记录 |
| `aep_license_batches` | 许可证批次 |
| `aep_license_keys` | 许可证密钥 |
| `aep_wallets` | 积分钱包（四科目余额） |
| `aep_ledger_entries` | 不可变积分流水 |
| `aep_audit_logs` | 审计日志 |
