# AI 明星带货 · 产品规格（独立文档）

> 本文档**仅描述 AI 明星带货线**（带货方视角），与 `product_spec.md` 中的"AI 数字人/数字 IP"线**解耦**。
> 三端覆盖：`apps/miniprogram`（带货方）+ `apps/server`（共用后端）+ `apps/admin`（运营/审核）。
> 单一真源：字段形状对齐 `apps/web/src/types/celebrity-zone.ts`。
> 维护规则：每次变更**追加**新版本节，不删除历史；"现状"小节始终反映最新一版的实际行为。

---

## 一、商业逻辑（不变量）

```
CRM销售 → 激活码兑换/注册 → 账号授权明星 → 经纪/代理团队审核资质
→ 带货方用明星生成带货短视频 → 发布推广 → 数据回收 → 账号复盘成长
```

带货方在小程序里完成的环节：

```
激活码注册 → 选明星 → 提交资质 → 选模型/模板/时长 → AI 生成 →
发布到分发渠道 → 看数据 → 看复盘
```

不在小程序的能力（→ admin）：

- 激活码生成与发放（小程序仅核销）
- 经纪/合规审核工作台
- 明星上下架、价格、品类、风控、模板/明星视频/形象图集**资料上传**
- 平台财务、分账、对账、BI 报表

---

## 二、数据模型（节选 · 与 web 真源对齐）

### CelebrityStar（明星）

| 字段 | 类型 | 备注 |
|---|---|---|
| `id` | string | |
| `name` | string | 中文名 |
| `category` | `演员 \| 歌手 \| 主持人 \| 运动员 \| 网红 \| 综艺` | 主类 |
| `subCategories` | string[] | 副类（带货品类） |
| `tagline` | string | 一句话定位 |
| `startingPrice` | string | "¥2,800/条" |
| `hotScore` | number | 热度 0-10 |
| `isHot`, `isFree` | boolean | 推荐 / 限免 |
| `auth` | `CelebrityAuthorization` | 授权状态 |

### CelebrityAuthStatus（4 态）

`unauthorized` → `pending` → `authorized` ⇄ `expired`

### CelebrityStarDetail（增强字段，本期新增）

| 字段 | 类型 | 备注 |
|---|---|---|
| `bio` | string | 一段简介 |
| `location` | string | 所在地 |
| `fans` | number | 粉丝数（原始整数，前端用 `formatCompactNumber`） |
| `cooperationCount` | number | 历史合作次数 |
| `avgGmv` | number | 平均单条 GMV（人民币元） |
| `photos` | `{id, url, caption}[]` | 资料图集（admin 上传） |
| `videos` | `{id, title, durationSec, coverUrl, playUrl, tag}[]` | 形象/代言视频（admin 上传） |
| `skills` | `{name, val}[]` | 能力画像 0-100 |
| `cases` | string[] | 适用品类 |
| `authProgress` | `{percent, steps[]}` | 授权流程时间线 |

### CelebrityEngine（模型引擎）

| name | level | cost | creditPrice | quality | speed | 适用 |
|---|---|---|---|---|---|---|
| KeLing  | 经济 | 1 | 50  | ★★★    | ~5 分钟 | 日常批量 |
| HiGen   | 标准 | 2 | 120 | ★★★★   | ~3 分钟 | 推荐默认 |
| MiniMax | 高级 | 3 | 300 | ★★★★★  | ~4 分钟 | 重点投放 |

`creditPrice` 来自 `GET /celebrity/engine-pricing`；本地 mock 与上表一致。

### CelebrityTemplate（模板）

| 字段 | 类型 | 备注 |
|---|---|---|
| `id` | string | broadcast / scene / review / vlog |
| `name` | string | 口播种草 / 情景剧 / 测评开箱 / VLOG |
| `desc` | string | 一句话说明 |
| `previewCover` | string | 缩略图（admin 上传） |
| `previewVideoUrl` | string | **效果预览视频**（admin 上传，本期新增） |
| `durationSec` | 15 \| 30 \| 60 | 推荐时长 |

### Wallet（积分钱包）

