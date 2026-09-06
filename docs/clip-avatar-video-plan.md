# 「快出片」数字分身口播视频线 · 方案与 Handoff

> **业务线代号**：`clip`（口播视频线）　**产品工作名**：快出片（待定）
> **文档状态**：**M1 服务端、石榴官方单视频 Avatar 创建/可选声音增强/多数字人选择与多段 ffmpeg 总装已落地；文案句与视觉镜头分层，模板固定视频可后台配置，作品有真实生成时间与可取消/删除闭环，V2 克隆音色统一驱动数字人与 b-roll，逐句字幕、默认关闭的可选 AI 水印与音画质量门已启用；本人素材质量实测、媒体审核与真实代发未上线**。
> **创建**：2026-08-10　**last-reviewed**：2026-08-19
> **上游背景**：基于已有 AI 短剧（`apps/web-drama` + `apps/server` drama 域）基座能力，做一个手机端/小程序的轻量素材视频产品；数字人口播能力拟接入外部供应商**石榴AI**。

## 实施状态（2026-08-18）

- v0.135 补齐跨系统账号保留期契约：军师注销后先封禁、保留 30 天；到期 worker 才调 `DELETE /api/me/clip/account` 清理该 external owner 的项目、任务、素材、分身、声音和存储对象。渲染提交同时增加 `GET /api/me/clip/jobs/by-request/{clientRequestId}`，供 BFF 对超时结果查证，未确认拒绝前不得退回积分。

