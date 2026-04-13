# 统一认证、权益、分销与积分计量平台技术方案

## 1. 文档目标

本文档用于设计一套可支撑多产品线的统一平台能力，覆盖以下核心目标：

- 支持多个上层产品统一接入，例如 `AI歌手`、`AI短视频`、`AI艺人`
- 提供统一认证中心，实现账号、组织、单点登录和会话管理
- 提供统一权限中心，支持平台角色、租户角色和产品权限控制
- 提供统一权益中心，支持套餐、功能、席位、额度、有效期管理
- 提供统一秘钥与分销体系，支持渠道发卡、兑换、升级、续费和返佣
- 提供统一积分与计量体系，支持 AI 能力按次扣费、预扣、结算、退回
- 保持平台能力可配置、可扩展、可审计，避免每个业务站点重复建设

## 2. 设计原则

### 2.1 核心原则

- `认证` 负责回答"你是谁"
- `权限` 负责回答"你能做什么操作"
- `权益` 负责回答"你买了什么、开通了什么"
- `积分/计量` 负责回答"你还能消耗多少"
- `秘钥` 负责承载权益兑换，不直接承担长期登录认证职责

### 2.2 边界原则

- 不把 `账号`、`角色`、`套餐`、`积分` 混在同一张表中
- 不把 `秘钥` 当作登录凭证
- 不把 `套餐权限` 写死在业务代码中
- 不把所有权限和权益都编码进 JWT
- 所有余额变更都必须走不可变流水
- 所有关键操作都必须可审计、可追踪、可回放

## 3. 总体架构

### 3.1 平台定位

建议将该能力独立建设为统一平台，作为所有业务产品的底层能力中心。

平台建议命名为：

- `Account & Entitlement Platform`
- 或 `统一账户与权益中心`

### 3.2 分层架构

```mermaid
flowchart LR
    U[用户/企业客户/渠道商] --> A[统一账户与权益平台]
    A --> P1[AI歌手]
    A --> P2[AI短视频]
    A --> P3[AI艺人]
    A --> P4[未来新产品]

    subgraph AEP[统一账户与权益平台]
      I[Identity 认证中心]
      T[Tenant 租户中心]
      R[Authorization 权限中心]
      E[Entitlement 权益中心]
      L[License 秘钥与分销中心]
      C[Credit 积分与计量中心]
      B[Billing 订单与订阅中心]
      D[Audit 审计中心]
    end
```

### 3.3 上层产品与平台职责划分

#### 统一平台负责

- 用户注册、登录、账号安全
- 组织与成员体系
- 单点登录 SSO
- 角色与权限
- 套餐、功能、席位、额度
- 卡密、批次、渠道库存、激活、吊销
- 订单、订阅、升级、续费
- 积分账户、价格规则、扣费、退款、过期
- 审计日志、风控、限流

#### 业务产品负责

- 本产品的业务对象和业务流程
- 本产品的任务执行和业务状态
- 本产品的内容、素材、项目、记录
- 调用平台判断当前用户的权限和权益
- 调用平台完成积分预扣和结算

## 4. 业务场景

本方案需要同时覆盖以下场景：

- 用户注册后购买或兑换 `AI歌手` 套餐
- 用户登录后升级 `AI短视频` 高级版
- 企业客户在同一租户下同时开通 `AI歌手` 和 `AI艺人`
- 渠道商批量售卖兑换码
- 用户通过卡密兑换套餐或积分包
- 企业管理员给子账号分配角色和产品使用范围
- 用户使用点数调用图片、音乐、视频等 AI 能力
- 异步任务执行失败后退回积分
- 多产品共享统一账号体系和统一钱包

## 5. 统一领域模型

### 5.1 核心实体概览

| 模块 | 核心实体                                     | 说明           |
| -- | ---------------------------------------- | ------------ |
| 认证 | `User`                                   | 用户账号         |
| 租户 | `Tenant`                                 | 企业、团队、工作区    |
| 成员 | `Membership`                             | 用户与租户关系      |
| 权限 | `Role` `Permission`                      | 角色与权限点       |
| 产品 | `Product`                                | 业务产品定义       |
| 套餐 | `Plan`                                   | 产品套餐         |
| 功能 | `Feature`                                | 可开通的功能点      |
| 权益 | `Entitlement`                            | 已生效的功能、席位、额度 |
| 秘钥 | `LicenseBatch` `LicenseKey` `Activation` | 卡密和兑换记录      |
| 渠道 | `ChannelPartner` `ChannelInventory`      | 分销库存和归属      |
| 订单 | `Order` `Subscription`                   | 购买、升级、续费     |
| 积分 | `Wallet` `LedgerEntry` `ConsumeOrder`    | 积分账户和流水      |
| 计量 | `Meter` `PriceRule`                      | AI 调用计量和计价规则 |
| 审计 | `AuditLog`                               | 安全和运营审计      |

### 5.2 核心关系

```mermaid
erDiagram
    USER ||--o{ MEMBERSHIP : joins
    TENANT ||--o{ MEMBERSHIP : has
    TENANT ||--o{ ENTITLEMENT : owns
    PRODUCT ||--o{ PLAN : defines
    PLAN ||--o{ PLAN_FEATURE : contains
    FEATURE ||--o{ PLAN_FEATURE : mapped
    TENANT ||--o{ SUBSCRIPTION : subscribes
    LICENSE_BATCH ||--o{ LICENSE_KEY : generates
    LICENSE_KEY ||--o{ ACTIVATION : redeemed_by
    TENANT ||--o{ WALLET : owns
    WALLET ||--o{ LEDGER_ENTRY : records
    PRODUCT ||--o{ PRICE_RULE : prices
    METER ||--o{ PRICE_RULE : measured_by
```

## 6. 统一认证中心设计

### 6.1 认证能力

统一认证中心应支持以下认证方式：

#### 基础认证

- 手机号验证码登录
- 邮箱验证码登录
- 用户名密码登录

#### 第三方 OAuth 登录（AI Star Eco 产品必须支持）

| 登录方式               | 适用用户群体                | 优先级 |
| ------------------ | --------------------- | --- |
| Google OAuth 2.0   | 全球用户，制作人/粉丝主要登录方式     | P0  |
| 微信 OAuth           | 中国大陆用户核心渠道，粉丝/制作人     | P0  |
| MetaMask 钱包签名      | Web3 用户，NFT 铸造和链上资产场景 | P1  |
| WalletConnect      | Web3 用户补充，移动端钱包       | P1  |
| Coinbase Wallet    | 海外 Web3 用户            | P2  |
| 企业级 SSO（SAML/OIDC） | MCN 机构、企业客户           | P2  |

#### 扩展能力

- 会话管理与 Token 刷新
- MFA 多因子认证扩展（TOTP/短信/邮件）
- 设备登录记录与异地登录告警
- 账号注销与数据清理

### 6.2 AI Star Eco 特有认证场景

#### 6.2.1 Web3 钱包身份认证

AI Star Eco 集成了 NFT 铸造与链上资产体系，Web3 钱包登录是平台差异化能力。

**钱包登录流程（EIP-4361 Sign-In with Ethereum）：**

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant A as 认证中心
    participant B as 区块链

    U->>F: 点击"连接钱包"
    F->>A: GET /api/auth/wallet/challenge?address=0x...
    A-->>F: 返回签名挑战（nonce + domain + 过期时间）
    F->>U: 弹出钱包签名请求
    U->>F: 钱包完成签名
    F->>A: POST /api/auth/wallet/verify { address, signature, message }
    A->>B: 验证签名合法性（ecrecover）
    B-->>A: 签名验证通过
    A->>A: 查找或创建 user_oauth_accounts 记录
    A-->>F: 返回 Access Token + Refresh Token
