# 「快出片」数字分身口播视频线 · 方案与 Handoff

> **业务线代号**：`clip`（口播视频线）　**产品工作名**：快出片（待定）
> **文档状态**：**M1 服务端、石榴真实原子链路与多段 ffmpeg 总装基线已落地；逐句字幕/AI 标识已烧录，媒体审核与真实代发未上线**。
> **创建**：2026-08-10　**last-reviewed**：2026-08-11
> **上游背景**：基于已有 AI 短剧（`apps/web-drama` + `apps/server` drama 域）基座能力，做一个手机端/小程序的轻量素材视频产品；数字人口播能力拟接入外部供应商**石榴AI**。

## 实施状态（2026-08-11）

- 新增 `packages/types/src/clip.ts`、Java `clip` 独立领域与 `V14__add_clip_domain.sql`，包含模板、项目、任务、素材四张表；所有用户态查询按军师 `externalOwnerId` 隔离，service token 只代表调用系统，不冒充最终用户。
- 已实现模板/admin preset 上传、项目草稿/重置/30 天回收、素材 100MB + MIME + ffprobe、授权快照、分身/声音克隆抽象、报价/预检、幂等建单、数据库租约 worker、stale reaper、作品查询和四平台发布契约；OpenAPI 已同步。
- 跨系统采用 Scheme A：用户积分只由军师 BFF hold/settle/refund；AIStar 不调用本仓 `CreditService`，仅保存 `creditsHeld` 作为外部报价审计事实。`clientRequestId` 在外部属主内唯一，重复载荷冲突返回 409。
- `HttpShiliuGateway` 已按官方 API v1 接入授权视频、声音/形象训练、TTS、文案/音频出片、状态轮询与删除；上游时效成片立即转存我方持久存储。真实 key 仅在预发 0600 env，探针确认 12,000 点、当前没有已训练 speaker/avatar。
- `ClipOfficialTemplateSeeder` 内置「为实体发声 / 今天开门了 / 这门手艺」三套模板，仅补缺失 ID、不覆盖运营编辑。`clip-preprod` 独立 profile 仅监听 127.0.0.1:8081，军师 BFF 以独立 service token 回源，未接触 AIStar 生产。
- v0.112 按 Strategy A 落地逐段可恢复 worker：b-roll 每段先 TTS，avatar 每段独立建石榴任务；上游时效音视频先转存我方，再由 `ClipAssemblyService` 做 720×1280 H.264/AAC 归一、b-roll 裁切/循环、缺省尾段、可选 BGM 与最终拼接。`ClipOverlayRenderer` 用 Java2D 生成透明安全层，逐句字幕与全片「AI 生成」标识经 ffmpeg overlay 永久烧录，用户文案不进入 filter 表达式；成片须通过有效时长/音轨门并自动抽帧落我方缩略图。真实 ffmpeg 配方已本机探针通过。
- 非 mysql/production 环境允许显式 mock，mock 产物带 `mock=true`。媒体机器审核未配置时军师 BFF 继续 fail-closed；真实代发仍固定失败。
- 仍需使用本人合规素材完成 §3.2 质量/时延/一致性/规格/成本实测，完成 §12 商务/备案决策，并接媒体审核、模板固定尾片、四平台发布和生产压测/真机验收。

---

## 0. 三句话说清

1. **产品**：用户一次性克隆自己的形象+声音（数字分身），之后每条视频三步出片——**改文案 → 逐段配画面 → 出片**。
2. **成片结构**：一段口播贯穿全片（用户克隆声线）；用户逐段决定这段是「数字分身出镜说」还是「配画面（自己上传的实拍素材，声音继续念）」；结尾接固定片段。
3. **为什么成本可控**：数字人出镜是唯一贵环节，被刻意压到全片的 10~20%；中段 b-roll 用户自备、零 AI 成本；总装用自有 ffmpeg。**克隆一次性收费 + 出片按条收费**天然构成付费分层。

---

## 1. 缘起与需求演进（重要：避免重走弯路）

需求在对话中澄清了四轮，**前三轮的理解都是错的**，记录在此以防后人重复推导：

| 轮次 | 曾经的理解 | 为何错 |
|---|---|---|
| ① | 商家自助口播广告（上传门店照+填卖点→数字人念广告） | 不是广告片，是有固定叙事内核的纪实倡导片 |
| ② | 每个商家做一部完整 7 段片，每段 AI 生成 | 母版是专业制作的，不是每人重新生成 |
| ③ | 「集体发声」是 UGC 征集接力（扫码录一句汇入正片） | **误判**：集体发声段是固定视频素材，不是 UGC 入口 |
| ④ **（正确）** | **口播音频做主干，画面分层填充；数字人只在少数区间出镜** | 见 §2 |

参考样片《为实体发声》（惊艳传媒）实际结构，总长 2:42：

| 时间 | 内容 | 在产品中的对应 |
|---|---|---|
| 0:00-0:35 | 女声讲述「攒一束光」+ 凌晨街角五金店/修鞋摊/褪色招牌 | 开头数字人出镜段 + 街景 b-roll |
| 0:36-1:07 | AI 引流方案（老李补鞋短视频、王姐拼单小程序、抖音 30 万赞） | b-roll + 数据字卡段 |
| 1:07-1:32 | 技术差异化（过滤刷单、生存红线、3 公里唤醒、扶人的手） | 可穿插第二段数字人出镜 |
| 1:33-1:52 | 情感共鸣（不是拯救，是让坚守者被看见） | b-roll |
| 1:53-2:26 | 「我在XXX，我为实体发声！」多地点穿插 | **固定尾段**（模板自带，可整段替换） |
| 2:27-2:42 | 团队愿景「一群人一条心，一辈子一起拼」/「丢弃所有的负担」 | **固定尾段** |