- 新增 `packages/types/src/clip.ts`、Java `clip` 独立领域与 `V14__add_clip_domain.sql`，包含模板、项目、任务、素材四张表；所有用户态查询按军师 `externalOwnerId` 隔离，service token 只代表调用系统，不冒充最终用户。
- 已实现模板/admin preset 上传、项目草稿/重置/30 天回收、素材 100MB + MIME + ffprobe、授权快照、分身/声音克隆抽象、报价/预检、幂等建单、数据库租约 worker、stale reaper、作品查询和四平台发布契约；OpenAPI 已同步。
- 跨系统采用 Scheme A：用户积分只由军师 BFF hold/settle/refund；AIStar 不调用本仓 `CreditService`，仅保存 `creditsHeld` 作为外部报价审计事实。`clientRequestId` 在外部属主内唯一，重复载荷冲突返回 409。
- v0.132 将本人素材改为“服务端签发受限票据 → 手机一次直传 OSS → HEAD 精确核验 → 持久化异步受理”。`clip_upload_session` 以 owner + clientRequestId 唯一，票据只允许一个 object key、精确字节数/MIME 且最长 10 分钟；重复请求回到同一 uploadId，不得重复上传或创建石榴任务。形象视频若为 HEVC/H.265，会在异步阶段先转 H.264/AAC MP4，再走既有 ffprobe、预览帧与克隆流程；旧 multipart 路由仅作兼容。
- `HttpShiliuGateway` 已按官方 API v1 接入声音/形象训练、可选授权视频、V2 TTS、V2 音频驱动出片、状态轮询与删除；上游时效成片立即转存我方持久存储。`ClipCapturePolicy` 在调用前以 ffprobe 校验素材，训练/生成页展示官方真实进度和失败原因。真实 key 仅在预发 0600 env，探针确认 12,000 点、当前没有已训练 speaker/avatar。
- `ClipOfficialTemplateSeeder` 内置「为实体发声 / 今天开门了 / 这门手艺」三套模板，仅补缺失 ID、不覆盖运营编辑。`clip-preprod` 独立 profile 仅监听 127.0.0.1:8081，军师 BFF 以独立 service token 回源，未接触 AIStar 生产。
- v0.115 把 `segments`（逐段改稿）与 `shots`（连续句范围的视觉编排）分层；`ClipShotPlan` 为报价、preflight、worker 和总装的唯一投影层。老草稿无 shot 时相邻且未绑定不同素材的 b-roll 最多 3 句成镜，显式计划必须完整无重叠覆盖全部句子；军师 BFF 的 AI 文案对话记录可随项目 `scriptChat` 一并保存。
- v0.119 进一步对齐石榴 Train Avatar Model：`speakerId` 标注为“选填，用于制作 demo”，与可选 `authId` 一样不能成为创建前置。普通用户上传一段形象视频后立即启动 Avatar 训练；若没有现成音色，服务 best-effort 从视频提取原声创建基础 V2 speaker，失败不阻断形象，专门录音/上传音频是可选增强。v0.117 的时长硬门保持为声音真实 `>2s`、形象视频 `>=5s`，较长时长仅为质量建议。
- v0.120 修复删除只处理最新记录的问题：删除数字分身会遍历 owner 下全部未删除石榴 Avatar/Voice，逐一删除供应商引用、本地素材并软删记录；多次更换形象或声音后，历史版本不会再重新成为当前分身。
- v0.121 为形象补齐真实预览：上传视频在调用石榴前由 ffmpeg 抽取约 0.5 秒 JPEG，保存到 `DapAvatar.imageKey` 并由 `AvatarDto.imagePreviewUrl` 返回签名地址；老记录缺图时读取分身会 best-effort 从源视频回填，删除时源视频与预览帧一并清理。抽帧失败发生在供应商建任务前，避免耗点后端上仍无预览。
- v0.122 为普通配画面素材补齐真实缩略图和可读名称：视频上传时抽取约 0.5 秒 JPEG 到 `ClipAsset.thumbnailCdnKey`，历史视频在读取素材清单时 best-effort 补抽，图片仍直接使用原图；`AssetDto.previewUrl` 因此始终是小程序 `image` 可消费的图片地址。微信 `tmp_*`、`wxfile://` 与长哈希文件名统一显示为“我的视频素材 / 我的图片素材”，删除素材同步清理源文件与缩略图。
- v0.123 将声音训练的真实来源和结果透给产品：`AvatarDto.voiceSource=video|dedicated` 分别表示形象视频自动提取的基础声线和用户主动补录的专属声线；军师端据此展示“视频原声 / 训练中百分比 / 已增强完成时间 / 失败重录”，驻留轮询只查询已有任务，不重复提交训练。
- v0.124 修复缩略图字段发布迁移：V14 恢复为已执行过的原始内容，`clip_asset.thumbnail_cdn_key` 由独立 V15 添加；禁止通过改旧迁移或 Flyway repair 掩盖校验和漂移。
- v0.125 补齐素材打开能力：`AssetDto.previewUrl` 继续承担列表图片封面，新增 `contentUrl` 返回原始图片/视频的短期签名地址，只在用户主动点开时加载；素材库、配画面卡和出片预览可以查看同一份真实素材。
- v0.126 修复合并画面段字幕：视觉 shot 仍可让多句共用同一素材和一次生成，但 `materialize()` 会保留逐句 caption cue；总装按真实段音频总时长比例换算各句时间窗并逐张叠加，字幕随口播切换且单句不再强制两行省略。
- v0.127 支持同一用户维护多个数字人。每个 `DapAvatar` 返回独立名称、预览和关联声音；新建形象可以直接选择已有 ready 声音，项目在配画面阶段保存精确 `avatarId/voiceId`，后续报价、预检和 worker 都只消费本片选择，不再取最新分身。
- v0.127 将固定片段纳入模板后台配置：运营先通过 `/api/admin/clip/preset-assets` 上传视频，再在模板 `tailClips` 绑定 assetId；接口和项目统一使用该视频的名称、秒数、封面与播放地址。三套官方模板内置 6/8/10 秒竖屏缺省视频，只补空配置，不覆盖运营编辑。
- v0.127 为存量完成作品补齐列表预览：任务缺 `thumbnailCdnKey` 但已有最终 MP4 时，作品读取会 best-effort 抽帧并回写。
- v0.128 将可见“AI 生成”水印改为项目级可选能力：`subtitleStyle.aiWatermark` 缺省/false 均关闭，只有用户主动开启才烧录到字幕层和固定尾卡；`WorkDto.aiWatermark` 同步实际偏好给作品页。测试总装继续无条件烧录独立“测试演示”，不受该开关影响。
- v0.129 为作品补齐时间与删除：`WorkDto.createdAt/generatedAt` 分别使用任务开始/完成时间，发布不会覆盖生成时间；删除作品会取消全部活跃任务、释放租约并把项目移入既有 30 天回收区，重复删除继续返回原取消 jobId，供军师幂等补做积分结算。
- v0.129 隔离预发版本 `f5e21ee5-20260812T031204Z` 已发布，force-mock 关闭、服务 active/running、`NRestarts=0`；删除重试继续返回原取消 jobId；部署探针只读 3 套模板，没有提交石榴任务。
- v0.128 隔离预发版本 `dcf5f37d-20260812T023005Z` 已发布，force-mock 关闭、服务 active/running、`NRestarts=0`；部署探针只读模板，没有提交石榴任务。
- v0.127 隔离预发版本 `296756a9-20260811T180005Z` 已发布，force-mock 关闭、服务 active/running、`NRestarts=0`；三套模板固定视频/封面/6/8/10 秒配置与 avatars/voices 清单路由只读通过，本轮没有提交石榴任务。
- v0.126 隔离预发版本 `3560b942-20260811T170602Z` 已发布，force-mock 关闭、服务 active/running、`NRestarts=0`、3 套模板通过；本轮没有上传素材或创建任何石榴任务。
- v0.125 隔离预发版本 `15523450-20260811T165046Z` 已发布，force-mock 关闭、服务 active/running、`NRestarts=0`、3 套模板通过；本轮仅增加原媒体签名读取，没有创建石榴任务。
- v0.119 隔离预发版本 `e9e8e43c-20260811T153721Z` 已关闭 force-mock：服务 active、`NRestarts=0`，3 模板通过；军师 BFF 在线 requirements 返回 `authorizationVideoRequired=false`、形象硬门 5 秒、声音端上硬门 3 秒。自动化没有创建任何计费任务，下一步由用户本人从军师预发真机包提交素材。
- v0.112 按 Strategy A 落地逐段可恢复 worker；v0.113 将无运营素材时的空白尾段升级为三套模板各自的固定品牌尾卡，拼接/BGM 后统一做音轨归一，再以 `signalstats + loudnorm` 对平均亮度、综合响度和真峰值失败关闭。v0.135 把最终音轨改为两遍测量/归一：处理目标 -16 LUFS / -2.5 dBTP 为 AAC 编码峰值回弹留余量，编码后的真实文件仍必须通过 ≤ -1 dBTP 门槛，绝不放宽质量门。`ClipOverlayRenderer` 仍用 Java2D 安全生成尾卡/透明字幕层，逐句字幕经 ffmpeg 永久烧录，用户文案不进入 filter 表达式；v0.128 起“AI 生成”水印只在项目显式开启时一并烧录。成片通过时长、音轨、亮度、响度与真峰值门后才入库并抽帧生成缩略图。v0.114 增加隔离预发专用 `AEP_CLIP_FORCE_MOCK=true`：确定性测试媒体也必须真实生成可播放 MP4 并走同一总装/质检/存储链，永久烧录「测试演示」；production/mysql 启动硬拒绝。公网 BFF 已验收到 44.05 秒、720×1280、H.264/AAC 成片与缩略图，force-mock 全程未请求石榴。
- 非 mysql/production 环境允许显式 mock，mock 产物带 `mock=true`。媒体机器审核未配置时军师 BFF 继续 fail-closed；真实代发仍固定失败。
- 仍需使用本人合规素材完成 §3.2 质量/时延/一致性/规格/成本实测，完成 §12 商务/备案决策，并接媒体审核、授权群像尾片、四平台发布和生产压测/真机验收。