```

**钱包账号与平台账号绑定规则：**

- 首次钱包登录：自动创建平台账号，`wallet_address` 作为主要标识
- 已有账号绑定钱包：在 `user_oauth_accounts` 表中新增 `provider=web3_wallet` 记录
- 同一钱包地址只能绑定一个平台账号，防止重复注册
- 钱包登录的用户可后续绑定邮箱/手机号，完善账号信息

**安全要求：**

- 签名挑战（nonce）单次有效，5 分钟过期
- 挑战信息中包含 `domain` 防止跨站重放
- 服务端验证 `ecrecover` 得出的地址与请求地址一致

#### 6.2.2 微信 OAuth 登录（国内市场）

微信 OAuth 是中国大陆用户最主要的登录方式：

- 微信网页授权（扫码登录）：适用于 PC 端制作人后台
- 微信公众号网页授权：适用于移动端 H5 场景
- `openid` 作为微信用户唯一标识，`unionid` 用于跨公众号/小程序的账号统一

**微信账号与平台账号绑定规则：**

- `openid` 和 `unionid` 均存入 `user_oauth_accounts`
- 同一微信 `unionid` 只能绑定一个平台账号

#### 6.2.3 掌门人（MCN Coach）的多角色认证

掌门人是 AI Star Eco 的特殊角色，拥有管理学员制作人的权限。其认证特殊性：

- 掌门人使用相同登录入口，通过 `role=coach` 区分
- 掌门人登录后，`session` 需携带其管理的 `coach_squad_id` 信息
- 掌门人对学员的审批操作（approve/reject）需要记录完整审计链路
- 建议为掌门人开启登录二次验证（可选 TOTP）

#### 6.2.4 第三方平台账号绑定（非登录认证）

AI Star Eco 的发行模块需要绑定外部音乐平台账号（DistroKid、腾讯音乐人、网易云音乐人等），这与**登录认证**是两个完全不同的概念：

| 维度       | 登录认证 OAuth   | 平台账号绑定 OAuth                |
| -------- | ------------ | --------------------------- |
| 目的       | 验证"你是谁"      | 授权平台代表用户操作第三方服务             |
| Token 归属 | 认证中心管理       | 业务层（Distribution Module）管理  |
| Token 存储 | `sessions` 表 | `platform_accounts` 表（加密存储） |
| 失效处理     | 用户需重新登录      | 静默刷新，失败时提示重新授权              |
| 安全级别     | 核心安全链路       | 业务功能链路                      |

**结论**：DistroKid、腾讯音乐人等平台的 OAuth Token 由业务层的 `Distribution Module` 独立管理，不经过统一认证中心，但使用认证中心的 `user_id` 作为关联键。

### 6.3 协议建议

推荐采用标准协议：

- `OAuth 2.0`
- `OpenID Connect`

推荐域名规划：

- `accounts.example.com`：统一登录中心
- `singer.example.com`：AI歌手（AI Star Eco）
- `video.example.com`：AI短视频
- `artist.example.com`：AI艺人

### 6.4 Token 设计

`Access Token` 只放最小必要信息：

```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "session_id": "uuid",
  "role": "producer",
  "token_version": 1,
  "issued_at": 1712345678,
  "expired_at": 1712349278
}
```

**说明：**

- `role` 字段（`fan` / `producer` / `coach`）允许放入 Token，因为这是粗粒度、低频变更的信息，可避免每次请求都查库判断入口路由
- `plan`（套餐类型）、`credits`（积分余额）、细粒度权限列表不放入 Token，由产品侧按需查询或使用短期 Redis 缓存

不建议在 Token 中放入：

- 全量权限列表
- 套餐功能清单
- 当前积分余额

这些信息应由产品侧按需查询统一平台，或使用短期缓存（TTL 建议 60 秒）。

### 6.5 会话与设备管理

```typescript
interface Session {
  id: string;
  user_id: string;
  tenant_id: string;
  device_fingerprint: string;
  device_type: 'web' | 'mobile' | 'api';
  ip_address: string;
  user_agent: string;
  login_method: 'email' | 'phone' | 'google' | 'wechat' | 'metamask' | 'walletconnect';
  is_active: boolean;
  last_active_at: string;
  expires_at: string;
  created_at: string;
}
```

支持能力：

- 查看所有活跃设备登录列表
- 主动吊销指定设备的会话
- 异地登录检测（IP 地域突变 → 触发二次验证）
- 全局登出（吊销所有 Refresh Token）

### 6.6 用户账号数据模型

针对 AI Star Eco 产品补充的完整 User 模型：

```typescript
interface User {
  id: string;                          // UUID 主键
  username: string;                    // 用户名，3–50字符，唯一
  email: string | null;                // 邮箱（可选，OAuth 登录可无邮箱）
  phone: string | null;                // 手机号（可选）
  avatar_url: string | null;           // 头像 URL
  display_name: string | null;         // 展示名（昵称）
  wallet_address: string | null;       // 主绑定 Web3 钱包地址（ETH 格式）
  role: 'fan' | 'producer' | 'coach';  // 平台角色（决定入口视图）
  plan: 'free' | 'pro' | 'enterprise'; // 当前套餐（冗余字段，权威数据在 Entitlement）
  credits: number;                     // 当前 AI 积分（冗余字段，权威数据在 Wallet）
  lang_preference: 'zh' | 'en';        // 语言偏好，默认 zh
  theme_preference: string;            // 主题偏好，默认 cyberpunk
  status: 'active' | 'suspended' | 'deleted';
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}
```

**注意：`plan`** **和** **`credits`** **作为冗余字段存在用户表，方便 JWT 无感知快速判断，但所有变更必须以 Entitlement / Wallet 为准，用户表字段通过异步任务同步。**

### 6.7 OAuth 第三方账号表

```typescript
interface UserOAuthAccount {
  id: string;
  user_id: string;                     // 关联 User.id
  provider: 'google' | 'wechat' | 'metamask' | 'walletconnect' | 'coinbase' | 'saml';
  provider_user_id: string;            // 第三方平台的用户唯一标识
  provider_username: string | null;    // 第三方平台用户名（展示用）
  provider_email: string | null;       // 第三方平台邮箱
  provider_avatar: string | null;      // 第三方平台头像
  access_token_encrypted: string | null;  // 加密存储的 Access Token
  refresh_token_encrypted: string | null; // 加密存储的 Refresh Token
  token_expires_at: string | null;
  extra_data: Record<string, unknown> | null; // 存储微信 unionid、钱包链名等额外信息
  is_primary: boolean;                 // 是否为主要登录方式
  created_at: string;
  updated_at: string;
}
```

## 7. 租户与成员体系设计

### 7.1 租户模型

建议平台以 `Tenant` 为权益归属主体，适配企业和团队场景。

典型租户类型：

- 个人工作室
- 企业客户
- 渠道代理商
- 内部运营组织

**AI Star Eco 补充说明**：在 AI Star Eco 产品中，个人制作人默认归属于自己的个人租户（系统注册时自动创建）；MCN 掌门人管理的工作室是一个组织租户，制作人学员通过邀请加入该租户。

### 7.2 成员角色模型

建议角色分三层设计：

#### 平台级角色

- `platform_owner`
- `platform_operator`
- `finance_admin`
- `channel_manager`

#### 租户级角色

- `tenant_owner`
- `tenant_admin`
- `tenant_operator`
- `tenant_member`
- `tenant_viewer`

#### 产品级权限（AI Star Eco 扩展）

针对 AI Star Eco 三角色体系，产品级权限点建议如下：

```
ai_singer.singer.create          创建 AI 歌手
ai_singer.singer.edit            编辑 AI 歌手参数/服装/姿态
ai_singer.singer.delete          删除/归档歌手
ai_singer.singer.publish         上架歌手到市场
ai_singer.music.generate         触发 AI 音乐生成（消耗积分）
ai_singer.music.distribute       发行音乐到外部平台
ai_singer.nft.mint               铸造 NFT 合集
ai_singer.marketplace.list       发布艺人到市场挂牌
ai_singer.marketplace.sign       签约市场艺人
ai_singer.chart.vote             为榜单投票
ai_singer.coach.manage_trainees  管理学员（掌门人专属）
ai_singer.coach.review_work      审核学员作品（掌门人专属）
ai_singer.coach.assign_task      下发任务给学员（掌门人专属）
```

**角色与权限映射：**

| 权限点                     |   fan   | producer（free） | producer（pro） | producer（enterprise） | coach |
| ----------------------- | :-----: | :------------: | :-----------: | :------------------: | :---: |
| `singer.create`         |    ❌    |     ✅（上限3）     |    ✅（上限20）    |         ✅（无限）        |   ❌   |
| `music.generate`        |    ❌    |     ✅（5点/天）    |    ✅（50点/天）   |         ✅（无限）        |   ❌   |
| `nft.mint`              |    ❌    |        ❌       |    ✅（10次/月）   |         ✅（无限）        |   ❌   |
| `marketplace.sign`      |    ❌    |        ❌       |       ❌       |           ✅          |   ❌   |
| `chart.vote`            | ✅（3票/天） |     ✅（3票/天）    |    ✅（3票/天）    |        ✅（3票/天）       |   ❌   |
| `coach.manage_trainees` |    ❌    |        ❌       |       ❌       |           ❌          |   ✅   |
| `coach.review_work`     |    ❌    |        ❌       |       ❌       |           ❌          |   ✅   |

### 7.3 鉴权判断公式

每次访问产品功能时，统一判断以下条件：

```text
允许访问 = 已登录
       AND 属于目标租户
       AND 角色具备操作权限
       AND 当前租户已开通对应产品/功能
       AND 对应额度或积分充足
