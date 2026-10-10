# AI Star Eco — 业务规则与计算公式

> **本文件的角色**：openapi.yaml 描述「数据形状 + 接口形态」，本文件描述「openapi 表达不了的业务约束」——
> 字段校验规则、跨字段计算公式、用户操作时序、错误码规范、状态机映射。
>
> **不再重复定义实体或枚举**：所有数据模型以 `packages/types/src/*.ts` 为前端真值源（遗留 `apps/web` 已于 v0.109/2026-08-03 删除）、`specs/openapi.yaml` 为
> 接口契约。本文件只补充 schema 表达不了的约束与业务语义。
>
> **历史**：本文件由 v1.1.0 的 `BACKEND_API_SPEC.md`（1970 行）瘦身而来；原文档中的枚举总表（§1）、
> 数据模型（§2）、接口清单（§3）已迁移到 openapi.yaml + TS types，故此处不再保留。

**文档版本**: v2.0.0  
**对应代码版本**: v2.7.x  
**最后更新**: 2026-09-05

### `clip` 军师快出片补充规则（v0.111）

- service token 只认证调用系统，所有用户数据仍必须按 `X-External-Owner-Id` 隔离；缺任一头拒绝。
- 本人授权端点必须上传真实授权视频和服务端给定口令；只保存授权文本哈希与石榴 `authId`，不得用前端布尔值伪造通过。
- 声音训练成功后才能发起形象训练；未同时取得 ready 的 `speakerId` 与 `avatarId` 时，报价/预检/出片必须失败关闭。
- 石榴返回的视频 URL 有时效性，任务成功前必须转存我方持久存储；转存只接受公网 HTTPS、限制 512MB，并拒绝本地/私网地址。
- Scheme A 下 AIStar 不扣军师积分；军师 BFF 是 hold/settle/refund 唯一账本。媒体机器审核未配置或真实发布未接时不得降级为成功。
- 最终音轨必须先测量、再用 `measured_*` 做第二遍 -16 LUFS / -2.5 dBTP 归一；-2.5 是 AAC 编码前的安全目标，编码后的真实文件仍须满足真峰值 ≤ -1 dBTP。不得通过放宽质量门规避编码峰值回弹。
- **配音预览（v0.150，`POST|GET /me/clip/projects/{id}/tts-preview`）**：一个项目最多一份预览。
  `timelineHash = sha256(voiceId + 每镜 no/role/文案)`；POST 幂等（哈希相同且上次不是 failed → 原样返回，不重复调供应商，failed 允许重排一次），
  GET 只认当前这版文案的结果，旧一版一律 404 `CLIP_TTS_PREVIEW_NOT_FOUND`。
  合成粒度是 `ClipShotPlan.materialize` 的**镜头**，与出片 tts 阶段同一套切分 —— 预览听到的必须就是成片会用的那条音频，否则时间轴对不上。
  音频先镜像我方存储再出**短期签名 URL**，库里只存 key。**没有可用音色 / 引擎未配置 / 供应商失败 / 拿不到可镜像的音频 → `status:"failed"` + 明确 `errorCode`**，
  不许返回空 URL 或静音占位冒充成功（静音 WAV 只在 `AEP_CLIP_FORCE_MOCK` 的确定性测试媒体下产生）。
  **`credits` 恒为 0**：Scheme A 下 clip 域不碰钻石账本，试听只花供应商 `validPoint`；字段显式返回，非 0 才表示调用方需要先 hold。
- **段级出片状态（v0.150，`GET /me/clip/jobs/{id}` 的 `segments`）**：`status ∈ queued|generating|done|failed`，
  **只读投影**，真值仍是 `clip_render_job.segmentJobsJson`，不新增真值来源。做完与否看有没有留下产物（avatar 段看 `videoCdnKey`、broll 段看 `audioCdnKey`），
  结尾固定段不需要生成恒为 done。失败必须落到**具体哪一段**（第一段没产物的那一段）并带 `errorCode`，不许只给一句笼统的整体失败。
  worker 还没写过状态时 `segments` 为空数组，调用方回落整体进度。
- **`script/ai-rewrite` 的 `scope:"all"`**：`text` 是「改写/生成指令」（一句话 brief，≤ 500 字），按模板骨架逐段生成全篇，
  **不改段数、不改 role、不动结尾固定段**；`text` 留空退回「在现有文案上润色」。当前只有确定性引擎，
  真模型未接入时非 mock 网关一律 503 `CLIP_SCRIPT_ENGINE_NOT_CONFIGURED`，不拿模板句冒充生成结果。

---

## 目录

