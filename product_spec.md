# AI Star Eco — 数据模型对齐规范（Product Spec）

> 本文档是「前端 (`apps/web_new`) ↔ 后端 (`apps/server`)」数据模型对齐的**契约文件**。
> 一切以 **前端 TypeScript 类型为准**，后端 Java/JPA + MySQL Schema 必须服从前端约束。
> 字段格式遵循「**后端存数字、前端做格式化**」的总原则。

---

## 0. 核心产品逻辑（最高优先级）

### 0.1 计费模型 — 一切以「点数 / Credits」结算（无订阅）

- **唯一计费单位**：`credits`（点数 / 积分）
  - 后端字段类型：`BIGINT`（不再使用「分 / cents」「金额」等表达）
  - 业务含义：1 credit = 平台内可消费的最小计费颗粒
- **没有任何业务功能直接以现金结算**。即便是 NFT 售卖、内容打赏、合约抽成，最终都体现为「点数变动」。
  - 法币 ↔ 点数 的兑换属于「充值 / Recharge」流程，独立于业务系统。
  - 提现 = 点数 → 法币的反向兑换，挂在钱包模块外。
- **没有订阅 / 套餐概念**。点数的来源只有三种：
  1. **License 兑换**：注册时核销 License Key 一次性入账（金额由 License 所属 Batch 决定）
  2. **充值 / Recharge**：用户付费购买点数（自助充值流程，非本规范主体）
  3. **业务收益**：内容播放、版税、NFT 售卖等业务结算入账（type = `income`）
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
  | "income"               // 业务收益入账（NFT 售卖/版税/打赏）
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
  referenceType?: string;    // "song_revenue" / "nft_sale" / "subscription" 等
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

### 4.2 其余内容域（Track / Pose / Wardrobe / Nft / Album / Concert）

数值字段全部按 §3.1 转为原始数值。具体改动列表（待 §1–§2 确认后逐表展开）：

- `Track`：`plays / revenue` → BIGINT credits；删除 `durationLabel`，前端用 `durationSec` 格式化
- `WardrobeItem`：`price` 单位明确为 credits（BIGINT）
- `NftCollection`：`priceLabel` 字符串 → `priceCredits` BIGINT
- `Concert`：`ticketPrice / revenue` → BIGINT credits
- `Album`：`sales / revenue` → BIGINT
- `SignedArtist`（`coach.ts`）：`monthlyRevenue / totalRevenue / fans` → number；`royaltyRate` 保留 INT 0–100

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
| P1   | Auth / Wallet / License / Tenant / Studio          | 新增 `aep_studios`；废弃 plan/subscription/entitlement/feature/product 五张表；LicenseBatch 增加 `initial_credit_grant`；前端新增 `account.ts` / `studio.ts` / `license.ts` / 修订 `settings.ts`（去掉 `SubscriptionPlan` 与 `BillingRecord`）/ `finance.ts` |
| P2   | DigitalIp 合并 + 前端 Artist 数值字段去字符串化   | 新表 `digital_ips`；数据迁移脚本；前端 `Artist.stats` 字段类型变更；新增 `lib/format.ts` 与 `useFormat()` |
| P3   | Track / Wardrobe / Nft / Concert / Album 等内容域 | 各表数值字段改造；前端展示派生类型     |
| P4   | 管理后台（admin-new）UI 对齐 Studio/License 视角  | 机构发放/核销/累计点数发放看板          |

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

整条业务链以 Studio 为轴心：

