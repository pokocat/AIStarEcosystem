# AI 明星带货 · 产品规格（独立文档）

> 本文档**仅描述 AI 明星带货线**（带货方视角），与 `product_spec.md` 中的"AI 数字人/数字 IP"线**解耦**。
> 三端覆盖：`apps/miniprogram`（带货方）+ `apps/server`（共用后端）+ `apps/admin`（运营/审核）。
> 单一真源：字段形状对齐 `apps/web/src/types/celebrity-zone.ts`。
> 维护规则：每次变更**追加**新版本节，不删除历史；"现状"小节始终反映最新一版的实际行为。
>
> 完整文档地图见 [`docs/INDEX.md`](docs/INDEX.md)。

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

## 六、账户体系（v0.31 稳态）

celebrity 子产品的登录注册、运营授权、SMS 集成完整说明。**两套用户体系完全独立**
但 JWT.role 字符串语义对齐。

### 6.1 两套用户体系对照

| 维度 | admin 后台 | celebrity / 用户子产品 |
|---|---|---|
| 用户表 | `admin_users` | `aep_users` |
| 接入前端 | apps/admin | apps/web-celebrity（及历史 apps/web） |
| 登录端点 | `POST /api/admin/auth/login`（用户名 + 密码） | SMS（手机号 + 验证码）/ License 激活 / dev-login |
| 角色字段 | `AdminUser.role` enum | `AepUser.kind` + `AepUser.operatorRole` |
| JWT.role claim | `admin.role.name()` | `operatorRole.name()` 非空时优先，否则 `STUDIO`/`USER` |
| 是否可改对方表 | ❌ 不能 | ❌ 不能 |
| 是否可调对方端点 | role=OPERATOR/SUPER_ADMIN 时可调 `/api/admin/**`（包括看 celebrity 数据） | role=OPERATOR/SUPER_ADMIN 时也可调 `/api/admin/**`（同上） |

两套表互不引用，但 JWT.role 字符串命名故意对齐（OPERATOR / SUPER_ADMIN）→ 同一
role claim 走相同的 server 端 hasAnyRole 门禁。

### 6.2 注册流程（手机号 + License 双因素）

prod 环境的唯一注册路径：

```
1. 用户拿到 License 激活码（admin 通过 POST /api/admin/license-batches/{id}/mint-keys
   ?count=N 生成；接口一次性返回 raw codes 供分发，DB 只存 sha256）
2. 用户进 web-celebrity /login → 「注册」tab
3. 输手机号 → 点「发送验证码」（60s 倒计时）
4. 收码（aliyun driver 走真短信；log driver 在 server log）
5. 输验证码 + 激活码 + 工作室名（必填）+ 显示名（选填）
6. 提交 → server 校验 SMS code + 校验 License key → 创建 AepUser + Studio + Wallet +
   发 JWT → 跳 /dashboard
```

落库的 user 形态：
- `username` = `phone_<手机号>`（自动生成，不可自选）
- `kind` = STUDIO
- `phone` / `phoneVerified=true`
- `operatorRole` = null（默认普通用户）

注册端点：`POST /api/auth/sms/register { phone, code, licenseKey, studioName, displayName? }`

### 6.3 登录流程

**主流程：手机号 + SMS 验证码**

```
POST /api/auth/sms/request-code { phone, purpose: "login" }  → 200 { sent: true }
POST /api/auth/sms/verify { phone, code }  → 200 { token, user } 或 404 USER_NOT_FOUND
POST /api/auth/sms/request-code { phone, purpose: "register" }  → 注册验证码
```

- `404 USER_NOT_FOUND`：手机号未注册。验证码**已被消费**（防爆破），用户切到注册
  tab 需要重新发码。
- 错码：`400 SMS_CODE_INVALID` + 剩余次数。错 5 次 → 锁 30 分钟。
- 速率限制：同 phone 60s 内不能重发（`429 SMS_CODE_RATE_LIMITED`）

**辅助流程：dev-login（仅 dev profile）**

```
POST /api/auth/dev-login { username }  → 200 { token, user }
```

无需密码 / 验证码，用 username 直接签 JWT。生产环境通过
`@ConditionalOnProperty aep.dev-auth.enabled=false` 关闭。

**辅助流程：License 激活直登（保留以兼容老前端）**

```
POST /api/auth/activate { code, username, email?, phone?, studioName }  → 200 { token, ... }
```

