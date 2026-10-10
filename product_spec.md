# AI Star Eco — 数据模型对齐规范（Product Spec）

> 本文档是「前端 (`apps/web`) ↔ 后端 (`apps/server`) ↔ 管理后台 (`apps/admin`)」数据模型对齐的**契约文件**。
> 一切以 **前端 TypeScript 类型为准**，后端 Java/JPA + MySQL Schema 必须服从前端约束。
> 字段格式遵循「**后端存数字、前端做格式化**」的总原则。
>
> **版本对齐**：本 spec 当前对齐 v2.7（2026-05-06），重新聚焦在「围绕 AI 艺人的多玩法 AI 产品」上。NFT、版权核验、演唱会售票、短剧 / 电影 / 商业广告 / 配音作品等深链路功能**本期暂不实现**（保留字段但 UI 不暴露），详见 §13 产品版图。

---

## 0. 核心产品逻辑（最高优先级）

### 0.0 产品定位 — AI 艺人 × 多玩法版图

平台围绕两条 **AI 艺人主线** 构建：

| 主线 | 主体表 | 来源说明 | 核心玩法 |
|------|--------|----------|----------|
| **纯虚拟数字人** | `DigitalIp`（§4.1） | 用户在「AI 孵化 / AI 形象锻造」中从零创造的虚拟艺人 | 音乐生成发行（§10）、形象锻造、衣帽间换装、（未来）短视频 / 直播 |
| **AI 化明星** | `CelebrityStar`（§12） | 平台采购真人明星授权 + 数字孪生形象 | 带货视频生成（模板 / 盲盒双模式）、商品库、批量分发 |

两条主线**共享**同一套基础设施：钱包 / 点数（§1.3）、License（§2）、Studio 主体（§1.6）、积分计费（§0.1）、商品库（§12.4）、统一分发管道。

**当前迭代聚焦的 AI 玩法**：

1. **音乐工坊**（§10）— DigitalIp 唱歌曲，Album 降级为歌单
2. **AI 形象锻造**（ForgeResult / ForgeTemplate）— 给 DigitalIp 出形象图
3. **衣帽间 v2**（Wardrobe）— 装备搭配 + 一键锻造融合形象
4. **AI 明星专区**（§12 ★ 本期新增）— CelebrityStar 带货视频生成与分发，含商品库

**暂不实现 / 隐藏的深链路功能**：
- NFT / 数字藏品（`NftCollection` / `/monetization/nft`）
- 版权核验（`CopyrightRecord` / `/content/copyright`）
- 演唱会售票（`Concert` 的 ticket / capacity / sold 字段）
- 短剧 / 电影 / 商业广告 / 配音作品（`Drama` / `Movie` / `Advertisement` / `VoiceWork`）
- 粉丝打赏 / 社群高级运营 / 异常风控

> 这些功能的字段在数据库与 DTO 层**保留但冻结**，前端不展示对应入口；在 §13 产品版图中标记为 future scope。


### 0.1 计费模型 — 一切以「点数 / Credits」结算（无订阅）

- **唯一计费单位**：`credits`（点数 / 积分）
  - 后端字段类型：`BIGINT`（不再使用「分 / cents」「金额」等表达）
  - 业务含义：1 credit = 平台内可消费的最小计费颗粒
- **没有任何业务功能直接以现金结算**。所有业务行为（带货分润、内容播放、生成扣费等）最终都体现为「点数变动」。
  - 法币 ↔ 点数 的兑换属于「充值 / Recharge」流程，独立于业务系统。
  - 提现 = 点数 → 法币的反向兑换，挂在钱包模块外。
- **没有订阅 / 套餐概念**。点数的来源只有三种：
  1. **License 兑换**：注册时核销 License Key 一次性入账（金额由 License 所属 Batch 决定）
  2. **充值 / Recharge**：用户付费购买点数（自助充值流程，非本规范主体）
  3. **业务收益**：内容播放分成、带货 GMV 抽成、版税等结算入账（type = `income`）
- 不存在「月度配发 / 自动续费 / 套餐升级」流程。

### 0.2 License — 注册鉴权 + 初始点数发放

- License 同时承担两个职责：
  1. **入场券**：注册 / 绑定账号时核销，关联到对应 `Tenant`
  2. **初始点数包**：核销时按 Batch 配置的 `initialCreditGrant` 一次性入账到用户钱包
- 不同 Batch 可以配置不同的初始点数：
  - 例：基础版 Batch = 1,000 credits；高级版 Batch = 10,000 credits；活动版 Batch = 50,000 credits
  - **当前阶段所有 Batch 默认配相同金额**，但 Schema 支持差异化
- 核销后 License 标记为 `ACTIVATED`，发放方可统计核销率与累计发放点数
- 旧字段全部废弃：`licenseType` / `creditDelta` / `durationDays` / `settlementMode`
- 新字段：`initialCreditGrant: BIGINT`（写在 LicenseBatch 表）
- **v0.53 子应用范围**：`LicenseBatch.platforms`（CSV，null/空 = 全站可用）声明该批次可激活的
  子产品（music / drama / celebrity / aiavatar）。非空批次激活时按批次授权账号的
  `platforms`（优先于注册来源策略）；积分仍入单一钱包，额度走本批次 `initialCreditGrant`
  （如「仅 aiavatar · 1000 credits」批次）。已登录账号可经 `POST /api/me/license/activate`
  追加激活新秘钥（合并开通子应用 + 追加发放积分，不换号）。

### 0.3 Tenant — 用户归属载体

- `Tenant` 现在仅有 **一个**核心职责：**记录该用户由哪个发放方导入**。
  - 个人用户走自助注册的，归属到「平台默认 Tenant」或新建一个 `PersonalTenant`
  - 通过机构 License 注册的，归属到「机构 Tenant」（即 `LicenseBatch.ownerTenantId`）
- 发放方（机构）通过查询「自家 Tenant 下的 Membership 数」来知道 License 核销率
- **Tenant 不再持有 Wallet。Wallet 挂到 `AepUser`**（个人钱包）—— 见 §1.3

### 0.4 用户主体的命名（待用户确认）

当前 `AepUser.role` 枚举混用了「IP 身份」与「业务主体身份」（`AI_SINGER` / `AI_ARTIST` / `ECONOMIC_COMPANY`）。需要拆分为两个独立概念：

#### 概念 A — **业务主体（登录方）**：
对应「经纪公司 / 工作室 / 个人创作者」，是登录后的运营操作者。

| 候选名称       | 优点                                  | 缺点                          |
| -------------- | ------------------------------------- | ----------------------------- |
| `Studio`       | 业内通用，覆盖音乐工作室/短剧工作室/经纪公司 | 个人创作者场景略显正式        |
| `Entity`       | 通用                                  | 太泛、无业务语义              |
| `Operator`     | 体现「运营」属性                      | 偏后台用语                    |
| `Producer`     | 与前端「制作人 / Producer」呼应       | 侧重个人，不覆盖机构          |

> **本规范推荐 `Studio`**：未来对接「短剧工作室、音乐工作室、综艺工作室」时，`MusicStudio` / `DramaStudio` / `VarietyStudio` 都是自然子类型；个人创作者也可视为「单人 Studio」。

#### 概念 B — **被运营的 IP / 数字内容**：
对应「AI 歌手、AI 演员、未来的短剧 IP、音乐 IP」等被孵化和商业化的对象。

| 候选名称        | 优点                              | 缺点                             |
| --------------- | --------------------------------- | -------------------------------- |
| `DigitalIp`     | 准确，符合行业「IP」语境          | 缩写「Ip」在代码里会与 IP 地址歧义 |
| `DigitalContent`| 通用                              | 「Content」更像「内容文件」，不像「IP 主体」|
| `IpAsset`       | 清晰                              | 偏金融/版权语境                  |
| `VirtualPersona`| 强调虚拟人格                      | 不覆盖「短剧 IP」这种非人格化对象 |

> **本规范推荐 `DigitalIp`**（数据库表名 `digital_ips`，代码用 `DigitalIp`）：
> - 涵盖未来的 `MusicIp` / `DramaIp` / `VarietyIp` 子分类（用 `kind` 字段区分）
> - 现有 `Singer` / `OfficialIp` 表合并到 `digital_ips`
> - 字段 `kind` 取值：`singer | actor | drama | music_ip | variety_ip | ...`

> **若用户偏好 `digital_content`，本规范的全部字段定义同样适用**，仅替换表名/类名即可。

---

## 1. 用户/账号/钱包域（Auth & Wallet Domain）

### 1.1 顶层概念关系

```
AepUser  ── Membership ──>  Tenant
   │                          │
   │                          └── (License 发放方归属)
   │
   ├── Wallet  (1:1, 个人点数账户)
   ├── Studio  (1:1 或 0:1, 工作室/经纪主体)
   └── LedgerEntry[]  (流水)
```

- **AepUser**：登录账号本身，承担「身份 + 钱包」职责
- **Studio**：账号的「业务主体档案」，账号开通工作室能力后才创建
- **Tenant**：账号的「归属机构」，仅用于 License 核销统计
- **Wallet**：账号的点数余额账户（每个 AepUser 1 个）

### 1.2 AepUser（登录账号）

**前端 TS（新增）** —— `apps/web_new/src/types/account.ts`

```ts
export type AccountStatus = "active" | "suspended" | "deleted";
export type AccountKind = "personal" | "studio";  // 个人粉丝 / 工作室运营者

export interface AepUser {
  id: ID;
  username: string;                 // 唯一
  email?: string;
  phone?: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress?: string;           // 链上地址（可选）
  kind: AccountKind;                // 决定是否显示工作室控制台
  status: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  langPreference: "zh" | "en";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastLoginAt?: ISODateTime;
}
```

**后端 MySQL（`aep_users`）**

| 字段              | 类型              | 约束                    | 备注                                      |
| ----------------- | ----------------- | ----------------------- | ----------------------------------------- |
| id                | VARCHAR(36)       | PK                      | UUID                                      |
| username          | VARCHAR(64)       | UNIQUE NOT NULL         |                                           |
| password_hash     | VARCHAR(255)      | NULL                    | 仅后端持有，前端不下发                    |
| email             | VARCHAR(255)      | UNIQUE NULL             |                                           |
| phone             | VARCHAR(32)       | UNIQUE NULL             |                                           |
| display_name      | VARCHAR(128)      | NOT NULL                |                                           |
| avatar_url        | VARCHAR(512)      | NULL                    |                                           |
| wallet_address    | VARCHAR(128)      | UNIQUE NULL             |                                           |
| kind              | VARCHAR(16)       | NOT NULL                | enum: personal/studio                     |
| status            | VARCHAR(16)       | NOT NULL                | enum: active/suspended/deleted            |
| email_verified    | TINYINT(1)        | NOT NULL DEFAULT 0      |                                           |
| phone_verified    | TINYINT(1)        | NOT NULL DEFAULT 0      |                                           |
| lang_preference   | VARCHAR(8)        | NOT NULL DEFAULT 'zh'   |                                           |
| created_at        | DATETIME(3)       | NOT NULL                |                                           |
| updated_at        | DATETIME(3)       | NOT NULL                |                                           |
| last_login_at     | DATETIME(3)       | NULL                    |                                           |

> **变更点**：删除 `role`（拆到 `kind` + Studio 表），删除 `credits`（移到 Wallet 表）。

### 1.3 Wallet（个人钱包）

> **重要变更**：钱包从 `Tenant` 解耦，挂到 `AepUser`。Tenant 不再有钱包。

**前端 TS** —— 替换原有 `WalletSummary` 中的展示文案字段为原始数值

```ts
export interface Wallet {
  id: ID;
  userId: ID;
  totalBalance: number;        // 总余额（credits，原始数值）
  licenseBalance: number;      // License 核销发放的点数累计（永不过期）
  rechargeBalance: number;     // 充值余额（永不过期）
  giftBalance: number;         // 赠送 / 活动余额（永不过期）
  pendingBalance: number;      // 结算中（业务收益等待入账）
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// 仅用于 UI 展示的派生类型，由前端格式化层产出，不来自后端
export interface WalletDisplay {
  totalBalanceText: string;    // "128,500"
  pendingText: string;
  monthChangeText?: string;
}
```

**后端 MySQL（`aep_wallets`）**

| 字段             | 类型         | 约束                | 备注                       |
| ---------------- | ------------ | ------------------- | -------------------------- |
| id               | VARCHAR(36)  | PK                  |                            |
| user_id          | VARCHAR(36)  | UNIQUE NOT NULL FK→aep_users.id | 1:1                |
| total_balance    | BIGINT       | NOT NULL DEFAULT 0  | credits                    |
| license_balance  | BIGINT       | NOT NULL DEFAULT 0  | License 核销累计入账        |
| recharge_balance | BIGINT       | NOT NULL DEFAULT 0  | 充值累计入账                |
| gift_balance     | BIGINT       | NOT NULL DEFAULT 0  | 赠送/活动累计入账           |
| pending_balance  | BIGINT       | NOT NULL DEFAULT 0  | 结算中（待入账）            |
| created_at       | DATETIME(3)  | NOT NULL            |                            |
| updated_at       | DATETIME(3)  | NOT NULL            |                            |

