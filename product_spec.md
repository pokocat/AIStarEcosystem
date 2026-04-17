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