不验 SMS，仅 License + 用户信息直接落库。前端老路径 `/activate` 仍走这个；
新前端走 `/login → 注册` tab（SMS 双因素更安全）。

### 6.4 运营角色（operatorRole）

普通用户 `operatorRole=null`，登 celebrity 看商品库只读、看其他模块全权。

**升级为运营**：admin 在 `/admin/celebrity/operators` 页面，点用户行的「运营」/
「超管」/「移除」按钮。底层 endpoint：

```
PATCH /api/admin/aep-users/{id}/operator-role { operatorRole: "operator" | "super_admin" | null }
```

升级后：

| 影响 | 描述 |
|---|---|
| **下次登录** | 新签的 JWT.role 用 operatorRole，能通过 `/api/admin/**` hasAnyRole 门禁 |
| **web-celebrity UI** | `useAuth().user.operatorRole` 非空 → 商品库等模块自动渲染写按钮（「新建」/「编辑」/「删除」/「抖音建档」/「刷新图片」/「AI 卖点」） |
| **admin 后台** | 这个用户**没有** admin 后台访问权（admin_users 表里没有他的记录） |
| **旧 JWT** | 不会主动 invalidate；旧 JWT 里 role 仍是 STUDIO，要等 JWT 过期（1h）或重新登录才生效。当前是「告知用户重登」 |

**升级粒度**：operatorRole 是**全局角色**，不分租户。一个 operator 能管所有公共
商品池条目，不能限定「只能管 X 租户的货」。`Tenant` / `Membership` 表只做 License
核销归属统计，不做运行时权限切片。

### 6.5 SMS 集成（driver 矩阵）

| Driver | 配置 | 行为 | 用途 |
|---|---|---|---|
| **log**（默认） | `aep.sms.driver=log` | 验证码打到 server log `[sms-log] purpose=xxx phone=xxx code=xxxxxx` | dev / 联调 / 阿里云未备案时占位 |
| **aliyun** | `aep.sms.driver=aliyun` + `ALIYUN_SMS_*` env | 调阿里云 SMS 官方 SDK；登录模板 `SMS_507065062`，注册模板独立配置；模板变量固定只有 `code` | prod 真发短信 |

**dev-fixed 测试码**（联调小技巧）：

```bash
export AEP_SMS_DEV_FIXED_CODE=123456
```

启动 server 后所有手机号收到的码都固定为 123456，省去每次 grep server log。
**严格双门禁**：必须 `driver=log` + 非空才生效；driver=aliyun 时即使配了也会被
忽略并 WARN（防 prod 误开）；启动 banner 会 WARN「DEV-FIXED CODE ENABLED」。

**速率与锁定（默认）**：
- 验证码长度 6 位、TTL 5 分钟
- 同手机号 60s 内不能重发
- 错 5 次锁 30 分钟
- 验证成功后 entry **立即删除**（防重放）
- @Scheduled 60s 清理过期 entry
- in-memory ConcurrentHashMap 存储；多实例 prod 部署前必须换 Redis

### 6.6 dev seed 账号

| 账号 | 表 | 登录方式 | JWT.role |
|---|---|---|---|
| `admin` / `admin123` | admin_users | `/api/admin/auth/login` | SUPER_ADMIN |
| `operator` / `operator123` | admin_users | `/api/admin/auth/login` | OPERATOR |
| `celebrity_operator` | aep_users | dev-login 免密 | **OPERATOR** |
| `creator_luna` | aep_users | dev-login | STUDIO |
| `studio_starlight` | aep_users | dev-login | STUDIO |
| `agency_moonrise` | aep_users | dev-login | STUDIO |

[`DataInitializer.ensureCelebrityOperatorSeed`](apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java)
按 username 幂等，**老 H2 文件落库环境**第一次启动 v0.31 代码会自动补
`celebrity_operator` 这条记录。

prod 启动时 DataInitializer 不跑，真实账号通过 SMS register 流程创建。

### 6.7 数据隔离矩阵

**用户私有数据**（按 user.id 严格隔离；不按 tenant）：
- 钱包 / LedgerEntry / 个人混剪任务 / 发布任务 / 社交账号 / DigitalIp /
  messages-overview / 私有 MixcutAsset

**公共数据**（全平台共享）：
- 商品库 (Product) / 公共模板 / 官方明星片段 (MixcutAsset.isOfficial=true) /
  preset 贴图 (MixcutAsset.isPreset=true) / 字典 / 充值套餐