> 余额字段一律为非负整数。任何业务上的「负数」用 `LedgerEntry` 表达，Wallet 永远是聚合后的快照。

### 1.4 LedgerEntry（点数流水）

**前端 TS** —— 替换 `Transaction`（保留旧名作为 UI 展示派生）

```ts
export type LedgerEntryType =
  | "license_grant"        // License 核销时一次性入账
  | "recharge"             // 充值入账
  | "refund"               // 退款入账
  | "income"               // 业务收益入账（带货分润 / 内容播放分成 / 版税等）
  | "gift"                 // 平台赠送 / 活动奖励
  | "spend"                // 消费扣减
  | "withdraw"             // 提现扣减
  | "freeze"               // 冻结
  | "unfreeze"             // 解冻
  | "adjust";              // 管理员手动调账

export interface LedgerEntry {
  id: ID;
  walletId: ID;
  userId: ID;
  type: LedgerEntryType;
  amount: number;            // 原始数值；正负号由前端根据 type 渲染
  balanceAfter: number;      // 入账后总余额
  description: string;       // 后端写入的中性描述，前端可本地化
  referenceId?: string;      // 关联业务实体 id
  referenceType?: string;    // "song_generation" / "celebrity_generation" / "song_revenue" / "celebrity_distribution" 等
  createdAt: ISODateTime;
}
```

**后端 MySQL（`aep_ledger_entries`）**

| 字段            | 类型         | 约束                                | 备注                              |
| --------------- | ------------ | ----------------------------------- | --------------------------------- |
| id              | VARCHAR(36)  | PK                                  |                                   |
| wallet_id       | VARCHAR(36)  | NOT NULL FK→aep_wallets.id INDEX    |                                   |
| user_id         | VARCHAR(36)  | NOT NULL FK→aep_users.id  INDEX     |                                   |
| type            | VARCHAR(32)  | NOT NULL                            | enum 见上                         |
| amount          | BIGINT       | NOT NULL                            | 正数=入账，负数=出账              |
| balance_after   | BIGINT       | NOT NULL                            |                                   |
| description     | VARCHAR(255) | NOT NULL                            |                                   |
| reference_id    | VARCHAR(64)  | NULL INDEX                          |                                   |
| reference_type  | VARCHAR(32)  | NULL                                |                                   |
| created_at      | DATETIME(3)  | NOT NULL INDEX                      | 时间序查询热点                    |

### 1.5 Tenant（机构归属，仅用于 License 统计）

**前端 TS**

```ts
export type TenantKind = "platform" | "personal" | "organization";
export type TenantStatus = "active" | "suspended" | "deleted";

export interface Tenant {
  id: ID;
  name: string;
  kind: TenantKind;
  status: TenantStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Membership {
  id: ID;
  userId: ID;
  tenantId: ID;
  joinedAt: ISODateTime;
  source: "license_activation" | "self_register" | "admin_invite";
  licenseKeyId?: ID;     // 因 License 入会时的 key 引用
}
```

**后端 MySQL（`aep_tenants` / `aep_memberships`）** —— 与现有结构兼容，需新增 `aep_memberships.source` 与 `license_key_id` 字段。

### 1.6 Studio（业务主体档案，新增表）

**前端 TS** —— `apps/web_new/src/types/studio.ts`

```ts
export type StudioKind =
  | "personal_creator"
  | "music_studio"
  | "drama_studio"
  | "variety_studio"
  | "agency"
  | "mcn";

export interface Studio {
  id: ID;
  ownerUserId: ID;          // 1:1 → AepUser
  name: string;
  kind: StudioKind;
  bio?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
```

**后端 MySQL（`aep_studios`，新增表）**

| 字段             | 类型         | 约束                       | 备注                       |
| ---------------- | ------------ | -------------------------- | -------------------------- |
| id               | VARCHAR(36)  | PK                         |                            |
| owner_user_id    | VARCHAR(36)  | UNIQUE NOT NULL FK→aep_users.id | 1:1                  |
| name             | VARCHAR(128) | NOT NULL                   |                            |
| kind             | VARCHAR(32)  | NOT NULL                   | enum                       |
| bio              | TEXT         | NULL                       |                            |
| logo_url         | VARCHAR(512) | NULL                       |                            |
| contact_email    | VARCHAR(255) | NULL                       |                            |
| contact_phone    | VARCHAR(32)  | NULL                       |                            |
| created_at       | DATETIME(3)  | NOT NULL                   |                            |
| updated_at       | DATETIME(3)  | NOT NULL                   |                            |

---

## 2. License（注册鉴权 + 初始点数发放）

> **没有订阅、没有 Plan**。整张 `aep_plans` / `aep_subscriptions` 都不创建。
> 用户付费体验通过「License 兑换初始点数 + 后续充值」实现。

### 2.1 LicenseBatch（License 批次）

**前端 TS** —— `apps/web_new/src/types/license.ts`（管理后台用）

```ts
export type LicenseBatchStatus = "active" | "exhausted" | "revoked" | "expired";

export interface LicenseBatch {
  id: ID;
  batchNo: string;                  // "BATCH-2026-001"
  name: string;                     // 营销名称，如"种子用户包"
  issuerTenantId: ID;               // 发放方机构（核销统计入口）
  initialCreditGrant: number;       // 该批次每个 Key 核销时入账的点数（credits）
  totalCount: number;
  activatedCount: number;
  validFrom: ISODateTime;
  validTo: ISODateTime;
  status: LicenseBatchStatus;
  createdAt: ISODateTime;
}
```

**后端 MySQL（`aep_license_batches`，调整）**

| 字段                    | 类型         | 约束                          | 备注                              |
| ----------------------- | ------------ | ----------------------------- | --------------------------------- |
| id                      | VARCHAR(36)  | PK                            |                                   |
| batch_no                | VARCHAR(64)  | UNIQUE NOT NULL               |                                   |
| name                    | VARCHAR(128) | NOT NULL                      |                                   |
| issuer_tenant_id        | VARCHAR(36)  | NOT NULL FK→aep_tenants.id    | 发放方                            |
| initial_credit_grant    | BIGINT       | NOT NULL DEFAULT 0            | 每个 Key 兑换时一次性入账的点数   |
| total_count             | INT          | NOT NULL                      |                                   |
| activated_count         | INT          | NOT NULL DEFAULT 0            |                                   |
| valid_from              | DATETIME(3)  | NOT NULL                      |                                   |
| valid_to                | DATETIME(3)  | NOT NULL                      |                                   |
| status                  | VARCHAR(16)  | NOT NULL                      |                                   |
| created_at              | DATETIME(3)  | NOT NULL                      |                                   |

> **从旧 schema 删除字段**：`license_type` / `credit_delta` / `duration_days` / `settlement_mode` / `channel_partner_id` / `product_id` / `plan_id`
> **重命名**：`owner_tenant_id` → `issuer_tenant_id`
> **完整删除表**：`aep_products` / `aep_plans` / `aep_features` / `aep_plan_features` / `aep_entitlements`

### 2.2 LicenseKey（License 单码）

**前端 TS**

```ts
export type LicenseKeyStatus = "created" | "activated" | "expired" | "revoked";

export interface LicenseKey {
  id: ID;
  batchId: ID;
  maskedCode: string;               // "XXXX-XXXX-****-****"
  status: LicenseKeyStatus;
  activatedByUserId?: ID;
  activatedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  createdAt: ISODateTime;
}
```

**后端 MySQL（`aep_license_keys`）**

| 字段                  | 类型         | 约束                                  |
| --------------------- | ------------ | ------------------------------------- |
| id                    | VARCHAR(36)  | PK                                    |
| batch_id              | VARCHAR(36)  | NOT NULL FK→aep_license_batches.id INDEX |
| code_hash             | VARCHAR(255) | NOT NULL UNIQUE                       |
| masked_code           | VARCHAR(64)  | NOT NULL                              |
| status                | VARCHAR(16)  | NOT NULL                              |
| activated_by_user_id  | VARCHAR(36)  | NULL FK→aep_users.id INDEX            |
| activated_at          | DATETIME(3)  | NULL                                  |
| expires_at            | DATETIME(3)  | NULL                                  |
| created_at            | DATETIME(3)  | NOT NULL                              |

> **从旧 schema 删除字段**：`activated_tenant_id`（归属由 `aep_memberships` 表达）

### 2.3 兑换流程（License Activation）

事务性流程，必须原子完成：

1. 校验 LicenseKey：状态 = `created` 且未过期
2. 创建 / 复用 `aep_users`（注册场景同时创建账号）
3. 创建 `aep_memberships`（user → batch.issuer_tenant_id，`source = "license_activation"`，`license_key_id = key.id`）
4. 复用 / 创建 `aep_wallets`（user 1:1）
5. 写入 `aep_ledger_entries`：`type = "license_grant"`，`amount = batch.initial_credit_grant`，`reference_type = "license_key"`，`reference_id = key.id`
6. 更新 `aep_wallets.license_balance += grant`，`total_balance += grant`
7. LicenseKey：`status = "activated"`，`activated_by_user_id = user.id`，`activated_at = now()`
8. LicenseBatch：`activated_count += 1`

---

## 3. 字段格式与计算约定

### 3.1 数值字段（**核心约定**）

| 字段类型           | 后端存储                          | 前端类型           | 前端格式化                              |
| ------------------ | --------------------------------- | ------------------ | --------------------------------------- |
| 点数 / Credits     | BIGINT，原始整数                  | `number`           | `formatCredits(n)` → `"128,500"`        |
| 法币金额（分）     | BIGINT，单位「分」                | `number`           | `formatCurrency(cents, "CNY")` → `"¥1,285.00"` |
| 百分比             | INT 或 DECIMAL(5,2)，原始值（如 35.5）| `number`        | `formatPercent(v)` → `"35.5%"`          |
| 大数（粉丝/播放量）| BIGINT，原始整数                  | `number`           | `formatCompactNumber(n)` → `"128K" / "2.3M"` |
| 比率 0–1           | DECIMAL(5,4)                      | `number` (0–1)     | 业务侧统一用百分比形式展示              |

> **禁止后端下发任何已格式化字符串**（如 `"¥128,500"`、`"128K"`、`"+12%"`）。
> 所有展示文案由前端 `lib/format.ts` 统一处理，便于切换币种 / 语言。

### 3.2 时间字段

| 场景         | 后端类型          | 前端类型           |
| ------------ | ----------------- | ------------------ |
| 时间点       | DATETIME(3) UTC   | `ISODateTime` (ISO-8601) |
| 日期         | DATE              | `ISODate` (YYYY-MM-DD)   |
| 持续时长（秒）| INT              | `number`           |

### 3.3 枚举字段

- 后端：`VARCHAR(16~32)` + Java enum，DB 存 **小写下划线** 形式（如 `monthly_grant`）
- 前端：`type Foo = "active" | "suspended"`，与后端字符串完全一致
- DTO 序列化层负责把 Java enum 转为小写字符串

### 3.4 余额组成与扣减策略

- 三类余额来源 **全部永不过期**：`license_balance` / `recharge_balance` / `gift_balance`
- `total_balance = license_balance + recharge_balance + gift_balance`
- `pending_balance` 不计入 `total_balance`，是结算中的独立池
- 消费扣减优先级（统一从 `total_balance` 出账，子余额按 FIFO 自动平摊）：
  `gift_balance → license_balance → recharge_balance`
  （先用赠送，再用 License 入账，最后才用真金白银充值的部分；便于将来加退款逻辑）
- 不存在月度清零、不存在自动续费

### 3.5 ID 字段

- 后端：`VARCHAR(36)` UUIDv4
- 前端：`type ID = string`
- 不使用自增主键，避免 ID 暴露业务量

### 3.6 软删除

- `status` 字段表达「软删除」（`status = "deleted"`）
- 不使用单独的 `deleted_at` 字段（与现有结构一致）

---

## 4. 内容/IP 域（Content & IP Domain）

### 4.1 表合并：`Singer` + `OfficialIp` → `DigitalIp`

**前端 TS** —— `apps/web_new/src/types/artist.ts` 的 `Artist` 是源头

后端新表 `digital_ips` 字段映射：