**关键观察**：口播旁白（女声）**贯穿 0:00~1:52 全程**，但真人/数字人形象**不是全程出现**——只在开头一小段露脸，其余时间是画面 b-roll 配旁白。这个「音频连续、画面分层」的结构就是产品的技术核心。

---

## 2. 生产模型：文案即时间线，逐段配画面

### 2.1 用户心智

```
整段口播文案（模板预置骨架 + 变量预填，可 AI 改写 / 手改）
   │
   ├─ 段 1  [00:00-00:12]  ● 分身出镜   ← 用户可切换
   ├─ 段 2  [00:12-00:35]  ○ 配画面 → 街角空镜.mp4（我上传的）
   ├─ 段 3  [00:35-01:07]  ○ 配画面 → 通用画面（模板自带，建议换成你自己的）
   ├─ 段 4  [01:07-01:20]  ● 分身出镜   ← 中段穿插第二次
   ├─ 段 5  [01:20-01:52]  ○ 配画面 → 店铺特写.mp4
   └─ 尾段  [01:53-02:42]  ▣ 固定片段（集体发声 + 团队升华，可整段替换）
```

- 用户**以「段」为单位**切换角色（`avatar` / `broll`），但 UI 上**同时显示时间区间**，所以体感是"我选前 12 秒出镜、1 分 07 秒再出镜一次"。
- **时长如何在生成前得知**：两级精度——① 按字数估算（中文口播约 **4 字/秒**，用于首屏即时显示）；② 用户点过「试听」后用真实 TTS 时长回填。生成完成后写入 `actualDurationSec`。
- **默认分配由模板给出**，用户只需微调。不改也能直接出片（保住「易生成」底线）。
- **价格随决策实时变化**：切一段成「分身出镜」价格上涨，切回下降。顶部常驻价格条——用户自己就理解了定价逻辑（出镜时长 = 成本）。

### 2.2 为什么这个粒度对

石榴的原子能力是 `(文本 + avatarID + speakerID) → 一段自带音频的口播视频`。**接口粒度就是"一段文本"**，所以产品的决策单元也应该是"一段文本"，而不是时间轴上的任意区间。这让 UI 与引擎天然对齐，且规避了"把音频精确掐到第 10 秒"这类对齐难题——**时长由文本自然涌现**。

---

## 3. 石榴AI 能力对齐

**官方文档**：https://api.16ai.vip/　**BaseURL**：`https://api.16ai.chat/api/v1/`　**鉴权**：`Authorization: Bearer ${token}`

### 3.1 已确认（官方文档页）

| 模块 | 接口 | 输入 → 输出 |
|---|---|---|
| **Speaker**（声音克隆） | Create Speaker | 语音素材 → `speakerID` |
| | Text To Speech | 文本 + `speakerID` → 合成语音 |
| | Query Status / List Speakers | 训练状态 / 列表 |
| | Recreate Speaker | 重训，**最多 4 次** |
| **Avatar**（形象克隆） | Train Avatar Model | 视频素材 → `avatarID` |
| | Train Avatar Model By Image | **单张照片** → `avatarID` |
| | Query Training Status / List Avatars | 状态 / 列表 |
| **Video**（口播合成） | Create Video By Text | 文本 + avatarID + speakerID → 视频（**内含 TTS**） |
| | Create Video By Voice | 音频 **URL** 驱动 |
| | Create Video By AudioFile | 音频**文件**驱动 |
| | Query Video Status | 生成进度 |
| **Asset** | Get Asset / Get Records | 账户剩余权益 / 算力变更记录 |
| **Upload** | Get Upload URL | 预签名 URL |
| **AuthVideo** | Create Authorization Video | **训练前置授权校验**（与我们 v0.105 七牛 modelink 刷脸证据链同构） |

**任务模型**：全异步 + **仅轮询，文档未见回调机制**。

### 3.2 未确认 —— M0 必须拿测试 key 实测 / 商务确认

公开文档**没有**给出以下规格，全部列为尽调项：

1. **视频输出规格**：分辨率（是否支持 720×1280 竖屏）、帧率、码率、是否带水印、编码格式
2. **单次生成时长上限**（决定一个出镜段最多能标多少句）与**实际耗时**
3. **计费口径与单价**：按秒/按次/按字符？阶梯价？并发配额？
4. **音色一致性**（最关键，见 §4.2）：`Create Video By Text` 内嵌 TTS 与独立 `Text To Speech` 接口，**同一 speakerID 出来的音色与响度是否完全一致**
5. **数字人段背景可控性**：绿幕/纯色/固定场景？**若支持抠像**，可解锁"数字人画中画叠在店铺画面上"的高级形态
6. **同一 avatarID 多段生成的形象一致性**：服装、景别、机位是否可指定/可复现
7. **照片训练 vs 视频训练的质量差**（决定克隆向导的采集要求）
8. **口型同步质量**（尤其 By AudioFile 路径）
9. **合规责任边界**：深度合成算法备案主体是他们还是我们；用户人脸/声音素材的存留与删除政策；内容审核责任
10. **SLA / 故障时的降级约定**

> ⚠️ 有二手来源（AI 工具导航站）提到"可设置视频时长、分辨率、背景音乐"，**未经官方文档确认**，不要据此设计。

### 3.3 石榴AI 在方案中的定位

**核心供应商，但可替换**。我们服务端目前**完全没有 TTS / 数字人口播能力**（见 §5.2 缺口），石榴正好补齐这条链。通过 `ShiliuGateway` 抽象隔离，M0 不达标可换引擎（火山、腾讯智影等）。

