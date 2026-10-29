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

模型错误说明（2026-10-25 修正）：所有模型调用共用 `ProviderErrorMessage`，仅将用户可操作的素材、参数、审核等具体原因脱敏、限长后展示；供应商余额、预扣费、配额、费率/成本、凭据、签名链接与堆栈不得返回客户端。公共 JSON 出口、任务/作品历史错误和 SSE 投影使用 `PublicModelErrorPolicy`，前端共用同规则兜底；不能只改新任务或只在界面遮挡。完整诊断只进受权限保护的后台；我方追查号和客户真实积分不足提示保留。展示策略不改变错误码、原任务恢复、冻结结算或重试判据，不将供应商额度问题引导为客户充值。见 `docs/audits/provider-financial-error-disclosure-20261025.md`。

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

- **导演台分集（2026-10-25）**：模型只给每集起点 `startParagraph` 和正文起点 `bodyStart`，区间由程序首尾相接地构造（最后一集到最后一段），不会漏段或重叠；越界起点忽略、重复起点合并、写了 bodyStart 但第一集更晚开始则中间几段并入第一集，都写进预览的修正说明；一个有效起点都没有才 `AI_BAD_OUTPUT` 并释放冻结。剧本里已有从「第1集」起编号连续的标题（≥2，取最后一组，段落 ≤40 字）且用户没指定不同集数时，程序直接按标题分，不调模型、不扣积分。结果先存 `pendingSplit`，`split.save`（`data.preamble`=`reference` 默认 / `episode`）采用、`split.discard` 放弃（一键制作随之停止）；采用或放弃必须带最新 `pendingSplit.id` 作为 `targetId`，缺失 / 不匹配或剧本改过均作废（409 `DIRECTOR_SPLIT_EXPIRED`）；分集正文按原稿字符区间复制，保留缩进、空行与原换行符。第一集之前的内容默认存为作品的设定资料 `reference`（`referenceRev` 修订保护，`reference.update` / `reference.toEpisode`），作为创作材料交给提取资产和写分镜脚本，不计入输入指纹。一键制作全自动按默认采用并在 notice 说明，否则停在 `confirm-split`；全自动下拆分失败作为一集继续。`split.undo` 恢复拆分前原稿与设定资料、清空集与片段（资产保留），已有分镜图 / 视频时 409 `DIRECTOR_CLIPS_HAVE_MEDIA`、有任务进行时 409 `DIRECTOR_TASK_RUNNING`。模型拆分出了结果即按用量结算，放弃 / 撤销不退款、不自动重跑。
- **导演台资产引用与解除关联（2026-10-27）**：资产「被用着」= 在某个片段的关联资产里，或是某句台词的说话人（删了这些台词就没有说话人，片段会被标成需修改）。`asset.delete` 时有引用就 409 `DIRECTOR_ASSET_IN_USE`，`details.clips` 逐个列出（集号、片段序号、标题、是否关联、台词句数），资产不删、不自动解除任何引用。`clip.unlinkAsset` 只把这一项从这一个片段的关联资产里去掉：其余资产顺序不变（参考图「图N」编号跟着顺序走），不删片段、不删资产、不动别的片段，已有分镜图和视频不删、按指纹标需更新，台词说话人不改（要删角色还得在编辑镜头里换说话人）；不在关联里 409 `DIRECTOR_EDIT_CONFLICT`，片段正在出分镜图或视频 409 `DIRECTOR_TASK_RUNNING`。页面：资产详情列出「用在哪些片段」，删除被挡时弹错误弹窗列出同样的片段和「前往」，前往打开片段的「关联资产」（只在台词里出现的打开「编辑镜头」），里面每项资产都有「解除关联」。
- **导演台重写分镜脚本与一键制作无事可做（2026-10-27）**：分镜图提示词和视频提示词由片段的镜头编出来，所以「重新生成提示词」就是重写分镜脚本。分镜页两个入口：工具栏「重写分镜脚本」（整集）和片段上的「重写」（单段）。整集可选「保留现有片段、逐段重写」（task `reshoot`，默认）或「重新切分片段」（task `plan`，本集已有分镜图或视频时不可选，服务端照旧 409 `DIRECTOR_CLIPS_HAVE_MEDIA`）。`reshoot` 只换要重写片段的镜头、标题、摘要、关联资产：片段 id 和位置不变，手改过的提示词回到随镜头自动生成（界面在确认前列出会被替换的片段），已有分镜图和视频留在历史版本里按指纹标成需更新，不出图、不生成视频，不碰其他片段和其他集。模型只拿到要重写片段的摘要、时长和台词（不给旧镜头，否则照抄），台词原文、顺序、说话人不变、不挪到别的片段；不重写的片段把镜头给上只作衔接参考；结构校验同写分镜脚本，要重写的片段漏了或重复判 `AI_BAD_OUTPUT`（不扣费），范围外的片段忽略。同一集同时只能有一份在写：整集写 / 整集重写在跑时什么都不能再发，单段重写只和同一片段冲突，片段在出分镜图或视频时不能重写（409 `DIRECTOR_TASK_RUNNING`）。回投时本集正文改过整份作废并提示；片段改过或视频在生成的，新版本挂在 `clip.pendingShots`，`clip.usePendingShots` / `clip.discardPendingShots` 决定，不覆盖。失败记在本集 `planError`（单段写明哪个片段）。一键制作只补没做的步骤：start 时什么都不用做（内容没变、没发任务就会「已完成」）不建连跑，409 `DIRECTOR_PIPELINE_NOTHING_TO_DO` 说清哪些已经做好、要重做去哪；界面在估算里一次文字生成都没有时提前说明并把主按钮换成「前往分镜」。
- **H3 视频提示词改写（2026-10-26 导演台首发，2026-10-27 起 Studio 画布与创作助手共用，`H3PromptRewrite`）**：用户看、改的视频提示词是中文；所选视频模型是 H3（`supportsPromptOptimization`）时，提交前统一用后台独立用途 `DAP_VIDEO_PROMPT` 的绑定端点（初始绑定聚算 Qwen）按 MiniMax 官方 skill（`resources/h3-skill`）改写成英文（画布、助手、导演台均不跟随用户文字模型或剧本默认模型；端点不可用时明确报错，不回落其它模型；报价、冻结、结算均按绑定模型）：全能参考按六段式，纯文字 / 首帧 / 首尾帧按三段式（首帧、首尾帧的对齐说明由代码加）。台词两种处理：原文按「某某说：「…」」写（导演台、创作助手）且认得全时，台词换成 `{{Ln}}`，模型只写画面，代码拼标题、切镜时间与 `(Sx) <d>[语言] 原文</d>`；认不全（台词引号不成对、用户自己写的提示词）由模型照官方写法写 `<d>`，代码按整句核对原文台词（拆成几句说也算原样；意思被改、漏了、多出来的都提示）。原文分了「第N镜（起–止 秒）」时镜头固定，否则由模型定镜头（最多 8 镜）。**检查只给提示、不拦人**（2026-10-26 用户定）：要用户判断的写进 `warnings`（漏了的台词已补回所在镜头、重复的已去掉、放到镜头外的已移回、模型多加的台词已去掉、缺的镜头补了一句过渡、大段没翻译已删掉、台词放错镜头只提示，模型写台词时意思被改 / 漏了 / 多出来的），画布与导演台手动生成据此停下来让用户选；已经自动处理好的小事写进 `notes` 不打扰（零星漏翻的中文删掉、引用不存在素材的句子删掉；模型把占位写成自己的台词时换回原文）；漏写环境声补中性默认；超 7000 字符标 `usable=false`。只有输出拼不出提示词（不是 JSON、没有镜头、全能参考缺全部主体说明）才 `AI_BAD_OUTPUT`（不扣费）。改写不进报价、按实际 Token 另扣，界面写「另需少量积分」；厂商自己的改写一律关掉。**导演台**：英文模板按「画面结构 + 参考素材 + 镜头切换时间」指纹存在片段上复用，只改台词不重新改写；`AI_BAD_OUTPUT` 自动重试一次。手动生成：没有提示就用确认过的视频价格、付款方与请求号接着提交；有提示（或太长）停在 `videoPromptRewrite=review`，用户选 `options.promptChoice=optimized`（用优化稿）或 `original`（用原文，不改写），未选再点生成 409 `DIRECTOR_PROMPT_REVIEW`；`original` 随时可用，选择按指纹记在片段上（`videoPromptChoice`）。一键制作不停下来问：优化稿能用就用，太长或两次都没改成按原文接着提交。改写期间这次要付费提交的输入（中文提示词含台词、分镜图、参考图与声音的 key、时长、画幅、模型）有任何变化只报错不提交；一键制作已暂停或停止也不提交、也不自动重试改写；自动重试前核对预算（重试冻结 + 视频报价）。一键制作里改写中的片段算在途：发改写时按「视频报价 + 改写冻结上限」核对预算，改写期间视频报价算占用；续提前再按实际已用核对一次，放不下停在预算不足；续提被拒（价格变了、输入变了等）记为该片段失败，不换请求号重发。**Studio 画布 / 创作助手**：视频请求带 `video.rewrite`（画布 `review`，创作助手视频步骤 `auto`）。受理时按视频的规则预检并核对视频报价，再冻结改写的上限、建一行 `studio-video` 任务；后台改写完在同一个事务里先结算改写（结束改写的企业授权，企业在途上限才放得下视频）、再提交视频、把任务号写进这一行（`_exec.nativeVideoJobIds`，之后按视频任务投影，花费含改写）；任何一步失败整体回滚、按失败结束、改写不扣费。只用模型赠款（`modelBilling.freeOnly`）也照常改写：以出片效果为准，改写按文本模型自己的价格扣，积分不够时受理即失败、用户可以取消（2026-10-27 用户定，不做单独处理）。制作计划的视频步骤批准上限含改写上限，受理按合计核对，交接时视频只能用剩下的部分。review 有提示时不出片（`output.needsChoice`），没改成按失败结束（不扣费），用户在卡片上选用优化稿（发英文、`optimizePrompt=false`）或原文（`optimizePrompt=false`）另发一次；auto 不停：能用就用，没改成或太长按原文出片并写 `videoPromptNotes`。制作计划里先改写的视频步骤，报价加上改写的冻结上限。
- **导演剧本文件导入（2026-10-25）**：`POST /v1/ip-studio/director/script-import` 复用 aiavatar 的登录、开通与手机号闸；文件 50 MiB（2026-10-28 由 8 MiB 放宽，并支持 .html/.htm；HTML 只取可读正文，脚本、样式、隐藏元素和标签不进正文，不运行脚本）/ PDF、PPT 100 页 / Word、PPT 解包 256 MiB 上限，正文不限字数（2026-10-29 取消 6 万字），失败不返回截断内容。提取免费、不调用模型、不存储原文件或修改作品。前端预览后确认导入；替换现有正文须明确点击，再走原有创建或 draftRev 修订保护保存。画布故事导入的格式与 24000 字限制不随此接口扩大。支持格式、文字编码及扫描 / 加密文件的处理边界见 `docs/ai-director-plan.md` §3.1。

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