---

## 0. 三句话说清

1. **产品**：用户上传一段视频创建自己的数字分身，视频原声可生成基础声音；需要更稳定音色时再独立补录专属声音。之后每条视频三步出片——**改文案 → 逐段配画面 → 出片**。
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

石榴支持文本直接生成，也支持音频 URL 驱动数字人。产品的决策单元保持为一个连续的**画面段**：用户可将相邻多句组合成一段，再决定用分身或 b-roll；后端为这个画面段生成一份 V2 克隆音频，数字人和 b-roll 都消费同一份音频。这样既保留移动端容易理解的段落编排，也避免逐句切片和两套 TTS 在音色、停连、响度上的漂移。

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
| **Video**（口播合成） | Create Video By Text | 文本 + avatarID + speakerID → 视频（保留兼容，主链不用） |
| | Create Video By Voice V2 | 音频 **URL** + avatarID 驱动（**当前主链**） |
| | Create Video By AudioFile | 音频**文件**驱动 |
| | Query Video Status | 生成进度 |
| **Asset** | Get Asset / Get Records | 账户剩余权益 / 算力变更记录 |
| **Upload** | Get Upload URL | 预签名 URL |
| **AuthVideo** | Create Authorization Video | **可选授权视频校验**；只有业务需要时才创建并把 `authId` 带入形象训练 |