| 前端 `Artist` 字段        | 后端 `digital_ips` 字段       | 类型                    |
| ------------------------- | ----------------------------- | ----------------------- |
| id                        | id                            | VARCHAR(36) PK          |
| name                      | name                          | VARCHAR(128)            |
| type                      | kind                          | VARCHAR(32)             |
| quality                   | quality                       | VARCHAR(16)             |
| status                    | status                        | VARCHAR(16)             |
| level                     | level                         | INT                     |
| exp                       | exp                           | INT                     |
| maxExp                    | max_exp                       | INT                     |
| avatar                    | avatar_url                    | VARCHAR(512)            |
| talents.singing           | talent_singing                | INT (0–100)             |
| talents.acting            | talent_acting                 | INT                     |
| talents.dancing           | talent_dancing                | INT                     |
| talents.hosting           | talent_hosting                | INT                     |
| talents.comedy            | talent_comedy                 | INT                     |
| talents.variety           | talent_variety                | INT                     |
| stats.songs               | stat_songs                    | INT                     |
| stats.dramas              | stat_dramas                   | INT                     |
| stats.ads                 | stat_ads                      | INT                     |
| stats.variety             | stat_variety                  | INT                     |
| stats.fans                | stat_fans                     | BIGINT (原始数值)       |
| stats.revenue             | stat_revenue_credits          | BIGINT (credits)        |
| stats.monthlyRevenue      | stat_monthly_revenue_credits  | BIGINT                  |
| stats.popularity          | stat_popularity               | INT                     |
| createdAt                 | created_at                    | DATETIME(3)             |
| lastActive                | last_active_at                | DATETIME(3)             |
| bio                       | bio                           | TEXT                    |
| domains                   | domains_json                  | JSON                    |
| endorsements              | stat_endorsements             | INT                     |
| commercialValue           | stat_commercial_value_credits | BIGINT                  |
| (新增) studioId           | studio_id                     | VARCHAR(36) FK→aep_studios.id |
| (新增) ownerUserId        | owner_user_id                 | VARCHAR(36) FK→aep_users.id |

> **前端要做的字段调整**：
> - `Artist.stats.fans / revenue / monthlyRevenue / commercialValue` 由当前的 `string` 改为 `number`
> - 新增展示派生类型 `ArtistDisplay`，由前端 `useFormat()` hook 产出

### 4.2 其余 AI 玩法内容域（Song / Wardrobe / Pose / Forge / Album）

本期聚焦在「AI 艺人服务化」相关的内容域，数值字段全部按 §3.1 转为原始数值：

- `Song`（音乐工坊）：`plays / revenue` → BIGINT credits；删除 `durationLabel`，前端用 `durationSec` 格式化（详见 §10）
- `Album`（歌手歌单）：`trackIds: ID[]`；不再有 `sales / revenue`（详见 §10.4）
- `WardrobeItem`：`price` 单位明确为 credits（BIGINT）
- `ForgeTemplate / ForgeResult`：AI 形象锻造相关，`creditCost` 为 BIGINT credits
- `Pose`：动作 / 表情 / 手势库，存元数据，不带价格
- `SignedArtist`（`coach.ts`）：`monthlyRevenue / totalRevenue / fans` → number；`royaltyRate` 保留 INT 0–100

**冻结但保留的领域（本期 UI 不暴露，详见 §13）**：
- `NftCollection`：`priceCredits` 字段保留，路由 `/monetization/nft` 与 `/fan/nft-market` 前端入口移除
- `CopyrightRecord`：版权核验流程冻结，`/content/copyright` 入口移除
- `Concert / Drama / Movie / Advertisement / VoiceWork`：保留实体表，前端不展示

> 这些领域的 entity / DTO 已在 server 端存在，下一阶段评估对外开放路径。

---

## 5. MySQL 通用约束

- **字符集**：`utf8mb4` / `utf8mb4_unicode_ci`
- **时区**：DB 层统一存 UTC（`DATETIME(3)`）；连接串 `serverTimezone=UTC`；前端按用户时区渲染
- **VARCHAR 长度上限**（默认）：
  - 短枚举：16 / 32
  - 名称：128
  - 邮箱：255
  - URL：512
  - 描述短：255 / 长：TEXT
- **JSON 字段**：MySQL 8.0+ 原生 JSON，禁止用 TEXT 存 JSON
- **索引规范**：
  - 所有 FK 加索引
  - 时间序查询字段（`created_at`）加索引
  - 业务唯一字段（`username` / `email` / `code` / `batch_no`）加 UNIQUE
- **外键策略**：JPA 层只声明逻辑 FK，DB 层不创建物理 FK 约束（运维灵活性）

---

## 6. API 契约约定

- **统一响应包络**：`{ success: true, data: T }` / `{ success: false, error: { code, message } }`
- **分页**：`{ page, limit, total, totalPages, hasNext, hasPrev }`，`page` 从 0 开始（与 Spring Data 一致）
- **DTO 命名**：后端 DTO 类名与前端 TS 类型一一对应，**字段名采用 camelCase**（Jackson 配置）
- **枚举**：DTO 序列化为小写下划线字符串，前端类型字面量与之一致
- **数值字段**：DTO 直传 number，不做格式化

---

## 7. 改造路线（Phased Roadmap）

| 阶段 | 范围                                              | 关键产出                                |
| ---- | ------------------------------------------------- | --------------------------------------- |
| P0   | 本规范（命名、字段约定、计费/License 模型）       | `product_spec.md`（本文档）✓            |
| P1   | Auth / Wallet / License / Tenant / Studio         | 新增 `aep_studios`；废弃 plan/subscription/entitlement/feature/product 五张表；LicenseBatch 增加 `initial_credit_grant`；前端新增 `account.ts` / `studio.ts` / `license.ts` ✓ |
| P2   | DigitalIp 合并 + 前端 Artist 数值字段去字符串化   | 新表 `digital_ips`；前端 `Artist.stats` 字段类型变更；`lib/format.ts` ✓ |
| P3   | 内容域（Song / Wardrobe / Forge / Pose）数值字段改造 | 各表数值字段改造；前端展示派生类型 ✓ |
| P4   | 管理后台（admin）UI 对齐 Studio/License 视角      | 机构发放/核销/累计点数发放看板 ✓        |
| P5   | **音乐工坊** 完整闭环（详见 §10）                | Song-artistId 必填；MusicGenerationDialog；分发预填 ✓ |
| P6   | **AI 明星专区** v1（详见 §12）                   | CelebrityStar / Project / Video / Template / Showcase / Product；模板 + 盲盒双模式；4 态授权；积分 / 套餐双计费 ✓（v2.7 已交付） |
| P7   | AI 明星专区 v2 优化                              | 后端真实生成接入（startGeneration → pollUrl 轮询）；视频库联动 PendingJobs；admin 端运营视图深化 |
| P8   | 跨主线协同                                       | DigitalIp 也接入「带货模板」生成；CelebrityStar 直播切片二创；统一商品库（§12.4）支持两侧引用 |

---

## 8. 决策记录

- [x] **D1**：业务主体 = `Studio`
- [x] **D2**：被运营 IP = `DigitalIp`（合并旧 `Singer` + `OfficialIp`）
- [x] **D3**：**取消订阅模型**，无月度配发、无清零策略
- [x] **D4**：所有点数余额永不过期（License/充值/赠送）
- [x] **D5**：License 核销时按 Batch 配置一次性赠送初始点数
- [x] **D6**：Wallet 挂在 `AepUser`

> 上述决策已锁定，进入 P1 实施阶段。

---

## 9. Admin Console 产品功能逻辑（`apps/admin-new`）

> 管理后台是 `apps/web_new` 背后的运营工作台。**数据模型与前台 1:1 对应**：`admin-new/src/types/*` 与 `web_new/src/types/*` 同构，任何字段/枚举改动需同步两端。

### 9.1 主链路

整条业务链以 Studio 为轴心，分两条 AI 艺人主线（详见 §0.0 与 §13）：

```
平台账户 (AepUser / Tenant)
   └─ 经纪公司 (Studio)
        ├─ 数字人主线 (DigitalIp)
        │     └─ AI 作品 (Song / Album / 形象锻造 / 衣帽间)
        │
        └─ 明星带货主线 (CelebrityStar)
              └─ 带货项目 (CelebrityProject)
                    └─ 项目视频 (CelebrityProjectVideo) × 商品库 (Product)
                          └─ 分发 (Platform / DistributionQueue)
                                └─ 收益 (Wallet / LedgerEntry ≡ credits)
```

管理后台每个分组对应链路中的一环，所有数值一律 credits，不再使用 ¥/$ 字符串。

### 9.2 侧栏分组 → 路由映射

| 分组       | 路由                   | 核心实体             | 作用                             |
| ---------- | ---------------------- | -------------------- | -------------------------------- |
| 全局       | `/`                    | —                    | KPI + 待办队列                   |
| 平台账户   | `/platform/accounts`   | `AepUser`            | 登录账号 / kind / status         |
|            | `/platform/studios`    | `Studio`             | 业务主体 + 聚合指标（§1.5）       |
|            | `/platform/tenants`    | `Tenant`             | License 发放方                   |
|            | `/platform/licenses`   | `LicenseBatch/Key`   | 批次发放 + 核销 + 撤回（§2）     |
| AI 艺人    | `/artists/lifecycle`   | `DigitalIp`          | 练习生→出道→活跃                 |
|            | `/artists/roster`      | `DigitalIp`          | 全站艺人档案 + 属主 Studio       |
| AI 作品    | `/content/songs`       | `Song`               | 混音/发行                        |
|            | `/content/albums`      | `Album`              | 歌手歌单（§10.4）                |
| 明星带货 ★ | `/celebrity/stars`     | `CelebrityStar`      | 明星档案 / 授权 / 套餐用量（§12）|
|            | `/celebrity/projects`  | `CelebrityProject`   | 跨用户带货项目聚合 + 视频流      |
|            | `/celebrity/products`  | `Product`            | 商品库（§12.4）                  |
| 分发与变现 | `/distribution/platforms` | `Platform`        | 渠道接入审核                     |
|            | `/distribution/queue`  | `DistributionItem`   | 发行队列复核                     |
|            | `/finance/ledger`      | `Wallet/LedgerEntry` | 钱包 + 点数流水 + 业务交易复核   |
|            | `/finance/risk`        | 合成                 | 大额流水 / 异常提现风控          |
| 社群       | `/community/events`    | `CommunityEvent`     | 投票/见面会/挑战赛               |
|            | `/community/moderation`| `Activity`           | 动态与打赏审核                   |
| 基础数据   | `/base/genres`         | `Genre`              | 曲风 / 领域                      |
|            | `/base/wardrobe`       | `WardrobeItem`       | 造型库                           |
|            | `/base/pose`           | `Pose`               | 动作 / 表情 / 手势               |
|            | `/base/credit-packs`   | `CreditPack`         | 点数售卖规格（取代订阅）         |
| 消息与日志 | `/notifications`       | `Notification`       | 运营推送                         |
|            | `/audit`               | `AuditEntry`         | 所有人工介入审计                 |

**本期冻结、admin 不再暴露的页面**（详见 §13 future scope）：
- `/content/{concerts, dramas, movies, ads, voice, copyright}` — 短剧 / 电影 / 商业广告 / 配音 / 演唱会售票 / 版权核验
- `/monetization/nft` — 数字藏品上架

### 9.3 admin-new ↔ web_new 类型对齐

以下类型在两端同名同构（字段级相同），差异仅在于 admin 会**外挂聚合字段**用于后台看板：

| 文件            | 同构类型                                          | admin 侧外挂字段 |
| --------------- | ------------------------------------------------- | ---------------- |
| `types/account.ts` | `AepUser` / `Tenant` / `Membership`             | —                |
| `types/studio.ts`  | `Studio` / `StudioKind`                         | `artistCount` / `songCount` / `totalRevenueCredits` / `monthlyRevenueCredits` |
| `types/license.ts` | `LicenseBatch` / `LicenseKey`                   | —                |
| `types/wallet.ts`  | `Wallet` / `LedgerEntry` / `LedgerEntryType`    | —                |
| `types/finance.ts` | `Transaction`（credits）/ `MonthlyRevenuePoint` | `TransactionType` 扩展了 `spend` / `recharge` / `license_grant` |
| `types/settings.ts`| `CreditPack` / `RechargeRecord`                 | —（**已删除** `SubscriptionPlan` / `BillingRecord`）|

### 9.4 关键人工介入点（actionable queue）

全部由 `StatusMeta.actionable: true` 驱动，汇总到首页「待办队列」：

- `ARTIST_STATUS.trainee` / `debut`
- `SIGNED_ARTIST_STATUS.negotiating` / `expiring`
- `DISTRIBUTION_QUEUE_STATUS.reviewing`
- `PLATFORM_STATUS.pending`
- `TRANSACTION_STATUS.pending` / `processing`
- `LEDGER_ENTRY_TYPE.freeze` / `adjust`
- `ACCOUNT_STATUS.suspended` / `STUDIO_STATUS.suspended`
- `COMMUNITY_EVENT_STATUS.upcoming`
- **明星带货新增**：`CELEBRITY_AUTH_STATUS.pending`（授权审核中）/ `CelebrityProjectVideo.status='待审核'` / `'已驳回'`

### 9.5 金额展示约定

- 所有 credits 字段由 `lib/format.ts` 的 `formatCredits` / `formatSignedCredits` / `formatCompactNumber` 处理；
- `CreditPack.priceCents` 使用 `formatCurrency(cents)` 展示（CNY，后端以「分」为单位）；
- **绝对禁止** 将数值字段以字符串形式从 mock/DTO 传入组件（见 §3.1）。

### 9.6 删除项

P4 交付时下述页面与常量已从 admin 移除（替代路径在括号内）：