---

## 4. 渲染管线设计

### 4.1 主方案（Strategy A）：分段生成，音频天然连续

```
① LLM 定稿文案（prompt key clip.voiceover_copy / clip.voiceover_rewrite）
        ↓ 按段切分
② 并发生成所有段（各段互相独立）：
   ├─ role=avatar : 石榴 Create Video By Text(段文本, avatarID, speakerID)
   │                 → 视频（自带音频，音画已同步）
   └─ role=broll  : 石榴 Text To Speech(段文本, speakerID) → 音频
                    + 用户 b-roll 视频（静音 -an，按音频时长裁剪/循环）
        ↓ 每段时长确定 → 句级字幕时间轴直接推出（不依赖上游时间戳）
③ ffmpeg 总装（复用 mixcut 范式）：
   视频轨: 段1 + 段2 + ... + 固定尾段
   音频轨: 各段音频顺序衔接（天然连续）+ 尾段自带原声
   BGM   : -stream_loop -1 + volume 低 + amix=inputs=2:duration=longest
   字幕   : picgen PNG overlay（绕开服务器字体依赖）
   规格   : concat 交错 [v0][a0][v1][a1]... → 720×1280 → libx264/aac → +faststart
```

**音频连续性的实现**：不需要"一条长音频铺全片"——每段音频紧跟其视频段，concat 后听觉上就是连续的。这是最简实现。

### 4.2 备选方案（Strategy B）：全文 TTS 先行 + AudioFile 驱动

**触发条件**：§3.2 第 4 项实测发现**接缝处音色/响度不一致**（内嵌 TTS ≠ 独立 TTS）。

```
① 定稿文案 → 按段 TTS（同一 speakerID）→ 拿到所有段音频
② role=avatar 段：石榴 Create Video By AudioFile(该段音频)
   ← 用同一条音频驱动，音色必然一致
③ role=broll 段：直接用该段音频 + b-roll
④ 总装同上
```

优点：音色绝对统一（**这正是石榴提供 By Voice / By AudioFile 接口的用途**）。
缺点：多一次上传/调用，链路更长、更慢。

> **决策点**：M0 实测后二选一，写入本文档。默认按 A 实现，Gateway 接口需**同时暴露 By Text 与 By AudioFile**，以便切换成本为零。

### 4.3 b-roll 时长对齐

| 情况 | 处理 | 现有能力 |
|---|---|---|
| 素材短于音频段 | `-stream_loop` 循环，或末帧静帧延长 | ✅ MixcutRenderingService 已用 `-stream_loop -1` |
| 素材长于音频段 | `-ss <in> -t <segDur>` 裁剪（默认取前 N 秒，可让用户指定 in 点） | ✅ 已有 `slot_time_range` / `random` 两模式 |
| 素材横屏 / 比例不符 | `fit=cover`（裁切）或 `fit=contain`（模糊背景补边） | ✅ 已有，`boxblur=luma_radius=14` |
| 素材无音轨 | b-roll 一律 `-an`，音频只来自 TTS | ✅ 已有 `hasAudioStream` 探测 |
| 静态图片当 b-roll | 单帧输入 + `repeatlast`（**不要用 `-loop 1`**，精简 build 不识别） | ✅ 已有踩坑记录 |

### 4.4 并发与计费

- 所有段**并发生成**（互相独立）；并发上限受线程池约束（照 `MaterialVideoProperties.maxConcurrent` 惯例，默认 3）
- 计费 **hold → 全部段成功 → commit；任一失败 → release 全额**
- hold 总额 = Σ(出镜段预估秒数 × 单价) + TTS 字数计价 + 合成固定费
- **提交前 preflight**：分身/声音未就绪、端点未配置、素材缺失 → 一律前置报错，**不 hold、不建单**（§8.0）

---

## 5. 基座复用映射

### 5.1 可直接复用（几乎白拿）