**任务模型**：全异步 + **仅轮询，文档未见回调机制**。

### 3.1.1 采集输入：官方硬限制与产品质量门

| 素材 | 石榴官方硬限制 | 军师产品门 | 给用户的建议 |
|---|---|---|---|
| 可选授权视频 | MP4/MOV、H.264、5 秒–5 分钟、360p–4K、≤200MB | 默认创建链不采集；仅显式启用校验时使用 5–30 秒、≤100MB | 非普通用户流程，不应作为声音/形象训练硬闸 |
| 数字人形象视频 | MP4/MOV、H.264、5 秒–5 分钟、360p–4K、≤200MB | 5–300 秒、≤100MB | 10–20 秒，竖屏 720p、固定机位、胸部以上、自然眨眼，避免剪辑/滤镜/多人入镜 |
| 声音样本 | WAV/MP3/OGG/M4A/AAC/PCM，>2 秒、≤20MB；PCM 仅 24kHz 单声道 | 端上按整秒提示至少 3 秒，最长 120 秒、≤20MB | 8–15 秒，距麦克风约 20cm，安静房间、正常语速、不要配乐 |

军师 BFF 当前 multipart 总上限为 100MB，因此产品上传上限严于石榴 200MB；requirements 同时返回 `vendorMaxBytes` 和 `productMaxBytes`，不把两者混成一个数字。所有 URL 必须公网可下载且扩展名与实际媒体一致；我方上传后由 AIStar 生成受控 URL，不接受客户端自填第三方地址。

石榴 Train Avatar Model 当前字段说明为：**如果需要授权视频校验才填写 `authId`，不填写默认不校验**。因此军师默认只做素材使用权确认，不要求另录授权口播；`authorizationVideoRequired=false` 是客户端权威开关。旧 `/authVideo/create` 与固定口播能力保留为可选兼容路径，只有确实启用额外校验时才使用，不能重新变成普通创建硬闸。

同一接口的 `speakerId` 字段说明为：**选填，用于制作 demo**。因此 Avatar 训练与 Speaker 训练是两条可独立推进的任务：创建 Avatar 时有 ready speaker 就携带，没有则省略。产品为了提供“一段视频即可创建”的官网同款体验，可从该视频原声 best-effort 创建基础 V2 speaker，但该增强失败不得改变 Avatar 的 ready/failed 状态。真正出片仍需要 speaker 驱动 TTS；视频原声不可用时，在 preflight 引导补录专属声音。

### 3.2 未确认 —— M0 必须拿测试 key 实测 / 商务确认

公开文档**没有**给出以下规格，全部列为尽调项：

1. **视频输出规格**：分辨率（是否支持 720×1280 竖屏）、帧率、码率、是否带水印、编码格式
2. **单次生成时长上限**（决定一个出镜段最多能标多少句）与**实际耗时**
3. **计费口径与单价**：按秒/按次/按字符？阶梯价？并发配额？
4. **音色与口型质量**（仍需本人实测）：主链已统一为 V2 TTS + `Create Video By Voice V2`，代码层不再混用内嵌 TTS；仍需验证真实音色自然度、长句停连、各段接缝和口型同步
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

### 4.1 当前主方案：V2 分段 TTS + 音频驱动数字人

```
① LLM 定稿文案（prompt key clip.voiceover_copy / clip.voiceover_rewrite）
        ↓ 按段切分
② 为所有非尾段调用石榴 V2 Text To Speech(段文本, speakerID) → 音频
   ├─ role=avatar : 石榴 Create Video By Voice V2(该段音频 URL, avatarID)
   │                 → 音画同步数字人视频
   └─ role=broll  : 用户 b-roll 视频静音 -an，按同一段音频时长裁剪/循环
        ↓ 每段时长确定 → 句级字幕时间轴直接推出（不依赖上游时间戳）
③ ffmpeg 总装（复用 mixcut 范式）：
   视频轨: 段1 + 段2 + ... + 固定尾段
   音频轨: 各段音频顺序衔接（天然连续）+ 尾段自带原声
   BGM   : -stream_loop -1 + volume 低 + amix=inputs=2:duration=longest
   字幕   : picgen PNG overlay（绕开服务器字体依赖）
   规格   : concat 交错 [v0][a0][v1][a1]... → 720×1280 → libx264/aac → +faststart
```