- `/base/plans`（→ `/base/credit-packs`）
- `/coach/contracts` / `/coach/mcn`（并入 `/platform/studios`）
- `/finance/settlement`（→ `/finance/ledger`，从「元」切到 credits）
- `types/settings.ts` 中的 `SubscriptionPlan` / `BillingRecord`；`types/finance.ts` 中的 `WalletSummary`（迁至 `types/wallet.ts`）。

**P6 起冻结的 admin 入口**（产品版图收缩，保留实体 / DTO 但 admin 侧栏不再展示，详见 §13）：

- `/content/copyright`（版权核验）
- `/content/concerts` / `/content/dramas` / `/content/movies` / `/content/ads` / `/content/voice`
- `/monetization/nft` / `/fan/nft-market`

### 9.7 Admin 后端接口清单（`/api/admin/**`）

后端 `apps/server` 现已与 `apps/admin` 1:1 落齐。除 `/auth` 登录外，下列接口均需 Bearer Token（`SUPER_ADMIN` / `OPERATOR` / `FINANCE_ADMIN`；曾计划的 `PLATFORM_OPERATOR` 已决定不拆）。**列表响应走 `PageEnvelope`，单体/命令响应走 `ApiResponse`**（见 §6.4）。

| 路由前缀                              | Controller                         | 对应 admin 页面 / API 客户端                          |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `POST /admin/auth/login`              | `AdminAuthController`              | 登录页 / `api/auth.ts`                                |
| `GET /admin/auth/me`                  | `AdminAuthController`              | 全局守卫                                              |
| `GET /admin/stats`                    | `AdminStatsController`             | 首页看板 / `api/stats.ts`                             |
| `GET·POST·PUT·PATCH·DELETE /admin/users/**` | `AdminUserController`         | `/platform/accounts` / `api/users.ts`                 |
| `GET·POST·PUT·PATCH /admin/tenants/**`| `AdminTenantController`            | `/platform/tenants` / `api/tenants.ts`                |
| `GET /admin/memberships`              | `AdminMembershipController`        | `/platform/accounts` 归属列 / `api/tenants.ts`        |
| `GET·POST·PUT·PATCH /admin/studios/**`| `AdminStudioController`            | `/platform/studios` / `api/studios.ts`                |
| `GET·POST /admin/license-batches/**`<br>`GET·PUT /admin/license-keys/**` | `AdminLicenseController` | `/platform/licenses` / `api/licenses.ts` |
| `GET /admin/wallets/**`<br>`GET /admin/ledger-entries` | `AdminCreditController` | `/finance/ledger` 钱包与点数流水 / `api/wallet.ts`     |
| `GET /admin/finance/transactions`<br>`GET /admin/finance/revenue/monthly`<br>`GET /admin/finance/revenue/sources` | `AdminFinanceController` | `/finance/ledger` 业务交易 + 图表 / `api/finance.ts` |
| `GET·POST /admin/music/**`            | `AdminMusicController`             | `/content/songs` / `api/music.ts`                     |
| `GET·POST·PUT·PATCH·DELETE /admin/digital-ips/**` | `AdminDigitalIpController` | `/artists/roster` / `api/digital-ips.ts`           |
| `GET /admin/celebrity/**`             | `AdminCelebrityController` ★       | `/celebrity/{stars,projects}` / `api/celebrity-zone.ts` |
| `GET·POST·PATCH·DELETE /admin/products/**` | `AdminProductsController` ★   | `/celebrity/products` / `api/products.ts`             |
| `GET·PUT /admin/community/**`         | `AdminCommunityController`         | `/community/*` / `api/community.ts`                   |
| `GET·POST /admin/distribution/**`     | `AdminDistributionController`      | `/distribution/*` / `api/distribution.ts`             |
| `GET·POST /admin/coach/**`            | `AdminCoachController`             | 教练/培训子域 / `api/coach.ts`                        |
| `GET·POST /admin/appearance-forge/**` | `AdminForgeController`             | 形象工坊 / `api/appearance-forge.ts`                  |
| `GET·POST·PUT /admin/settings/**`     | `AdminSettingsController`          | `/platform/config` / `api/settings.ts`                |
| `GET·POST·PUT /admin/platform-configs/**` | `AdminPlatformConfigController` | `/platform/config` 次级 / `api/platform-config.ts`   |
| `GET /admin/audit-logs`               | `AdminAuditController`             | `/audit` / `api/audit.ts`                             |
| `GET /admin/notifications`            | `AdminNotificationController`      | `/notifications` / `api/notifications.ts`             |
| `GET·POST·DELETE /admin/staff/**`     | `AdminStaffController`             | 运营团队（P2）                                        |

**P6 起冻结的 admin controller**（保留代码 + DTO，前端侧栏不再调用，详见 §13）：
- `AdminStoreController`（`/admin/store/**` — NFT 上架）
- `AdminFanController`（`/admin/fan/**` — 粉丝打赏 / NFT 市场）
- `AdminFilmController`（`/admin/film/**` — 短剧 / 电影 / 广告 / 配音）

**Studio 聚合指标**：`GET /admin/studios` 返回 `AdminStudioDto`（`StudioDto` 外挂 `artistCount / songCount / totalRevenueCredits / monthlyRevenueCredits`），聚合由 `StudioService.toAdminDto` 以 `studioId → List<DigitalIp>` 汇总 `stat*` 字段；若 `DigitalIp.studioId` 为空则 fallback 到 `ownerUserId` 匹配（兼容旧数据）。`PUT` 返回基础 `StudioDto`，不含聚合字段。

**Admin Finance 聚合**（`AdminFinanceService`）：以 `LedgerEntry` 事实表为唯一来源，只读派生。

| 视图          | 来源                                          | 规则                                                                 |
| ------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| 业务交易列表   | `LedgerEntry` 倒序，支持 `userId` 过滤        | `type` 按 `LedgerEntryType` 映射为 `license_grant / recharge / withdrawal / spend / income`（`FREEZE` 归 `spend`；`GIFT/REFUND/UNFREEZE/ADJUST` 归 `income`）；`status` 始终 `completed`（事实表无生命周期） |
| 月度入账趋势   | `findAllPositiveSince(T-5月1日)`              | 按 `yyyy-MM`（Asia/Shanghai）分桶，补齐 6 个月，缺失桶填 0            |
| 入账来源饼图   | `aggregateIncomeByTypeAll()`                  | 按 `entryType` 聚合，只返回 `sum > 0` 的桶；`label/color` 映射见下   |

`RevenueSource` 映射约定（与 `RevenueSourcePie` 的 tailwind 语义色对齐）：

| entryType       | label      | color     |
| --------------- | ---------- | --------- |
| `LICENSE_GRANT` | 秘钥核销   | `#6366f1` |
| `RECHARGE`      | 充值       | `#10b981` |
| `INCOME`        | 业务收益   | `#f59e0b` |
| `GIFT`          | 平台赠送   | `#ec4899` |
| `REFUND`        | 退款       | `#94a3b8` |
| `ADJUST`        | 调账       | `#64748b` |

> 业务交易复核需要独立的「pending/processing/completed」状态机时，应在 Ledger 外引入单独的 `Transaction` 事实表，本接口不承担该生命周期。

---

## 10. 音乐工坊 产品逻辑（Music Workshop）

> 对应前端页面 `apps/web/src/components/MusicBusiness.tsx`（Producer 侧「音乐工坊」Tab）
> 与 admin `/content/songs`、`/content/albums`、`/content/concerts`。
> 本章锁定 2026-04-18 与用户对齐的结论。

### 10.1 核心链路（以 DigitalIp 为歌手的数字音乐发行）

```
AI 艺人 (DigitalIp)  ← 可选的"歌手"身份
   └─ AI 歌曲 (Song)       ← artistId 可选（v0.137 起）；对接外部音乐发行平台时
        ├─ 歌单 (Album)     ← 歌曲的合集（非"专辑发行"）
        └─ 分发 (Distribution → 外部音乐发行开放平台)
             └─ 播放量 / 版税 (Wallet / LedgerEntry)
```

**约束（v0.137 修订）**：
- **创作不要求先有 artist**：创作音乐不需要先引入数字人/孵化艺人；无 `artistId` 的 Song 由 `ownerUserId` 直接归属创作者账号（自由创作）。
- **分发仍要求 artist**：`Song.artistId` 即外部平台上的"演唱歌手"——接入 QQ 音乐 / 网易云 / YouTube Music 等发行 OpenAPI 时，元数据里的 `artist_name` / `performer` 直接取 `DigitalIp.name`；ISRC、词曲版权归属、分润账户也都挂在这条 `artistId` 下。**未绑定艺人的歌曲在对外发行前必须先补绑定。**
- **数字音乐 = 纯线上发行**：没有实体专辑、没有首发日、没有"策划→录制→发布"的专辑生命周期。

### 10.2 Song（歌曲）—— 前端类型变更

`apps/web/src/types/music.ts` 的 `Song` 在现有字段之外需要扩展：

| 字段             | 类型                  | 说明 |
|------------------|-----------------------|------|
| `artistId`       | `ID`（可选，v0.137 起） | 演唱歌手 = `DigitalIp.id`；传了后端校验 ownership，不传则歌曲直接归属创作者账号 |
| `audioUrl`       | `string`（可选）       | 音频资源地址。**当前 mock 占位 URL（CDN 假地址或空）**；后续统一迁移到 OSS / 对象存储，前端不感知 |
| `coverUrl`       | `string`（可选）       | 歌曲封面；没有时由前端生成基于 artist.avatar 的渐变占位 |
| `lyrics`         | `string`（可选）       | 歌词正文（MVP 纯文本；LRC 时间轴版留待 P2） |
| `modelVersion`   | `string`（可选）       | 生成模型版本（如 `"suno-v3"` / `"musicgen-large"`）。仅由 admin 工作流计费配置下发 |
| `thinkDepth`     | `"fast" \| "standard" \| "deep"`（可选） | 生成深度档位。配合 `modelVersion` 查扣费标准 |
| `creditsSpent`   | `number`（可选）       | 本次生成实际扣费（credits 原始值）；由后端在创建时写入 |
| `createdAt`      | `ISODateTime`（可选）  | 创建时间（与 DigitalIp 对齐，便于排序） |

**保留**：`title / genre / duration / status / plays / revenue / rating / releaseDate`。
**SongStatus**：维持 `"recording" \| "mixing" \| "released"`；发布即可分发。

### 10.3 扣费策略（Credits Pricing for Workflows）

- MVP：前端创建 Song 时**扣固定随机值占位**（如 `50–200 credits` 间随机），后端返回 `creditsSpent` 落库。
- 正式：admin 侧新增 **"工作流计费"** 配置（路径暂命名 `/base/workflow-pricing`，或挂在 `/platform/config` 下的 key `music.workflowPricing`）。
  - 配置形如 `{ modelVersion × thinkDepth → creditsPerCall }`；
  - 管理员可随时增减模型 / 调整单价；
  - 后端在 `POST /me/songs` 入口按 `(modelVersion, thinkDepth)` 读表扣费，失败即 402（余额不足）+ 引导充值；
  - 所有扣费写入 `LedgerEntry`，`reference.type = "song_generation"`、`reference.id = song.id`。
- 本配置**也服务于**未来的锻造炉（ForgeTemplate）、形象工坊（AppearanceForge）、pose / wardrobe 生成等工作流，形成统一「按调用计费」模型。

### 10.4 Album（合集 / 歌单）—— 降级为歌曲集合

数字音乐没有"发行专辑"。`Album` 在本平台**语义重定义为"AI 歌手的歌曲合集 / 歌单"**：

| 字段              | 类型           | 说明 |
|-------------------|----------------|------|
| `id`              | `ID`           | |
| `name`            | `string`       | 合集名 |
| `artistId`        | `ID` **(必填)** | 所属 DigitalIp |
| `cover`           | `string`       | 合集封面 |
| `trackIds`        | `ID[]`         | 收录歌曲 id 顺序（即歌单曲序） |
| `createdAt`       | `ISODateTime`  | |

**删除字段**（不再承载这些概念）：
- `trackCount`（由 `trackIds.length` 派生）
- `status`（`planning / recording / released` 全部移除 —— 合集没有生命周期）
- `sales` / `revenue`（销售不存在；收益按歌曲聚合即可）

**admin 影响**：`/content/albums` 的页面文案从"专辑排期/发行"改为"歌手歌单 / 合集运营"（改封面、调曲序、写简介）；删除"销量 / 专辑收入"展板。

### 10.5 Concert（演唱会）—— 最简骨架，不深挖

按用户确认，现阶段不做演唱会运营的深度功能。**保留最小字段**用于未来扩展，但当前 UI **隐藏** 推广售票、票价统计、倒计时、容量等模块：

- 保留字段：`id / name / artistIds[] / date / status / streamUrl?`（线上直播链接）
- 暂不实现：票价 / 容量 / 已售 / 推广 / 售票进度 / 回顾
- 前端做法：MusicBusiness 的「演唱会」Tab 仅展示一个空的"敬请期待"占位，或降级为"最近一场直播"的只读卡片

### 10.6 创作闭环 —— 前端交互 SOP