```

## 8. 产品、套餐与权益体系设计

### 8.1 产品模型

产品为一级维度，例如：

- `ai_singer`
- `ai_video`
- `ai_artist`

后续可继续扩展：

- `ai_image`
- `ai_voiceover`
- `ai_live`

### 8.2 套餐模型

每个产品可配置多个套餐：

- `basic`
- `pro`
- `business`
- `enterprise`

套餐不应直接等价于角色。套餐定义的是商业能力边界，而不是后台操作权限。

**AI Star Eco 套餐限额对照：**

| 功能       | free   | pro     | enterprise  |
| -------- | ------ | ------- | ----------- |
| AI 歌手数量  | 最多 3 个 | 最多 20 个 | 无限制         |
| 音乐生成积分/天 | 5 积分/天 | 50 积分/天 | 无限制         |
| NFT 铸造   | 不可用    | ≤10 次/月 | 无限制         |
| 发行渠道     | 仅国内    | 全部渠道    | 全部渠道 + 优先通道 |
| 市场签约     | 不可用    | 不可用     | 可用          |
| MCN 管理   | 不可用    | 不可用     | 可用          |
| 基因混合实验室  | 不可用    | 可用      | 可用          |
| 传说级服装/姿态 | 不可用    | 可购买     | 已包含         |
| 粉丝社群模块   | 不可用    | 可用      | 可用          |

### 8.3 权益模型

`Entitlement` 用于表达已经生效的商业权益，建议支持以下维度：

- 已开通产品
- 已开通功能点
- 席位数上限
- 调用额度上限
- 存储额度
- API 调用额度
- AI 点数月配额
- 生效时间
- 到期时间
- 叠加规则

### 8.4 权益类型

建议至少支持以下权益类型：

- `feature_access`：功能开通（如基因实验室、MCN 管理）
- `seat_limit`：席位数量
- `quota_limit`：固定额度（如歌手数量上限）
- `monthly_credit`：月度积分配额（每日重置 or 每月重置）
- `addon`：增值包（如积分加油包、传说服装包）
- `bundle_access`：组合包产品权益

**AI Star Eco 补充权益类型：**

- `singer_slot`：可创建的 AI 歌手名额（free=3，pro=20，enterprise=unlimited）
- `nft_mint_quota`：NFT 铸造次数配额（monthly）
- `distribution_tier`：发行渠道等级（domestic / all / priority）
- `model_tier`：AI 生成模型质量等级（standard / advanced / flagship）

## 9. 秘钥与分销体系设计

### 9.1 秘钥定位

秘钥不用于长期登录认证，而用于以下场景：

- 套餐激活
- 时长兑换
- 席位扩容
- 点数兑换
- 附加包兑换
- 渠道卡密销售

### 9.2 秘钥实体设计

推荐拆为两层：

- `LicenseBatch`：批次定义
- `LicenseKey`：单个秘钥

#### LicenseBatch 核心字段

- `batch_no`
- `product_id`
- `plan_id`
- `license_type`
- `duration_days`
- `seat_delta`
- `credit_delta`
- `bind_type`
- `channel_partner_id`
- `valid_from`
- `valid_to`
- `max_activation_count`

#### LicenseKey 核心字段

- `code_hash`
- `batch_id`
- `status`
- `allocated_to`
- `sold_at`
- `activated_at`
- `activated_by_user_id`
- `activated_tenant_id`
- `revoked_at`

### 9.3 秘钥状态机

- `created`
- `allocated`
- `sold`
- `activated`
- `expired`
- `revoked`

### 9.4 分销体系设计

建议新增渠道域模型：

- `ChannelPartner`
- `ChannelInventory`
- `ChannelSettlement`
- `CommissionRule`

渠道业务支持：

- 生成渠道专属卡密
- 渠道领用库存
- 渠道折扣价和建议零售价
- 客户兑换后自动核销
- 根据激活记录进行分佣和售后归属

## 10. 积分与计量体系设计

### 10.1 设计目标

除套餐开通外，平台还需要支持 AI 能力的按次计费。\
推荐将其作为独立模块 `Credit & Metering Center` 建设。

### 10.2 核心概念

#### 钱包

`Wallet` 是余额承载主体，建议优先挂在 `Tenant` 维度，也可扩展用户子钱包。

#### 科目

`CreditAccount` 表示不同类型的点数账户，例如：

- 通用点数
- AI图片点数
- AI音乐点数
- AI视频点数
- 赠送点数
- 月度套餐点数

#### 流水

`LedgerEntry` 是不可变积分流水，所有增加、扣减、冻结、返还都必须记录。

#### 计量项

`Meter` 表示计费动作，例如：

- `image.generate`
- `music.generate`
- `video.render.minute`
- `voice.clone`
- `project.export`

#### 价格规则

`PriceRule` 表示不同条件下的计价规则，例如：

- 产品
- 动作
- 模型版本
- 套餐级别
- 分辨率
- 时长
- 渠道
- 活动

### 10.3 积分类型建议

建议至少支持以下点数类型：

- `recharge_credit`：充值点数
- `gift_credit`：赠送点数
- `plan_monthly_credit`：套餐月赠点数
- `addon_credit`：加油包点数
- `product_credit`：产品专属点数

### 10.4 消费优先级

建议默认优先消耗：

1. 快过期的赠送点数
2. 产品专属点数
3. 套餐月赠点数
4. 通用充值点数

### 10.5 AI 任务扣费模型

对于图片、音乐、视频等异步 AI 能力，建议使用三阶段扣费：

1. `预估价格`
2. `预扣冻结`
3. `完成结算`

如任务失败，则执行：

- `全额退回`
- 或 `按已消耗资源部分结算`

**AI Star Eco 具体扣费规则：**

| 操作           | 消耗积分         | 扣费时机        | 失败退回      |
| ------------ | ------------ | ----------- | --------- |
| 音乐生成（任意模式）   | 5 积分/次       | 点击"生成"时预扣   | 生成失败全额退回  |
| AI 歌手头像生成    | 3 积分/次（规划值）  | 点击"生成"时预扣   | 失败全额退回    |
| 基因混合生成       | 10 积分/次（规划值） | 点击"混合"时预扣   | 失败全额退回    |
| 姿态/服装解锁      | 按单品定价        | 点击"解锁"时立即扣费 | 不退回       |
| NFT 铸造 Gas 费 | 链上 ETH，平台不干预 | 链上交易时       | 链上失败退 ETH |

### 10.6 积分扣费流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant P as 上层产品
    participant E as 权益中心
    participant C as 积分计量中心
    participant J as 任务执行引擎

    U->>P: 发起 AI 任务
    P->>E: 校验产品权限与功能开通
    E-->>P: 允许
    P->>C: 请求报价
    C-->>P: 返回预计点数
    P->>C: 创建预扣
    C-->>P: 预扣成功
    P->>J: 提交任务
    J-->>P: 返回执行结果与实际消耗
    P->>C: 发起结算
    C-->>P: 扣费完成/退差额
    P-->>U: 返回任务结果
```

### 10.7 为什么不能只存余额

如果仅在用户表保存一个 `credit_balance` 字段，会导致以下问题：

- 无法支持预扣与结算
- 无法支持失败退回
- 无法支持多种点数科目
- 无法支持对账和审计
- 无法支持过期和冻结
- 无法复盘历史消耗

因此必须采用 `账户 + 流水账本` 模型。

## 11. 核心业务流程设计

### 11.1 用户注册并兑换秘钥

```text
注册账号 -> 创建或加入租户 -> 登录 -> 输入秘钥 -> 校验秘钥状态 ->
生成激活记录 -> 写入权益 -> 生效产品功能/席位/点数
```

### 11.2 用户在线升级套餐

```text
登录 -> 选择产品和套餐 -> 创建订单 -> 支付成功 ->
生成或更新订阅 -> 重算权益 -> 立即生效
```

### 11.3 企业管理员开通子账号

```text
租户管理员登录 -> 邀请成员 -> 成员加入租户 ->
分配角色 -> 检查席位是否足够 -> 完成开通
```

### 11.4 使用点数调用 AI 功能

```text
发起功能调用 -> 鉴权 -> 校验权益 -> 计价 -> 预扣 ->
异步执行 -> 完成结算 -> 写流水 -> 返回结果
```

### 11.5 渠道商售卖卡密

```text
平台生成批次 -> 分配库存给渠道 -> 渠道售卖 -> 客户兑换 ->
库存核销 -> 记录归属 -> 参与结算与返佣
```

### 11.6 AI Star Eco 制作人完整创作流程（认证视角）