`total = license + recharge + gift`，`pending` 单独冻结桶（生成中），不计入 `total`。
所有变动走 `LedgerEntry`（不可变追加），不直接 UPDATE 余额列。

### Recharge Package（充值套餐）

| id | credits | priceYuan | bonus | recommended |
|---|---|---|---|---|
| pkg-300   | 300   | 99   | —          | false |
| pkg-1000  | 1000  | 299  | + 100 赠送 | **true** |
| pkg-3000  | 3000  | 799  | + 500 赠送 | false |
| pkg-10000 | 10000 | 2399 | + 2000 赠送| false |

---

## 三、计费规则（积分扣减）

```
本次消耗 = engine.creditPrice × duration_multiplier
  其中 duration_multiplier:
    15s → 0.7
    30s → 1.0
    60s → 1.5
```

约束：

1. 提交生成前**预冻结**积分（落入 `pending` 桶），任务完成后转扣减；任务**失败自动退回**到原桶。
2. 余额不足：CTA 灰化 + 红色"余额不足 · 去充值"；点击直达 `/pages/recharge/index`。
3. 扣减优先级：`gift → recharge → license`（赠送先用，套餐保底）。

---

## 四、模块（小程序端）

### 4.1 明星专区（合并原"明星市场"）

页面：`pages/market/index`，5 Tab 之一。

**双 Tab 切换**（本期新增）：

- **我的明星**（默认）：仅展示当前账号 `auth.status ∈ {authorized, pending}` 的明星。每张卡片在已授权时多一条**"✦ 用 TA 生成视频 →"** CTA，直达 `/pages/generator/index?starId=xxx`。空态引导去市场。
- **全部市场**：浏览全部明星，含搜索条/分类 chip/排序/Featured 大卡 + 网格。每张卡片角标显示 `已授权 / 审核中 / 限免` 三态之一。

接口：
- `GET /celebrity/stars?owner=me` — 我的明星（小程序 mock 用客户端按 `auth.status` 过滤实现，server 端推荐用此 query）
- `GET /celebrity/stars?category=xxx` — 全部市场
- `GET /celebrity/stars/{id}` — 详情（含 photos/videos）

### 4.2 明星详情

页面：`pages/celebrity-detail/index`。

**新增内容**：
- 数据快览条：`粉丝 / 合作 / 平均GMV / 所在地`
- **资料图集**：3 列网格，最多 N 张。点单图走 `wx.previewImage`。**admin 在后台上传**。
- **形象/代言视频列表**：每行带缩略图 + 时长，点击弹层播放。`<video>` 渲染 `playUrl`，URL 缺失时显示降级提示（"运营在 admin 后台上传后此处自动展示"）。
- **明星简介**段（bio）

**条件 CTA**（顶部价格卡片右侧）：
- `unauthorized` → 黄绿底"申请授权 →"，点击拉起资质上传 ActionSheet
- `pending` → 橙色"审核中 ⏱"，点击 toast 提示 SLA
- `authorized` → 黑底霓虹绿"✦ 用 TA 生成视频 →"，直达生成器

### 4.3 视频生成器

页面：`pages/generator/index`。

**5 步配置**（本期由 4 步扩到 5 步）：

1. 选择明星（默认从上一页带入）
2. 选择商品（从商品库 / 扫码 / 链接）
3. **脚本风格 + 效果预览**（本期新增）— 4 个模板缩略图，**点缩略图弹层播放运营上传的 `previewVideoUrl`**，弹层底部"使用此模板 →"将其设为当前选中。点信息区切换选中态（不弹层）。
4. **选择模型**（本期新增）— `KeLing / HiGen / MiniMax` 三选一，每个引擎卡显示：颜色条、名称、档位 chip、画质星级、描述、`speed`、**积分单价/条**。
5. 时长（15/30/60）/ 语种（普通话/粤语/英语）

**底部固定栏**（本期新增）：
- 实时显示 **本次消耗 = engine.creditPrice × duration_multiplier**（积分数）
- 余额不足时显示红色"余额不足 · 去充值 →"，点击进 recharge 页
- 主 CTA 副标显示 "{engineName} · {duration}s"