1. [字段约束与校验规则](#1-字段约束与校验规则)
2. [业务计算规则](#2-业务计算规则)
3. [通用响应格式](#3-通用响应格式)
4. [错误码列表](#4-错误码列表)
5. [前端状态机与接口时序](#5-前端状态机与接口时序)
6. [新领域的业务约束（v2.x）](#6-新领域的业务约束-v2x)
   - 6.0 [子产品开通 enrollment（v0.149）](#60-子产品开通-enrollmentv0149--packagestypessrcaccountts--真源-docsunified-identity-planmd-122)

---

## 1. 字段约束与校验规则

> 来源：前端表单输入、range 滑块、业务逻辑代码。openapi.yaml 仅描述类型，本表补充值域 / 跨字段约束。

| 模型 | 字段 | 类型 | 最小值 | 最大值 | 必填 | 默认值 | 特殊规则 |
|------|------|------|--------|--------|------|--------|---------|
| User | username | string | 3字符 | 50字符 | ✅ | — | 唯一，字母数字下划线 |
| User | credits | integer | 0 | — | ✅ | 100 | 不可为负 |
| Singer | name | string | 1字符 | 100字符 | ✅ | — | — |
| Singer | tags | array | 0项 | 10项 | ❌ | `[]` | 前端显示截取3项 |
| Singer | genetic_ratio | integer | 0 | 100 | ❌ | `null` | 仅基因混合时必填 |
| PersonaParams | sweetness | integer | 0 | 100 | ✅ | 70 | — |
| PersonaParams | energy | integer | 0 | 100 | ✅ | 80 | — |
| PersonaParams | mystery | integer | 0 | 100 | ✅ | 50 | — |
| ClothingItem | price | integer | 0 | 9999 | ✅ | — | 虚拟货币 |
| Expression | default_intensity | integer | 0 | 100 | ✅ | 80 | — |
| Track | bpm | integer | 40 | 240 | ❌ | `null` | — |
| Track | duration_sec | integer | 30 | 600 | ✅ | 120 | — |
| Track | title | string | 1字符 | 200字符 | ✅ | — | — |
| Track | editor_tier | enum | — | — | ✅ | `lite` | 高级能力需校验套餐/授权 |
| NFTCollection | supply | integer | 1 | 10000 | ✅ | 100 | — |
| NFTCollection | price_eth | decimal | 0.001 | 100 | ✅ | 0.05 | — |
| NFTCollection | royalty_pct | integer | 0 | 100 | ✅ | 10 | >30时前端警告 |
| MarketplaceArtist | signing_price | integer | 1 | — | ✅ | 8800 | 建议范围 5000–15000 |
| MarketplaceArtist | contract_types | array | 1项 | 3项 | ✅ | — | 至少提供一种合同类型 |
| SigningContract | rights_scope | array | 1项 | 6项 | ✅ | — | 未选任何权利范围不得签约 |
| SigningContract | duration_days | integer | 1 | 3650 | 条件必填 | `null` | 买断合同可为 null |
| ActivationCode | code | string | 8字符 | 64字符 | ✅ | — | 不存明文，服务端校验 hash |
| LyricLine | time | integer | 0 | — | ✅ | — | 单调递增 |
| LyricLine | text | string | 1字符 | 200字符 | ✅ | — | — |
| DistributionJob | release_date | date | 今天+1天 | — | ❌ | `null` | 不可排期到过去 |
| ArtistListingRequest | description | string | 0字符 | 2000字符 | ❌ | `""` | — |
| TrackGenerationRequest | acrostic_word | string | 1字符 | 8字符 | 条件必填 | `null` | 仅藏头歌模式 |
| **CelebrityProject** | **name** | **string** | **1字符** | **100字符** | ✅ | — | 项目名唯一性按用户作用域 |
| **CelebrityGenerationRequest** | **duration** | **enum** | — | — | ✅ | `30` | `15 \| 30 \| 60` 秒 |
| **CelebrityProductInput** | **name** | **string** | **1字符** | **200字符** | ✅ | — | 自动落库时按 name+link 去重 |
| **Product** | **images** | **array** | **0项** | **10项** | ❌ | `[]` | 列表卡仅展示首张 |

---

## 2. 业务计算规则

> 来源：前端组件中的计算逻辑，后端必须对齐，不可由前端单方面执行。

### 2.1 钱包与 Ledger（核心规则）

```
total_balance = license_balance + recharge_balance + gift_balance
（pending_balance 不计入 total）

所有钱包余额变更必须走 LedgerEntry 追加；不允许直接 UPDATE 余额列。
LedgerEntry 不可修改、不可删除（仅可标记 reversed_by 关联反转条目）。

- LedgerEntry.amount > 0  → 入账（走 license/recharge/gift 中的某个 bucket）
- LedgerEntry.amount < 0  → 出账（仅扣 spend 总账，按 license → recharge → gift 顺序消耗）
- balanceAfter 字段冗余存储入账后的 total_balance，便于审计回查
```

参考：`apps/server/src/main/java/com/aistareco/aep/service/CreditService.java`。

### 2.2 积分消耗规则

```
注册赠送：+100 积分
音乐生成：每次 -5 积分（v2.2 起改由 thinkDepth 浮动）
图片生成（AI 生成头像）：每次 -3 积分（规划值）
基因混合：每次 -10 积分（规划值）
轻编辑导出：默认 0 积分（包含在音乐生成内）
高级编辑/专业模型：按 editor_tier 与 provider 定价

【v2.7 新增】明星视频生成（celebrity-zone）：
  KeLing  → ✦50 积分/条  + 占套餐 1 条额度
  HiGen   → ✦120 积分/条 + 占套餐 2 条额度
  MiniMax → ✦300 积分/条 + 占套餐 3 条额度
  价格由 GET /celebrity/engine-pricing 动态返回，前端不写死。

积分不足时：HTTP 402 Payment Required
返回：{ error: "INSUFFICIENT_CREDITS", current: N, required: M }
```

【v0.132 新增】带货素材视频（/material/videos/generate）时长与计价：

```
有效时长区间 = 供应商协议硬边界 ∩ candidate.maxDurationSec
  · 协议硬边界：jusuan(minimax-h3)=5..15s；agnes 上限 18s（441 帧 ÷ 24fps）；
    其余协议未知边界 = null（不臆造下限/上限）
  · items[].duration_sec 必填且 > 0 → 否则 400 VIDEO_DURATION_REQUIRED
  · 越出有效区间 → 400 VIDEO_DURATION_UNSUPPORTED
  · 全部校验发生在任何积分 hold 之前；批内任一 item 非法 → 整批无任务、无冻结

单条计价优先级（高 → 低）：
  1. item.credit_cost —— 仅限内部 Java 调用方（drama 注入自身单价）；
     外部 HTTP 请求体中的 credit_cost / credit_label 一律被 controller 剥离（防零价绕过）
  2. candidate.creditCostOverride —— 端点 billingMode=PER_SECOND 时 = 费率 × duration_sec
     （溢出 → 400 VIDEO_PRICE_OVERFLOW），否则按次
  3. 带货线默认单价 material.video-generate（admin 可配，默认 30/条）

前端报价与后端 hold 必须同源：报价取 GET /material/videos/models
（billingUnit=per_second → creditCost × 脚本总秒数）；models 加载失败时前端必须禁用提交，
不得回落任何写死单价。

AI 起稿（/material/scripts/ai-draft）时长契约：
  · duration_sec 缺省 → 默认视频端点有效上限（无配置回退 15s）；显式传入越界 → 400（不静默 clamp）
  · 产物校验：Σdur ≤ 目标 且 ≥ 有效下限（若已知）；逐镜口播 ≤ dur × 8 汉字（朗读密度）
  · 首轮全不合法 → 一次受控压缩重试（同套校验）→ 仍不合法 → 502 AI_BAD_OUTPUT 并释放冻结
  · 禁止服务端只缩 dur 数字不改台词（会产出台词念不完的不可执行脚本）
```

### 2.3 市场挂牌收益分成

```
发布者（卖家）实际到手 = signing_price × 80%
平台服务费            = signing_price × 20%

// 来源：ArtistListingDialog.tsx calculatedSplit
yourEarnings = Math.floor(signingPrice * 0.8)
platformFee  = Math.floor(signingPrice * 0.2)
```

### 2.4 签约合同收益分成

```
授权合同默认分成：
  买家（运营方）享有后续收益 = 70%
  原创者享有后续收益          = 30%

买断合同：
- 若 transfer_existing_tracks = true，则历史曲目与后续收益均按合同转移
- 若 transfer_existing_tracks = false，则仅转移形象/运营权，不转移历史曲目收益

外部平台结算：
- settlement_routing = external_account 时，平台仅记录关系和状态，不代替第三方平台打款
- settlement_routing = platform_managed 时，才进入平台内部分账流程
```

### 2.5 稀有度星级展示规则

```
legendary → 5 颗星 + 皇冠图标 + 金色光晕 + pulse 动画
epic      → 4 颗星 + 紫色光晕
rare      → 3 颗星 + 蓝色光晕
common    → 2 颗星 + 无光晕

// 来源：AIIncubator.tsx
const STAR_COUNT = { legendary: 5, epic: 4, rare: 3, common: 2 }
```

### 2.6 基因混合稀有度概率（Phase 3 规划）

```
common    = 60%
rare      = 30%
epic      = 9%
legendary = 1%

突变触发概率 = 5%（触发后稀有度+1级，最高 legendary）
突变类型：holographic_effect | dual_tone_hair | heterochromia | cybernetic_implant | elemental_aura
```

### 2.7 发行覆盖平台数量计算

```
domestic   渠道 → +4   个平台（QQ音乐、酷狗、酷我、网易云）
global     渠道 → +150 个平台
shortVideo 渠道 → +6   个平台（抖音、TikTok、快手、Instagram Reels 等）

// 来源：DistributionPage.tsx getTotalPlatforms()
total = 0;
if (channels.includes('domestic'))   total += 4;
if (channels.includes('global'))     total += 150;
if (channels.includes('shortVideo')) total += 6;
```

### 2.8 国内流媒体平台播放激励估算

```
// 来源：DistributionPage.tsx 渠道描述文案
每万次播放约 ¥30–80（平台激励金，非保证值）
此字段为显示性文案，后端不参与计算
```

### 2.9 套餐功能限额规则

```
free       → 歌手最多 3 个；音乐生成 5 点/天；不可 NFT 铸造；不可 MCN 管理
pro        → 歌手最多 20 个；50 点/天；NFT 铸造 ≤ 10 次/月
enterprise → 全部无限制

// 后端校验时机：创建歌手接口 / 音乐生成接口 / NFT 铸造接口
```

### 2.10 发行前置条件（后端需校验）

```
1. song_id 对应曲目的 status = 'released'（v2.2 起；老版本 SongStatus 用 'published'）
2. selected_channels 中至少 1 个渠道
3. 选中渠道的所有 required_accounts 已 connected = true
4. release_date > NOW()（若指定了排期时间）

// 来源：DistributionPage.tsx canSubmit()
```

---

## 3. 通用响应格式

### 3.1 成功响应（单资源）

```json
{
  "success": true,
  "data": { "...": "..." },
  "message": "操作成功"
}
```

对应前端类型：`packages/types/src/_shared.ts:ApiResponse<T>`。

### 3.2 列表响应（分页）

```json
{
  "success": true,
  "data": [ "..." ],
  "pagination": {
    "page": 1, "limit": 20, "total": 100,
    "totalPages": 5, "hasNext": true, "hasPrev": false
  }
}
```

对应前端类型：`PageEnvelope<T>`（注意：分页响应**不**额外包一层 `ApiResponse`，`apiFetch` 会按字段自动判别）。

### 3.3 错误响应

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "积分不足",
    "details": { "current": 30, "required": 50 }
  }
}
```

### 3.4 异步任务响应（统一壳，对应 `AsyncJobStarted` schema）

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "queued",
    "pollUrl": "/api/celebrity/generate/uuid",
    "pollIntervalMs": 3000,
    "estimatedSeconds": 180
  }
}
```

适用：音乐生成 / NFT 铸造 / 明星视频生成 / 项目批量分发。

---

## 4. 错误码列表

| HTTP | 业务码 | 说明 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 字段校验失败 |
| 400 | `INVALID_CONTRACT_TYPE` | 合同类型不合法 |
| 400 | `INVALID_RIGHTS_SCOPE` | 权利范围为空或不合法 |
| 401 | `UNAUTHORIZED` | 未登录或 Token 失效 |
| 402 | `INSUFFICIENT_CREDITS` | 积分不足 |
| 403 | `PLAN_LIMIT_EXCEEDED` | 套餐限额超出 |
| 403 | `MODULE_LOCKED` | 模块未解锁（需升级套餐） |
| 403 | `PERMISSION_DENIED` | 无权限操作他人资源 |
| 403 | `CELEBRITY_NOT_AUTHORIZED` | 该明星形象未对当前用户授权（v2.7） |
| 403 | `APP_CODE_REQUIRED` | 共享路由未声明子产品（缺 `X-App-Code` 头或取值非法，v0.149） |
| 403 | `PRODUCT_NOT_ENROLLED` | 当前账号未开通该子产品；`error.details.product` 给出产品 key；共享路由上头取值不在允许集合内时 `error.details.allowed` 给出集合（v0.149 / v0.150） |
| 403 | `PRODUCT_ROUTE_UNMAPPED` | 该业务路由未在服务端路由表 `ProductRouteTable` 登记，fail-closed 拒绝；`error.details.path` 给出路径（v0.150） |
| 400 | `PRODUCT_INVALID` | 未知子产品 key（v0.149） |
| 400 | `LICENSE_KEY_PRODUCT_MISMATCH` | 激活码不覆盖该子产品；此时激活码**不会**被核销（v0.149） |
| 409 | `LICENSE_KEY_UNAVAILABLE` | 激活码不存在 / 已被使用 / 已过期 / 并发兑换抢输（v0.149） |
| 404 | `SINGER_NOT_FOUND` | 歌手不存在 |
| 404 | `SONG_NOT_FOUND` | 歌曲不存在 |
| 404 | `LISTING_NOT_FOUND` | 挂牌不存在 |
| 404 | `ACTIVATION_CODE_NOT_FOUND` | 激活码不存在 |
| 404 | `CELEBRITY_STAR_NOT_FOUND` | 明星不存在（v2.7） |
| 404 | `PRODUCT_NOT_FOUND` | 商品不存在（v2.7） |
| 409 | `ALREADY_SIGNED` | 艺人已被签约 |
| 409 | `ALREADY_LISTED` | 艺人已在市场挂牌 |
| 409 | `ACTIVATION_CODE_ALREADY_USED` | 激活码已使用 |
| 409 | `ACTIVATION_CODE_NOT_IMPORTED` | 激活码未入库匹配 |
| 409 | `SINGER_SLOT_EXCEEDED` | 可创建艺人名额不足 |
| 422 | `ACCOUNT_NOT_CONNECTED` | 所需平台账号未绑定 |
| 422 | `TRACK_NOT_READY` | 曲目未生成完成 |
| 422 | `CELEBRITY_QUOTA_EXHAUSTED` | 套餐额度已用尽（v2.7） |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| 429 | `VOTE_LIMIT_EXCEEDED` | 投票次数超限 |
| 500 | `AI_GENERATION_FAILED` | AI 生成服务故障 |
| 503 | `PLATFORM_UNAVAILABLE` | 第三方平台服务不可用 |

---

## 5. 前端状态机与接口时序

> 明确每个前端 UI 状态触发了哪个接口，帮助后端理解调用时序。

### 5.1 MusicGenerationDialog（v2.2+）

```
[input] 用户填写表单 → 点击"生成"
POST /me/songs (CreateSongRequest) → 返回 Song { status: recording }
[generating] 前端按 2000ms 轮询
POST /me/songs/:id/advance → 服务端模拟生成进度 mixing → released
[preview] 展示生成结果，点击"保存并使用"
PATCH /me/songs/:id（如需修改 title/coverUrl 等）
[success] → 自动关闭弹窗
```

### 5.2 NFTMintingDialog

```
[config] 用户配置合集参数 → "下一步"
[wallet] "连接 MetaMask"
GET /nft/wallet/connect → 返回签名挑战；用户钱包签名
POST /nft/wallet/verify → walletConnected = true
[mint] "确认铸造"
POST /nft/mint → 返回 jobId
[minting] 1000ms 轮询 GET /nft/mint/:jobId 直到 status = success
[success] 展示合约地址 + Token ID
```

### 5.3 ArtistSigningDialog

```
[details] 展示挂牌详情
GET /marketplace/:id → 最新挂牌信息
[contract-type] 选择合同类型
[rights-scope] 选择权利范围
[payment] 展示费用 → "确认支付"
POST /marketplace/:id/sign → 返回 SigningContract
[success] 艺人加入用户名单
```

### 5.4 DistributionPage 发行流程

```
初始化：
GET /distribution/platforms      → 渠道配置
GET /distribution/connections    → 账号绑定状态
GET /distribution/content        → 已发行的内容

用户操作：
POST /distribution/accounts/:platform/connect → OAuth 跳转
POST /distribution/accounts/:platform/disconnect → 解绑

提交（需通过 canSubmit() 检查）：
POST /distribution/jobs → 提交任务
轮询 GET /distribution/jobs/:id 直到完成
```

### 5.5 AIIncubator + SingerEditor

```
初始化：
GET /me/digital-ips → 当前用户的艺人列表

创建：POST /me/digital-ips（草稿）

编辑：
PATCH /me/digital-ips/:id      实时保存（防抖 500ms）
GET   /wardrobe/items          获取服装库
GET   /wardrobe/my-items       已拥有
PATCH /me/digital-ips/:id      装备/卸下（写到 equippedItems 字段）
POST  /wardrobe/outfits        保存套装
GET   /poses, /expressions, /gestures  → 姿态库

软删除：DELETE /me/digital-ips/:id
```

### 5.6 CelebrityGenerationWorkspace（v2.7）

```
[mode] 用户选择「模板生成 / 盲盒」
[templateGallery / blindbox] 配置参数（商品 + 引擎 + 时长）
       ↓ 点击"生成视频"
[pendingJob] 前端冻结过渡层（5 阶段进度条 6/8/10s）
POST /celebrity/generate (CelebrityGenerationRequest) → AsyncJobStarted
       ↓ 同步异步触发
POST /products/upsert-from-generation （商品自动落库，不阻塞主流程）
       ↓ pollIntervalMs 轮询
GET /celebrity/jobs/:jobId → status = succeeded
[result] 展示视频预览 + 视频信息
       ↓
用户行为：
- 采纳并保存到项目 → 静默写入 PROJECT_VIDEOS_MAP
- 重新生成同参数  → 重新触发 startJob
- 再来一条        → 回到 [mode]
- 立即分发        → 跳转 /celebrity/projects/:id?action=distribute
- 下载草稿        → 浏览器 download attribute
```

---

## 6. 新领域的业务约束（v2.x）

### 6.0 子产品开通 enrollment（v0.149 / `packages/types/src/account.ts` · 真源 `docs/unified-identity-plan.md` §12.2）

**「建档」与「开通」是两件事**：登录只保证有本地账号档案；能不能进某个子产品的业务入口，
由 `product_enrollment` 说了算。此前这层只有前端按 `/api/me` 的 `platforms` 拦，
换个子域名直接调 API 就能绕过。

**状态机**：

```
（无行）──激活码 / 试用 / 运营发放 / 回填──→ ACTIVE ──到期(valid_until 过期)──→ 等同未开通
   │                                          │
   └── PENDING（预留：待审核的开通申请）        ├── SUSPENDED（运营冻结）
                                              └── REVOKED（退款 / 撤权）
```

- 只有 `status=ACTIVE` **且**（`valid_until` 为 null 或在将来）才算已开通。
  过期行不删除 —— 前端要能展示「已过期，去续」。
- `source` 记开通来源：`license`（激活码）/ `trial` / `admin` / `grant_all`（dev 全授予）/
  `legacy`（由旧 `aep_users.platforms` CSV 一次性回填）。
- `UNIQUE(user_id, product)`：一个账号 × 一个子产品只有一行，写入一律 upsert。
- `MeDto.platforms` 是 `enrollments` 中 active 项的**兼容投影**；账号一条 enrollment 行都没有时
  （回填 runner 尚未跑到）才回落读旧 CSV（空 CSV 仍按历史语义视作全集）。

**激活码兑换（唯一路径）** —— `POST /me/enrollments/{product}/activate`、
`POST /auth/activate`（注册）、`POST /me/license/activate`（追加激活）三个入口共用同一实现：

1. 校验激活码与批次（状态 / 有效期 / 批次是否被撤销）。
2. 算出本次授权的子产品集合：批次声明了 `platforms` → 按批次；未声明（全站秘钥）→ 按注册来源策略
   （`aep.platform.dev-grant-all`）。**调用方指定的 product 不在集合内 → 400
   `LICENSE_KEY_PRODUCT_MISMATCH`，且激活码保持 CREATED 不被烧掉**（先判后占）。
3. **条件更新占码**：`UPDATE license_key SET status='ACTIVATED', activated_by=? WHERE id=? AND status='CREATED'`
   —— 影响 1 行才继续，0 行一律 409 `LICENSE_KEY_UNAVAILABLE`。数据库行锁天然串行化并发兑换。
4. 为本次开通的**每个**子产品各写一条 `entitlement_grant(source=LICENSE,
   source_reference=<激活码 id>, product=<子产品>)`；`UNIQUE(source, source_reference, product)`
   是第二道防重复兑换的闸。一把全站秘钥开五个产品就留五条 —— 日后按产品退权 / 对账才有凭据（v0.150）。
5. 幂等补 `Studio` / `Wallet`，按批次 `initialCreditGrant` 发积分（走 `CreditService.creditAccount`
   的悲观行锁 + 不可变账本，遵守 §4.2「余额变动必经 LedgerEntry」）。
6. upsert 各子产品 enrollment 为 `ACTIVE/LICENSE`，同步旧 `platforms` CSV，发
   `EnrollmentActivatedEvent` 供账号中心回报链接状态（best-effort，失败不影响开通）。

> **绝不允许**「兑换失败但积分已发」或「一把码发两份积分」：第 3、4 步任一没过就整笔回滚。

**后端开通闸 `EnrollmentGuard`**（在 JWT 认证之后、授权判定之前）。
v0.150 起产品归属由**服务端路由表** `ProductRouteTable` 决定，不再由客户端自报的
`X-App-Code` 决定 —— 此前只开通短剧的账号带 `X-App-Code: drama` 就能调 `/api/celebrity/**`：

| 请求 | 判定 |
|---|---|
| 产品无关白名单：`/api/me`、`/api/me/messages-overview`、`/api/me/password`、`/api/me/tenants`、`/api/me/ledger`（以上精确匹配）；`/api/me/enrollments`、`/api/me/license`、`/api/me/wallet`、`/api/me/notifications`、`/api/me/storage`、`/api/me/clip`、`/api/notifications`、`/api/auth`、`/api/admin`、`/api/internal`、`/api/config`、`/api/dev`、`/api/pay/notify`、`/api/v1/admin`、`/api/v1/real-auth/callback`、`/api/aiavatar/health`（以上按「精确或下一段」前缀匹配） | 不拦 |
| **单产品路由**（路径硬映射，请求头只作审计）：`/api/celebrity`、`/api/mixcut`、`/api/material`、`/api/products`、`/api/template-scripts`、`/api/me/celebrity`、`/api/me/mixcut`、`/api/me/products`、`/api/me/publish-jobs`、`/api/me/social-accounts` → `celebrity`；`/api/me/drama`、`/api/me/distribution`、`/api/film` → `drama`；`/api/me/songs`、`/api/me/albums`、`/api/me/concerts`、`/api/me/music`、`/api/music`、`/api/tracks`、`/api/singers`、`/api/nft`、`/api/marketplace`、`/api/fan`、`/api/coach`、`/api/distribution`、`/api/analytics` → `music`；`/api/star` → `star`；其余 `/api/v1/**` → `aiavatar` | 按路径定产品 |
| **共享路由**（`X-App-Code` 必须 ∈ 允许集合）：`GET /api/v1/avatars`、`GET /api/v1/avatars/*/looks`、`GET /api/v1/avatars/*/derivatives` → `{aiavatar, music, drama}`（music / drama 的数字人选择器只读 dap）；`/api/me/digital-ips`、`/api/me/inventory`、`/api/appearance-forge`、`/api/community`、`/api/finance`、`/api/settings`、`/api/store`、`/api/wardrobe`、`/api/poses`、`/api/expressions`、`/api/gestures` → `{music, drama}` | 缺头或取值非法 → 403 `APP_CODE_REQUIRED`；取值合法但不在集合内 → 403 `PRODUCT_NOT_ENROLLED`（`details.allowed`） |
| 其余 `/api/**` 已登录请求（未登记的业务路由） | 403 `PRODUCT_ROUTE_UNMAPPED`（fail-closed）+ WARN 出路径。新 controller 必须在 `ProductRouteTable` 登记，`ProductRouteTableCoverageTest` 在构建期守住这一点 |
| 定到产品后无 ACTIVE enrollment（或已过期） | 403 `PRODUCT_NOT_ENROLLED`，`error.details.product` 给出产品 key |

- 未登录请求不在这里抢答（交给授权链出 401）；机器 / 后台身份（clip 服务令牌、`INTERNAL`、
  `SUPER_ADMIN` / `OPERATOR` / `FINANCE_ADMIN`）不经此闸。
- 开关 `aep.enrollment.enforce` 默认 **true**（含生产）。**只允许测试关闭** ——
  生产关掉等同把子产品隔离退回纯前端拦截。

---

### 6.1 AI 明星专区（v2.7 / `packages/types/src/celebrity-zone.ts`）

**4 态授权流转**：

```
unauthorized → pending（用户提交申请）→ authorized（商务审核通过）→ expired（到期未续）
                                            ↑
                                            └ 可由用户主动续费回到 authorized
```

- **服务端守卫**：`/celebrity/generate` 接口必须校验 `star.authorization.status === 'authorized'`，
  非 authorized 直接 403 `CELEBRITY_NOT_AUTHORIZED`。
- **前端守卫**：`/producer/celebrity-zone/star/[starId]/generate/page.tsx` 用 server-side `redirect()`
  拦截非 authorized 状态，避免直接拼 URL 越过授权。

**生成扣费时序**：

```
1. 校验 star 授权 + 套餐余量 + 钱包余额（任一不足拒绝）
2. 创建 GenerationJob → 入队
3. 套餐余量优先扣减（quotaCost 条），不够时切换到积分扣费（creditPrice 积分）
4. 任务完成回写 ProjectVideo + LedgerEntry（amount = -creditPrice）
5. 商品自动落库：POST /products/upsert-from-generation 新增/+usageCount
```

**项目级约束**：

- 一个 CelebrityProject 内的视频可批量分发到多个渠道（POST `/celebrity/projects/{id}/distribute`）。
- 分发前置条件：项目至少有 1 条 `status='已发布'` 视频；目标渠道 `connected=true`。

### 6.2 商品库（v2.7 / `packages/types/src/product.ts`）

**自动落库去重规则**：

```
upsertFromGeneration(input):
  1. 优先按 link 全等匹配（如果 input.link 非空）
  2. 否则按 name (case-insensitive) 匹配
  3. 命中 → existing.usageCount += 1, updatedAt = now
  4. 未命中 → 新建 Product { source: 'auto-from-generation', category: '其他' }
```

**手动录入 vs 自动落库**：

- `source = 'manual'`：用户主动通过 `ProductFormDialog` 录入。
- `source = 'auto-from-generation'`：视频生成时由系统补建，初始 category 默认「其他」，
  用户可后续编辑修正。

### 6.3 形象锻造保存与视频关联（v2.6）

```
POST /appearance-forge/save  （upsert 行为）
  - body.resultId 命中 DB → 更新该 ForgeResult
  - 否则按 body 的 artistId/image/prompt/mode/locked/createdAt 新建
  - 幂等：已有 videoUrl 不会被覆盖；传 reassign=true 可强制重抽

接入真实 AI 后：
  - 替换为触发生成任务（POST /generate）+ 回填对象存储 URL
  - 当前从 DEMO_VIDEO_POOL（2 个本地 showreel mp4）随机挑一个
```

### 6.4 从 AiAvatar 引入数字人（v0.60 收敛）

> 背景：music / drama 的艺人形象统一收敛到 AiAvatar（dap 域）。子应用本地的
> 孵化向导 / 形象锻造入口下线（路由保留提示页），新艺人只能经「引入数字人」创建。

```
POST /me/digital-ips/import-avatar
  - body.dapAvatarId 必填，校验：findByIdAndOwnerUserId（须本人所有）
      + deletedAt == null（不在回收站，否则 400 DAP_AVATAR_TRASHED）
      + imageKey 非空（已有定妆照，否则 400 DAP_AVATAR_NO_IMAGE）
  - body.dapDisplayRef 可选；格式 "look:<id>" / "deriv:<id>" / "variant:<idx>"（形象变体
    下标）/ "shot:<name>"（三机位 front-half / right / left），资产必须属于该数字人，
    deriv 仅允许图片类 kind（atlas/expr/scene/ward），否则 400 DAP_DISPLAY_REF_INVALID
  - 不扣孵化积分（incubation.cost 不适用——形象生成费用已在 AiAvatar 端结算）
  - 创建的 DigitalIp：status=ACTIVE（区别于孵化 TRAINEE）、avatarUrl 不落值、
    bio 缺省空串（TS Artist.bio 必填 string，下游有 split 派生）、
    name 缺省取数字人名称；kind 由 body.type 决定（music 端 singer / drama 端 actor）
  - 同一数字人可跨 kind 多次引入（music singer / drama actor 各一个艺人壳，独立展示图）
    ——“一人多栖”；但同 (owner, dapAvatarId, kind) 唯一，重复引入
    409 DAP_AVATAR_ALREADY_IMPORTED（前端 picker 对已引入数字人置灰标记）

展示图解析（DTO 出 wire，DapAvatarRefResolver）：
  - dapDisplayRef 命中资产 → 该资产 OSS key；未命中 / 为空 → 回退定妆照 imageKey
  - key → FileStorageService.signedUrl 实时派生签名 URL（不落库，§4.7 key 真值规则）
  - 数字人被删 / 回收站 → dapAvatarName 与 dapDisplayImageUrl 均为 null（前端回退占位，
    不阻断列表）；删除数字人不强拦、不级联删艺人壳

PATCH /me/digital-ips/{id}
  - 新增可改字段 dapDisplayRef：空串/null = 清空（跟随定妆照）；
    非空时校验同上；艺人未引用数字人（dapAvatarId 为空）则 400
  - dapAvatarId 本身不可改（引用关系创建后固定）

GET /v1/avatars/{id}/references（v0.61 反向「应用于」视图）
  - 仅数字人 owner 本人可查（required：存在 + 归属 + 不在回收站，否则 404）
  - 返回 AvatarReferenceDto[]：ipId / ipName / app / type / status /
    dapDisplayRef / importedAt（= 艺人壳 createdAt），按 createdAt 升序
  - app 由 kind 派生：ACTOR → drama，其余（SINGER 等）→ music；
    type / status 出 wire 全小写（enum 规则同 §全局）
  - 引用为空 → data: []（200，不是 404）；aiavatar 详情页空列表不渲染卡片
```

### 6.5 风格短片完成态与真实总装（v0.133）

- `drama.script_draft` 的 prompt 级缺省 `max_tokens=6144`；运营后台显式配置优先，且不修改 `DRAMA_SCRIPT_DRAFT` 共享端点的全局默认。上游返回 `finish_reason=length` 时必须以 `AI_OUTPUT_TRUNCATED` 失败关闭，不能解析或保存残缺 JSON。
- `drama.script_draft` 保持一次模型调用；`continuity_manifest` 由服务端在同一响应后确定性派生，不要求模型重复生成冗长 JSON，不增加第二次文本模型调用。草稿保存时服务端以当前可编辑分镜重建 Manifest / DAG，不信任客户端伪造依赖。
- `GET /me/drama/shorts/{id}/preflight` 是零 Token 只读质量门：检查稳定 ID、DAG、画面字段、时长、角色锚点、参考生效回报、配音指纹和总装素材；不得调用模型、提交媒体任务或冻结积分。
- `POST /me/drama/shorts/{id}/prepare-audio` 只处理音频：用草稿绑定数字人明确关联的 ready V2 音色逐镜 TTS，成功后立即镜像平台存储并记录 `textFingerprint/providerTaskId/cdnKey`。重试只补缺失或台词已变化的镜头；客户端 PUT 不得伪造或覆盖这些服务端音频字段。
- `DramaShort.status=done` 表示服务端已经把全部已验收镜头拼成一条完整视频并成功持久化，不等价于“每镜已出片”。
- 客户端 `PUT /me/drama/shorts/{id}` 不得写入或覆盖 `data.assembled`；请求 `status=done` 但不存在与当前镜头输入指纹一致的服务端成片时，返回 `409 DRAMA_SHORT_ASSEMBLY_REQUIRED`。
- `POST /me/drama/shorts/{id}/assemble` 仅接受所有镜头均为 `flow=done` 且具有 `videoUrl`，并且所有非空台词均有与当前文本指纹匹配的 TTS 音频。按 `shot.no` 排序总装，任一镜头缺失时整次拒绝，不产出部分成片。
- 总装逐镜丢弃视频模型原音，按 TTS 真实时长统一为 720×1280、30fps、H.264/AAC；开启字幕的镜头由平台烧录精确台词，不依赖视频模型生成文字。无台词镜头补确定性静音轨；最终统一响度、faststart，并用 ffprobe 硬验音轨和时长偏差。
- 最终视频与封面真值分别写入 `payloadJson.assembled.cdnKey/coverCdnKey`；URL 只在出 wire 时由 `CdnUrlSigner` 派生。列表和详情优先播放非 stale 的最终成片，不再把第一镜视频冒充完整短片。
- 镜头编号、ID、视频 URL、台词、音频 key 或字幕开关任一变化都会改变 `sourceFingerprint`，旧成片标记为 stale，草稿回到 draft；输入未变化的重复合成幂等复用原成片，不重复上传。
- 只有拼接、上传与草稿落库都成功后才置 `done/progress=100`；失败保持 draft 并允许用户重试。总装下载只允许本平台同源/CDN 地址，拒绝外部和内网 URL。

- （v0.197）从首页聊天「去制作」成单条短视频（`POST /me/drama/brainstorms/{id}/promote`，`form=single`）与其他三个入口扣同一笔 `drama.credit.short-entry`，**必须带 `clientRequestId` 才幂等**：同一 `(owner, clientRequestId)` 重试返回原草稿、不重复冻结；前端用 `brs-<brainstormId>` 作键，保证两个标签页同时点也只扣一次。草稿 `data.idea` = 一句话剧情 + 「主线：」+ 主线（都空时用标题）。
- （v0.197）短视频合成的就绪判定**仍然**是每一镜 `flow=done` 且有 `videoUrl`（短剧只要有视频）。两条线口径不一致已记 TODO；放宽时服务端 `buildPlan` / `preflight` 与前端 `readyToAssemble` / mock 必须一起改。

### 6.6 AI IP 工作台（ipstudio，v0.151 / 设计真源 `docs/ip-studio-plan.md` · TS 真源 `packages/types/src/ip-studio.ts`）

领域 `com.aistareco.aep.ipstudio.*`，表 `ip_project` / `ip_run`（迁移 **V27**）。挂 `/api/v1/ip-studio/**`，
**共用 aiavatar 开通**（`X-App-Code: aiavatar`），已被 `ProductRouteTable` 的 `any("/api/v1/**", AIAVATAR)` 兜底，不新增产品码。
生成链路全部复用 dap 域（`DapMultimodalClient` / `DapImageInput` / `FileStorageService` / `PromptService` / `CreditService` / `DapPricingService`），
故错误码里混有 `DAP_*`。

**画布文档归客户端所有。** `ip_project.doc_json` 是 `IpProjectDoc`（`nodes` / `edges` / `viewport`）的整存整取文档：
服务端逐字保存（客户端未知字段也原样保留），只校验「是含 `nodes` / `edges` 数组的对象」（否 → 400 `IP_DOC_INVALID`）
与大小上限 `aep.ipstudio.doc-max-bytes`（默认 2MB，超 → 400 `IP_DOC_TOO_LARGE`）。
**运行结果与发布结果永远不写进 doc** —— 前端每 1.2s 防抖 PUT 整块文档，异步 worker 若也往里写就必然互相覆盖
（v0.101「§6.1 只 upsert 实体表、不重写 payloadJson」同一条教训）。运行产物只落 `ip_run`，`GET project` 以投影形式带出。

**doc 里的资产 URL 出 wire 必须重签（§4.7.7）。** `source` / `reference` 节点的真值是 `assetKey`，`imageUrl` 只是上传当时的派生值；`GET /projects/{id}`（含创建 / 保存的返回体）按 `assetKey` 重签覆盖 `imageUrl`，不回写库。

**runs 投影 = 每节点最新一次 + 被选中的旧运行。** 同节点重跑新开一行、旧行保留；`runs` 按 `nodeId` 只给最新一条；
`runsById` 按 `runId` 收 `runs` 的全部，另把 doc 里 `generate.selectedRunId` 显式指向、却已不是最新的那次运行一并带上 ——
只给最新会让画布上用户已选定的候选图变成空白。

**输入编译（沿入边向上找，最多 8 跳）。** `generate` 的上游可有 `style` / `identity` / `look` / `source` /
另一个 `generate`（主形象）/ 若干 `reference`。风格与身份通常挂在 master 上而非每个 look 上，所以向上多跳查找，
用户不必为了让风格生效而把风格节点手连到每个 generate。缺输入 → 400 `IP_NODE_INPUT_MISSING`，
`details.missing` 列出具体项（`source` / `identity` / `identity.promptEn` / `style` / `style.promptEn` / `look`）。
`identity` 与 `style` 恒为必填；**`look` 只在非主形象节点上必填** —— 内置模板的 master 节点直接挂在 style 之后、
上游本就没有 look（`docs/ip-studio-plan.md` §6），把它也列为硬必填会让主形象永远跑不起来。
`generate` 无任何图片参考（既无主图也无照片）**允许**运行，此时 `inputs.refs = []`。

**参考图顺序、砍尾与如实回报。** 装配顺序即优先级：`master`（上游主形象节点 `selectedRunId` + `selectedIndex`
指向的候选 key）→ `source`（原照片）→ `reference…`。上限 `aep.ipstudio.max-ref-images`（默认 4），
超出的**按此顺序砍尾**并在 `inputs.refs[]` 标 `applied=false` / `reason=over_max_refs`，**绝不静默丢弃**。
`reference` 节点的 `note` 拼进提示词的 `{{refNotes}}`（形如 `Reference image 3: hat style only`）。
本地 `/cdn` 对云端不可达时由 `DapImageInput.of` 自动转 dataURI（已有逻辑）。

**参考图在第一次出图之前就要全部读出来。** 身份锚（`master` / `source`）读不到 → 释放冻结 +
运行失败 `IP_REF_UNREADABLE`，**绝不降级成没有身份锚的文生图**（那会照价出一张不像本人的脸，
而 `inputs.refs` 里还写着 `applied=true`）；可选的 `reference` 读不到 → 把库里那一条改成
`applied=false` / `reason=unreadable` 后继续，界面必须看得见哪张没生效。

**doc 里的 `assetKey` / `selectedRunId` 一律按客户端可写的不可信输入处理。**
`assetKey` 必须是本人上传（`ipstudio_source/<uid>/…`）或本人生成（`ipstudio_gen/<uid>/…`）的 key
（前缀由 `FileStorageService` 自己的 key 生成规则派生，不手写猜测），且不含 `..` / 反斜杠 / 前导 `/`，
否则 400 `IP_ASSET_KEY_INVALID` —— 不校验就等于：抄别人的 key 拿别人的脸出图（越权），
或用 `../` 让 `FileStorageService.openForRead`（`Paths.get(localDir, key)`，无包含性检查）
把本机任意文件 base64 上行给外部模型（路径穿越 + 外泄）。
`selectedRunId` 走 `IpProjectService.ownedRun` 的 **owner + project 双限定**，
不符 → 参考图装配 404 `IP_RUN_NOT_FOUND` / 发布 400 `IP_PUBLISH_SELECTION_REQUIRED`，
**绝不退化成「没选主图」静默继续**。

**提示词由服务端唯一拼装。** `dap.ip_identity`（带图 chat → 中文结构化特征卡 + 英文身份提示词）与
`dap.ip_look_image`（`{{style}}` / `{{identity}}` / `{{outfit}}` / `{{pose}}` / `{{expression}}` / `{{details}}` /
`{{props}}` / `{{refNotes}}` / `{{negative}}` + 固定一致性从句 + 负面词）。拼装后残留占位符与多余空白一并清掉。
本次实际提示词原文经 `IpRun.inputs.prompt` 返回给用户（透明可查）。刻意不复用 `dap.image_look` / `dap.image_atlas`。

**preflight 一定在 hold 之前（§8.0）。** 顺序硬约束：输入编译 → preflight → hold → 派发 worker。
`identity` 校验人设通道（`chatModel()`）、`generate` 校验图片通道（`imageModel()`），未绑定 → 503
`DAP_ENGINE_NOT_CONFIGURED`；prompt 解析 `origin=code`（= 未配置）→ 503 `PROMPT_NOT_CONFIGURED`。
两者都**不冻结一分钱、不落 run 行**。绝不产假产物：拿不到图 / 引擎不支持看图一律 failed + `errorCode`。

**计费 hold → 逐张 commit。** `referenceType="ip-run"`、`referenceId=runId`（一次运行一个 hold）。
整批一次 `hold(单价 × count)`（余额不足在此 402，run 行不落库）；每张图**先 `commitHold(单价)`、
再把候选写进 `output.candidates`** —— 顺序反了会出现「commitHold 抛错（内部含释放）但图已入库」的白送
（`DramaReferenceAssetService.generateReferenceSheet` 的原始教训）。首张失败即停、剩余 `releaseHold`、
已成功的保留；零成功 → failed + 原始 `errorCode` 且 `cost=0`。worker `catch (RuntimeException)` 而非只抓
`BusinessException` —— `commitHold` 抛的是 `ResponseStatusException`，只抓 `BusinessException` 会跳过释放，
把冻结额挂到 `CreditHoldSweeper`（默认 180 分钟）才回来。`identity` 同理，单笔。
`IpRun.cost` 恒为真实账本值：running = 冻结额，done = 已 commit 之和，failed = 已 commit 的部分（可能为 0）。

**结算只认冻结那一刻的单价快照。** hold 时把 `unitCost` / `holdTotal` 写进 `inputs._exec`，
worker 逐张 commit 用的是这份快照，**不回头再读一次后台单价** —— 运营在 hold 与 commit 之间改价，
按新价结算要么少扣（用户白得图）要么超过 hold 剩余（`commitHold` 直接 400），都是真金白银的错账。
循环结束后按**金额**对账：`已 commit 金额 < holdTotal` 一律 `releaseHold` 补退（release 幂等，
终态 hold 重复调用只记一行 no-op 日志），不把冻结额留给 180 分钟后的 `CreditHoldSweeper`。

**产物必须是能解码的图。** 落 storage / commit 之前校验字节确实是图片（`ImageIO` 可解 或 WebP 魔术字），
否则按 `DAP_MODEL_BAD_OUTPUT` 中止该次运行并释放剩余 —— 上游回的一段错误 JSON / 空响应体
不许被当成候选图入库并照价扣款。

**派发失败也要收尾。** `ipRunExecutor` 排满时 `@Async` 抛 `TaskRejectedException`：此时 hold 已冻、
run 行已落库，必须置 failed `IP_RUN_QUEUE_FULL` + 释放冻结（收尾方法在 worker 上标
`REQUIRES_NEW`，因为派发发生在 `afterCommit`、当前线程已无事务），否则就是一个永远 running 的节点。

**取消要在扣款之前检查。** identity 在调模型前与 commit 前各查一次 `cancelRequested`：
模型算完但还没扣款时用户已取消，就不该再扣。
单价走 `DapPricingService`：`dap.ip-identity`（默认 2，按次）/ `dap.ip-image`（默认 8，**按张**），
admin「权益扣减配置 → 动作单价」可改，0 = 走部署默认价。

**取消与超时。** `POST /runs/{id}/cancel` 只置 `cancelRequested`，终态由 worker 在阶段间收尾时落
（两边都写终态会互相覆盖，同 `DapJobService.cancel`）；已 commit 的图归用户、剩余释放、标 `IP_RUN_CANCELLED`。
`IpRunReaper` @Scheduled 把 running 且心跳超 `aep.ipstudio.stale-minutes`（默认 15）的置 failed +
`IP_RUN_TIMEOUT` + 释放冻结 —— 没有它，一次进程重启就留下永远 running 的行。

**存储只存 key。** 上传落 `ipstudio/source`、生成产物落 `ipstudio/gen`（`FileStorageService`）。
DB 只存 storage key，URL 一律出 wire 时经 `signedUrl(key)` 派生，**不落库**（§4.7.4 / §4.7.7）。
`inputs._exec` 是服务端执行参数（含 storage key），出 wire 时剥掉。
上传只收 **jpg / png**（**不收 webp** —— 标准 JDK ImageIO 没有 WebP 读取器，宣传支持等于宣传一种
必然失败的格式，前端 accept 同步去掉 `image/webp`）且 ≤ `aep.ipstudio.upload-max-bytes`（默认 15MB），
并且必须真能被识别成图片（改后缀的假 png 一样拒 400 `IP_UPLOAD_INVALID`）。
尺寸只读**文件头**（`ImageIO.getImageReaders` + `reader.getWidth/getHeight`）、**不整图解码**，
最长边超 `aep.ipstudio.upload-max-dimension`（默认 8000px）直接拒 —— 一张 200KB 的 PNG 可以声明
50000×50000，整图解码瞬间要几十 GB 堆（decompression bomb）。
微信 `tmp_*` 与长哈希文件名归一为可读默认名。

**发布约束。** `masterNodeId` 与每个 `lookNodeIds` 都必须是 `generate` 节点且已有选中候选，
且选中的 run 必须属于**本人本项目**（防伪造 doc 把别处的图拿来发布）—— 否则 400
`IP_PUBLISH_SELECTION_REQUIRED` 且不留下半个资产。`avatarName` **必填**，为空 → 400
`IP_PUBLISH_NAME_REQUIRED`（不再悄悄拿项目名替：用户在发布框里删空了名字，
资产库里冒出一个叫「未命名 IP 项目」的资产，他只会以为发布坏了）。建 `DapAvatar`（`path=ai` / `status=finalized` / `imageKey=主图 key` /
`basePrompt=identity.promptEn` / `descPrompt=identity.text` / `def` 从特征卡逐行小标题解析 /
`variantKeys=主 generate 全部候选` / `addVersionAt(1,…,"init",key)`）+ 每个 look 一条 `DapLook`
（`source=design` / `status=done` / `prompt=该次运行的实际提示词` / `label=上游形象卡标题`）。
**零积分** —— 图早在 generate 阶段按张扣过了，发布只是登记；图片直接复用同一 storage key，不重复上传。
项目落 `status=published` / `publishedAvatarId` / `coverKey`。重复发布 → 409 `IP_PROJECT_ALREADY_PUBLISHED`
（P1 不做增量发布）。

**错误码表**

| code | HTTP | 场景 |
|---|---|---|
| `IP_PROJECT_NOT_FOUND` | 404 | 非本人 / 已软删 |
| `IP_NODE_NOT_FOUND` | 404 | doc 里无该节点 |
| `IP_NODE_NOT_RUNNABLE` | 400 | 非 identity / generate 节点 |
| `IP_NODE_INPUT_MISSING` | 400 | `details.missing` 列出缺的上游类型 / 字段；也用于 worker 阶段照片读不到 |
| `IP_IDENTITY_EXTRACT_FAILED` | 502（落在 run 上） | 视觉抽取失败，含引擎不支持看图与输出为空 |
| `IP_IMAGE_FAILED` | —（落在 run 上） | 出图失败且非 `DAP_*` 已知码时的兜底 |
| `IP_RUN_NOT_FOUND` | 404 | 非本人 / 不存在 |
| `IP_RUN_ALREADY_RUNNING` | 409 | 同节点已有 running run |
| `IP_RUN_CANCELLED` | —（落在 run 上） | 用户取消；已 commit 的图保留 |
| `IP_RUN_TIMEOUT` | —（落在 run 上） | reaper 判僵死，已释放冻结 |
| `IP_PUBLISH_SELECTION_REQUIRED` | 400 | 主图 / look 未选候选，或节点类型不对，或选中运行不属于本项目 |
| `IP_PROJECT_ALREADY_PUBLISHED` | 409 | P1 不做增量发布 |
| `IP_UPLOAD_INVALID` | 400 | 类型（仅 jpg/png）/ 字节大小 / 像素尺寸 / 无法识别的图片内容 |
| `IP_ASSET_KEY_INVALID` | 400 | doc 里的 `assetKey` 不是本人上传 / 生成的 key，或含 `..`、反斜杠、绝对路径 |
| `IP_PUBLISH_NAME_REQUIRED` | 400 | 发布时 `avatarName` 为空 |
| `IP_REF_UNREADABLE` | —（落在 run 上） | 身份锚参考图（主形象图 / 原照片）读不到；已释放冻结，不降级出图 |
| `IP_RUN_QUEUE_FULL` | —（落在 run 上） | 运行线程池排满、派发失败；已释放冻结 |
| `DAP_MODEL_BAD_OUTPUT` | —（落在 run 上） | 上游返回的字节不是可解码图片；不入库不扣款 |
| `IP_DOC_INVALID` | 400 | 不是含 nodes / edges 的对象 |
| `IP_DOC_TOO_LARGE` | 400 | 超过 `aep.ipstudio.doc-max-bytes` |
| `IP_TEMPLATE_NOT_FOUND` | 400 | 新建时引用了不存在的内置工作流 |
| 复用 | 503 `DAP_ENGINE_NOT_CONFIGURED`、503 `PROMPT_NOT_CONFIGURED`、402 积分不足（CreditService 既有） |

#### 6.6.1 统一 Studio（v0.202，未发布）

`/v1/ip-studio/studio/capabilities`、`studio/ip-assets`、`studio/asset-catalog`、`projects/{id}/studio-runs`、`projects/{id}/adopt` 同属 aiavatar 开通；未绑手机号只读与 owner 校验继续生效。

- V40 唯一(project_id,client_request_id) + 项目行锁：同键同输入返回原运行，同键改输入 409 `STUDIO_REQUEST_CHANGED`。网络结果未知重查/同键确认，不能重新提交扣费。
- 文档由客户端拥有。剧本编辑/镜头/顺序/采用写回走原保存版本闸；worker 不改 doc。拆镜使用编辑正文，改稿保留旧产物并提示来源更新，不自动重跑。
- IP 使用现有 DapAssetIp/DapAvatar/DapAvatarVersion/DapLook。采用 main 保留主形象历史，look 保存造型不改变主形象；归属不因跨项目使用而改写。引用旧版本要精确对应历史 key；lookId 必须匹配 owner/avatar/key。
- 旧发布人物即使 ipId 为空也可引用；用户显式关联时保留原 avatarId，不自动猜测 IP、不复制人物。合成完成登记既有 DapAssetUsage 的 studio-project 来源关系，作品回到原项目。
- 脚本模板 key `dap.ip_studio_script` 在 hold 前解析；模板/实际正文/人物上下文/参数保存为私有执行快照，响应隐藏 _exec。严格校验结构化脚本后才 commit，局部改写只合并指定大纲或正文，不覆盖其他设定。
- 视频 `count=1|2|4` 默认 1：一个 `clientRequestId` 绑定一批原生视频 Job；整批先校验模型、参考与总价，再由通用视频链冻结和 afterCommit 派发。`maxCost` 是整批上限；价格升高时禁止部分受理。种子指定时第一条用原值，其余依次递增，超过 2147483647 后回到 0。
- 批次只读投影所有候选的进度、产物和失败原因：任一活跃为 running；全部结束且至少一条成功为 done（部分失败明确展示）；全部失败为 failed。成本是成功和活跃 Job 的冻结价之和，失败 Job 按通用链释放，无第二份账本结算。只存原生任务 ID 与 key，签名 URL 仅出 wire 派生。旧单 Job 绑定仍可恢复。
- 新批次逐条更新候选，保留旧已采用版本；失败或生成中的候选禁止采用。网络未知结果保留原请求键，刷新/确认原任务均不得循环创建新批次。停止仅能原子取消全部仍 queued 的候选；任一已交引擎则整批拒绝停止，继续查询原任务。
- 采用新图片/视频候选不改变旧运行的参考 key/版本；修改源内容只标记下游来源更新，不自动发起收费请求。合成按明确选中的片段顺序与画幅执行，保留音轨。
- 真实视频的 IpRun 是不可变绑定，状态/产物/冻结与消耗由原 MaterialVideoJob(ipstudio) 投影，只有原视频链结算；已交厂商不能通过停止请求误报退款。Studio 文本/合成终态与账本在同事务，取消与超时行锁串行；派发在 afterCommit。
- 多集剧本每次最多 6 集；全剧人物/场景/道具共享，单集改写只合并指定集。episodeNo 明确镜头归属；重复集号/镜头 id、未知集号、遗漏某集镜头均为 AI_BAD_OUTPUT 并释放冻结。旧单集镜头缺 episodeNo 按第 1 集显示。
- 助手 general/original/adapt/director 使用 dap.ip_studio_assistant，只返回可编辑建议。上下文从本项目明确选中的最多 16 个节点读取，只含文字/设定，不发送媒体字节或私有地址、不声称看图。模型是 DAP_PERSONA 启用候选，执行使用受理时选定端点。
- 连续制作范围、源内容快照、步骤、请求编号和费用上限保存在客户端 doc。确认后按序执行既有运行，任务状态/实际费用只读 IpRun。失败停止后续提交；暂停不取消已受理任务；刷新后用户显式继续，同键确认原任务。只有已确认 failed 的步骤可生成新键，完成步骤不重跑；来源内容/引用变化先重新确认。单批最多 12 个镜头。
- maxCost 是确认上限，不是客户定价：图片在原计价后、视频在 MaterialVideoJob 原生计划定价后校验；上涨返回 409 STUDIO_PRICE_CHANGED、零新增冻结。按真实价结算，不能把较大上限当售价。
- 新可选字段不破坏旧同键恢复：已有输入快照按同一请求字段比较，null 字段扩展不视为输入改变；新增设定、选模、上下文、费用上限有值仍参与指纹。
- fixture 默认关闭、仅显式本地 H2 启用，prod/production/mysql 启动硬拒绝。只替换模型返回，媒体缺失明确失败；真实存储/保存/采用/ffmpeg 继续执行，mock 成本 0。测试时旧原生模型路由关闭，不能误调收费引擎。

- 助手未知操作只能保留为只读 `notes`；未解析引用通过 `unresolvedReferences` 要求用户明确补选，不猜测对象或直接执行。连续计划在客户端文档保存准确请求/费用/来源快照，恢复同一键；每步仍走原生 owner/模型/报价/hold，不能另造钱包和后台无限执行。
- `studio/asset-catalog` 只读本人商品/人物/声音，声音与驱动状态独立于图片定稿；引擎未配置不得显示口播已就绪。固定预设声音、试听与独立 X-Dub 口型同步已接；视频口型就绪由 videoLipSyncReady 表示，不能据此把任意人物图片标为训练就绪；人物固定声音版本绑定现已接通，专属声音仍未接。
- `assemble.packaging` 仅使用用户明确文字和时间窗；有数量/长度/非重叠/实际成片时长校验。Java2D 绘制文字后叠加媒体，用户文字不进入 shell/filter，保留真实音轨，不冒充 ASR/配音；合成不另收模型积分。
- 现有超级管理员模板/示例发布须剥除 Studio request/runId、批准计划、对话/上下文、采用身份和私有引用。模板去媒体，示例仅复制成平台素材；作者运行不能由套用者继续。参数化输入/不可变版本与通用依赖执行属于 M7 规划。

真实模型、计费与生产验收分别记录于统一 Studio 验证记录；本地真实 Agnes 与平台积分通过不替代厂商账单或生产发布。

### 6.7 短剧画布（v0.198 / 设计真源 `docs/drama-canvas-plan.md` · TS 真源 `packages/types/src/drama-canvas.ts`）

web-drama 的 `/canvas`：照小云雀「短剧 Agent」做的一条**独立**流水（剧本 → 角色和场景 → 逐集制作 → 单集编辑器 → 合成成片）。
和「我的短剧」（`DramaProject` / 旧工作台）**互相独立**：自己的表 `drama_canvas` / `drama_canvas_run`（迁移 **V36**，部署前核对线上
`flyway_schema_history`）、自己的接口 `/api/me/drama/canvases/**`，`DramaProject*` / `drama_character` / `drama_scene` 一律不动。
走短剧开通（`ProductRouteTable` 的 `any("/api/me/drama/**", DRAMA)`）。所有 `{id}` 按 principal 隔离：
不存在 / 不是本人 / 已软删**不区分**，一律 404 `DRAMA_CANVAS_NOT_FOUND`（免得成为探测面）。

**文档归客户端所有，服务端从不改它。** `drama_canvas.doc_json` 是 `DramaCanvasDoc` 的整存整取文档：
服务端只校验外形（`schema=1`；`source ∈ idea|paste`；`style` / `script` / `board` 是对象；`script.episodes` / `script.history` /
`characters` / `scenes` / `materials` / `episodes` / `board.edges` 是对象数组；`board.positions` / `board.viewport` 是对象；
`board.collapsed` 是数组），不过 → 400 `DRAMA_CANVAS_INVALID_DOC`（`error.details.path` 指出第一处）。
**生成结果永远不写进文档**：写 `drama_canvas_run.result_json`，前端按 `runId` 幂等合并回文档再保存 ——
服务端写文档必然和前端的防抖保存互相覆盖（ipstudio 同一条教训）。

**保存 409。** `PUT` 必须带 `baseDocVersion`（`docVersion` = sha256(规范化文档 JSON + NUL + 标题) 前 16 位 hex；规范化 = 对象键名递归排序 + 紧凑输出，
所以字段顺序不同的同一份内容指纹相同；**标题也算进版本**，只改名同样换版本，旧页面带旧版本保存会 409，不会悄悄把新标题盖回去）。缺省或不是库里当前版本 → 409 `DRAMA_CANVAS_STALE`，`error.details.docVersion` 给当前版本；
版本先在内存比一次，再由条件更新（`UPDATE … WHERE doc_version = :base`）在数据库里判一次，两个标签页同时存只有一个赢。
前端 409 时停止自动保存、给「载入最新」。返回的 `updatedAt` 截到微秒、UTC，与之后读回来的逐字相同。

**文档上限 4MB。** 按**剥掉 url 之后**的规范化 JSON 的 UTF-8 字节数算，超 → 413 `DRAMA_CANVAS_TOO_LARGE`（新建时同样判）。

**只存 key。** 保存前递归剥掉所有**字符串值**的 `url` / `lastFrameUrl`（签名有 TTL，存进库一小时后裂图，§4.7.7）；
值是对象的同名字段不动。读出（详情、新建返回体）时收齐整棵树里的 `key` / `lastFrameKey`，**一次**批量查归属，
只给**本人**的 key 用 `CdnUrlSigner.signKey` 派生 `url` / `lastFrameUrl`；不是本人的不签、不报错、key 原样返回（前端显示占位）。
列表只签封面：第一张属于本人的挑中图（造型优先、其次场景；`pickedKey` 在 versions 里就用它，否则 versions 里第一张），
所有画布的候选合在一起一次查。库里的文档解析不出来 → 500 `DRAMA_CANVAS_DOC_CORRUPT`（**不**回退空文档：
前端拿到空文档会自动保存，把库里那份覆盖掉）；列表里遇到这种行按空统计出卡片，不让整个列表打不开。

**归属闸。** drama 生成的 key 里没有 uid（`drama/frames/<uuid>.png`），前缀判不出归属。唯一真值 = `storage_assets` 里
`(app=drama, owner_user_id=本人, cdn_key)` 三者对上（`DramaCanvasOwnership`）。所以**画布的所有产物**（出图、视频镜像、末帧、成片）
落库时都必须 `DramaCanvasOwnership.record(...)` 记一行；上传参考图（`POST /me/drama/assets/uploads`）已由
`StorageQuotaService.record("drama", …)` 记过。`record` 与用量记账不同，**失败会抛**（它是归属真值，静默丢一行 = 用户花钱的图下次打开不签）；
同一个 key 已记在别人名下 → 500 `DRAMA_CANVAS_ASSET_RECORD_CONFLICT`，不悄悄改归属。
外形不安全的 key（`..` / 前导 `/` / 反斜杠 / 控制字符 / 首尾空白 / 超 512）一律不算本人的，不查库。
生成时从**已保存的文档**里读出的每个 key（参考图、首帧、片段视频）都过 `requireOwned`：
任一不是本人的 → 400 `DRAMA_CANVAS_ASSET_NOT_OWNED`（`error.details.keys` 列出，最多 20 个），**在冻结之前，不扣费、不生成**（不是跳过）。

**生成只读已保存的文档（生成 409）。** 提示词正文、参考图（连线 / `@[名字](look|scene|material:id)` 引用）、首帧、片段时长、
合成顺序一律从库里那份文档取，客户端不传；每个生成请求带 `docVersion`，不是当前版本 → 409 `DRAMA_CANVAS_STALE`（前端先 flush 保存成功再发）。

**幂等。** 每个生成请求带 `clientRequestId`（8–64 位 `[A-Za-z0-9_-]`，不合规 → 400 `DRAMA_CANVAS_REQUEST_ID_INVALID`），`drama_canvas_run` 上 `UNIQUE(owner_user_id, client_request_id)`：
同一个键重复请求（重试 / 双击 / 两个标签页）回原运行记录，不重复冻结、不重复提交。**所有生成接口**遇到下面三种情况一律 409
`DRAMA_CANVAS_REQUEST_ID_REUSED`：同一个键已用在另一张画布；用在另一种请求上（`kind` 或 `target` 不同）；单条请求和批量请求互用同一个键。
批量出图每项一条运行记录：**第 0 项直接占用原始 `clientRequestId`**，其余项用 `${clientRequestId}:${i}`（i≥1）——
单条和批量抢的是同一把唯一索引，同一个键不会被两边各受理一次；客户端的键里不许有 `:`（正则本身就排除了），免得和派生键撞上。
批量最多 20 项、所有项张数合计最多 40 张，超了 400 `DRAMA_CANVAS_BATCH_TOO_LARGE`（在冻结之前判）；一项都没有 400 `DRAMA_CANVAS_BATCH_EMPTY`。
**确认是否受理只能查、不能重发。** 请求发出后响应丢了、或请求返回前用户离开了页面，前端用
`GET /me/drama/canvases/{id}/runs/lookup?clientRequestId=…` 确认：只查不建、无副作用、不扣费，返回这个键在本人本画布下受理出来的运行记录
（单条 0 或 1 条；批量出图返回整批），没受理过是空数组；键不合规 400 `DRAMA_CANVAS_REQUEST_ID_INVALID`，画布不是本人的 404。
**前端不许用原键重发 POST 来「确认」**：重发在没受理时会真的受理一次、冻结积分，确认动作不该有这个副作用。

**计费（冻结 → 结算 / 退回）。** 单价常量都在 `DramaConfigSeeder`（冻结与 `/me/drama/config` 报价读同一个 key、同一个默认值）：

| 动作 | key | 默认 | 计价 |
|---|---|---|---|
| 写故事大纲 | `drama.credit.canvas-script-setting` | 2 | 按次 |
| 写分集剧情 | `drama.credit.canvas-script-outline` | 6 | 按次（不乘集数） |
| 写 / 重写一集剧本 | `drama.credit.canvas-script-episode` | 4 | 按集 |
| 拆出角色和场景 | `drama.credit.canvas-extract` | 4 | 按次 |
| 生成一集分镜脚本 | `drama.credit.canvas-storyboard` | 4 | 按集 |
| 出图（造型 / 场景 / 素材 / 片段首帧） | `drama.credit.frame`（候选 `creditCostOverride` 可覆盖） | 2 | × 张数（1–4） |
| 片段视频 | `/me/drama/render/models` 的视频候选单价 | — | 按秒计费的端点 = 单价 × 片段 `durationSec`，否则按次 |
| 合成成片 | — | 0 | 免费 |
| 新建 / 切集 / 保存 | — | 0 | 免费 |

- 文字类（script / extract / storyboard）：请求里只建记录并冻结，`afterCommit` 派发到后台跑；成功结算，失败 / 取消退回。
  模型 JSON 输出按形状校验，不合格 = 失败（502 `AI_CALL_FAILED` 落在 run 上）并退回，不许拿模板句冒充结果（§8.0）。
- 出图：preflight（引擎、提示词、归属）在冻结**之前**（未配置 503，不建记录、不冻结）；整批一次冻结，单价快照进 `input_json`，
  **每张成功才结算**、失败的退回；不再「先出图后扣费」。
- 视频：提交时冻结（单价 × 秒数），worker 结算或退回（沿用 `MaterialVideoJobService`）；首帧必须写进 `variant_config.first_frame_key`。
- worker 派发一律挂 `afterCommit`（事务里派发 worker 查不到行，任务永远 queued —— ipstudio 真联调踩过）。
- `DramaCanvasRun.cost` = 这次冻结 / 扣掉的积分；失败退回后仍显示原值，`status` 说明结果。
- 取消：只有还在排队的能取消（退回冻结）；已交给厂商的 409 `DRAMA_CANVAS_RUN_NOT_CANCELABLE`。

**锁住的集。** `script.episodes[].locked=true` 的集，AI 重写（`runs/script` 的 `stage=episode`）一律拒绝 409 `DRAMA_CANVAS_EPISODE_LOCKED`，
在冻结之前判；前端按钮同时禁用并说原因。手改正文不受锁影响（锁只挡 AI 覆盖）。

**新建（免费）。** `CreateDramaCanvasBody` 校验：`ratio ∈ 9:16|16:9`；`source ∈ idea|paste`；`style.id` / `style.name` 必填（≤ 64 / ≤ 40），
`style.prompt` ≤ 300；`source=idea` 时 `idea` 1–500 字、`targetEpisodes` 1–80（缺省 10）、`episodeDurationSec` 30–180（缺省 60），
写进 `script.idea` / `targetEpisodes` / `episodeDurationSec`，`script.episodes=[]`；`source=paste` 时 `text` 1–100000 字，
按下条规则切集写进 `script.episodes`（此时不写那三个字段）。字数按码点算。不过 → 400 `DRAMA_CANVAS_BODY_INVALID`
（`error.details.field`）。标题缺省：idea 取想法前 20 字，paste 取「未命名画布」；最长 128。其余字段按空文档
（`characters` / `scenes` / `materials` / `episodes` = `[]`，`board = {positions:{}, edges:[], collapsed:[], viewport:{x:0,y:0,zoom:1}}`，`script.history=[]`）。

**切集（`script/split` 与 paste 新建同一套，纯规则、不调模型、免费、不落库）。** 集标题行 = 一行开头（可带 `#` 标题记号、`【` / `[` / `（` 括号）是
「第 N 集」，N 为阿拉伯数字（含全角）或中文数字；后面可跟 `：` `:` `·` `、` `-` `—` `|` 或空格再跟集名。正文里的「第一集的时候……」不算
（集字后紧跟的不是分隔符且像一句话，或含 `。！？；，`）；「第 X 集 完 / 终 / 结束」是结尾标记不算。集号**一律按出现顺序重排成 1..N**
（原文漏号、重号在 notes 里说明）；第一个集标题之前的文字（剧名、人物表）放进第 1 集开头并说明；一个标记都没有 → 整篇当第 1 集并说明；
只有标题没有正文的集保留（正文为空）并说明。每集正文统一换行、去行尾空白、去首尾空行、连续空行压成一个；集名最长 40 字。

**画布停在哪一步（`step`，服务端推）。** `script.extractedAt` 缺 → `script`；所有集都没有片段 → `assets`；否则 `episodes`。
列表卡片统计：`episodeCount` = `script.episodes` 数；`segmentsDone` / `segmentsTotal` = 所有集片段里有挑中视频的 / 总数；
`episodesAssembled` = 有 `assembled.key` 的集数。

**软删。** 只打 `deleted_at`（条件更新，不整行写回）；运行记录保留，已花的积分不退。

**文字类调用（v0.198.1，线上实测补的）。** 剧本 / 拆角色和场景 / 分镜脚本都走同一套：
- **并发闸**：同一时刻最多 `aep.drama.canvas.text-concurrency`（缺省 2，`AEP_DRAMA_CANVAS_TEXT_CONCURRENCY`）个 chat 请求在飞，公平排队；
  等许可不占钱，按运行时限（90 分钟）收尾并定时刷心跳。只管这一台实例上的画布 worker，老短剧的文字调用不在闸里。
- **临时错误退避**：上游 429 / 502 / 503 / 504、网络错误按 5s → 15s → 30s 最多重试 3 次；超时（单次 180 秒）只再试一次。
  最后还是 429 → 「AI 写作这会儿太忙…」，不把厂商英文原话给用户。
- **输出不合格**：先按「只补能唯一确定的 `]` / `}`」修一次（`ModelJsonRepair`，与 `DramaScriptService` 同一份），
  仍不合格就同样的消息再问一次，不额外扣钱；还不合格 → `AI_CALL_FAILED` 退回，日志里有第二次输出的头尾摘录。
- **写全部分集剧本**：前端逐集发，**上一集写完并保存后才发下一集**（`submitSequence({ awaitEach })`），
  这样每一集的提示词里都有上一集的结尾。
- **分镜片段时长**：`minSegmentSec` = 所选视频模型的最短时长（H3 = 5 秒）。模型仍切出太短的片段 → 并进相邻片段
  （先后一段、再前一段，合并后不超过上限，内容一字不改），并不进去就留着并在 notes 里说明；编辑器里时长越界的片段不让点「生成视频」。

**错误码表**

| code | HTTP | 场景 |
|---|---|---|
| `DRAMA_CANVAS_NOT_FOUND` | 404 | 不存在 / 不是本人 / 已软删（不区分） |
| `DRAMA_CANVAS_BODY_INVALID` | 400 | 新建 / 切集请求体不合法（`details.field`） |
| `DRAMA_CANVAS_INVALID_DOC` | 400 | 保存的文档外形不对（`details.path`） |
| `DRAMA_CANVAS_TOO_LARGE` | 413 | 规范化后超过 4MB |
| `DRAMA_CANVAS_STALE` | 409 | 保存的 `baseDocVersion` / 生成的 `docVersion` 缺省或不是当前版本（`details.docVersion`） |
| `DRAMA_CANVAS_DOC_CORRUPT` | 500 | 库里的文档解析不出来（只可能是被手工改坏） |
| `DRAMA_CANVAS_ASSET_NOT_OWNED` | 400 | 生成要用的 key 里有不属于本人的（`details.keys` / `details.count`），不扣费 |
| `DRAMA_CANVAS_ASSET_RECORD_CONFLICT` | 500 | 记归属时 key 已记在别人名下 |
| `DRAMA_CANVAS_EPISODE_LOCKED` | 409 | AI 重写锁住的集 |
| `DRAMA_CANVAS_RUN_NOT_CANCELABLE` | 409 | 已经交给厂商的运行不能取消 |
| `DRAMA_CANVAS_REQUEST_ID_INVALID` | 400 | `clientRequestId` 不是 8–64 位 `[A-Za-z0-9_-]` |
| `DRAMA_CANVAS_REQUEST_ID_REUSED` | 409 | 所有生成接口：同一个 `clientRequestId` 已用在另一张画布、另一种请求（`kind` 或 `target` 不同），或单条与批量互用 |
| `DRAMA_CANVAS_BATCH_TOO_LARGE` | 400 | 批量出图超过 20 项或合计超过 40 张 |
| `DRAMA_CANVAS_BATCH_EMPTY` | 400 | 批量出图一项都没有 |
| 复用 | 402 积分不足（CreditService 既有）、503 `AI_NOT_CONFIGURED` / `IMAGE_NOT_CONFIGURED` / `VIDEO_NOT_CONFIGURED` / `PROMPT_NOT_CONFIGURED` / `ENDPOINT_NOT_ALLOWED`、502 `AI_CALL_FAILED`（落在 run 上） |

**运行记录上的错误码**（落在 `DramaCanvasRun.errorCode`，不是 HTTP 错误；给用户看的话在 `errorMessage`）

| code | 适用 | 场景 / 钱 |
|---|---|---|
| `DRAMA_CANVAS_QUEUE_FULL` | 全部 | 运行线程池排满、没派发出去；已退回 |
| `DRAMA_CANVAS_RUN_DEADLINE` | 全部（主要是批量出图） | 受理后超过 90 分钟就停止，已出的保留并结算，剩余退回 |
| `DRAMA_CANVAS_RUN_TIMEOUT` | 全部 | 心跳超时被回收器判死；已退回 |
| `DRAMA_CANVAS_RUN_FAILED` | 全部 | 没归类的失败；已退回 |
| `DRAMA_CANVAS_CREDIT_SETTLE_FAILED` | 全部 | 结算（commitHold）失败 |
| `DRAMA_CANVAS_RUN_KIND_UNSUPPORTED` | 全部 | 运行记录的 kind 不认识（不应出现） |
| `AI_CALL_FAILED` | script / extract / storyboard | 模型调用失败，或 JSON 输出形状不对（不拿模板句冒充）；已退回 |
| `IMAGE_CALL_FAILED` | image | 图像模型调用失败；失败的张数退回 |
| `IMAGE_BAD_OUTPUT` | image | 上游回的不是可用图片，不入库不扣款 |
| `IMAGE_STORE_FAILED` | image | 图没存进我方存储，不扣款 |
| `IMAGE_SIZE_UNSUPPORTED` | image | v0.198.1：出图端点只认固定尺寸（厂商 400「size must match preset (W×H)」），比例与所选画幅不一致；比例一致时服务端已按固定尺寸重试过一次。进程内记住每个端点的固定尺寸，之后比例不对直接报、不再调上游；不扣款 |
| `VIDEO_GENERATION_FAILED` | video | 厂商返回失败；已退回 |
| `VIDEO_MIRROR_FAILED` | video | 提交时带了 `require_mirror`，成片没镜像进我方存储；视频 worker 已判失败并退款 |
| `DRAMA_CANVAS_VIDEO_QUEUE_TIMEOUT` | video | 排队 30 分钟一直没交给厂商；已退回 |
| `DRAMA_CANVAS_VIDEO_JOB_MISSING` | video | 底层视频任务找不到了 |
| `DRAMA_CANVAS_VIDEO_RECORD_FAILED` | video | 成片已有平台 key，但登记到用户名下时出错；**可重试**（GET runs 与回收器的对账恢复会再捡起来） |
| `DRAMA_CANVAS_VIDEO_NOT_STORED` | video | 成片没有平台 key（只有厂商临时地址），**不可恢复** |
| `DRAMA_ASSEMBLE_FAILED` / `DRAMA_ASSEMBLE_BAD_CLIP` / `DRAMA_CANVAS_NOTHING_TO_ASSEMBLE` | assemble | 拼接或质量门失败 / 某段视频不可用 / 没有可合成的片段（合成免费，无钱可退） |
| 其余 | — | 沿用抛出方 `BusinessException` 的错误码 |

### 6.8 视频生成区（web-celebrity「AI 创作 → 视频生成」，v0.199 / 设计真源 `docs/video-studio-plan.md` · TS 真源 `packages/types/src/video-studio.ts`）

领域 `com.aistareco.aep.videostudio.*`，挂 `/api/me/celebrity/video-studio/**`：登录必需（`/api/me/**`），开通闸按
`/api/me/celebrity/**` → celebrity（不新增产品码）；未绑手机号的账号发 POST 由 `PhoneVerificationGuard` 挡成 403。
把 MiniMax H3（聚算 JusuanHub）的四种原生模式原样开放，**不做产品化封装**：没有脚本、不绑商品。二版（同 v0.199，
用户第二轮要求）加了：后台可配的计价、可选的「智能优化」、成片存为模板 / 做同款（见下面三节）。新表
`video_studio_prompt_optimization` / `video_studio_template` 由 **V37** 建（编号横跨 SQL 与 Java 两个迁移目录）。

**复用通用视频链，不新建表。** 提交走 `MaterialVideoJobService.submit(body, uid, "video-studio")`：冻结 → 落
`material_video_job` → `afterCommit` 派发 worker → 轮询 → 成片镜像 OSS → 成功扣 / 失败退。分区 `video-studio`
（`APP_VIDEO_STUDIO`）的任务不会出现在素材运营、短剧、画布的任何列表里。`kind` = `studio-t2v` / `studio-i2v` /
`studio-flf` / `studio-ref`，`name` = 「<模式中文名> · <清晰度> · <比例> · <秒数> 秒」。

**厂商合同只写在 `JusuanH3Contract` 一处**，前端从 `GET …/models` 的 `contract` 拿，不写死：

- 清晰度 `768p` / `544p`，每档六种固定画布（21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16，像素见 `JusuanH3Contract`）；
  朝向由画布宽高定（宽 > 高 landscape、相等 **square**、宽 < 高 portrait），尺寸编码 `h3-<768|544>-<W>x<H>`。
  1:1 的 `square` 取自 Portal 调用示例、公开文档只列了 landscape / portrait，**未实测**；上游拒收时厂商原话直接显示。
- 时长：整数秒，有效区间 = 5..15 ∩ 候选 `maxDurationSec`；区间为空的模型不出现在列表里。
- 提示词：去首尾空白（含不换行空格 / BOM）后 1..7000 个 Unicode 字符（按 code point 数，表情符号算 1 个）。
- 随机种子：可选整数 0..2147483647，不传 = 随机。

**计价（二版：我们自己定、后台可配，不照搬厂商价格；服务端一处算，前端照着显示，报价与冻结同源）。**
一版按厂商价格结构等比换算（544p 减半、第 7 张图起加 ¼）的做法已经撤掉。

- 配置：平台配置 key `celebrity.video-studio-pricing`（形状 = `VideoStudioPricingConfig`），后台「明星带货 → 引擎定价 →
  视频生成」编辑，`GET / PUT /api/admin/celebrity/video-studio-pricing`（角色同 `action-pricing`：`/api/admin/**` 的
  SUPER_ADMIN / OPERATOR / FINANCE_ADMIN）。整份替换，60 秒缓存在保存时立即失效。首次启动写入全 null / 0
  （= 生成按模型单价、不加价、智能优化不收费）。
- 每一格（模式 × 清晰度）的每秒价 = **配置那一格 ?? 这个模型的每秒价**（候选 `creditCostOverride` 且端点 `PER_SECOND`，
  即 `videoBillingUnit` = `per_second`）**?? 未定价**。未定价的格子下发给用户是显式 null：前端不报价、不许提交；
  服务端提交 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`（冻结之前），**不回落任何写死的价**（§8.0）。
  不再有「按条计价」分支；合成的默认项没有候选行、没有模型每秒价，只认配置的格子。
- 生成总价 = (每秒价 + max(0, 参考图张数 − `freeRefImages`) × `extraRefImagePerSecond`) × 秒数，只有全能参考算图片张数；
  `Math.multiplyExact`，溢出 → 400 `VIDEO_PRICE_OVERFLOW`。算好的总价以 `credit_cost` 交给 `MaterialVideoJobService.submit`
  冻结，`credit_label = "视频生成"`；**提交请求体没有任何价格字段**，客户端传什么都不读。
- 智能优化每次 `promptOptimizationPerCall`（0 = 不收费），与生成分开冻结 / 扣除。
- 后台保存校验：格子 null 或 1..100000，`freeRefImages` 0..9，`extraRefImagePerSecond` / `promptOptimizationPerCall`
  0..100000，标量必填，模式 / 清晰度必须认识，否则 400 `VIDEO_STUDIO_PRICING_INVALID`。
- **库里的配置读不出来（手工改坏 JSON、值越界）一律 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`，不回落默认值**：
  默认值是「不加价、优化免费」，悄悄回落等于把运营定的价改成白送。与 `CelebrityActionPricingService`（读失败回落默认）
  刻意不同。库里不认识的模式 / 清晰度忽略（以后删了一个模式，旧配置不至于让整个区停摆）。后台重新 PUT 一份即可恢复。

**校验顺序固定，全部在冻结之前**：模型 → 模式 → 提示词 → 清晰度 / 比例 / 时长 → 种子 → 该模式的素材 →
素材归属与类型（做同款时含模板素材）→ 智能优化结果（带了 `optimizationId` 时）→ 价格。提交生成与智能优化**共用同一个
校验器**（`VideoStudioService.validate`，同一套错误码；优化不带种子）。模型必须在本区列表里（启用候选 × 启用端点 × 有 baseUrl 与 Key × 聚算媒体协议；列表为空时，
**只有默认绑定端点根本没有候选行**才合成一条 `selectableById=false`（价格只认配置）。候选行在、只是被停用 → 不合成、
不列出：那是运营有意下线，合成等于绕过停用）；省略 `endpointId` = 默认那一条；合成项带了 `endpointId` → 400。
能按编号选的模型会把 `endpoint_id` 写进任务（报价用的是这个候选的单价，worker 必须跑在它上面）。

**每种模式要的素材**（不匹配 → 400 `VIDEO_STUDIO_INPUT_INVALID`，文案说清是哪一条）：

| 模式 | 首帧 | 尾帧 | 参考素材 |
|---|---|---|---|
| `t2v` 文生视频 | 不传 | 不传 | 不传 |
| `i2v` 首帧生视频 | 必传（图，≤16MB） | 不传 | 不传 |
| `first_last_frame_video` 首尾帧生视频 | 必传（图，≤16MB） | 必传（图，≤16MB） | 不传 |
| `universal_reference_video` 全能参考 | 不传 | 不传 | 1..12 项：图 ≤9（**有视频时 ≤8**）、视频 ≤1、音频 ≤3；图 + 视频 ≥1；同一个 key 不能出现两次；音频加起来 ≤15 秒 |

参考素材按客户端给的顺序落库与发给厂商；同类按出现顺序编号（图1、图2…、视频1、音频1…），任务卡、提交报错、
worker 传素材失败的报错用的是同一套编号（`VideoGenSpec.referenceLabels`）。首帧与尾帧**可以**是同一张图
（首尾一致的循环镜头），不许重复只针对参考素材。音频合计：单段已在上传时验过 2..15 秒，所以只有两段以上时才重新
ffprobe 求和（读不出 → 400 `VIDEO_STUDIO_ASSET_INVALID`）。

**归属闸。** 每个 key 必须以 `video-studio-<声明类型>/<本人 uid>/` 开头（前缀由 `FileStorageService.ownedKeyPrefix`
按存储层自己的 sanitize 规则派生，不手拼）、前缀后面只有文件名、不含 `..` 与反斜杠；首帧 / 尾帧只能是 image 分类。
否则 400 `VIDEO_STUDIO_ASSET_INVALID`。**key 里的分类就是上传时验过的类型**，提交时据此判类型。

**分区闸（`MaterialVideoJobService.submit` 的规划阶段，冻结之前）。** `variant_config` 里的原生规格
（`generation_mode` / `resolution_tier` / `seed` / `last_frame_key` / `reference_inputs`）只许 `video-studio` 分区带；
`first_frame_key` 只许 `ipstudio`、`video-studio` 与 `drama` 分区带（三处的 variant_config 都由服务端组装，写 key 前验过归属；短剧见 2026-09-30 首帧热修的 `DRAMA_FRAME_NOT_OWNED`）。其它分区（带货素材运营会透传客户端的 variant_config）出现 → 400 `VIDEO_MODE_UNSUPPORTED`。
原因：素材运营的 `POST /api/material/videos/generate` 把客户端的 `variant_config` 原样透传，不挡住就是按带货单价
开出原生能力（多张参考图的厂商加价没人付），或拿不属于自己的 key 出片。

**上传（`POST …/uploads`，multipart `file` + `mediaType`）。** 顺序：`mediaType` ∈ image / video / audio（否则
`VIDEO_STUDIO_FORMAT_UNSUPPORTED`）→ 空（`VIDEO_STUDIO_FILE_EMPTY`）→ 超该类上限：图 30MB / 视频 50MB / 音频 15MB
（`VIDEO_STUDIO_FILE_TOO_LARGE`，文案带 MB）→ **按字节**判格式（`MediaBytes.sniff`；图 PNG / JPEG / WEBP，视频 MP4
即 `ftyp` 且品牌不是 `qt  `，音频 WAV / MP3 / FLAC / OGG / AAC(ADTS) / M4A / MOV；后缀用判出来的）→ 音视频写临时文件过
`FfmpegRunner.probeMedia`、用完即删（读不出 / 视频没画面 / 音频没声音 → `VIDEO_STUDIO_MEDIA_UNREADABLE`，音频不在
2..15 秒 → `VIDEO_STUDIO_AUDIO_DURATION_INVALID`）→ `StorageQuotaService.checkQuota("celebrity", …)`（402
`STORAGE_QUOTA_EXCEEDED`）→ `FileStorageService.store(bytes, "video-studio-<mediaType>", uid, ext, mime)` →
`record("celebrity", uid, "视频生成素材", null, key, bytes)`。图片像素只读文件头，不整图解码；读不到（WEBP）为 null。

**worker 与模型客户端。**

- `VideoGenSpec.fromVariantConfigJson` 是 worker 唯一的解析入口，解析失败 = 空规格（= 老路径的纯文生视频）；
  `MaterialVideoModelClient.submit` 的最后一个参数就是它，不留只带首帧 key 的旧重载。
- 聚算 + 完整原生规格：素材先 `POST {base}/v1/assets/input?model=<别名>` 逐个换 assetId（multipart 字段名 =
  `image` / `video` / `audio`，Content-Type 与文件名后缀按字节判；上限帧图 16MB、参考图 30MB、视频 50MB、音频 15MB），
  再按 Portal 示例的字段集与顺序组包：`model, generationMode, prompt, resolutionTier, orientation, aspectRatio,
  outputSizeCode, seconds, [seed], [input_image_asset_id], [end_image_asset_id], [referenceInputs[{role, mediaType, assetId}]]`。
  不传 fps / frames / width / height / steps。
- 老路径（没有清晰度：画布、脚本视频、短剧）组出来的聚算请求体与改动前逐字段一致。
- 非聚算协议（seedance / agnes / 通用）收到任何原生参数 → 400 `VIDEO_MODE_UNSUPPORTED`，不静默丢；只带首帧 key 时，
  key 换成厂商自己去抓的 URL（`FileStorageService.upstreamFetchUrl`：**先签名 URL**，签不出来才退公开 URL。
  `publicUrl` 只是拼域名、不管桶能不能匿名读，生产默认按 OSS 签名出 wire，私有桶下未签名地址是 403；
  短剧交给 seedance 的首尾帧一直是签名地址），放进该协议的首帧位
  （seedance `content[role=first_frame]`、agnes / 通用 `image`），**优先于** prompt 里的首帧标记；换出来的不是绝对
  http(s) 地址 → `VIDEO_REF_UNREADABLE`，不假装传了图。只带标记的短剧请求逐字节不变。
- 上游拒绝：创建或素材上传非 2xx 一律 `log.warn` 带响应体；4xx 的任务失败原因 = 「视频模型拒绝了这次请求：<厂商原话>」
  （素材上传：「<编号>被上游拒收：<厂商原话>」，≤200 字，Bearer 凭据与 32 位以上的长串脱敏），5xx 只给状态码，
  响应体不是 JSON 时不外泄。轮询到 failed 时失败原因先读说人话的字段（含 `error.message` 对象形态、`errorMessage`），
  都没有才退到 `errorCode`。**给用户看的失败原因不带内部字段**（任务号、上游状态码只进日志）：
  「视频生成失败：<原因>」/「视频生成失败，模型没有给出原因」/「视频生成超时，等了 N 分钟还没有出结果」/
  「视频模型报告已完成，但没有交回成片」/「成片已经生成，但平台存储还没配置好，暂时取不回来，请联系运营」。
  这几句所有用通用视频链的产品线共用。
- **管理端对账恢复**（`MaterialVideoWorker.reconcileSucceeded`）：提交时 item 带了 `credit_cost`（调用方自己定价：
  本区、短剧）的任务在 payload 里标 `caller_priced=true`，对账按**冻结价**结算；没有这个标记的沿用 v0.131：
  按端点当前每秒价重算（那一版为补收计费规则上线前按每条 30 冻结的老任务）。HTTP 入口已剥掉 `credit_cost`，
  外部请求建出来的任务永远没有这个标记。
- 账本文案用提交时的 `credit_label`（冻结 / 扣除 / 退回三笔同一个说法；此前 worker 写死「带货视频生成」）；
  存储用量分类：`studio-*` 成片记「视频生成」。

**智能优化（`POST / GET …/prompt-optimizations`，docs/video-studio-plan.md §9）。** 厂商
`POST {base}/media/prompt-optimizations` 是同步接口，但最长要等十分钟上下，所以做成后台任务：

- 发起：`clientRequestId` 必须是 8–128 个可见 ASCII（否则 400 `VIDEO_STUDIO_REQUEST_ID_INVALID`，先于一切校验）；
  同一用户同一 `clientRequestId` 已有记录 → 原样返回，不再校验、不再冻结。校验同提交生成（见上，不看种子）。
  价格 = `promptOptimizationPerCall`，> 0 才 `CreditService.hold`（refType `video_studio_prompt_optimization`，refId = 记录 id）。
  **同一事务里先插行（立刻 flush，占住 `UNIQUE(owner_user_id, client_request_id)`）再冻结**：并发的同一串卡在自己的插入上，
  等先到的那条提交后撞唯一键（InnoDB 与 H2 都是等对方提交才判重复），这边整个回滚、什么都没冻，读回先到的那条 ——
  余额只够一次时两边也拿到同一条记录，不会一边 402。余额不足 402：刚插的行随同一事务回滚，什么都不落（同一个串充值后还能用）。
  落 `queued`，派发挂在 `afterCommit`；线程池（`videoStudioOptimizationExecutor`，与出片池分开）排满 → 经下面的结算
  当场判失败并退冻结。返回的是提交之后重读的那一份（排满时就是 failed + 原因）。
- 执行：worker 先条件更新 queued → running（抢不到就不做）→ 素材照生成那套 `uploadInputAsset` 上传（字段名、按字节判类型、
  大小上限、编号文案都一样）→ 按 Portal 示例组包：`clientRequestId, model, generationMode, originalPrompt,
  mediaSpec{resolutionTier, orientation, aspectRatio, seconds, outputSizeCode}, referenceInputs[{role, assetId}]`
  （**不带 mediaType**；role：首帧生视频 `first_frame`，首尾帧 `first_frame` + `last_frame`，全能参考
  `reference_image|reference_video|reference_audio` 同生成的顺序，文生视频给空数组），有音频参考时加
  `audioReferencePolicy: "preserve_without_understanding"`。`Idempotency-Key` = body 的 `clientRequestId` = **我们的记录 id**。
- 重发：409（还在处理）/ 429 / 5xx / 超时 / 网络错误 → **同一正文同一键**重发（素材只传一次），优先听 `Retry-After`，
  否则 5 秒起指数退避（封顶 60 秒），总预算 12 分钟；每次调用的读超时 = min(630 秒, 剩余预算)。其它 4xx → 失败原因
  「智能优化被拒：<厂商原话>」（与生成同一个厂商原话解析 `vendorMessage`，≤200 字、脱敏、非 JSON 不外泄）；2xx 但没有
  `optimizedPrompt` → 失败；预算用完 → 「智能优化超时，积分已退回」（没收钱则「智能优化超时，请重新优化」）。
  请求体与响应体都进日志（§8.0.1 ①）。优化调用不记进「视频生成」的按秒用量表。
- 结算：**改状态和扣 / 退在同一个短事务里**（`VideoStudioOptimizationSettlement`，`REQUIRES_NEW`）。running → succeeded、
  queued / running → failed 都是条件更新，返回 1 才在同一事务里 `commitHold` / `releaseHold`，返回 0（别人先改了）什么都不动。
  扣 / 退抛异常 → 整个回滚：记录保持原状态、冻结原样，调用方记 WARN（带 id），留给兜底回收。**不吞异常** —— 吞了就会出现
  「成功了却没扣钱」或「显示已退回却还冻着」，而记录已是终态，回收再也看不见它。`REQUIRES_NEW` 是给排满时的判失败用的：
  它发生在 afterCommit 回调里，那时上一个事务已提交、资源还绑在线程上，`REQUIRED` 会加入那个已结束的事务，写了等于没写。
  兜底回收（`@Scheduled` 每 5 分钟）把 `updated_at` 超过 20 分钟仍 queued / running 的判失败并退冻结，走结算的 `failIfStale`：
  条件更新里**再带一次同一个 cutoff**（`updated_at < cutoff`）—— 回收先列出卡住的记录再逐条结算，中间 worker 可能刚把某一条
  领走（`claimRunning` 刷新了 updated_at，正在调厂商），那一条不再卡住，不能判失败（否则退了钱、厂商结果回来只能作废）。
  与 worker 同时到场时只有一方动这笔钱，某一条结算回滚就跳过、下一轮再试。20 分钟大于 12 分钟预算（从上传素材之前算起），
  活着的 worker 一定先结束。
- 查询：本人才看得到，否则 404 `VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND`；优化结果只在 succeeded 时给，失败原因只在 failed 时给。
- 用结果生成：生成请求带 `optimizationId` → 必须是本人的、succeeded 的，否则 400 `VIDEO_STUDIO_OPTIMIZATION_INVALID`；
  不要求模式 / 规格与优化时一致。送去生成的仍是请求里的最终文本（可能是用户改过的优化结果，不传厂商的 optimizationId）；
  任务的 `variant_config` 记 `optimization_id` + `original_prompt`（worker 不读），`VideoStudioJob.originalPrompt` 由此出 wire。

**模板 / 做同款（`…/templates`，docs/video-studio-plan.md §10）。**

- 存模板：任务必须是本人的、本区的、成功的；标题去空白后 1–40 字、说明 ≤200 字，否则 400 `VIDEO_STUDIO_TEMPLATE_INVALID`。
  `official=true` 需要运营（`aep_users.operatorRole` ∈ operator / super_admin 且账号 ACTIVE，**服务端查库**，
  `InAppOperatorGuard.isOperatorUserId`），否则 403 `VIDEO_STUDIO_TEMPLATE_FORBIDDEN`。
- 配方（`recipe_json`）只拷「怎么做」：模式、最终提示词、清晰度、比例、秒数、种子、模型（endpointId + 展示名）、
  素材（role / mediaType / key / label）。**不拷运行痕迹**（任务状态、错误、积分、外部任务号、优化记录；§8.0.1 ⑪）。
  素材不复制文件，直接引用原作的 key；成片 / 封面存 key（`FileStorageService.keyOfStoredUrl`），出 wire 现签。
- 可见性：在架（active）且（官方，或本人的）。列表 = 在架官方 + 本人在架的，新 → 旧最多 100 条，每条带 `mine`；
  查单条看不到 → 404 `VIDEO_STUDIO_TEMPLATE_NOT_FOUND`。
- 下架（`DELETE`，软删为 withdrawn，回 204）：本人的本人可删；官方的本人或任一运营可撤回；其它一律 404（不暴露存在与否）。
- **做同款的归属闸**：生成 / 优化请求带 `templateId` 时模板必须可见（否则 404 `VIDEO_STUDIO_TEMPLATE_NOT_FOUND`）；每个素材
  key 要么是本人上传的同类素材（原规则），要么是**这个**模板的素材且类型一致（模板里的图不能当音频用）；其它一律 400
  `VIDEO_STUDIO_ASSET_INVALID`。任务 `variant_config` 记 `template_id`，成功建出任务时模板 `use_count + 1`
  （单条 UPDATE 自增，与建任务同一事务）。计费与普通生成完全一样，智能优化照常可选。

**出 wire（`VideoStudioJob`）。** 状态 `queued` → queued、`submitting` / `generating` → running、`succeeded`、`failed`；
进度文案与 `MaterialVideoJobService.stageLabel` 同一套；`inputs` 从 `variant_config` 里的 key 出 wire 时现签（库里不存 URL）；
成片 / 封面经 `CdnUrlSigner.maybeSign`；`credits = creditsHeld`（进行中 = 冻结，成功 = 扣除，失败 = 已退回）；
宽高按合同查；`modelName = providerUsed ?? modelUsed`；失败原因只在 failed 时给；`originalPrompt` / `templateId` 来自
`variant_config`（没优化 / 不是做同款为 null）；时间是 ISO 8601。
列表新 → 旧最多 100 条；查单条不是本人或不是本区 → 404。所有 `T | null` 字段出 wire 为显式 null
（包括计价表 `perSecond` 里未定价的格子：那两个 Map 字段单独标了 content = ALWAYS，全局 non_null 吞不掉）。

**封面（v0.199.1）。** 厂商不给封面（聚算 H3 就不给）、或给了但没存下来时，worker 在镜像成片那一步从本机成片 0.5 秒处截一帧
（宽不超过 720、不放大；截不到就退回第 0 秒再截一次，每次 30 秒超时，超时了不再重试），
存 `material-videos/<jobId>/thumbnail.jpg`（和镜像厂商封面放在同一处，厂商的按原扩展名存），
所有分区的新任务都这样。best-effort：截不出来不影响出片与结算，只打 WARN。视频生成区（`kind=studio-*`）已成功但没封面的老任务，
服务启动后在后台补（每次最多 50 条，条件更新只写封面与更新时间、不整行保存；`aep.material.video.cover-backfill.enabled`，
dev 关）；别的分区的老任务不补。
模板的封面是存模板那一刻从任务拷过去的 key，之后不跟着变。

**错误码表**

| code | HTTP | 场景 |
|---|---|---|
| `VIDEO_STUDIO_MODEL_UNSUPPORTED` | 400 | 所选端点不在本区模型列表里；合成的默认项却带了 `endpointId`；省略 `endpointId` 但列表里没有默认项 |
| `VIDEO_STUDIO_MODE_INVALID` | 400 | 模式不是四种之一 |
| `VIDEO_STUDIO_PROMPT_REQUIRED` | 400 | 提示词去空白后为空 |
| `VIDEO_STUDIO_PROMPT_TOO_LONG` | 400 | 超过 7000 个字符 |
| `VIDEO_STUDIO_SPEC_INVALID` | 400 | 清晰度 / 比例不在合同内，时长缺失或越界，种子越界 |
| `VIDEO_STUDIO_INPUT_INVALID` | 400 | 素材与模式不匹配（缺首帧、文生视频带了素材、超数量、无视觉素材、重复、音频合计超 15 秒…） |
| `VIDEO_STUDIO_ASSET_INVALID` | 400 | key 不是本人在本区上传的、类型对不上、含 `..`；参考音频读不出来 |
| `VIDEO_STUDIO_FILE_EMPTY` / `VIDEO_STUDIO_FILE_TOO_LARGE` / `VIDEO_STUDIO_FORMAT_UNSUPPORTED` | 400 | 上传：空文件 / 超大小 / 按字节判不是允许的格式（或 mediaType 不对） |
| `VIDEO_STUDIO_MEDIA_UNREADABLE` | 400 | 上传：ffprobe 读不出，或视频没画面、音频没声音 |
| `VIDEO_STUDIO_AUDIO_DURATION_INVALID` | 400 | 上传：单段音频不在 2–15 秒 |
| `VIDEO_STUDIO_JOB_NOT_FOUND` | 404 | 查任务：不存在 / 不是本人 / 不是本区 |
| `VIDEO_STUDIO_SUBMIT_FAILED` | 500 | 任务受理后读不回落库行（不应发生） |
| `VIDEO_STUDIO_PRICE_NOT_CONFIGURED` | 503 | 所选模式 × 清晰度没定价（配置空着、模型也没每秒价）；或库里的计价配置读不出来。文案指向后台「引擎定价 → 视频生成」 |
| `VIDEO_STUDIO_PRICING_INVALID` | 400 | 后台保存定价：格子不在 1..100000、加价 / 免费张数 / 优化单价越界或缺、模式或清晰度不认识 |
| `VIDEO_STUDIO_REQUEST_ID_INVALID` | 400 | 智能优化的 clientRequestId 不是 8–128 个可见 ASCII |
| `VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND` | 404 | 查优化记录：不存在 / 不是本人 |
| `VIDEO_STUDIO_OPTIMIZATION_INVALID` | 400 | 生成时带的 optimizationId 不是本人的或还没成功 |
| `VIDEO_STUDIO_TEMPLATE_NOT_FOUND` | 404 | 模板不存在 / 已下架 / 不是官方也不是本人的（查询、下架、做同款时带的 templateId） |
| `VIDEO_STUDIO_TEMPLATE_FORBIDDEN` | 403 | 不是运营却要发布官方模板 |
| `VIDEO_STUDIO_TEMPLATE_INVALID` | 400 | 存模板：任务不是本人的 / 不是本区的 / 没成功；标题或说明长度不对 |
| `VIDEO_STUDIO_OPTIMIZATION_REJECTED` / `VIDEO_STUDIO_OPTIMIZATION_TIMEOUT` / `VIDEO_STUDIO_OPTIMIZATION_FAILED` | —（落在优化记录上） | 厂商 4xx（带原话）/ 重试预算用完 / 2xx 但没有优化结果；已退回冻结 |
| `VIDEO_MODE_UNSUPPORTED` | 400 | 非聚算协议收到原生参数；`video-studio` 以外的分区带了原生规格；`ipstudio` / `video-studio` / `drama` 以外的分区带了首帧 key |
| `VIDEO_REF_UNREADABLE` / `VIDEO_REF_TOO_LARGE` / `VIDEO_REF_FORMAT_UNSUPPORTED` / `VIDEO_REF_UPLOAD_FAILED` | —（落在任务上） | worker 把素材交给厂商前后失败；已退回冻结 |
| `VIDEO_SUBMIT_FAILED` | —（落在任务上） | 创建被拒：4xx 带厂商原话，5xx 只给状态码；已退回冻结 |
| 复用 | 503 `VIDEO_NOT_CONFIGURED`（一个可用模型都没有）/ `ENDPOINT_NOT_ALLOWED`、402 `PAYMENT_REQUIRED`、402 `STORAGE_QUOTA_EXCEEDED`、400 `VIDEO_PRICE_OVERFLOW` |

```
packages/types/src/*.ts              ← 唯一前端真值源
apps/web-*/src/api/*.ts              ← 调用契约（USE_MOCK 切换 mocks/ vs apiFetch）
specs/openapi.yaml                   ← 后端接口契约（99 个 path、200+ schema）
specs/BUSINESS_RULES.md              ← 本文件：openapi 表达不了的业务约束
apps/server/.../*Dto.java            ← Java 镜像，字段名必须与 TS interface 完全相同
apps/server/.../*Controller.java     ← 最终路由实现（44 个 controller）
scripts/check-api-contract.mjs ← CI 漂移校验（apiFetch URLs ↔ openapi.yaml paths）
```

> CLAUDE.md 第一条硬规则：「Frontend types are the single source of truth」。
> 任何 server DTO / openapi schema 与 TS types 冲突时，以 TS types 为准。

*文档结束 — v2.0.0*


### Studio 固定音色配音（v0.202 增量，2026-10-08）

- `speech-runs` 复用 IpRun，不另建任务；项目归属/同键指纹、DAP_AUDIO 白名单、当前开放 speaker、600字/160字上限与明确单次 price + maxCost 都在 hold 前检查。
- 同键同内容返回原运行，同键改内容 409；平台单次积分与供应商按音频秒成本分开。派发 afterCommit，原 Job 与原正文持久化，Idempotency-Key=runId；已受理不再创建，网络超时不自动当失败退款。active 音频 hold 由 durable worker 拥有。
- 供应商 URL 先验同主机、正确资源路径和 model 作用域后携同 Key 下载，真实音频探测后转存 key；signed URL 不落库，浏览器无厂商 Key。
- `packaging.voiceoverStorageKey` 只能合成使用本人音频，替换原轨。音频长于视频拒绝 STUDIO_SPEECH_TOO_LONG，不裁掉台词，不冒称口型同步。预设声音与个人克隆/人物驱动保持独立状态。


### Studio 同音频口型同步（v0.202 增量，2026-10-08）

- `/studio/lip-sync-catalog`、`projects/{id}/lip-sync-quote`、`lip-sync-runs`、`lip-sync-runs/{runId}/extract` 均属 aiavatar。本人项目/精确素材 key/真实 ffprobe 检查先于 hold；quote 不调供应商、不冻结。独立 DAP_LIP_SYNC 用途与 V42，明确每秒价×ceil(实际音频秒)，maxCost 上涨 409，零新增冻结。
- 同键同输入返回同一 IpRun；视频/音频 native assetId 分别 checkpoint，原生正文只有 model/input_video_asset_id/input_audio_asset_id；Idempotency-Key=IpRun.id。已受理只能查保存的原 Job；网络未知保留原键与冻结，不能另开任务误报退款。下载保留 model=x-dub，转存我方后同事务单次结算；原任务明确失败释放原冻结。
- 口型视频另存，采用前检查；图片定稿不表示人脸/训练/驱动可用。videoLipSyncReady 只表示配置了可用视频口型模型。X-Dub 对照输出免费提取，仅在宽高比与左侧像素匹配源片后取右侧；未知布局保留原结果并报错。comparisonStorageKey 保留原件，读取重签 comparisonUrl；lipSyncNormalized 让同任务重复整理幂等，不改输入、费用、身份或账本。合成时保留该片段音轨，替换音轨不会重新匹配口型。
- 当前真实证据为 3.52 秒口型短样片与 3.540998 秒中文商品成片，不推定长口播、克隆或全 M5 通过。代码/新用途尚未发布，生产售价须在发布后明确配置。

### Studio 人物固定声音版本（v0.202 / V43，未发布）

- 声音库存仍是 DapVoice。preset/qwen3-tts 表示官方预设，engineTrainedAt 留空；profileVersion 不可变，删除版本也不复用序号。DapAvatar.voiceId 是明确默认，不能以名称猜版本。
- 采纳必须来自本人当前项目 done 的 studio-audio，音色/风格/真实试听从服务端源任务取得，保存和切换不收费、不调用模型。人物行锁与 expectedVoiceId 防止并发覆盖，avatar_id+source_run_id 唯一。采纳原请求重放不改变后来的默认。
- 配音带 voiceId 必须同时指定所属 avatarId，且为本人同人物就绪版本，speaker/instruct 须匹配。历史版本可用；当前默认变化不改变保存的 appliedVoice、原生请求、原 Job 与作品。临时固定音色不写人物默认。
- 老请求没有新增绑定时沿用旧指纹；已受理同键重放不再次预检/冻结。成功时声音项目使用记录与终态/积分结算在同一事务中，只记录一次。签名 URL 不落声音资产或画布声音快照。

### Studio 模板版本（v0.203，未发布）

- IpDemoTemplate 可见范围 personal 仅作者可读/发布/上下架；official 发布必须 SUPER_ADMIN。旧目录/官方内容管理不得泄露个人模板。启用中的官方与自己的个人模板共享 IpTemplateResolver；停用的个人模板仅作者可管理，不可新套用。
- IpTemplateVersion 为 append-only（唯一 template_id + version_no），发布新版本锁模板行；版本标题/配方/doc 不覆盖。Project.templateVersionId 与服务器创建输入/node map/plan 快照独立于客户端 doc。旧项目读取不依赖当前目录启用状态或当前模型配置。
- 配方首期仅图片步骤：最多 12 输入、20 步骤；input/step 稳定编号唯一、声明先后依赖无环、图片引用最多 4 个，未绑定外部图片依赖拒绝；文字变量只引用声明的文本/选项输入。图片/IP 输入需本人真实图片，avatar/IP/look/version/key 必须匹配。发布按白名单重建节点与连线，不共享作者 Key、素材、运行、批准、对话或采用身份。
- 计划复用 IpRunService 的 compileExplicit/preflight 与真实平台图片单价，不持有厂商 Key，不冻结或调用供应商。套用仅创建独立项目，重建节点/连线标识、锁当前版本；目录新发布会使旧新建请求返回 STUDIO_TEMPLATE_VERSION_CHANGED，停用返回 STUDIO_TEMPLATE_NOT_FOUND；已有实例仍读取原版本与创建时计划。
- 旧 publish-as-demo 不能覆盖已版本化/个人模板，旧删除不能删除不可变发布历史。生成继续使用原生 IpRun/账本。本版本的采用确认与依赖是计划定义，受控模板执行尚未完成，不把准备画布/报价标为资产包生成成功。

### Studio 图片模板执行与人物设定图（v0.204，未发布）

- 发布配方新增 `sheet` 输出语义，默认人物设定图只有一个图片步骤，一次一张报价；画内多视角/表情/细节不展开额外生成任务。是否实际合格由用户检查，不能用模型done或多个单图拼板证明一次成图成功。
- 执行引用从实例输入及当前前序原生结果编译；前序未生成/未通过声明的采用点、价格超过maxCost、引擎/提示词不可用均在hold前拒绝。同clientRequestId/正文/步骤返回原runId；正文改变拒绝，正在受理不能新键重发；替换须对当前runId显式CAS。
- 本次可修改prompt但不改发布版本、模型引用和依赖。上游采用或输出变化时下游为stale，保留历史，用户另行确认才重做。节点结果只由客户端投影到doc，服务端不异步改写客户端文档。
- 非main图片归档必须指定人物并使用look意图，不能静默替换主形象；sheet整图可关联人物参考，未成为训练完成的数字人。IP/图片版本和所有key验归属，仍复用原生采用幂等。
- 原图ZIP、manifest和中文展示板仅接受已采用且来源有效的输出，不调用模型/不扣积分，部分选择必须complete=false并显示n/requiredCount；同内容/来源/采用返回原包，来源变化产生新包而保留旧包。存储key是持久真值，URL按读取签发，不将临时URL进manifest。
- 版本统计只汇总请求人自己的未删除实例，成本来自原始IpRun终态实际cost与running冻结额，包含被替换的历史生成；首轮采用只算该步骤一次尝试；人工采用且所有步骤done才是completedInstances。未实现全平台统计、自动质量判定及任意多模态模板执行。

### Studio IP 人物库（v0.205 / V45，未发布）

- 人物卡按 avatarId 汇总，主形象、历史版本与造型仍使用原有 DapAvatar/DapLook，不复制身份。同 key 的当前主图镜像不重复展示。characterName 与素材名分别保留，人物属性只投影既有 def 中的文本。
- DapLook.assetRole 可空，旧素材默认为 look；sheet/portrait/three-view/front/side/back/expression/detail/look 由明确归档或用户免费分类，不按图片内容/名称推断。main/history 按真实人物版本派生。
- PUT performers/{avatarId}/looks/{lookId}/role 锁本人角色并核验造型 owner/avatar、完成状态及有效 key，只改类别，不调模型、不扣积分、不替换主图。无归属不能整理。归档请求缺 assetRole 时剔除此空字段后使用旧指纹，同请求恢复原结果。
- 添加到画布保存精确 ipId/avatarId/version/lookId/storageKey 和用户选用的默认声音版本；试听短期 URL 不进文档。保存失败重试原节点，不新增重复引用。模板结果进入画布即恢复，面板是否打开不影响原任务推进。
- 用户明确本轮以功能和交互验收，模型画质不作为通过条件。采用仍为用户显式选择而非系统自动质量评分；原图/任务/计费证据保留，不为视觉效果自动重试。


### Studio 原生视频模式（v0.208，本地）

`RunRequest.video` 与画布 `IpVideoRequest.video` 是类型化输入，不透传 `variant_config`。仅 `GET /v1/ip-studio/studio/video-models` 下发的支持模型可用。复用 `VideoStudioService` 的模式、规格、组合限制和定价，素材归属使用 `IpProjectService.requireOwnedAssetKey`，随后按实际字节/ffprobe 验格式、大小及音频时长。服务端计算 `credit_cost` 后写入原 `MaterialVideoJob(ipstudio)`，`maxCost` 是用户确认的费用上限，涨价必须在提交/hold 前拒绝。客户端保留 storage key，签名 URL 只用于预览。原素材运营仍不得携带原生规格；旧视频请求保留单首帧兼容。此次未新增收费成片验收。


### Studio 视频特效描述库（v0.212）

- 独立 `ip_video_effect` 不可变发布与 `ip_video_effect_activity` 账号活动；不改已有模板配方、文档、生成任务或账本。官方广场只由超级管理员发布，个人特效仅本人可读/收藏/应用，作者从账号派生。
- 描述最多 8000 字，标签最多 8 个；适用模型只允许后台已配置 VIDEO_GENERATION 候选，空列表为通用自然语言描述。应用时再次校验所选模型，模型不适用/失效不得记录最近使用。
- 封面是本人拥有且字节验证为图片的 `storageKey`，短期 URL 仅出 wire；官方发布有意开放该封面的预览权限，个人库不能泄露其他账号封面。
- 收藏与最近使用彼此独立、按 owner 隔离；写前锁账号行，防并发首行创建和更新丢失。应用/收藏/发布均不创建任务、不计费；应用成功将完整描述插入提示词，可编辑、移除、复制和恢复。自然语言正文为生成真值，不伪装供应商原生特效参数或已验证效果。

### v0.215 · Studio 助手画面读取（本地，未发布）

`readVisuals` 默认false且仅assistant可用，后台明确声明当前端点model支持看图才可开启。引用按节点ID解析实际选中图片/视频key，存在/本人归属/最多16帧在冻结前检查；图1帧、视频4帧。worker读取图片（8MiB/2400万像素）或60秒内视频（128MiB）四个中点帧，JPEG长边768px，不读音轨；解码/时长拒绝释放原冻结。任务只存key与不可变读取快照，字节仅随实际请求发送，观测记录隐去媒体。后台拒绝按文字重放媒体请求，原客户端请求幂等仍返回原run。平台单次对话计价不变，不以模型回答正确性冒充完整媒体能力。

### Studio 故事文档导入（v0.214）

- 本人项目的story-import免费同步提取PDF/DOC/DOCX文字，先归属校验。原附件不落库，不创建任务、不调用模型、不写钱包或账本；解析结果只有text与小写format。
- 文件8MB，PDF100页，正文24000字；Word OOXML解压包32MB / 512项上限。超限拒绝，不静默截断。无文字层PDF、受密码保护、禁止提取、损坏及无正文均明确400 STUDIO_STORY_INVALID。不执行宏、外链、嵌入对象，不做OCR。
- TXT/Markdown仍由客户端校验UTF-8和256KB；所有成功正文成为同一客户端文档的可编辑Text节点与明确引用，保存后才可发送助手消息。导入失败不得清空已有草稿或引用，不能用空文字节点充当成功。

### v0.216 · Studio 统一附件（2026-10-08，本地未发布）

助手“添加附件”共用本地上传/素材库两条入口，支持图片、MP4、音频和故事多选，逐项报错保留成功项和草稿，保存失败可独立重试且不重传、不启动付费消息。现有云端画布素材库增加audio，搜索/筛选/多选后引用普通节点；已有同key/同正文节点复用。音频可试听、加入我的资产和再引用。免费media-import先验本人项目和实际字节/时长/编码/像素，再计aiavatar存储；上限详见助手文档。实际验收四类文件及损坏PNG、刷新五节点、音频试听/保存，运行0，钱包账本不变。345前端/22后端、构建/类型/契约通过。音轨/完整连续视频理解、Skill/分享和超长模式仍未接通，见统一验证§27。

### v0.217 · Studio 对话快照分享（2026-10-08，本地未发布）

助手历史旁“分享”仅在完成一轮对话后开放。先保存画布并预览服务端白名单文字快照，再明确创建链接；任何获得链接的人可匿名查看对话和创作建议。V47 新增 `ip_conversation_share` / `ip_conversation_copy`，不修改原画布、素材和积分。24字节随机 token，同内容发布幂等；更新快照撤销旧链接，撤销和源画布删除使公开读取失效。公开 GET 仅豁免精确路径，返回 no-store/noindex；复制和管理保留登录、aiavatar 开通、手机绑定及本人归属检查。

快照不含源节点、素材 key/URL、请求、模型、任务或账号字段，原参考绑定替换为重新选择提示。公开页“在 Studio 中继续创作”将文字与建议复制到本人新画布，创建新节点 ID并直接打开助手，无媒体和执行请求，未自动生成；同 owner/clientRequestId 幂等，浏览器 session 保留复制键以供失败/刷新重试。复制内容仍需显式选择本人参考素材、模型并确认费用。分享后新增消息不会自动公开，未发送草稿不进入快照。

这是 Studio 自有分享闭环；LibTV 当前可见“空对话不能分享”入口，但调研账号无历史，本轮未为探测弹窗调用模型，不能宣称其分享表单的所有行为逐项一致。公开画布与复制、社区展示仍是独立待办。验收见统一验证§28。


### Studio 创作设定（v0.218，本地未发布）

`settings.fusionGenres` 最多3项，每项非空、最多100字；`characterBrief/structure` 各最多1000字，校验在任何冻结/派发前。`mode=original|adapt` 使用原请求字段，改编正文由客户端从所选文本构成不可变输入，不重新解释原受理任务。新增可空设定字段参与递归去空的请求指纹；旧请求重放返回原记录，非空内容变化仍409。设定草稿与已生成正文独立保存；重新拆镜用当前正文及当前设定，不以旧镜头建议替代。

### Studio 接入端点排队位置（v0.221，本地未发布）

生成准入按 `AiModelEndpoint.id` 的并发配置和持久 FIFO 票据执行，等待不重新提交厂商。`IpRun.queue` 与原生视频候选 `queue` 是读取时计算的只读投影：`position` 为同端点全部等待任务中的 1-based 顺序，`waiting/running` 为该端点汇总数，`concurrencyLimit` 为配置上限；不得泄露其他用户任务明细。已准入或终态不返回排位。原生视频混合批次的运行级排位仅在全部活跃候选均排队时返回，候选级位置分别保留。取消复用原任务及冻结，前序任务退出后读取位次自动前移，不改变账本、不创建替代任务。

### Studio 剧本编辑改稿（v0.224，本地未发布）

- `StudioRunRequest.scriptEdit` 仅允许 `operation=assistant` 的文字路径，不允许同时 readVisuals=true、settings 或 episodeNo。markdown 1–48000字，在冻结前校验；沿用配置 assistant 提示词与 DAP_PERSONA 端点、端点并发队列、平台实际价格与 maxCost、同 owner/clientRequestId 幂等和 afterCommit 派发。
- 改稿输出为 `output.scriptRevision={summary,markdown}`，普通 assistant 仍输出 plan。修订 JSON、摘要、文档长度、五个唯一章节、唯一且有效的分集号在积分 commit 之前验证；无效输出失败并释放原冻结，不以空稿或不完整片段冒充成功。
- 模型建议不自动执行媒体生成，也不直接覆写客户端正文；采纳是用户动作。`scriptMarkdown` 是保存后的原文，`script` 是下游结构化投影；不完整 `scriptEditor.draft` 独立保留，受理 request 与其 baseMarkdown 不随手改变化。未知提交仅恢复同键，已知任务只读原runId；停止复用现有取消与结算。
- 同一完成任务重复投影不得清手改 Markdown；改稿 pending 不可通过复制/删除丢掉恢复入口。完成节点副本保留正文，但清来源改稿执行与建议绑定；旧副本 nodeId 错绑不读取/重提源任务。未修改正文的保存不标记下游过期。

### v0.228 · Studio 供应商积分计价与上线收尾（2026-10-10）

按用户确认，新增配音、口型同步暂以 1 聚算积分 = 1 平台积分，加 50% 溢价；人民币换算后续统一调整。配置 `ipstudio.supplier-point-pricing` 分开保存供应商每秒积分、换算比例和溢价，不混用端点的人民币微元字段。先对供应商计费秒数向上取整，再对整笔平台积分向上取整，避免每秒取整造成额外溢价。生产确认成本前不开放模型，旧验收单价不作为正式售价。

配音按正文 Unicode 字符数 + 10 秒（上限 600 秒）确定并显示预冻结上限，生成完成按实际音频时长结算、退回剩余冻结；这是一笔消费上限，不是时长预测。极端慢速音频超出上限则明确失败并释放冻结，不追加扣费。口型同步按已解码驱动音频时长报价。任务保存完整定价快照，重启恢复、同键重放和后台调价不改变原请求；已受理旧任务保留旧快照兼容。

正式发布覆盖后端、AiAvatar 和管理后台；保留个人画布发布模板，整画布分享仍暂缓。发布前已完成生产数据库/旧服务备份，隔离 MySQL 8.0.46 上 V39→V48 九项迁移与重复启动零迁移检查；正式部署与线上验收事实记录在 `docs/ip-studio-production-release.md`。