```text
用户打开 AI Star Eco
  -> 选择登录方式（Google / 微信 / MetaMask）
  -> 认证中心颁发 Access Token（含 role=producer）
  -> 前端根据 role 渲染制作人工作台
  -> 创建 AI 歌手
      -> 产品层调用 POST /internal/access/check { user_id, action: "singer.create" }
      -> 权益中心校验 singer_slot 配额（free 限3个）
      -> 允许则创建，否则返回 403 MODULE_LOCKED / QUOTA_EXCEEDED
  -> 触发音乐生成
      -> POST /internal/metering/reserve { user_id, meter: "music.generate", amount: 5 }
      -> 积分不足返回 402 INSUFFICIENT_CREDITS
      -> 预扣成功后提交 AI 生成任务
      -> 生成完成后 POST /internal/metering/settle
  -> 铸造 NFT
      -> 校验 nft_mint_quota（pro 限10次/月）
      -> 连接 MetaMask 钱包（此时触发钱包签名，与登录认证无关）
      -> 链上铸造完成
```

### 11.7 掌门人审核学员作品流程

```text
掌门人登录（role=coach）
  -> 查看学员列表 GET /api/coach/trainees
  -> 打开学员详情，查看待审核作品
  -> 执行 approve/reject
      -> 产品层校验 action: "coach.review_work" 权限
      -> 写入 SubmissionReview 记录
      -> 若 approve：触发学员曲目状态变更 + 写审计日志
      -> 若 reject：触发通知给学员
```

## 12. API 设计建议

### 12.1 认证与账号 API

```
POST   /api/auth/register                    邮箱/手机号注册
POST   /api/auth/login                       邮箱/手机号登录
POST   /api/auth/logout                      登出（吊销当前会话）
POST   /api/auth/refresh                     刷新 Access Token
POST   /api/auth/oauth/:provider             第三方 OAuth 登录（google/wechat）
GET    /api/auth/wallet/challenge            获取钱包签名挑战
POST   /api/auth/wallet/verify               验证钱包签名并登录
POST   /api/auth/mfa/setup                   开启 MFA
POST   /api/auth/mfa/verify                  MFA 验证
GET    /api/me                               获取当前用户信息
PATCH  /api/me                               更新用户信息（语言/主题/头像）
GET    /api/me/sessions                      获取所有活跃会话
DELETE /api/me/sessions/:sessionId           吊销指定会话
GET    /api/me/oauth-accounts                获取绑定的第三方账号列表
POST   /api/me/oauth-accounts/bind           绑定新的第三方账号
DELETE /api/me/oauth-accounts/:provider      解绑第三方账号
GET    /api/me/tenants                       获取当前用户所属租户列表
```

### 12.2 租户与成员 API

- `POST /api/tenants`
- `GET /api/tenants/{tenantId}`
- `POST /api/tenants/{tenantId}/members/invite`
- `PATCH /api/tenants/{tenantId}/members/{memberId}/role`
- `GET /api/tenants/{tenantId}/members`

### 12.3 权益 API

- `GET /api/tenants/{tenantId}/entitlements`
- `GET /api/tenants/{tenantId}/features/check`
- `GET /api/tenants/{tenantId}/plans`
- `POST /api/tenants/{tenantId}/plans/upgrade`

### 12.4 秘钥与分销 API

- `POST /api/licenses/redeem`
- `GET /api/licenses/batches`
- `POST /api/licenses/batches`
- `GET /api/channels`
- `POST /api/channels/{channelId}/inventory/allocate`
- `GET /api/channels/{channelId}/settlements`

### 12.5 积分与计量 API

- `GET /api/tenants/{tenantId}/wallets`
- `GET /api/tenants/{tenantId}/ledger`
- `POST /api/metering/quote`
- `POST /api/metering/reserve`
- `POST /api/metering/settle`
- `POST /api/metering/release`
- `POST /api/credits/grant`

### 12.6 产品接入 API

供上层产品调用的平台接口建议包括：

- `POST /internal/access/check`
- `POST /internal/entitlements/resolve`
- `POST /internal/metering/quote`
- `POST /internal/metering/reserve`
- `POST /internal/metering/settle`
- `POST /internal/metering/release`

## 13. 数据库表设计建议

### 13.1 认证与租户域

- `users`
- `user_credentials`
- `user_oauth_accounts`
- `sessions`
- `tenants`
- `memberships`
- `invites`

### 13.2 权限域

- `roles`
- `permissions`
- `role_permissions`
- `membership_roles`

### 13.3 产品与权益域

- `products`
- `plans`
- `features`
- `plan_features`
- `entitlements`
- `entitlement_items`
- `subscriptions`

### 13.4 秘钥与分销域

- `license_batches`
- `license_keys`
- `license_activations`
- `channel_partners`
- `channel_inventory`
- `channel_settlements`
- `commission_rules`

### 13.5 积分与计量域

- `wallets`
- `credit_accounts`
- `ledger_entries`
- `meters`
- `price_rules`
- `consume_orders`
- `credit_expirations`

### 13.6 审计与风控域

- `audit_logs`
- `operation_logs`
- `risk_events`
- `idempotency_records`

## 14. 权限、权益、积分的协同关系

三者关系建议如下：

- `角色权限` 决定用户能否发起某个动作
- `产品权益` 决定该租户是否已开通该产品或功能
- `积分计量` 决定该动作能否继续执行以及本次应扣多少

例如：

- 用户是 `tenant_admin`
- 租户开通了 `AI短视频 Pro`
- 当前钱包仍有 800 点
- 该用户才能发起一次 4K 渲染任务

如果任一条件不满足，则应明确返回失败原因：

- 未登录
- 无租户访问权限
- 套餐未开通
- 功能未授权
- 席位不足
- 积分不足

**AI Star Eco 完整鉴权链路示例：**

```text
用户（producer / free 套餐）尝试铸造 NFT：

1. 认证层：校验 Access Token 有效（role=producer）✅
2. 权限层：校验 ai_singer.nft.mint 权限点
           → free 套餐无此权限 → 返回 403 MODULE_LOCKED
           → 前端显示"升级到专业版以解锁 NFT 铸造"

用户（producer / pro 套餐）触发第 11 次 NFT 铸造（本月已用 10 次）：

1. 认证层：校验 Access Token 有效 ✅
2. 权限层：校验 ai_singer.nft.mint 权限点 → pro 可用 ✅
3. 权益层：校验 nft_mint_quota → 本月配额 10/10 已用尽
           → 返回 403 PLAN_LIMIT_EXCEEDED
           → 前端显示"本月 NFT 铸造次数已达上限，升级企业版或等待下月重置"
```

## 15. 安全设计

### 15.1 认证安全

- Access Token 短期有效（建议 15 分钟）
- Refresh Token 支持轮换（每次刷新 AT 同时轮换 RT）
- 敏感操作支持二次验证（提现、账号注销）
- 支持设备与会话管理

### 15.2 Web3 认证安全

- 签名挑战（nonce）单次有效，5 分钟过期，使用后立即失效
- 挑战消息包含 `domain`、`uri`、`version`（遵循 EIP-4361 标准）
- 防止重放攻击：nonce 存入 Redis，验证后删除
- 钱包地址做小写标准化处理（防止大小写混淆绕过唯一性检查）
- 支持多钱包绑定，但每个钱包地址全局唯一对应一个平台账号

### 15.3 秘钥安全

- 秘钥只存 `hash`
- 兑换接口限流和风控
- 秘钥支持吊销和冻结
- 批次和单码都要有状态机

### 15.4 积分安全

- 扣费接口必须幂等
- 异步任务必须可回查订单号
- 禁止直接改余额
- 所有补点、退款都走流水冲正

### 15.5 数据安全

- 操作日志全量记录
- 后台改权行为审计
- 关键接口具备签名或内部鉴权
- 支持 IP、设备、用户维度风控
- 第三方 OAuth Token（DistroKid 等平台账号 Token）加密存储（AES-256）
- 钱包签名挑战过期清理任务

## 16. 技术实现建议

### 16.1 工程目录结构（AI Star Eco 实际项目）

```
ai-singer/
├── apps/
│   ├── server/          # 后端：Spring Boot 3 (Java 17)
│   │   └── src/main/java/com/aistareco/
│   │       ├── controller/  # REST 控制器（每个资源一个）
│   │       ├── service/     # 业务逻辑
│   │       ├── repository/  # Spring Data JPA
│   │       ├── model/       # JPA 实体
│   │       ├── dto/         # 请求/响应 DTO
│   │       ├── config/      # SecurityConfig、CorsConfig 等
│   │       └── common/      # ApiResponse、BusinessException 等
│   └── web/             # 前端：Next.js 14 (TypeScript)
│       └── src/
│           ├── app/         # Next.js App Router（页面路由）
│           ├── api/         # 前端 API 客户端层（调用后端）
│           ├── components/  # React 组件
│           ├── features/    # 业务功能模块（hooks + providers）
│           ├── types/       # TypeScript 类型定义（含 openapi 生成）
│           └── mocks/       # MSW mock 数据（本地开发用）
├── specs/
│   ├── openapi.yaml     # OpenAPI 3.1 接口规范（前后端共同维护）
│   └── unified-account-entitlement-platform.md  # 本文档
└── src/                 # Figma 原型工程（仅用于 UI 原型演示，不是真实工程）
    └── App.tsx          # Figma Make 导出的单文件原型
```