接口：
- `GET /celebrity/templates` — 模板（含 `previewVideoUrl`）
- `GET /celebrity/engine-pricing` — 引擎单价
- `GET /me/wallet/credits` — 余额
- `POST /celebrity/generate` — 提交生成；body 增加 `engineName / templateId / creditCost`

### 4.4 生成过渡

页面：`pages/generating/index`。

4 步 Pipeline 时序：脚本撰写 → 分镜画面 → AI 配音 → 视频合成。展示进度条 + ETA + 实时百分比。

按钮"后台运行"将任务转入后台，跳到视频中心；完成后片片 Bot 推送通知。

### 4.5 视频资产中心 + 视频详情

页面：`pages/videos/index` + `pages/video-detail/index`。

- 视频中心 hero 显示**积分额度**进度（与钱包同源），"+ 充值"直达 recharge 页。
- 草稿/失败列表项下沉色 CTA："📤 发布"打开多平台 ActionSheet；"↻ 重新生成"二次确认后跳回生成器。
- 视频详情顶部按钮（↓/⋯）+ 收藏 + 多平台发布 + 复制并改 + 渠道格子（点已发→看明细，点未发→拉发布确认）+ 教练建议卡片→ 跳长长 Bot 对话。

### 4.6 数据看板

页面：`pages/dashboard/index`。

- Range tabs：今日 / 7日 / 30日 / 自定义
- KPI 4 格 + 漏斗 + TOP 视频列表 + 长长教练复盘卡片
- 点 KPI 钻取明细（占位）；点 TOP 行进视频详情；点复盘卡跳长长 Bot 对话

### 4.7 钱包 / 充值（"我的"页 + 充值页）

页面：`pages/me/index` + `pages/recharge/index`。

- "我的"页 hero 卡：`total` 大数 + 4 桶（套餐/充值/赠送/冻结）+ 双 CTA（充值 / 交易明细）
- 充值页：4 套餐网格 + 计费说明 + 底部 sticky"确认支付"
- mock：直接落账 `recharge += credits`（如有 `bonus`，落账 `gift += bonus`），更新 `total`
- 真实环境：先 `wx.requestPayment` 走微信支付，回调成功后再调 `POST /me/wallet/recharge`

接口：
- `GET /me/wallet/credits` — 4 桶 + 总额
- `GET /me/wallet/packages` — 套餐列表
- `POST /me/wallet/recharge { packageId }` — 充值落账

### 4.8 消息（Bot 同事 + 待办）

页面：`pages/messages/index`（列表）+ `pages/chat/index`（详情）。

- 列表：5 个 AI Bot 会话预览（预览文本 + 时间 + 红点未读数）+ 待办中心
- 详情：消息流支持 `time / text / card-cta / card-form / card-grid / user-text` 6 种块；CTA 卡片可携 `route` 直达对应业务页

---

## 五、运营后台（apps/admin）必须支撑的能力

> 本期不在 admin 实现新 UI，但下表声明了 server / admin 必须暴露的写入接口，供后续在 admin 中接入。

| 资源 | 写入能力 | 接口（/api/admin/celebrity/...） |
|---|---|---|
| 明星 | 上下架、信息编辑、品类、价格 | `POST/PUT /admin/celebrity/stars[/{id}]` |
| 明星照片 | 上传 / 排序 / 删除 | `POST/DELETE /admin/celebrity/stars/{id}/photos` |
| 明星视频 | 上传 / 编辑标题/标签 | `POST/DELETE /admin/celebrity/stars/{id}/videos` |
| 资质审核 | 推动状态机（pending → authorized/rejected） | `POST /admin/celebrity/auth/{id}/transition` |
| 模板 | 新增 / 编辑 / 上传 `previewVideoUrl` | `POST/PUT /admin/celebrity/templates[/{id}]` |
| 引擎价格 | 调价、上下架 | `PUT /admin/celebrity/engine-pricing` |
| 充值套餐 | 套餐配置、活动赠送 | `PUT /admin/finance/recharge-packages` |
| 积分账本 | 查询用户 ledger（不可变追加） | `GET /admin/finance/ledger` |