**音频连续性的实现**：不需要"一条长音频铺全片"——每段音频紧跟其视频段，concat 后听觉上就是连续的。这是最简实现。

### 4.2 已裁决的接口策略

v0.116 已选择音频驱动作为唯一生产主链。`createByText` 只留 Gateway 兼容能力，不被 clip worker 调用；这样同一项目的 avatar 和 b-roll 都来自同一个 V2 speaker/TTS 路径，真实耗时和供应商成本会增加一次 TTS，但换来可预测的音色、停连、字幕时长和最终响度。若未来供应商证明文本直出与 V2 TTS 完全等价，也必须通过配置化实验和真人验收后才能切回，禁止在 worker 里按段混用。

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
                      shots:[{id,startNo,endNo,role,assetId?,assetLabel?,hint?}],
                      scriptChat:[{id,role:"user"|"assistant",content,at?,applied?}],
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
POST   /api/me/clip/projects/{id}/script/ai-rewrite    整段 / 单段 AI 改写（scope=all 时 text 是「一句话 brief」生成指令）
POST   /api/me/clip/projects/{id}/preview-voice        单句试听（TTS，回填真实时长）
POST   /api/me/clip/projects/{id}/tts-preview          整片配音预览：触发（幂等）
GET    /api/me/clip/projects/{id}/tts-preview          整片配音预览：轮询（旧一版文案 → 404）
POST   /api/me/clip/projects/{id}/estimate             报价预估（出镜秒数 + TTS + 合成）

# 出片
POST   /api/me/clip/projects/{id}/render               提交 → clip_render_job
GET    /api/me/clip/jobs/{id}                          轮询进度（含 segments 段级状态）
POST   /api/me/clip/jobs/{id}/cancel                   取消（协作式，退 hold）

# 素材
GET    /api/me/clip/assets                             我的 + preset
POST   /api/me/clip/assets                             multipart 上传
DELETE /api/me/clip/assets/{id}

# 分身（走 dap 现有域扩展，clip 只引用）
POST   /api/v1/avatars/clone-engine                    发起石榴形象克隆（authId 可选）
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
| `CLIP_SEGMENT_TOO_LONG` | 400 | 单个出镜段超过引擎时长上限 |
| `CLIP_ASSET_NOT_ALLOWED` | 400 | b-roll 素材格式/大小不合规 |

**Gateway 抽象（照 v0.105 `ModelinkGateway` 范式一比一落地）**：