**重要说明：**

- `src/` 目录下的 `App.tsx`、`BACKEND_API_SPEC.md`、`PRODUCT_SPEC.md` 等文件属于 **Figma 原型工程**，仅用于产品原型演示和需求说明，**不是真实的工程实现**
- 真实后端实现在 `apps/server/`（Spring Boot）
- 真实前端实现在 `apps/web/`（Next.js）
- `specs/openapi.yaml` 是前后端共同遵守的接口契约，前端通过 `npm run codegen` 生成 TypeScript 类型

### 16.2 后端技术栈（apps/server）

**已确定采用 Spring Boot 3 + Java 17。**

```xml
<!-- 当前已有依赖（apps/server/pom.xml） -->
spring-boot-starter-web          → REST API
spring-boot-starter-data-jpa     → ORM
spring-boot-starter-validation   → 参数校验（@Valid）
h2database                       → 开发/测试内存数据库（生产需替换）
lombok                           → 样板代码生成
```

**认证平台需要新增的依赖：**

```xml
<!-- 认证与安全 -->
spring-boot-starter-security         → Spring Security（过滤器链、CORS、CSRF）
spring-security-oauth2-resource-server → JWT Bearer Token 验证
spring-security-oauth2-jose           → JWT 签发与解析（JJWT 或 Nimbus）

<!-- 数据库（生产替换 H2） -->
postgresql                            → 生产数据库驱动
flyway-core                           → 数据库版本迁移

<!-- 缓存（nonce / 限流 / 积分快照） -->
spring-boot-starter-data-redis        → Redis 客户端

<!-- 工具 -->
spring-boot-starter-actuator          → 健康检查、指标暴露
```

**Spring Boot 模块拆分建议（包结构）：**

```
com.aistareco/
├── identity/            # 认证中心模块
│   ├── controller/      # AuthController（注册/登录/OAuth/钱包）
│   ├── service/         # UserService、TokenService、OAuthService
│   ├── model/           # User、UserCredential、UserOAuthAccount、Session
│   └── config/          # SecurityConfig、JwtConfig
├── tenant/              # 租户模块
│   ├── controller/      # TenantController
│   ├── service/         # TenantService、MembershipService
│   └── model/           # Tenant、Membership、Invite
├── authz/               # 权限模块
│   ├── service/         # RoleService、PermissionService
│   └── model/           # Role、Permission、RolePermission
├── entitlement/         # 权益模块
│   ├── controller/      # EntitlementController
│   ├── service/         # EntitlementService、PlanService
│   └── model/           # Plan、Feature、Entitlement、Subscription
├── credit/              # 积分计量模块
│   ├── controller/      # CreditController、MeteringController
│   ├── service/         # WalletService、LedgerService、MeteringService
│   └── model/           # Wallet、CreditAccount、LedgerEntry、ConsumeOrder
├── audit/               # 审计模块
│   ├── service/         # AuditService（AOP 切面记录）
│   └── model/           # AuditLog、OperationLog
│
│   # 已有业务模块（保持，认证集成后加上 @CurrentUser 注解）
├── controller/          # SingerController、TrackController 等（已有）
├── service/             # SingerService、TrackService 等（已有）
└── model/               # Singer、Track 等（已有）
```

**Spring Security 配置原则：**

```java
// SecurityConfig 核心配置思路
@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    // 白名单：不需要认证的接口
    // POST /api/auth/register
    // POST /api/auth/login
    // POST /api/auth/oauth/**
    // GET  /api/auth/wallet/challenge
    // POST /api/auth/wallet/verify
    // GET  /api/singers (公开浏览)
    // 其余接口要求 Bearer JWT

    // JWT 验证：从 Authorization: Bearer <token> 中提取，校验签名和过期时间
    // 从 JWT claims 提取 user_id、role、tenant_id 注入 SecurityContext
}
```

### 16.3 前端技术栈（apps/web）

当前已有：Next.js 14（App Router）+ TypeScript + Tailwind CSS v4 + shadcn/ui

认证相关前端实现建议：

- 使用 `next-auth`（已有 `next-themes`，next-auth 集成成本低）或手动管理 JWT Cookie
- Access Token 存储：`httpOnly Cookie`（安全首选）或 `memory`，**不存 localStorage**
- Refresh Token 存储：`httpOnly Cookie`（防 XSS）
- API 客户端（`src/api/`）统一封装 `Authorization: Bearer` header 注入
- 路由保护：在 Next.js `middleware.ts` 中统一校验 Token，未登录重定向 `/portal`

```typescript
// apps/web/src/lib/http/fetcher.ts 扩展：自动注入 token
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken(); // 从 cookie/memory 取
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    await refreshToken(); // 尝试刷新
    return apiFetch(path, init); // 重试一次
  }
  return res.json();
}
```

### 16.4 OpenAPI 驱动的接口契约

项目已有 `specs/openapi.yaml`，认证平台新增接口同样在此维护：

- 后端 Spring Boot 通过 `springdoc-openapi` 自动生成/校验 openapi.yaml
- 前端通过 `npm run codegen`（`openapi-typescript` 工具）生成 `src/api/generated/schema.ts`
- 前端 `src/api/` 层使用生成的类型，确保类型安全

### 16.5 模块职责示意

```mermaid
flowchart TB
    WEB["apps/web\nNext.js 14"]
    API["apps/server\nSpring Boot 3"]

    subgraph modules["Spring Boot 模块"]
      ID[identity-module\n认证/Token/OAuth]
      TZ[tenant-module\n租户/成员]
      AZ[authz-module\nRBAC 权限]
      EN[entitlement-module\n权益/套餐]
      CM[credit-module\n积分/计量]
      AU[audit-module\n审计日志]
      BIZ[business-modules\nSinger/Track/Distribution]
    end

    DB[(PostgreSQL\n生产数据库)]
    H2[(H2\n开发/测试)]
    RD[(Redis\nnonce/缓存/限流)]
    SPEC["specs/openapi.yaml\n接口契约"]

    WEB -- "HTTP Bearer JWT" --> API
    API --> ID & TZ & AZ & EN & CM & AU & BIZ
    ID & TZ & AZ & EN & CM & AU & BIZ --> DB
    ID --> RD
    CM --> RD
    SPEC -. "codegen" .-> WEB
    SPEC -. "springdoc validate" .-> API
```

## 17. 关键规则建议

### 17.1 套餐升级规则

- 升级立即生效
- 剩余时长按规则折算
- 功能按高等级覆盖
- 席位和额度按目标套餐重算或叠加

### 17.2 续费规则

- 订阅未过期时，续费追加到期时间
- 已过期时，重新计算生效周期

### 17.3 点数规则

- 赠送点可设置到期时间
- 月赠点按月重置，不长期累计
- 加油包点数可独立有效期
- 过期点数通过系统任务自动失效并记流水

### 17.4 渠道规则

- 不同渠道可绑定不同价格体系
- 渠道库存必须可盘点
- 激活归属决定售后和分佣归属

### 17.5 AI Star Eco 艺人签约收益分配规则

以下两套分配规则由业务层执行，认证/权益层不参与计算，但需在权益体系中检查操作方是否有签约权限：

```
挂牌签约费分配：
  卖家（原创者/发布方）实际到手 = signing_price × 80%
  平台服务费                   = signing_price × 20%

艺人后续运营收益分成：
  买家（运营方/MCN）  = 70%
  原创者              = 30%
```

### 17.6 NFT 版税规则（第三期实现）

- 版税比例由铸造者在铸造时配置（0–100%，平台建议 5–15%）
- 版税仅适用于二级市场交易，一级铸造收益 100% 归铸造者
- 版税收益通过链上智能合约自动执行，平台不介入
- 平台在权益层只负责校验铸造权限（`nft_mint_quota`），不管理链上版税

## 18. 非功能性要求

平台应满足以下非功能性要求：

- 高可用：认证和扣费接口需高可用部署
- 可扩展：新增产品和套餐无需大改代码
- 可审计：关键业务动作均可追踪
- 可配置：套餐、功能、价格、渠道策略尽量后台配置化
- 可回滚：关键扣费和改权操作支持补偿
- 可观测：具备日志、指标、链路追踪

## 19. 分阶段落地路线

> **注意**：根据产品规划调整为三期，每期聚焦清晰的业务目标。

### 19.1 第一期：核心主链路（当前阶段）

**目标**：打通"账户入驻 → 创建虚拟艺人 → 生成音乐/MV视频 → 公开发行"完整主链路。

**工程范围**：`apps/server`（Spring Boot）+ `apps/web`（Next.js）

#### Step 1 — 账户入驻