---

## 六、版本日志（按时间倒序追加，**不删除历史**）

### v0.4.0 · 2026-05-07 — Server 端落地 v0.3 全部接口（三端打通）

**状态升级**：从 v0.3 的"小程序 mock 落地" → "**server + miniprogram 双端打通**"。
小程序把 `globalData.useMock = false` 后，11 屏全部能跑真实 server，无 404、无字段缺失。

**真源类型扩展**（apps/web/src/types/* 同步到 apps/admin/src/types/*）

- `celebrity-zone.ts`：
  - `CelebrityStar` 增 5 个可选字段：`bio? / location? / fans? / cooperationCount? / avgGmv?`，以及 `photos?: CelebrityStarPhoto[] / videos?: CelebrityStarVideo[]`
  - 新增类型：`CelebrityStarPhoto { id, url, caption? }` / `CelebrityStarVideo { id, title, durationSec, coverUrl?, playUrl?, tag? }`
  - `CelebrityTemplate` 增 `previewCover? / previewVideoUrl? / durationSec?`
  - `CelebrityGenerationRequest` 增 `engineName? / durationSec? / creditCost? / language? / keypoints?`
- `wallet.ts`：新增 `RechargePackage / RechargeRequest / RechargeResponse`
- `notification.ts`：新增 `BotMeta / ChatMessageType / ChatMessage / BotConversation`（含 6 种 discriminated 块）

**openapi.yaml 增量**

- 扩 `CelebrityStar / CelebrityTemplate / CelebrityGenerationRequest` schema
- 新增 schema：`CelebrityStarPhoto / CelebrityStarVideo / RechargePackage / RechargeRequest / RechargeResponse / BotMeta / ChatMessageType / ChatHighlight / ChatFormField / ChatTag / ChatGridItem / ChatCta / ChatMessage / BotConversation`
- `GET /celebrity/stars` 增加 `owner=me` query 参数（仅返回当前用户已授权或审核中的明星）
- 新增 path：`GET /me/wallet/credits`、`GET /me/wallet/packages`、`POST /me/wallet/recharge`、`GET /notifications/conversations/{botId}`

**apps/server 实体 / 迁移**

- 修改：`CelebrityStar` 新增 7 列（`bio / location / fans / cooperationCount / avgGmv / photos_json / videos_json`）；`CelebrityTemplate` 新增 3 列（`previewCover / previewVideoUrl / durationSec`）
- 新增实体：
  - `CelebrityAuthStatus`（enum：`UNAUTHORIZED / PENDING / AUTHORIZED / EXPIRED`，wire 用 lower-cased，`@JsonValue` + `@JsonCreator`）
  - `CelebrityStarAuthorization`（用户 × 明星授权关系表，`@UniqueConstraint(user_id, star_id)`）
  - `RechargePackage`（充值套餐表）
- 新增 repository：`CelebrityStarAuthorizationRepository / RechargePackageRepository`

**关键设计：授权关系独立成表**（D1）

`CelebrityStar.authorizationJson` 此后**仅作匿名预览的"陈列态默认值"**，登录用户的真实授权一律走新建的 `CelebrityStarAuthorization` 表。
- `?owner=me` 通过 `findByUserIdAndStatusIn(userId, [AUTHORIZED, PENDING])` 实现
- 详情接口 `GET /celebrity/stars/{id}` 在 Principal 非空时调用 `findByUserIdAndStarId` 注入实际授权块

**apps/server DTO 新增 / 修改**

- 修改：`CelebrityStarDto`（新字段 + `from(star, authOverride)` 重载）；`CelebrityTemplateDto`（新 3 字段）。两者改为 `@JsonInclude(NON_NULL)`
- 新增：`RechargePackageDto / RechargeRequestDto / RechargeResponseDto / BotMetaDto / ChatMessageDto / BotConversationDto`
- `ChatMessageDto` 是 discriminated union 的"宽 record"，所有字段 `@JsonInclude(NON_NULL)`，提供工厂方法（`time / text / userText / cardCta / cardForm / cardGrid`）

**apps/server 服务**

- `CreditService`：新增公开方法
  - `creditAccount(userId, amount, LedgerEntryType, refType, refId, desc)` — "加积分"通用入口，按 type 选桶（RECHARGE/GIFT/LICENSE_GRANT/INCOME/REFUND），写一条不可变 LedgerEntry
  - `getOrCreateWallet(userId)` — 取最新 wallet 实体（recharge 流程用）
- 新增 `RechargeService`：`listPackages()` + `recharge(userId, packageId)`（事务内：主分录 RECHARGE + 可选 GIFT bonus → 返回最新 WalletDto + 主 LedgerEntry）
- 新增 `NotificationService`：`getConversation(botId)` 返回 5 个 Bot（pian/shen/shu/ada/zhang）的 canned 多消息会话，与小程序 mocks 完全对齐
- `CelebrityZoneService`：
  - `listStars(category, sort, owner, userId)` — owner=me 走授权表 join；userId 非空时为每条结果注入 user-specific authorization 覆盖
  - `getStar(id, userId)` — userId 非空时附 user-specific authorization
  - `startGeneration(payload, userId)` — 当 `userId 非空` 且 `creditCost > 0` 时，先调 `creditService.debit(userId, creditCost, "celebrity_generation", ...)` 扣分；不足抛 402；再触发原异步任务

**apps/server 控制器**

- `CelebrityZoneController` 修改：`listStars / getStar / startGeneration` 都加 `Principal` 注入
- `AccountController` 新增 3 个 `/me/wallet/*` 端点：`/credits`（WalletDto 别名）、`/packages`、`/recharge`
- `NotificationController` 新增 `GET /conversations/{botId}` 方法（沿用现有 `/api/notifications` 控制器）

**安全**：`/api/notifications/**` 已落入 `anyRequest().permitAll()`；`/api/me/**` 仍要求 `authenticated()`（含新加的三个 wallet 端点）。

**DataInitializer 种子**

- 3 个明星补全 v0.4 字段（bio / location / fans / cooperationCount / avgGmv / photos[3-6 张] / videos[1-3 条]）
- 5 个模板补全 previewCover / previewVideoUrl / durationSec（15/30/60 三档）
- 新增 3 条 `CelebrityStarAuthorization`：`demo-user × 李诞`（authorized）、`demo-user × 伊能静`（authorized）、`demo-user × 沈腾`（pending）
- 新增 4 条 `RechargePackage`：pkg-300 / pkg-1000 (推荐 + 100 bonus) / pkg-3000 / pkg-10000

**小程序对齐**（消除字段名分叉）

- `utils/mocks.js` `WALLET_CREDITS` 切换为长名（`totalBalance / licenseBalance / rechargeBalance / giftBalance / pendingBalance`），与 web 真源一致
- `utils/mocks.js` `WALLET_PACKAGES` 切 `priceYuan` → `priceCents` + `bonus` (字符串) → `bonusCredits` (数字) + `sortOrder`
- `utils/api.js` `WalletApi.recharge` mock 返回 `{ wallet, ledgerEntry }`（即 `RechargeResponseDto`）
- `pages/me/index.{wxml,js}` / `pages/recharge/index.{wxml,js}` / `pages/generator/index.{wxml,js}` 全部改用长名字段；`pages/recharge` 加 `enrich(pkg)` 派生 `priceYuan / bonusText` 渲染态字段

**契约门**

- `apps/web/scripts/check-api-contract.mjs`：OK（apps/web 调用全部命中 openapi）
- 16 个小程序 apiFetch URL 全部在 openapi.yaml 找到对应 path
- `apps/server`：`mvn compile` BUILD SUCCESS（300 source files）

**已知限制**

- 真实微信支付未接：`POST /me/wallet/recharge` 当前为同步直落账。线上需改为先 `wx.requestPayment` 走支付，回调成功后才调用此接口
- `BotConversation` 当前由 `NotificationService` 硬编码返回；个性化 / 未读 / 推送通道留待下一版
- 旧字段 `CelebrityStar.sampleVideosJson` 与新字段 `videos` 暂时并存（前者标记为陈列态默认）；后续小版本可清理

---

### v0.3.0 · 2026-05-07 — 与 web 版"明星专区"对齐 + 计费/钱包/资料贯通

**新增**

- 明星专区双 Tab：「我的明星 / 全部市场」分离
- 已授权明星卡片直达「✦ 用 TA 生成视频 →」CTA
- 明星详情新增：粉丝/合作/平均GMV/所在地数据快览、明星简介、**资料图集**（3 列网格 + 单图预览）、**形象/代言视频列表**（弹层播放）
- 生成器新增：**模板效果预览**（点缩略图弹层播放 admin 上传的 `previewVideoUrl`）、**模型引擎选择**（KeLing/HiGen/MiniMax 含画质星级 + 单价）、**动态积分消耗计算**（含 15s ×0.7 / 30s ×1.0 / 60s ×1.5 时长系数）、**余额不足拦截**
- 我的页：积分余额 hero + 4 桶分项 + 充值/明细双 CTA + 5 项快捷入口（明星/视频/邀请/销售/反馈）+ 退出登录
- 新增 `pages/recharge`：4 套餐选择 + mock 落账（recharge 桶 + 可选 gift 桶）

**修复 / 完善**

- 全量补完点击位：workbench 流程节点/GMV 卡 / videos 充值/草稿发布/失败重试 / video-detail ↓/⋯/♡/多平台发布/复制并改/渠道格/完整脚本/教练建议 / dashboard KPI/TOP/复盘 / generating 后台运行 / login 协议链 / messages 搜索/AI fab / chat ⋯/+
- 明星详情底部 CTA 三态化（未授权 / 审核中 / 已授权）

**接口（消费）**

- `GET /celebrity/stars?owner=me`
- `GET /celebrity/engine-pricing`
- `GET /me/wallet/credits`、`GET /me/wallet/packages`、`POST /me/wallet/recharge`
- `POST /celebrity/generate` body 加字段：`engineName`、`templateId`、`creditCost`

**类型契约（mocks → 真源）**

- 在 `apps/web/src/types/celebrity-zone.ts` 中新增字段：`CelebrityStarDetail.bio`、`location`、`fans`、`cooperationCount`、`avgGmv`、`photos`、`videos`；`CelebrityTemplate.previewVideoUrl`、`previewCover`、`durationSec`。**待与 web/admin 同步落地**（本期仅小程序 mock）。

### v0.2.0 · 2026-05-07 — 消息从单条卡片改为会话流

- 列表页改为会话预览 + 红点未读数
- 新增 `pages/chat/index` 支持 `text / card-cta / card-form / card-grid / user-text / time` 6 种消息块
- 5 个 Bot 各配多消息会话 mock
- 新增 `GET /notifications/conversations/{botId}` 接口契约

### v0.1.0 · 2026-05-07 — 11 屏首版

- `apps/miniprogram` 工程落地
- 11 屏：登录 / 消息 / 工作台 / 市场 / 明星详情 / 生成器 / 生成过渡 / 视频中心 / 视频详情 / 数据看板 / 我的（占位）
- 自定义 tabBar（中央凸起工作台）
- 接口对照表对齐 `specs/openapi.yaml`，0 新增后端接口

---

## 七、未来变更追加规则（给后续 agent）

1. 任何新需求都**追加版本节**到「版本日志」最上方，不要修改既有节。
2. 如果改动了字段形状：**先改 `apps/web/src/types/celebrity-zone.ts`（真源），再同步 server `*Dto`，再同步小程序 `mocks.js`**。
3. 如果新增/修改接口：同步更新 `specs/openapi.yaml`（与 web 同流程），并在本文「数据模型」与对应模块的"接口"小节标注。
4. 三端同步：web / admin / miniprogram 三端是否需要同步落地，必须在版本节明确说明。
5. 不在小程序实现的能力（运营/审核/财务/BI）必须在「五、运营后台必须支撑的能力」表中声明，避免后续混淆。