```
ShiliuGateway (接口)
  ├─ HttpShiliuGateway   Bearer token；接入点经 admin「AI 应用绑定」解析，无 env 兜底
  └─ MockShiliuGateway   dev 惰性状态机；产物一律打 mock=true
ShiliuService (facade)   force-mock=true 且非 production/mysql → 测试媒体；否则已配置 → HTTP；未配置且 allow-mock=true（dev 默认）→ mock；
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

1. **深度合成显著标识**：生产上线前需结合分发平台与法规完成最终标识方案评审；当前测试产品将可见“AI 生成”水印作为用户可选项且默认关闭，测试媒体另有不可关闭的“测试演示”标识
2. **算法备案主体**：必须与石榴明确是他们备案（我们作为调用方）还是我们自行备案 —— **商务合同必须写清**
3. **素材使用权确认**：
   - 普通创建以轻量声明确认“本人或已获合法使用权”，不要求额外授权视频
   - 石榴 `Create Authorization Video` 只作为确有业务需要时的可选校验；启用后可继续保存 consent 快照
   - 严禁拿他人照片/声音克隆；可删除、审计与异常处置能力保持
4. **可删除权**：用户可随时删除自己的分身（含要求上游删除），UI 要明示
5. **b-roll 素材审核**：用户上传素材进公开成片，需过机审（`SAFETY_REVIEW` purpose 已存在）
6. **参考样片版权**：《为实体发声》是惊艳传媒作品，作为模板需取得授权；固定尾段素材同理

---

## 10. 分期路线

| 阶段 | 周期 | 内容 | 出口判据 |
|---|---|---|---|
| **M0 · POC** | 1~2 周 | 拿石榴测试 key 实测 §3.2 全部 10 项；`ShiliuGateway` + Mock 落地；A/B 策略二选一定稿；音频连续 + b-roll 对齐的 ffmpeg 配方本地跑通 | 形象相似度 / 声音自然度 / 口型同步 / 分段时长稳定性 / 单价 五项达标 → go |
| **M1 · MVP** | 3~4 周 | clip 域 server（走 §5 新增领域 SOP 六步 + openapi 契约）；克隆向导（一段视频 → Avatar 训练，专属声音可选增强）；三步出片全链；《为实体发声》单模板；H5 内测 | 从进模板到拿成片 **< 5 分钟**；四门编译全绿 |
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
3. **克隆滥用**：拿他人形象声音克隆 → 素材使用权声明 + 可删除/审计 + 风险抽检；确有业务需要时再启用可选授权视频校验

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
4. 数字分身克隆向导：① 形象采集（直接拍摄/上传一段视频，带拍摄要点与素材使用权确认）
   ② 提交 Avatar 训练 → 训练中状态页（预计时间、可先用平台预置形象）；普通创建不另录授权视频，
   专属声音录制/上传从分身管理独立进入，作为可选增强
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
- 数字分身页面传达安全感：素材使用权确认、用途透明、可随时删除；不虚构供应商没有要求的授权步骤
- AI 生成可见水印默认关闭，用户主动开启后才在确认页、成片与作品页一致展示；付费动作前明示积分
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

---

## 附：配音预览与段级状态（v0.150）

真源契约 `/Users/donis/dev/ai-quickreel/docs/WORKPLAN_2026-09-05.md` §1.5 / §1.6 / §1.3。

**为什么加这两条**：出片确认页此前只给用户一个钻石数字。最不确定的两件事 —— 「念出来是什么效果、
多长」和「正在做的是哪一段」—— 都发生在扣费之后，用户只能事后为一次不满意的成片买单。
配音预览把第一件事挪到花钱之前；段级状态把第二件事从一条无信息量的进度条拆成看得见的清单。

**配音预览**（表 `clip_tts_preview`，迁移 V26）

- 一个项目一行。`timelineHash = sha256(voiceId + 每镜 no/role/文案)`，文案或音色一变旧结果整体作废，
  连同它的音频一起从对象存储清掉 —— 留着只会让用户听到一版已经不存在的稿子。
- 合成粒度是 `ClipShotPlan.materialize` 的**镜头**，和出片 worker 的 tts 阶段完全同一套切分。
  按原句切会更「精细」，但预览听到的就不是成片会用的那条音频，时间轴对不上，等于没给。
  副产品是 `no` 与段级状态共用一套编号，端上两个接口可以直接对齐。
- 异步：POST 只入队并返回 `status:"generating"`，`ClipTtsPreviewWorker` 每轮推进一段。
  与出片 worker 分开排队 —— 试听是背景动作，不能和「已经付过钱、正在等成片」的人抢供应商。
  stale reaper 兜底，保证端上轮询一定能等到一个终态。
- `credits` 恒为 0。Scheme A 下 clip 域不碰钻石账本，试听只花石榴 `validPoint`；字段仍然显式返回，
  好让调用方区分「本轮免费」和「老版本服务端没这个概念」。

**段级状态**（`GET /api/me/clip/jobs/{id}` 的 `segments`）

- 纯粹是 `clip_render_job.segmentJobsJson` 的只读投影，**没有第二处真值**。哪段做完了看它有没有留下产物：
  avatar 段看 `videoCdnKey`、broll 段看 `audioCdnKey`，结尾固定段不需要生成所以恒为 done。
- 失败落到具体那一段：`ClipRenderWorkerState.fail` 在标 job 失败之前，先把第一段没留下产物的那一行
  标成 `failed` 并记下 `errorCode`。后面那些是「没轮到」，不是「失败」，不跟着染红。
- worker 还没写过状态（刚入队、force-mock 的确定性任务）时返回空数组，调用方回落到整体进度，
  而不是看到一排凭空捏造的 queued。

**`ai-rewrite` 的 `scope:"all"`**：修正前它**完全忽略 `text`** —— 不管传什么指令，都只是在每句原文尾巴上
接一句固定话。现在 `text` 是改写/生成指令（≤500 字），按骨架逐段生成，不改段数、不改 role、不动结尾段；
`text` 留空退回原来的润色行为。引擎仍然只有确定性实现，真模型未接入时非 mock 网关照旧 503
`CLIP_SCRIPT_ENGINE_NOT_CONFIGURED` —— 要在生产做「一句话生成全片」，调用方得走自己的 LLM 网关。