| 功能                       | 后端实现                                          | 前端实现              |
| ------------------------ | --------------------------------------------- | ----------------- |
| 邮箱注册/登录                  | `POST /api/auth/registerPOST /api/auth/login` | `/portal` 页面登录入口  |
| Google OAuth 登录          | `POST /api/auth/oauth/google`                 | Google 登录按钮       |
| 微信 OAuth 登录              | `POST /api/auth/oauth/wechat`                 | 微信扫码/授权           |
| JWT 颁发与刷新                | `POST /api/auth/refresh`                      | `fetcher.ts` 自动刷新 |
| 获取当前用户信息                 | `GET /api/me`                                 | 全局 user context   |
| 角色选择（fan/producer/coach） | 注册时写入 User.role                               | `/portal` 角色选择页   |
| 用户基本信息完善                 | `PATCH /api/me`                               | 个人资料页             |

**Spring Boot 新增实体（第一期）：**

```java
// 第一期必须新建的表（Flyway migration）
users                  // 用户主表（含 role、plan、status）
user_credentials       // 密码凭证（bcrypt hash）
user_oauth_accounts    // Google/微信 OAuth 账号绑定
sessions               // 会话记录（含 device_type、login_method）
```

**第一期暂不实现：** 钱包登录（第三期）、MFA（第二期后）、SSO（第三期）

#### Step 2 — 创建虚拟艺人

| 功能       | 后端现状                         | 第一期补充                             |
| -------- | ---------------------------- | --------------------------------- |
| 创建歌手草稿   | ✅ `POST /api/singers`        | 加上 `owner_user_id` 字段，关联当前登录用户    |
| 编辑歌手参数   | ✅ `PUT /api/singers/{id}`    | 增加所有权校验（只能编辑自己的）                  |
| 查询我的歌手列表 | ✅ `GET /api/singers/my`      | 从请求 JWT 取 `user_id` 过滤            |
| 歌手名额限制   | ❌ 未实现                        | 依据 User.plan 判断：free ≤ 3，pro ≤ 20 |
| 删除/归档歌手  | ✅ `DELETE /api/singers/{id}` | 增加所有权校验                           |

**Spring Boot 改造点：**

- `Singer` 实体新增 `ownerUserId` 字段
- `SingerController` 所有接口从 `SecurityContext` 注入当前用户，替换之前无认证的调用
- `SingerService.create()` 校验歌手名额上限

#### Step 3 — 生成音乐/MV视频

| 功能     | 后端现状                          | 第一期补充                         |
| ------ | ----------------------------- | ----------------------------- |
| 提交生成任务 | ✅ `POST /api/tracks/generate` | 预扣 5 积分，任务完成后结算               |
| 查询我的曲目 | ✅ `GET /api/tracks/my`        | 从 JWT 取 `user_id` 过滤          |
| 积分预扣接口 | ❌ 未实现                         | `POST /api/metering/reserve`  |
| 积分结算接口 | ❌ 未实现                         | `POST /api/metering/settle`   |
| 积分不足提示 | ❌ 未实现                         | 返回 `402 INSUFFICIENT_CREDITS` |

**Spring Boot 新增实体（第一期）：**

```java
wallets                // 积分钱包（每个用户一个）
ledger_entries         // 不可变积分流水
consume_orders         // 预扣订单（关联异步任务）
```

**积分初始化规则（第一期简化版）：**

- 注册送 100 积分（`gift_credit`）
- 音乐/视频生成消耗 5 积分/次
- 任务失败全额退回
- 暂不实现：月度套餐积分重置（第二期）

#### Step 4 — 公开发行

| 功能     | 后端现状                               | 第一期补充                      |
| ------ | ---------------------------------- | -------------------------- |
| 提交发行申请 | ✅ `POST /api/distribution/publish` | 增加认证，绑定 `user_id`          |
| 查询发行状态 | 已有基础                               | 加用户过滤                      |
| 发行渠道控制 | ❌ 未实现                              | 第一期：仅允许"国内平台"；验证 User.plan |

**第一期发行说明：**

- 第一期发行只做"平台内公开"（歌手/曲目状态变为 `published`，在平台展示）
- 对接 DistroKid、腾讯音乐人等外部版权平台属于**第二期**

**第一期数据库表汇总：**

```
新增表：
  users, user_credentials, user_oauth_accounts, sessions
  wallets, ledger_entries, consume_orders

改造表（新增字段）：
  singers → 新增 owner_user_id
  tracks  → 新增 owner_user_id, consume_order_id
```

### 19.2 第二期：版权对接与渠道分发

**目标**：对接外部版权/发行平台，实现真实的音乐分发链路。

包含：

- **外部平台账号绑定**（DistroKid、腾讯音乐人、网易云音乐人 OAuth 授权）
- 曲目提交到外部平台（调用外部 API）
- 版权信息录入（ISRC 码、作曲/作词署名）
- 发行收益回流与财务中心
- 套餐升级（pro/enterprise 解锁更多发行渠道）
- 渠道库存与分销体系（LicenseBatch / ChannelPartner）
- 掌门人-学员关系体系（MCN Coach 角色完整集成）
- MFA 二次验证

### 19.3 第三期：NFT 与 Web3 集成

**目标**：实现链上资产铸造、交易与 Web3 身份认证。

包含：

- **MetaMask/WalletConnect 钱包登录**（EIP-4361 签名认证）
- NFT 合集铸造（ERC-721/ERC-1155 智能合约集成）
- NFT 版税配置（铸造时设定 royaltyBPS）
- NFT 二级市场展示与交易
- 链上资产与平台账号的绑定/解绑
- Fan DAO 治理模块（投票权益）
- 标准 OIDC SSO 与开放平台 SDK

## 20. 结论

建议将该能力建设为一套独立的统一平台，而不是分散实现于每个业务产品中。

平台的本质不是单一认证中心，而是：

- `统一认证中心`
- `统一租户中心`
- `统一权限中心`
- `统一权益中心`
- `统一秘钥与分销中心`
- `统一积分与计量中心`

最终设计原则可归纳为一句话：

> 账号体系负责认证，RBAC 负责授权，Entitlement 负责商业开通，Credit 负责按次计量，License 负责兑换和分销。

在该模型下，`AI歌手`、`AI短视频`、`AI艺人` 等不同产品都可以复用统一底座，并保持后续扩展新产品、新套餐、新积分规则时的稳定性和可维护性。

***

## 附录 B：管理后台界面设计（Admin Console）

> 本附录描述统一认证平台需要提供的管理后台界面规划，包括运营人员和平台管理员的操作界面。

### B.1 后台定位与访问权限

管理后台（Admin Console）是面向平台运营人员的内部工具，与面向用户的 AI Star Eco 产品前端完全独立：

| 维度   | 用户侧前端（apps/web）                | 管理后台（apps/web/admin）                      |
| ---- | ------------------------------ | ----------------------------------------- |
| 访问路径 | `/portal`、`/producer`、`/fan` 等 | `/admin/*`                                |
| 目标用户 | 普通用户（Fan / Producer / Coach）   | 平台运营、财务、客服、技术管理员                          |
| 认证方式 | 标准 JWT 登录                      | JWT + 平台级角色校验（需 `platform_operator` 以上角色） |
| 访问控制 | 前端路由 + 后端接口鉴权                  | middleware.ts 强制拦截，非管理员 302 到 /portal     |

### B.2 后台导航结构

```
Admin Console
├── 概览看板           /admin
├── 用户管理
│   ├── 用户列表       /admin/users
│   ├── 用户详情       /admin/users/[id]
│   └── 封禁记录       /admin/users/moderation
├── 租户管理
│   ├── 租户列表       /admin/tenants
│   └── 租户详情       /admin/tenants/[id]
├── 角色与权限
│   ├── 角色列表       /admin/roles
│   └── 权限点管理     /admin/permissions
├── 套餐与权益
│   ├── 套餐配置       /admin/plans
│   ├── 功能点管理     /admin/features
│   └── 权益详情       /admin/entitlements
├── 积分与计量
│   ├── 积分概览       /admin/credits
│   ├── 手动补点/扣点  /admin/credits/adjust
│   └── 价格规则       /admin/price-rules
├── 卡密管理
│   ├── 批次列表       /admin/licenses
│   ├── 创建批次       /admin/licenses/create
│   └── 吊销秘钥       /admin/licenses/revoke
├── 审计日志           /admin/audit
├── 风控事件           /admin/risk
└── 系统设置           /admin/settings
```

### B.3 各模块页面设计

#### B.3.1 概览看板（/admin）

核心指标卡片（今日 / 本周 / 本月维度可切换）：

| 指标          | 展示方式           |
| ----------- | -------------- |
| 今日新注册用户数    | 数字卡 + 环比趋势箭头   |
| 活跃用户数（DAU）  | 数字卡 + 折线迷你图    |
| 今日积分消耗总量    | 数字卡 + 条形分布图    |
| 今日 AI 生成任务数 | 数字卡（成功 / 失败分类） |
| 套餐升级转化数     | 数字卡 + 漏斗图      |
| 待处理风控事件数    | 红色高亮 + 快速跳转按钮  |
| 卡密兑换数       | 数字卡            |