**operatorRole 角色门**控制的是「谁能改公共数据」，不是「谁能看公共数据」。
普通用户读 `/api/products` 等公共接口仍 200。

---

## 七、版本日志（按时间倒序追加，**不删除历史**）

### v0.41 · 2026-05-29 — 素材运营带货视频生成接真后端（异步 submit + 轮询）

把素材运营「派生视频」从纯前端 mock 改成真实视频大模型生成 + 服务端轮询；配套修脚本预览关联商品错配、简化基线生成入口。仅 celebrity 线 + server，三端中仅 web-celebrity / admin / server 改动（小程序不涉及）。

**新增 server 实体 / 端点**：

- `MaterialVideoJob`（`material_video_job` 表）：一条「生成 / 派生」视频 = 一个任务，生命周期 `queued→submitting→generating→succeeded|failed`，存 prompt / variantConfig / payload（MaterialVideo 形状）/ externalTaskId / videoUrl / creditsHeld。
- `POST /api/material/videos/generate`（提交一批任务，body `{items:[...]}`）；`GET /api/material/videos/jobs[/{id}]`（列表 / 单任务轮询）。
- 视频大模型通过 `MaterialVideoModelClient` 调用：provider 取自后台「AI 模型」配置（用途 `VIDEO_GENERATION`），submit/poll 协议走 `aep.material.video.*`（默认对齐 智谱 CogVideoX 异步约定）。**未配 token → `VIDEO_NOT_CONFIGURED` 503，明确报错不静默兜底**（对齐 v0.40 文本三件）。

**计费**：单价走 `CelebrityActionPricingService` action `material.video-generate`（默认 30/条，admin 可配）；`CreditService` hold→commit/release 三段式（不可变账本约束），失败 / 超时自动退款。

**前端（web-celebrity）**：脚本预览关联商品按 `product_id` 查全量商品库（修 `MATERIAL_PRODUCTS[0]` 错配）；基线生成直给（6 轴 + 18 项参数移到派生）；派生面板进入不自动跑 AI（按钮触发 + 重新识别），「生成 N 条」真实提交 + 轮询 + 出片内嵌播放 + 重新生成。

> **配置**：上线前在 管理后台 → 平台与配置 → AI 模型 加一个勾选「视频生成」用途的服务商（真 baseUrl + apiKey + 真实模型 id）。换厂商一般只改 baseUrl + `aep.material.video` 的 submit/poll 子路径。详见 [`AGENTS.md`](AGENTS.md) §v0.41。

### v0.31 · 2026-05-24 — celebrity 账户体系收口（商品库 + 内嵌运营 + SMS 登录）