| 需要的能力 | 现有实现 | 位置 |
|---|---|---|
| ffmpeg 进程封装 + filter 能力探测 + 超时 | `FfmpegRunner`（薄封装，18 个 CRITICAL_FILTERS 三阶段探测、`probeDurationSec`、`hasAudioStream`、启动期健康检查） | `apps/server/src/main/java/com/aistareco/aep/service/mixcut/FfmpegRunner.java` |
| **交错 concat 拼接 + 裁剪 + 缩放 + BGM 混音 + overlay** | `MixcutRenderingService`（1925 行，`[s0][as0][s1][as1]` 交错、`-ss/-t`、`scale=w=:h=`、`fit=cover/contain`、`aresample=44100`+`aformat=stereo`、`amix=inputs=2:duration=longest`、`FilterCaps` 逐项降级） | 同目录 `MixcutRenderingService.java` |
| 素材上传（multipart + MIME 白名单 + 100MB + ffprobe 时长 + OSS 同步推） | `MixcutAssetService`（`upload` / `uploadPreset` / `uploadOfficial` 三路径，`listVisibleTo` = 自己 + 全部 preset） | 同目录 `MixcutAssetService.java` |
| 通用垫底素材池（平台级公共素材） | preset 机制（`is_preset=true` / `ownerUserId=null` / `presetGroup` 分组） | `MixcutPresetSeeder.java` |
| 字幕/文字生图（绕开服务器字体依赖） | `PicgenClient.renderPng` + 渲染期每变体每槽位合入 overlay | `MixcutPicgenController.java` |
| 异步任务范式（afterCommit 派发 + REQUIRES_NEW 进度写 + hold/commit/release + 失败清理 CDN 孤儿） | `MixcutJobService.createInternal` + `MixcutRenderingService.renderAsync` + `MixcutAsyncConfig` | 同目录 |
| 视频生成任务的**轮询 worker 范式** | `MaterialVideoWorker`（`@Async` 单任务一线程、`Thread.sleep` 轮询、成功镜像 CDN + commitHold、失败/超时 releaseHold、进度封顶 95%） | `service/materialvideo/MaterialVideoWorker.java` |
| 草稿自动保存 + 资产 URL 读时重签 + 30 天回收站 | `DramaShortService`（`resignPayloadAssets`、`TRASH_RETENTION_DAYS`、卡片列从 payload 重算） | `service/DramaShortService.java` |
| 积分三段式 + admin 可配单价 | `CreditService` + `PlatformConfig`（`drama.credit.*` 模式） | `service/CreditService.java` |
| 多平台代发 + 错峰定时 | `publish-batch` + `ScheduleExpander`（`immediate` / `single` / `daily_recurring` + `time_slots × max_days` + `jitter_minutes ≤30`） | `controller/MixcutPublishController.java`、`service/publish/ScheduleExpander.java` |
| 一用途多候选端点 + capability + 单价 override | `AiAppEndpointCandidate`（`maxRefImages` / `supportsFirstLastFrame` / `maxDurationSec` / `creditCostOverride`） | `model/AiAppEndpointCandidate.java` |
| 内容安全审核用途 | `AiModelPurpose.SAFETY_REVIEW`（枚举已存在） | `model/AiModelPurpose.java` |
| 真人授权证据链范式 | dap 域 LIC + 刷脸 + `dap_consent` 快照 | `dap/service/DapRealAuthService.java` |
| 小程序工程范式 + 平台坑库 | `apps/miniprogram`（原生、13 页、自定义 tabBar、`X-App-Code` 审计短码） | `apps/miniprogram/agent.md`（**必读**） |
| 移动端 H5 SPA 范式 | `web-aiavatar`（Next 16 单壳 + 自研 hash 路由 + `AppShell` 安全区 + 下拉刷新） | `apps/web-aiavatar/src/proto/app.tsx:109-188` |

### 5.2 服务端的真缺口（必须新建）

| 缺口 | 事实依据 |
|---|---|
| **无任何 TTS / 语音合成** | 全仓 Java 侧 `TTS\|textToSpeech\|speech` 只命中两处**注释**：`dap/model/DapVoice.java:20`「TTS 合成排期中」、`dap/service/DapVoiceService.java:22`「Agnes 暂无 TTS API」。`AiModelPurpose` 15 个值中**没有任何 audio/voice 用途** |
| **`DapVoice` 是空壳** | `POST /api/v1/voices/clone` 只上传采样落库 + 扣 `dap.voice-clone`（默认 10，直接 debit），**无声纹建模**；`/voices/preview` 克隆声线返回**原始采样**，内置音色返回文案「在线试听即将上线」。前端已诚实降级（`web-aiavatar/src/proto/screen-more.tsx:367`） |
| **无「讲话的人」这种产物** | `DapComposition`（`POST /api/v1/compositions`）**只出静态 PNG**（`768×1365` 等），不出视频；dap 视频衍生走 i2i，不是口播 |
| **`DramaAssembleService` 能力不足** | 纯 concat：**无转场、无音轨混音、无字幕、无逐段裁剪**（`service/DramaAssembleService.java`）。clip 的总装要用 mixcut 那套，不要用它 |
| 小程序无媒体上传 | 全仓无 `wx.chooseMedia` / `wx.chooseVideo` / `wx.uploadFile` / `wx.saveVideoToPhotosAlbum`；唯一原生媒体交互是 `wx.previewImage` |

---

## 6. 新增数据模型草案

> 按 §5 新增领域 SOP：**前端 `packages/types/src/clip.ts` 是类型真源**，后端 DTO 字段名 1:1 匹配；enum 出 wire 全小写。
> §4.7 强制：所有资产字段真值是 **`cdnKey`**，URL 是出 wire 时由 `CdnUrlSigner.signKey()` 派生；**不要新增 `cdnUrl` 列**。

### 6.1 `clip_template` — 模板（母版）

```
id                  ct_xxx
name / industry / themeKey / description
status              draft | published
ownerScope          official | user
scriptSkeletonJson  { segments:[{no, text, defaultRole:"avatar"|"broll", varKeys:[]}],
                      variables:[{key, label, placeholder, required}] }
timelineJson        默认画面分配 + 每段建议画面提示语（"这里放：你店铺的招牌特写"）
tailClipsJson       固定尾段 [{cdnKey, durationSec, label, replaceable}]
brollPoolJson       通用垫底素材 id 列表（走 preset 机制）
previewCoverKey / previewVideoKey
ratio / estDurationSec / creditHint
createdAt / updatedAt / deletedAt
```

设计参照：celebrity 线 `TemplateScript`（`model/TemplateScript.java`，大对象全走 JSON 列、`kind` 决定必填字段、同 templateId 同时仅一条 PUBLISHED 由 service 强约束）——这套已验证，照抄。

### 6.2 `clip_project` — 一次出片（草稿态，可反复编辑）

```
id                  cp_xxx
ownerUserId         （强属主隔离）
templateId / title
status              draft | generating | done | failed
payloadJson         { variables:{},
                      segments:[{no, text, role:"avatar"|"broll"|"tail",
                                 assetId?, brollSource:"user"|"preset",
                                 estDurationSec, actualDurationSec?,
                                 audioCdnKey?, videoCdnKey?}],
                      avatarId, voiceId, bgmAssetId?, subtitleStyle }
-- 卡片列（从 payload 重算，照 DramaShortService 惯例）
durationSec / avatarSeconds / segmentCount / progress
deletedAt           （30 天回收站）
```