1. 用户进入 **Producer 侧 音乐工坊 → 歌曲录制** Tab
2. 必须先选中一位 **AI 艺人**（若名下无艺人，按钮置灰 + 提示"先去 AI 孵化创建一位艺人"）
3. 点击"开始录制" → 弹出已有的 `MusicGenerationDialog`（已有 484 行实现，接到 onSuccess）
4. Dialog 提交后：前端调用 `MusicApi.createSong({ artistId, title, genre, modelVersion, thinkDepth, ... })`
5. 后端：
   - 校验 `artistId` 归属当前登录 `AepUser`（通过 `DigitalIp.ownerUserId`）
   - 读工作流计费表 → 扣 credits（余额不足 → 402）
   - 创建 Song 记录，`status="recording"`，塞入 `audioUrl`（mock 模式：固定占位）
   - 写 LedgerEntry
6. 前端 toast 成功 + 新歌插入列表首位；点"播放"触发 `GlobalAudioPlayer`
7. Song 状态流转：`recording → mixing → released`（每次流转可能再次扣费，MVP 可免）
8. `released` 后：卡片出现「分发」按钮跳 `/distribution`，预填 `song.id + artistId`

### 10.7 "半成品" → MVP 补齐清单（当前迭代聚焦）

P0（必做，打通主动脉）：

1. `types/music.ts` 扩 Song 字段（10.2）；Album 降级为歌单（10.4）；Concert 字段 10.5 裁剪
2. `mocks/music.ts` 补 `artistId` 引用，占位 `audioUrl`，移除 Album 的 sales/revenue/status
3. `api/music.ts` 新增 `createSong / advanceSongStatus`；mock 模式随机扣费（`creditsSpent = 50 + Math.random()*150 | 0`）
4. 后端 `Song` / `Album` / `Concert` 模型与 DTO 对齐（10.2/10.4/10.5）；`AccountController` 新增 `POST /api/me/songs`
5. `MusicBusiness.tsx` 死按钮全部接上：选艺人 → 打开 `MusicGenerationDialog` → 调 `createSong` → 播放接 `GlobalAudioPlayer`
6. 金额/数字展示替换为 `formatCredits / formatCompactNumber`
7. Album Tab 文案改歌单；Concert Tab 简化到占位

P1（体验/完整性）：

8. 歌曲详情 Drawer（封面上传、歌词编辑、曲风改、流转状态）
9. Album 作为"歌手歌单"，可拖拽调曲序、添加/移除歌曲
10. 发布（released）后一键跳 `/distribution` 预填
11. 数据概览改为折线图（近 30 天 播放 / 收入） + 热门 Top 10 切换维度

P2（待 admin 工作流计费配置上线后）：

12. admin `/base/workflow-pricing`（或 `/platform/config` key `music.workflowPricing`）
13. 前端生成对话框按 `(modelVersion, thinkDepth)` 显示实时单价 + 余额不足前置校验

### 10.8 决策记录

- [x] **D10.1**：Song 必须绑定 `artistId`，否则不能保存/分发（对接发行平台以此为"歌手"身份）
- [x] **D10.2**：`audioUrl` 当前用 mock 占位；未来迁 OSS / 对象存储，前端/DTO 字段不变
- [x] **D10.3**：创作扣费 = 工作流计费配置表驱动，admin 可改；MVP 用随机占位值
- [x] **D10.4**：Album 降级为"AI 歌手歌单 / 合集"，**取消** 专辑发行生命周期与销售字段
- [x] **D10.5**：Concert 本阶段不做深度运营；保留字段但前端 UI 降级为占位

---

## 11. 经纪公司视角登录 & 签约艺人从属（2026-04-19）

Web 端此前无任何登录入口，`ProducerDashboard` 以硬编码 `MOCK_ARTISTS[0]` 作为当前艺人；一旦后端接入真实数据（空列表或缺少归属），「创作工坊 → 采纳入库」会报 `artistId 必填`。本节把三端对"经纪公司 ↔ 签约艺人"这一从属关系的处理对齐。

### 11.1 核心概念

一个 **登录账户 (AepUser, kind=STUDIO)** 对应 **一家经纪公司 (Studio)**（1:1，`Studio.ownerUserId → AepUser.id`）。

一位 **AI 艺人 (DigitalIp)** 挂在一家经纪公司旗下，由两条外键共同表达：

| 字段 | 约束 | 语义 |
|------|------|------|
| `DigitalIp.ownerUserId` | NOT NULL | 最初创建/拥有该艺人的账户。ownership 的最终裁判。 |
| `DigitalIp.studioId`   | nullable | 当前签约的 Studio（便于 MCN 下艺人集中管理）。 |

"我的签约艺人" = `ownerUserId == me.id ∪ studioId == myStudio.id`，去重后按 `createdAt desc`。admin 侧 `AdminDigitalIpController` 已支持按 `?ownerUserId` / `?studioId` 过滤，web 侧以联合口径返回给登录用户。

### 11.2 后端契约

| 端点 | 方法 | 用途 | Profile |
|------|------|------|---------|
| `/api/auth/dev-accounts` | GET  | 返回可选 STUDIO 账号列表（下拉）：`[ { username, displayName, studioName, studioKind } ]` | `dev` 专用 |
| `/api/auth/dev-login`    | POST | body `{ username? }`（缺省选第一位 STUDIO）免密签发 JWT：`{ token, user: MeDto }` | `dev` 专用 |
| `/api/me`                | GET  | 返回 `MeDto` = AepUserDto 全字段 **+ `studio: StudioDto \| null`** | 全 profile |
| `/api/me`                | PATCH| 同上；可更新 displayName/email/bio/phone/avatarUrl/langPreference | 全 profile |
| `/api/me/digital-ips`    | GET  | 经纪公司签约艺人列表（`ownerUserId==me ∪ studioId==myStudio.id`） | 全 profile |

**MeDto** 字段结构（`com.aistareco.aep.dto.MeDto`）：

```json
{
  "id": "u-xxx",
  "username": "studio_starlight",
  "displayName": "星光经纪",
  "kind": "studio",
  "status": "active",
  "bio": "...", "email": "...", "phone": "...", "avatarUrl": "...",
  "emailVerified": true, "phoneVerified": true,
  "langPreference": "zh",
  "createdAt": "...", "updatedAt": "...", "lastLoginAt": "...",
  "studio": {
    "id": "s-xxx", "ownerUserId": "u-xxx",
    "name": "星光工作室", "kind": "agency", "status": "active",
    "bio": "...", "logoUrl": "...", "contactEmail": "...", "contactPhone": "...",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

**Dev profile 安全约束**：

- `DevAuthController` 带 `@Profile("dev")`，生产 profile（`prod`/`mysql`）下该 Bean 不注入，端点自动 404。
- 该端点**完全跳过密码**，仅用于本地联调与演示。接入正式鉴权需改走 LicenseActivation 流程或引入标准的账号密码登录。
- 已有的 `DevAutoAuthFilter`（dev profile）作为兜底：未带 `Authorization` 时自动选取第一位 STUDIO 用户。手动登录（带 JWT）会短路此 filter。

**种子数据** (`DataInitializer`，`dev` profile 首次启动自动播)：

| username | 显示名 | Studio | 签约艺人 |
|----------|--------|--------|----------|
| `studio_starlight` | 星光经纪 | 星光工作室（kind=`agency`）     | 星野瞳（singer）/ 夏栖羽（idol）/ 林夜川（actor） |
| `agency_moonrise`  | 月升经纪 | 月升传媒（kind=`mcn`）           | 苏安歌（all_rounder）/ 白予辰（host）/ 米可乐（entertainer） |
| `fan_luna`         | Luna 粉丝 | —（kind=`personal` 非 STUDIO） | — |

### 11.3 前端契约

**Web 端（`apps/web`）**

| 模块 | 变更 |
|------|------|
| `api/_client.ts`           | `apiFetch` 注入 `Authorization: Bearer <token>`（localStorage key = `aistareco.auth.token`）；HTTP 401 自动清 token 并走注册的回调（推 `/login`）。新增 `getAuthToken / setAuthToken / registerUnauthorizedHandler` 工具。 |
| `api/auth.ts`              | 新增 `listDevAccounts()` / `devLogin(username?)` / `logout()`；`devLogin` 成功后把 token 写入 localStorage。 |
| `lib/auth-context.tsx`     | 新增 `<AuthProvider>` + `useAuth()`：启动读 token → `AccountApi.getMe()` → 把 `user` 放到 context；401 → 清 token → 推 `/login`。 |
| `app/login/page.tsx`       | 新增登录页：下拉选择经纪公司账号 → 点击「登录进入」→ 调 `devLogin` → 跳 `/producer`。 |
| `types/account.ts`         | `AepUser` 新增可选 `studio?: Studio \| null`；与 `types/studio.ts` 的 Studio / StudioKind 保持一致。 |
| `types/studio.ts`          | 新增 `STUDIO_KIND_LABEL_ZH`（6 种 Studio kind → 中文名）。 |
| `components/ProducerDashboard.tsx` | 移除 `useState<Artist>(MOCK_ARTISTS[0])` 硬编码；改为 `ArtistsApi.listArtists()` 驱动 `artists` 列表，`activeArtist` 初始取第一位；左上切换器、`CommandPalette`、右上当前艺人胸牌全部读同一 state；无签约艺人时展示空态（提示去 MCN 创建或联系运营）。 |
| `components/producer/AIGenerationPanel.tsx` | `accept()` 增加 `artistId` 空值守卫；"采纳并入库"按钮在无 artistId 时 disabled。彻底解决"当前未选艺人 → 后端 400 artistId 必填"那条链路。 |
| `components/producer/SettingsPage.tsx`       | 个人资料页顶部新增「经纪公司资料」卡片：显示 studio 名 / kind（中文 badge）/ status / id / 运营账户 / 联系邮箱 / 成立时间 / 简介。只读（修改需走 admin 控制台）。 |

**登录后流程**（USE_MOCK=0）：

```
用户访问 /producer (未登录)
  → AuthProvider 见无 token → 推 /login
  → 拉 GET /api/auth/dev-accounts → 渲染下拉
  → 用户点「登录进入」→ POST /api/auth/dev-login { username }
  → 后端签 JWT，前端 setAuthToken
  → 跳 /producer
  → AuthProvider 调 AccountApi.getMe() 拿到 user + studio
  → ProducerDashboard 调 ArtistsApi.listArtists() 拿到签约艺人
  → activeArtist 初始化为第一位；左上 / 右上 / 工坊全局一致
```

### 11.4 三端数据模型对齐（amend §9.3）

| 领域 | web types | web api | server DTO | server 路径 |
|------|-----------|---------|------------|-------------|
| me（含 studio 嵌入） | `AepUser.studio?: Studio` | `AccountApi.getMe()` | `MeDto`（AepUserDto + StudioDto） | `GET /api/me` |
| dev 登录 | `AuthApi.devLogin() / listDevAccounts()` | `DevLoginResult / DevAccount` | `DevAuthController`（@Profile("dev")） | `POST /api/auth/dev-login`, `GET /api/auth/dev-accounts` |
| 经纪公司签约艺人 | `ArtistsApi.listArtists()` | `Artist[]` | `List<DigitalIpDto>`（`DigitalIpService.listForUser`） | `GET /api/me/digital-ips` |

### 11.5 决策记录

- [x] **D11.1**：dev-login 仅在 `dev` profile 启用；生产 profile Bean 不注入，端点 404。演示部署若需保留，应显式打开；正式上线前必须切换为真登录。
- [x] **D11.2**：`/api/me` 返回嵌套 `studio`（而非另开 `/api/me/studio`）；原因：前端每次 `useAuth()` 都希望一次性拿到经纪公司档案，减少请求数与竞态。
- [x] **D11.3**：`/api/me/digital-ips` 改为 `ownerUserId ∪ studioId` 联合列表，**不分页**（MVP 单工作室艺人数量不大，未来按需切 Page）。
- [x] **D11.4**：StudioPage 的采纳按钮在无 artistId 时 disabled；根本原因是空列表场景下的兜底，不再让用户踩到 `artistId 必填` 的后端错误。
- [x] **D11.5**：Studio 档案修改入口统一走 admin 控制台。用户侧 `SettingsPage` 只读展示（修改 displayName/email/phone/bio 等个人字段仍走 `PATCH /api/me`）。

---

## 12. AI 明星专区 产品逻辑（Celebrity Livestream Selling，v2.7）

> 对应前端模块 `apps/web/src/app/producer/celebrity-zone/`、`apps/web/src/types/celebrity-zone.ts`、`apps/web/src/types/product.ts`。
> 对应 admin `/celebrity/{stars,projects,products}`、对应 server `CelebrityZoneController` / `ProductsController` / `AdminCelebrityController` / `AdminProductsController`。
> v2.7 已完整交付：5 页主流程 + 4 态授权 + 模板/盲盒双模式 + 商品库 + 任务持久化 + 引擎积分计价。

### 12.1 核心概念

**`CelebrityStar`** ≠ `DigitalIp`。两者并行存在：

| 维度 | `DigitalIp`（数字人主线） | `CelebrityStar`（明星带货主线） |
|------|---------------------------|--------------------------------|
| 来源 | 用户在「AI 孵化 / 形象锻造」从零创造 | 平台采购真人明星授权 + 数字孪生形象（运营录入） |
| 归属 | `ownerUserId`（创建者） | 平台共有，按用户颗粒授权（`CelebrityAuthorization`） |
| 玩法 | 音乐生成 / 形象锻造 / 衣帽间 | 模板 / 盲盒生成带货视频 → 分发到抖音 / 小红书等 |
| 计价 | 每次生成扣 credits（§10.3） | 引擎积分价 + 套餐配额双计费（§12.3） |

### 12.2 4 态授权状态机

```
unauthorized  ──[申请 / 购买套餐]──>  pending
                                          │
                                          ├──[审核通过]──>  authorized  ──[到期]──>  expired
                                          └──[审核驳回]──>  unauthorized