视频生成费用确认（本地开发）：`POST /me/celebrity/video-studio/quote` 只读复用生成校验/定价，返回折扣、模型赠款与普通积分补差。`freeOnly=true` 不足时不可确认；提交 `modelBilling` 时必须有 `clientRequestId`，服务端按原价格版本与普通积分上限复核。编号按用户隔离，重复原请求直接返回原任务，不重扣、不重派发；换正文或确认上限返回 409 `VIDEO_STUDIO_REQUEST_CHANGED`。客户端确认后先保存本人会话中的原请求，结果不明及刷新后重试同一编号/正文，不重新报价或生成新编号。提示词智能优化仍是独立请求及费用。

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
  outputSizeCode, seconds, [seed], [optimizePrompt], [input_image_asset_id], [end_image_asset_id], [referenceInputs[{role, mediaType, assetId}]]`。
  不传 fps / frames / width / height / steps。
- **出片前的提示词改写**（2026-10-20）：H3 四种模式默认先改写提示词再出片（厂商契约 `optimizePrompt` 缺省开启，受理之后才改写）。
  规格里写了 `optimize_prompt` 才发 `optimizePrompt`：Studio 用户选「按原文生成」→ false；视频生成区带 optimizationId 的生成 → false；
  其余不发（厂商默认）。非聚算协议或没有清晰度的老路径带着它 → 400 `VIDEO_MODE_UNSUPPORTED`；Studio 选了不会改写的模型 →
  400 `STUDIO_VIDEO_OPTION_UNSUPPORTED`。不影响价格。轮询拿到的 `promptOptimization`（状态、来源、实际用的描述）写进任务
  `payload_json.vendor_prompt`（只读旁路，写失败只 WARN），由 `VideoPromptRewrite` 投影成画布候选的 `promptRewrite`，
  任务卡不外露；它只用于成片后解释差异，不能当作生成前的检查。
- 老路径（没有清晰度：画布、脚本视频、短剧）组出来的聚算请求体与改动前逐字段一致。
- 非聚算协议（seedance / agnes / 通用）收到任何原生参数 → 400 `VIDEO_MODE_UNSUPPORTED`，不静默丢；只带首帧 key 时，
  key 换成厂商自己去抓的 URL（`FileStorageService.upstreamFetchUrl`：**先签名 URL**，签不出来才退公开 URL。
  `publicUrl` 只是拼域名、不管桶能不能匿名读，生产默认按 OSS 签名出 wire，私有桶下未签名地址是 403；
  短剧交给 seedance 的首尾帧一直是签名地址），放进该协议的首帧位
  （seedance `content[role=first_frame]`、agnes / 通用 `image`），**优先于** prompt 里的首帧标记；换出来的不是绝对
  http(s) 地址 → `VIDEO_REF_UNREADABLE`，不假装传了图。只带标记的短剧请求逐字节不变。
- 上游拒绝：创建或素材上传非 2xx 一律 `log.warn` 带响应体；4xx 的任务失败原因只保留经公共错误策略过滤后的可操作原因，不透传供应商经营信息
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
| `VIDEO_MODE_UNSUPPORTED` | 400 | 非聚算协议收到原生参数（含 `optimize_prompt`）；`video-studio` 以外的分区带了原生规格；`ipstudio` / `video-studio` / `drama` 以外的分区带了首帧 key |
| `STUDIO_VIDEO_OPTION_UNSUPPORTED` | 400 | Studio 视频请求带了「按原文生成」（`optimizePrompt`），但所选模型出片前不会改写描述 |
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
- `packaging.voiceoverStorageKey` 只能合成使用本人音频，替换原轨。音频长于视频拒绝 STUDIO_SPEECH_TOO_LONG，不裁掉台词，不冒称口型同步。预设声音与个人克隆/人物驱动保持独立状态。配音过长与字幕超过成片在下载完各段、拼接之前就判（按各段时长之和加拼接容差），合成后仍按真实时长复核。
- 成片高级编辑（2026-10-19）：`edit`（StudioEditTimeline）只许 `operation=assemble`，非 assemble 带它报 STUDIO_EDIT_ASSEMBLE_ONLY；有它时按时间线合成、不用 `packaging`。视频按 start 排成一条主轨，后开始的截断前一段，空隙补黑；音频、文字、字幕按时间叠加。画幅 320–1920 偶数，视频 1–60 段、音频 ≤20、文字 ≤30（≤120 字、字号 12–200、颜色 #RRGGBB）、字幕 ≤200（≤80 字），音量 0–2，总长 ≤600 秒，越界报 STUDIO_EDIT_INVALID；clips 与 audios 的 key 必须是本人素材。读不出的素材报 STUDIO_EDIT_BAD_MEDIA。不扣积分。


### 模型任务异常状态与并发（2026-10-22）

- 所有模型入口区分失败、查询中和正常生成。无有效供应商任务回执的异常以失败结束并释放未完成部分冻结，明确告知可重新生成；禁止用 5% / 10% 掩盖异常。
- 图片、视频、配音和口型的 `*_SUBMISSION_UNKNOWN` 在同一结算事务内结束为 failed、释放剩余原冻结并结束付款授权，之后释放排队名额。保留原请求、模型快照、诊断和排队记录用于告警；用户重试创建新任务，系统不得自动重复提交。已返回供应商任务 ID 的查询异常继续查询原任务。
- Studio 单任务、批次候选、节点、任务列表及各视频入口透出错误码和安全原因；失败允许用户主动重试。查询中显示“模型端仍在处理，请稍后查看状态”（2026-10-24 起，短标签“模型端仍在处理”），可刷新原记录，不重新生成、不再次扣费；具体原因与追查号留在错误详情和错误日志里。
- 配音/口型的 HTTP 业务异常和网络异常都持久化；原幂等键/正文的恢复窗口仍为最多三次、两分钟，结束后进入人工核对并停止自动派发。提交前准备失败明确结束并释放冻结；已提交的查询故障保留冻结。既有运营证据恢复与确认未受理流程不变。
- 通用同步调用在异常/超时的 finally 释放调用票据；文本/多模态工作流、智能优化、短剧首帧、音乐和 clip 保留各自明确失败及超时终态，不用假成功内容覆盖异常。

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

图片无回执失败策略（2026-10-22 用户明确调整）：未拿到有效供应商任务号按失败结束，原子释放未完成图片的剩余冻结，已成功图片与已消费积分保留。旧受理未知记录在执行租约结束后按相同规则收尾；已知任务号或已镜像产物不走此策略。原请求、错误响应与追查号保留，后台生成异常告警只读投影既有记录。

### Studio 剧本编辑改稿（v0.224，本地未发布）

- `StudioRunRequest.scriptEdit` 仅允许 `operation=assistant` 的文字路径，不允许同时 readVisuals=true、settings 或 episodeNo。markdown 1–48000字，在冻结前校验；沿用配置 assistant 提示词与 DAP_PERSONA 端点、端点并发队列、平台实际价格与 maxCost、同 owner/clientRequestId 幂等和 afterCommit 派发。
- 改稿输出为 `output.scriptRevision={summary,markdown}`，普通 assistant 仍输出 plan。修订 JSON、摘要、文档长度、五个唯一章节、唯一且有效的分集号在积分 commit 之前验证；无效输出失败并释放原冻结，不以空稿或不完整片段冒充成功。
- 模型建议不自动执行媒体生成，也不直接覆写客户端正文；采纳是用户动作。`scriptMarkdown` 是保存后的原文，`script` 是下游结构化投影；不完整 `scriptEditor.draft` 独立保留，受理 request 与其 baseMarkdown 不随手改变化。未知提交仅恢复同键，已知任务只读原runId；停止复用现有取消与结算。
- 同一完成任务重复投影不得清手改 Markdown；改稿 pending 不可通过复制/删除丢掉恢复入口。完成节点副本保留正文，但清来源改稿执行与建议绑定；旧副本 nodeId 错绑不读取/重提源任务。未修改正文的保存不标记下游过期。

### v0.228 · Studio 供应商积分计价与上线收尾（2026-10-10）

按用户确认，新增配音、口型同步暂以 1 聚算积分 = 1 平台积分，加 50% 溢价；人民币换算后续统一调整。配置 `ipstudio.supplier-point-pricing` 分开保存供应商每秒积分、换算比例和溢价，不混用端点的人民币微元字段。先对供应商计费秒数向上取整，再对整笔平台积分向上取整，避免每秒取整造成额外溢价。生产确认成本前不开放模型，旧验收单价不作为正式售价。

配音按正文 Unicode 字符数 + 10 秒（上限 600 秒）确定并显示预冻结上限，生成完成按实际音频时长结算、退回剩余冻结；这是一笔消费上限，不是时长预测。极端慢速音频超出上限则明确失败并释放冻结，不追加扣费。口型同步按已解码驱动音频时长报价。任务保存完整定价快照，重启恢复、同键重放和后台调价不改变原请求；已受理旧任务保留旧快照兼容。

正式发布覆盖后端、AiAvatar 和管理后台；保留个人画布发布模板，整画布分享仍暂缓。发布前已完成生产数据库/旧服务备份，隔离 MySQL 8.0.46 上 V39→V48 九项迁移与重复启动零迁移检查；正式部署与线上验收事实记录在 `docs/releases/ip-studio-production-release.md`。

### Studio 模板作为普通画布起点（v0.231）

- 官方/本人已启用模板通过原 `POST /v1/ip-studio/projects {templateId}` 免费创建个人副本；不要求先输入素材、选模型或报价，不调用模型/账本。
- 已发布模板复制从当前不可变版本取得 doc/recipe，重建节点与连线编号、默认文字与图片/视频参数；文字输入变量转成真实连线，以画布最新内容参与生成。
- 新副本走普通画布文档和节点运行，不写 templateVersionId/templateInstanceJson 锁定执行快照。保存修改仅属主副本，原模板版本保持不可变；已存在的版本实例保持兼容。
- 画布节点提交前提示缺失的连入图片与必填文字/选项；实际后端生成仍须模型白名单、素材归属、preflight、maxCost、积分冻结/结算及幂等。断开连线是用户显式改变引用；发布模板仍剥离作者私有素材和任务。


## 个人资产库增量（2026-10-11，已生产发布）

现有 `/assets` 升级为资产库，一级导航只放资产库；提取属于画布剧本/文本节点及剧本编辑器「素材 → 本剧资产」。核对人物、场景和道具后入库，即使没有图片也保留为草稿。已有结构化设定免费整理，正文分析沿用配置的创作模型和明确报价；原文与任务先保存，同键确认原任务，不采纳未确认的 AI 改稿。

文件夹为本人手工建立的单层组织，不引入正式项目。名称不作为身份：不同来源同名默认独立，复用已有资产必须显式选择。一个对象可保存多个剧本依据、描述、生成提示词、上传参考图和图片版本；快速完善支持逐项编辑和按缺图批量提交，已有主图/运行中的项跳过，失败项独立重试。新版本不覆盖旧画布引用，引用保存 objectId/versionId 与文件 key、描述快照。

成功的 IpRun 图片候选、视频、音频及完整文本在服务端持续归集，包括未采用候选；上传媒体自动保存。关闭页面不影响归集。库按本人、文件夹、名称/来源、状态/媒体类型分页。新画布可从资产库添加，创作输入的 @ 菜单保留画布候选并可搜索个人资产；同名候选展示来源，图片明确选择版本，无图对象以文字设定引用。原人物形象和声音入口保留。删除文件夹内容移到未分类；删除对象不删除旧画布文件。

持久化使用 V52 `ip_library_record`（folder/object/binding/preference/receipt），原媒体仍用 `ip_saved_asset`，原生成、积分与画布文档继续各自为真值。接口为 `/api/v1/ip-studio/library/**` 与 `projects/{id}/library/{extract,save-extraction,folder}`；分页直接返回 PageEnvelope，资源返回 ApiResponse。跨子产品的音乐/短剧/带货资产统一、团队共享及自动项目归属不在本轮范围。

发布与本地/生产验收范围见 `docs/releases/ip-studio-asset-library-validation.md`（2026-10-11）；本地样例不自动迁移到生产。

## Studio 全部文本 AI 操作 Token 结算（2026-10-12）

2026-10-25 用户修正（导演台单次文字停止，优先于下文旧的“取消释放”）：未提交模型可取消并释放冻结；已提交的停止只终止后续创作，保留请求直到真实用量回执，按接受时费率结算实际消耗并释放未用余量。缺回执或进程中断不能推断零消费，标 `STUDIO_USAGE_PENDING`、保留冻结待运营核对，禁止按批准上限直接扣费或让 TTL 自动退款；不自动重提供应商请求。停止后的迟到内容不回投，真实用量只能结算一次。

operation=text/script/storyboard/assistant/asset-extract 的新任务全部使用 `ai.chat-token-pricing` 按实际 Token 计费（本地 fixture 模式除外）。新请求必须提供 capabilities 文本模型 tokenPricing.maxCost 作为批准上限；缺价或超过批准额在 hold 前拒绝，不回退到按次价格。导演台文字任务受理时再按该任务实际可请求的输出上限收窄费率快照与冻结额（拆集 8192、资产提取／分镜脚本 16384、长剧本 100000），不得拿模型的全局输出上限作为每个任务的冻结额。费率与预算随任务冻结，服务端按真实 prompt_tokens/completion_tokens 合计费用后向上取整。不得按估算 Token 结算；缺少/异常/超预算用量、无效内容、失败与取消释放冻结。成功时同事务 commit 实际额、release 余量、写 billing 和终态；重放原幂等键不再取价或扣费。既有无 tokenPricing 的已受理任务沿用原按次快照。

文本用户界面只展示完成后的实际积分，不展示固定报价、费率、模型全局上限或冻结值。导演台文字按钮与企业付款选择只说明按实际用量结算，不展示不确定的积分数字；图片、视频等确定报价继续展示。实际提交模型工作的操作按钮带 AI 图标；本地保存、上传、采纳和任务查询不标为付费模型调用。

#### Studio 全能创作节点采用补充（2026-10-12）

助手 `steps` 支持 `text`：必须带完整 `content`，前端采用时仅保存画布，不再次调用模型或扣积分。`dependsOn` 只能引用同方案更早的步骤；后续生成使用已采用且有可用产物的真实节点 ID，不能把步骤 ID 当素材 ID。模型回传的 `resultNodeId` 被剥离，该绑定仅由客户端在用户采用后保存。用户必须明确选择已有普通文字节点才可替换，且校验选择时原文快照；默认新建，保留来源节点。图片/视频等动作先创建草稿与引用连线，再走现有生成确认和计价。保存失败重试同一节点。分享剥离源画布绑定并重新映射步骤依赖。


#### Studio 助手历史与原节点修改（2026-10-13）

对话记录保存在项目文档 `assistantConversations`，不在 `nodes` 或 `connections` 中。读入旧助手卡片时保留 ID、原受理请求、回滚快照和采用绑定，迁入历史并移除卡片连线；仅历史变更也必须触发同一保存/冲突检查。继续对话、刷新与恢复复用原任务幂等键；分享读取独立历史，复制只建历史，模板/示例发布剥离私有助手历史。

用户采用结果前不得新增结果节点或改动来源。选中一个可编辑节点时默认写回它；可另选新建。普通文字可改正文或提示词，图片/视频/音频可改提示词，结构化剧本可采用经过完整 Markdown 框架校验的正文。模型可返回 `operation=text, content=完整修改稿, editTarget={nodeId,field}`；target 必须来自已引用节点，field 只允许 content/prompt/script，不能写素材 key、受理请求或执行状态。采用时复核发送时的原文快照与当前值，变化则保留当前节点并要求重新核对；生成中的节点不可替换。提示词更新同步编辑草稿与镜头描述，已受理请求快照保持不变；采用不启动模型、无额外扣费。新建媒体结果仍需原生成面板的显式费用确认。

## 企业主子账号（2026-10-15，本地实现，默认关闭）

- 2026-10-17 付款交互：未加入企业直接用个人积分；仅企业成员展示付款选择，并可明确保存默认，下次不再询问。设置页可恢复每次询问或更改默认；偏好按当前浏览器的用户与企业隔离，不跨企业套用。余额不足不自动切换或混扣，原受理任务付款不随偏好变化。

- 企业主体为 Enterprise；owner 唯一，manager/member 属于成员关系，不复用平台后台角色。一个本地 userId 只有一条当前企业归属；停用保留归属，退出释放当前归属；原任务与退款仍属于原企业。
- `/api/v1/ip-studio/enterprises/**` 与邀请接受归 aiavatar，沿用 ProductRouteTable 的 `/api/v1/**` 映射、EnrollmentGuard 和 PhoneVerificationGuard；加入企业不创建产品开通或赠额。`aep.enterprise.enabled` 默认 false，关闭时企业 controller 不注册。
- 创建企业以“创建者 + clientRequestId”幂等；创建者与当前 owner 分开保存，移交不破坏原创建请求。企业和成员账户均从零开始，不更改个人钱包。
- 企业邀请是可群发、多人使用的链接，默认 90 天，可选 365 天，可随时撤销；仅保存 SHA-256 哈希，原始令牌只在初次创建返回。同一请求固定有效期，重试不重发令牌。加入不消耗链接；已在同企业的有效成员重复加入幂等，在其他企业或停用成员不能通过链接切换/恢复。接受时复核邀请者权限、企业状态、有效期和当前归属。
- 分享页 `/enterprise/invite#token=...` 的令牌只在 fragment/内存；公开只读 `POST /api/v1/ip-studio/enterprise-invitations/preview` 仅返回企业 ID、名称和有效期，响应 no-store，预览不要求登录/开通且不写成员。短信注册登录使用既有 ID grant，不把企业令牌当注册推荐码；登录后调用原接受接口，手机号和产品开通要求不变。未开通时保留邀请，开通后继续加入。
- V59 清空旧企业邀请记录并删除 accepted_by 单次接受字段，直接切换群发模型；不修改企业成员、账号、钱包、账本和产品开通。无旧单次邀请兼容分支。
- 角色修改仅 owner，禁止修改自己；manager 只能管理普通成员，积分管理和财务读取须另获授权。成员查询、审计列表按企业后端分页，不返回完整手机号或个人资源。
- 主账号移交需当前 owner 发起、指定有效成员在24小时内接受；锁企业行复核旧 owner，只能成功一次，原 owner 降为 manager，钱包主体不变。模型策略默认空允许集、在途上限1，修改需 owner 且携带版本。
- 钱包类型为 personal / enterprise / enterprise_member。个人 userId 唯一；企业账户的 userId 为空，memberUserId 单独存储，accountKey 唯一。企业成员积分仍归企业，不进入个人 gift/recharge 余额。
- CreditService 为唯一余额写入入口；原 userId 方法仍解析个人钱包，新内部方法按 walletId。企业主账户不可直接消费；成员企业冻结须有操作者、成员关系和付款授权。企业付款只开放 Studio 指定用途，最终模型和成员在途上限均由服务端控制。
- hold 引用重复时必须匹配原钱包、金额、操作者、成员关系和付款授权；不匹配409。企业资金固定锁企业→按ID排序的企业钱包→hold→任务；个人仍钱包→hold。结算按 hold.walletId，不再依赖 hold.userId；冻结金额不一致时失败关闭。
- TRANSFER_IN/TRANSFER_OUT 为积分面内部划拨，不是 RECHARGE/SPEND，不增加收入或累计发行量；分配/回收均保留双边关联流水。MONEY/CREDIT 与现金凭证不变量保留，历史 Ledger 不改写。
- V56 增加企业/成员/当前归属/邀请/策略/移交/审计/划拨结构，并扩展钱包、冻结、任务、订单的账户关联；迁移不改旧余额、账本金额或产品开通。V57 保存原充值来源，V58 保存付款授权、释放来源和生命周期幂等回执；生成与退出按原关系版本结算。

错误口径：输入无效400；未登录401；产品未开通、手机号未验证或企业权限不足403；企业内对象不存在404；已属于企业、幂等正文不符、版本/邀请/移交冲突409；余额不足402。详情壳沿用 ApiResponse，分页直接 PageEnvelope。已实现路径按 OpenAPI 记录；默认关闭，实际发布状态以发布验收为准。


### 企业积分划拨与人工财务（E05–E06）

- 分配/回收最多100位不重复成员，企业根账户与成员企业账户等额划拨，gift/license/recharge 桶及充值原单来源随积分移动；不转入个人、不跨企业、不触碰冻结。manager 不得操作自己、owner 或其他 manager。
- 先预览逐项、总额及前后余额，提交带确认指纹；锁企业再按钱包ID排序锁行，复核成员权限和余额。变化返回409，必须重新预览确认；同请求键+规范化正文只执行一次，批量整批回滚。`finance:` 请求键留给退款归集。
- 企业充值申请不入账；财务独立登记人民币分、积分、收款凭据。使用明确标记的内部人工订单类型，不创建或修改公共套餐；目标企业、企业名、申请人和根钱包在申请时快照。核准经 RechargeService 原子入账，仅 RECHARGE，不借 GIFT 发放。个人充值列表/收银台/旧核准退款入口不能处理企业单，支付回调及影子支付不能核准企业人工单；人工单不按在线支付TTL关闭。
- 收款/退款凭据规范化后全局唯一；重复凭据返回 ENTERPRISE_RECEIPT_REVIEW_REQUIRED 并保持原状态，交财务核对。确认和退款均校验请求键与正文，不能重复入账或回收。
- V57 的来源批次记录每笔充值在各企业钱包内的可用/冻结额；划拨、冻结、部分结算和释放同步维护。消费来源按充值先后确定；后续充值不能替代已消费的原单积分。来源记录为账本辅助投影，所有余额变化仍经 CreditService 与不可变账本。
- 退款仅退原订单未消费的充值积分，先预览可退积分及原比例人民币，金额向下取整到分。原订单仍有冻结时拒绝退款，须待在途任务结算；无冻结后一次性退可用部分，已消费部分保留。归集成员原单积分、双边划拨流水、退款分录、凭据及订单终态在同一事务，任一步失败全部回滚。
- 本批记录人工现金退款事实，不调用银行/支付渠道打款。财务应核对外部实际退款金额与凭据；预览过期会拒绝，已发生外部付款的差异须按原凭据人工对账，不能再次付款或拿其他订单积分抵扣。自动支付与退款预约不在本批。
- 企业汇总的 unallocated/allocated 为根/成员可用，pending 为冻结，spent 为已结算消耗；totalBalance=unallocated+allocated，冻结单列。划拨不计收入或消耗。平台流水展示企业与钱包ID，导出保留钱包/企业/操作者/关联业务，便于对账。
- 普通成员仅查本人企业余额与划拨；汇总需 points.manage 或 billing.read。企业财务操作固定 FINANCE_ADMIN/SUPER_ADMIN，owner/manager 没有平台财务权限。关闭新企业入口时，平台财务仍可处理已有订单。


### Studio 复刻创作 · 全片创作拆解（2026-10-15）

- 复用 `POST /api/v1/ip-studio/projects/{id}/studio-runs`，`operation=recreation`，`contextNodeIds` 恰含一条本人视频。报告目标必须是已保存的文字节点、`studio.kind=recreation`。未完成视频、归属/字节/真实时长、模型视觉能力、提示词及售价缺失均在冻结前拒绝；fixture 不冒充真实分析。
- 视频最多128MiB/60秒；受理时冻结视频 key、标题、时长；worker通过固定源码版本Hypit媒体适配器解码全部原始视频帧的低分辨率画面，保留原始PTS，优先保留明显变化前/当时/后的画面并补齐长空档，预算上限64帧，实际时间和变化类型checkpoint回任务。每页最多8帧分段读取，汇总同时用未拼格尾帧独立复核结尾，各段累计Token按同一次冻结结算，总输出预算内分配，片段截断/缺失用量失败释放冻结。亮度突变标记lighting，不直接判为切镜；预算内补帧不等于逐镜切分，不读音轨；不把传入标题或用户分析偏好当视频事实。
- 输出六项视觉基因、三项创作骨架、元素/保留建议、核心手法、分析边界及复刻建议词。仅展示真实采样列表内的证据编号；来源由服务端附加，不采信模型来源字段。引用缺失/越界时隐藏不可靠定位并标注不确定性，不因此丢弃整份分析；不做模型叙事的语义硬校验。结构不完整/截断输出失败并释放冻结，不产占位报告。
- 端点队列、afterCommit派发、请求幂等、实际Token结算及退回余量复用原Studio运行；原片与报告分别持久化，刷新只查询/确认原任务，不重新分析。文档正文以`metadata.content`的Markdown为用户可编辑真值，恢复已完成任务不得覆盖用户编辑。解析成功后保存最多4张可复用参考图片（不等于全部分析帧），和文档在客户端组成一次性分组；持久化只存key，读取才签URL。
- 画布文档复用剧本Markdown编辑器，支持免费编辑、保存和导出；后续收费创作仍需用户发送/确认。模板复制只保留普通报告正文，剥离作者的私有任务和来源绑定。逐镜拉片与音轨理解不在本次范围。


### 企业生成付款与退出（2026-10-15，E07–E12）

- `billing` 只选 personal 或当前 enterprise，不接收 walletId。缺省为旧个人行为；客户端重试先恢复原请求选择，服务端指纹和持久授权再次校验。个人画布与素材的 owner 检查独立于付款，企业不获得作品读取权。
- 事务顺序：企业行 → 按ID排序的企业钱包 → 冻结 → 任务；同企业消费/划拨/生命周期共用。预检后原子复核当前成员、白名单最终模型、余额与在途，保存授权/任务/冻结，afterCommit 派发。在途包含排队和未知受理的任务（零价模型接入点已改为直接报错，见「模型折扣与模型赠款」）。授权固定原成员版本、账户和单价。
- 完成/部分成功/失败：任务终态、SPEND/UNFREEZE、授权终态同事务；不允许冻结尚未结清时完成授权。图片和视频已受理后的轮询中断保留冻结/容量，按预存原路由、供应商ID恢复，不能重发。无ID未知须由平台运营核对凭据后补原ID并审计，再查询原任务；仅供应商明确证明未受理时允许下述证据确认释放。任务恢复限 SUPER_ADMIN/OPERATOR，FINANCE_ADMIN 不可操作。
- 停用/退出先撤销全部原授权，取消未派发，回收可用。已受理继续原账户结算，未用额先原冻结释放再等额归集原企业；保存原桶及原充值来源，恢复/重入/转企业不能接收旧退款或误动新分配。请求先预览并复核指纹，成功回执按企业/请求键/操作者/正文幂等，退出后重试仍返回原回执。
- 关闭企业须无余额、冻结、活跃授权及待核准充值。owner 须先移交才可退出。报表只包含企业资金与成员名称/模型公共名；普通或停用成员只读本人；平台财务使用已有角色。新业务开关关闭不影响已存在订单的财务核对、原任务结算和恢复。

历史人工核对接口仍保留原状态、原冻结及证据校验。当前无有效任务回执策略优先自动结束为失败并退回剩余冻结，已结束任务不能再通过旧补录接口恢复或补扣；有原供应商 ID 的任务继续按原任务查询。

### Studio 视频拉片（recreation / segments）

视频节点「素材拆解 → 拉片」提交既有Studio任务，`operation=recreation, mode=segments`。来源仍要求本人项目及本人视频key，60秒/128MiB限制；已有全片Markdown可作为背景上下文，不重新收费解析全文。工程约束时间范围连续有限、最多8段、覆盖片尾，真实裁切成可播放MP4；模型正文不作语义或章节齐全校验。逐段保存媒体key/Markdown/状态，失败保留已完成产物；显式继续仅复用同本人同项目同目标节点同原片的旧任务快照，不能信任客户端提供的裁切key。URL仅出wire签名，画布文档保留key和原片范围。整次拉片一笔冻结，累计实际Token一次结算，失败沿用释放；不改账本规则。

2026-10-17 本地增量：解析／拉片自动用FFmpeg提取第一条完整混合音轨，返回`output.sourceAudio`：`ready`带本人WAV key、真实时长、字节和来源；`absent`表示没有音轨，不创建静音占位。静音音轨仍可提取，不能称为无人声检测。提取不调用模型、不新增积分项；提取失败明确报`STUDIO_AUDIO_EXTRACTION_FAILED`，不伪造完成。结果先checkpoint，后续模型失败保留；分段继续只复用同本人/项目/目标节点/原片的服务端快照。音频key持久化、URL读取时签名，前端复用普通音频节点，同原片在全片解析与拉片之间复用已存在节点，轮询不覆盖编辑/恢复用户已删产物。音频可选入现有成片合成的`packaging.voiceoverStorageKey`替换音轨；Studio原生视频全能参考链已支持audio，能否传入取决于所选模型合同的音频格式/时长/数量和视觉参考限制；首尾帧等不支持的模式仍拒绝音频。生成参考不保证原样保留，原声复用可选生成后合成。ASR、字幕导出、音频翻译与人声/BGM分离作为音频节点后续独立能力，不能随拉片自动调用。

### 原应用 Prompt 条件保存与调用明细分页（2026-10-13）

ops 签名管理通道新增 `promptSaveVersioned` / `promptRollbackVersioned`，必须提供非负 `expectedVersion`；仍委托原 PromptService。SQL 条件更新 `WHERE prompt_key=? AND version=?` 是并发判定，当前模板、递增版本、历史快照及通道审计同事务提交；版本不匹配返回 409，不保存部分内容或历史。新建模板同时依赖原唯一键，竞争方返回冲突。缓存仅在事务提交后失效。旧 admin 保存与恢复也携带编辑时版本；原 HTTP 接口新增可选 query 参数，兼容既有客户端。

新增 `usageRecordsPage` 白名单只读命令，复用原用量记录和服务；按时间、应用、模型、端点、用途、用户、租户、结果及搜索条件在数据库过滤后分页 / 计数。历史空应用编码按原用途归属规则解析。返回 `items/total/page/size/asOf`；单页最多 200 条，总记录无 500 条截断。排序为时间倒序再 ID 倒序，`asOf` 固定查询上界；不返回请求/响应正文，不触发重放、生成或扣费。旧 `usageRecords` 返回形状及窗口保留兼容。

### 模型用量归属与多模态统计（2026-10-21，已发布）

用量流水的调用人来自：显式归属 → 当前执行任务的归属作用域 → 请求登录用户。Studio 对话（含工具内模型调用和摘要）、工作流、IP 画布、数字资产任务及短剧文字/出图 worker 在实际执行入口按持久化 owner 建立作用域，正常/异常结束均恢复；恢复任务同样适用。不把请求登录状态复制到线程池。有业务 owner 的调用不得生成空用户流水；没有用户和请求上下文的记录输出含用途/端点/请求号/任务号的告警，不记录密钥与正文。该归属是供应商消耗审计，不参与产品积分结算。

用户/租户未归属筛选分别通过 `unassignedUser` / `unassignedTenant` 查询 `IS NULL`，与同维度具体 ID 同传拒绝；原 admin 明细和管理通道普通/分页明细保持一致。历史空用户记录不按时间或端点猜测回填，保留原样并在后台说明。

`usage.byModality` 按文本与多模态理解、图片生成、视频与口型、音频与音乐、其他调用汇总。各组独立保留调用数、输入/输出/总 Token、计费单位、计费秒数和成本；不同单位不相加，全部模态汇总等于报表全量。视觉理解沿用厂商返回的 Token；兼容图片接口返回 `usage.prompt_tokens/completion_tokens` 或 `input_tokens/output_tokens` 时保留。未返回的 Token/秒数不估造，后台零值不代表免费；成本依据已配置供应商单价，记录时保存快照。视频沿用供应商成功受理时的请求秒数口径；配音/口型沿用原业务计费秒数，音乐记录供应商成功回报的真实时长，即使后续交付存储失败也保留供应商消耗。新配音/口型流水计费单位为一次调用，秒数另列。后台聚合、明细、导出与可切换的趋势显示这些维度。智能优化另以观测用途 `VIDEO_PROMPT_OPTIMIZATION` 按次记录，不新增可路由模型用途；成功观察按端点锁与原幂等键去重（超过流水长度上限的键保留 SHA-256 摘要）。它没有独立供应商成本价，不套用视频每秒价，现阶段只统计次数，成本未估价。本次无需数据库迁移，不新增付费调用。

## 端点保存前检测与目录发现（2026-10-13）

平台新增窄白名单 `endpointProbe`，复用原端点服务的 discoverModels；使用当前 providerType/baseUrl/apiKey，仅 GET 模型目录，不落库、不生成、不触发计费。编辑时只允许同供应商地址复用已存密钥；更换主机或端口须重新提供密钥。拒绝非 HTTPS、含 URL 凭据 / 查询串以及私网 / 回环 / 链路本地地址；目录格式异常不能视为成功，单次请求不重试。返回经脱敏的鉴权 / 地址 / 限流提示、目录与耗时；运营端不显示供应商原文。目录去重并过滤退役项；获取成功与实际生成可用性是不同事实。


### Studio 存量发行能力复用（2026-10-16）

AiAvatar 发行入口共用当前 uid 的社交账号和历史发布任务：`/api/me/social-accounts/**` 与发布任务的 GET 路由允许 celebrity / aiavatar（显式应用头、ACTIVE 开通、原本人归属校验）。发布任务的所有写操作仍走原 celebrity 规则。没有独立 Studio 草稿持久化和成片来源适配时，必须标【待建设】，禁止调用创建发布任务来伪装保存草稿，也不能依据下载/复制显示已发布。新增场景入口仅创建原生模板画布副本，不构建另一套带货项目与进度真值。

### Studio 视频上传兼容（2026-10-17）

普通视频节点提供本地上传与替换，复用免费 `media-import`；保留节点ID、标题、位置和引用连线，上传成功清除旧任务指针，后续解析/拉片读取新视频key。上传中禁用重复选择，失败保留原内容，保存失败保留已上传节点并提示重试保存。MP4 内可读的 HEVC/H.265、MPEG-4 等非 H.264 画面或非 AAC 音轨由服务端自动转换；仅音轨不兼容时复制 H.264 画面，免二次画面压缩。转后重新 ffprobe 验画面/编码/音轨存在性/时长差≤0.5秒与字节大小，通过后才存储及计配额。转码失败返回 `STUDIO_VIDEO_TRANSCODE_FAILED`，临时文件清理，不产生模型调用或积分扣费。沿用60秒/128MiB/2400万像素上限。

### 后台独立测试账号

仅当前有效 SUPER_ADMIN 可创建、查看、停用测试账号并生成两分钟一次性登录入口；操作写审计。身份真值和随机 UID 由 ID 创建，保留 `TEST_` 命名空间，不占真实手机号或伪造验证；签名令牌携带 `test_account:true`。产品只有在 RS256 验签且 UID 命名空间也匹配时才设置测试上下文，允许免真实手机测试；普通游客和其他令牌不能借 claim/请求参数获得豁免。RBAC、企业唯一归属、产品开通、模型/在途和积分账本规则不变，不自动赠送积分。后台测试账号入口不等于运营附身，也不能进入平台后台。

## Studio 对话 agent 与计划执行（2026-10-18，本地实现，未发布）

真源 `docs/ip-studio-conversational-video-recreation-plan.md`；接口见 `openapi.yaml` 的 `/v1/ip-studio/studio/skills`、`…/conversation*`、`…/plan-executions*`。

1. **一轮对话 = 一条父 run（kind `studio-dialogue`）**（受理条件与冻结额 2026-10-23 起以第 30 条为准）。受理条件：按量售价存在，`maxCost` 必填且足够最低回复预算，付款选择合法；低于当前默认额度时按该金额缩减本轮 Token 额度、冻结与快照，单价不变，不自动提高用户批准金额；afterCommit 派发。结束时在同一事务里条件更新终态并按**真实用量**结算、余量退回；失败全额退回。用户停止：已完成的模型调用按真实用量结算，被中断的那段流不计费、不按字数估算。父 run 只结算自己的模型调用；工具产生的子 run（拉片 / 出图 / 出片 / 检查）各自冻结结算，预算汇总按真实收费引用去重，不重复相加。
2. **模型输出不是授权**。方案（`plan` 块）、确认卡（`approval` 块）、问题、改稿建议都只是消息块；只有用户点确认卡或明确回复，服务端才把 `confirmationMessageId`（本线程助手消息上的那张卡）与计划指纹绑定成授权。旧卡不能批准新修订；预授权范围内不再发 `approval.required`。
3. **技能边界由服务端强制**：计划步骤的 operation 必须在技能当前阶段白名单内（白名单取自技能 YAML 头 `operations`：参考视频复刻 analysis：recreation/text、production：text/image/video/check/assemble；出图 production：text/image；写剧本与文案 production：text；出视频 production：text/image/video/check/assemble，三者 analysis 为空），`settings` 按操作类型化校验，步骤上限 `limits.maxSteps`；模型不得填报价、批准、执行状态与任务身份。方法示例不是白名单，新方法名不触发拒绝。
4. **提交前预算**：每步提交前在执行租约内核对 `本阶段已消费 + 在途占用（已受理未结算 run 的已批准 maxCost）+ 本步报价 ≤ 本阶段已批准上限`；不满足则不提交、不冻结，步骤 `needs_user`、执行暂停，返回 402 `STUDIO_PLAN_BUDGET_EXCEEDED`（`stage, spent, inFlight, quotedCost, approvedCap, shortfall`）。`autoFixCap` 是制作阶段上限内的子额度。付款模式、企业 id、授权快照在确认时写入不可变 `billing_json`，每步原样携带；换付款人只能结束原执行另建。线程绑定了进行中的执行时，**父对话轮次也由这次制作的付款人付款**（它计入同一阶段预算）：消息不带付款人就用执行的，带了别的付款人 → 409 `BILLING_SELECTION_CONFLICT`，不冻结（2026-10-19 Codex 发现此前会按消息里的个人付款受理）。超出上限停下后，执行器发的「追加预算」卡一经确认（按钮或文字），因预算停下的步骤（`budgetBlocked`）回到待提交、执行自动继续，不用再点「继续」；用户自己的暂停保持暂停，因其它原因待处理的步骤不受影响。
5. **三处真值**：`ip_plan_execution` 只存编排（阶段、步骤、依赖、runId 列表、尝试次数、预算与占用、付款绑定、租约、状态）；`IpRun` / 原生媒体任务 / 账本存执行与费用；画布文档存用户内容与节点上的 `execution` 绑定。服务端不写画布文档，产物通过 `node.upsert` 事件由前端幂等投影；用户手改过的文字不会被覆盖。
6. **推进与恢复**：租约 CAS（`lease_owner / lease_until / lease_version`），启动扫描、定时唤醒、用户继续共用同一入口；`paused` 只刷新已有 run 不提交；`cancel` 停止新增提交并取消可取消任务；`deadline_at` 90 分钟到点标 `partial`，已受理任务继续查询结算。每步 `clientRequestId` 由 `executionId + stage + stepId + attempt` 派生，重复唤醒不重复提交。
7. **检查三态**：`check` 是文本类 run，`output.check.status ∈ pass|fail|unknown`，逐项带真实采样时刻的证据；缺依据不判通过；首版 `autoFixChecks` 为空，检查只建议，用户 `accept` 不改写 AI 结论。检查的目标说明由执行器组装（`StudioPlanSteps.checkTarget`）：被检查那一步的指令 + 已确认方案的「改变 / 保留」+ 规划写的检查要点，检查员以其中的替换对象为准，画面仍是旧主体判 fail、看不准判 unknown（2026-10-19 线上：只给了规划的一句话，检查员看到「三位成年男性」仍判没有旧人物）。
8. **事件与流式**：`message.delta` 只能来自供应商真实增量（不支持流式的端点一次给出完整正文）；事件只在对应状态提交后发布；`turn.done` 不等于作品完成。SSE 断线不取消任务，`afterSeq` / `Last-Event-ID` 续播，游标过期 410。
9. **拉片段长**：`recreation.maxSegmentSec`（数字或 `model`）接入段数 / 连续 / 覆盖校验，显式秒数不能超过所选视频模型合同上限；不能同时满足 → 400 `STUDIO_SEGMENT_TOO_LONG`，不冻结。
10. **端点能力**：`chat_supports_tools / chat_supports_streaming` 由后台显式声明，NULL 视为不支持，不按模型名猜测；端点开流式但不回用量 → `AI_USAGE_MISSING` 失败并退回。
11. **错误码**：`STUDIO_SKILL_NOT_FOUND`(404) · `STUDIO_SKILL_OPERATION_NOT_ALLOWED`(400) · `STUDIO_PLAN_STALE`(409) · `STUDIO_PLAN_BUDGET_EXCEEDED`(402) · `STUDIO_PLAN_EXECUTION_BUSY`(409) · `STUDIO_PLAN_EXECUTION_NOT_FOUND`(404) · `STUDIO_PLAN_INPUT_MISSING`(400) · `STUDIO_PRODUCTION_NOT_AUTHORIZED`(403) · `STUDIO_SEGMENT_TOO_LONG`(400) · `STUDIO_CHECK_TARGET_INVALID`(400) · `STUDIO_VIDEO_MODEL_UNAVAILABLE`(503) · `STUDIO_SOURCE_AUDIO_UNAVAILABLE`(503) · `STUDIO_THREAD_NOT_FOUND` / `STUDIO_MESSAGE_NOT_FOUND` / `STUDIO_APPROVAL_NOT_FOUND`(404) · `STUDIO_APPROVAL_AMBIGUOUS`(409) · `STUDIO_EXECUTION_NOT_ACTIVE`(409) · `STUDIO_EVENT_CURSOR_EXPIRED`(410) · `AI_TOOLS_NOT_SUPPORTED` / `AI_STREAM_INCOMPLETE` / `AI_USAGE_MISSING`。
12. **父对话计入阶段预算**（2026-10-23 起作废：对话费用不计入制作预算，见第 30 条）（2026-10-18 Codex 验收 D06 后改）：线程绑定了运行中 / 暂停 / 待用户处理的执行时，对话轮次受理前先核对「已花 + 在途 + 本轮费用上限 ≤ 本阶段上限」，放不下 → 402 `STUDIO_PLAN_BUDGET_EXCEEDED`（带差额），不冻结不建 run；受理后按上限计在途、结算后按实际积分计已花，按 run id 去重；`dialogueSpent / dialogueInFlight` 是其中父对话的份额，已含在总数里。第一次确认之前的规划对话不属于任何阶段，由自己的 maxCost 授权；分析结束后规划制作方案的对话算在分析阶段。模型没给上限时默认总上限 = 报价 + 重做额度 + 一轮对话费用上限（卡片 `dialogueReserve`）。
13. **确认卡的版本约束**：出现新的计划修订或新的待确认卡时，其余待确认卡在线程锁内改为 `superseded` 并推送；确认时卡片指纹必须等于线程当前最新计划的指纹与修订，否则 409 `STUDIO_PLAN_STALE`；`approvalId` 与 `confirmationMessageId` 必填（缺 → 400 `STUDIO_INPUT_INVALID`），消息不存在 / 非本人 / 没有这张卡 → 404 `STUDIO_APPROVAL_NOT_FOUND`，已确认 / 过期 / 被替代 → 409。确认时写入实际批准的 `approvedBudgetCap / approvedAutoFixCap / approvedPlanRevision / approvedAt / approvedByMessageId`，`budgetCap / autoFixCap` 保留为提议值。
14. **自然语言批准**：`confirm_approval` 工具只认本轮用户自己发的消息；卡片必须出现在该消息之前且是唯一一张待确认卡（否则 409 `STUDIO_APPROVAL_AMBIGUOUS`）；消息必须含明确的批准词（确认 / 开始 / 按这个 / 同意 …），含提问、犹豫、推迟（「等我通知」「稍后」）或改方案（「只修改」「改成」「先不生成」）的词一律不算批准（Codex 复验 R2-01）；**用户说出的预算数字优先**：消息里出现「上限 / 预算 / 不超过 N」或「N 积分」时，生效上限必须正是用户说的数，模型传入的数字无论高低都不能覆盖（R2-02）；上限与卡片提议不同而用户没说这个数 → 拒绝；不能低于报价；付款人用卡片上的；之后走与按钮完全相同的确认路径，`confirmationMessageId` 记用户消息。
15. **后台制作中的新消息**：执行运行中（即使没有进行中的轮次）收到的新消息存为该执行的排队转向（`queued`，无 turnId）并唤醒执行器；执行器在提交下一步前读到它就停在 `needs_user`（「收到新指令，等待重新确认」）并开一轮回复该消息的对话；每条转向只处理一次，用户确认新阶段 / 提高上限 / 继续后视为已处理。暂停或待用户处理的执行本来不提交步骤，此时消息按普通对话处理。
    - **制作中改方案**（2026-10-19）：转向后对话给出同一阶段的新一版计划，确认它的卡就在**原执行**上换掉剩余工作（付款人、阶段不变）：新计划里 id 和内容都没变、且已做完或还在生成的步骤保留结果不重做；内容变了的、新增的、以及依赖它们的下游步骤重新做（新的请求身份 `attempt+1`，原 run 记入 `previousRunIds`，费用仍计入本阶段）；旧计划有、新计划没有的步骤，没跑过的删掉，跑过的保留记录。要改的步骤还在生成中 → 409 `STUDIO_PLAN_STALE`（等它做完再确认），已交给厂商的任务不改写。新上限必须覆盖「已花 + 在途 + 要重做 / 新增步骤的报价」，否则 402，什么都不改。
    - **打字停止 / 暂停**（2026-10-19）：有回复或执行在进行时，整句只是停止 / 暂停指令的消息（「停」「先停」「停止吧」「不做了」「取消」/「暂停」「先暂停一下」「停一下」，去掉标点、开头的「请 / 好的」和句末语气词后整句比对；带问号或「吗」、「不要停」、带别的内容的句子都不算）走与停止按钮相同的优先控制：停止 = 停止提交并取消可取消的排队任务，暂停 = 只停止提交；消息照常留在线程里并回一句结果，不开模型轮次、不扣费，幂等于 `clientMessageId`。没有任何东西在进行时它就是普通消息。
16. **完成收尾**：执行进入 done / partial / failed / canceled 时只发一次总结消息（各阶段实际花费含对话份额、做完与未完成步骤、未通过或无法判断的检查、从真实产物推出的 2–3 条建议 `suggestions`），随后 turn.done；「提高上限」卡与分析编排出的制作方案卡都是真实助手消息。
17. **端点解析一处**：`AiModelInvocationService.resolveAcceptedEndpoint`：不指定模型用默认绑定、不要求 candidate；指定端点必须是启用 candidate 或当前默认绑定；对话受理、对话 worker、Studio worker 共用，不可用在冻结前报错并说明去哪配置。
18. **技能注册表（S3）**：`ip_skill` / `ip_skill_version`（V63）是真值，`resources/studio/skills/*.md` 只是种子：技能不存在时按文件建 v1；只有「从未被后台改过」的技能才会在文件变化时追加新的 seed 版本并成为当前版，后台一经发布 / 回滚 / 改状态就以库为准（文件变化只记日志）。版本不可变（发布 = 追加新版本），当前版缓存 60 秒；`withdrawn` 的技能不能被新对话或新执行选中，在途执行照旧用自己的快照；最后一个启用的技能不能停用或改成草稿（409 `STUDIO_SKILL_LAST_ACTIVE`）；同时只能有一个 `triggers.default` 技能（409 `STUDIO_SKILL_DEFAULT_CONFLICT`）。后台试跑只跑规划提示词、不计用户费用、未配端点 → 503，不产假计划。
19. **多技能路由**（2026-10-20「意图直达」改写，本地未发布；设计真源 `docs/ip-studio-dialogue-intents.md`）：
    - **技能目录**：出图 `image-generation`、写剧本与文案 `script-writing`、出视频 `video-generation`、参考视频复刻 `reference-video-recreation`。前三个 `operations.analysis: []`，是**直达技能**（`StudioSkill.direct()`），起始阶段 production；复刻起始阶段 analysis。不允许 `check` 的技能 `checks` 可为空（目录校验按「是否有阶段允许 check」判断）。
    - **写作意图先判**（2026-10-21）：消息里写作动词（写 / 改 / 改写 / 润色 / 扩写 / 精简 / 优化 / 拟 / 编 / 做 / 出 / 想 / 来 / 列，「起」只在数量前）在同一分句里直接带文字产物（文案 / 卖点 / 标题 / 口播 / 脚本 / 台词 / 剧本 / 简介 / 广告语 / 旁白 / 分镜 / 小传 / 人设 / 标语 / 话术 / 大纲 / 故事 / 文字…）时，归写剧本与文案（`StudioSkillRouter.WRITING_SKILL`），带图片、视频素材也一样（「用这张商品图写三条卖点文案」「做个视频脚本」）。不算写作意图：文字是图或视频的一部分（「做一张带标题的海报」「做个口播视频」「海报上的标题」「写上标题」）；这句话**先**要了图、视频或复刻（「画一张海报，上面写标题…」「做一条视频，先写个脚本」），这时写稿技能的关键词也不计分，按其余技能打分。已有的素材（「拍的 / 做好的 / 生成的」）不算先要了别的。
    - **打分**（`StudioSkillRouter`）：关键词每命中 +2、素材类型每命中 +1（**词优先于素材**）；唯一最高分胜出。素材只在文字点名了事之后加权：「照这条做一段视频」+ 参考视频是复刻。
    - **没命中**（文字一个关键词都没命中，钉了什么素材都算没命中）：沿用线程当前技能（「再来一张」接着出图；钉着做好的片段说「合成一条成片」不会因为钉的是视频就跳到复刻）；线程没有技能就不绑（「全能创作」，模型需要时用 `read_skill` 自己选）。只有一个启用技能也一样，技能不是兜底（2026-10-19 本地验收：只上架复刻时「做一张宣传图」被绑成复刻）。
    - **平手**（2026-10-21 起）：一律不绑，当前技能在平手者里也不沿用；线程清掉 `skillKey / skillVersion / stage`，本轮不带技能，模型按意图表与技能摘要用 `read_skill` 选（未选定方法时先选定、可与看图同一批，选定前不提问）。**不再返回 400 `STUDIO_SKILL_REQUIRED`**；`triggers.default` 只作为给模型的提示，不做平手裁决（同时最多一个启用的 default 仍由后台 409 `STUDIO_SKILL_DEFAULT_CONFLICT` 守）。
    - **按任务绑定，不按线程绑定**（2026-10-23 起以「不锁方法」为准：有活跃执行时也按意图换方法）：线程没有活跃执行（running / paused / needs_user）时，每条消息重新路由（显式 `skillKey` 也可换，须为启用技能），命中别的技能就改写 `thread.skillKey / skillVersion`，`stage` 改为新技能的起始阶段；有活跃执行时方法不变，显式带另一个 `skillKey` → 400 `STUDIO_INPUT_INVALID`。执行结束解绑时清掉线程 `stage`。`read_skill` 在没有活跃执行时同样可以换方法。分叉线程的 `stage` 取技能自己的起始阶段。
    - **直达技能一张卡**：`propose_plan` 对直达技能填 `stage=production`（省略时取线程当前阶段，直达技能绑定后即 production），不要求先有执行，填 `analysis` 被拒；直达技能的制作计划可以没有 `approaches`。`POST …/plan-executions` 收到 `stage=production` 且无 `executionId` 时，先按计划定位技能：直达 → 执行直接以 production 阶段创建（步骤、预算、授权快照与分析阶段同一套代码）；非直达 → 400 `STUDIO_INPUT_INVALID`（与原行为一致）。文字确认（`confirm_approval`）同样放行。同阶段换计划（`replanStage`）只在计划有 `recommendedApproachId` 时核对 approachId。
    - 写剧本与文案的短稿（1500 字以内）不走计划：对话模型当轮写好，`create_nodes` 放进画布，无确认卡。
20. **技能草稿蒸馏**：只有运营（`operatorRole`）能对已完成 / 部分完成的执行发起；按 Token 计价的文本 run，模型只看**抽象信号**：方案的 id / 是否推荐 / 是否确认 / 保留·改变·取舍的条数 / 能力名，步骤的操作类型 / 方法名 / 状态 / 尝试与采用情况，检查项 id 与三态结论；方案标题、摘要、理由、保留 / 改变 / 取舍句、步骤标题、原因、备注都**不进模型输入**（它们会复述用户的需求原话，Codex 复验 R6-01），同时进私有片段表，模型若复述也会在落库前被剥掉；提示词原文、用户原话与存储 key 更不会出现（服务端再剥一遍 URL / key / id）；产物存为 `draft` 版本（source=distilled，保留基础版本的 YAML 头），不改当前版本与状态；发布是后台动作，且基础版本必须仍是当前版（否则 409 `STUDIO_SKILL_DRAFT_STALE`）。
21. **已知边界**：制作中换计划由模型按提示词重新整理（没有服务端按转向内容自动重编译）；视频步骤用默认 Studio 视频模型；技能缓存多节点可滞后 60 秒。
22. **动作协议的写法**（2026-10-20）：不支持原生工具调用的端点用 `<<<studio-actions>>>` + JSON 数组；`<tool_call>{…}</tool_call>` 与 `<studio-actions>[…]</studio-actions>`（含下划线、大小写）按同一协议解析，标签体可以是一个对象或数组，标签前后的正文照常显示（流式在闭合标签后继续推送）。未闭合（含外层标签没闭合、里面却有完整的内层标签）、JSON 无效或之后还有多余内容、缺 tool、args 不是对象、超过 8 个动作 → 整批不执行并要求模型重发；解析与流式过滤是同一个从左到右的扫描，`<<` 开头的标签写法属于标记本身；连续 2 次纠正后仍不对，本轮停在「格式不对，没有执行任何操作」（不再继续花钱重试）。正文模仿服务端工作记录（「[查看画布：done，…]」「[提问：…]」）同样按格式错误处理：没调用工具就不能出现执行记录。近期对话里的工具记录改为单独一行「（服务端记录……）」中文状态，不再内联英文状态。
23. **看图（`view_images`）**：素材清单只有名称、提示词和摘录，**不含画面**；要描述图片内容只能调用 `view_images`（一次最多 4 个对象、共 8 张画面，视频取 4 帧）。图片按本人资产 key 校验归属后由服务端读取字节、以内联数据交给本轮对话端点，不出签名 URL、不出 key；端点必须在后台声明 `supportsVision`，否则返回 `STUDIO_VISION_UNAVAILABLE` 并要求模型如实说明看不到；调用计入本轮 token 预算（预算不够直接拒绝，不另收费、不生成任何东西）。
24. **节点规格（`studio.spec`）**：`create_nodes` / `update_nodes` 可在图片 / 视频草稿上写 `aspectRatio`（9:16 / 16:9 / 1:1 / 3:4 / 4:3 / 2:3 / 3:2 / 21:9）、`durationSec`（视频，1–60 的整数秒，拒绝小数和字符串）、`count`（整数 1/2/4）与 `references[{nodeId,role}]`（role：character / scene / product / frame / style；只能是画布上已有画面的图片或视频，编号不存在直接拒绝）。references 是**完整清单**：给出时替换该节点原有的图片 / 视频 / 音频输入边（「换成 B」只留 B，`[]` 清空），不给时保持不变；局部更新只改给出的字段，其余规格保留。role 决定用法：`frame` 依次是首帧、尾帧（最多两张），人物 / 场景 / 商品 / 风格素材使视频走全能参考，不按画布顺序猜首尾帧。生成面板按 spec 打开；所选模型做不到的值在提交前明确提示并给出可选修正，**不静默改写**。`update_nodes` 不改正在生成的节点；节点已有提示词时新提示词只作为改稿建议。
25. **模型已下架**：视频供应商返回 `400 model_delisted` 映射为 `VIDEO_MODEL_RETIRED`（「这个视频模型已被提供方下架…请换一个模型」）。同一端点 + 模型在 24 小时内（进程内记忆，重启后由下一次提交重新得知）的新提交在冻结积分之前直接 409 `VIDEO_MODEL_RETIRED`；已受理任务的查询不受影响。前端对这类失败不再提供「重新生成」，只提供「换模型重试」，生成面板不再预选该模型。
26. **一张画布多段对话**（2026-10-20，本地未发布；设计真源 `docs/ip-studio-new-canvas-and-threads.md` §3）：
    - **当前那段**：`GET …/conversation` 返回本人这张画布里最近打开（`last_opened_at`）的那段；只有新建、打开某段（`POST …/open`）、「从这里重新开始」会把它设为当前。**读取不改当前**：按 id 读快照（`GET …/conversations/{threadId}`）与读消息（`GET …/messages`，带不带 `beforeSeq` 都一样）都是只读，断线重连、轮询、补拉、分支的原对话预览都走它们，在途的旧请求或停在另一段的第二个标签页不会把当前对话切回去（Codex 评审 2026-10-20）。列表、新建、打开都先保证主线程存在并导入旧记录。
    - **列表** `GET …/conversations`：只列有消息的对话，加上当前那段（哪怕还没有消息）；按最后活动时间倒序（`lastActivityAt` = 最后一条消息时间与这段对话创建时间取较晚的那个：分支复制来的消息保留原时间，刚分出来的分支按分出的时刻排在原对话前面；空对话即创建时间），最多 50 段，超出时当前那段仍保留在末尾。名称取第一条有文字的用户消息（压掉连续空白，最多 24 个字符、按码点计，超出加「…」），还没说过话是「新对话」；条数是打开后时间线显示的全部消息（含系统提示与排队中的用户消息）；「进行中」= 有回合正在回复，或由这段对话创建的制作处于 running / paused / needs_user。查询条数固定（线程、分组计数、首条用户消息、活跃制作各一次），不随对话数增长。
    - **新建** `POST …/conversations {clientRequestId}`：同人同键幂等（重放返回那段并再次设为当前）；键已用于别的画布或「从这里重新开始」→ 409 `STUDIO_REQUEST_CHANGED`；不合法 → 400 `STUDIO_INPUT_INVALID`。本人在这张画布已有一段没有消息、没有进行中回合或制作、不是分支、没有技能的对话时复用它（取最新创建的），不再建新的；复用不改它原来的请求键，重放按同一规则回到同一段。并发新建按画布行锁串行，只会多出一段空对话。新对话不继承技能、不复制消息。
    - **读取** `GET …/conversations/{threadId}`：本人 + 画布校验（不存在 / 不属于本人 / 不在这张画布 → 404 `STUDIO_THREAD_NOT_FOUND`，画布不是本人的 → 404 `IP_PROJECT_NOT_FOUND`），对齐已失效的回合后返回快照，不设为当前。
    - **打开** `POST …/conversations/{threadId}/open`（请求体可为空）：同样的校验，设为当前，对齐已失效的回合后返回快照。只由用户在「历史对话」里点一行时调用。
    - 这些接口都**不调用模型、不冻结、不扣费**。当前这段正在回复、有制作在跑 / 暂停，或确认卡正在提交（从保存画布到执行创建请求返回或确认失败）时不能新建或切换；反过来切换请求在途时确认卡也不能提交。**都由前端拦**（画布节点按当前对话的事件流写入，切走会漏掉还没收到的节点）；服务端不拒绝，切走后原对话的回复与制作照常进行和结算，切回时从服务端恢复。前端对每个属于某段对话的请求（分页、执行查询与轮询、快照补拉、确认）记下发起时的画布、对话与切换代次，回包时已不是这段就丢弃。

27. **结果落到为它准备的对象**（2026-10-21，设计真源 `docs/ip-studio-new-canvas-and-threads.md` §6.1；线上 IPP-655ea55a 执行器另建了结果节点，助手建的视频节点成了空壳）：
    - 计划步骤可带 `targetNodeId`。规划时只做形状检查（在素材清单里、image / video / 写稿 text 步骤、同一计划里一个对象只给一步），不合格就去掉并写日志，不拒绝计划。
    - 确认（建执行、确认制作阶段、确认改过的方案）时按**已保存的画布**绑定：点名的对象在画布上、类型与结果对应（image→图片、video→视频、text→文字）、还没有产物（没有画面 / 正文，不在生成中，不是别的执行的输出）、没被本次制作的别的步骤占用才绑定，否则丢弃绑定并写日志（不报错，这一步照旧用自己的节点）。模型没点名时，只有「本对话助手用 create_nodes 建的、还空着的同类对象正好一个，且同类步骤正好一个」才自动绑定，有歧义不绑。check / assemble / recreation / plan-compile / 改稿步骤不绑定。
    - 绑定后步骤状态的 `nodeId` 就是这个对象：生成任务 `node_id`、执行接口的 `steps[].nodeId`、`node.upsert`（`op=update`，客户端保留标题、尺寸、规格与连线）、依赖连线、后续步骤的引用解析与恢复都用它，不再补一个重复节点。改过的方案重做同一步时沿用原对象。
    - 每个结果节点（新建或绑定）带这一步实际发出的提示词 `metadata.prompt`；对象上已有提示词不覆盖（照 keepText 规则作为可采纳建议），实际发出的以任务请求为准。
28. **首帧只裁不拉**（2026-10-21，§6.2；线上 1024×1024 首帧被 9:16 请求拉成 768×1344）：图生视频的首帧 / 尾帧宽高比与请求画幅相差超过 2% 时，`StudioVideoService.alignFrame` 先按本人归属校验原图（不读别人的文件），再**居中等比裁剪**到请求画幅，存成本人的派生图（`ipstudio_gen/<uid>/…`，按字节判类型）交给厂商；对话执行与手动生成面板（含单首帧旧协议）都经它。请求里保留用户选的原图，裁剪记在绑定 run 的 `_exec.firstFrameAdjusted`（`lastFrameAdjusted`）`{from, to, mode:"crop", sourceKey, croppedKey, sourceSize, croppedSize}`，日志一行。读不出或裁不了 → 400 `STUDIO_VIDEO_FRAME_CROP_FAILED`，不退回原图让厂商拉伸；不改请求画幅、不静默换规格。生成面板在首帧比例与所选画幅不同时就地提示「首帧图是 1:1，会按 9:16 居中裁剪」，所选模型支持首帧那个画幅时给「改成 1:1」，不挡发送。对话与出视频技能写明：有首帧图且用户没说画幅时，画幅跟首帧一致。
29. **一轮的上限**（2026-10-23 起作废，以第 30 条为准）（2026-10-21；线上 `IPR-472ed89b5c174a95808f` 在确认卡发出前一步被 8 次调用上限截停）：一轮对话里，对话模型最多回 **16 步**（`DialogueLoop.MAX_DIALOGUE_STEPS`，只数对话循环自己的模型调用）；工具内部的模型调用（`view_images` 看图、`propose_plan` 规划）与历史摘要不算步，只计入总调用保险 **40 次**（`MAX_MODEL_CALLS`），工具最多运行 **24 次**（`MAX_TOOL_CALLS`，被拒的动作不算）。所有调用都计入本轮 Token 总额（由受理时的 `rate.maxCost` 换算，结算按真实用量）与 **10 分钟**墙钟上限，这两项才是费用与时长的约束，步数只防死循环。连续两步给出完全相同的动作批次（工具名 + 规范化后的参数：键序、空字段、首尾空白、数字写法、调用 id 不算差异），中间没有用户插话，就停在第二批之前，原因 `loop`，重复的那批不执行（只读工具同样适用；中间夹一次格式错误不算隔开）。因上限（步数 / 总调用 / 工具 / 用时 / 用量 / 重复）停下时，轮次终态仍是 `waiting_user`，已完成的调用照常结算；线程里追加一句说明（如「这一轮步骤太多，先停在这里。」），回复带快捷答复「继续」（存于该助手消息、随 `turn.done.suggestions` 下发），用户点它就是发一条普通消息、开新一轮并重新受理计费。格式错误停下（`protocol`，见 22）说明不变、不给「继续」。
30. **对话去掉「继续」**（2026-10-23，本地未发布；设计真源 `docs/ip-studio-dialogue-no-continue.md`）：
    - **只有付费生成停下来等用户**（确认卡规则不变）与模型提问（`ask_question`）。单轮的 16 步 / 40 次调用 / 24 次工具 / 10 分钟 / Token 输入输出分配**全部删除**；用户说「继续」只是一条普通消息，不再放开任何限制（旧 `_exec.continueUntilDone / continuationOf` 照样能读，不再写）。
    - **一条用户消息 = 一个 run = 一条助手回复**，从头做到尾。对话没有自己的预算，钱包真没钱才停。
    - **首笔冻结**：`min(该端点普通文本额度 AiChatTokenPricing.find(endpoint).maxCost(), 付款账户可用余额)`（不用 `findDialogue` 的大额度，避免占住积分让并行的出图出视频误判余额不足）；余额连一次最小调用都不够时照旧 402。客户端 `maxCost` 只记录、**不再回 409 `STUDIO_PRICE_CHANGED`、也不再限额**；付费生成的 `maxCost` 校验与确认卡不变。
    - **追加冻结**：每次模型调用（含工具内部调用与历史摘要）前，「已用 + 本次预估」放不下已冻结总额时，在同一 run 上追加一笔：引用 `runId#n`（REF_TYPE 不变），金额 `min(max(增量额度, 本次所需), 可用余额)`；企业成员用同一成员钱包生成该引用的授权（不计入企业在途任务上限），绝不回退个人钱包；记入 `_exec.holdRefs`。
    - **结算**：结束时按实际用量从各笔冻结依次 commit（先第一笔，用满再下一笔），其余 release；每笔结算不超过该笔冻结额；企业授权逐笔完成。失败 / 停止 / 过期回收释放全部追加冻结；心跳正常时冻结回收跳过 `runId` 与 `runId#n`。
    - **停下来的情况**：追加被拒因余额不够 → 「积分不够了，已经做好的都留在画布上。充值后跟我说一声，我接着做。」+ `notice=recharge|recharge-enterprise`（充值入口）；因其它业务原因 → 直接用该业务错误的中文原话，不加套话前缀；连续相同动作批次第一次给模型一句纠正、纠正后再相同才以 `loop` 结束；格式错误纠正两次仍错以 `protocol` 结束；单个 run 300 次模型调用或 2 小时 → `safeguard`（按失败结束、ERROR 日志、仍按真实用量结算）。结束语都不提「继续」，不再给「继续」快捷答复。
    - **对话费用不计入制作阶段预算**：受理与追加冻结都不登记到执行阶段；执行器不再统计对话 run；确认卡默认上限 = 报价 + 重做额度，不含对话预留。旧数据里的 `dialogueRuns[]`、`dialogueSpent / dialogueInFlight`、`attributedExecutionId` 读到不报错。绑定制作的线程，对话仍由该制作固定的付款人付（D10）。
    - **单轮上下文裁剪**（`DialogueContextWindow`）：每次调用保留系统提示、本轮用户输入与最近 6 轮完整交互，更早的工具结果只留一行摘要，较长的回复与参数截短；估算仍超 80k Token 时只留最近 3 轮、再不行 1 轮。完整交互不被改写。
    - **长文分段读**：钉住 / 附件的文字对象在素材概要里给前 4000 字并写明「全文 N 字…用 read_canvas 带 nodeIds、offset=4000 分段读」；`read_canvas` 对文字对象按 `offset / limit`（默认 8000，最多 16000）返回 `total`、`hasMore`、`nextOffset`。
    - **子任务等待**：`ChildRuns.follow` 最多等 10 分钟；还没完成就告诉模型「已提交，结果会自动放进画布」，这一轮正常结束（不算 limit）。
31. **不锁方法**（2026-10-23，本地未发布；真源 `docs/ip-studio-dialogue-intents.md`「2026-10-23：不锁方法」）：
    - 每条用户消息、每次 `read_skill` / `propose_plan` 都按意图选方法，有活跃制作（running / paused / needs_user）时也一样；显式 `skillKey` 切换不再 400 / 409，`STUDIO_SKILL_LOCKED` 不再产生。文字没命中任何技能时沿用当前方法；平手且有活跃制作时也沿用当前方法。
    - 切换方法时（线程锁内、与绑定新方法同一事务）：新方法与当前制作相同 → 不动；不同且旧制作没有在生成的子任务 → 作废其待确认卡、旧制作按停止收尾（canceled，产出留在画布，不发总结），线程执行指针与阶段清空，按新方法起始阶段出方案；不同且旧制作仍有在生成的子任务 → 不取消，旧制作暂停并与线程解绑，在生成的照常完成、结算并放进原线程的画布，不发任何消息，不占画布，生成完自行结束。
    - 方案含当前方法不允许的操作 → 先换到允许全部操作的方法（意图路由结果优先，其次目录顺序第一个能覆盖的）再校验；任何方法都不允许才失败，失败原因只给模型。
    - 内部原因（`STUDIO_SKILL_OPERATION_NOT_ALLOWED`、`STUDIO_SKILL_LOCKED`、方案校验「第 N 步…」）不进用户界面：工作记录、确认卡接口、执行步骤原因、前端错误详情一律显示「这份方案还没准备好，我会按你要做的内容重新整理。」（工作记录码 `STUDIO_PLAN_NOT_READY`），原文留在日志与 `internalDetail`。
32. **方案素材范围跨轮**（2026-10-24，已生产发布 `20261024-studio-plan-material-scope`；真源 `docs/ip-studio-dialogue-intents.md`「2026-10-24：方案素材范围跨轮」；线上 `PEX-fc87e85770074aa9ad51` 首轮点名「三视图」、隔两轮才出方案，确认后执行的素材名单里没有它，「编排制作计划」三次被拒、用户点「继续」两次撞同一个错）：
    - 对话方案确认时的素材范围（`stepsJson.canvasContextIds`）只由 `StudioPlanMaterials.scope` 算，两条加载路径（dialogue run 的 `output.plan` 与对话消息里的方案块）一样：出方案那一轮点选 / 附带的节点 → 方案顶层 `materialNodeIds` → 方案步骤点名的画布节点 → 同一对话最近 200 条里**用户消息**点选 / 附带的节点（新的在前）；只保留当前画布上还在的，最多 16 个（请求的画布上下文上限），超出按这个顺序截断并写 info 日志。不把整张画布放进来。原生规划 run（`studio-text`）不变。
    - 技能计划可带 `materialNodeIds`（≤16，属于方案正文、计入指纹），分析阶段用它写下制作阶段才用到的素材（替换人物设定图、商品图）。
    - 技能计划引用素材范围以外的画布对象（`referenceNodeIds`、`referenceBindings[].nodeId`、拉片 `sourceNodeId`、`editTarget.nodeId`、`materialNodeIds`）→ 400 `STUDIO_PLAN_MATERIAL_OUT_OF_SCOPE`，`details.nodeIds` 列出全部越界 id（不是只报第一个）。执行里的「编排制作计划」不再把它包成 `STUDIO_PLAN_NOT_READY`：失败任务 `output.outOfScopeNodeIds` 记下 id，步骤带 `materials[{nodeId,title,onCanvas}]`，原因用画布标题说清是哪个（不出现 id），停下的说明给出两条路：加入这次制作重新编排，或不用它重新编排。不自动重试。
    - `resume` 可带 `addMaterialNodeIds`：只接受停下那一步 `materials` 里、仍在当前画布上的节点（否则 400 `STUDIO_INPUT_INVALID`），并入 `canvasContextIds` 后不超过 16（否则 400 `STUDIO_CONTEXT_LIMIT`），只重跑这一步（attempt+1），已完成的拉片不重跑、不再扣费。不带它的「继续」把这些素材记为 `excludedMaterials`，下一次编排的指令里写明不要再用它们，避免一模一样再失败。对话里的 `propose_plan` 仍以整张画布为范围，越界只会是画布上不存在的 id。

### Studio 原生图片编辑与输出尺寸（2026-10-20）

图片请求规格的 `inputMode=multipart` 在有参考图时将经本人归属核验的文件字节按顺序发送至 `referenceSubmitPath`，不把存储 key 或 URL 冒充文件；无参考图仍走 JSON 文生图。客户端可选尺寸完全由 `imageSizes[{size,aspectRatio}]` 投影提供，显式 `size` 在报价/受理时校验并进入执行快照，草稿保留用户选择。单价仍读取 Studio 场景策略，不依据图片尺寸静默改价。未确认的同步提交不自动重投。

图片协议启用 `requireExactOutputSize` 时，返回图片真实宽高必须与受理尺寸完全一致；无效尺寸在候选保存及积分 commit 之前拒绝，原受理不重投。


### 正式图片模型与旧入口兼容（2026-10-20）

旧数字资产与短剧图片使用同一配置化 GPT 原生传输，参考图必须实际读取并上传；读取失败不得退为无参考生成。旧固定画布只在调用方适配尺寸，不放宽 Studio 原生 1K / 2K 输出检查。原 DAP 动作单价、短剧配置价、名片免费规则和 Studio 独立场景价不因更换供应商改变。DAP 运镜父任务拥有原扣费，媒体子任务不重复扣费，恢复查询已保存的原子任务 ID。爆款链接分析必须交给模型实际视频像素，采样范围和缺失音轨明确展示，未知播放/点赞不得编造；无法取视频时直接失败。

### 超管积分直接发放（2026-10-22）

`CreditOpsService` 从当前 `admin_users` 读取 ACTIVE + SUPER_ADMIN，作为超阈值直接发放与历史本人待审单批准的唯一例外；不接受客户端传角色或豁免标志。其他角色仍按原阈值待审，FINANCE_ADMIN 仍受 maker != checker。原因、补偿工单与活动幂等、每日发放限额不变，积分只进 GIFT；直接发放同事务写 APPROVED 审计单，注明超管直发、maker 和账本编号。历史单通过原 approve 路径锁原单，保存真实 checker（可与超管 maker 相同）和超管批准说明，与入账同事务；重复批准返回 REQUEST_NOT_PENDING，不新增第二条账本。无需迁移，不批量处理待审单。

### 模型任务错误披露补充（2026-10-22）

所有模型任务的错误都须向用户披露，不能仅留在后台日志或等到终态才展示：安全原因、错误码、可用的追查号与任务 ID 应可查看/复制；不存在的追查号不得编造。相同自动查询错误去重提示，原始技术响应留在后台追查记录。明确失败及无有效供应商回执而按失败结束的任务允许用户修改后重试；已受理但查询失败仅查询原任务。无回执故障保留专门告警，平台承担请求可能已经送达供应商的风险，不能事后补扣已退回的用户积分。

### Studio 单轮对话独立额度（2026-10-22）

本节替代 Studio 对话 1 / 29 中与普通文本共用的额度口径。`ai.chat-token-pricing` 继续提供输入 / 输出单价和普通文本额度；`studio.dialogue-token-budget` 仅配置整轮对话累计上限，缺省输入 1048576、输出 65536 Token。配置形状 `{ "maxInputTokens": 1048576, "maxOutputTokens": 65536, "endpoints": { "端点ID": { "maxInputTokens": 1048576, "maxOutputTokens": 65536 } } }`，端点覆盖优先，否则取全局值；输入须为 1–2000000 的整数、输出 256–2000000。

capabilities 每个文本模型分别回 `tokenPricing` / `dialogueTokenPricing`，对话批准上限、提交冻结与制作阶段对话预留只取后者；改稿 / 剧本 / 分镜 / 资产提取仍取前者。费率与独立额度受理时一起快照到 `_exec.tokenPricing`，原任务 / 幂等重放不受新配置影响。所有本轮模型调用（含看图、规划、摘要）累计真实用量，单次输出仍受提示词与端点限制；结算与余量释放保持同事务。不自动提高已确认制作阶段的预算。

达到累计用量保护时，追加提示「本轮对话已达到用量保护上限，已暂停。已完成的内容已保留，点「继续」接着做；后续按实际用量计费。」并保留原有快捷答复「继续」；用户点击后按原有流程受理新一轮，不自动增加付费调用。步数 / 总调用 / 工具 / 时间 / 重复动作保护保持。无需新表或迁移。

### Studio 明确续接授权（2026-10-22）

仅本人同画布同线程已结束、因 `tokens/steps/calls/tools/time/budget` 受限的任务后，真实用户明确回复「继续」等续接短语时，服务端可保存 `_exec.continueUntilDone=true` 和 `continuationOf`。新任务、附件或另一个画布不沿用，模型输出和客户端字段都不能赋权；幂等重发不再次冻结。原目标与完成的工具结果进入恢复上下文。

确认继续的同一 run 不再按单轮 Token 输入/输出分配、步数、调用/工具次数或时长暂停，累计费用仍不得超过本次已冻结的 `rate.maxCost`；调用前按真实累计用量、预估输入和输出单价收敛可支付输出，最终合并后向上取整。只超 Token 分配、未超费用的有效结果正常结算；超过金额、无真实用量等仍失败释放。真实预算不足为 `limit=budget`，与技术轮次限制区别说明；停止、付款和制作授权、归属校验、重复动作保护不变。原任务快照不修改、不自动重投已受理的媒体任务。

属性式 `<studio-action name="…" args='JSON' />` 与既有动作格式走同一参数、技能、付款授权闸；完整和流式识别同步，不完整 / 非 JSON / 额外属性整批不执行。历史回复仅折叠，不补执行。

### Studio 动作格式恢复（2026-10-23）

回退动作 JSON 只允许删除字符串外一个冗余 `}`，所有有效删除结果必须为同一棵 JSON 树；超过 256000 字符或 256 个闭括号不尝试。缺失内容、多个冗余括号、不同有效解释、重复 JSON 键或多余正文仍整批拒绝。args 旁的参数合入原参数，冲突拒绝；动作仍通过原工具校验、归属、技能与付款授权。无法修复时说明模型执行格式有误及内容已保留，不要求用户重说原任务。发布与真实回放见 `docs/releases/studio-dialogue-recovery-release-20261023.md`。

### 模型折扣与模型赠款（2026-10-25 已生产发布 `20261025-model-grants`）

界面统一叫「模型赠款」（以前的「专享额度」「免费额度」「免费活动」都改成它，后台活动叫「赠款活动」）。

- 现有接入点 ID 是赠款与折扣的唯一适用标识；不按应用、操作、规格或计量单位限制资格。非模型消费不适用。
- 售价沿用现有服务端价格配置；取适用的最优惠一条折扣，不叠加；折后扣该接入点未过期赠款，最早到期优先，不足扣原 gift/license/recharge。
- 赠款绑定个人或企业成员消费钱包，批次独立记账，不进入普通余额、收入、转账或现金退款。企业优惠覆盖全部现有及新成员的企业消费钱包；个人钱包独立。
- 冻结保留价格、折扣、用量、接入点及原资金来源，失败原路释放；过期赠款不会复活。追加冻结沿用原优惠，整笔结算一次取整。重复请求不能重复扣款。
- 新活动仅配置适用接入点、发放总额、单账户额度与有效期，不配置供应商资源或分场景并发。模型列表每行可进入对应赠款与折扣配置。
- 活动发出第一笔赠款后，适用接入点不能再改（400 `SCOPED_CAMPAIGN_TARGETS_LOCKED`），也不能缩短有效期或改计量方式（400 `SCOPED_CAMPAIGN_IMMUTABLE`）；已发的赠款跟着活动走，改接入点等于悄悄改了每个人手里赠款的用途。要换模型就停用旧活动、新建一个。名称、限额、启停仍可改。
- 冻结只锁本钱包里还能用、且适用于这次接入点的赠款行；活动行被所有领取人共用，只在活动有资源计数时才加锁（积分活动从不加锁）。
- 普通积分部分为 0 的模型任务（赠款全额抵扣）不写「冻结 0 / 扣除 0 / 退回 0」的普通流水，记录由赠款流水承担。赠款流水的 `balanceAfter` 是这一笔赠款的余额，界面单独标「赠款余额」，不与积分余额混在一列含义里。
- 零价接入点一律报 503 `MODEL_PRICE_NOT_CONFIGURED`（报价和提交都拒绝，不建授权、不冻结、不调供应商）。想免费送用户体验，只能发模型赠款；这样免费额度有总量和有效期，不会因为把售价配成 0 变成无限免费。
- 接入点没填 `model` 时，计费记录里的模型名用 `endpoint:<接入点 ID>`（`ModelBillingTarget.providerModelOf`），不因此拒绝扣费；资格只看接入点 ID。
- `aep_ledger_entries.entry_type` 是 VARCHAR（V67 + 实体 `@JdbcTypeCode(VARCHAR)`），启动加宽只处理当前是 ENUM 的列，不能把它改回 ENUM。
- 企业成员报价在只读事务里运行，在途任务数用不加锁的查询（MySQL 只读事务里执行 `SELECT … FOR UPDATE` 会报 ERROR 1792）；真正冻结时 `reserve` 在锁内再判一次。
- `/admin/model-billing/{discounts|campaigns}` 分页读写；SUPER_ADMIN、OPERATOR 配置，FINANCE_ADMIN 只读。修改携带 expectedVersion，同事务记录审计；旧价格写入拒绝，现有接入点价格仍为真源。
- 发放沿用原赠送审批、日限额和幂等编号；个人优惠对象不要求已有钱包，企业发放只到成员消费账户。`/me/model-credits` 只允许查看本人钱包。
- 报价确认绑定接入点、用量、费用决定和普通积分上限；赠款被其他任务占用时不得静默提高普通扣费。已受理任务沿用原快照。
- 通用视频固定实际接入点、地址及协议。误判失败、冻结已退回、后来对账发现成功的视频：原冻结用过赠款或折扣的，不能按当前价格补扣，需人工复核原资金来源（`VIDEO_MODEL_RECOVERY_REQUIRES_REVIEW`）；按原价、没用赠款的，照旧另建恢复冻结、按原冻结价结算。


**通用积分转模型赠款（2026-10-25，用户要求把这两天加给客户的积分转成 H3 赠款）**：后台「模型赠款与折扣 → 积分转赠款」，仅 SUPER_ADMIN（服务端再按当前管理员记录判一次，`GRANT_CONVERSION_FORBIDDEN`）。
- 候选：最近 N 天（1–90，默认 3）有已批准赠送 / 补偿单的客户；预览只读。
- 可转换 = min(赠送 + 激活码积分, 总余额 − 保留额)，保留额默认 1000（1 元 = 100 积分，约 10 元）。**充值积分永不转换**，只是计入「总余额」以决定还要不要转。
- 每个客户一个独立事务：锁钱包 → 按 `ADJUST` 账本扣赠送、再扣激活码（`CreditService.withdrawNonCashForGrant`，只许个人钱包）→ 向所选活动发同额赠款（`source=ops_grant_conversion`，`sourceReference=<requestId>:<userId>`），有效期 = min(现在 + 天数, 活动到期)。超出活动总额或单账户限额等失败只回滚这个客户，结果逐行返回原因。
- 同 `requestId` 重试：已转过的客户返回「already」，不重复扣也不重复发。整批写一条审计 `model_billing.grant_conversion`。
当前接入与验证状态见 `docs/model-billing-design.md`，旧资源池及分规格方案已归档。

数字人组合模型消费（用户确认）：文本与图片/视频分别形成模型冻结，分别匹配接入点赠款与折扣；两笔预冻结与作业受理同事务，资金不足整体回滚。文本沿用既有 Token 价并按有效实际用量结算，媒体成功结算原生成价。媒体失败仅释放媒体部分，已完成文本费用保留；未完成文本及未用部分原路释放。默认接入点变更不改动已接受路由，不得自动回退占位。重试使用新的尝试编号，重复结算不重复扣费；月度用量按实际消费流水统计。


### Studio 与导演台模型入口（2026-10-25）

Studio 对话模型只影响之后受理的对话，按现有 script 场景白名单和已发布 Token 费率受理；回复中禁用切换，不篡改已冻结任务的模型。选择按画布保存在浏览器，模型不在可用候选时按服务端默认显示。导演台作品 `settings.imageModel` 为接入点 ID 或 null（跟随默认）；新选择只允许当前 Studio image 场景候选里出图规格同时有 1:1、16:9、9:16 的接入点（没有出图规格的旧模型照旧可选），缺比例 400 `DIRECTOR_IMAGE_MODEL_UNSUPPORTED`。保存时原值照存、不重新校验，也不等于重新授权。返回 `imageModels[{id,name,isDefault,creditCost}]`（可新选的）与 `imageModelState`（实际会用的那个：是否显式、是否可用、缺哪些比例），估价、一键连跑、出图提交、尺寸与参考图限制均采用实际会用的模型及其场景价格。道具 1:1、角色场景 16:9、分镜跟作品画幅，只在该接入点规格里取同比例最大一档；出不了时在建任务、冻结前 400 `STUDIO_IMAGE_SIZE_UNSUPPORTED`（`details.kind/aspectRatio/missingRatios`），不换模型、不跨接入点；停用或不再开放的选择出图 503 `ENDPOINT_NOT_ALLOWED`，须明确更换。价格继续从场景配置读取，不因供应商替换上调用户价格。


### 导演台与视频提示词优化输出预算

导演台写剧本、拆集、提取资产、分镜脚本，以及画布 / 助手 / 导演台的视频提示词优化不再使用业务代码的 8192 / 16384 / 100000 / 4096 输出上限。新任务的输出预算读取后台端点 defaultMaxTokens，受 chatMaxOutputTokens 能力上限约束；仅默认值缺失时使用端点能力上限，两者均未配置时回落后台 Token 售价配置的 maxOutputTokens。Token 单价与输入预算仍读售价配置，输出预算随端点配置形成受理快照；报价、冻结和调用使用同一快照，不能超出调用方批准的 maxCost。已有任务不改预算、不自动重试。

### AI 导演台作品删除（2026-10-28，已生产发布 `20261028-director-delete`）

`DELETE /api/v1/ip-studio/director/works/{id}` 软删除：设 `deletedAt`、`active=false`，作品 JSON（剧本 / 分集 / 分镜 / 候选 / 导出记录）与 `ip_run`、原生视频任务原样保留；不删个人资产库对象和存储文件，不退款、不重提、不重复结算。删除的作品进回收站，可以恢复（2026-10-29，见下节）。

1. **串行**：在作品行锁（`lockById`）内完成归属校验、在途检查、停止流程和软删除；提交任务、一键制作操作、后台推进都先拿同一把锁，删除提交后它们看到 `deletedAt` 一律 404 / 跳过。在途查询与删除**同一事务、同一条连接**：删除入口以读已提交（`READ_COMMITTED`）开事务，拿到行锁后的每条查询都看到最新已提交的任务（MySQL 默认可重复读的快照可能更早，§8.0.1 ⑯）；只取标量列，不受持久化上下文里旧实体影响。**禁止**在持作品行锁时另开 `REQUIRES_NEW` 查询：每个删除都占一条连接再等第二条，并发时连接池会被耗尽（2026-10-28 独立复核以 3 条连接复现，回归 `DirectorDeletePoolTest`）。
2. **在途判定以真实任务为准**，不信作品 JSON 的 `running` / `active`：`ip_run` 非 done / failed（含图片受理待核对的 running）即在途；`done / video.bound` 的绑定记录要查 `_exec.nativeVideoJobIds` 指向的 `material_video_job`，以及作品 JSON 里 `clip.video.pending` 的 jobId。原生任务以 `succeeded` / `failed` 结案即算结束 —— 包括按「模型任务异常状态与并发」以 `failed` 结案的 `VIDEO_SUBMISSION_UNKNOWN`（冻结与授权已释放，不会再有结果，允许删除，否则会永远删不掉）。**尚未结案**的都算在途：排队、提交中、生成中，`errorCode` 为 `VIDEO_SUBMISSION_UNKNOWN`（受理待核对）或 `VIDEO_RECONCILIATION_PENDING`（已有供应商任务、正在重新查询原任务）；原生任务查不到或不属本人，也按无法确认处理、不允许删除。
3. **一键制作**：`running` → 409 `DIRECTOR_WORK_BUSY`「请先停止制作」；`paused` / `waiting` 且无在途任务 → 同一事务标 `stopped`（message「作品已删除，制作已停止」）再删除；有在途任务时不改流程状态。
4. **错误码**：在途 → 409 `DIRECTOR_WORK_BUSY`，message 写明是哪类任务（剧本生成、分镜图生成、片段视频生成、整集导出…）或「受理结果还在核对」；本人重复删除 → 200；他人或不存在 → 404 `DIRECTOR_WORK_NOT_FOUND`（幂等不泄漏归属）。删除后所有作品接口（读、改、编辑、任务、一键制作、报价、估价、上传）→ 404。

### AI 导演台回收站与恢复（2026-10-29，本地未发布）

`GET /api/v1/ip-studio/director/works/trash` 列本人已删除的作品（`deletedAt` 非空，含删除功能上线前就软删的历史作品），最近删除的在前，每项是作品摘要加 `deletedAt`、`running` 恒为 false。只读投影：不回投任务结果、不推进、不改内容和修订号。`POST /api/v1/ip-studio/director/works/{id}/restore` 恢复原作品。不做自动清理、期限、永久删除、清空回收站，不删存储文件。

1. **恢复的是原记录**：原 ID 回到作品列表，剧本 / 分集 / 资产关联 / 分镜 / 生成结果 / 助手历史 / 任务记录原样保留；不复制作品、不重提任务、不扣费、不退款、不新建冻结。
2. **串行**：与删除、编辑、生成、后台推进抢同一把作品行锁（`lockById`），先锁后鉴权；只在本事务、本连接里读写，不走 `view()`（它另开事务读任务列表），持锁不开 `REQUIRES_NEW`。删除与恢复并发时按拿锁先后：恢复先 → 删除等它提交后再删；删除先 → 恢复等它提交后把作品恢复回来。内容都不丢。
3. **恢复后保持停止**：`active=false`，后台调度不扫；JSON 里遗留的 `running / paused / waiting` 一键制作（删除功能上线前的历史软删不会停流程）改为 `stopped`，用户明确开始才继续。
4. **恢复前的任务不在恢复后付费续跑**：恢复写 `restoredAt`。删除前已结束、还没回投的任务在恢复后第一次读取 / 推进时照常回投（结果写进作品、进 `applied`），但在 `restoredAt` 之前提交的任务不再接着派发付费后续：提示词改写完成不自动提交视频（留提示「视频没有自动提交」），改写不合格不自动重试（按失败记下）。恢复之后用户自己发的任务照常。读作品出 wire 带 `restoredAt`（没恢复过为 null），前端有值时不自动发创意对话的开场，等用户点「开始聊」；前端也据它（或本页恢复成功）让删除期间发出、恢复后才以 404 返回的请求失效，不把恢复的作品打回已删除、不清草稿。
5. **幂等**：作品没被删除（重复恢复、超时重试）→ 200，不写任何字段（不改修订号、更新时间、内容，不打断在跑的任务）。他人或不存在 → 404 `DIRECTOR_WORK_NOT_FOUND`，不泄漏归属。
6. **恢复不占新建额度**：作品数上限（200）只拦新建，`POST /works` 的 `DIRECTOR_WORK_LIMIT` 不变；恢复不拦数量。原因：要让上限在并发下严格成立，新建和恢复得先锁同一用户行，而新建持锁时还会经 `view()` 另开连接，正是连接池饥饿的形态；与其放一个并发可绕过的数量闸，不如明确不拦。新建本身的计数也不是并发严格的（既有行为，见 TODO）。

### AI 导演台全能创作助手（2026-10-28，本地未发布）

真源 `docs/ai-director-assistant.md`。

1. **一轮 = 一次导演台文字任务**（节点 `assistant`），按作品所选文字模型按量结算，每轮最多冻结 `pricing.textMax`；同一作品同时只有一条在回复（409 `DIRECTOR_TASK_RUNNING`）。`clientRequestId` 即消息 `clientId`：已存在就直接返回作品，不再建任务、不重复扣费。
2. **范围由服务端核对并命名**；每个范围只允许对应的建议类型（提示词范围不能改剧情）。范围外或引用不存在 id 的建议丢弃并计数，不交给用户。
3. **建议只是建议**：用户 `assistant.apply` 才写入。剧本建议钉在具体一处：选中段落带 `start/end`，原文必须在选区内；没选段落时原文须在该集唯一出现，否则丢弃；采用 / 撤销把位置从回复时（撤销为采用后）的正文快照按行映射到现在的正文：那几行原样还在才改，改过、删掉或同样的行数目变了就拒绝，不按文字去找别处相同的话；删除可撤销；镜头按助手看到时的签名比对；用户自定义过、且与助手看到的不同的提示词 / 资产字段不覆盖。核对失败 409 `DIRECTOR_PROPOSAL_STALE`。
4. **写入效果与手动修改相同**（集修订号、`planStale`、提示词重编、媒体按指纹标需更新），**不触发任何生成**。采用后可撤销，对象之后又改过则不能撤销。撤销数据不出 wire。
5. **生成新版本**是独立的 `asset-image` / `board` 任务（`options.baseOnCurrent=true`），走原报价、冻结、付款、幂等；当前图作为最后一张参考，提示词末尾写明，不承诺局部精确修改；新候选不自动采用。
6. **看图**：只有后台声明能看图的文字模型才交图给模型；否则回复标 `visual=prompt-only` 并提示用户。
7. **写剧本前的创意对话**：一轮一次文字任务（节点 `brief`）；AI 最多问 3 轮、每轮最多 2 个问题，到上限服务端强制收敛；整句「你决定 / 写吧 / 开始生成」或以「直接 / 马上 / 开始 + 写 / 生成」开头的话不再调对话模型，先把这句记进对话、再以同一请求编号写剧本（「写三集」「写实一点」这类回答不算）；「跳过」随时可用（`script` + `options.skip`）。剧本请求带原始想法 + 逐条问答 + 整理要求。首轮编号按作品固定，刷新不重开。有剧本后 409 `DIRECTOR_SCRIPT_EXISTS`。
8. **正文请求期间冻结**：剧本或选区发送从点击发送起，对应正文、集名和摘要只读；后端在作品行锁内按助手 pending 消息校验同一正文的写入，拒绝跨页保存、旧建议采用/撤销及整稿替换（409 `DIRECTOR_SCRIPT_LOCKED`）。完成或失败解锁，发送未知时保留锁定；选区失配直接失效，不搜索同名文字。
9. **发送前先保存**：助手发送前前端先保存这一轮涉及的未保存修改，保存失败不发；保存期间的修改（含撤回成旧内容）都留作草稿，保存回来只清掉仍等于已存值的草稿；请求（编号 + 正文）记在浏览器，结果不确定时按原请求恢复，明确拒绝才作废。

- **导演台资产的自有图（2026-10-28）**：同一张自己的图有两种用法，界面上分开显示。「直接作为资产图」（`asset.upload`，或 `asset.create` 带 `image.use=asset`）：成为采用的资产图（`source=upload`、`adoptedBy=user`），不经过 AI 生成、不扣积分，不会被判「需更新」；分镜图和视频按它出图。已有资产图时前端先确认替换，原版本留在候选历史可换回。「作为参考图」（`asset.setRef`，或 `image.use=ref`）：角色、场景、道具都可以，只在生成资产图时作为图1（角色取长相，场景、道具取外观），不改采用的资产图、不发起生成；设了参考图后，已采用的生成图按指纹标「需更新」，是否重新生成由用户决定。界面用语：分镜图和视频引用的叫「资产图」，生成时参照的叫「参考图」。

- **导演台长正文（2026-10-29）**：剧本正文（未拆集的 draft、各集 content、设定资料）不限字数，新建、PATCH、episode.update、reference.update、助手建议写回、文件导入都不截断、不报超长；存 `director_work.content_json`（LONGTEXT）。正文能存多长和一次模型调用能读多少是两回事：一次能读的字数 = 所选文本模型按量计价里的输入 Token 上限（没配时按 32000）减去 8000 字提示词余量，按 1 字 ≈ 1 Token 估，出 wire 为 `pricing.textChars`。读不下时绝不悄悄只读前半部：AI 拆集、写分镜脚本、重写分镜返回 400 `DIRECTOR_TEXT_TOO_LONG_FOR_MODEL`（不提交、不扣费，说明怎么拆；按分集标题拆分免费、不限长度）；全剧提取资产按集分批，从第一集未提取的集开始放得下几集读几集，`pendingExtract.batch` 写明这批是第几到第几集，结果照常合并，一键制作接着提剩下的；单集一次读不下则同码拒绝。助手只把选区 / 光标（`scope.focusAt`）/ 片段在剧本里的位置附近一段交给模型，模型收到 `contentRange` 说明，消息带 `range` 告诉用户读了第几到第几字；可改正文时消息范围记 `window`，回复里的修改只在这一段里找位置、在这一段里唯一（请求期间正文冻结，位置不变）。设定资料交给模型时只取前 12000 字并注明省略，页面同步提示。分镜图讨论（image·board）与改提示词一样带上本集剧本（同样按位置取一段），发送前先保存本集正文未保存的修改。助手的正文快照按哈希只存一份（`assistantSnapshots`，建议与撤销记录只存引用），超过 50000 字的快照不随作品下发，前端用锚点前后文预览，采用仍按服务端快照核对。页面：一次粘贴超过 30000 字在进编辑框之前拦下（正文不变），提示保存为 TXT 后用「上传剧本文件」导入；超过 60000 字的正文按段编辑（每段约 15000 字），新建作品与粘贴剧本处显示摘要卡；依据见 `docs/ai-director-plan.md`。