### 6.3 `clip_render_job` — 渲染任务

```
id                  cj_xxx
ownerUserId / projectId
status              queued | generating | assembling | succeeded | failed
progress / stage / heartbeatAt      ← ⚠️ 必须配套 stale reaper，见 §11
creditsHeld
segmentJobsJson     每段子任务状态（avatar 段的石榴 taskId / broll 段的音频 cdnKey）
outputCdnKey / thumbnailCdnKey / durationSec
errorMessage
```

### 6.4 `clip_asset` — 用户 b-roll 素材

**决策：新建，不复用 `MixcutAsset`。** 理由是 v0.108 的教训——`material_video_job` 被两条业务线共用导致**跨子产品视频资产串号**（明星带货素材库出现短剧分镜视频），事后不得不加 `app` 列 + 强制显式传 app 修复。新业务线一开始就分表更干净。
（备选：给 `MixcutAsset` 加 `app` 列复用全部上传/preset 逻辑——若排期紧可选，但必须同时改所有查询路径。）

字段照 `MixcutAsset` 范式：`kind` 白名单（video/image/bgm）、MIME 白名单、100MB 上限、`localPath`（渲染用）+ `cdnKey`（真值）、ffprobe 时长、preset 三态。

### 6.5 分身资产：扩展 dap 域，不另建

延续 v0.61「数字人统一收敛到 AiAvatar」的方向：

```
DapAvatar 加列：engine (agnes|shiliu)、engineRef (石榴 avatarID)、engineTrainedAt、engineStatus
DapVoice  加列：engine、engineRef (石榴 speakerID)、engineTrainedAt、engineStatus
```

顺带把 `DapVoice` 的 TTS 空壳填实（前端已有「TTS 上线后可直接使用」的文案位）。授权快照复用 `dap_consent`。

> ⚠️ 已知不一致（顺手修或记 TODO）：六类资产字典声明声音前缀为 `VO-`（`DapAssetService.TYPE_DEFS`），但 `DapVoiceService.uniqueId()` 实际发 **`VC-`**；且声音是六类里**唯一没有软删除**的资产（不进回收站）。

---

## 7. API 端点草案

> 契约必须同步 `specs/openapi.yaml`（CI `pnpm check:api-contract` 守门）。

```
# 模板
GET    /api/me/clip/templates                      列表（industry / theme 筛选）
GET    /api/me/clip/templates/{id}                 详情（含骨架 + 时间线 + 尾段）

# 项目（草稿）
POST   /api/me/clip/projects                       从模板建项目
GET    /api/me/clip/projects                       我的作品（含生成中）
GET    /api/me/clip/projects/{id}
PUT    /api/me/clip/projects/{id}                  保存草稿（防抖自动保存）
DELETE /api/me/clip/projects/{id}                  软删 → 回收站
POST   /api/me/clip/projects/{id}/restore | /purge

# 文案与试听
POST   /api/me/clip/projects/{id}/script/ai-rewrite    整段 / 单段 AI 改写
POST   /api/me/clip/projects/{id}/preview-voice        单句试听（TTS，回填真实时长）
POST   /api/me/clip/projects/{id}/estimate             报价预估（出镜秒数 + TTS + 合成）

# 出片
POST   /api/me/clip/projects/{id}/render               提交 → clip_render_job
GET    /api/me/clip/jobs/{id}                          轮询进度
POST   /api/me/clip/jobs/{id}/cancel                   取消（协作式，退 hold）

# 素材
GET    /api/me/clip/assets                             我的 + preset
POST   /api/me/clip/assets                             multipart 上传
DELETE /api/me/clip/assets/{id}

# 分身（走 dap 现有域扩展，clip 只引用）
POST   /api/v1/avatars/clone-engine                    发起石榴形象克隆（含授权前置）
POST   /api/v1/voices/clone-engine                     发起石榴声音克隆
GET    /api/v1/avatars | /voices                       含 engineStatus 训练状态

# admin
GET/POST/PUT/DELETE  /api/admin/clip/templates[/{id}]  模板管理
POST                 /api/admin/clip/preset-assets     通用垫底素材上传
```

### 新增枚举与配置键

```java
// AiModelPurpose 新增
CLIP_TTS              // 文本转语音
CLIP_AVATAR_VIDEO     // 数字人口播视频
// 文案改写复用 SCRIPT_DRAFT，或新增 CLIP_SCRIPT（倾向复用）
```

```
# PromptService keys（admin 可配，origin=code 即未配置 → 503 不扣费）
clip.voiceover_copy        文案初稿
clip.voiceover_rewrite     整段/单段改写

# PlatformConfig 计费键（admin「口播视频专区」可配）
clip.credit.avatar-second      数字人出镜（按秒）
clip.credit.tts-per-kchar      TTS（按千字符）
clip.credit.assemble           总装固定费
clip.credit.avatar-clone       形象克隆（一次性）
clip.credit.voice-clone        声音克隆（一次性）
clip.credit.entry              建项目入场费（建议 0 = 免费）
clip.credit.confirm-threshold  小额免打扰阈值
```

### 错误码（§8.0：生产禁止静默降级）

| 码 | HTTP | 触发 |
|---|---|---|
| `CLIP_ENGINE_NOT_CONFIGURED` | 503 | 未绑定 `CLIP_*` 端点且 mock 未允许 → **不建单、不扣费、不产假数据** |
| `CLIP_AVATAR_NOT_READY` | 409 | 形象未训练完成 |
| `CLIP_VOICE_NOT_READY` | 409 | 声音未训练完成 |
| `CLIP_CONSENT_REQUIRED` | 403 | 未完成本人授权核验就要克隆 |
| `CLIP_SEGMENT_TOO_LONG` | 400 | 单个出镜段超过引擎时长上限 |
| `CLIP_ASSET_NOT_ALLOWED` | 400 | b-roll 素材格式/大小不合规 |