```

`CelebrityAuthorization`（apps/web/src/types/celebrity-zone.ts:55）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `unauthorized \| pending \| authorized \| expired` | 4 态枚举 |
| `scenes` | `string[]` | 已授权场景（带货 / 种草 / 测评） |
| `expireDate` | `ISODate?` | unauthorized/pending 时为 undefined |
| `availableStyles` | `int` | 可选风格数 |
| `pendingNote` | `string?` | 仅 pending 状态：审核进度提示 |
| `applyUrl` | `string?` | unauthorized/expired：申请入口路由 |

**前端守卫**：`/celebrity-zone/star/[id]/generate/page.tsx` 在 `authorization.status !== 'authorized'` 时强制 `redirect()` 回详情页，避免 URL 直跳越权。

### 12.3 引擎 / 计价 / 配额

**`CelebrityEngine`** = `KeLing`（经济）/ `HiGen`（标准）/ `MiniMax`（高级）

每条视频生成的双计费（前端 `ENGINE_META`，后端 `CelebrityZoneService.ENGINE_PRICING`）：

| 引擎 | 等级 | 单条积分价（credits） | 套餐扣减条数 | 估算耗时 |
|------|------|------------------------|--------------|----------|
| KeLing  | 经济 | ✦50  | 1 | ~5 分钟 |
| HiGen   | 标准 | ✦120 | 2 | ~3 分钟 |
| MiniMax | 高级 | ✦300 | 3 | ~4 分钟 |

**双门槛**：生成按钮 disabled 条件 = `钱包余额 < creditPrice` **OR** `套餐剩余 < quotaCost`。文案分别引导「立即充值」/「升级套餐」。

`getEnginePricing()` 接口让 admin 后续可以热改单价（接入后端配置后前端零改动），路径 `GET /celebrity/engine-pricing`。

### 12.4 商品库（Product Library）

独立领域，**两侧主线共用**（明星带货生成必填、未来 DigitalIp 也可引用）。前端 `apps/web/src/types/product.ts`、后端 `Product` 实体 / `ProductService`。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ID` | |
| `name` | `string` | 商品名称 |
| `category` | `ProductCategory` | 8 类：美妆 / 食品饮料 / 数码 3C / 服饰 / 日用百货 / 母婴 / 运动 / 其他 |
| `link` | `string?` | 淘宝 / 京东 / 小红书 等外链 |
| `images` | `string[]` | ≥1 张缩略图 |
| `sellingPoints` | `string` | 卖点描述（可被 AI 抽取覆盖） |
| `usageCount` | `int` | 累计被多少条视频引用 |
| `source` | `manual \| auto-from-generation` | 创建来源 |
| `createdAt / updatedAt` | `ISODate` | |

**两个特殊接口**：
- `POST /products/upsert-from-generation`：视频生成时调用 — 按 link/name 匹配已有 → +usageCount；找不到自动建档（source=auto-from-generation）
- `POST /products/extract-selling-points`：mock LLM 卖点抽取（后续可换 Coze / OpenAI）

### 12.5 数据模型

**`CelebrityStar`** 嵌套结构密集（authorization / stats / sampleVideos / pricing），后端用 JSON 字符串列存储（`authorizationJson` / `statsJson` 等），DTO 反序列化为 `Map<String, Object>`，Jackson 直接序列化对齐 TS interface。

**`CelebrityProject`**（用户在某个明星下创建的带货项目）：
- `ownerUserId`（NOT NULL）— 业主，权限判定用
- `starId / starName / starAvatar` — 冗余存星明信息便于列表展示
- `status` — 进行中 / 筹备中 / 已完成
- `channels`（JSON）/ `quota: { used, total }`
- 聚合统计字段：`videoCount / totalPlays / totalInteractions / conversions / gmv`

**`CelebrityProjectVideo`**（项目下的单条视频）：
- `status` — 已发布 / 待审核 / 生成中 / 已驳回（`ProjectVideoStatus`）
- `engine` / `durationSec`（15 / 30 / 60）/ `thumb` / `videoUrl`

**`CelebrityTemplate`**（模板生成模式可选预制模板）：
- `style` — 种草安利 / 硬核测评 / 轻松开箱 / 直播切片 / 剧情植入
- `recommendedEngine` / `recommendedPrice`
- `previews: [{ thumb, videoUrl }]`

**`CelebrityShowcase`**（往期案例展示）：
- `mode` — `template` 或 `blindbox`（仅后端归档用，不返前端）

**`CelebrityZoneOverview`**（数据中心大盘）：
- `hero: { totalPlays, totalConversions, activeStars }`
- `starLeaderboard[]` / `weeklyTrend[]` / `channelMix[]`

### 12.6 生成生命周期（前端持久化）

由于真实生成是 **异步、不可取消、已扣积分**，前端不再假装可撤销：

```
用户点「开始生成」
   → POST /celebrity/generate → 拿到 jobId（AsyncJobStarted）
   → CelebrityJobs.enqueue() 落 localStorage（key=aistareco.web.celebrity.pendingJobs.v1）
   → 工作台展示右下角悬浮卡（不阻断 layout，可最小化）
   → 文案：「已扣 ✦N 积分，异步执行不可取消，可继续浏览其他页面」
   → 顶部 PendingJobsBadge 实时显示进行中任务
   ↓
   ↓ （刷新 / 切 tab / 关闭浏览器都不丢任务）
   ↓
完成回调
   → CelebrityJobs.markCompleted() → 任务进入 result 预览态
   → 用户点「采纳」→ 落项目；点「重新生成」→ 重启同参数生成
```

**关键文件**：
- `apps/web/src/lib/celebrity-jobs.ts` — localStorage write-through + `celebrityJobs:changed` 事件
- `apps/web/src/components/celebrity-zone/PendingJobsBadge.tsx` — 顶栏徽章
- `apps/web/src/components/celebrity-zone/CelebrityGenerationWorkspace.tsx` — mount 时按 `?jobId` 或当前明星最近 running 任务恢复进度

### 12.7 接口清单（前端 → 后端）