一次性补齐 celebrity 子产品的「数据隔离 + 登录注册 + 运营管理」三件事。完整产品
规格已沉淀到 [§六、账户体系](#六账户体系v031-稳态)（**稳态文档**），本节仅记录变更要点。

**四块改动**：

1. **商品库公共池化**：`/api/products/**` 写动作全部收归 `/api/admin/products/**`
   （hasAnyRole(SUPER_ADMIN, OPERATOR) 门禁）；普通用户只读 + 预览。
   修复匿名 CRUD 漏洞 + Product 表无 ownerUserId 导致的越权风险。
2. **内嵌运营角色**：`AepUser.operatorRole` 字段（独立于 AdminUser）；JWT 在
   operatorRole 非空时优先用它作 role claim → 通过 hasAnyRole 门禁。
3. **admin 操作员管理页** `/admin/celebrity/operators`：list aep_users + 切角色
   按钮（运营 / 超管 / 移除）。配套端点 `GET/PATCH /api/admin/aep-users/...`。
4. **手机号 + SMS 登录 / 注册**：log（默认）/ aliyun（阿里云官方 SDK）双 driver；
   双因素注册（SMS 验证码 + License 激活码）；dev 联调可设
   `AEP_SMS_DEV_FIXED_CODE` 固定测试码（严格双门禁防 prod 误开）。

**配套**：
- 新 admin 端点 `POST /api/admin/license-batches/{id}/mint-keys?count=N` 一次性铸 N
  把 key 并返回 raw codes（write-once；DB 只存 sha256）
- web-celebrity `/login` 重写为三 tab：手机号登录 / 注册 / dev
- `packages/api-client` 新增 SmsAuth API；`packages/types` AepUser +operatorRole
- 详细改动清单 / 文件级 diff 见 [`AGENTS.md`](AGENTS.md) §v0.31

**行为变化**（用户可见）：
- 生成视频时随手填的商品名不再自动沉淀公共池；新商品必须运营显式创建
- prod 注册需要「手机号 + 短信验证码 + License 激活码」三件齐全
- 升级 operatorRole 后旧 JWT 不会立即生效，用户需重登或等 JWT 自然过期

### v0.17.0 · 2026-05-20 — 社交账号绑定 profile 落库

**Context**：分发中心开始承载多平台账号绑定后，仅靠用户自填 `accountName` 不足以区分多个同平台账号。本期把扫码登录后创作者中心页面可见的清洁 profile 信息落库，提升账号辨识度，不暴露 cookie / storage_state。

**新增字段**

| 字段 | 位置 | 说明 |
|---|---|---|
| `SocialAccount.displayName` | 已有字段，继续使用 | 平台侧昵称；抓不到时为空 |
| `SocialAccount.platformAccountId` | 新增 | 平台侧账号号 / handle，例如抖音号；抓不到时为空 |
| `SocialAccount.avatarUrl` | 已有字段，继续使用 | 平台侧头像 URL；抓不到时为空 |

**链路**

1. `sau-service` 各平台 `PlatformDriver.extract_profile()` 在扫码成功或 verify 成功后 best-effort 抓页面信息。
2. `/login/poll` / `/accounts/verify` 返回 `profile={displayName, platformAccountId, avatarUrl}`。
3. `apps/server` 加密 `storageStatePlain` 后，仅把上述清洁字段落到 `aep_social_accounts`。
4. `web-celebrity` 账号管理 / 发布选账号 UI 展示昵称、平台账号号、头像；`admin` 社交账号审计页展示 `platformAccountId`。

**平台差异**

- 抖音：从创作者中心 header 解析昵称、`抖音号：...`、头像；DOM class 失效时用 body 文本兜底解析。
- 视频号 / 小红书 / 快手：后续按各自创作者中心 DOM 在对应 driver 内补选择器，仍统一写入 `platformAccountId`。
- profile 是增强信息，不参与鉴权和发布；字段为空不影响绑定成功。

### v0.5.3 · 2026-05-09 — 小程序近实时主动同步：多层轮询 + 业务关键点立即触发

**Context**：v0.5.2 把 Bot 消息改成 server 按需合成，但只有用户**主动打开**页面才会刷新 — 红点不会自己变化。本期补齐"主动同步"机制，让用户在工作台/市场/视频中心等任何 tab 都能近实时看到新消息提示。

**多层轮询（解决"30s 太久"问题）**

| 层级 | 间隔 | 时机 | 目的 |
|---|---|---|---|
| App 全局后台 | **15s** | 前台时持续，`onHide` 自动停 | tabBar 红点全局更新 |
| 消息页活跃 | **5s** | `pages/messages` `onShow` ~ `onHide` | 列表实时刷 + dot 紧跟 |
| Chat 页活跃 | **5s** | `pages/chat` `onShow` ~ `onHide` | 会话内容实时反映新业务 |
| 业务关键点 | **0s（立即）** | 提交生成 / 充值成功 / 视频发布等 | 用户操作完毕立刻看到红点变化 |

**架构**

```
App (app.js)
  ├─ globalData.unread { total, byBot, todos, conversations }
  ├─ _pollTimer    (15s setInterval)
  ├─ _unreadSubs[] (page 级订阅者)
  ├─ pollUnread()           ← 拉一次
  ├─ triggerUnreadRefresh() ← 业务关键点立即调
  ├─ subscribeUnread(cb)    ← 返回 unsubscribe
  └─ _propagateTabBar(total)← 推到所有 page 的 custom tabBar

custom-tab-bar
  ├─ data.unreadTotal        ← 由 app._propagateTabBar 通过 setData 推
  └─ 在消息 tab 上渲染红点 / 数字（max "99+"）

pages/messages
  ├─ onShow: subscribeUnread + 5s 子轮询
  └─ onHide: unsubscribe + 清子轮询

pages/chat
  ├─ onShow: 5s 子轮询拉自己的 conversation
  └─ onHide: 清子轮询；fetch 时做 tail diff 避免无变化 setData
```

**业务关键点 trigger（已接两处）**

- `pages/generator.startGenerate` 提交成功后调 `app.triggerUnreadRefresh()` — 生成视频立即让片片 dot 反映
- `pages/recharge.submit` 充值落账后调 — 数数 Bot 的钱包卡立即更新

**为什么是轮询而不是 WebSocket / wx.subscribeMessage？**

- 当前用户在线时，15s + 5s + 关键点 0s 已经"近实时"（max 5s 延迟）
- WebSocket 需要 server 起 `/ws` 通道、按 userId hold session、心跳重连 — 复杂度上升明显
- wx.subscribeMessage 是模板消息（用户授权一次后服务端推一次），适合"离线提醒"而非"应用内 UI 同步"
- v0.6+ 真实需要时（< 1s 双向 / 离线推送）再上 WebSocket，已在 `app.js` 末尾留完整实施 TODO

**关键平台坑（已加注释）**

- App 顶层 `require("./utils/api.js")` 会触发循环依赖（mocks → api → app → mocks）；用延迟 require 在 `pollUnread` 内拿
- 自定义 tabBar `attached` 早于 page；初始化时从 `globalData.unread` 取一次快照避免空白闪烁
- `setInterval` 必须在 `onHide` / `onUnload` 清掉，否则后台 `setData` 报警 + 内存泄漏

**门**

- 18 个 miniprogram JS 文件 `node --check` 全通过
- server 无变更（v0.5.2 的 messagesOverview 拉模式已就位）
- 客户端契约不变；`triggerUnreadRefresh` 只是 app 内方法，不暴露 API

**WebSocket 升级路径（v0.6+，TODO 已在 app.js 末尾完整记录）**

1. server: `spring-boot-starter-websocket`，按 userId hold session 表
2. server: 业务事件触发器 → `findByUserId(uid).send({type, payload})`
3. miniprogram: `app.onLaunch` 调 `wx.connectSocket({ url: wss://.../ws?token=... })`，
   `onMessage` 时合并到 `globalData.unread` 并 `_notifyUnreadSubs / _propagateTabBar`；
   `onClose / onError` 时回退到 polling（互为兜底）
4. 心跳：30s ping，60s 没收到 pong 视为断开重连

---

### v0.5.2 · 2026-05-09 — Bot 消息按需查询代替事件总线（拉模式）

**Context**：v0.5.1 把消息首页和已读机制接通了，但 Bot 多消息会话仍是 `NotificationService` 里 5 段写死的 canned 内容；当时把它推后是因为以为需要"事件总线 + 推送通道"。本期换思路：**Bot 消息根本不需要推送，每次打开聊天/消息首页时由 server 即时查询用户的真实业务实体（CelebrityProjectVideo / CelebrityStarAuthorization / CelebrityStar / Wallet）合成消息流即可**。这是"拉模式"代替"推模式"，零事件总线、零消息队列、零推送通道。

**架构变化**

```
之前（推模式 / event-bus 思路）：
  业务事件 → 创建 Notification 行 → 推送通道 → 客户端
  缺点：要建事件总线、要管推送通道、要管 Notification 持久化与去重

现在（拉模式 / on-demand synthesis）：
  客户端打开 chat → server 查 user 业务态 → 合成 ChatMessageDto[] → 返回
  优点：零基础设施；消息内容永远反映"当前真实状态"；用户回到首页也是当下数据
```

**主要落地**

1. **新建 `UserBotReadState` 实体**（per-user-per-bot lastReadAt 时间戳）+ Repo
   - 复合主键 `{userId}|{botId}`
   - 唯一字段 `lastReadAt`
   - `markBotConversationRead` 更新它
2. **`NotificationService` 完全重写**：
   - 新增 5 个 composer 方法（每个 Bot 一个），各自查询自己关心的业务实体并合成 `BotConversationDto`：
     - **片片（创作官）**：查 `userVideos(userId)` → 按 status 分类 → 生成「最新已发布卡片」+「视频任务概览」
     - **审审（合规官）**：查 `authRepo.findByUserId(userId)` → PENDING 的逐条生成 cardForm + 审核中提示
     - **数数（数据官）**：查 `userVideos` 总数/已发布/累计曝光 + `walletRepo.findByUserId` 余额 → cardGrid
     - **Ada（星探官）**：查 `starRepo.findAll` 减去用户已授权的 → 推荐"明星上新"
     - **长长（成长教练）**：查 `userVideos` + `auths` → 派生本周 3-4 条建议
   - `getConversation(botId, userId)` 按 botId 分发到 composer
   - `getMessagesOverview(userId)` 用同套 composer 合成预览，dot 由 `computeUnreadDot` 计算
   - 移除原硬编码 5 段 canned 方法
3. **Dot（未读数）改由 freshness 比较**：
   - `lastReadAt` 取自 `UserBotReadState`；不存在视为 epoch
   - 各 Bot 各定义自己的 freshness 标准：
     - 片片：用户视频 createdAt > lastReadAt 的条数
     - 审审：PENDING 授权 updatedAt > lastReadAt 的条数
     - 数数：≥24h 没看视为有新日报（dot=1）
     - Ada：还有未授权明星 + 已 ≥1h 没看（dot=1）
     - 长长：≥7d 没看视为有新复盘（dot=1）
   - `markBotConversationRead` 把 lastReadAt = now，下次打开 dot=0
4. **`Notification.botId` 列保留**（与 v0.5.1 backward compat），但**不再驱动 Bot 消息**；可作其他模块的扩展点
5. **DataInitializer 不再 seed botId Notification**（previously: 8 条）；演示数据现在完全由用户的真实业务态决定（5 个明星 / 3 个授权关系 / 8 商品 / 3 项目 / 3 视频 在 v0.4/v0.5 已 seed）

**好处**

- **消息内容永远是真的**：用户刚发布完一条视频，再打开片片就能看到；admin 改了授权状态，再打开审审就能看到 — 无需任何推送
- **零基础设施**：不需要 Kafka / RabbitMQ / WebSocket / wx subscribeMessage
- **代码简洁**：`NotificationService` 每个 composer 都是几行 stream/filter，全是 read query，没有写
- **可独立测试**：composer 都是纯函数，给定 userId 即得 BotConversationDto

**契约**

- 路径不变（`GET /notifications/conversations/{botId}`、`GET /me/messages-overview`、`POST /notifications/conversations/{botId}/read-all`）；shape 也不变 — 客户端无需改动
- `getConversation` 现在接 Principal（之前不接），匿名调用回退到 demo-user

**门**

- `mvn compile`: BUILD SUCCESS
- 所有客户端接口 shape 不变，小程序无需改一行

**何时再加事件总线**

- 真正需要"实时推送给离线用户"（如 wx subscribeMessage 模板消息提醒）
- 真正需要"跨 server 多实例 fan-out"
- 这两种场景在 v0.6+ 出现时再加，现在不需要

---

### v0.5.1 · 2026-05-09 — 消除小程序硬编码 + 通知系统真正接通 server

**Context**：v0.5 把 11 屏 API 都映射到了 server，但内部仍有 5 处页面写死的数据（durations / languages / CATS / keypoints / star.subtitle 占位）和 4 处通知逻辑没真接（待办由 mock；Bot 预览/红点是假的；已读不上报；生成进度纯客户端 setInterval）。本期把这些全部接通：**开发模式走 mock，生产模式走 server，没有硬编码**。

**主要落地**

1. **新增 4 个 server 端点**
   - `GET /celebrity/dictionaries` — UI 字典（durations/languages/categories/keypointSuggestions）
   - `GET /celebrity/jobs/{jobId}` — 视频生成异步任务真实进度（server 维护 in-memory 任务表 `{startedAt, totalSec}` 计算），替代客户端 setInterval 假动画
   - `GET /me/messages-overview` — 消息首页聚合 `{ todos[], conversations[] }`：todos 由 server 按当前用户业务态聚合（待审视频/授权进度/数据日报）；conversations 是 5 个 Bot 的预览 + 实时未读 dot
   - `POST /notifications/conversations/{botId}/read-all` — 进入 chat 立即标该 Bot 全部 Notification 为已读，首页红点清零

2. **数据模型扩展**
   - `Notification` 加 `botId` 列；Repo 加 `findByUserIdAndBotIdOrderByCreatedAtDesc` + `countByUserIdAndBotIdAndReadFalse`
   - `CelebrityZoneService` 新增 `JOBS` ConcurrentHashMap + `getJobProgress(jobId)` + `getDictionaries()`，`startGeneration` 现在登记任务到 JOBS
   - `NotificationService` 新增 `getMessagesOverview(userId)` + `markBotConversationRead(userId, botId)`

3. **DataInitializer**：给 `demo-user` seed 8 条 botId Notification（片片 3 / 审审 1 / 数数 2 / Ada 0 / 长长 0 未读）

4. **小程序去硬编码 + 切 server**
   - `pages/generator`：`durations / languages / keypoints` 全部从 `getDictionaries()`；`star.subtitle/product` 占位删除，由 `getStar(starId)` 真实填充
   - `pages/generating`：`setInterval` 假动画 → 每 1.2s 轮询 `getJobProgress(jobId)`
   - `pages/market`：`CATS` 从 dictionaries 拉
   - `pages/messages`：旧 `list()` shape → 新 `messagesOverview()` shape（含真实 dot）
   - `pages/chat`：onLoad 立即调 `markBotRead(botId)` 清红点

5. **mocks.js**：新增 `CELEBRITY_DICTIONARIES / MESSAGES_OVERVIEW / buildJobProgress`；开发态不依赖 server

**架构契约**
- 所有新 path 写入 `specs/openapi.yaml`；`check:api-contract` 全绿
- `mvn compile` BUILD SUCCESS；18 个 miniprogram JS `node --check` 全通过

**已知限制**
- Bot 消息仍由 NotificationService 硬编码 5 段 canned；真事件触发推送留 v0.6
- engine-pricing 仍 in-memory；v0.6 落 PlatformConfig
- todos "数据日报" count 暂回退常量 1（接 dashboard 后改真实统计）
- JOBS 是 in-memory，重启丢；v0.6 落 generation_jobs 表

**新接口**
```
GET  /celebrity/dictionaries
GET  /celebrity/jobs/{jobId}
GET  /me/messages-overview
POST /notifications/conversations/{botId}/read-all
```

---

### v0.5.0 · 2026-05-08 — admin 重构对齐三端 + §3.2.7 模板脚本 + §D8 大模型配置

**Context**：v0.4 已把 server 端用户侧接口全打通；本期把 admin 后台重构为"AI 明星带货线
为主、其他产品线 sidebar 隐藏"的形态，并把 §3.2.7 TemplateScript 模板脚本系统纳入本期
落地（之前规划在 v0.6+），新增 §D8 `AiModelProvider` 大模型配置允许接入 OpenAI 兼容 API。

**主要落地**

1. **角色命名对齐**：admin TS `AdminRole` 改为 `SUPER_ADMIN | OPERATOR`（与 server enum 一致）
2. **Celebrity admin CRUD**（11 个新写接口）：明星 / 模板 / photos / videos / 引擎价格
3. **CelebrityStarAuthorization** 完整 CRUD + 状态机 `POST .../transition`
4. **RechargePackage** admin CRUD（软删 active=false）
5. **§3.2.7 TemplateScript 系统** 全栈落地：
   - 真源类型 12 个（Scene / TemplateVariable / EngineAdapter / TemplateReferenceClip 等）
   - server `TemplateScript` 实体 + Repository + 6 个 DTO + `PromptAssemblyService`
     （变量替换 + 引擎 adapter + 风控 + video_ref URL 透传）+ `TemplateScriptAdminService`
   - 控制器：`TemplateScriptController`（用户端只读 published）+ `AdminTemplateScriptController`
     （CRUD + saveDraft / submitReview / publish / rollback / dryRun / draftWithAi / uploadClip）
   - 状态机：`DRAFT → IN_REVIEW → PUBLISHED → ARCHIVED`，同 templateId 仅一条 PUBLISHED
   - 双模 `text` / `video_ref`：v0.5 video_ref 自动检测降级为运营手填 + URL 透传，
     转码 / 抽帧 / NSFW / BGM 检测留给 v0.6
   - DataInitializer 给 5 个模板各 seed 1 份 PUBLISHED TemplateScript（4 text + 1 video_ref）
6. **§D8 AiModelProvider — 大模型配置**（用户新增）：
   > **v0.41 起已演进**：`AiModelProvider`（一对多模型/用途 + priority 兜底）改为 `AiModelEndpoint`（固定 {上游密钥 + 单模型 + 地址}，自带网关 Key），用途经独立的 `ai_app_binding`（一用途一端点、无兜底）路由；并合并了旧「LLM 网关 Key」。详见 `apps/server/README.md` v0.41 与 `AGENTS.md` §7 v0.41。
   - 实体 `AiModelProvider`（apiKey 用 AES-GCM 加密落库，密钥从 `AEP_SECRET_KEY`）
   - `AiModelInvocationService` 实现 OPENAI / OPENAI_COMPATIBLE 的 `/chat/completions`，
     其他 providerType（Anthropic / Azure / 月之暗面 / 国产）保留 enum + CRUD 但 invokeChat 抛 501
   - 通用工具：`AepCryptoUtil`（AES-GCM 对称加密 + apiKey mask）
   - 5 个 admin 端点：`GET/POST /admin/ai-models`、`GET/PUT/DELETE /admin/ai-models/{id}`、
     `POST /admin/ai-models/{id}/test`（调 provider `/v1/models` 探活）
   - 用途分类：`SCRIPT_DRAFT / SAFETY_REVIEW / VIDEO_REF_ANALYSIS / TEMPLATE_REWRITE / GENERAL`
   - DataInitializer seed 1 个禁用态 dev placeholder
7. **openapi.yaml** 新增约 30 个 path；`npm run check:api-contract` 全绿
8. **admin 前端**：
   - 5 个新 API 模块（celebrity-authorizations / recharge-packages / template-scripts / ai-models）
   - 5 个新页面（star-authorizations / engine-pricing / template-scripts / recharge-packages / ai-models）
   - sidebar 重组：明星带货线提到顶部；数字人产品线（music / film / nft / forge / community 等）
     整组 `enabled: false` 隐藏（源码保留）；新增 `visibleNavGroups()` 过滤函数

**已知限制**

- engine-pricing 写入 in-memory `Map`，重启失效（v0.6 落 PlatformConfig）
- video_ref 模式不做服务端转码 / 抽帧 / NSFW；运营手填 URL + reviewStatus=approved
- A/B 桶 / 多人审批 / 双人复核 留待 v0.6
- 国产模型（百度 / 阿里 / 腾讯）admin 可 CRUD 但 invokeChat 抛 501
- admin 模板脚本编辑器是简化版（列表 + 状态推进 + 试跑）；完整结构化编辑器留给 v0.6
- admin 媒体表单仅接受 URL，无 OSS multipart 上传

**新接口（消费侧 / admin）**

```
# admin（v0.5 新增）
POST/PUT/DELETE /admin/celebrity/stars[/{id}]
POST /admin/celebrity/stars/{id}/photos | DELETE .../photos/{photoId}
POST /admin/celebrity/stars/{id}/videos | DELETE .../videos/{videoId}
POST/PUT/DELETE /admin/celebrity/templates[/{id}]
PUT /admin/celebrity/templates/{id}/preview
PUT /admin/celebrity/engine-pricing
GET/POST/PUT/DELETE /admin/celebrity/star-authorizations[/{id}]
POST /admin/celebrity/star-authorizations/{id}/transition
GET/POST/PUT/DELETE /admin/finance/recharge-packages[/{id}]
GET/POST /admin/template-scripts ; GET/PUT /admin/template-scripts/{id}
POST /admin/template-scripts/{id}/{submit-review|publish|rollback|dry-run|draft-with-ai|upload-clip}
GET/POST /admin/ai-models ; GET/PUT/DELETE /admin/ai-models/{id} ; POST /admin/ai-models/{id}/test

# 用户端
GET /template-scripts/by-template/{templateId}（仅 published）
GET /template-scripts/{id}（仅 published）
```

**门**

- `mvn compile`: BUILD SUCCESS
- `npm run check:api-contract`: OK
- admin / web tsc：本沙箱无 node_modules 跳过；类型扩展为可选，不破坏现有调用方

---

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

- `scripts/check-api-contract.mjs`：OK（四个活跃子应用 + api-client 调用全部命中 openapi；v0.57 起不扫 apps/web）
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

## 八、未来变更追加规则（给后续 agent）

1. 任何新需求都**追加版本节**到「版本日志」最上方，不要修改既有节。
2. 如果改动了字段形状：**先改 `apps/web/src/types/celebrity-zone.ts`（真源），再同步 server `*Dto`，再同步小程序 `mocks.js`**。
3. 如果新增/修改接口：同步更新 `specs/openapi.yaml`（与 web 同流程），并在本文「数据模型」与对应模块的"接口"小节标注。
4. 三端同步：web / admin / miniprogram 三端是否需要同步落地，必须在版本节明确说明。
5. 不在小程序实现的能力（运营/审核/财务/BI）必须在「五、运营后台必须支撑的能力」表中声明，避免后续混淆。