**Gateway 抽象（照 v0.105 `ModelinkGateway` 范式一比一落地）**：

```
ShiliuGateway (接口)
  ├─ HttpShiliuGateway   Bearer token；接入点经 admin「AI 应用绑定」解析，无 env 兜底
  └─ MockShiliuGateway   dev 惰性状态机；产物一律打 mock=true
ShiliuService (facade)   已配置 → HTTP；未配置且 aep.clip.allow-mock=true（dev 默认）→ mock；
                         否则 503。生产 profile 误开 mock → 启动 ERROR 横幅
```

Gateway 接口**必须同时暴露 `createVideoByText` 与 `createVideoByAudioFile`**，以便 §4.2 的 A/B 切换零成本。

---

## 8. 端选型

**新建独立微信小程序 `apps/miniprogram-clip`（正式形态）+ 移动 H5 `apps/web-clip`（port 3015，内测/降级通道）**，共享后端与 `packages/types` 契约。

- **不扩展现有 `apps/miniprogram`**：那是 celebrity 带货方消费端（`X-App-Code: celebrity-mp`），受众/品牌/审核类目都不同
- **小程序是正式形态**：目标用户（实体店主）在微信里，成片天然在微信转发，拍摄用原生 API 最顺
- **H5 先行**：复用 `packages/ui` + `api-client`，照 `web-aiavatar` 的 hash-SPA 范式开发快数倍；且**小程序深度合成类目审核 + 备案周期不可控**，H5 不被它阻塞
- 小程序端**新增面**：`wx.chooseMedia`（拍摄/相册）、`wx.uploadFile`（素材上传）、`wx.saveVideoToPhotosAlbum`（保存成片）、录音（声音采集）、提词器滚动。现有小程序这些全没有，但微信原生 API 齐全，风险低
- 顺手补：现有 `utils/api.js` 的 `apiFetch` **无全局 401 处理**（token 过期不跳登录），新端不要继承这个缺陷

---

## 9. 合规（不可省，是上线前置）

1. **深度合成显著标识**：成片必须带 AI 生成标识（界面角标 + 成片内水印/片尾说明）。这是《互联网信息服务深度合成管理规定》的硬要求
2. **算法备案主体**：必须与石榴明确是他们备案（我们作为调用方）还是我们自行备案 —— **商务合同必须写清**
3. **本人授权核验**（克隆前硬闸）：
   - 石榴 `Create Authorization Video` 训练前置校验
   - **我们自己另留一份** consent 快照（照 v0.106 `dap_consent`），不能只依赖上游
   - 严禁拿他人照片/声音克隆 —— 这是产品最大法律风险点
4. **可删除权**：用户可随时删除自己的分身（含要求上游删除），UI 要明示
5. **b-roll 素材审核**：用户上传素材进公开成片，需过机审（`SAFETY_REVIEW` purpose 已存在）
6. **参考样片版权**：《为实体发声》是惊艳传媒作品，作为模板需取得授权；固定尾段素材同理

---

## 10. 分期路线

| 阶段 | 周期 | 内容 | 出口判据 |
|---|---|---|---|
| **M0 · POC** | 1~2 周 | 拿石榴测试 key 实测 §3.2 全部 10 项；`ShiliuGateway` + Mock 落地；A/B 策略二选一定稿；音频连续 + b-roll 对齐的 ffmpeg 配方本地跑通 | 形象相似度 / 声音自然度 / 口型同步 / 分段时长稳定性 / 单价 五项达标 → go |
| **M1 · MVP** | 3~4 周 | clip 域 server（走 §5 新增领域 SOP 六步 + openapi 契约）；克隆向导（含授权核验）；三步出片全链；《为实体发声》单模板；H5 内测 | 从进模板到拿成片 **< 5 分钟**；四门编译全绿 |
| **M2** | +3 周 | 模板库扩展（换主题 = 换文案骨架 + 槽位分配）；小程序上架（并行推备案与类目）；publish-batch 四平台代发 + 保存相册 | 小程序过审；四平台代发通 |
| **M3** | 持续 | 模板市场化（照 `DramaRecipe` 官方/用户双通道）；b-roll 智能校验（AI 判素材是否贴题）；数字人画中画（若 §3.2-5 抠像可行）；合拍品类 | 模板复用次数 / 商家续费率 |

**每阶段提交前必过四门**（`AGENTS.md` §2）：

```bash
pnpm typecheck:all && pnpm typecheck:admin && \
(cd apps/server && ./mvnw compile -q -o) && pnpm check:api-contract
```

---

## 11. 风险与已知基座缺口

### 供应商与合规

1. **石榴AI 供应商风险**（最高）：文档规格不全、配额/SLA 未知、计费口径未知 → Gateway 抽象兜底，M0 不达标即止损换引擎
2. **小程序审核不可控**：深度合成类目 + 备案 → H5 通道兜底，两端共享后端零重复投入
3. **克隆滥用**：拿他人形象声音克隆 → 授权核验双证据（上游 + 自留快照）+ 人工抽检

### 出片质量

4. **接缝音色不一致** → §4.2 Strategy B 兜底
5. **b-roll 质量参差**（光线/构图/抖动）→ 拍摄要点提示 + 亮度归一 + 通用素材垫底 + 用户可反复换
6. **数字人段形象不一致**（多段出镜服装/景别跳变）→ M0 验证可控性；不可控则限制单片只出镜一次，或用同一段循环