用户侧 `/api/celebrity/*`（`CelebrityZoneController`）：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/celebrity/stars` | GET | 列出明星市场（filter: category / sort=hot\|price-asc\|price-desc） |
| `/celebrity/stars/{id}` | GET | 明星详情 |
| `/celebrity/active-star` | GET | 当前活跃明星（兼容旧入口） |
| `/celebrity/templates` | GET | 模板列表 |
| `/celebrity/showcases?mode=template\|blindbox` | GET | 案例库 |
| `/celebrity/projects` | GET / POST | 项目列表（status filter）/ 创建项目 |
| `/celebrity/projects/{id}` | GET | 项目详情 |
| `/celebrity/projects/{projectId}/videos` | GET | 项目视频列表 |
| `/celebrity/projects/{projectId}/distribute` | POST | 批量分发到渠道（异步） |
| `/celebrity/videos` | GET | 跨项目视频库（status / starId / projectId / sort） |
| `/celebrity/generate` | POST | 启动生成（返回 `AsyncJobStarted`） |
| `/celebrity/overview` | GET | 数据中心大盘 |
| `/celebrity/engine-pricing` | GET | 引擎计价表 |

商品库 `/api/products/*`（`ProductsController`）：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/products` | GET / POST | 列表（category / q）/ 创建 |
| `/products/{id}` | GET / PATCH / DELETE | 单体 CRUD |
| `/products/upsert-from-generation` | POST | 视频生成时按 link/name 匹配 → +usageCount 或自动建档 |
| `/products/extract-selling-points` | POST | mock LLM 卖点抽取 |

Admin 侧（`/api/admin/celebrity/*` + `/api/admin/products/*`）：聚合视图 + 跨用户读取，强制 `SUPER_ADMIN/OPERATOR` 角色。

### 12.8 决策记录

- [x] **D12.1**：`CelebrityStar` 与 `DigitalIp` 并行存在，各有 entity / DTO / 路由前缀，不合并。理由：归属语义不同（用户私有 vs 平台共有 + 授权）；商业模型不同（创作消费 vs 带货分润）。
- [x] **D12.2**：嵌套结构（authorization / stats / sampleVideos / pricing / channels / previews）以 JSON 字符串列存储，避免频繁 schema 演进。Service 层 ObjectMapper 反序列化为 `Map<String, Object>` 进 DTO。
- [x] **D12.3**：双计费 = 引擎积分价（钱包扣）+ 套餐配额（star.quotaUsed +1）。两个门槛同时校验，互不替代。
- [x] **D12.4**：生成不可取消。前端不展示「取消」按钮；改为右下角悬浮卡 + 黄色 callout 明示「已扣积分 + 异步不可中断」。
- [x] **D12.5**：商品库为独立领域（不挂明星 / 项目），两条主线共用。`upsertFromGeneration` 支持视频生成时自动落库。
- [x] **D12.6**：任务找回靠前端 localStorage（`celebrity-jobs.ts`）。后端真接入后改为基于 `pollUrl` 轮询，UI 适配点是 `CelebrityGenerationProgress.startedAtMs` 锚点 + `PendingJobsBadge` 数据源切换。
- [x] **D12.7**：明星专区共享 `layout.tsx` Shell，所有子路由（明星市场 / 我的项目 / 商品库 / 视频库 / 数据中心 / 详情 / 生成 / 项目）顶部常驻面包屑 + Tabs + 进行中任务徽章。

---

## 13. AI 产品版图（Roadmap Matrix，v2.7）

### 13.1 现行双主线

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Star Eco — 产品版图                       │
└─────────────────────────────────────────────────────────────────┘

┌─ 数字人主线（DigitalIp）────────────────┐  ┌─ 明星带货主线（CelebrityStar）─────────┐
│  孵化 / 锻造 → 多玩法生成              │  │  授权采购 → 模板化带货分发            │
│                                          │  │                                       │
│  • AI 孵化（incubator）                 │  │  • 明星市场（market）                │
│  • AI 形象锻造（appearance forge）      │  │  • 我的项目（projects）              │
│  • 衣帽间 v2（wardrobe）                │  │  • 商品库（products）★ 共用           │
│  • 音乐工坊（music workshop）§10        │  │  • 视频库（library）                  │
│  • —— 未来：直播切片 / 短视频           │  │  • 数据中心（data）                  │
│  • —— 未来：带货模板复用 §12            │  │  • 模板生成 / 盲盒生成 §12.5         │
└─────────────────────────────────────────┘  └─────────────────────────────────────┘
                          │                                    │
                          └──────── 共享基础设施 ──────────────┘
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
                   钱包 / 积分 / License            Studio / Tenant
                   (§1.3, §2)                       (§1.5, §1.6)
```

### 13.2 玩法矩阵

| 玩法 | 主线 | 状态 | 关键路径 | 计价方式 |
|------|------|------|---------|---------|
| AI 艺人孵化 | 数字人 | ✓ 已上线 | `/producer/incubator` | DigitalIp 创建一次性 / 升级扣 credits |
| AI 形象锻造 | 数字人 | ✓ 已上线 | `/producer/appearance` | 每次锻造扣 credits |
| 衣帽间 v2 | 数字人 | ✓ 已上线 | `/producer/wardrobe` | 装备搭配一键锻造（轻量计费） |
| 音乐工坊 | 数字人 | ✓ 已上线（§10） | `/producer/studio?type=singer` | 工作流计费表 `(modelVersion, thinkDepth) → creditsPerCall` |
| **AI 明星专区** | **明星带货** | ✓ **v2.7 已交付（§12）** | `/producer/celebrity-zone` | 引擎积分价 + 套餐配额双门槛 |
| 商品库 | 共用 | ✓ v2.7 已交付（§12.4） | `/celebrity-zone?tab=products` | 创建免费 / 引用 +usageCount |
| 数字人带货模板 | 数字人 | ⏳ P8 规划 | 复用 §12 模板能力到 DigitalIp | TBD |
| 直播切片二创 | 明星带货 | ⏳ P8 规划 | CelebrityStar 直播流 → 自动剪辑 | TBD |
| 跨主线统一商品库 | 共用 | ⏳ P8 规划 | DigitalIp 视频也走 `upsertFromGeneration` | 已就绪，待前端接入 |

### 13.3 暂不实现的领域（保留实体，UI 不暴露）

| 领域 | 原因 | 保留位置 | 重启条件 |
|------|------|---------|----------|
| NFT / 数字藏品 | 监管不确定 + 当前业务重心不在数字资产 | `NftCollection` 表 / `AdminStoreController` | 监管路径明确 + 跨链能力具备 |
| 版权核验 | 缺乏核验工具链 + 数字音乐版权由分发平台代行 | `CopyrightItem` 表 / `/admin/content/copyright` | 与音乐发行 OpenAPI 集成时联动 |
| 演唱会售票 | 售票链路重 + 当前线上首发节奏更轻 | `Concert` 字段保留（streamUrl 用于直播间链接） | 进入「线下落地」阶段 |
| 短剧 / 电影 / 商业广告 / 配音作品 | 制作链条重，超出 v2.x 数字人 + 带货 MVP 范围 | `Drama` / `Movie` / `Advertisement` / `VoiceWork` 表 / `AdminFilmController` | 引入对应工作流 + 制作团队后 |
| 粉丝打赏 / 社群高级 | 与本期 KPI 无关 | `AdminFanController` / `Activity` 表 | 社群运营投入加码时 |

> **冻结策略**：上述领域的数据库 schema、JPA entity、DTO 均保留，admin 侧栏与 web 入口移除（详见 §9.6 / §9.7）。重启时无需迁移历史数据，只需打开对应 controller 路由 + 补 admin 页面。

### 13.4 v2.7 三端交付状态

| 维度 | 内容 | 状态 |
|------|------|------|
| `apps/web` types | `celebrity-zone.ts`（248 行）/ `product.ts`（58 行） | ✓ |
| `apps/web` mocks | `celebrity-zone.ts`（已包含真人头像）/ `products.ts` | ✓ |
| `apps/web` api | `celebrity-zone.ts`（13 端点）/ `products.ts`（6 端点） | ✓ |
| `apps/web` UI | 5 页主流程 + 4 态授权 + 模板/盲盒 + 商品库 + 任务持久化 | ✓ |
| `apps/admin` types | 复制自 web，admin 侧无字段扩展 | ✓ |
| `apps/admin` api | `/admin/celebrity/*` + `/admin/products/*` | ✓ |
| `apps/admin` 页面 | `/celebrity/{stars, projects, products}` 3 页 | ✓ |
| `apps/server` model | 6 个 entity（JSON 列存嵌套对象） | ✓ |
| `apps/server` repo / service / controller | 6 / 2 / 4 | ✓ |
| `apps/server` DataInitializer | `CelebrityZoneDataInitializer`（@Order(2)） | ✓ |
| `specs/openapi.yaml` | 17 个 user 端点 + 10 个 admin 端点 | ✓ |
| 4 道契约门 | tsc(web) / tsc(admin) / contract / mvn compile | web/admin/contract ✓；mvn compile 因沙箱无 maven 缓存待 CI 兜底 |

### 13.5 决策记录

- [x] **D13.1**：版图收缩到「数字人 + 明星带货」双主线 + 「音乐 + 形象 + 衣帽间 + 带货 + 商品库」5 大玩法。其余领域**保留实体表 / 冻结 UI**。
- [x] **D13.2**：商品库为跨主线共用领域，不绑定明星或项目；`upsertFromGeneration` 让数字人主线后续接入零成本。
- [x] **D13.3**：admin 侧只保留运营核心 KPI 路径；NFT / 版权 / 短剧 / 电影 / 配音 / 演唱会售票等 controller **保留代码不删**，但侧栏入口移除（§9.6 列表）。
- [x] **D13.4**：本期 spec 不再讨论被冻结领域的数值字段改造细节；§4.2 仅保留「Song / Album / Wardrobe / Forge / Pose」5 个活跃领域。


## v0.200 · 2026-10-07 · 接手整合与资产/结算修复

- 整合 #101/#102/#106–#114/#122/#126/#127；#124 的独立 Storage 设置由 #125/#127 的共享实现取代。冲突保留当前画布、完整 ISO 时间与已落地的视频模型选择。
- 受保护视频镜像失败必须失败并释放冻结；DAP 作业在事务提交后派发。
- 名片 create/save 校验形象归属；存量公开读也检查归属。文档资产只允许当前用户名片目录 `card/<uid>/` 与当前名片历史目录 `cards/<cardId>/`，禁止任意 key/旧 URL 换签名；其他数字人资产走已验证 avatar 的 ref/motionRef。
- 混剪 asset_id 只解析本人或平台预置素材；本地静态路径校验属主和真实目录边界，拒绝任意 file/绝对路径。公网下载逐跳检查重定向，全部 DNS 地址校验后用于实际连接，拒绝内网地址；新缓存目录避免复用旧不可信下载。
- 发布重试新增 `aep_publish_jobs.retry_count`，**V38 Java migration** 幂等补列并将存量行设为 0。首次引用保留裸 jobId，兼容升级前在途冻结；后续尝试用 `jobId:rN`。禁止改旧迁移或重新冻结已有任务。
- IP 发布、clip 草稿和短视频 worker 写回增加行锁；补测试 fixture。JWT 篡改测试改动实际签名字节，避免只改变 Base64URL 填充位的随机误报。


### v0.201 · 2026-10-07 · 画布历史恢复与云端素材

生成结果重新打开后只能看到最新候选，旧 `adhoc` 运行没有可见入口；「加入我的资产」只写浏览器 IndexedDB，顶部资产页无法找到。新增完整运行历史（30 条分页）、最近 50 个画布内容版本与恢复入口、云端画布素材（图片/视频/文本）。历史成图与提示词可恢复到画布，无须重新生成或扣费；新运行另保留原始指令。项目卡自动从本人图片取封面。

V39 新增 `ip_project_revision` / `ip_saved_asset`，项目文档 TEXT 扩为 LONGTEXT，与既有 2MB 上限一致。版本与当前文档同事务，PUT 行锁串行检查指纹；素材按本人内容幂等，owner 行锁防并发重复。只保存 key，读取重签；删除素材条目不删除被文档/历史共用的原件。旧浏览器中有本人 key 的素材迁移到云端，未能确认归属的文本/data URL 不自动导入。

离开画布的导航先等待保存，保存失败留在画布并允许重试；在途失败不自动再次发 PUT，避免无限重试和错误基线。节点内容同步提前到 layout effect，候选图加载失败强制重签一次并给出明确重试入口。版本记录从更新后开始；旧操作不能凭空补造，既有生成记录直接可查。

接口：`GET /api/v1/ip-studio/projects/{id}/runs?page=0`；`GET projects/{id}/history`；`GET projects/{id}/history/{revisionId}`；`GET|POST /api/v1/ip-studio/saved-assets`；`DELETE saved-assets/{id}`。恢复整版沿用项目 PUT 与 `baseDocVersion`。运行历史、版本与素材均只允许属主访问。


### v0.202 · 2026-10-08 · 统一 Studio 创作链（首版本地完成，未发布）

在同一画布增加剧本、故事板和成片视图；AI 创作动作自动建节点与引用，不要求用户手动搭链。剧本支持起草、粘贴、编辑与改写，拆镜使用实际编辑正文并保留旧产物。图片可采用为新/已有 IP 的主形象或人物造型；已有人物及历史版本可跨项目引用。

新接口在 `/api/v1/ip-studio` 下：`GET studio/capabilities`、`GET studio/ip-assets`、`POST projects/{id}/studio-runs`、`POST projects/{id}/adopt`。契约真源 `packages/types/src/ip-studio-workflow.ts`。V40 为 `ip_run` 添加请求键/指纹及唯一(project_id, client_request_id)，kind 扩为 32 字符；同键同正文返回原任务，变更正文 409。原发布路径不变。

真实图片复用既有图像链；真实视频绑定已有 MaterialVideoJob，运行/费用/结果为只读投影；文本与合成复用 IpRun，worker 不修改客户端文档。显式本地 fixture 模式只替换模型返回，写库、归属、采用、重签与 ffmpeg 合成仍真实执行，成本为 0，生产/mysql 禁用。样例媒体不入版本库。随后已用真实 Agnes 在隔离本地验收 M0–M4 与本地平台积分，生产登录、MySQL 和发布尚未验收。

实施/验收状态见 `docs/ip-studio-unified-canvas-validation.md`。本轮范围已扩至 M5–M6：四模式导演助手、有限历史与本人节点引用、可编辑设定/指定集、逐集故事板/成片、有费用上限的连续制作；真实双集各自合成并通过暂停/刷新恢复。商品入口明确选择人物、商品与已确认卖点，剧本/首帧/视频和中文字幕品牌样片已生成；聚算固定音色、试听与配音成片现已接通，X-Dub 同音频口型短样片、免费对照提取与中文成片已验通；人物固定声音版本绑定现已接通，专属声音仍未完成，证据见验证记录 §11–12。

本地浏览器已验证三镜成片及下载一致、第二项目复用同一 IP、粘贴与指定正文改写、候选采用和旧输入保留、375px 核心入口。真实 M0–M4 平台消耗 156 积分，M6 双集/助手 88，M5 有限商品样片 50；同键恢复未重复扣费。合成成功写入现有 DapAssetUsage，来源 IP 作品页可返回 Studio 项目；旧发布人物可保留原 avatarId 关联 IP。这些是有限真实样例，不保证所有输入的角色与商品一致性，也不替代厂商账户账单。

用户新增“标准画布模板”核心方向：首个模板从图片/IP 产出主形象、独立三视图、表情、细节和可读文字展示板；同一资产继续用于作品。当前模板/示例已清理作者运行、请求、批准、对话和采用身份，公开仍沿用超级管理员权限。输入槽、依赖、人工确认、不可变版本、套用及局部重做列为 M7，详见 `docs/ip-studio-workflow-template-plan.md`；不能将图片资产包标为已训练口播数字人或 3D 模型。


### v0.202 配音增量 · 2026-10-08（本地验收通过，代码未发布）

Studio 新增固定音色配音节点、试听/下载、刷新恢复和成片采用配音。供应商为聚算 `qwen3-tts`，后台用途 `DAP_AUDIO`，9 个官方预设音色，正文最多 600 字、风格最多 160 字。新增 `GET /api/v1/ip-studio/studio/speech-catalog`、`POST /api/v1/ip-studio/projects/{id}/speech-runs`；仍以 IpRun 保存唯一任务，不新建任务或资产身份副本。V41 为两个用途 ENUM 添加 DAP_AUDIO，保留已有绑定；迁移必须先于用途配置。

平台按明确配置的单次配音价格校验 maxCost、冻结和结算；供应商按实际音频秒计量，两者分开。持久化原请求与 Job，afterCommit 派发，Idempotency-Key=runId，已受理任务重启只查询，超时不新建任务；音频鉴权下载、实际格式检查后转存 key，短期地址与到期换签。合成可用 `packaging.voiceoverStorageKey` 替换原轨，先验本人归属；长于成片拒绝，不截断台词。

真实 Vivian WAV 3.52 秒与带中文包装的 5.066016 秒成片通过，新增 8 积分、pending=0，恢复/重放不重复扣费。线上仅登记 Qwen3 TTS 端点，Studio 代码和 DAP_AUDIO 绑定仍待发布，生产售价未定。固定预设音色不代表专属声音克隆或数字人口型驱动完成。详见 `docs/ip-studio-unified-canvas-validation.md` §11。


### v0.202 口型增量 · 2026-10-08（本地短样片通过，未发布）

Studio 口型同步采用聚算 `x-dub`：选择本人 MP4 人物片段与已生成 WAV，先按真实音频秒向上取整报价，再确认生成。单独后台用途 `DAP_LIP_SYNC` 与 V42，平台明确配置每秒积分；本地测试为 10 积分/秒，生产售价未配置。只上传已选两份素材，原生请求仅 `model/input_video_asset_id/input_audio_asset_id`，不混入通用视频的提示词、时长或清晰度参数。输入/原 Job/checkpoint 保存在同一 IpRun，已受理后只查原 Job，同 Key 鉴权下载保留 `model=x-dub`。预检为 MP4、15–60fps、128MiB；WAV、最多 60 秒/25MiB，配音不得长于视频。成功转存真实视频后同事务结算，失败释放原冻结。

结果另存片段，先检查再采用。X-Dub 此次返回左原片/右口型的对照；“提取口型片段 · 免费”在画幅及左侧与源片 SSIM 匹配后取右侧，保留对照版本，不调供应商、不改输入或账本，重复提取返回同一文件。采用口型片段显式排除原片；合成保留该片段的原音轨。任务列表可定位画布结果。

真实小紫卡通 IP + 原 Vivian WAV 3.52 秒完成，原口型结果 1408×1280/25fps、提取为 704×1280，中文包装成片 720×1280/3.540998 秒。新增 40 积分，提取/合成 0，同键恢复/提取重放没有新增扣费，pending=0；浏览器下载与我方文件一致。详细证据见 `docs/ip-studio-unified-canvas-validation.md` §12。仅证明短样片闭环与可见嘴部变化，未量化音素同步质量或长口播。人物固定声音版本绑定后续已接通（验证记录 §13），专属声音克隆仍未接通；本次未修改线上绑定，代码未提交、未发布。

### v0.202 人物声音版本增量 · 2026-10-08（本地真实验收通过，未发布）

官方预设声音现可归属于人物：在完成的配音节点选择“设为人物声音”，保存音色、风格与真实试听，生成不可变版本，并明确设为默认；保存和切换免费。配音入口可选人物与历史声音版本、播放试听，已选择的版本锁定音色与风格。修改风格需要使用临时固定音色，再显式保存新版本；临时配音不改默认，旧任务继续使用原版本。

复用 `DapVoice(kind=preset,engine=qwen3-tts)`，新增 `profileVersion/stylePrompt/sourceRunId`；`DapAvatar.voiceId` 为默认声音的精确引用，新增 V43，不修改旧迁移，不给旧采样伪造训练状态。来源必须是本人当前项目成功的 studio-audio；音色/风格/试听来自服务端任务，人物行锁、expectedVoiceId 与唯一(avatar_id,source_run_id) 防止覆盖和重复采纳。采纳重放返回原版本，不将当前默认切回旧版本。试听只存 key、实时签名；画布只保存声音版本和 key 的快照。

新增 `GET /api/v1/ip-studio/studio/voice-profiles`、`POST /api/v1/ip-studio/projects/{id}/adopt-voice`、`PUT /api/v1/ip-studio/studio/performers/{avatarId}/voice`。TTS 请求可带 avatarId/voiceId，服务端校验本人、同人物、就绪、音色与风格一致；输入保存 appliedVoice 快照，已受理任务复用原请求正文。原请求兼容新增空字段的旧指纹，重放先于当前配置检查。成功配音与原积分结算同事务记录声音在项目的使用，不建立第二份任务或声音库存。

真实“小紫 · 自然声 v1”使用 Vivian 与“自然明快，像朋友一样介绍。”，原试听 3.52 秒；同版本新台词生成 WAV 4.96 秒，唯一新增消费 8 积分。v2 以新台词为试听，保留同一官方音色/风格；v1/v2 采纳重放、默认切换及原任务重放没有新增账本记录，旧任务仍是 v1。两版本均能在画布查看和试听，当前默认切回 v1。证据见 `docs/ip-studio-unified-canvas-validation.md` §13。专属声音克隆、长口播和生产整体发布验收仍未完成。


### v0.203 · 2026-10-08 · Studio 模板发布版本与输入表单（本地通过，未发布）

沿用 IpDemoTemplate/IpTemplateResolver，增加个人与官方可见范围、不可变 IpTemplateVersion（V44）及 Project.templateVersionId。本人在同一画布配置图片/IP、文字或选项输入、图片步骤、依赖、尺寸、输出角色和采用确认点；个人模板仅本人可见，官方发布仍需超级管理员。模板发布只按白名单重建配方与画布，作者媒体、历史候选、任务、身份、对话和批准不进入版本；旧接口不能覆盖版本模板或删除历史发布，旧模板和项目保持兼容。

用户先填自己的真实图片或精确 IP 图片版本，使用平台当前 DAP_IMAGE 配置预览逐步费用，再免费创建独立画布。每份实例重建 node/connection id、保留自己的输入并锁定来源版本；模板更新后旧画布不跟随变化，下架阻止新套用，旧画布仍可恢复创建时计划。发布与套用均不启动模型、不冻结积分；生成任务仍走原生 IpRun/账本。新增本人模板停用/启用、来源版本与创建时计划查看。商品入口同步修复仅引用旧人物图片时漏显示驱动/声音状态，多人物引用不猜默认出镜人。

M7.1 验收：两个不同人物输入分别建立独立画布，8 图片配方按当前单价报价 64 积分，v1/v2 锁定、停用阻止新建、恢复与作者私有素材清理通过，账本零变化。M7.2 的依赖执行/人工采用暂停/单步恢复与 M7.3 中文展示板/资产包归档尚未完成，八张图片尚未生成；不能将准备好的画布标为成功资产包。验证记录见 `ip-studio-unified-canvas-validation.md` §14。

### v0.204 · 2026-10-08 · 图片模板执行与一次人物设定图（本地，未发布）

有限图片配方复用原生 IpRun/账本，支持依赖、人工采用、逐步费用上限、单步指令调整、显式 CAS 重做和同键恢复；原任务/候选保留，上游变化标记过期，不自动重跑。未知受理结果不能修改原正文后重新提交。画布文档仍由客户端维护，执行指针和模板来源由服务端维护。

进阶模板可免费将采用且未过期的原图打包为 ZIP（来源清单）与可读中文展示板；部分选择明确显示 n/总数。主形象与人物造型显式归档，归档/打包重放复用原结果。本人版本统计派生自原生任务实际费用和采用状态，不含全平台指标。真实进阶样例14次生成/112积分、同请求恢复零新增扣费、pending=0；六张通过并在浏览器完成6/8部分资产包下载，两张仍因侧视角/面部风格未通过，不称完整成功。

按用户澄清，默认旗舰模板改为一个 `sheet` 图片步骤，一次生成一张包含人物档案、三视图、表情、面部/服装细节、配饰与材质配色的设定图。整图继续供图像参考，先生成单独镜头再做视频；独立资产/拼板为可选进阶流程。提示词见 `docs/prompts/ip-character-sheet.md`，按用户附图编写，不称作者原词。本地个人模板与独立实例只验证一张/8积分报价、零生成/零扣费；一次成图质量及整图参考出镜头尚待真实验收。代码与新增表尚未生产发布，详情见 `docs/ip-studio-unified-canvas-validation.md` §15。


### v0.205 · 2026-10-08 · IP 人物库与功能验收（本地，未发布）

画布入口改为“IP 人物库”，以人物为单位汇总主形象、历史、设定图、特写、表情、视角、服装细节和声音。对标 Chrome 中实际观察的小云雀角色库：搜索与分类 → 人物详情 → 选择具体素材 → 添加到画布。缺少素材显示未添加，人物属性只读取既有设定，不猜测。引用保存精确人物/图片版本/lookId/key 与默认声音版本，保存失败可恢复；已归档造型继续保存为人物素材。

V45 为 DapLook 增加可空 assetRole；免费分类接口只修改本人同人物的已完成造型类别，不改主图、版本或积分。旧请求缺此字段仍按旧指纹恢复，避免重复归档。模板结果在画布打开时恢复，计划关闭期间原任务仍继续更新，无需打开制作计划才找回图片。

用户明确本轮验收聚焦界面交互、功能逻辑与 LibTV 创作动线，图片美观及人物一致性不作为功能通过条件，不为改善效果反复生成。一次设定图已通过原生任务受理、结果返回与恢复；浏览器采用、人物sheet归档、跨画布整图引用和一次真实镜头生成均通过，原请求恢复没有新增费用。历史画质观察保留为模型效果备注，不阻塞已实现功能的验收。模板仍为有限图片配方；高级视频模式、专属声音克隆及生产发布不在已完成范围。详细交互与持久化证据见 docs/ip-studio-character-library.md 和 docs/ip-studio-unified-canvas-validation.md §16。

### v0.217 · Studio 对话快照分享（2026-10-08，本地未发布）

助手历史旁“分享”仅在完成一轮对话后开放。先保存画布并预览服务端白名单文字快照，再明确创建链接；任何获得链接的人可匿名查看对话和创作建议。V47 新增 `ip_conversation_share` / `ip_conversation_copy`，不修改原画布、素材和积分。24字节随机 token，同内容发布幂等；更新快照撤销旧链接，撤销和源画布删除使公开读取失效。公开 GET 仅豁免精确路径，返回 no-store/noindex；复制和管理保留登录、aiavatar 开通、手机绑定及本人归属检查。

快照不含源节点、素材 key/URL、请求、模型、任务或账号字段，原参考绑定替换为重新选择提示。公开页“在 Studio 中继续创作”将文字与建议复制到本人新画布，创建新节点 ID并直接打开助手，无媒体和执行请求，未自动生成；同 owner/clientRequestId 幂等，浏览器 session 保留复制键以供失败/刷新重试。复制内容仍需显式选择本人参考素材、模型并确认费用。分享后新增消息不会自动公开，未发送草稿不进入快照。

这是 Studio 自有分享闭环；LibTV 当前可见“空对话不能分享”入口，但调研账号无历史，本轮未为探测弹窗调用模型，不能宣称其分享表单的所有行为逐项一致。公开画布与复制、社区展示仍是独立待办。验收见统一验证§28。

### v0.220 · 模型端点并发与排队（2026-10-09，本地未发布）

模型接入端点新增可选 `concurrencyLimit`。后台编辑入口留空不限制，正整数控制同一端点在多个应用/用途里的在执行生成数量，超出先进先出排队；视频/配音/口型按整个上游任务计数。现有 `POST/PUT /api/admin/ai-models[/{id}]` 接受该字段，更新省略/null 不改、0 清空限制。V48 新增端点列与 `AiGenerationQueueEntry`，不改变积分账本、用户选择模型和素材归属。排队任务可停止，刷新和服务重启恢复原请求；未知视频受理结果保留容量，不自动重发。详见 `docs/ai-endpoint-generation-queue.md` 和统一验收§36。

### v0.228 · Studio 供应商积分计价与上线收尾（2026-10-10）

按用户确认，新增配音、口型同步暂以 1 聚算积分 = 1 平台积分，加 50% 溢价；人民币换算后续统一调整。配置 `ipstudio.supplier-point-pricing` 分开保存供应商每秒积分、换算比例和溢价，不混用端点的人民币微元字段。先对供应商计费秒数向上取整，再对整笔平台积分向上取整，避免每秒取整造成额外溢价。生产确认成本前不开放模型，旧验收单价不作为正式售价。

配音按正文 Unicode 字符数 + 10 秒（上限 600 秒）确定并显示预冻结上限，生成完成按实际音频时长结算、退回剩余冻结；这是一笔消费上限，不是时长预测。极端慢速音频超出上限则明确失败并释放冻结，不追加扣费。口型同步按已解码驱动音频时长报价。任务保存完整定价快照，重启恢复、同键重放和后台调价不改变原请求；已受理旧任务保留旧快照兼容。

正式发布覆盖后端、AiAvatar 和管理后台；保留个人画布发布模板，整画布分享仍暂缓。发布前已完成生产数据库/旧服务备份，隔离 MySQL 8.0.46 上 V39→V48 九项迁移与重复启动零迁移检查；正式部署与线上验收事实记录在 `docs/ip-studio-production-release.md`。

### v0.229 · 画布连线引用修复（2026-10-10）

连线到空白处显示“引用该节点生成”，可创建文本、图片或视频草稿，自动引用源节点并进入同一创作浮层；连接已有节点也可拖到其内容区。取消不生成孤立节点，剪断后移除创作输入，撤销与保存刷新保留连线。上游文字随生成请求保存当前正文快照，后续编辑不追溯修改原任务。H3 首帧上传的线上端点连接故障已修正；失败任务冻结 200 积分已全额释放，未自动重提付费生成。


### v0.230 · 账号与旧 Studio 界面统一（2026-10-10）

桌面 `/me` 改为账号总览，使用工作台顶栏、Studio 色彩和统一账号导航；任务、会员与积分、存储、真人授权素材、回收站、设置与安全共用同一内容区，去掉旧 Studio 的 480px 手机取景框。已有业务接口和流程继续复用，没有另建账号真值或改计费。

旧 `/studio`、`/#studio` 入口转到自由画布，旧首页/资产库/我的/授权入口映射到现有页面；账号工具保留 hash 深链。菜单、选中状态、内部跳转及浏览器前进后退同步，创建参数和真人确认回调原样保留。正式模式不展示静态演示订阅套餐；充值读取现有后台套餐，加载、空列表和失败重试可见。详见 `docs/aiavatar-account-unification.md`。任务中心仍展示资产生成任务，画布任务沿用各画布历史；不宣称旧业务模块全部重写。

### v0.231 · 2026-10-10 · 模板画布副本

模板套用改为点击后直接创建、打开普通个人画布副本。创作者在画布内查看工作流、替换人物/商品参考、修改文案与模型；保存只改个人副本，原模板与其他副本不变。进入不需要填写输入或预览报价，生成前由节点交互与既有后端检查引用、模型、积分和计费。文字默认值及变量引用落入实际画布节点/连线；个人发布模板保留，旧版本执行实例及原任务恢复继续兼容。新复制走原 projects 创建接口，按本人/官方可见范围解析，不引入第二份输入或执行真值。

### v0.232 · 模板只读预览与显式个人副本（2026-10-10）

官方模板点击后先打开只读画布，浏览、缩放和查看节点提示词不创建项目。仅点击“存为个人副本”免费创建一份普通可编辑画布；保存中禁用重复提交，失败保留预览并由用户重试。首页、画布列表与画布内模板库共用这条路径，个人发布模板也按不可变来源预览。预览不挂载项目同步或生成工作台，不能拖动、增删、改写节点及连线；沿用现有节点样式和画布浮层查看设置。个人副本继续在节点内替换输入、编辑和确认生成费用，原模板不变，旧锁定实例保持兼容。本规则替代 v0.231 的“点击即创建”入口。