快捷操作入口：批量补点（应急处理）、生成卡密批次、查看最新审计日志

***

#### B.3.2 用户管理（/admin/users）

**用户列表页核心列：**

| 列        | 说明                                  |
| -------- | ----------------------------------- |
| 头像 + 用户名 | 可点击跳转详情                             |
| 邮箱 / 手机号 | 脱敏展示（中间替换为 `****`）                  |
| 注册方式     | email / google / wechat 等 Tag 标签    |
| 角色       | fan / producer / coach Badge        |
| 套餐       | free / pro / enterprise Badge       |
| 积分余额     | 数字                                  |
| 账号状态     | active（绿）/ suspended（红）/ deleted（灰） |
| 注册时间     | 可排序                                 |
| 操作列      | 查看详情、封禁、补点、重置密码                     |

筛选条件：角色、套餐、状态、注册时间范围、注册渠道、关键词搜索

**用户详情页（/admin/users/\[id]）分 Tab：**

- **基本信息**：头像、姓名、邮箱、手机、注册方式、注册 / 最后登录时间、所属租户
- **登录设备**：活跃会话列表（IP、设备类型、登录时间）+ 单个强制下线按钮
- **第三方账号**：Google / 微信 / 钱包地址绑定列表
- **权益信息**：当前套餐、各权益项明细、到期时间
- **积分详情**：各科目余额 + 最近 50 条流水（不可变展示）
- **歌手列表**：该用户创建的 AI 歌手
- **操作记录**：最近审计日志

**可执行操作（操作均写入 AuditLog）：**

| 操作        | 权限要求                | 是否需要二次确认     |
| --------- | ------------------- | ------------ |
| 封禁账号      | `platform_operator` | 是，需填封禁原因     |
| 解封账号      | `platform_operator` | 是            |
| 强制下线所有设备  | `platform_operator` | 是            |
| 手动补点      | `finance_admin`     | 是，需填原因 + 金额  |
| 手动扣点      | `finance_admin`     | 是            |
| 修改套餐      | `platform_operator` | 是            |
| 重置密码（发邮件） | `platform_operator` | 是            |
| 删除账号（软删除） | `platform_owner`    | 是，需二次输入用户名确认 |

***

#### B.3.3 租户管理（/admin/tenants）

**租户列表页核心列：**

| 列    | 说明                  |
| ---- | ------------------- |
| 租户名称 | 可点击跳转               |
| 类型   | 个人工作室 / 企业 / MCN 机构 |
| 成员数  | 数字                  |
| 当前套餐 | Badge               |
| 积分余额 | 数字                  |
| 创建时间 | 可排序                 |
| 操作   | 详情、冻结租户             |

**租户详情页分 Tab：**

- 基本信息（名称、类型、创建者、创建时间）
- 成员列表（成员 + 角色，可踢出成员）
- 套餐与权益（当前订阅，各权益项）
- 钱包与积分（租户钱包余额、科目详情、流水）
- 旗下歌手（该租户下所有 AI 歌手）

***

#### B.3.4 套餐与权益管理（/admin/plans）

> 后台配置化管理套餐和功能点，避免代码中硬编码业务规则。

**套餐配置页：** 展示 free / pro / enterprise 套餐卡片，每张卡片可编辑：

- 套餐名称与描述
- 月度价格 / 年度价格
- 包含的功能点列表（从 Feature 表多选）
- Quota 上限（歌手名额、NFT 铸造次数、积分月配额）

**功能点管理页核心列：**

| 列            | 说明                     |
| ------------ | ---------------------- |
| Feature Code | 如 `ai_singer.nft.mint` |
| 名称           | 展示名                    |
| 描述           | 功能说明                   |
| 关联套餐         | 哪些套餐包含此功能              |
| 状态           | 启用 / 禁用（全局开关）          |

***

#### B.3.5 积分与计量管理（/admin/credits）

**积分概览页：**

- 全平台积分总量（各科目汇总饼图）
- 今日消耗 / 充入 / 退回趋势折线图
- 待结算预扣订单列表（长时间悬挂的异常订单，超过 10 分钟未结算高亮）

**手动调账页（/admin/credits/adjust）：**

| 表单字段      | 说明                    |
| --------- | --------------------- |
| 目标用户 / 租户 | 搜索框选择，显示当前余额          |
| 操作类型      | 补赠 / 扣除 / 手动过期        |
| 积分科目      | 通用点数 / AI音乐点数 / 赠送点数等 |
| 金额        | 正整数                   |
| 备注原因      | 必填，用于审计               |
| 操作人       | 当前管理员自动填充（只读）         |

提交后：后端创建对应 `LedgerEntry` 流水记录 + 写入 `AuditLog`，**严禁直接修改余额字段**。

**价格规则管理（/admin/price-rules）：**

| 字段    | 说明                                       |
| ----- | ---------------------------------------- |
| 计量项   | `music.generate`、`video.render.minute` 等 |
| 套餐级别  | free / pro / enterprise                  |
| 消耗积分数 | 每次操作扣除数量                                 |
| 生效时间段 | 支持活动期降价（可设置开始/结束时间）                      |
| 状态    | 启用 / 禁用                                  |

***

#### B.3.6 卡密管理（/admin/licenses）

**批次列表页核心列：**

| 列    | 说明                 |
| ---- | ------------------ |
| 批次号  | 唯一 ID              |
| 关联套餐 | pro / enterprise   |
| 卡密类型 | 时长兑换 / 积分包 / 席位扩容  |
| 进度   | 总量 / 已激活 / 剩余（进度条） |
| 渠道归属 | 渠道名称               |
| 有效期  | 开始～结束              |
| 状态   | 正常 / 已过期 / 已吊销     |
| 操作   | 查看卡密列表、吊销整批        |

**创建批次表单（/admin/licenses/create）：**

- 关联产品、套餐类型、卡密类型
- 生成数量、有效期范围
- 渠道归属（选择 ChannelPartner）
- 备注说明

**卡密详情页（/admin/licenses/\[batchId]）：**

展示该批次所有卡密状态，每行可单独吊销：

- 卡密 Hash（脱敏展示，仅显示前4后4字符）
- 状态（created / sold / activated / revoked）
- 激活用户（已激活的显示用户名 + 激活时间）
- 单条吊销按钮（需填原因）

***

#### B.3.7 审计日志（/admin/audit）

**列表页核心列：**

| 列     | 说明                                               |
| ----- | ------------------------------------------------ |
| 时间    | 精确到毫秒，可按时间范围筛选                                   |
| 操作人   | 用户名 + 角色 Tag                                     |
| 操作类型  | `user.suspend`、`credit.grant`、`license.revoke` 等 |
| 操作目标  | 目标实体 ID + 类型                                     |
| IP 地址 | 可点击查看该 IP 的历史操作                                  |
| 结果    | 成功（绿）/ 失败（红）                                     |
| 详情    | 展开显示请求参数和变更前后 diff                               |

筛选条件：操作人、操作类型、时间范围、IP、目标实体类型

**注意：审计日志只读，后台不提供任何删除或修改按钮。**

***

#### B.3.8 风控事件（/admin/risk）

**事件列表核心列：**

| 列    | 说明                         |
| ---- | -------------------------- |
| 风险等级 | 高（红）/ 中（橙）/ 低（黄）           |
| 触发类型 | 异地登录 / 频繁兑换 / 批量生成 / 可疑注册等 |
| 相关用户 | 用户名 + 跳转详情链接               |
| 触发时间 | <br />                     |
| 状态   | 待处理 / 已处理 / 标记误报           |
| 操作   | 处理（填处理说明）/ 标记误报 / 封禁用户快捷入口 |

***

### B.4 后台访问控制矩阵

| 模块            | platform\_owner | platform\_operator | finance\_admin | channel\_manager |
| ------------- | :-------------: | :----------------: | :------------: | :--------------: |
| 概览看板          |        ✅        |          ✅         |        ✅       |         ✅        |
| 用户列表 / 详情（只读） |        ✅        |          ✅         |        ✅       |         ❌        |
| 封禁 / 解封用户     |        ✅        |          ✅         |        ❌       |         ❌        |
| 强制下线设备        |        ✅        |          ✅         |        ❌       |         ❌        |
| 删除账号（软删除）     |        ✅        |          ❌         |        ❌       |         ❌        |
| 租户管理（只读）      |        ✅        |          ✅         |        ✅       |         ❌        |
| 租户冻结          |        ✅        |          ✅         |        ❌       |         ❌        |
| 套餐配置编辑        |        ✅        |          ✅         |        ❌       |         ❌        |
| 积分补点 / 扣点     |        ✅        |          ❌         |        ✅       |         ❌        |
| 价格规则管理        |        ✅        |          ❌         |        ✅       |         ❌        |
| 卡密批次创建        |        ✅        |          ✅         |        ❌       |         ✅        |
| 卡密吊销          |        ✅        |          ✅         |        ❌       |         ✅        |
| 渠道管理          |        ✅        |          ❌         |        ❌       |         ✅        |
| 审计日志（只读）      |        ✅        |          ✅         |        ✅       |         ✅        |
| 风控事件处理        |        ✅        |          ✅         |        ❌       |         ❌        |
| 系统设置          |        ✅        |          ❌         |        ❌       |         ❌        |