### 直接从本次摸底发现的基座缺口（clip 实现时必须规避 / 顺手修）

7. **`DapJobRunner` 没有 stale job reaper**：`heartbeatAt` 字段勤快写入，但**全仓没有任何 `@Scheduled` 扫它**。进程在 job running 中被 kill（部署/重启）→ 该 job 永远停在 `running`，冻结积分既不 commit 也不 release，且 `retry` 只接受 `failed` 状态，**用户无法自救**。`waitForTasksToCompleteOnShutdown(true)` + 30s 只能覆盖短任务，视频任务（数分钟）必然超时被丢。
   → **clip 的 job 必须自带 reaper**（扫 `heartbeatAt` 超期 → 判 failed + releaseHold），或走 `MaterialVideoWorker` 模式。**不要照抄 DapJobRunner 的这个缺陷。**
8. **`PublishJobScheduler` 是单实例约束**：`@Scheduled(fixedDelay=10s)`，多实例部署需 ShedLock（现状未加）
9. **`MixcutPresetSeeder` 的 preset 素材链不完整**：`resources/preset-stickers/` 目录**不存在**；`uploadPreset` / `registerPresetRow` **没有任何 controller 调用方**（注释提到的 `/api/admin/mixcut/preset-stickers` 路由未实现），当前只有 ffmpeg lavfi 合成的 5 张 demo GIF。
   → clip 若复用 preset 机制做「通用垫底素材」，**必须先补 admin 上传路由**
10. **`MixcutAsset` 渲染始终读 `localPath`**（OSS 只是 best-effort 备份）→ 多实例部署时素材本地不存在会失败；clip 新素材实体应设计成**优先 CDN 拉取 + 本地缓存**（可复用 `AssetDownloader.ensureLocal`，SHA-256 缓存到 `./mixcut-work/asset-cache`）
11. **sau-service 代发的平台边界**：真正可发只有 **抖音 / 快手 / 小红书 / 视频号**（`SocialPlatform.enabledInV1()`）；bilibili / tiktok / youtube / baijiahao 会 501 `PLATFORM_NOT_IMPLEMENTED`。短信二次验证**只有抖音接了真 selector**，其余三家是 `_PlaceholderSmsDriver`，触发风控会卡到 `AWAIT_USER_TIMEOUT` —— 产品文案不要承诺"全平台一键发布"

---

## 12. 待决问题（需要人拍板）

| # | 问题 | 影响 | 建议 |
|---|---|---|---|
| 1 | 石榴商务条款：单价 / 配额 / SLA / 备案主体 / 数据删除政策 | 决定 go-no-go 与定价 | M0 前必须谈完 |
| 2 | 产品正式名（「快出片」是工作名） | 品牌 / 小程序命名 / 类目 | 产品定 |
| 3 | 视觉基调：暖色人文纪实（贴合实体商家）vs 对齐 AiAvatar/短剧的深色质感 | 设计语言统一性 | 倾向前者，人群优先 |
| 4 | 首发模板是否直接用《为实体发声》 | 需要惊艳传媒授权 | 需商务确认 |
| 5 | 克隆定价模型：一次性买断 / 订阅 / 首次免费 | 转化漏斗 | 建议首次免费 + 出片收费 |
| 6 | 「合拍」品类是否本期做 | 排期 | 建议 M3，不与主链竞争 |
| 7 | b-roll 是否强制要求用户上传（vs 允许全用通用素材出片） | 成片同质化 vs 转化率 | 允许但强提示，保「易生成」 |

---

## 附录 A：设计提示词（发 Claude Design，已含最终逻辑）