```
平台账户 (AepUser / Tenant)
   └─ 经纪公司 (Studio)
        └─ AI 艺人 (DigitalIp / Singer)
             └─ AI 作品 (Song / Album / Concert / Drama / Movie / Ad / VoiceWork)
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
|            | `/content/albums`      | `Album`              | 专辑排期                         |
|            | `/content/concerts`    | `Concert`            | 售票中演出                       |
|            | `/content/dramas`      | `Drama`              | 短剧审核                         |
|            | `/content/movies`      | `Movie`              | 电影上映审核                     |
|            | `/content/ads`         | `Advertisement`      | 品牌代言 / TVC                   |
|            | `/content/voice`       | `VoiceWork`          | 动画/纪录片/有声书/游戏配音      |
|            | `/content/copyright`   | `CopyrightRecord`    | 版权核验                         |
| 分发与变现 | `/distribution/platforms` | `Platform`        | 渠道接入审核                     |
|            | `/distribution/queue`  | `DistributionItem`   | 发行队列复核                     |
|            | `/monetization/nft`    | `NFTItem`            | 收藏品上架                       |
|            | `/finance/ledger`      | `Wallet/LedgerEntry` | 钱包 + 点数流水 + 业务交易复核   |
|            | `/finance/risk`        | 合成               | 大额流水 / 异常提现风控          |
| 社群       | `/community/events`    | `CommunityEvent`     | 投票/见面会/挑战赛               |
|            | `/community/moderation`| `Activity`           | 动态与打赏审核                   |
| 基础数据   | `/base/genres`         | `Genre`              | 曲风 / 领域                      |
|            | `/base/wardrobe`       | `WardrobeItem`       | 造型库                           |
|            | `/base/pose`           | `Pose`               | 动作 / 表情 / 手势               |
|            | `/base/credit-packs`   | `CreditPack`         | 点数售卖规格（取代订阅）         |
| 消息与日志 | `/notifications`       | `Notification`       | 运营推送                         |
|            | `/audit`               | `AuditEntry`         | 所有人工介入审计                 |

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
- `COPYRIGHT_STATUS.pending`
- `PLATFORM_STATUS.pending`
- `DRAMA_STATUS["post-production"]` / `MOVIE_STATUS["post-production"]` / `AD_STATUS.negotiating`
- `CONCERT_STATUS.selling`
- `TRANSACTION_STATUS.pending` / `processing`
- `LEDGER_ENTRY_TYPE.freeze` / `adjust`
- `ACCOUNT_STATUS.suspended` / `STUDIO_STATUS.suspended`
- `COMMUNITY_EVENT_STATUS.upcoming`

### 9.5 金额展示约定

- 所有 credits 字段由 `lib/format.ts` 的 `formatCredits` / `formatSignedCredits` / `formatCompactNumber` 处理；
- `CreditPack.priceCents` 使用 `formatCurrency(cents)` 展示（CNY，后端以「分」为单位）；
- **绝对禁止** 将数值字段以字符串形式从 mock/DTO 传入组件（见 §3.1）。

### 9.6 删除项

P4 交付时下述页面与常量已从 admin-new 移除（替代路径在括号内）：

- `/base/plans`（→ `/base/credit-packs`）
- `/coach/contracts` / `/coach/mcn`（并入 `/platform/studios`）
- `/fan/nft-market`（→ `/monetization/nft`）
- `/content/film`（拆分为 `/content/{dramas,movies,ads,voice}`）
- `/finance/settlement`（→ `/finance/ledger`，从「元」切到 credits）
- `types/settings.ts` 中的 `SubscriptionPlan` / `BillingRecord`；`types/finance.ts` 中的 `WalletSummary`（迁至 `types/wallet.ts`）。

### 9.7 Admin 后端接口清单（`/api/admin/**`）

后端 `apps/server` 现已与 `apps/admin` 1:1 落齐。除 `/auth` 登录外，下列接口均需 Bearer Token（`PLATFORM_OPERATOR` / `FINANCE_ADMIN`）。**列表响应走 `PageEnvelope`，单体/命令响应走 `ApiResponse`**（见 §6.4）。

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
| `GET·PUT /admin/community/**`         | `AdminCommunityController`         | `/community/*` / `api/community.ts`                   |
| `GET·POST /admin/distribution/**`     | `AdminDistributionController`      | `/distribution/*` / `api/distribution.ts`             |
| `GET·POST·DELETE /admin/store/**`     | `AdminStoreController`             | `/monetization/nft` 等 / `api/store.ts`               |
| `GET·POST·DELETE /admin/fan/**`       | `AdminFanController`               | `/community/*` 粉丝子域 / `api/fan.ts`                |
| `GET·POST /admin/film/**`             | `AdminFilmController`              | `/content/{dramas,movies,ads,voice}` / `api/film.ts`  |
| `GET·POST /admin/coach/**`            | `AdminCoachController`             | 教练/培训子域 / `api/coach.ts`                        |
| `GET·POST /admin/appearance-forge/**` | `AdminForgeController`             | 形象工坊 / `api/appearance-forge.ts`                  |
| `GET·POST·PUT /admin/settings/**`     | `AdminSettingsController`          | `/platform/config` / `api/settings.ts`                |
| `GET·POST·PUT /admin/platform-configs/**` | `AdminPlatformConfigController` | `/platform/config` 次级 / `api/platform-config.ts`   |
| `GET /admin/audit-logs`               | `AdminAuditController`             | `/audit` / `api/audit.ts`                             |
| `GET /admin/notifications`            | `AdminNotificationController`      | `/notifications` / `api/notifications.ts`             |
| `GET·POST·DELETE /admin/staff/**`     | `AdminStaffController`             | 运营团队（P2）                                        |

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
AI 艺人 (DigitalIp)
   └─ AI 歌曲 (Song)       ← 必须绑定 artistId；对接外部音乐发行平台时
        ├─ 歌单 (Album)     ← 歌曲的合集（非"专辑发行"）
        └─ 分发 (Distribution → 外部音乐发行开放平台)
             └─ 播放量 / 版税 (Wallet / LedgerEntry)
```

**硬性约束**：
- **Song 必须先有 artist**：创建歌曲前必须先在「AI 孵化」里拥有至少一位 DigitalIp。未绑定 `artistId` 的 Song 不能保存，更不能分发。
- **Song.artistId 即外部平台上的"演唱歌手"**：未来接入 QQ 音乐 / 网易云 / YouTube Music 等发行 OpenAPI 时，元数据里的 `artist_name` / `performer` 直接取 `DigitalIp.name`；ISRC、词曲版权归属、分润账户也都挂在这条 `artistId` 下。
- **数字音乐 = 纯线上发行**：没有实体专辑、没有首发日、没有"策划→录制→发布"的专辑生命周期。

### 10.2 Song（歌曲）—— 前端类型变更

`apps/web/src/types/music.ts` 的 `Song` 在现有字段之外需要扩展：

| 字段             | 类型                  | 说明 |
|------------------|-----------------------|------|
| `artistId`       | `ID` **(必填)**        | 演唱歌手 = `DigitalIp.id`；后端校验 ownership |
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
