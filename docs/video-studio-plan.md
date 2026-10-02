# 视频生成区（web-celebrity「AI 创作 → 视频生成」）设计

> **状态**：v0.199 已实现（2026-09-30），本机端到端跑通（见 §7）；**还没接过真实的聚算 H3**。本文件是这块功能的设计真源；接口字段以
> [`packages/types/src/video-studio.ts`](../packages/types/src/video-studio.ts) 为准。
>
> **一句话**：在明星带货工作台里单独开一块区域，把 MiniMax H3 的四种视频生成模式原样搬过来。
> 用户选模式、写提示词、传素材、选规格、看报价、出片、看历史。**不做产品化封装**：
> 没有模板、没有脚本、不绑商品，厂商合同怎么定，这里就怎么开放。

---

## 1. 用户看到什么

侧栏新增一组 **「AI 创作」**，下面一个入口 **「视频生成」**（路由 `/studio/video`）。页面左右两栏
（手机上上下排）：

**左栏：填参数**

1. **模型**：只有一个时直接显示名字；多个时下拉。列表来自后台「AI 模型与 Key」里绑在「视频生成」上、
   且走聚算媒体协议的端点。一个都没有 → 整块显示「视频模型暂未开通」，按钮禁用。
2. **模式**（分段按钮，名字照抄厂商）：
   | 模式 | 厂商取值 | 要传的素材 |
   |---|---|---|
   | 文生视频 | `t2v` | 不传 |
   | 首帧生视频 | `i2v` | 1 张首帧图 |
   | 首尾帧生视频 | `first_last_frame_video` | 首帧图 + 尾帧图 |
   | 全能参考 | `universal_reference_video` | 图片 / 视频 / 音频，按顺序排列 |
3. **素材**（随模式变）：
   - 首帧 / 尾帧：各一个上传位，可预览、可删、可换。
   - 全能参考：一个「参考素材」块，三个页签「图片 n/9」「视频 n/1」「音频 n/3」，列表里每项标编号
     （图1、图2…、视频1、音频1…），可以上移下移、删除。提示：「提示词里可以写『图1』『视频1』说明每个素材的用途」。
4. **提示词**：多行输入，右下角「n / 7000」。
5. **规格**：清晰度（768p / 544p）、画面比例（六种，按钮上带像素，如「9:16 · 768×1344」）、时长（5–15 秒）。
   默认 768p · 9:16 · 5 秒（带货以竖屏为主；厂商默认 16:9）。
6. **高级**（折叠）：随机种子，留空就是随机。
7. **报价 + 生成按钮**：「预计 200 积分（40 积分/秒 × 5 秒）」；全能参考超过 6 张图时多一行「第 7 张起每张 +10 积分/秒」。
   模型列表没加载成功时不显示报价、不许提交（报价与实际冻结必须同源，不回落写死单价）。

**右栏：生成记录**（本区域自己的任务，新的在上）

每条一张卡：状态（排队中 / 生成中 42% / 已完成 / 失败）、模式、规格（768p · 9:16 · 5 秒）、提交时间
（`yyyy-MM-dd HH:mm:ss`，§4.8）、提示词（两行截断，全文放 `title`）、输入素材缩略图、成片播放器 + 下载、
失败原因（服务端给的原话）、积分（进行中「冻结 200」/ 成功「消耗 200」/ 失败「已退回 200」）。
有进行中的任务时每 5 秒刷新一次（页面不可见时暂停）。

**二版加的**（v0.199 同版，用户第二轮要求）：提示词框旁的「智能优化」（默认勾上，按钮变「优化并继续」，见 §9）；右栏多一个「模板」页签，成片可以「存为模板」，运营可发布全员可见的官方模板，任何人可以「做同款」（见 §10）。

**这一版不做**（见 §8）：带平台标识的成片下载、我的素材库。

---

## 2. H3 厂商合同（2026-09-30 读自 docs.jusuanhub.com + Portal 模型详情「API 接入」）

所有数值写在服务端一个类里（`JusuanH3Contract`），前端从 `GET …/models` 拿，**不在前端写死**。

- **创建**：`POST {base}/media/generations`（base = `https://api.jusuanhub.com/v1`），返回 202 + `jobId` / `jobUrl`。
  必填 `model`、`generationMode`、`resolutionTier`、`orientation`、`seconds`；提示词去首尾空白后 1–7000 个 Unicode 字符。
- **规格**：`resolutionTier` ∈ 768p / 544p；每档六种固定画布；`seconds` 5–15 整数；24 FPS，带原生音频。
  | 比例 | 768p | 544p | orientation | outputSizeCode |
  |---|---|---|---|---|
  | 21:9 | 1536×672 | 1280×544 | landscape | `h3-768-21x9` / `h3-544-21x9` |
  | 16:9 | 1344×768 | 960×544 | landscape | `h3-768-16x9` / … |
  | 4:3 | 1024×768 | 736×544 | landscape | `h3-768-4x3` / … |
  | 1:1 | 768×768 | 544×544 | **square** | `h3-768-1x1` / … |
  | 3:4 | 768×1024 | 544×736 | portrait | `h3-768-3x4` / … |
  | 9:16 | 768×1344 | 544×960 | portrait | `h3-768-9x16` / … |
  - ⚠️ 1:1 的 `orientation:"square"` 取自 Portal 生成的调用示例；公开 OpenAPI 的枚举只写了 landscape / portrait。
    按 Portal（它按服务实时合同生成）走，**未实测**；上游若拒收，错误原话会直接显示给用户（§5.4）。
  - Portal 示例同时发 `aspectRatio` 和 `outputSizeCode`，我们照发。
- **素材**：先 `POST {base}/assets/input?model=<别名>`（multipart，字段名 `image` / `video` / `audio`）换 `asset.assetId`。
  - 首帧 / 尾帧图：各 1 张，≤16 MiB，PNG / JPEG / WEBP；字段 `input_image_asset_id` / `end_image_asset_id`。
  - 全能参考 `referenceInputs[{role, mediaType, assetId}]`（role = `reference_image|reference_video|reference_audio`）：
    图 0–9（≤30 MiB，PNG/JPEG/WEBP；**有视频时最多 8**）、视频 0–1（≤50 MiB，MP4）、
    音频 0–3（≤15 MiB，WAV/MP3/FLAC/AAC/OGG/M4A/MOV；每段 2–15 秒，合计 ≤15 秒）；
    总数 ≤12，视觉素材（图+视频）≥1，**同一素材不能重复**，同类按顺序编号。