### B.5 后台工程实现规划：apps/admin 独立站点

#### B.5.1 为什么独立而不嵌入 apps/web

| 维度        | 嵌入 apps/web（/admin/\* 路由）          | 独立 apps/admin 站点                             |
| --------- | ---------------------------------- | -------------------------------------------- |
| **安全隔离**  | Admin 组件代码编译进同一 JS bundle，用户侧可离线分析 | Admin bundle 完全不出现在用户侧，攻击面更小                 |
| **部署隔离**  | 必须与用户侧同步发布，无法部署到内网/VPN             | 可独立部署到内网、设置 IP 白名单，不对公网暴露                    |
| **迭代节奏**  | admin 改动会触发用户侧 CI/CD 流程            | admin 可随时独立发布，不影响用户侧版本管理                     |
| **UI 风格** | 受产品侧暗色主题/多语言/动效约束                  | 可选更适合数据密集场景的 UI 风格（亮色系、高密度表格）                |
| **后端复用**  | 同一套 Spring Boot，/api/admin/\*\* 路径 | 同一套 Spring Boot，/api/admin/\*\* 路径（**完全相同**） |

**结论：Admin 站点应作为独立工程** **`apps/admin`，后端完全复用现有 Spring Boot，只是部署和 Bundle 隔离。**

#### B.5.2 monorepo 目录结构

```
ai-singer/
├── apps/
│   ├── server/          # Spring Boot 后端（现有，不变）
│   ├── web/             # 用户侧前端 Next.js（现有，不变）
│   └── admin/           # 管理后台 Next.js（新建独立工程）
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx          # 根布局（字体、主题）
│       │   │   ├── login/
│       │   │   │   └── page.tsx        # Admin 登录页
│       │   │   ├── (dashboard)/        # 需要登录的路由组
│       │   │   │   ├── layout.tsx      # Admin Shell（侧栏 + 顶栏）
│       │   │   │   ├── page.tsx        # 概览看板
│       │   │   │   ├── users/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── moderation/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── page.tsx
│       │   │   │   ├── tenants/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── page.tsx
│       │   │   │   ├── roles/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── plans/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── features/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── credits/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   └── adjust/
│       │   │   │   │       └── page.tsx
│       │   │   │   ├── price-rules/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── licenses/
│       │   │   │   │   ├── page.tsx
│       │   │   │   │   ├── create/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   └── [batchId]/
│       │   │   │   │       └── page.tsx
│       │   │   │   ├── audit/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── risk/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── settings/
│       │   │   │       └── page.tsx
│       │   ├── components/
│       │   │   ├── ui/              # shadcn/ui（独立安装）
│       │   │   ├── admin-shell.tsx  # 侧栏 + 顶栏布局
│       │   │   ├── data-table.tsx   # 通用数据表格（带分页、筛选）
│       │   │   ├── stat-card.tsx    # 指标卡
│       │   │   └── confirm-dialog.tsx # 二次确认对话框
│       │   ├── lib/
│       │   │   ├── api/             # Admin API 客户端
│       │   │   └── auth.ts          # Token 读取、角色校验
│       │   └── middleware.ts        # 路由守卫（非 admin 角色重定向到 /login）
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.mjs
└── specs/
    ├── openapi.yaml                 # 统一接口契约（admin + web 共用）
    └── unified-account-entitlement-platform.md
```

#### B.5.3 与 apps/web 的共享策略

Admin 和 Web 之间**不共享运行时代码**，但共享以下内容：

| 共享内容              | 方式                                                  |
| ----------------- | --------------------------------------------------- |
| OpenAPI 接口定义      | 共用 `specs/openapi.yaml`，各自运行 `npm run codegen` 生成类型 |
| TypeScript 类型（可选） | 如果 monorepo 配置了 `packages/types` 共享包可引用，否则各自生成      |
| shadcn/ui 组件库     | 各自独立安装，**不共享组件代码**（admin 可用不同版本/配置）                 |
| Spring Boot 后端    | 完全共用，admin 只是不同的 API 调用方                            |

#### B.5.4 部署方案

```
┌─────────────────────────────────────────────────────┐
│  公网（CDN / Vercel / Nginx）                         │
│  apps/web   → https://aistareco.com                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  内网 / VPN（或 IP 白名单）                            │
│  apps/admin → https://admin.aistareco.com           │
│              （或仅内网可达）                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  共用后端（公网 + 内网均可达）                           │
│  apps/server → https://api.aistareco.com            │
│  CORS 白名单：aistareco.com + admin.aistareco.com    │
└─────────────────────────────────────────────────────┘
```

后端 Spring Boot 对应新增 `/api/admin/**` 接口路由，统一要求 `platform_operator` 以上角色（通过 `@PreAuthorize("hasRole('PLATFORM_OPERATOR')")` 注解实现）。

***

## 附录 A：AI Star Eco 认证中心问题清单与对应完善内容

> 本附录总结了原始方案对 AI Star Eco 产品逻辑的不足，以及本次完善所做的针对性补充。

| 问题类别           | 原始方案缺失                                         | 本次完善内容                                                                    |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| 工程目录不明确        | 未说明后端/前端/原型的工程边界                               | 16.1 明确了 apps/server（Spring Boot）、apps/web（Next.js）、src/（Figma 原型）三者的职责边界 |
| 技术栈错误          | 误将 Hono/TypeScript/Supabase 当作后端技术栈            | 16.2 更正为 Spring Boot 3 + Java 17，并列出认证平台需新增的 Maven 依赖和包结构规划               |
| 前端认证集成缺失       | 未说明 Next.js 前端如何集成 JWT                         | 16.3 补充了前端 fetcher 自动注入 token、httpOnly Cookie 存储、middleware 路由保护方案        |
| OpenAPI 契约未提及  | 未利用已有的 specs/openapi.yaml                      | 16.4 说明了 openapi.yaml 作为前后端契约、前端 codegen 生成类型的工作流                         |
| Web3 钱包认证      | 仅提及"第三方 OAuth 登录"，未说明 MetaMask/钱包签名流程          | 6.2.1 补充了完整的 EIP-4361 签名认证流程、nonce 安全机制                                   |
| 微信 OAuth       | 未明确提及微信，仅说"第三方 OAuth"                          | 6.2.2 补充了微信网页授权、openid/unionid 处理规则                                       |
| 平台账号绑定混淆       | 未区分登录 OAuth 与业务绑定 OAuth                        | 6.2.4 明确了登录认证 vs 发行平台账号绑定的边界，前者走认证中心，后者由业务层独立管理                           |
| 掌门人特殊角色        | 未涉及 Coach 角色的特殊认证需求                            | 6.2.3 补充了掌门人角色登录、会话携带 squad 信息、审批操作审计要求                                   |
| 分阶段路线不正确       | 第一期包含 NFT 和版权对接，与产品规划不符                        | 19 重写为三期：第一期主链路、第二期版权对接、第三期 NFT，每期有明确的功能边界                                |
| 第一期 Step 交付物不清 | 缺少每个步骤的具体 API 和数据库改造点                          | 19.1 按 4 个 Step 列出了每步的后端/前端实现要求和 Spring Boot 改造点                          |
| 现有代码与认证集成脱节    | 未说明已有的 SingerController/TrackController 如何集成认证 | 19.1 Step 2/3 说明了现有接口需要加 SecurityContext 注入、所有权校验等改造                      |
| 角色权限不具体        | 权限点举例过于泛化，与产品脱节                                | 7.2 补充了 AI Star Eco 完整权限点列表及各角色/套餐权限矩阵                                    |
| 套餐限额未落地        | 套餐体系未与产品功能对应                                   | 8.2 补充了 free/pro/enterprise 各功能限额对照表                                      |
| 积分扣费规则不具体      | 仅有抽象的三阶段模型                                     | 10.5 补充了 AI Star Eco 各操作的积分消耗规则表                                          |
| 权益类型不足         | 未包含歌手名额、NFT 铸造配额等 AI 产品特有权益                    | 8.4 补充了 singer\_slot、nft\_mint\_quota、distribution\_tier、model\_tier 权益类型 |