```text
请为一个微信小程序设计移动端 UI 原型（约 12 屏）。

【产品】「快出片」—— 数字分身口播视频小程序。
用户克隆一次自己的形象和声音（数字分身），之后每条视频三步出片：改文案 →
给每句话配画面 → 出片。成片逻辑：一段口播文案贯穿全片（用户克隆的声线），
用户逐句决定画面——这句让"数字分身出镜说"（如开头 10 秒、中段再穿插一次），
还是"配店铺画面"（自己上传的实拍素材，声音继续念）；结尾接一段固定的集体
发声与团队愿景片段（可替换）。示例模板《为实体发声》：2 分 42 秒纪实倡导片，
暖光街景、褪色招牌、"攒一束光"的旁白。

【目标用户】实体店主、本地生活创作者、MCN 运营。不会剪辑、不想天天露脸
拍摄，但需要持续出片。40+ 岁用户要能独立完成。

【屏幕清单】
1. 登录：手机号 + 短信验证码
2. 首页（tab）：顶部「继续上次」大卡 + 我的数字分身状态卡（未创建时是醒目
   引导："花 5 分钟，克隆你的数字分身"）+ 模板精选流（按行业/主题分类）
3. 模板详情：竖屏效果预览 + 结构拆解图（哪些句子分身出镜、哪些配画面、结尾
   固定段）+ 积分价格 + 「开始制作」
4. 数字分身克隆向导（分步）：① 本人授权核验（人脸核验 + 协议确认，说明用途）
   ② 形象采集（对镜头拍一段/上传视频或照片，带拍摄要点）③ 声音采集（照屏幕
   读一段文字录音）④ 提交训练 → 训练中状态页（预计时间、可先用平台预置形象）
5. 制作 · 第 1 步 改文案：整段口播文案编辑（变量已按店铺信息预填高亮）+
   整段 AI 改写 + 单句手动编辑 + 单句试听（用户自己的声线）
6. 制作 · 第 2 步 配画面（核心交互屏）：文案逐句列表，每行 = 句子文本 +
   画面类型标签（「分身出镜」橙色 / 「配画面」蓝色，点击切换）+ 画面缩略图
   或建议提示（如"这里放：你店铺的招牌特写"，点击 → 拍摄/相册/我的素材）；
   模板已预置好分配（开头几句=分身出镜，中间=配画面），用户只需微调；
   顶部常驻实时价格条——把某句切成"分身出镜"价格即时上涨，切回即降，
   要让用户直观感受"出镜时长=成本"；结尾行标注"固定片段"（可整段替换）
7. 制作 · 第 3 步 出片确认：成片预计时长 + 出镜秒数 + 积分消耗明细 + 生成按钮
8. 生成过渡页：分步进度（配音 → 分身出镜段 → 画面合成 → 总装），可离开稍后回来
9. 成片详情：竖屏播放器 + 字幕展示 + 保存相册 + 一键代发（抖音/快手/小红书/
   视频号）+ 「再出一条」（换文案变量快速复制）
10. 我的素材库：我上传过的店铺画面（网格 + 标签），可复用到任何模板
11. 我的作品（tab）：生成中（带进度）/ 已完成 / 已发布（带平台数据），含空状态
12. 我的（tab）：积分钱包 + 充值套餐 + 数字分身管理（形象与声音卡片、训练
    状态、重新采集、授权记录、可随时删除）+ 设置

【设计约束】
- 竖屏 9:16 为绝对视觉中心，预览用真实比例竖版卡片
- 「改文案 / 配画面 / 出片」三步导航始终可见
- 第 6 屏是全产品最重要的一屏：逐句列表要像"填格子"，禁止剪辑软件式轨道
  界面；「分身出镜」与「配画面」两种行样式差异要一眼可辨
- 视觉基调：人文纪实 —— 暖光、胶片颗粒、真实街景摄影（卷闸门、修鞋摊、
  褪色招牌）；主色温暖琥珀/橙红（呼应"攒一束光"），辅深灰蓝；标题可用有
  力度的宋体点缀，正文无衬线；避免科技冷感与赛博风
- 全中文，禁止内部术语（说"出片""配画面"，不说"渲染""切片""引擎"）
- 数字分身页面传达安全感：授权核验、仅本人可用、可随时删除
- AI 生成内容带「AI 生成」合规角标；付费动作前明示积分
- tabBar 三项：首页 / 我的作品 / 我的；「开始制作」用中央凸起大按钮
- 微信小程序规范：自定义 tabBar、底部安全区
```

---

## 附录 B：关键源码索引（本方案的事实依据）

所有 Java 路径相对 `apps/server/src/main/java/com/aistareco/aep/`：

| 主题 | 文件 |
|---|---|
| ffmpeg 封装 / 能力探测 | `service/mixcut/FfmpegRunner.java` |
| **拼接 / 裁剪 / 缩放 / 混音 / overlay 全部范式** | `service/mixcut/MixcutRenderingService.java`（1925 行，clip 总装的抄写对象） |
| 素材上传 / preset 机制 | `service/mixcut/MixcutAssetService.java`、`service/mixcut/MixcutPresetSeeder.java` |
| 异步任务 + 计费 + 进度 | `service/mixcut/MixcutJobService.java`、`config/MixcutAsyncConfig.java` |
| 视频生成 worker 范式 | `service/materialvideo/MaterialVideoWorker.java`、`MaterialVideoJobService.java`、`config/MaterialVideoProperties.java` |
| 草稿态 / 读时重签 / 回收站 | `service/DramaShortService.java` |
| 出图出片端点 + applied_refs | `service/DramaRenderService.java`、`service/DramaReferenceAssembler.java` |
| ffmpeg concat（能力不足的反例） | `service/DramaAssembleService.java` |
| 模板实体范式 | `model/TemplateScript.java`、`model/CelebrityTemplate.java` |
| 端点候选 + capability | `model/AiAppEndpointCandidate.java`、`service/AiModelInvocationService.java` |
| 用途枚举（**无 audio/voice**） | `model/AiModelPurpose.java` |
| TTS 缺口的证据 | `dap/service/DapVoiceService.java:22`、`dap/model/DapVoice.java:20` |
| 跨资产合成（**只出静态图**） | `dap/service/DapCompositionService.java`、`dap/service/DapAssetJobs.java`（`runCompose`） |
| 外部 Gateway 抽象范式（照抄对象） | `dap/service/ModelinkService.java` + `HttpModelinkGateway` / `MockModelinkGateway` |
| 真人授权三道闸 | `dap/service/DapWorkflowService.java:120-128`、`:305-306`、`dap/service/DapCaptureService.java:123`、`dap/service/DapRealAuthService.java` |
| 任务执行 / 取消 / 计费收口（**含无 reaper 缺陷**） | `dap/service/DapJobRunner.java`（875 行） |
| 代发 + 错峰调度 | `controller/MixcutPublishController.java`、`service/publish/ScheduleExpander.java`、`service/publish/PublishJobScheduler.java` |
| 平台能力边界 | `model/SocialPlatform.java`（`enabledInV1()`）、`service/SauServiceClient.java` |
| 小程序工程范式 + 平台坑 | `apps/miniprogram/agent.md`（**必读**）、`apps/miniprogram/utils/api.js` |
| 移动 H5 SPA 范式 | `apps/web-aiavatar/src/proto/app.tsx:109-188`、`src/proto/shell.tsx` |

**外部文档**：石榴AI 开放平台 https://api.16ai.vip/ （BaseURL `https://api.16ai.chat/api/v1/`）
