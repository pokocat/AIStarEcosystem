# AI Star Eco — 业务规则与计算公式

> **本文件的角色**：openapi.yaml 描述「数据形状 + 接口形态」，本文件描述「openapi 表达不了的业务约束」——
> 字段校验规则、跨字段计算公式、用户操作时序、错误码规范、状态机映射。
>
> **不再重复定义实体或枚举**：所有数据模型以 `apps/web/src/types/*.ts` 为前端真值源、`specs/openapi.yaml` 为
> 接口契约。本文件只补充 schema 表达不了的约束与业务语义。
>
> **历史**：本文件由 v1.1.0 的 `BACKEND_API_SPEC.md`（1970 行）瘦身而来；原文档中的枚举总表（§1）、
> 数据模型（§2）、接口清单（§3）已迁移到 openapi.yaml + TS types，故此处不再保留。

**文档版本**: v2.0.0  
**对应代码版本**: v2.7.x  
**最后更新**: 2026-05-06

---

## 目录

1. [字段约束与校验规则](#1-字段约束与校验规则)
2. [业务计算规则](#2-业务计算规则)
3. [通用响应格式](#3-通用响应格式)
4. [错误码列表](#4-错误码列表)
5. [前端状态机与接口时序](#5-前端状态机与接口时序)
6. [新领域的业务约束（v2.x）](#6-新领域的业务约束-v2x)

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

对应前端类型：`apps/web/src/types/_shared.ts:ApiResponse<T>`。

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

### 6.1 AI 明星专区（v2.7 / `apps/web/src/types/celebrity-zone.ts`）

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

### 6.2 商品库（v2.7 / `apps/web/src/types/product.ts`）

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

```
apps/web/src/types/*.ts              ← 唯一前端真值源（23 个域文件）
apps/web/src/api/*.ts                ← 调用契约（USE_MOCK 切换 mocks/ vs apiFetch）
specs/openapi.yaml                   ← 后端接口契约（99 个 path、200+ schema）
specs/BUSINESS_RULES.md              ← 本文件：openapi 表达不了的业务约束
apps/server/.../*Dto.java            ← Java 镜像，字段名必须与 TS interface 完全相同
apps/server/.../*Controller.java     ← 最终路由实现（44 个 controller）
scripts/check-api-contract.mjs ← CI 漂移校验（apiFetch URLs ↔ openapi.yaml paths）
```

> CLAUDE.md 第一条硬规则：「Frontend types are the single source of truth」。
> 任何 server DTO / openapi schema 与 TS types 冲突时，以 TS types 为准。

*文档结束 — v2.0.0*