- **随机种子**：`seed` 可选整数 0–2147483647。
- **价格**（Portal 标价，限时 5 折前）：768p 40 积分/秒，544p 20 积分/秒，四种模式同价；
  全能参考前 6 张图含在单价里，第 7 张起每张每秒 +10。
- **不接**：`fps` / `frames` / `width` / `height` / `steps`（厂商明确不许传）。

---

## 3. 计价（v0.199 二版：**我们自己定、后台可配**，不照搬厂商价格）

> 一版曾按厂商价格结构等比换算（544p 减半、第 7 张图起加 ¼），用户明确否掉：「不要参考他们的定价，我们自己定，配置化」。

**配置在哪**：平台配置 key `celebrity.video-studio-pricing`（JSON，形状 = `VideoStudioPricingConfig`），
后台「明星带货 → 引擎定价」新页签「视频生成」编辑；`GET / PUT /api/admin/celebrity/video-studio-pricing`
（角色同现有 `/api/admin/celebrity/action-pricing`）。整份替换，改完缓存立即失效（60 秒 TTL，同动作单价）。

```json
{
  "perSecond": {
    "t2v":                       {"768p": null, "544p": null},
    "i2v":                       {"768p": null, "544p": null},
    "first_last_frame_video":    {"768p": null, "544p": null},
    "universal_reference_video": {"768p": null, "544p": null}
  },
  "freeRefImages": 0,
  "extraRefImagePerSecond": 0,
  "promptOptimizationPerCall": 0
}
```

- `perSecond[模式][清晰度]`：积分 / 秒，整数 1..100000；**null = 这一格不单独定价，按后台给这个模型配的每秒价**
  （候选 `creditCostOverride` 且端点 `PER_SECOND`；**`creditCostOverride` 为 0 算没配，不算免费**）。模型也没配每秒价 → 这一格**未定价**：下发给用户的 pricing 里是 null，
  前端不报价、不许提交，服务端提交 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`（文案告诉运营去哪配）。**不回落任何写死的价**（§8.0）。
- 全能参考加价：前 `freeRefImages`（0..9）张不加价，之后每张每秒加 `extraRefImagePerSecond`（0..100000，0 = 不加）。
- 智能优化：每次 `promptOptimizationPerCall`（0..100000，**0 = 不收费**，同「AI 脚本起稿」默认 0 的口径；运营设了价才开始收）。
- 种子值（首次启动写入）：上面那份全 null / 0 —— 即「生成按模型单价、不加价、优化不收费」，运营再按需改。

**公式**（服务端一处算，`GET …/models` 把每个模型**回落后**的结果下发成 `VideoStudioPricing`，前端照着算报价）：
生成总价 = (perSecond[模式][清晰度] + max(0, 图片张数 − freeRefImages) × extraRefImagePerSecond) × 秒数（只有全能参考算图片张数），
`Math.multiplyExact`，溢出 → 400 `VIDEO_PRICE_OVERFLOW`。算好的总价以 `credit_cost` 交给 `MaterialVideoJobService.submit` 冻结。
不再有「按条计价」分支。

---

## 4. 接口（全部 `/api/me/celebrity/video-studio`，登录必需；开通闸按 `/api/me/celebrity/**` → celebrity）

| 方法 | 路径 | 入 | 出 |
|---|---|---|---|
| GET | `/models` | — | `VideoStudioModel[]` |
| POST | `/uploads` | multipart：`file`、`mediaType`（image/video/audio） | `VideoStudioUpload` |
| POST | `/jobs` | `VideoStudioJobRequest` | `VideoStudioJob` |
| GET | `/jobs` | — | `VideoStudioJob[]`（新→旧，最多 100 条） |
| GET | `/jobs/{id}` | — | `VideoStudioJob`（不是本人 / 不是本区的 → 404） |
| POST | `/prompt-optimizations` | `VideoStudioOptimizationRequest` | `VideoStudioOptimization`（同一个 clientRequestId 重复提交 → 返回同一条，不重复扣） |
| GET | `/prompt-optimizations/{id}` | — | `VideoStudioOptimization`（不是本人的 → 404） |
| GET | `/templates` | — | `VideoStudioTemplate[]`（官方 + 我的，新→旧，最多 100 条） |
| GET | `/templates/{id}` | — | `VideoStudioTemplate`（官方且在架，或本人的；否则 404） |
| POST | `/templates` | `VideoStudioTemplateCreateRequest` | `VideoStudioTemplate` |
| DELETE | `/templates/{id}` | — | 204（本人删自己的；官方模板本人或任一运营可撤回） |

后台：`GET / PUT /api/admin/celebrity/video-studio-pricing`（`VideoStudioPricingConfig`，见 §3）。

未绑手机号的账号：POST 自动被 `PhoneVerificationGuard` 挡（403），不用另写。

### 错误码（新增）

| code | HTTP | 什么时候 |
|---|---|---|
| `VIDEO_STUDIO_MODEL_UNSUPPORTED` | 400 | 所选端点不在本区模型列表里（不是聚算媒体协议 / 未启用 / 未就绪） |
| `VIDEO_STUDIO_MODE_INVALID` | 400 | 模式不是四种之一 |
| `VIDEO_STUDIO_PROMPT_REQUIRED` | 400 | 提示词去空白后为空 |
| `VIDEO_STUDIO_PROMPT_TOO_LONG` | 400 | 超过 7000 字 |
| `VIDEO_STUDIO_SPEC_INVALID` | 400 | 清晰度 / 比例不在合同内，时长越界，种子越界 |
| `VIDEO_STUDIO_INPUT_INVALID` | 400 | 素材与模式不匹配（缺首帧、文生视频带了素材、超数量、无视觉素材、重复…），文案说清哪一条 |
| `VIDEO_STUDIO_ASSET_INVALID` | 400 | key 不是本人在本区上传的，或类型对不上 |
| `VIDEO_STUDIO_FILE_EMPTY` / `VIDEO_STUDIO_FILE_TOO_LARGE` / `VIDEO_STUDIO_FORMAT_UNSUPPORTED` | 400 | 上传：空文件 / 超大小 / 按字节判不是允许的格式 |
| `VIDEO_STUDIO_MEDIA_UNREADABLE` | 400 | 上传：ffprobe 读不出音视频 |
| `VIDEO_STUDIO_AUDIO_DURATION_INVALID` | 400 | 上传：单段音频不在 2–15 秒 |
| `VIDEO_STUDIO_JOB_NOT_FOUND` | 404 | 查任务 |
| `VIDEO_STUDIO_PRICE_NOT_CONFIGURED` | 503 | 所选模式 × 清晰度没定价（配置那格空着，模型也没配每秒价）；文案指向后台「引擎定价 → 视频生成」 |
| `VIDEO_STUDIO_REQUEST_ID_INVALID` | 400 | 智能优化的 clientRequestId 不是 8–128 个可见 ASCII |
| `VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND` | 404 | 查优化记录：不存在 / 不是本人 |
| `VIDEO_STUDIO_OPTIMIZATION_INVALID` | 400 | 生成时带的 optimizationId 不是本人的或还没成功 |
| `VIDEO_STUDIO_TEMPLATE_NOT_FOUND` | 404 | 模板不存在 / 已下架 / 不是官方也不是本人的 |
| `VIDEO_STUDIO_TEMPLATE_FORBIDDEN` | 403 | 不是运营却要发布官方模板 |
| `VIDEO_STUDIO_TEMPLATE_INVALID` | 400 | 存模板：任务不是本人的 / 不是本区的 / 没成功；标题或说明长度不对 |
| `VIDEO_STUDIO_PRICING_INVALID` | 400 | 后台保存定价：格子不在 1..100000、加价 / 免费张数 / 优化单价越界、模式或清晰度不认识 |
| `VIDEO_MODE_UNSUPPORTED` | 400 | 模型客户端最后一道：非聚算协议却带了原生模式参数 |

沿用：`VIDEO_NOT_CONFIGURED`（503）、`PAYMENT_REQUIRED`（402，余额不足）、`VIDEO_PRICE_OVERFLOW`。

---

## 5. 服务端实现

### 5.1 复用通用视频链，不另起炉灶

提交走 `MaterialVideoJobService.submit(body, userId, APP_VIDEO_STUDIO)`：冻结 → 落 `material_video_job` →
`afterCommit` 派发 worker → 轮询 → 成片镜像 OSS → 成功扣 / 失败退。**不新建表、不加列、不要迁移。**

- 新分区常量 `MaterialVideoJobService.APP_VIDEO_STUDIO = "video-studio"`（列宽 16 够用）。本区的任务不会出现在
  素材运营、短剧、画布的任何列表里（分区隔离，v0.108 同一个机制）。
- `kind` = `studio-t2v` / `studio-i2v` / `studio-flf` / `studio-ref`；`name` = 「文生视频 · 768p · 9:16 · 5 秒」。
- item 里带 `credit_cost`（§3 算好的总价）和 `credit_label = "视频生成"`。这两个字段只允许内部 Java 调用方传
  （`MaterialOpsController.stripClientPricingOverrides` 已对外剥离），本区 controller 不接受客户端传价。
- `variant_config`（snake_case，与现有 `endpoint_id` / `first_frame_key` 同一层）：
  ```json
  { "endpoint_id": "…可选…", "generation_mode": "universal_reference_video", "resolution_tier": "768p",
    "seed": 42, "first_frame_key": "…", "last_frame_key": "…",
    "reference_inputs": [ {"media_type": "image", "key": "…"}, {"media_type": "audio", "key": "…"} ] }
  ```

### 5.2 一处解析、一处组包（§8.0.1 ④）

- 新 record `VideoGenSpec(generationMode, resolutionTier, seed, firstFrameKey, lastFrameKey, references)`，
  `VideoGenSpec.fromVariantConfigJson(String)` 是 worker **唯一**的解析入口（替掉 `extractFirstFrameKey`；解析失败 = 空 spec，
  与今天「读不出首帧就当文生」一致）。
- `MaterialVideoModelClient.submit(...)` 最后一个参数从 `String firstFrameKey` 换成 `VideoGenSpec spec`（不留旧重载）。
- **兼容**：`resolutionTier == null` 的 spec（画布、脚本视频、短剧）组出来的请求体必须与今天**逐字段一致**：
  `model, prompt, resolutionTier:"768p", orientation(portrait|landscape), seconds, generationMode(t2v|i2v), [input_image_asset_id]`。
- **本区**（`resolutionTier != null`）按 Portal 示例组包：
  `model, generationMode, prompt, resolutionTier, orientation(含 square), aspectRatio, outputSizeCode, seconds, [seed],
  [input_image_asset_id], [end_image_asset_id], [referenceInputs]`。
- 非聚算协议收到任何原生参数（mode / tier / 尾帧 / 参考素材）→ 400 `VIDEO_MODE_UNSUPPORTED`，不静默丢（§8.0）。
- 非聚算协议只带首帧 key（画布的老路径）：key 换成厂商抓得到的地址（`FileStorageService#upstreamFetchUrl`：
  **先签名地址**、签不出来再退公开地址。与 `DapImageInput` 的「公开优先」不同，因为 `publicUrl` 只是拼域名、
  不管桶能不能匿名读；生产默认按 OSS 签名出 wire，私有桶下未签名地址就是 403。短剧交给 seedance 的首尾帧
  一直是签名地址，生产上跑通过），放进该协议原有的首帧位置
  （seedance `content[role=first_frame]` / agnes `image` / generic `image`）。此前这条路径把首帧 key 直接丢掉。
  提示词里的首帧标记（短剧那条）照旧生效，两者都有时以 key 为准。

### 5.3 素材上传给厂商（worker 里，提交前）

`uploadInputImage` 泛化为 `uploadInputAsset(endpoint, apiKey, model, key, mediaType, maxBytes)`：multipart 字段名 =
`image` / `video` / `audio`，Content-Type 与文件名后缀**按字节判**（§8.0.1 ⑤，图片 `ImageBytes`，音视频新 `MediaBytes`）。
上限：帧图 16 MiB、参考图 30 MiB、视频 50 MiB、音频 15 MiB。失败照旧 `VIDEO_REF_UPLOAD_FAILED`，4xx 直出厂商原话。

### 5.4 上游说了什么，用户就看到什么（§8.0.1 ①）

- 创建非 2xx：4xx → 任务失败原因 = 「视频模型拒绝了这次请求：<厂商原话，≤200 字>」；5xx → 「视频生成失败（上游 503），请稍后重试」。
  响应体不是 JSON 时不外泄。（今天所有 4xx 都显示「请稍后重试」，对一个永远不会自己好的 400 是错的。）
- 轮询到 `failed`：`extractFailReason` 补读聚算形态 `error.message`（对象）、`errorMessage`、`errorCode`。

### 5.5 上传接口（`POST /uploads`）

1. `mediaType` ∈ image / video / audio，否则 400 `VIDEO_STUDIO_FORMAT_UNSUPPORTED`。
2. 读字节；空 → `VIDEO_STUDIO_FILE_EMPTY`；超该类上限（图 30 / 视频 50 / 音频 15 MiB）→ `VIDEO_STUDIO_FILE_TOO_LARGE`（文案带 MB）。
3. 按字节判格式：图 PNG/JPEG/WEBP；视频 MP4（`ftyp` 且品牌不是 `qt  `）；音频 WAV/MP3/FLAC/OGG/AAC(ADTS)/M4A/MOV。
   后缀用判出来的，不信文件名。
4. 音视频过 `FfmpegRunner.probeMedia`：读不出 → `VIDEO_STUDIO_MEDIA_UNREADABLE`；视频必须有画面轨；音频必须有音轨且 2–15 秒
   → 否则 `VIDEO_STUDIO_AUDIO_DURATION_INVALID`。
5. 配额 `StorageQuotaService.checkQuota("celebrity", …)` → `FileStorageService.store(bytes, "video-studio-<mediaType>", uid, ext, mime)`
   → `record("celebrity", uid, "视频生成素材", null, key, bytes)`。**key 里的分类就是验过的类型**，提交时据此判类型。
6. 返回 `VideoStudioUpload`（`url` = 签名地址）。

**归属闸**：`FileStorageService` 新增 `ownedKeyPrefix(category, ownerId)`（与 `buildKey` 同一套 sanitize），
提交时每个 key 必须以 `video-studio-<声明类型>/<本人>/` 开头、不含 `..`，否则 `VIDEO_STUDIO_ASSET_INVALID`。
帧图必须是 image 分类。

### 5.6 出 wire（`VideoStudioJob`）

从 `MaterialVideoJob` 直接组：状态 queued/submitting → `queued`… 具体：`queued`→queued，`submitting|generating`→running，
`succeeded`，`failed`；进度 / 文案同 `toCard`；`inputs` 从 variant_config 的 key **出 wire 时现签**（§4.7.7，不存 URL）；
成片 / 封面经 `CdnUrlSigner.maybeSign`；`credits = creditsHeld`；宽高按合同查；`modelName = providerUsed ?? modelUsed`。

### 5.7 其他顺手的一致性

- worker 记账文案用 payload 里的 `credit_label`（今天写死「带货视频生成」，短剧和本区都会显示错）。
- worker 的存储用量分类：`studio-*` → 「视频生成」。

---

### 5.8 评审后补的四条（Codex 两轮 + 后端 agent 自查，2026-09-30）

- **分区闸**（`MaterialVideoJobService.submit`，冻结之前）：`variant_config` 里的原生规格只许 `video-studio` 分区带，
  `first_frame_key` 只许 `ipstudio` / `video-studio` / `drama`（短剧的 variant_config 全由服务端组装，2026-09-30 首帧热修后写 key 前验归属）。素材运营的 `POST /api/material/videos/generate` 会把客户端的
  `variant_config` 原样透传，不挡就是按带货单价开出原生能力，或拿别人的 key 出片。
- **对账恢复按冻结价**：提交时 item 带 `credit_cost`（本区、短剧）的任务在 payload 标 `caller_priced=true`，
  `reconcileSucceeded` 按冻结价结算；其余沿用 v0.131 的「按端点每秒价重算」（那是为了补收按每条 30 冻结的老任务）。
  否则 544p 的任务对账时会被收成 768p 的价，多参考图的加价会丢。
- **停用的候选不复活**：列表为空时只在默认端点**根本没有候选行**时才合成默认项；候选在但停用 → 不列出。
  否则运营停用了模型，它会以每条 30 的价格重新出现（每秒 40 的模型 15 秒只冻 30）。
- **失败原因说人话**：worker 写给用户的失败原因不再带 `status=` / `taskId=`，这些进日志（所有用这条链的产品线一起受益）。

前端评审补了三条：轮询换新签名地址不再打断正在播放的成片（`useStableUrl`，地址失效后才换）；别的模式里没传完的素材
不再挡住当前模式的「生成」；选中的模型刷新后不在了，下拉框 / 报价 / 提交一起换到默认模型并提示。

### 5.9 二版评审后补的（Codex 第三、四轮 + 自查，2026-10-01）

Codex 对二版（定价配置 / 智能优化 / 模板）做了一轮只读评审（总第三轮），提了 4 条，都修了：

- **P1 智能优化的终态和积分结算不在一个事务里**：先提交「成功 / 失败」，再单独扣 / 退，扣退的异常被吞掉。
  两步之间出错就会出现「优化成功了却没扣钱」或「显示失败已退回、积分还冻着」，而且记录已是终态，兜底回收再也看不见它。
  → 新 bean `VideoStudioOptimizationSettlement`：条件更新 + 扣 / 退同一个 `REQUIRES_NEW` 事务，不吞异常；三条收尾路径都走它。
- **P1 线程池拒绝时的退款跑在已经提交的事务里**：afterCommit 回调里用 `REQUIRED` 写库，会加入那个已结束的事务，
  写进去的不会提交（真跑出来是 `no transaction is in progress`），记录停在 queued、积分冻着，要等 20 分钟回收。
  → 拒绝路径走结算 bean 的 `REQUIRES_NEW`；POST 提交后重读，返回真实状态。
- **P2 同一个 clientRequestId 并发两次、余额只够一次时，后到的那次 402**（应当拿到先到的那条）。→ 先插行再冻结（§9）。
- **P2 后台定价页首次读取失败仍能保存默认值**，见 §11。

钉住它们的是 `VideoStudioOptimizationTransactionTest`（真 Spring 上下文 + H2 + 真 CreditService，事务不是替身）：
修之前跑，四个现象都复现了（402、`no transaction is in progress`、成功未扣、失败未退）；并发用例让 A 停在冻结里、
等 H2 显示 B 卡在插入上再放行，并断言 B 确实等过锁，不会碰巧通过。

同一轮与短剧画布会话对齐合并时顺带改的两处：分区闸放行短剧的首帧 key（见 §5.8、§12）；`MaterialVideoJobService.toCard`
原来只剥掉 `credit_label`，内部的 `caller_priced` 标记会漏进 MaterialVideo 卡片的 wire（契约外字段），现在一起剥掉。

修完再复审（总第四轮）：上面四条修对了，新提 1 条 P2，也修了：

- **回收会误杀刚开工的任务**：回收先列出卡住超过 20 分钟的记录、再逐条结算；排队排了 20 分钟以上的那条如果恰好在两步之间被
  worker 领走（`claimRunning` 刷新 updated_at、开始调厂商），原来的条件更新只看状态，照样判失败、退钱，厂商结果回来只能作废。
  → 回收改走 `failIfStale`，条件更新多带 `updated_at < cutoff`（与列出时同一个 cutoff）。真事务用例
  `reaperDoesNotFailARowTheWorkerJustClaimed` 按「列出 → worker 领走 → 结算」的顺序走一遍：这条不判失败、冻结还在，worker 的结果照常扣一次。

自查补的三条：

- 模型候选的每秒价是 0 时被当成「免费」：现在 `creditCostOverride` 必须 > 0 才算有价，否则这一格未定价（§3）。
- 厂商把重试建议写在响应正文（`retryAfterSeconds`，顶层 / `error` / `error.details`）时没听：`retryAfterMs` 先认
  `Retry-After` 头，没有再看正文（`MaterialVideoModelClientRetryHintTest`）。
- 智能优化的 12 分钟预算原来从「素材上传完」才开始算，上传慢（最多 13 个素材 × http-timeout）+ 重试满时可能超过兜底回收的
  20 分钟，回收会把还活着的 worker 判失败（结果作废、不扣钱，但厂商那次白调了）。现在从上传之前开始计时。

## 6. 前端实现（apps/web-celebrity）

| 文件 | 内容 |
|---|---|
| `src/api/video-studio.ts` | `listModels / upload / submitJob / listJobs / getJob`，`USE_MOCK` 分支读 mocks；`api/index.ts` 导出 `VideoStudioApi` |
| `src/mocks/video-studio.ts` | 与服务端同形（ISO 时间，§4.8）：一个 H3 模型（合同 + 价格照 §2/§3）、几条各状态的任务 |
| `src/constants/video-studio-ui.ts` | 模式名 / 一句话说明 / 状态文案 / 编号规则 |
| `src/components/video-studio/*` | 表单、单图上传位、参考素材列表、任务卡、任务列表 |
| `src/app/(workspace)/studio/video/page.tsx` | 页面 |
| `src/app/(workspace)/layout.tsx` | 侧栏新组「AI 创作」→「视频生成」+ 面包屑 |
| `src/lib/video-studio-*.test.mts` | 报价算法、编号规则、侧栏挂载的结构测试（§8.0.1 ⑥），加进 `package.json` 的 `test` |

前端预检照合同做（数量、大小、格式、时长、提示词长度、音频合计），服务端是最后裁决。上传用 `apiFetch` + `FormData`。
报错显示 `ApiError.message`。时间一律 `formatDateTime`。不许 `confirm/alert/prompt`。文案遵守 §8（无「——」、无翻译腔）。

---

## 7. 验证

- 单测：合同校验、计价、归属闸、四种模式 + 老路径的请求体、上传判格式、`VideoGenSpec` 解析、上游报错文案。
  **结果**：server 相关测试类全绿（含 ipstudio / drama / clip / dap 回归，以及起真 H2 上下文的
  `ProductRouteTableCoverageTest`）；web-celebrity node 测试 67/67。
- 本机端到端（2026-09-30 实测）：模拟聚算服务记下收到的每一个请求，后台配一个指向它的「视频生成」端点；
  接口脚本 60 项检查 + 浏览器里用真实上传框走一遍首帧生视频和一条失败任务。**结果**：
  - 四种模式发出去的请求体与 Portal 示例逐字段一致（1:1 → `square` + `h3-768-1x1` + seed；全能参考 7 图 + 1 视频 +
    2 音频按顺序、角色对）；素材上传字段 `image` / `video` / `audio`，类型按字节判；
  - 四条冻结 570、成功扣 570；厂商 422 与任务失败两条全额退回，原因是厂商原话；
  - 老的带货出片请求体与改动前一致；老接口塞原生规格 / 首帧 key 被 400 挡住；成片在页面能播放（768×1344）。
- **2026-10-03 补**：老路径（画布 / 短剧 / 脚本视频）只发 `orientation` 时，厂商的竖屏默认 preset 已经变成 3:4
  （线上 `effectiveSpec.outputSizeCode=h3-768-3x4`，出来 768×1024），而这几条线要的是 9:16。老路径改为横竖两档也带
  `aspectRatio` + `outputSizeCode`（同视频生成区的取值）；1:1 的 `square` 仍未实测，老路径 1:1 保持只发 `orientation`。
  - 唯一一项「不通过」是测试脚本自己的：开发库存在硬盘上，配置脚本跑了两次，列表里有两个一样的模拟端点。
- 四道门：`pnpm typecheck:all`、`pnpm typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract`。
- **二版本机端到端**（2026-09-30，同一个模拟聚算服务，脚本 `e2e2`）：
  - 定价：后台配的格子生效（文生 768p 50/秒 × 5 秒冻结 250；全能参考 544p 3 张图、前 2 张不加价、每张 +5/秒 → (35 + 5) × 5 = 200），空格子回落到模型的 40/秒；配置和模型都没价的组合 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`。
  - 智能优化：冻结 8、同一个 clientRequestId 重发拿到同一条；厂商 409 后同键同正文重发成功；厂商 422 失败并退回、原因是厂商原话；首帧 / 文生 / 全能参考带音频三种请求体与 Portal 示例一致（文生 `referenceInputs: []`、有音频带 `audioReferencePolicy`）；带 optimizationId 生成的任务 prompt = 用户改过的版本、originalPrompt = 原文。
  - 模板：非运营发官方 → 403；可见性、做同款的素材闸、`useCount`、删除 / 撤回规则都对。
  - 浏览器（真实模式）：报价行、优化面板改完「用这版生成」、模板页签、做同款预填与提示条、存为模板弹窗都点过。
  - 脚本有三项没通过，查下来都是测试环境的问题（改端点计价方式的 PUT 没生效、测试账号积分用完、并发任务干扰了冻结额断言），逐项手工复核通过。
- **三轮修复后本机端到端**（2026-10-01，脚本 `e2e3`，24/24 通过）：
  - 同一个 clientRequestId 两个请求同时到、余额只够一次（价格 = 余额一半 + 1）：跑 5 轮，两边每次都拿到同一条记录，厂商只被调一次；失败的 4 轮全额退回，成功那轮只扣一次；余额不够之后同一个串再发仍返回原记录，新串 → 402 且什么都没冻。
  - 把优化线程池占满（模拟厂商每次等 25 秒，连发 78 条）：72 条进池（8 在跑 + 64 排队），6 条当场失败、冻结当场退回、厂商一次都没被调；72 条最后全部成功，每条只扣一次，冻结额回到原值。
  - 后台定价页：模拟读取失败时表单和保存按钮都不出现，只有「重试」；重试后读回线上的值。
  - server 相关测试 70 个类 550 条全绿（含真事务的 `VideoStudioOptimizationTransactionTest` 8 条，其中一条是复审补的回收竞态），web-celebrity 99/99，四道门全绿。
  - 复审修完后重启再跑一遍脚本的前两段（同键并发 + 常规路径）17/17。

- **线上发布**（2026-10-02 13:31 CST，release `20261002052931-1f569079`，分支 `release/v0199-combined`）：
  按用户决定与短剧 #115（已先单独上线）/ #116 / #117 合成一个包，发 server、web-celebrity、web-drama、admin（web 包 `AUTH_MODE=id`）。
  - 发布分支门禁：server 全量 219 个类 1562 条 0 失败、web-drama 646/646、web-celebrity 99/99、typecheck / admin / 契约门、§9 grep 门禁全绿。
  - 上线核对：`verify.sh` 全绿；server 15 秒起来，Flyway 先 V36 再 V37（`Successfully applied 2 migrations … now at version v37`），
    重启后 0 条 ERROR；库里 36 / 37 两行 success=1，四张新表和两个唯一索引都在，没有卡在排队的视频任务；
    `/studio/video` 200、编造的路由 404；jar 里有 `VideoStudioController` / 结算 bean / 测试 mock / `DramaCanvasController`。
  - 线上配置：「视频生成」默认是聚算 MiniMax H3（每秒 40），计价配置是种子值（全部回落到 40/秒、智能优化不收费），
    **测试 mock 没开**（`celebrity.video-studio.test-mock-user-ids` 不存在）。
  - 同一个生产 jar 在本机（内存库 + 模拟聚算）把测试 mock 那条路走了一遍，27/27：名单里的账号智能优化与四种模式都不调厂商，
    演示视频是真 H.264（1280×720 / 720×1280 / 1280×1280 / 1280×960，约 5 秒，带封面），扣费正好 4 × 200、不留冻结；
    模板与做同款能用演示作品；名单外的账号照常调厂商；后台删掉配置后 30 秒内不重启就关掉。浏览器里看过卡片与视频帧（「测试演示」标识清楚）。
  - **线上用真实账号走一遍还没做**：要用户自己在浏览器里登录（不能代填密码 / 验证码）。另外测试账号只有 269 积分，完整流程（5–7 条视频）要 1,000–1,400。

## 8. 没做 / 待定

- **带平台标识的成片**（`deliveryMode=marked`）：默认拿无水印原片镜像到 OSS。
- **1:1 的 `orientation:"square"`**：见 §2，未实测。
- **出片创建请求的 Idempotency-Key**：厂商强烈建议；出片的 worker 从不重发创建请求，这一版不加（智能优化那条已经带了，见 §9）。
- ~~**画布出视频的两个老问题**~~ 本轮一起修了：画布选的模型没传到位（`IpRunService` 把 `endpoint_id` 写在 item 顶层，
  通用视频链只读 `variant_config.endpoint_id`）；非聚算协议下首帧 key 被静默丢掉（见 §5.2 最后一条）。

---

## 8.1 线上端到端验证用的测试 mock（临时，2026-10-01）

用户要求在线上用真实账号把流程走一遍、但不调厂商。发布分支 `release/v0199-combined` 多带一个 `VideoStudioTestMock`：

- 名单：平台配置 `celebrity.video-studio.test-mock-user-ids`（JSON 数组，用户 id），30 秒缓存；缺省 / 空 = 关，开关就是后台 `PUT` / `DELETE /api/admin/platform-configs/{key}`，不用重启。
- 只管视频生成区：名单里的账号在分区 `video-studio` 出片时不调厂商，用 Java2D 画一张写着「测试演示 · 未调用厂商」的卡片、ffmpeg 按所选比例和秒数编码成 H.264 MP4，再走与真成片同一条存储（`material-videos/<jobId>/…`）、记账、扣费路径；智能优化返回带「【测试演示，未调用厂商】」开头的固定改写，计价与结算照常。其它账号、其它分区（带货脚本视频 / 短剧 / 画布）不受影响。
- §8.0：缺省关、命中与读到名单都打 ERROR、产物带显式标识，已登记进 AGENTS.md §8.0 审计表。代码不进 PR #118，下次按 main 发布自然去掉。

## 9. 智能优化（照厂商试用页：可选，默认勾上）

**厂商合同**（Portal「API 接入 → 智能优化后生成」完整示例 + OpenAPI `createPromptOptimization`，2026-09-30）：

- `POST {base}/media/prompt-optimizations`，**同步**返回 201，但示例的读超时是 **630 秒** —— 最长要等十分钟上下。
  请求头 `Idempotency-Key` 必填（8–128 字符）且**必须等于** body 的 `clientRequestId`；结果未知时用同一正文同一键重发。
- body：`clientRequestId, model, generationMode, originalPrompt(1–7000), mediaSpec{resolutionTier, orientation, aspectRatio,
  seconds, outputSizeCode}, referenceInputs[{role, assetId}]`（**不带 mediaType**）。role：首帧生视频 `first_frame`；
  首尾帧 `first_frame` + `last_frame`；全能参考 `reference_image` / `reference_video` / `reference_audio`（同生成的顺序）；
  文生视频 `[]`（字段必填，给空数组）。有音频参考时必须加 `audioReferencePolicy: "preserve_without_understanding"`。
  可选 `dialogueLanguage`（默认 auto）、`style` —— 这一版不开放。
- 响应：`optimization.optimizedPrompt`（必有）、`optimizationId`、`originalPrompt`、`outcome`、`noticeCodes[]`、`expiresAt`。
  生成时**仍传最终文本**（`prompt`），不传 optimizationId。409 = 同一操作还在处理（`optimization_in_progress`）或冲突。
- 素材 id：示例里上传一次、优化和生成复用同一个 assetId（在 `expiresAt` 之前有效）。**我们不复用**：生成时 worker 照旧重新上传，
  简单可靠；代价只是多传一次。

**用户看到的**（同厂商试用页）：提示词框右下角「智能优化」勾选框，默认勾上（记在本机，下次进来保持上次的选择）；
勾上时按钮是「优化并继续」，不勾是「生成」。报价那行勾上时写「智能优化 X 积分 · 生成预计 Y 积分」（X = 0 写「智能优化不收费」）。

点「优化并继续」→ 表单里出现一块「正在优化提示词…（一般几十秒，长的要几分钟）」，每 2 秒查一次结果（页面在后台时暂停、回来马上补查）→
成功后同一块变成：可编辑的「优化后的提示词」（n / 7000）、可展开的「原提示词」，三个按钮：
**「用这版生成」**（提交生成，prompt = 编辑后的文本，带 optimizationId）、**「改用原提示词生成」**、**「先不生成」**（收起这一块，什么都不改）。
失败时同一块显示服务端给的原因（厂商原话），按钮「直接用原提示词生成」「重新优化」（新的 clientRequestId）。

**服务端**：

- 新表 `video_studio_prompt_optimization`（V37）：`id, owner_user_id, client_request_id, endpoint_id, status(queued|running|succeeded|failed),
  spec_json`（已校验的请求快照：模式、清晰度、比例、秒数、素材 key / 类型 / 标签、模板 id）`, original_prompt, optimized_prompt,
  vendor_optimization_id, error_message, credits_held, created_at, updated_at, completed_at`；`UNIQUE(owner_user_id, client_request_id)`。
- `POST`：校验与提交生成**同一个校验器、同一套错误码**（模型 → 模式 → 提示词 → 规格 → 素材 → 归属 / 模板；种子不看）；
  clientRequestId 必须是 8–128 个可见 ASCII（否则 400 `VIDEO_STUDIO_REQUEST_ID_INVALID`）。同一用户同一 clientRequestId 已有记录 → 原样返回，
  不再冻结。价格 = `promptOptimizationPerCall`，> 0 就 `CreditService.hold`（refType `video_studio_prompt_optimization`，refId = 记录 id），
  余额不足 402。**同一个事务里先插行并 flush、再冻结**：唯一键先被占住，同一串的并发请求卡在自己的插入上，等先到的提交后撞唯一键、
  在事务外读回那一条（余额只够一次时两边也拿到同一条，不会一边 402）；冻结 402 时刚插的行随事务回滚，同一个串充值后还能用。
  落库 queued，**`afterCommit` 派发**（§ip-studio 教训：事务里派发 worker 查不到行）；线程池排满时在 afterCommit 里经结算 bean
  （`REQUIRES_NEW`）当场判失败并退冻结，POST 提交后重读一遍再返回，前端直接拿到「现在排队优化的人太多，请稍后再试」。
- worker（独立线程池 `videoStudioOptimizationExecutor`，别占视频出片那 3 个线程）：running → `MaterialVideoModelClient.optimizePrompt(...)`：
  素材照生成那套 `uploadInputAsset` 上传（同样的字段名、按字节判类型、大小上限、编号文案）→ 按上面的 body 组包 →
  `Idempotency-Key` = clientRequestId = **我们的记录 id** → 读超时 630 秒。
  - **收尾一律走 `VideoStudioOptimizationSettlement`**（worker、兜底回收、线程池拒绝三条路共用）：条件更新改状态
    （`where status = running` / `in (queued, running)`，返回 1 才动钱）和扣 / 退积分在**同一个 `REQUIRES_NEW` 事务**里，
    扣 / 退抛异常就整个回滚、记录留在原状态，由兜底回收再判失败并退冻结；不吞异常。
  - 201 且 `optimizedPrompt` 非空 → succeeded，`commitHold`；
  - 409（处理中）/ 429 / 5xx / 超时 / 网络错误：**同一正文同一键**重发，按 Retry-After 或 5 秒起指数退避，总预算 12 分钟；
  - 其它 4xx → failed，失败原因 = 「智能优化被拒：<厂商原话>」（与生成同一个上游文案函数），`releaseHold`；
  - 重试用完 / 预算用完 → failed「智能优化超时，积分已退回」，`releaseHold`。请求体、响应体照 §8.0.1 ① 记日志。
- 兜底回收：`@Scheduled` 每 5 分钟把 `updated_at` 超过 20 分钟仍 queued / running 的记录判失败并退冻结（服务重启时卡在半路的那种）。
  结算时条件更新再带一次同一个 cutoff（`failIfStale`）：列出来之后刚被 worker 领走的那条不动（Codex 复审补，见 §5.9）。
- `GET /{id}`：本人才看得到，否则 404 `VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND`。
- 生成请求带 `optimizationId`：必须是本人的、succeeded 的，否则 400 `VIDEO_STUDIO_OPTIMIZATION_INVALID`；任务的
  `variant_config` 记 `optimization_id` + `original_prompt`（worker 不读这两个键），`VideoStudioJob.originalPrompt` 由此出 wire。
  不要求生成时的模式 / 规格与优化时一致（用户可以优化完再改）。

## 10. 模板 / 做同款（用户第二轮要求：「对生成的作品要能提供模板化的功能，给别人直接复刻」）

**谁能发 / 谁能看**（用户选定）：普通用户存的模板**只有自己**能看能用；运营账号（`aep_users.operatorRole` ∈ operator / super_admin，
**服务端查库判定**，不信前端）可以把自己的作品发布成**官方模板**，所有用户可见。
**做同款时的素材**（用户选定）：模板带着原作的素材，做同款的人可以直接用，也可以逐个换成自己上传的。

- 新表 `video_studio_template`（V37）：`id, owner_user_id, scope(official|private), status(active|withdrawn), title, description,
  source_job_id, recipe_json, preview_video_key, preview_thumbnail_key, use_count, created_at, updated_at`。
  `recipe_json` = 模式、最终提示词、清晰度、比例、秒数、种子、模型（endpointId + 展示名）、素材列表（role / mediaType / key / label）。
  **不拷运行痕迹**（任务状态、错误、积分、外部任务号；§8.0.1 ⑪ 的教训）。成片与封面存 **key**（`CdnUrlSigner.keyOf(job.videoUrl)`），
  出 wire 现签（§4.7.4）。素材**不复制文件**，模板直接引用原作的素材 key —— 发布者本来就是把它们拿出来共享。
- `POST /templates`：任务必须是本人的、本区的、成功的；标题去空白后 1–40 字、说明 ≤ 200 字（否则 400 `VIDEO_STUDIO_TEMPLATE_INVALID`）；
  `official=true` 而不是运营 → 403 `VIDEO_STUDIO_TEMPLATE_FORBIDDEN`。
- `GET /templates`：在架的官方模板 + 我自己的（官方的我发的也算我的），新→旧，最多 100 条；每条带 `mine`。
- `GET /templates/{id}`：官方且在架，或本人的；否则 404 `VIDEO_STUDIO_TEMPLATE_NOT_FOUND`。
- `DELETE /templates/{id}`：本人的 → 下架（status = withdrawn，软删）；官方的 → 本人或任一运营可撤回；其它人 404。
- **做同款的归属闸**：生成 / 优化请求带 `templateId` 时，模板必须对当前用户可见；每个素材 key 要么是本人上传的（原规则），
  要么是**这个模板的素材**且类型一致；其它一律 400 `VIDEO_STUDIO_ASSET_INVALID`。任务 `variant_config` 记 `template_id`，
  成功创建任务时模板 `use_count + 1`（单条 UPDATE 自增，不读改写）。
- 计费与普通生成完全一样，智能优化照常可选。

**前端**：右栏顶部两个页签「生成记录」「模板」。

- 成功的生成记录卡上多一个「存为模板」→ 弹窗：标题（预填「<模式名> · <提示词前 12 个字>」）、说明（选填）；运营多一个勾选
  「发布为官方模板（所有用户都能看到）」。
- 「模板」页签分「官方模板」「我的模板」两组卡片：封面（点了播放原作成片）、标题、「官方」/「仅自己可见」标、模式与规格、
  提示词两行、素材缩略图、「已做同款 N 次」、按钮「做同款」；我的 → 「删除」，官方且我是运营 → 「撤回」（都用 `useConfirm`，不许 `window.confirm`）。
- 「做同款」：把模式、提示词、规格、种子（有就展开「高级」）、模型（还能选就选它）、素材都填进左边表单，素材标「模板素材」，
  每个都能删、能换；表单顶上一条「正在做同款：<模板名>」+「不做同款了」（清掉模板素材和 templateId，其它保留）。

## 11. 后台「引擎定价 → 视频生成」页签

`apps/admin/src/app/celebrity/engine-pricing/page.tsx` 加第三个页签：4 行（四种模式）× 2 列（768p / 544p）的每秒价输入框，
空着的格子占位写「按模型单价」；下面三个数：「全能参考前 __ 张不加价」「之后每张每秒加 __ 积分」「智能优化每次 __ 积分（0 = 不收费）」；
保存 = 整份 PUT。类型照 §4.1 从 `packages/types` 复制一份到 `apps/admin/src/types/`。
**没读到线上配置时不给编辑也不给保存**（只显示「重试」；「重新读取」失败也回到这个状态）：保存是整份替换，
拿一张空表去存等于把线上价格整份清掉（Codex 二轮评审补）。

## 12. 迁移与分工

- **迁移编号 V37**（`V37__video_studio_optimization_and_template.sql`）：主干最新是 V35，`feat/drama-xyq-flow`（未推）已占 V36。
  谁后合并谁核对一次线上 `flyway_schema_history`（编号横跨 SQL 与 Java 两个目录）。**部署顺序是硬的**：线上 Flyway 是
  `out-of-order=false` + `validate-on-migrate=true`，线上当前最大 V35（短剧会话 2026-10-01 只读核对）。必须短剧的
  `V36__drama_canvas.sql` 先在线上执行、V37 后执行；V37 先上线的话 V36 就再也进不去，校验失败、服务起不来。
  所以合本分支之前先确认 main 上已经有 V36，部署也按这个先后。V37 文件头注释写的是 v0.198 ——
  那是改版本号之前写的，**没改**：本机开发库已经跑过它，改注释会让 Flyway 校验和对不上、服务起不来。
- **合并顺序与冲突**（2026-10-01 与短剧画布会话对齐）：短剧首帧热修（`fix/drama-h3-first-frame`）先合 → 短剧画布
  （`feat/drama-xyq-flow`，v0.197 / v0.198）→ 本分支最后合，所以本分支改用 **v0.199**、`BUSINESS_RULES` 用 **§6.8**
  （§6.7 是短剧画布）。合并时：
  - `AGENTS.md` 版本表留 v0.199 / v0.198 / v0.197 / v0.195 / v0.194 五行；`VERSION_HISTORY.md` 本分支那节放在 v0.198 上面；
    两边的错误码表各归各节。
  - 分区闸已放行短剧的首帧 key（`FIRST_FRAME_KEY_APPS` = ipstudio / video-studio / drama）：热修后的 `renderClip` 与短剧画布都会写
    `first_frame_key`。短剧那边的测试 mock 了 `videoJobs.submit`，闸拦错了也是绿的，合并后要真跑一次短剧带首帧出片。
  - 短剧画布把 `MaterialVideoWorker` 改成条件认领（`jobRepo.claimQueued`，影响 1 行才提交）。合并后本分支的
    `MaterialVideoWorkerSpecTest` 要在 setUp 里补 `when(jobRepo.claimQueued(eq("mvj_studio"), any())).thenAnswer(...)`
    （照短剧那边 `MaterialVideoWorkerTest` 的写法），否则 Mockito 默认返回 0、三条 generateAsync 用例全红；解 worker 冲突时
    **保留 `claimQueued`，删掉本分支原来的 `updateStatus(jobId, "submitting", 5, null)`**，否则排队中取消与 worker 接手的竞态会回来。
- 并行：服务端一个 agent（§3 定价配置、§9、§10 服务端、迁移、openapi、BUSINESS_RULES）；web-celebrity 一个 agent
  （§3 报价、§9、§10 前端、mocks、测试）；后台页签（§11）主会话自己写；模拟聚算服务补优化接口供端到端验证。
