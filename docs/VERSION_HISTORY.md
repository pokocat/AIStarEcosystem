# 版本增量历史（v0.5 → v0.124）

> 从 `AGENTS.md`（`CLAUDE.md`）拆分出的连续多版本增量日志（明星带货线 + 混剪专区 + dap 数字人 + 三端拆分 + sau-service 等）。本文件按版本号分节，包含新实体 / 路由 / 决策 / 注意事项。新人 agent 不必翻 commit history。
>
> 索引参考 `docs/INDEX.md`；操作规则（硬规则 / SOP / 约定 / 文档同步纪律）仍在 [`AGENTS.md`](../AGENTS.md) / `CLAUDE.md`。

### v0.124（2026-08-11）— 缩略图字段改用增量迁移

恢复已在预发执行过的 `V14__add_clip_domain.sql` 原始内容，`clip_asset.thumbnail_cdn_key` 改由新建的 `V15__add_clip_asset_thumbnail.sql` 添加。发布门实际捕获了 V14 校验和漂移并拒绝启动；未使用 Flyway repair 覆盖历史，确保历史 H2 库与后续 MySQL 库都按不可变迁移顺序升级。

### v0.123（2026-08-11）— 专属声音来源与训练结果可见

`AvatarDto` 新增 `voiceSource=video|dedicated`：`DapVoice.kind=seed` 映射为形象视频自动提取的基础声音，用户主动补录的 `clone` 映射为专属声音。军师小程序据此将“视频原声”与“已增强”分开表达，并可在已有任务训练时展示百分比、完成时间或失败原因；页面轮询只查询既有石榴任务，不创建任务、不消耗点数。

服务测试新增专属声音来源、ready 状态与 100% 进度断言。接口字段同步到 TypeScript 契约与 OpenAPI；没有改表，也没有提交任何真实 speaker/avatar/video 任务。

### v0.122（2026-08-11）— 配画面素材真实缩略图与可读名称

新增 `ClipAssetThumbnailExtractor` 与 `ClipAsset.thumbnailCdnKey`。视频素材上传时由 ffmpeg 从约 0.5 秒位置抽取 JPEG，图片素材继续直接使用原图；`AssetDto.previewUrl` 对视频只返回缩略图签名地址，不再把无法由小程序 `image` 组件显示的视频源 URL 冒充预览。旧视频素材在读取清单时 best-effort 补抽，失败只回退占位图，不影响素材继续用于总装；删除素材会同时清理源文件和缩略图。

服务端将微信 `tmp_*`、`wxfile://`、长哈希路径归一为“我的视频素材 / 我的图片素材”，端上仍做第二层展示净化，防止传输层文件名进入画面卡和出片预览。针对性测试覆盖新上传缩略图、可读名称、缩略图清理与 ffmpeg 参数；不调用石榴或生成任务。

### v0.121（2026-08-11）— 数字分身展示用户形象预览帧

新增 `ClipAvatarPreviewExtractor`：形象视频通过媒体校验后、调用石榴创建 Avatar 前，使用 ffmpeg 从约 0.5 秒位置抽取并缩放 JPEG，写入持久存储及 `DapAvatar.imageKey`。`AvatarDto.imagePreviewUrl` 返回当前签名地址，军师首页和分身管理页可以直接展示用户上传/拍摄视频中的真实形象，不再使用通用人形占位。

已存在但缺少 `imageKey` 的记录在读取分身时会 best-effort 从保留的 `engineSourceKey` 补抽并回写；回填失败只记录告警，不影响训练状态查询。新上传抽帧失败则在石榴任务创建前返回 `CLIP_AVATAR_PREVIEW_FAILED`，避免供应商已扣点但产品仍无法预览。更换形象会清理被替换的旧预览，删除分身同时清理所有源视频与预览帧。服务测试覆盖新建、签名 URL、历史回填和删除清理，抽帧器测试锁定 ffmpeg 参数与存储结果；均不调用真实供应商。

### v0.120（2026-08-11）— 数字分身删除覆盖全部有效版本

修复 `ClipAvatarService.delete` 只读取并删除最新一条 Avatar/Voice 的问题。用户多次更换形象或补录声音后可能存在多个未删除版本；旧实现删除最新记录后，较早记录会被 `view()` 的“最新未删除”查询重新选中，端上表现为删除成功后再次进入仍有训练卡。

删除现在分别遍历 owner + `engine=shiliu` 下全部未删除 Avatar 与 Voice：逐个请求石榴删除 engineRef、清理本地原始素材，并统一写入 `deletedAt/engineStatus=deleted`。服务级回归测试覆盖两条形象版本和一条声音版本，确保不会残留可复活记录。

### v0.119（2026-08-11）— 单视频创建数字人，声音改为可选增强

再次对照石榴官方 Train Avatar Model OpenAPI：`speakerId` 标注为“选填，用于制作 demo”，`authId` 也只在需要授权视频校验时填写。因此普通创建不再等待 speaker，上传形象视频后立即以可空 `speakerId/authId` 调用 `/avatar/create`；形象 ready 独立作为数字人创建完成标准。

为保留用户在官网所见的一段视频体验，服务在没有可用音色时 best-effort 用 ffmpeg 从形象视频提取单声道 44.1kHz M4A，再异步创建 V2 基础声音。视频无音轨、提取失败或声音训练失败均只记日志和声音状态，不回滚 Avatar 训练；用户仍可在管理页独立录制/上传更干净的人声增强。出片的 V2 TTS + `createByVoiceV2` 链仍需要 speaker，若视频原声不可用，preflight 给出补录专属声音的可操作提示。

新增服务级与 HTTP 桩测试覆盖“无 speaker/auth 仍创建 Avatar”和可选字段省略。自动化没有上传真实素材，也没有提交 speaker/avatar/video 计费任务。

同时修复 `deploy-clip-preprod.sh` 的 FFmpeg 滤镜预检假阴性：旧写法在 `pipefail` 下用 `printf | grep -q`，grep 命中提前退出会让 printf 收到 SIGPIPE 141，导致三项滤镜明明齐全仍拒绝发布；改用 here-string 后继续保持同一质量门，不绕过检查。

隔离预发已发布 `e9e8e43c-20260811T153721Z`，`AEP_CLIP_FORCE_MOCK=false`；服务 active、`NRestarts=0`，三模板与军师 BFF requirements 只读探针通过。微信 avatar 订阅模板已在军师预发配置；本轮未上传素材或创建石榴计费任务。

### v0.118（2026-08-11）— 视频数字人直传训练对齐石榴可选 `authId`

纠正 v0.111–v0.117 将石榴授权视频做成必经硬闸的错误实现。官方 Train Avatar Model 契约明确：仅在需要授权视频校验时填写 `authId`，不填写默认不校验。因此 `ClipAvatarService` 不再以 `CLIP_CONSENT_REQUIRED` 阻断声音或形象采集；历史账号若已经存在可用 `DapConsent.captureId`，训练请求仍会兼容携带，普通创建则省略该字段。`GET /me/clip/avatar/requirements` 新增 `authorizationVideoRequired=false`，产品可以显式区分“素材使用声明”与“额外授权视频校验”。

默认创建顺序收口为“先克隆声音 → 上传形象视频 → 云端训练”。形象视频仍按官方 MP4/MOV、H.264、5 秒–5 分钟、360p–4K 校验，声音仍按 `>2s` 校验；较长时长只作质量建议。新增服务级测试证明无任何历史授权记录时声音克隆与形象训练均可进入石榴网关，HTTP 桩证明 `authorizationRef=null` 可按官方契约创建 avatar；自动化没有提交真实 speaker/avatar/video 任务。

隔离预发已发布 `83670b5e-20260811T144740Z`，`AEP_CLIP_FORCE_MOCK=false`；服务 active、`NRestarts=0`，只读 requirements 探针返回 `authorizationVideoRequired=false / avatarMin=5 / voiceMin=3`。本轮没有上传素材或创建任何石榴计费任务。

### v0.117（2026-08-11）— 石榴采集时长硬门纠偏

修正 v0.116 把质量建议误做成强制门槛的问题：声音样本由“至少 20 秒”改为严格按石榴官方 `>2s` 验证，客户端按整秒提示至少 3 秒；数字人形象视频由“至少 15 秒”改为官方 `>=5s`。8–15 秒声音与 10–20 秒形象保留为软建议，不再阻断上传或训练。授权视频仍须完整念出服务端下发文本，硬门保持 `>=5s`。`ClipCapturePolicyTest` 新增 2.1 秒声音和 5 秒形象视频通过断言，保证后续不会把建议时长重新升格为硬门。

隔离预发已部署 `b5140a8a-20260811T132756Z`，保持 `AEP_CLIP_FORCE_MOCK=false`；服务 active、`NRestarts=0`，AIStar 与公网军师 BFF 的 requirements 双层探针均返回形象 `5/10–20s`、声音 `2/3/8–15s`（供应商下限/端上整秒下限/建议区间）。本轮只验证规则与服务状态，没有创建 speaker/avatar/video 任务。

### v0.116（2026-08-11）— 石榴采集契约、统一音频驱动与真实训练进度

新增 `ClipCapturePolicy` 与 `GET /me/clip/avatar/requirements`：服务端在任何供应商调用前用 ffprobe 验证授权视频、形象训练视频和声音样本的 MIME、大小、时长、视频编码/分辨率、音频采样率/声道；客户端同时获得石榴官方硬限制、军师产品质量门、建议采集区间与固定授权口播。授权视频必须逐字口播指定文本；`authId` 只表达石榴授权接口已受理证据，不再写成独立“实名认证通过”。受理后原始授权文件立即从我方临时存储删除。

声音克隆固定使用 `V2.0`。所有非尾段先用同一 V2 speaker 生成段音频：b-roll 直接消费该音频，avatar 段则调用 `/video/createByVoiceV2`，从而避免过去 `createByText` 内嵌 TTS 与独立 TTS 混用造成的音色、停连和响度漂移。speaker 状态兼容官方文档的数组/对象两种响应，video `fail` 与本地 `failed` 统一；训练/生成进度、时长和官方错误码 1002/2001/2002/3001–3007 映射为可恢复、可解释的产品错误。

本轮只跑 HTTP 桩、采集策略和 worker 定向测试及离线编译，没有提交真实 speaker/avatar/video 任务，不消耗石榴点数。隔离预发已部署 `458246e1-20260811T124030Z` 并显式设置 `AEP_CLIP_FORCE_MOCK=false`；服务 active、`NRestarts=0`、3 模板和 requirements 探针通过。石榴 `/asset/get` 只读验真仍为 `code=0 / 12000 点 / 0 分身 / 0 音色`。真人音色、口型、耗时、费用与输出规格由用户用本人合规素材在真机验收。

### v0.115（2026-08-11）— 快出片连续多句共用一个视觉镜头

`clip_project.payloadJson` 将文案句 `segments` 与视觉镜头 `shots[{id,startNo,endNo,role,assetId,...}]` 分层，并允许保存军师 BFF 产生的 `scriptChat` 对话记录。新增 `ClipShotPlan` 作为唯一投影层：新项目和老草稿缺省时把相邻、尚未绑定不同素材的 b-roll 每 3 句组成一镜；显式计划必须按顺序、无重叠、无缺口地覆盖全部文案句，否则 `CLIP_PROJECT_INVALID`，绝不静默吞稿。

报价、preflight、真实 worker、测试媒体 worker 与 `ClipAssemblyService` 全部改读投影后的生成段。一个 shot 内的连续句会合成一段 TTS/数字人任务，并让同一 b-roll 连续承接完整范围；前端不再出现“看起来多选，后端仍逐句切片”的伪实现。项目 DTO、保存/重置和 estimate 契约同步返回/接收 shots；旧的逐句素材草稿只有 assetId 相同或都为空时才自动合并，避免升级后丢失已配素材。

隔离预发已部署 `e9ff7fc5-20260811T104108Z`，服务 active、`NRestarts=0`、模板探针 3 个通过，并保持 `AEP_CLIP_FORCE_MOCK=true`。本轮只验收部署与契约，不发起生成，不请求石榴。

### v0.114（2026-08-11）— 快出片预发可播放测试媒体闭环

新增显式 `AEP_CLIP_FORCE_MOCK`：仅非 production/mysql 可用，且部署脚本默认只在隔离 `clip-preprod` 开启。该模式不再伪造状态或空作品，而是逐段生成确定性 H.264/AAC 测试素材，继续经过 720×1280 总装、字幕、常驻「AI 生成」、固定尾卡、音轨归一、亮度/响度/真峰值质量门、缩略图与作品存储，最终成片永久烧录橙色「测试演示」。production/mysql 误开会启动失败。

`ShiliuService` 路由同时收紧：石榴 HTTP 配置完整时默认必须优先真实网关，`allow-mock` 只承担未配置时的开发兜底；只有显式 force-mock 才覆盖真实网关。测试引擎的授权/训练 `outputRef` 使用与正式上游一致的短 ID，不再把 `mock://` URI 写入 32 字符的授权证据列。新增路由、worker、总装与 overlay 回归，保证测试链可体验产品全流程但不会被误认作真实数字人成果。

隔离预发最终部署 `1dc23695-20260811T095733Z`。军师公网 BFF 以临时测试账号完成素材上传、本人授权、声音/形象克隆、模板建项目、配画面、报价、积分预扣/结算、worker、作品与 mock 发布状态全链；最终 MP4 为 44.05 秒、720×1280、H.264/AAC、1,072,189 字节，公网视频与缩略图均可下载，抽帧确认「测试演示」「AI 生成」和字幕已烧录。该验收在 force-mock 路由完成，未请求石榴、未消耗供应商点数。

### v0.113（2026-08-11）— 快出片固定尾卡与成片音画质量门

`ClipOverlayRenderer` 新增三套模板各自的固定品牌尾卡：当运营尚未上传可替换的授权尾片素材时，以全帧暖橙/墨绿视觉、模板专属主张和常驻「AI 生成」标识替代 v0.112 的空白深绿色段；尾卡在运行时生成，不把二进制资产或本机路径写入 Git/数据库。若项目明确选择运营 preset/user 尾片，仍优先使用真实素材。

`ClipAssemblyService` 在拼接/BGM 后统一用 `loudnorm=I=-16:TP=-1.5:LRA=11` 归一最终音轨，再由新 `ClipMediaQualityGate` 以 ffmpeg `signalstats` + `loudnorm` 实测平均亮度、综合响度和真峰值；默认只允许平均亮度 18–245、响度 -24～-12 LUFS、真峰值 ≤ -1 dBTP。结果缺失、静音、过暗/过曝、过轻/过响或爆音一律 `CLIP_OUTPUT_QUALITY_FAILED`，作品不会入库。新增针对尾卡、总装命令与质量边界的单测，并用真实 ffmpeg 对生成尾卡完成音画解析探针。授权的「集体发声」群像尾片、本人真实长片压力测试仍是外部验收项。

### v0.112（2026-08-11）— 快出片逐段生成与 ffmpeg 总装基线

`ClipRenderWorkerState` 从「把全部正文合成一个石榴任务」改为可恢复的逐段状态机：b-roll 段逐句调用同一 speaker TTS，avatar 段逐句创建并轮询 `createByText` 任务；每段音频/视频成功后立即转存我方 `cdnKey`，`segmentJobsJson` 只保存可恢复任务 ID 与我方资产真值，不依赖石榴时效 URL。任一段失败仍由既有 job/reaper/军师积分补偿链收口。

新增 `ClipAssemblyService` 复用 `FfmpegRunner`：avatar、b-roll、tail 全部归一成 720×1280、H.264、AAC、30fps；b-roll 原声丢弃，画面按 TTS 时长循环/裁切，图片和视频均可用；尾段未配置真实素材时生成明确的缺省静态段，有 BGM 时以低音量混入，最后 concat 并将整片写回我方 `clip/works`。`ClipOverlayRenderer` 用 Java2D 生成透明 PNG，每个正文段烧录逐句字幕、每一段常驻「AI 生成」标识，再由 ffmpeg overlay 合成；用户文案不进入 filter 表达式。总装后强制校验有效时长和音轨，再抽取 360px 宽 JPEG 缩略图写入 `thumbnailCdnKey`。上游下载继续走公网 HTTPS/大小限制，配音新增 20MB 镜像上限。针对性 worker/assembly/overlay 测试和真实 ffmpeg 三段配方探针通过。模板固定尾片、亮度/响度门、媒体审核与真实代发仍在 TODO，不能据此宣称生产全链路完成。

### v0.111（2026-08-11）— 石榴 AI 真实网关、正式模板与隔离预发

`HttpShiliuGateway` 按石榴官方 API v1 落地 Bearer 调用：授权视频、音色/形象训练、TTS、文案/音频驱动视频、状态轮询与删除；上游错误和异常响应统一 fail-closed，密钥不入库、不入日志。石榴返回的时效视频 URL 由 `ClipOutputStorage` 校验公网 HTTPS、限 512MB 并立即转存到我方存储。分身训练按「本人授权 → 声音 ready → 形象训练」串联，客户端授权入口改为上传真实前置摄像头视频。

内置 `ct_shiti`、`ct_kaimen`、`ct_shouyi` 三套正式模板，seeder 只补缺失 ID、不覆盖运营编辑。新增 `clip-preprod` profile、独立 env/systemd/nginx/deploy 模板：实例仅监听 `127.0.0.1:8081`，军师 BFF 用高熵 service token 回源，公网只暴露 `/clip_preprod/cdn|files/`。预发真实 key 只保存于 0600 env；只读探针确认账号有 12,000 点、当前没有已训练 speaker/avatar。媒体机器审核、真人素材质量实测、完整多段 ffmpeg 总装与四平台真实发布仍按 TODO 失败关闭。

### v0.110（2026-08-10）— 军师「快出片」clip 域工程骨架

新增独立 `packages/types/src/clip.ts` 与 Java `clip` 域，`V14__add_clip_domain.sql` 建立模板、项目、异步任务、素材四表。军师通过固定 service token 调 `/api/me/clip/**`，每条数据同时保存并强制过滤 `externalOwnerId`；服务账号不能替代最终用户隔离。管理员可维护模板并上传 preset，用户侧覆盖项目草稿/重置/回收、素材、授权/克隆、权威报价、preflight、幂等建单、作品与发布契约。

任务采用数据库 `leaseOwner / leaseUntil` 抢占，阶段推进放在独立事务 bean，另有 stale reaper 处理进程退出；取消同步清租约。Scheme A 下本仓不调用 `CreditService`，只保存军师已冻结的外部报价，军师 BFF 负责 hold/settle/refund。OpenAPI 为 service token 与 external owner 定义 AND 鉴权语义。

真实能力按失败关闭交付：production/mysql 禁止 mock；缺官方石榴字段契约时 `HttpShiliuGateway` 返回 `CLIP_ENGINE_CONTRACT_UNVERIFIED`，非 mock 总装返回 `CLIP_ASSEMBLY_NOT_CONFIGURED`，非 mock 发布返回 `CLIP_PUBLISH_NOT_CONFIGURED`。外部 M0、媒体审核、ffmpeg/CDN、四平台发布及生产验收列入 `TODO.md`，不得把 mock 产物当作上线结果。

### v0.108（2026-08-03）— 修复：明星带货素材库混入 AI 短剧视频资产（跨子产品串号）

**现象**：AI 明星带货应用（web-celebrity）的素材库 / 脚本视频里出现 AI 短剧的分镜视频；
反向短剧任务中心里也会出现带货视频。

**根因**：`material_video_job` 表被两条业务线共用（带货 `kind=baseline|variant`，短剧
`kind=drama-shot|drama-episode`，v0.43 / v0.65 起短剧复用带货的异步视频管线），但
`MaterialVideoJobService.listJobs` 只按 `ownerUserId` 过滤 —— 不带 `script_id` / `product_id`
的列表（`GET /api/me/material/videos/jobs` 无参、`GET /api/me/drama/render/tasks` 无 project_id）
把该用户在**另一个子产品**里生成的视频原样返回。同一账号两个子产品都用过，就必然串号。

**修法（子产品分区，server 侧收口，前端无改动）**：

- `MaterialVideoJob` 新列 `app`（`celebrity` | `drama`，索引 `idx_mvj_user_app`，ddl-auto 补）。
- `MaterialVideoJobService.submit / listJobs / getJob` 全部**必须显式带 app 参数**（新增
  `APP_CELEBRITY` / `APP_DRAMA` 常量）；`buildJob` 落库写 app；`getJob` 跨 app 查一律当不存在。
- 查询表达式对**老数据兜底**：`MaterialVideoJobRepository.APP_EXPR` 用 `case when app is not null
  then app when kind like 'drama-%' then 'drama' else 'celebrity' end`，故正确性**不依赖回填是否已跑**；
  `MaterialVideoJobAppBackfill`（@Order 70，幂等，只改 `app is null`）把历史行补上，仅为走索引。
- 调用方：`MaterialOpsController` → celebrity；`DramaRenderService` / `DramaScriptService` /
  `DramaFrameJobService.listTasks` / `DramaReferenceAssembler.jobLastFrame` → drama。

**无 API 路径 / 请求体 / 响应体变更**（openapi 不变），只是各端点不再返回别的子产品的行。
门禁：新增 `MaterialVideoJobAppScopeTest`（真实 H2 跑 JPQL：分区 / 老数据 null-app 兜底 /
跨 app getJob 拒绝 / 回填）3/3 + `mvnw test` 471 全量（1 处失败为既有 flaky `JwtUtilTest`，
与本次无关，已记 TODO.md）。

### v0.107（2026-08-03）— AiAvatar 真人授权素材库

真人授权从数字人生成向导中解耦：授权流程只负责上传 / 录制、平台协议确认、七牛本人核验和素材逐条审核，
完成后入“真人素材库”，不自动生成、不扣生成算力。同一真人（当前以 `avatarId` 为主体边界）复用 active
`qgroupid`，每条素材仍独立取得 `qassetid`；真人生成任务只接受 `approved` 素材并使用 `qasset://` 引用。
历史 liveness LIC 新增 `/v1/licenses/{id}/supplement` 就地补协议；已有 active 技术证据无需重复刷脸。

### v0.5（2026-05-08 ~ 05-09）— AI 明星带货线落地

**新增 server 实体**（详见 [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md)）：

| 实体 | 用途 |
|---|---|
| `CelebrityStarAuthorization` | 用户×明星授权关系（unique(user_id, star_id) + 4 态状态机） |
| `RechargePackage` | 充值套餐（admin CRUD，软删 active=false） |
| `TemplateScript` | 模板脚本（双模 text/video_ref + 6 类 ChatMessage 块；JSON 列） |
| `AiModelProvider` | 大模型 provider（OpenAI 兼容；apiKey 用 AES-GCM 加密） |
| `UserBotReadState` | per-user-per-bot lastReadAt（驱动 Bot 红点） |

**新增 server 端点**（节选；详见 [`specs/openapi.yaml`](specs/openapi.yaml)）：

```
GET  /me/messages-overview                        # 待办 + Bot 会话预览（按需合成）
GET  /celebrity/dictionaries                      # UI 字典
GET  /celebrity/jobs/{jobId}                      # 视频生成异步任务进度
POST /me/wallet/recharge                          # 充值落账（走 LedgerEntry）
POST/PUT/DELETE /admin/celebrity/stars[/{id}]
POST/PUT/DELETE /admin/celebrity/templates[/{id}]
POST /admin/template-scripts/{id}/{submit-review|publish|rollback|dry-run|draft-with-ai|upload-clip}
GET/POST/PUT/DELETE /admin/ai-models[/{id}]
```

**关键决策**：

- **Bot 消息走拉模式**：5 个 composer 按需查询业务态合成 `BotConversationDto`；零事件总线
- **小程序近实时同步**：app-level 15s 兜底轮询 + chat 页 5s 子轮询 + 关键点立即触发
- **AES-GCM 加密**：`AepCryptoUtil` 读 `AEP_SECRET_KEY` 环境变量；**生产必须配**，否则 admin 改 apiKey 后重启无法解密
- **engine-pricing / JOBS 当前 in-memory**：admin PUT 立即生效但重启丢失。v0.6 落 `PlatformConfig` / `generation_jobs` 表

### v0.7（2026-05-17）— 混剪专区内嵌 web-celebrity

把独立项目 `/Users/donis/dev/mixcut/frontend`（Next 14 + Tailwind 3 + Zustand + 13 页）裁到核心 7 页，作为 `(workspace)/mixcut/*` 子树挂入 web-celebrity。详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.9（2026-05-17）— 混剪用户素材上传 + 真实素材消费

`apps/server` 新增完整的用户上传素材管线 + 渲染 worker 真消费这些素材。

**新增**：

```
server  : MixcutAsset entity + MixcutAssetRepository（表：mixcut_asset）
        : MixcutAssetService（multipart 上传 + 本地 fs + ffprobe 探时长）
        : MixcutAssetController (/api/mixcut/assets POST/GET/GET[id]/DELETE)
        : MixcutAsyncConfig 加 /static/mixcut-assets/** 资源映射
        : MixcutRenderingService.resolveBindings() — 真实解析 binding.asset_id / file_url
        : MixcutRenderingService.renderOneVariant() — 真叠加用户上传的 image/sticker
        : application.yml 加 spring.servlet.multipart.* + aep.mixcut.asset-dir / asset-public-url-base

web-celebrity:
        : api/mixcut.ts 增 listAssets / uploadAsset / deleteAsset
        : components/mixcut-zone/types.ts 增 MixcutAsset / MixcutAssetKind
        : SlotInput 重写 user_upload + library_select 走真后端
        : /mixcut/library 重写为真后端 CRUD（4 tab + 上传 dialog + 删除 confirm）
```

**注意**：

- 上传 wire 例外：multipart 表单 + snake_case 字段（`user_id` / `kind` / `file` / `name` / `tags`）
- 安全模型仍 permitAll —— 生产化必须 `.authenticated()` + 校验 `ownerUserId == principal.id`
- 详见 [`apps/web-celebrity/PRODUCT.md` §5.7](apps/web-celebrity/PRODUCT.md)

### v0.8（2026-05-17）— 混剪专区真后端（ffmpeg 渲染）

`apps/server` 新增完整 mixcut 渲染管线（不再 mock）。每个任务变体真做三件事：

- **视频拼接** — concat 2 个明星片段
- **图片贴图** — overlay 半透明色卡 + drawbox 装饰条带
- **随机剪切** — 每段 `-ss` 随机 offset；变体间 perturbation 参数（速度/亮度/饱和度/镜像）随机

**新增**：

```
server  : MixcutRenderJob + MixcutRenderOutput 两张表（JPA auto-update）
        : FfmpegRunner + AssetDownloader + MixcutJobService + MixcutRenderingService (@Async)
        : MixcutController (/api/mixcut/jobs[/{id}{/progress}])
        : MixcutAsyncConfig (静态资源 /static/mixcut/** → 外部目录)
        : application.yml 加 aep.mixcut.* 配置

web-celebrity: api/mixcut.ts 加 NEXT_PUBLIC_MIXCUT_USE_REAL=1 独立开关
             : next.config.mjs 加 /static/:path* rewrite
```

**注意事项**：

- ffmpeg CLI 必须在 server 运行环境可用（`brew install ffmpeg`）
- `drawtext` filter 需 libfreetype（brew 默认不带），当前用 drawbox 色条替代
- 输出文件存本地 `mixcut-output/<jobId>/v<N>.mp4`；OSS 集成是 v0.9+
- 生产环境 `/api/mixcut/**` 应改为 `.authenticated()`，当前 MVP 是 permitAll

详见 [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) 「混剪专区」一节。

### v0.13（2026-05-19）— 扰动贴图池 + 安全前置

`apps/server` + `apps/web-celebrity` 在 mixcut 链路上加扰动贴图池。每变体按 (jobId+variantIndex) 随机抽样 GIF overlay，叠在已有 image overlay 之上。

**新增 / 修改**：

```
server  : MixcutAsset +isPreset/+presetGroup/+previewUrl 列；MixcutAssetRepository 加 findByIsPreset* 查询
        : MixcutAssetService listVisibleTo / getVisibleTo / deleteOwned (preset 公共可见，user 私有受 principal 校验)
        : MixcutAssetService uploadPreset + registerPresetRow (admin / DataInitializer 路径)
        : MixcutPresetSeeder (@Order(10))：扫 classpath:preset-stickers/*.gif → fs+DB；空池时 ffmpeg lavfi 程序化生成 5 张 demo
        : MixcutRenderJob +stickerPoolJson TEXT 列（结构 Map<slotId, {pool_ids, coverage, opacity, scale_pct, pick_count}>）
        : MixcutRenderingService.buildVariantStickers + renderOneVariant 整合 GIF overlay (-stream_loop -1, format=yuva420p, colorchannelmixer=aa)
        : MixcutController + MixcutAssetController 全部方法接 Principal（v0.13.0 安全前置：之前裸调 service，无 ownerUserId 校验）

web-celebrity: types.ts +StickerPoolBinding，MixcutAsset +is_preset/+preset_group/+preview_url
             : sticker-pool-picker.tsx 新组件（4 group tab，多选 + 时间覆盖/不透明度/大小/抽样数）
             : api/mixcut.ts +listPresetStickers，AssetFilter 加 preset/presetGroup
             : create/[id]/create-client.tsx 加扰动贴图池 Card（写到 sticker_pool["_global"]）
```

### v0.14（2026-05-19）— CDN 上传抽象

新增 CDN 抽象层。dev 用 `LocalFakeCdnUploader`（复制到 `./cdn-mock`，公开为 `/cdn/<key>`），生产换 `AliyunOssCdnUploader`（stub，v0.16 候选）。Render 完每个变体串行上传 mp4 + jpg。

**新增 / 修改**：

```
server  : service/cdn/CdnUploader 接口 + CdnUploadResult record
        : LocalFakeCdnUploader @ConditionalOnProperty(aep.cdn.driver=local 默认)：路径穿越校验 + publicUrlFor
        : AliyunOssCdnUploader stub（v0.16+）
        : config/CdnWebConfig @ConditionalOnBean(LocalFakeCdnUploader)：注册 /cdn/** → ./cdn-mock
        : MixcutRenderOutput +cdnUrl/+cdnKey/+cdnThumbnailUrl/+cdnUploadedAt 列
        : MixcutRenderingService 注入 CdnUploader（required=false），renderOneVariant 末尾 uploadWithRetry
        : markFailed 增 CDN 孤儿清理（按 cdnKey 调 uploader.delete）
        : application.yml 加 aep.cdn.driver/local-root/public-base-url + oss.*
```

### v0.15（2026-05-19）— 混剪 → 发布 桥接 + 定时

`AiStarEcoApplication` 加 `@EnableScheduling`。新调度器 `PublishJobScheduler` 每 60s 扫 `status=QUEUED AND scheduledAt<=now` 自动 startJob。新增 `/api/me/mixcut/publish-batch` 一次性把 N 变体 × M 账号派单。前端三入口 + 定时 UI。

**新增**：

```
server  : @EnableScheduling on AiStarEcoApplication
        : PublishJobScheduler (@Scheduled fixedDelay=60_000, initialDelay=30_000)
        : PublishJobRepository.findByStatusAndScheduledAtLessThanEqual
        : MixcutPublishService.batchPublish (逐 output 独立 try/catch，部分成功)
        : MixcutPublishController POST /api/me/mixcut/publish-batch
        : DTO MixcutPublishBatchRequest / MixcutPublishBatchResultDto
        : 复用现有 QUEUED 状态（不新增 SCHEDULED）

web-celebrity: api/mixcut.ts +publishBatch
             : mixcut-zone/BatchPublishDrawer.tsx（变体多选 + 账号多选 + 文案 + datetime-local 定时）
             : mixcut/jobs/[id] 加「批量发布」按钮 → 开 drawer
             : /mixcut/publish 新页：跨任务挑选所有 cdn 变体 → 同一 drawer
             : distribution 顶部加「从混剪库选视频发布 →」入口 → /mixcut/publish
             : datetime-local 提交时 new Date(local).toISOString() 显式转 UTC
```

**注意事项**：

- 定时调度 @Scheduled 默认串行同 bean；多实例部署需 ShedLock（v0.17 候选）
- BatchPublishDrawer 双模：`job` prop（单任务）或 `items[]` prop（跨任务），后者优先级高
- 部分成功语义：响应 200 + `failed_items[]` 数组，按 `MISSING_CDN_URL` / `BUSINESS_ERROR` / `INTERNAL_ERROR` 三类原因
- v0.13.0 安全前置发现 MixcutController 之前根本没接 Principal —— 同 commit 顺手补上，service 全加 userId 过滤

### v0.16（2026-05-19）— 分发工作台迁入分发中心

把 v0.15 落在 `/mixcut/publish` 的「分发工作台」迁入 `/distribution`。混剪只负责制作；分发中心统一收口「批量制作 → 绑账号 → 派单」的用户路径。**仅 web-celebrity 改动，server / api 契约零变化**。

**新增 / 修改（web-celebrity）**：

```
components/distribution/DistributeWorkbench.tsx  (新)
  · 双视图 grid / group；跨任务搜索 + 已发布过滤（localStorage 去重）
  · Sticky right rail：已选缩略图九宫格 + 「继续配置发布 (N)」
  · 复用 BatchPublishDrawer (items[] 模式) 完成账号 / 文案 / 定时 / 派单
  · 深链入参 fromJobId — 预选 + 滚动定位

components/distribution/DistributionPage.tsx     (重写 IA)
  · header 状态条 StatChip ×3：已绑账号 / 可发变体 / 进行中任务（点切 tab）
  · Tabs：分发工作台（默认）/ 账号管理 / 任务追踪
  · 「手动分发」上移 header 右上，跨 tab 常驻
  · useSearchParams 包 <Suspense> （Next 16 build 警告）
  · URL 同步 ?tab=workbench|accounts|tracking + ?from_job=<id>

app/(workspace)/mixcut/publish/page.tsx          (改 redirect)
  · 删除 publish-workbench-client.tsx
  · 改为 redirect("/distribution?tab=workbench") 兼容旧链

app/(workspace)/layout.tsx
  · 移除 mixcut 二级菜单的「发布工作台」+ 面包屑映射

app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx
  · 保留单任务「批量发布」drawer（行为不变）
  · 新增 ghost 按钮「去分发中心 →」深链 /distribution?from_job=<id>
```

**注意事项**：

- 已派发去重是纯前端 localStorage（key `aep:distribute:published-output-ids`），跨浏览器 / 清缓存失效。稳态去重需 server 加 `mixcut_output.last_published_at` 列
- 手动 URL 输入暂未 inline 合并进工作台（保留 `ManualDistributeDialog` 独立弹窗）—— 手动场景字段差异大（封面 / 商品挂载 / 视频号 category 等专属字段），强行合并会复杂
- 三个新 web app 中只 celebrity 做了改动；drama / music 暂未涉及发布流程

### v0.17（2026-05-20）— 社交账号 profile 增强

绑定社交账号成功后，sau-service 从已登录的创作者中心页面 best-effort 提取账号辨识信息并随 `/login/poll` 的 `profile` 返回；server 加密 storage_state 的同时落库这些清洁字段，前端在账号管理 / 发布选账号 UI 中展示。

**新增 / 修改**：

```
packages/types: SocialAccount +platformAccountId
server        : SocialAccount +platformAccountId 列；SocialAccountDto / SocialAccountService 同步
sau-service   : PlatformDriver.extract_profile 统一返回 {displayName, platformAccountId, avatarUrl}
              : DouyinDriver 从创作者中心 header 抓昵称 / 抖音号 / 头像，body 文本兜底解析「抖音号：...」
web-celebrity : 账号列表、手动分发、项目分发、BatchPublishDrawer 展示平台账号号
admin         : 社交账号审计页展示 platformAccountId
openapi       : SocialAccount schema 增 platformAccountId
```

**注意事项**：

- 这是 best-effort profile：平台 DOM 或权限不同会导致字段为空；禁止用 `accountName` 伪装平台昵称。
- 各平台 driver 各自实现选择器和文本解析。抖音字段叫「抖音号」，小红书 / 视频号等平台可继续映射到统一 `platformAccountId`。

### v0.17.1（2026-05-21）— sau-service 视频号 / 快手 / 小红书 profile 拉齐 + 诊断回填

v0.17 落地时只有 DouyinDriver 走完了「retry-poll + selector 多兜底 + body 文本反向抽 ID」全链路；ShipinhaoDriver / KuaishouDriver / XiaohongshuDriver 还是单次 read，遇到 SPA 慢挂或哈希 class 漂移就拿不到 `platformAccountId`。本次把 Douyin 的 pattern 抽成模块级共享 helper，并加 selector miss 时的 DOM 诊断 dump，避免靠人肉重做 QR 绑定才能拿到现网 class：

```
sau-service : login_pool.py +_poll_extract_profile（time-bounded 重试，任意标识字段非空即返回）
            : login_pool.py +_dump_profile_dom_hints —— 重试耗尽仍空时，按 label_hints
            :   ("视频号 ID" / "快手号" / "小红书号" / "抖音号") 在 body DOM 里反向搜
            :   text 包含该 label 的节点，WARNING 吐 URL + body[:500] + 命中节点的
            :   tag / class / outerHTML[:800]。运维拿到这条日志即可在不重做绑定的前
            :   提下把真实 class / 真 label 回填到 driver 的 *_SELECTORS / body label。
            : DouyinDriver.extract_profile 改用共享 helper（无行为变化）+ 接 label_hints
            : ShipinhaoDriver 加 PROFILE_READY_TIMEOUT_S / DISPLAY/ACCOUNT_ID/AVATAR_SELECTORS
            :   selectors 覆盖 [class*='finder-nickname'] / [class*='finder-uniq-id']
            :   body 兜底解析「视频号 ID: …」/「原始 ID: …」
            : KuaishouDriver 扩 selectors（[class*='kwaiId'] / [class*='userInfo']…）+ body 兜底 "快手号"
            : XiaohongshuDriver 扩 selectors（[class*='redId'] / [class*='red-book-id']…）+ body 兜底 "小红书号"
tests       : test_smoke.py +test_non_douyin_profile_text_helpers_parse_creator_headers
```

**注意事项**：

- 当前 selectors 是基于上游 sau / 常见 emotion class 命名套路猜的，**首次真实绑定后必须按诊断 WARNING 回填一次**。日志样式：
  ```
  [shipinhao] extract_profile empty after retry budget; url=https://channels... body[:500]='...' label_hits=3
    [shipinhao][0] tag=SPAN cls='nickname-xxx' text='视频号 ID: shipinhao_demo_001' parentTag=DIV parentCls='header-yyy' outerHTML='<span class="nickname-xxx">视频号 ID: shipinhao_demo_001</span>'
  ```
  操作员/agent 取 cls 改 driver 的 `ACCOUNT_ID_SELECTORS`，取 parentCls / text 形态改 body 兜底 label。
- 重试上限 10s + 0.5s 间隔 = 最多 20 次 poll；不会卡住 `/login/poll` 整体超时（外层 30s+）。
- 诊断 dump 不读 cookie / storage_state；仅 DOM。封顶 5 个 hit + 单节点 outerHTML 800 字，日志总量可控。
- 没有 schema 变更：server / openapi / 前端契约不动；仅 driver 内部成功率提升 + 自诊断。

### v0.17.2（2026-05-21）— sau-service 小红书 profile 主动导航 + 部分命中诊断

v0.17.1 给 XHS 加了 selector + label 兜底，但实际 QR 绑定后发现 platform_account_id 仍然空：原因是 创作者中心 post-login landing（`/creator-center/post-creation` 之类）顶部 chrome 只有 avatar，没有 nickname / 小红书号 在 DOM 触手可及 —— selector 再多也没用。

引入 `PlatformDriver.prepare_profile_view(page)` 钩子：在 `_poll_real` 拿 storage_state 之前给 driver 一次主动 navigate / 点 UI 的机会。`XiaohongshuDriver` 实现按 `[/creator/home, /setting/profile, /account/personal-data, /creator-center/profile]` 顺序探，命中标志是 body 含「小红书号」且未被反弹回 /login。

同时升级 `_poll_extract_profile` 的成功判定 + 诊断 dump：

```
sau-service : login_pool.py +PlatformDriver.prepare_profile_view (默认 noop)
            : login_pool.py XiaohongshuDriver +PROFILE_VIEW_URL_CANDIDATES (4 条) +prepare_profile_view
            : login_pool._poll_real 在 storage_state() 之前调 prepare_profile_view(page)
            :   —— 多吃一次 cookie 刷新；XHS 必须导航否则 小红书号 不在 DOM
            : routes/accounts.py verify path 同步加 prepare_profile_view 调用
            : login_pool._poll_extract_profile 成功判定从「displayName OR platformAccountId」
            :   收紧为「displayName AND platformAccountId」—— 部分命中也会跑满 deadline
            :   → 触发诊断 dump（之前 displayName 命中后立刻 return，platformAccountId 永远空也不报）
            : login_pool._dump_profile_dom_hints +missing_fields=(...) 入参 + header chrome 第二 pass
            :   pass-1: 含 label 文本的节点；pass-2: header / userInfo / avatar 容器 outerHTML
            :   日志 line 改 "incomplete after retry budget; missing=displayName,platformAccountId"
tests       : test_smoke.py +test_xiaohongshu_overrides_prepare_profile_view
            :   断言 XHS 重写了 hook、其它 driver 仍为 noop（避免无谓导航开销）
```

**注意事项**：

- 候选 URL 是基于公开经验猜的；首次真实绑定后看日志「[xiaohongshu] prepare_profile_view ok via <url>」就知道哪条命中。若全部失败 → log "all candidates failed" + extract 仍跑（fallback 是 landing 页 best-effort）。
- 收紧成功判定后，**已知 selector 错的平台首次绑定会跑满 10s** 才退（之前 displayName 一命中就 return）。这是诊断 dump 的必要前提；selector 修对后两项一起来 → fast-bail。
- `prepare_profile_view` 失败一律不抛（外层有 try/except wrapping），不影响 storage_state 捕获 + 业务返回 success。
- verify path 同步加了 prepare_profile_view 调用，老 cookie 再 verify 时也会刷新 profile —— 用户重新点「验证账号」按钮即可让 profile 字段回填，不用重新扫码。

### v0.17.3（2026-05-21）— sau-service QR 提取失败时落盘 snapshot

XHS（也可能将来视频号 / 快手）`/login` 页 DOM 经常漂 —— class hash 改、tab 布局换、整页换 modal 之类的。`extract_qr_data_url` 抛 `RuntimeError("QR src not found ...")` 时之前是干抛，运维只能瞎猜 selector。这次：

```
sau-service : login_pool.py +_dump_qr_extraction_failure(page, platform, msg)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.png  (full_page screenshot)
            :   - 落盘 ./sau-debug-snapshots/<platform>-<yyyyMMdd-HHmmss>.html  (page.content())
            :   - WARNING log 含 URL + body[:500] + 所有 data:image/<img> 的 size/class/parent
            :   - 落盘目录可用 SAU_DEBUG_SNAPSHOT_DIR 覆盖（docker mount 用）
            : XiaohongshuDriver.extract_qr_data_url 在 raise 前调 helper，把 snapshot 路径塞 msg
            : login_pool._start_real 兜底：任何 driver 的 QR 提取异常都触发 snapshot
            :   （XHS 自己已经塞过路径 → 跳过；其它 driver 飘了也能拿到现网快照）
```

**注意事项**：

- snapshot 文件包含 cookie 之前的 /login 页面 —— 没有任何用户敏感数据（页面是未登录态的 QR 卡片）。
- 默认目录 `./sau-debug-snapshots/` 是相对启动 CWD；docker 部署务必设 `SAU_DEBUG_SNAPSHOT_DIR=/data/sau-debug` 并挂卷，否则容器重启就丢。
- WARNING log 里的 `data:image candidates=N` 列表是诊断关键 —— 真 QR 一般 180-220px 见方，列表里能直接看出来哪个 img 是 QR、它的 class 是什么。
- XHS 长期还是建议改用 `xhs-toolkit.XhsClient.get_qrcode()` API 路径替代 DOM scrape —— 上游 `pokocat/social-auto-upload` 的 `xhs_uploader/xhs_login_qrcode.py` 走的就是这条 API；DOM scrape 是临时活路。

### v0.18（2026-05-20）— sau-service 上传超时保护

`pokocat/social-auto-upload` 上游的 `DouYinVideo.upload()` / `TencentVideo.upload()` 内部"点击发布按钮"是 `while True` 无限循环，平台 selector 失效或视频审核久挂时会一直输出 `🏃 小人正在冲刺发布视频` 卡死。sau-service 包一层 timeout + cancel-aware race + publishing watchdog。

**新增 / 修改**：

```
sau-service : uploader.py +_run_upstream_upload helper (asyncio.wait race + sliced loop)
            : publishing watchdog（60s 后 push status=publishing/80）
            : cancel_event race（用户取消能真打断进行中的 upstream upload）
            : SAU_UPLOAD_TIMEOUT_S / SAU_UPLOAD_PUBLISHING_AFTER_S 两 env
```

### v0.19（2026-05-20）— 视频库允许再次分发 + 发布短信验证码人机交互

两块独立子改动归到同一 v 节（README.md / 部署日志已经合并）：

**A. 视频库允许再次分发 · 派发计数落库**

废止 v0.16 的 localStorage 去重（`aep:distribute:published-output-ids` 已彻底删除）。视频库默认显示全部可发变体（含已派发过的），同一变体可再次分发到新账号 / 新时间窗。派发记忆改走 server。

```
server        : MixcutRenderOutput +publishCount (@ColumnDefault("0")) / +lastPublishedAt 列
              : MixcutRenderOutputDto 同步 publish_count / last_published_at
              : MixcutPublishService 注入 MixcutRenderOutputRepository
              :   每条 output 派单成功后按 target 数累加 publishCount + setLastPublishedAt(now)
              :   tracker 写库失败只 log（不阻塞派单结果）
web-celebrity : mixcut-zone/types.ts#RenderOutput +publish_count? / +last_published_at?
              : distribution/DistributeWorkbench.tsx 删除 PUBLISHED_KEY / publishedIds / loadPublished / persistPublished
              :   工具条按钮翻为「显示全部 / 仅未发布」二态（默认 OFF = 显示全部）
              :   GridView / GroupView 用 output.publish_count 渲染「已发 ×N」徽标 + hover tooltip 相对时间
              :   handlePublished 改为 load() 重新拉 jobs，徽标实时升级
```

**B. 发布短信验证码人机交互**

平台风控触发"输入短信验证码"弹窗时，sau-service 检测后推 `awaiting_user` 状态到 server，前端弹起输入框让用户提交；提交回 sau-service 把 code 填进 page、关闭弹窗，上游 upload retry 循环自然继续。MVP 整 stack 通；selector 占位待真实 DOM 抓取后接入。

```
packages/types : PublishJobStatus +awaiting_user；InteractionRequired；SubmitPublishJobInteractionInput
                : PublishJob.interactionRequired?，PublishJobCallback.interactionRequired?
server          : PublishJobStatus +AWAITING_USER（状态机双向：UPLOADING/TRANSCODING/PUBLISHING ↔ AWAITING_USER ↔ UPLOADING/PUBLISHING/LIVE）
                : PublishJob +interaction_required（TEXT JSON 列）
                : POST /api/me/publish-jobs/{id}/interact { code }
                : SauServiceClient.submitInteraction
sau-service     : interaction.py（SmsInteractionDriver Protocol + _PlaceholderSmsDriver）
                : uploader.py 加 SMS watcher coroutine（detect → request_sms → await user code → submit_code → is_cleared）
                : _hook_chromium_for_page_capture context manager（monkey-patch playwright.chromium.launch 抓取上游 page）
                : POST /tasks/{id}/interaction { code }
                : SAU_INTERACTION_USER_TIMEOUT_S / SAU_INTERACTION_POLL_INTERVAL_S 两 env
                : awaiting_user 期间 UPLOAD_TIMEOUT_S 暂停计时
web-celebrity   : SmsInteractionDialog 弹窗（脱敏手机号、6 位输入、5min 倒计时、Enter 提交、auto-complete one-time-code）
                : PublishJobList awaiting_user STATUS_META、行内「输入验证码」按钮、自动弹窗
admin           : PublishJobStatus +awaiting_user、PUBLISH_JOB_STATUS 表加 "待输入验证码"、tab + inflight 计数同步
openapi         : PublishJobStatus enum 加 awaiting_user；InteractionRequired schema；/me/publish-jobs/{id}/interact path
```

**注意事项**：

- 入库默认值靠 Hibernate `@ColumnDefault("0")`；ddl-auto=update 时 H2/MySQL 都能为现存行补 0。
- `bumpPublishTracker` 单条 try/catch；output 不存在或保存失败只 log，业务结果不回滚。
- BatchPublishDrawer 接口不变；唯一行为变化是它的 onPublished 回调里上游会 refetch jobs。
- 「显示全部」是默认 / 推荐状态。「仅未发布」仅在用户主动收窄时启用，按 `publish_count === 0` 过滤。
- **MVP selector 占位**：`_PlaceholderSmsDriver.detect()` 永远返回 None，所以 awaiting_user 路径在生产**还不会触发**。整 stack 已联通；要真启用需要在抖音/视频号触发风控、抓 SMS 弹窗 DOM、替换 placeholder 为真实 selector driver。
- **upstream 不暴露 page**：`DouYinVideo.upload(playwright)` 把 browser/context/page 全留在局部变量。我们靠 `_hook_chromium_for_page_capture` monkey-patch `chromium.launch` 捕获 Browser 引用，poll `browser.contexts → pages` 拿 page。per-task scope（finally 复原），不影响并发，但耦合 upstream 当前用 `launch()` 而非 `launch_persistent_context()`。如果上游改了，需要更新 helper。长期方案是 fork upstream patch `upload()` 接受 `on_page` callback。
- **超时倒计时双源**：前端 `SmsInteractionDialog.USER_INPUT_TIMEOUT_S=300` 必须与 sau-service `SAU_INTERACTION_USER_TIMEOUT_S=300` 同步；否则会出现一端认为已超时而另一端还在等待的撕裂。

### v0.20（2026-05-20）— 分发定时策略升级（每日铺开 + 随机抖动）

v0.15 的「定时发布」只支持一个 `datetime-local` —— N×M 派单同一时刻起飞。v0.20 引入完整 cadence 策略：把 N 条 mixcut 变体按「每天 K 次 × D 天」铺到未来时间槽，可选随机抖动。`PublishJob` / `PublishJobScheduler` 零改动，错峰 `scheduledAt` 直接走现有调度。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +schedule: ScheduleSpec 顶层字段（sealed interface +
        :   Immediate / Single(at) / DailyRecurring(startDate, timeSlots, timezone, maxDays, jitterMinutes)）
        : MixcutPublishBatchRequest.TargetItem -scheduledAt （时间不再 per-account）
        : MixcutPublishService.expandSchedule —— 把 spec 算成 outputs.size 长的 Instant[]
        :   (timeSlots 排序去重、ZoneId 解析、LocalDate.parse、jitter 范围 0..30、容量校验)
        :   过去 slot clamp 到 now；jitter 用 ThreadLocalRandom（不可重放）
        : MixcutPublishService.batchPublish 改用 perOutputAt[i] 注入到 per-output targets
        : projectId 兜底拼 "mixcut-batch-<source>-<yyyyMMddHHmmss>" 防撞
web-celebrity:
        : api/mixcut.ts +ScheduleSpec discriminator union, -MixcutPublishTarget.scheduled_at
        : BatchPublishDrawer.tsx 状态层换成 strategy/singleAt/startDate/timeSlots/capMode/maxDays/jitter*
        :   抽 ScheduleEditor 子组件 + StrategyPill + sortDedupSlots / expandDailyRecurringPreview / slotToDate
        :   4 套预设 chip (每天 3 次 / 每天 2 次 / 每天 1 次 / 晚间高峰) + 自定义 HH:MM 编辑
        :   实时预览行 + 容量超限红字阻拦 + auto-suggest maxDays
        : distribution/DistributeWorkbench.tsx 右栏帮助文案加一行 cadence 提示
```

**注意事项**：

- API 是破坏性变更（drop `targets[].scheduled_at`，要求顶层 `schedule`）—— 无线上外部消费方，干净切换，不做向后兼容 shim。
- 前后端铺开算法（`expandSchedule` vs `expandDailyRecurringPreview`）必须严格对齐：前端只算「理论 slot 时间」用作预览，**不**模拟抖动；后端是真值源。`slotToDate` 在浏览器本机 tz 与 schedule.timezone 不同时做一次反向偏移修正，DST 边界可能差 1 小时（服务端不受影响）。
- `outputs[]` 顺序变成业务语义：i 决定 day_offset 与 slot 索引。前端勾选顺序即铺开顺序，PRODUCT.md / 抽屉提示均说明「按勾选顺序铺开」。
- jitter 用 `ThreadLocalRandom`：不可重放。未来若要可复算，引 `seed = hash(projectId, i)`。
- 显式 out-of-scope：campaign 级别取消（`/distribution?tab=tracking` 单条 cancel 仍可用）、ShedLock、跨账号错峰、interval / random_window / weekly 等扩展策略（discriminator 预留扩展位）。

### v0.28（2026-05-23）— 商品主线贯穿（素材统一 + 链接解析 + 生成-分发桥接）

把过去四块独立的「商品库 / 素材库 / 混剪 / 分发」按「商品」为主线连起来：从抖音商城链接解析 → 落 Product + 关联素材到 MixcutAsset → 混剪以商品为入口自动填 slot → 抖音分发自动带商品链接。仅 celebrity 子产品改动。

**核心设计原则**：

- **MixcutAsset 是唯一素材表**：用 `relatedProductId` 标记商品归属（沿用 v0.21 `relatedStarId` 同模式，不发明新表）。`Product.images` 字段渐进废止，新代码读取走 `listAssets({ relatedProductId })`。
- **productId 是生成-分发的贯穿键**：MixcutRenderJob 加 `productId`；BatchPublishDrawer 打开时反查 Product 自动 prefill 抖音商品挂载字段。PublishJob 不加冗余列。
- **前端不区分 URL 形态**：单一调用 `POST /api/me/products/parse-link`；server 内部 handler chain 按 `@Order` 决定路径，新平台只加 handler。
- **外网 CDN URL 直接登记**：抖音商品图直接作为 MixcutAsset.fileUrl，不下载本地。

**新增 / 修改**：

```
types          : Product +priceCents +commissionRate; +product-link.ts(ProductLinkInfo);
                 MixcutAsset +related_product_id +subkind; RenderJob +product_id
server         : Product / MixcutAsset / MixcutRenderJob 三张表加新列
               : aep/service/productlink/* —— Handler 接口 + DouyinQueryEmbeddedHandler(@Order(10),
                 query 内嵌 goods_detail) + DouyinHtmlScrapeHandler(@Order(20), HTML 抓 og tags +
                 window.__INITIAL_STATE__；host 白名单防 SSRF)
               : ProductLinkService 编排 chain; ProductLinkPersistService 衔接 ProductService +
                 MixcutAssetService.registerExternalUrl(...)
               : POST /api/me/products/parse-link（仅解析）+ /api/me/products/from-link（解析+落库）
               : MixcutAssetController list 加 related_product_id 过滤
               : CelebrityProductSeeder @Order(30) —— 首次启动 product 表为空时种 6 行抖音选品样例
web-celebrity  : ProductFormDialog +「📋 从抖音链接解析」+ 价格 / 佣金 输入
               : CelebrityProductLibrary +「从抖音链接快速建档」入口 + 行「生成视频」按钮 + 价格 / 佣金 列
               : ProductGenerateDialog（新）—— 选模板跳 /mixcut/create/{tplId}?product_id=X
               : ProductBatchImportDialog 识别 商品价格 / 佣金 列；占位符改抖音选品库 TSV 格式
               : create-client.tsx 读 useSearchParams.product_id；并发拉 product + listAssets;
                 applyProductHeuristics 自动绑 image/picgen_text/text slot; 顶部 chip + 提交透传 product_id
               : BatchPublishDrawer 自动 prefill productLink/productTitle，显示「已从商品库带入」chip
               : mocks/products.ts 替换为 6 行抖音选品样例（与 server seed 同源）
openapi        : Product/ProductInput +priceCents/commissionRate; 新 ProductLinkInfo schema;
                 新 /me/products/parse-link + /me/products/from-link path
tests          : DouyinQueryEmbeddedHandlerTest + ProductLinkServiceTest — 11 测全绿
```

**注意事项**：

- 启发式 slot 绑定按 `slot_id / label / fill_strategy` 子串命中（product|商品|图 → 商品图槽，title|标题 → 标题槽，point|卖点|desc → 卖点槽）；只覆盖 prev 中未绑或绑 `fixed` 的 slot，用户已改不动。模板命名越规范命中率越高。
- DouyinHtmlScrapeHandler 在 host 白名单外直接返回 empty（防 SSRF）；URL scheme 仅允许 http/https。
- CelebrityProductSeeder 仅 Product 行，**不**触发外网图片抓取；运营首次访问 UI 后手动点「📋 从抖音链接解析」回填。
- ProductLinkPersistService 单事务，图片登记单条失败 log + 继续，整体不回滚。
- BatchPublishDrawer prefill 仅在 `sourceJob.productId` 非空时触发；用户清空 chip 后可手动覆盖，不影响业务。
- 「商品ID」列在批量导入时识别但**不持久化**（server 自己生成 id）；保留是为兼容抖音表格直接粘贴。
- **未实现**：AI 生成带货视频（仅在 MixcutAsset.subkind 预留 `"ai-marketing-video"` 占位）；抖音以外平台的 handler；商品图本地化备份；PublishJob.productId 冗余列。

### v0.25（2026-05-22）— 混剪按场景渲染（多段落 bug 修复）

模板里 `scenes[]` 数据完整（每场景独立 duration + slots[]），但渲染器无视场景结构，硬编 `segCount = Math.min(2, sources.size())` + `segDuration = maxOutputDurationSec / segCount`，导致**无论模板配几个场景，最终视频永远只有 2 段**（每段 7.5s）。前端 `flatSlotsAbsolute()` 把场景拍平时丢了边界信息，渲染器收到的 `slots_snapshot` 完全没有场景概念。本次把"场景"作为一等公民贯穿整链路。

**新增 / 修改**：

```
types.ts          : +SceneSnapshot {id, label?, duration_sec, slot_ids[]}
                  : RenderJob +scenes_snapshot?: SceneSnapshot[]
                  : SlotSnapshot +time_range?: [number, number]（之前漏掉 → 这是 bug 根因之一）
create-client.tsx : 提交 job 时直接从 template.scenes 构造 scenes_snapshot（按顺序）
server model      : MixcutRenderJob +scenesSnapshotJson TEXT 列（@Lob）
server dto        : MixcutCreateJobRequest +scenes_snapshot；MixcutRenderJobDto +scenes_snapshot 回包
server service    : MixcutJobService.create 透传 scenes_snapshot
MixcutRenderingService :
  - RenderContext +scenes: List<SceneSpec>; SceneSpec { id, durationSec, slotIds }
  - buildContext 解 scenesSnapshotJson；单场景 clamp [1, maxOutputDurationSec]，总和 > max 按比例缩放
  - renderOneVariant +useSceneSchedule 分支：segCount = scenes.size()（不再硬编 2），
    segDurations[i] = scene.durationSec，每段独立 -ss/-t，totalDuration = 段长之和
  - +slotToWindow: Map<slotId, [start,end]>，给 overlay filter 追加 :enable='between(t,a,b)'
    把 overlay 限制在所属场景时段（v0.24 之前 overlay 整片可见）
  - applied_transforms +scene_schedule + total_duration_sec；每段 detail +scene_id/output_start/output_end
  - 缺省（scenes_snapshot 空 / 旧任务）→ 回退 v0.24 路径（最多 2 段）
```

**注意事项**：

- 字段全部加性兼容：scenes_snapshot 为空时渲染器行为与 v0.24 完全一致，历史任务不受影响。
- 总和超出 `aep.mixcut.max-output-duration-sec`（默认 60s）按比例缩放后再渲染；想要更长视频需调高上限。
- 源视频 round-robin：scene[i] → `sources[(variantIndex + i) % sources.size()]`；5 场景 + 2 视频会循环复用，5 视频 + 2 场景每变体只用 2 个。
- overlay enable 用单引号包 `between(...)`，防止表达式里的逗号被 ffmpeg 当成 filter-chain 分隔符。
- 一个 slot_id 不属于任何场景的 `slot_ids[]`（前端漏发？模板异常？）→ 该 overlay 整片可见（旧行为），不会丢失内容。
- openapi.yaml `/mixcut/jobs` 当前只有 path 骨架（无 request/response schema），contract gate 只校验 path 存在 → 不需要改 openapi。

### v0.23（2026-05-21）— 任务追踪按批次聚合 + 批量操作

celebrity 子产品的「分发中心 → 任务追踪」从平铺 PublishJob 列表升级为按 `project_id` 聚合的批次卡片 + 服务端分页 + 批次级批量操作（取消整批 / 重试失败 / 重新调度未开始）。N×M 派单后列表不再爆炸，运营一键搞定整批。

**新增 / 修改**：

```
server  : service/publish/ScheduleExpander.java（抽自 MixcutPublishService.expandSchedule，公共 util）
        : service/PublishJobBatchService.java（listBatches / cancelBatch / retryFailedBatch / rescheduleBatch）
        : controller/PublishJobBatchController.java → /api/me/publish-jobs/batches/*
        : dto/PublishBatchSummaryDto.java + dto/RescheduleBatchInputDto.java
        : repository/PublishJobRepository 加 findBatchProjectIdsByUserId(Pageable) + findByUserIdAndProjectIdInOrderByCreatedAtAsc
        : service/PublishJobService.createBatch projectId fallback：null/blank/"manual" → "manual-batch-<userId>-<yyyyMMddHHmmss>"

shared  : packages/types/src/publish-job.ts +PublishBatchSource/+PublishBatchSummary/+RescheduleBatchInput；ScheduleSpec 提升为共享类型
        : packages/api-client +apiFetchPaginated<T>（保留 PageEnvelope 的 pagination 元数据）
        : PublishJobApi +listBatches/+getBatch/+cancelBatch/+retryFailedBatch/+rescheduleBatch

web-celebrity:
        : components/distribution/ScheduleEditor.tsx（抽自 BatchPublishDrawer，行为零变化）
        : components/distribution/BatchTrackingTab.tsx + BatchSummaryCard.tsx + BatchDetailDrawer.tsx + RescheduleBatchDialog.tsx
        : DistributionPage tracking tab 由 <PublishJobList /> 换成 <BatchTrackingTab />
        : ManualDistributeDialog 删 MANUAL_PROJECT_SENTINEL，让服务端兜底
        : mixcut-zone/BatchPublishDrawer.tsx 改 import 抽出的 ScheduleEditor，删本地重复 420 行
openapi : 新增 5 paths（/me/publish-jobs/batches*）+ 2 schemas（PublishBatchSummary / PublishBatchSource）
        : ScheduleSpec / ScheduleSpecImmediate / ScheduleSpecSingle / ScheduleSpecDailyRecurring 正式入 schema
        : CreatePublishJobInput.projectId 改 optional + 注释手动分发自动生成
```

**注意事项**：

- 服务端 listBatches 走两步查询（GROUP BY → IN）+ Java 层 fold；不在 DB 落实体表，纯派生汇总。
- ScheduleSpec 持久化策略：**不存**。reschedule 让用户重新填一份新 spec 作用于 QUEUED 子集，不读老 spec。
- 历史 `project_id="manual"` 行聚合成单张「历史散件」徽章卡，不做回填迁移；新数据自然分流到不同 `manual-batch-*` 桶。
- 轮询：列表 5s（仅当有 hasInflight 时）；Drawer 内 PublishJobList 仍跑 2.5s（行级）。Drawer 关闭即 unmount，effect cleanup 自动停轮询。
- 重新调度只对 status=queued 生效；已开始 / 终态行原样保留。

### v0.21（2026-05-21）— 混剪 / 分发用户视角文案 + 视频库 + 官方明星片段

Celebrity 子产品的混剪与分发交互整改一次性合并：术语全面 review、清理无效按钮、引入「视频库 + 软删」与「官方明星片段」两个新模块、配额条下线、模板新建不再有副作用。

**A. 文案与术语全面 review（仅 web-celebrity）**

| 旧术语 | 新术语 |
|---|---|
| 变体 / variant / output | 视频 / 第 N 条 |
| 派单 / 发布 / 分发 | 统一对外「分发」；后台执行说「发布到 XX 平台」 |
| 任务 / job | 「生成任务」（混剪侧）/「分发任务」（分发侧） |
| 手动分发 | 上传链接分发 |
| CDN 已就绪 | 已生成 · 可立即分发 |
| cookie 加密存储 | 账号凭据已加密存储 |
| 立即派单 / 定时派单 / 铺开派单 | 立即分发 / 定时分发 / 分期分发 |
| 渲染节点 / sau-service / 轮询 2.5 秒 | 不暴露 |

涉及文件：`DistributionPage` / `DistributeWorkbench` / `BatchPublishDrawer` / `PublishJobList` / `SocialAccountList` / `ManualDistributeDialog` / `BindAccountDialog` / `mixcut/jobs/[id]/job-detail-client`。

**B. 混剪本月配额下线**

- 删 `MixcutHomePage` 的 `QuotaIndicator`，换为纯统计 `MonthlyStats`（本月已生成 N 条视频 + 累计 M 个任务）。
- 积分余额由 app 顶部钱包入口统一承载，不再混进混剪工作台。

**C. 混剪视频库 + 已生成视频软删（30 天硬删）**

- server: `MixcutRenderOutput` +`deletedAt`；新 `DELETE /api/me/mixcut/outputs/{outputId}`；DTO 转换层过滤 `deletedAt != null` 的 output。
- 新文件 `apps/server/.../service/mixcut/MixcutOutputCleanupScheduler.java`：`@Scheduled(cron="0 30 3 * * *")` 每日 03:30 扫 30 天前软删行 → 删本地 mp4 / 缩略图 → 调 `CdnUploader.delete(cdnKey)` → 删 DB 行（best-effort）。
- web-celebrity: `/mixcut/library` 改造顶层 tab「我的素材 / 我的视频 / 官方明星片段」；新 `MyVideosTab` 列已生成视频卡片网格 + 单条删除（confirm 文案明示「30 天可恢复」）。
- `DistributeWorkbench` 右栏 help 加超链 `/mixcut/library?tab=videos`。

**D. 官方明星片段专区（运营上传 / 用户只读）**

- server: 复用 `MixcutAsset` +`isOfficial` / `officialCategory` / `relatedStarId`。新 admin endpoints `/api/admin/mixcut/official-clips`（POST multipart / GET / PUT / DELETE）+ 公开 `GET /api/mixcut/assets/official-clips?category=&star_id=`。文件落 `./mixcut-assets/official/<category>/`。
- admin: 新页 `apps/admin/src/app/celebrity/mixcut-official-clips/page.tsx`（列表 + 上传 dialog + 行级编辑 + 删除）；`apps/admin/src/constants/nav.ts` 在「明星带货」组追加菜单。
- web-celebrity: `OfficialClipsTab` 真后端拉取 + 分类 chip 筛选 + 只读卡片网格。

**E. 新建模板不再自动落库**

- 模板列表「新建」按钮改为 `router.push("/mixcut/templates/new")`，不再调 `saveTemplate`。
- 新文件 `apps/web-celebrity/src/app/(workspace)/mixcut/templates/new/page.tsx` 渲染 `<TemplateDetailClient mode="new" />`。
- `template-detail-client.tsx` 加 `mode?: "view" | "new"` prop：new 模式用 `useMemo` 生成内存默认模板、跳过 server fetch、自动进编辑态、顶部草稿横幅、保存按钮 → `router.replace("/mixcut/templates/{id}/edit")`、取消按钮 → 返回列表无残留。
- 隐藏「另存为」「删除」按钮（草稿不适用）。

**F. 任务详情页清理无效按钮**

`apps/web-celebrity/src/app/(workspace)/mixcut/jobs/[id]/job-detail-client.tsx`：
- 删「全部打包下载」/「再生成一批」/顶部 Trash2 三个空 onClick 按钮。
- 复制按钮 onClick 接 `navigator.clipboard.writeText(job.id)`。
- 「渲染节点」row 删除（内部信息），「本次消耗 X 条额度」改「X 积分」。

**G. 分发工作台默认按任务视图**

`DistributeWorkbench.tsx` L78：`useState<ViewMode>("grid")` → `"group"`。

**H. 分发工作台 → 视频库超链入口** （已在 C 中覆盖）

**API 契约同步**：

- `DELETE /me/mixcut/outputs/{outputId}` — 已生成视频软删
- `GET /mixcut/assets/official-clips?category=&star_id=` — 公开列表
- `GET/POST /admin/mixcut/official-clips` + `PUT/DELETE /admin/mixcut/official-clips/{id}` — 运营管理
- `MixcutAsset` schema 加 `is_official / official_category / related_star_id`
- `MixcutRenderOutput` schema 加 `deleted_at`

**注意事项**：

- 软删 30 天保留期靠 `@Scheduled` cron。多实例部署需 ShedLock（沿用 PublishJobScheduler 同样的待办）。
- `MixcutOutputCleanupScheduler` 单条 IO 失败 log + 继续，DB 行保留下次重试。
- 「我的视频」tab 直接 `MixcutApi.listJobs()` 拍平所有 outputs（DTO 已过滤软删），不新增专门 endpoint。
- 官方明星片段与 v0.13 的 `isPreset`（扰动贴图池）是两套互斥标记：`isPreset=true` → GIF overlay；`isOfficial=true` → 用户可用作混剪源的明星视频片段。
- 模板新建走 `/mixcut/templates/new` 路由，详情页 `mode="new"` 时 template_id 是前端 nanoid 生成的，第一次 saveTemplate 时 server 以该 id upsert。取消则前端 state 丢弃，**完全不落库**。

### v0.22（2026-05-21）— 混剪批量发布支持抖音商品挂载

v0.15 起 `/api/me/mixcut/publish-batch` 派单时硬编 `productLink=null, productTitle=null`（v0.16 注释明示「暂不携带商品挂载；操作员后续手工编辑或走手动分发补登」）。这次把两字段拉到 `MixcutPublishBatchRequest` 顶层，沿着既有单条 PublishJob path 透传给 sau-service → `DouYinVideo(productLink=..., productTitle=...)`，触发抖音视频画面下方「立即购买」挂件。

批量场景的本质是「同一商品挂到 N 条混剪变体上」，所以字段是顶层 string 而非 per-output。非 douyin 平台目标 sau-service 静默忽略。

**新增 / 修改**：

```
server  : MixcutPublishBatchRequest +productLink / +productTitle 两顶层字段
        : MixcutPublishService.batchPublish 改透传（删 "暂不携带商品挂载" hardcode null,null）
        :   CreatePublishJobInputDto 第 7/8 参拿 req.productLink() / req.productTitle()
        :   PublishJob 落库 → PublishJobService.startJob 已有的 sau-service 透传逻辑生效

web-celebrity:
        : api/mixcut.ts MixcutPublishBatchRequest +product_link? / +product_title? 可选
        : BatchPublishDrawer.tsx
        :   + productLink / productTitle state（drawer open 时复位为空）
        :   + douyinSelected memo（accounts × selectedAccountIds 任一 douyin 即真）
        :   + 「抖音商品挂载」<section> 仅当 douyinSelected 时渲染（mirror ManualDistributeDialog）
        :   + submit 时 carryProduct = douyinSelected && link && title; 半残则整组 undefined
```

**注意事项**：

- 字段语义对齐单条 path：两项都非空才透传，半残（只有 link 没有 title 或反之）整组丢弃 —— 上游 sau 挂件需要两项齐全。
- `MixcutPublishBatchRequest` 是破坏性扩展但向后兼容：旧客户端不传两字段 → record 字段为 null → service 透传 null → 行为与 v0.21 相同。
- openapi.yaml `/me/mixcut/publish-batch` 当前只声明了 path 骨架（无 request schema）；contract gate 只校验 path 存在，所以这次不需要改 openapi。后续 schema 化时再补 `product_link / product_title` 字段。
- 非 douyin 平台填了也无效但不报错（sau-service _upload_shipinhao/_upload_kuaishou 不消费这两字段）。
- UI 隐藏逻辑只看 `accounts.platform === "douyin"`；若未来扩 tiktok 也有商品挂载，要重做这个 visibility predicate。

### admin sidebar 启用状态

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / Finance（含 recharge-packages）/ Notifications / Audit / 平台 > AI 模型。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

- **未涉及**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、Cookie SSO 跨子域（Phase 5）、
  K8s ACK（Phase 6）、MixcutAsset 上传 OSS 化（Phase 4）。

### v0.37a（2026-05-27）— Operator 双端登录（Plan B：admin 独立登录通道）

> celebrity 子产品迭代第四批。

**背景**：用户希望 celebrity operator（aep_users.operatorRole=OPERATOR）既能在
web-celebrity 内嵌写权限，又能登 admin 后台做运营工作。但 `AdminAuthController`
严格只查 `admin_users` 表 —— 这是双账号体系核心约束（AepUser.java L53-58 注释明示），
强行让 AepUser 走 AdminAuth 会污染该约束。

**采用 Plan B**：admin 后台新增独立登录通道 `POST /api/admin/auth/operator-login`，
admin 登录页加 Tab「管理员账号 / 平台运营账号」二选一。两套账号、两套表、共享 JWT
role claim、共享 `AepSecurityConfig.hasAnyRole` 门禁，互不污染。

```
server : 新 AepOperatorAuthController (/api/admin/auth/operator-login)
       :   - 校验：aepUserRepo.findByUsername + passwordEncoder.matches
       :   - 必须 operatorRole != null（否则 403 「该账号无平台运营权限」）
       :   - 必须 passwordHash 非空（否则 403，提示「请联系超管设置密码」）
       :   - JWT.role = operatorRole.name() (OPERATOR / SUPER_ADMIN)
       :   - 成功 / 失败均落 slf4j 日志 (event_type=admin.operator_login.{success|fail})
       : AepSecurityConfig +/api/admin/auth/operator-login permitAll

       : DataInitializer.ensureCelebrityOperatorSeed:
       :   - 新建 seed 行时给 celebrity_operator 落 passwordHash = bcrypt("operator123")
       :   - 老 seed 行无 passwordHash 时自动补一次（幂等升级老 dev 数据）

       : AdminAepUsersController:
       :   - +PATCH /{id}/operator-role 加 self-protect (Principal == id → 403)
       :     防 OPERATOR 误操作把自己降级 / null 锁死
       :   - +POST /{id}/set-password (@PreAuthorize hasRole('SUPER_ADMIN'))
       :     SUPER_ADMIN 给 AepUser 重置密码 / 设密码

admin  : api/auth.ts +operatorLogin（POST /admin/auth/operator-login）
       : /login/page.tsx 加 shadcn Tabs「管理员账号 / 平台运营账号」
       :   - 切 tab 清错 + 重置默认 username (admin / celebrity_operator)
       :   - handleSubmit 按 mode 路由到 login / operatorLogin
       :   - 文案明确区分两个体系

openapi: +/admin/auth/operator-login + /admin/aep-users/{id}/set-password paths
```

**注意事项**：

- **AdminAuthController 不动**：admin_users 体系与 aep_users.operatorRole 体系完全独立，
  共享 JWT role claim（OPERATOR / SUPER_ADMIN 字符串对齐），共享 AepSecurityConfig
  hasAnyRole 门禁规则。
- **passwordHash 兼容升级**：v0.37 起首启自动给老的 celebrity_operator seed 行补密码；
  老 dev 数据无需手动 reset DB。
- **self-protect**：v0.32 注释指出 admin 自删 / 自降级保护缺失。v0.37 顺手在 operator-role
  PATCH 加 self-modify 防护（principal == id → 403）。
- **未做**：(a) rate-limit；(b) admin 失败计数锁定；(c) operator 登入审计的 error_log 表写入
  （仅 slf4j，v0.38+ 候选）；(d) SSO / OAuth 集成；(e) admin 登录页里给 OPERATOR 设密码的 UI
  （SUPER_ADMIN 走 set-password endpoint，UI 是 platform/staff 页面已有的 reset 风格，留待后续）。

### v0.36a（2026-05-27）— SellingChannel 解耦 + LicenseBatch 重构（批次 = 销售渠道 + 售卖主体）

> celebrity 子产品迭代第三批。

**背景**：用户反馈「激活码批次的逻辑不对 —— 批次本质是销售渠道，与 MCN 机构无关」。
审计发现：(a) `LicenseBatch.issuerTenantId` 指向 `Tenant` 实体，激活时强制建 Membership，
与 MCN 体系隐式耦合；(b) admin types `tier` 字段后端模型 + DTO 完全缺失（前后端 drift）。

本版引入 `SellingChannel` 实体，把批次的归属从 Tenant 解耦到独立的「销售渠道 / 售卖主体」。
新批次走纯 SellingChannel 路径，老批次保留 issuerTenantId 向后兼容。

```
server : 新 SellingChannel entity（aep_selling_channels 表）
       :   id / code(unique) / name(内部) / sellingEntity(对账主体) /
       :   type(direct/agent/online_store/event/partner) / contact* / remark /
       :   status(active/inactive) / createdAt / updatedAt
       : 新 SellingChannelRepository / SellingChannelService(CRUD + requireActive)
       : 新 AdminSellingChannelController /api/admin/selling-channels (GET/POST/PUT/DELETE)
       :   DELETE = 软删（status → inactive，保留历史 batch 引用一致性）
       : 新 SellingChannelDto（enum wire 全小写）

       : LicenseBatch +sellingChannelId(varchar 64) / +tier(varchar 32)
       :   issuerTenantId 改 nullable（向后兼容）
       : LicenseBatchDto 同步新字段（修复前后端 drift —— 之前 tier 只在 admin types 有）
       : LicenseService.createBatch 改签名：
       :   - 必须有 sellingChannelId 或 issuerTenantId 之一
       :   - sellingChannelId 非空时校验 SellingChannelService.requireActive
       :   - 透传 tier 字段
       : LicenseActivationService L141：Membership 只在 issuerTenantId 非空时建
       :   - 新批次走纯 SellingChannel 路径 → 不再自动加 Membership（彻底脱离 MCN 耦合）
       :   - 老批次行为不变

       : 新 SellingChannelMigrationSeeder（@Order 50, CommandLineRunner）
       :   - 首启 seed 默认渠道 "platform-self"（平台直营）
       :   - 扫所有 sellingChannelId=null 且 issuerTenantId 非空的老批次
       :     → 为每个 distinct tenantId 建 legacy-tenant-<前8> channel
       :     → 回填 batch.sellingChannelId
       :   - 幂等（按 code 查重）；JPA ddl-auto=update 自动建表 + 加列

types  : packages/types/src/selling-channel.ts 新建（SellingChannel / SellingChannelType /
       :   SellingChannelStatus / SellingChannelUpsertInput）
       : apps/admin/src/types/selling-channel.ts 镜像 + SELLING_CHANNEL_TYPE_LABEL 字典
       : apps/admin/src/types/license.ts LicenseBatch +sellingChannelId / +tier，
       :   issuerTenantId 改 optional
       : apps/web 遗留 license.ts 同样改 optional（apps/web Phase 5 待删）

admin  : 新 api/selling-channels.ts (list/get/create/update/delete) + api/index 注册
       : 新 /celebrity/selling-channels 页 CRUD（含「停用」二次确认 dialog，不裸 confirm）
       : nav.ts「平台账户」组追加「销售渠道」入口
       : /platform/licenses 改造：
       :   - load 并维护 channels 状态
       :   - CreateBatchDialog 把 tenant 下拉换成 sellingChannel 下拉（默认 platform-self）
       :   - 表格「发放方」列优先显示 sellingChannel.name + type 标签；
       :     老批次落到 issuerTenantId.name + "(legacy)" tag
       : api/licenses.ts CreateBatchInput +sellingChannelId / +tier，issuerTenantId 改 optional

openapi: +SellingChannel / SellingChannelType / SellingChannelStatus schemas
       : +/admin/selling-channels (GET/POST) + /admin/selling-channels/{id} (GET/PUT/DELETE) paths
       : +ActionPricing schema（v0.35 顺手补）
```

**数据迁移策略（重要）**：

- **不删除 `issuerTenantId` 列**：保留至少 2 个版本以便回滚 + 历史 ledger 追溯（v0.38+ 候选删除）。
- **现有 Membership 行保留**：v0.35+ 新激活不再 insert，但已有的不删除。Admin 「成员」页仍能查到老用户。
- **现有 LicenseBatch 自动迁移**：`SellingChannelMigrationSeeder` 首启把每个 distinct issuerTenantId 转成
  legacy-tenant-XXX channel，并回填 sellingChannelId。零手写 SQL。

**注意事项**：

- **破坏性变更等级最高**：涉及核心激活流程。但新老路径并存，老 dev 数据无破坏（迁移 seeder 自动 backfill）。
- 前端 tier drift 修复：admin types 早期已有 LicenseTier，后端模型现在补齐，DTO `tier` 字段终于流通。
- SellingChannel 与 Tenant 完全独立：Tenant 表保留用于 MCN / 合作伙伴关系等其它业务，不再绑批次。
- enum wire 全小写：`selling_channel.type/status` 都走小写串（direct / agent / active / inactive）。
- **未做**：(a) admin 「成员」页对 LICENSE_ACTIVATION 来源行的 UI 标记；(b) 按渠道维度的销售统计报表（v0.37+）；
  (c) 删除 issuerTenantId 列；(d) SellingChannel 与发票/对账系统打通。

### v0.35a（2026-05-27）— 动作级权益扣减配置（混剪生成 / 分发上传 / 视频生成）

> celebrity 子产品迭代第二批。

**背景**：v0.34 之前，celebrity 子产品权益扣减单价分散在两处：
- 混剪生成走 PlatformConfig key `mixcut.credit-per-variant`（default 30）；
- 分发上传走 application.yml `sau.default-upload-cost`（default 20）；
- 视频生成走 EnginePricing 表（KeLing/HiGen/MiniMax 三引擎统一）。

运营无法按业务动作细粒度配置。本版引入统一的「动作单价配置」入口。

```
server : 新 CelebrityActionPricingService（注 PlatformConfigService）
       :   key = celebrity.action-pricing，JSON 结构：
       :     { "mixcut.generate": { creditPrice: 30 },
       :       "publish.upload":  { creditPrice: 20 },
       :       "celebrity.video": { useEnginePricing: true } }
       :   @PostConstruct seedIfAbsent → 首启灌默认；admin PUT 立即失效缓存
       :   creditPriceOf(action) 返回 Long 或 null（null 表示「让调用方走自己的 fallback」）
       : 新 ActionPricingDto record { Long creditPrice, Boolean useEnginePricing }
       : MixcutJobService.currentPerVariantCost 优先 actionPricing("mixcut.generate")
       :   缺失 → 回退到老 PlatformConfig key `mixcut.credit-per-variant`
       :   再缺失 → MIXCUT_PER_VARIANT_COST_DEFAULT
       : PublishJobService 新增 currentUploadCost() 同 pattern：
       :   优先 actionPricing("publish.upload")，缺失回退到 sau.default-upload-cost
       : AdminCelebrityController +GET/PUT /api/admin/celebrity/action-pricing

admin  : api/celebrity-zone.ts +getActionPricing / +replaceActionPricing + ActionPricing 类型
       : /celebrity/engine-pricing 改造为双 Tab：
       :   - 「动作单价（v0.35）」：3 行 mixcut.generate / publish.upload / celebrity.video，
       :     可输入 creditPrice 或勾选「沿用引擎价」（仅 celebrity.video 允许）
       :   - 「引擎单价」：原 v0.5 KeLing / HiGen / MiniMax 表，行为不变

openapi: +/admin/celebrity/action-pricing (GET/PUT) path 骨架
```

**注意事项**：

- **积分账本不可变约束**（CLAUDE.md §4.2）：扣点链路完全沿用既有 `CreditService.hold/commitHold/releaseHold` 三段式；本版只改「单价从哪里读」，不动 LedgerEntry 写入路径。
- **向后兼容三层 fallback**：CelebrityActionPricingService 缺值 → 老 PlatformConfig key → 代码内 default。运营不动配置时行为与 v0.34 完全一致；老 dev/H2 lite 数据无破坏。
- **缓存一致性**：`AtomicReference<Cache>` 1min TTL；admin PUT 后立即失效。沿用 EnginePricing 的 v0.33 pattern。
- **action 命名约定**：`<domain>.<verb>`（如 `mixcut.generate` / `publish.upload`）。后续扩展按需追加 `celebrity.template-purchase` 等动作。
- **未做**：(a) 按用户 / 工作室 / 明星粒度差异化定价（v0.37+ 候选）；(b) `celebrity.video` 的真扣费链路（v0.34 没接 hold/commit，本版只把单价入口准备好）；(c) 分发 perTargetPrice 累乘（接口预留但 service 未消费）。

### v0.34a（2026-05-26）— Stars 写入闭环 + Celebrity 工厂模板（运营初始化能力补齐）

> 与同期上游 v0.34（部署架构）并行的 celebrity 子产品迭代。

主线背景：celebrity 子产品**初始化生产部署**时，运营需要先添加明星档案 / 配置工厂模板，用户才能在 web-celebrity 看到。审计发现：(a) `AdminCelebrityController` 的 stars POST/PUT/DELETE 端点完整，但 admin 前端 `/celebrity/stars` 只有列表展示，**没有创建/编辑表单 UI**；(b) `CelebrityTemplate` 模型**完全没有 owner 概念**（所有模板由 seeder 写死），无法区分「工厂模板（所有用户可见）」与「用户私有模板」；(c) nav.ts L100 注册了 `/celebrity/templates` 路由但**页面文件不存在**。

```
server : CelebrityTemplate.java +isFactory(boolean, ColumnDefault "true") / +ownerScope(varchar 64,
       :   ColumnDefault "'factory'") / +ownerUserId(varchar 64, nullable) —— 镜像 MixcutTemplate
       :   pattern；JPA ddl-auto=update 自动加列；老行默认全部视为 factory。
       : CelebrityTemplateDto +isFactory/+ownerScope/+ownerUserId 三字段；from() 同步落值
       : AdminCelebrityTemplateUpsertDto +isFactory(Boolean, nullable)/+ownerScope/+ownerUserId
       : CelebrityZoneService.applyTemplateUpsert() 处理新字段；空值兜底为 factory + "factory"
       : CelebrityZoneService 新增 listTemplatesForUser(userId) —— factory + 自己私有；老
       :   listTemplates() 保留（admin / 无身份调用走全表）
       : CelebrityZoneController.GET /templates 改走 listTemplatesForUser(principal)

types  : packages/types/src/celebrity-zone.ts CelebrityTemplate +isFactory: boolean / +ownerScope:
       :   string / +ownerUserId?: ID | null（required，无默认）
       : apps/admin/src/types/celebrity-zone.ts 镜像
       : apps/web/src/types/celebrity-zone.ts 遗留：用 optional 字段（避免改老 mocks，apps/web
       :   Phase 5 即将删）

admin  : src/app/celebrity/stars/page.tsx 加 CRUD：「新增明星」按钮 → StarFormDialog；
       :   行级 Pencil/Trash2 按钮；删除走 shadcn Dialog 二次确认（不裸 confirm()）
       :   表单字段：name / category / avatar / cover / description / pricingTier / startingPrice /
       :   isHot / quotaTotal（基础字段够用，复杂 JSON 嵌套留给 photos / videos 子端点）
       : src/app/celebrity/templates/page.tsx 新建：模板 CRUD 全功能页 + 「工厂模板 / 用户私有」
       :   筛选 chip + 「新增工厂模板」按钮 + 行级编辑/删除；归属字段在表单里用 Switch 切换
       :   factory / private
       : src/mocks/celebrity-zone.ts ADMIN_CELEBRITY_TEMPLATES 补 isFactory + ownerScope

web-celebrity:
       : src/mocks/celebrity-zone.ts CELEBRITY_TEMPLATES 6 条预设模板均补 isFactory:true + ownerScope:"factory"
openapi: CelebrityTemplate schema +isFactory + ownerScope + ownerUserId；required 列表追加
       :   isFactory + ownerScope（ownerUserId 仍 nullable）
```

**注意事项**：

- 老 `CelebrityTemplate` 行：依赖 `@ColumnDefault("true")` + JPA ddl-auto=update 自动补 isFactory=true / ownerScope="factory"，无需手写 migration。MySQL prod 部署同样兼容（不再走 H2）。
- `listTemplates()` 老方法**保留**：admin 端 (`/api/admin/celebrity/templates`) 不需要 userId 过滤，直接看全部；用户端走新的 `listTemplatesForUser(principal)`。
- admin 「新增工厂模板」默认 `isFactory=true / ownerScope="factory"`；用户私有模板入口暂未在 UI 上暴露（v0.34a 范围仅工厂模板初始化能力），用户私有模板由 web-celebrity 端用户「保存」时由后端 service 写入。
- mocks 三处同步保证 USE_MOCK 模式下 typecheck 全绿（packages/types 字段 required → 编译器强校验）。

### v0.32（2026-05-25）— admin 后台「秘钥铸码 UI」+「管理员账号 CRUD UI」补全 + DataInitializer 明文激活码日志

之前 server 端 `/api/admin/license-batches/{id}/mint-keys`（v0.31 落地）和 `/api/admin/staff/**`
endpoints 都可用，但前端没接入：批次新建按钮无 onClick；铸码只能 curl；管理员账号管理无入口。
DataInitializer.seedSampleKeys 在 dev 首启时生成 10 把测试激活码但未打印明文，DB 只存 sha256
→ 想拿明文必须重置 H2 重新种码。

```
server : DataInitializer.seedSampleKeys 改返回 List<String> rawCodes（之前 void）；
       :   两处调用点收集后调 logSeedRawCodes(batch, rawCodes) 用 WARN level 横幅打印
       :   ("⚠️  DEV-SEED LICENSE CODES — DO NOT USE IN PRODUCTION" + 批次名 + 单包点数 + 每码)
       : AepSecurityConfig 新增 .requestMatchers("/api/admin/staff/**").hasRole("SUPER_ADMIN")
       :   排在通用 /api/admin/** hasAnyRole 之前；之前 OPERATOR 也能 CRUD admin 账号（漏洞）

admin  : api/licenses.ts +mintKeys(batchId, count): MintKeysResult；createBatch 入参收紧为
       :   CreateBatchInput record（name / issuerTenantId / initialCreditGrant / totalCount /
       :   validFrom? / validTo?）
       : app/platform/licenses/page.tsx 新建批次按钮接入 CreateBatchDialog（4 字段 + 等级 →
       :   单包点数派生）；批次行追加「铸码」按钮 → MintKeysDialog → 提交后弹 RawCodesDialog
       :   一次性展示明文 + 「复制全部」按钮（用户点「我已保存」关闭后不可恢复）
       :   撤回按钮的 onConfirm 真正接通 revokeKey（之前只弹框无落库）
       : api/staff.ts 新文件 — listStaff / createStaff / updateStaff / deleteStaff；
       :   API 边界把 server 返回的小写 role ("super_admin"/"operator") 归一化为前端约定
       :   大写 ("SUPER_ADMIN"/"OPERATOR")
       : api/index.ts +export * as StaffApi
       : mocks/staff.ts 新文件 — 2 条样本（与 DataInitializer 种子账号对齐）
       : app/platform/staff/page.tsx 新页 — admin_users 列表（搜索 + 角色筛选）+ 新建 +
       :   编辑（含重置密码 / 角色切换 / 状态切换）+ 删除（ActionDialog requireReason）
       : constants/nav.ts 「平台账户」组追加「后台管理员」入口（roles: ["SUPER_ADMIN"]）
       : lib/useAdminRole.ts 顺手修复 — cachedRole = u.role.toUpperCase()（之前 AdminUserDto
       :   返回小写 / 前端约定大写 → role-gated 菜单对真实超管也是隐藏的；v0.30 的
       :   /platform/error-logs gate 之前只在 USE_MOCK=1 时生效）

apps/admin/README.md  : 版本日志 + sidebar 段同步
```

**注意事项**：

- 「明文一次性返回」是核心安全约定：server 只存 sha256_hex；调用方拿到 raw 后负责安全分发（线下 / IM / 邮件 / 工单等）。`RawCodesDialog` 关闭即丢；用户必须主动「复制全部」才能保存。
- `CreateBatchDialog` 提交时**不**自动调 mint-keys —— 批次本身创建时 server 已经预铸 `totalCount` 把 key（沿用 LicenseService.createBatch 既有行为）但这批 key 的明文没暴露。如果新建后想拿明文，要单独点行内「铸码」按钮再多铸 N 把（这是 v0.31 mint-keys endpoint 的设计意图）。
- 单批一次最多 100 把：server `mintKeysAndReturnRawCodes` 已有 1..100 校验；前端 dialog 也加了同样上界，避免请求被 400。
- `/api/admin/staff/**` 安全收紧是破坏性变更：之前 OPERATOR 能调（hasAnyRole），现在只 SUPER_ADMIN（hasRole）。线上没有外部消费方，干净切换。
- DataInitializer 用 WARN level + 横幅故意「在生产意外触发时也极其显眼」：admin_users 表为空 → 误以为是首启 → 跑 seed → 日志里 5 行 WARN「DEV-SEED」立刻让运维发现。
- AdminUserDto.from() 把 role / status enum 转小写 —— 这是当前仓库的 wire 约定（AGENTS.md §4.1「enum 出 wire 时全小写」）。admin 前端约定的 AdminRole = "SUPER_ADMIN" | "OPERATOR" 是历史遗留，v0.32 不动 TS 类型，而是在 API 边界 normalize（`useAdminRole` + `staff.ts.normalize()`）。后续可以 v0.33+ 把 admin TS 类型也改成小写跟其它 enum 一致。
- 当前 admin 自己也能删/降级**自己**的账号（server 无 self-protect 校验）。前端 `handleEdit` 用了 loose `isSelf` 判断禁用删除按钮，但 username == role 这种 hack 判断仅当 username 字段碰巧等于角色名时触发 —— 等同于「无防护」。真正的 self-protect 在 server `AdminStaffController` 里加 `if (id.equals(principal.getName())) throw ...` 才合适，v0.33+ 候选。

### v0.31（2026-05-24）— celebrity 账户体系收口：商品库公共池 / 内嵌运营角色 / 手机号 SMS 登录

一次性把 celebrity 子产品的「数据隔离 + 登录注册 + 运营管理」三件事补齐。背景：审计
发现 `/api/products/**` 完全无认证，匿名能 CRUD；同时只有 dev-login 入口，prod 无
真实登录路径。本节按四块改动组织（独立、可分别理解），最后给统一的配置 / 注意事项。

---

**📋 改动总览**

| 子模块 | 关键改动 |
|---|---|
| **A. 商品库公共池化** | 写动作收归 admin；普通用户只读；按 productId 自动 bump usageCount |
| **B. 内嵌运营角色** | `AepUser.operatorRole` 字段；JWT 透传；web-celebrity 按角色条件渲染写按钮 |
| **C. admin 操作员管理页** | `/admin/celebrity/operators`：list aep_users + 切角色按钮 |
| **D. 手机号 + SMS 登录 / 注册** | LogSmsSender（默认）/ AliyunSmsSender（阿里云官方 SDK）；双因素注册（SMS + License） |

---

#### A. 商品库公共池化（写归 admin）

**审计漏洞**：

1. `/api/products/**` 落在 `AepSecurityConfig` 的 `anyRequest().permitAll()` 兜底
   规则下，匿名用户即可 CRUD 全部商品；
2. `Product` 表无 `ownerUserId` 列，任意登录用户能改 / 删他人引用的商品；
3. `/api/me/products/from-link` / `/api/me/products/{id}/refresh-images` 虽已认证，
   但任意登录用户均可往公共池写入；
4. 商品库前端入口（「新建商品」/「📋 从抖音链接快速建档」/「编辑」/「删除」/
   「刷新图片」）让普通用户自由 CRUD。

**决策**：商品库保持「公共商品池」语义；写动作（CRUD + from-link + refresh-images +
extract-selling-points）全部收归 `/api/admin/products/**`，仅 SUPER_ADMIN / OPERATOR
可调（用户的 operatorRole 也满足，见 B 节）。普通用户只读 + 调
`/me/products/parse-link` 预览（不写库）。

```
server  : ProductsController 精简为只读（GET /api/products + GET /api/products/{id}）
        : AdminProductsController 承载 POST/PATCH/DELETE + extract-selling-points +
          from-link + refresh-images（hasAnyRole 自动继承）
        : ProductLinkController 精简为仅 POST /api/me/products/parse-link
        : AepSecurityConfig +.requestMatchers("/api/products/**").authenticated()
        : ProductService +bumpUsageCountByProductId(productId)
                        +bumpUsageCountByLinkOrName(link, name) — 找不到返回 null
        : MixcutJobService.createInternal 创建任务时按 productId 内部 bump（取代
          v0.28 前端 fire-and-forget /products/upsert-from-generation）
admin   : api/products.ts 全 URL 改 /admin/products；+parseLink / fromLink /
          refreshImages / extractSellingPoints
        : types/product.ts +priceCents / commissionRate / ProductLinkInfo
        : celebrity/products/page.tsx 顶部「从抖音链接建档」+「新建商品」+ 行内
          「编辑」「刷新图片」「删除」+ 两个 dialog
openapi : drop /products POST / PATCH / DELETE / upsert-from-generation /
                extract-selling-points / /me/products/from-link / refresh-images
        : add /admin/products/* 完整 schema
```

**行为变化**：以前用户在生成视频时随手填的商品名会自动沉淀到公共池；v0.31 起
不会。usageCount 仍会 +1，但只覆盖**已存在**的商品（按 productId 精确匹配）。

---

#### B. 内嵌运营角色（AepUser.operatorRole）

**问题**：A 节把商品库写动作锁死在 hasAnyRole(SUPER_ADMIN, OPERATOR) 后，celebrity
端用户即使是平台运营人员，登 web-celebrity 也看不到写按钮 —— 因为他们的 JWT.role
是 STUDIO，且 admin_users 是另一套表。

**决策**：给 `aep_users` 加 `operatorRole` 字段（独立于 admin_users），让 celebrity
体系内部能识别「我是平台运营」。JWT 在 operatorRole 非空时优先用它作 role claim
（命名故意与 AdminUser.AdminRole 对齐 → 同一 role 字符串能复用 hasAnyRole 门禁）。

```
server  : AepUser +operatorRole 列（enum OPERATOR / SUPER_ADMIN, nullable）
        : AepUserDto / MeDto +operatorRole 字段（"operator" / "super_admin" / null）
        : DevAuthController.dev-login + LicenseActivationService.activate +
          SmsAuthController.verify —— operatorRole 非空时作 JWT.role 优先值
        : DataInitializer.ensureCelebrityOperatorSeed 幂等 seed 一个
          celebrity_operator（kind=studio, operatorRole=OPERATOR），dev-login
          下拉可见；老 H2 文件落库环境第一次启动 v0.31 也会自动补这条
shared  : packages/types/src/account.ts AepUser +operatorRole?: OperatorRole | null
        : packages/api-client useAuth() 返回的 user 自带 operatorRole
web-celebrity:
        : api/products.ts 写入 helper（createProduct / updateProduct / deleteProduct /
          parseAndCreateProduct / refreshProductImages / extractSellingPoints）URL 全
          走 /admin/products/**
        : CelebrityProductLibrary / Detail / Form 用 useAuth().user.operatorRole
          条件渲染所有写按钮 + Empty state 文案双态切换
        : 重新挂载 ProductFormDialog / ProductBatchImportDialog（仅 canManage 时）
```

**两套体系对照**：

| 维度 | admin 后台 | celebrity / 用户子产品 |
|---|---|---|
| 用户表 | `admin_users` | `aep_users` |
| 登录端点 | `POST /api/admin/auth/login`（密码） | SMS / dev-login / license 激活 |
| 接入前端 | apps/admin | apps/web-celebrity（及历史 apps/web） |
| 角色字段 | `AdminUser.role` enum | `AepUser.kind` + `AepUser.operatorRole` |
| JWT.role claim | `admin.role.name()` | `operatorRole.name()` 优先；否则 `STUDIO`/`USER` |

**升级粒度**：v0.31 的 operatorRole 是**全局角色**（不分租户）。`Tenant` /
`Membership` 表存在但只做 License 核销归属统计，不做运行时权限切片。

---

#### C. admin 操作员管理页

**问题**：B 节 operatorRole 落库后无 UI 维护，初期靠 H2 console SQL 或重启
DataInitializer 才能给真实用户授权。

```
server  : AdminAepUsersController
            GET  /api/admin/aep-users?q=&hasOperator=
            PATCH /api/admin/aep-users/{id}/operator-role { operatorRole }
admin   : /admin/celebrity/operators 新页面：list + 「运营 / 超管 / 移除」按钮组
        : sidebar「明星带货」组新增「平台运营」入口
        : api/aep-users.ts + types/account.ts +operatorRole
```

⚠️ 当前**允许 OPERATOR 自己改自己 / 改他人**的 operatorRole（继承 hasAnyRole 门禁）。
如要严格「只 SUPER_ADMIN 能授权」，在 PATCH 端点加 `@PreAuthorize("hasRole('SUPER_ADMIN')")`。

---

#### D. 手机号 + SMS 验证码 登录 / 注册（celebrity 主入口）

**问题**：dev-login 仅 dev profile 可用；prod 无任何真实登录入口。

**抽象层**：`SmsSender` 接口 + 两个实现（@ConditionalOnProperty 互斥）：

| Driver | 实现 | 用途 |
|---|---|---|
| `log`（默认） | `LogSmsSender` | 验证码打到 server log（dev / 联调 / 阿里云未备案时占位） |
| `aliyun` | `AliyunSmsSender` | 调阿里云 SMS 官方 SDK（`alibabacloud-dysmsapi20170525`） |

`aliyun` 驱动走官方 SDK。凭据优先读 `ALIYUN_SMS_ACCESS_KEY_ID` /
`ALIYUN_SMS_ACCESS_KEY_SECRET`；两者都不配时走 Alibaba Cloud 默认凭据链（如
`ALIBABA_CLOUD_ACCESS_KEY_ID` / ECS RAM Role）。

**端点**（全部 permitAll）：

| 端点 | 用途 |
|---|---|
| `POST /api/auth/sms/request-code { phone, purpose?: "login" \| "register" }` | 发码；返回 `{ sent: true }`；登录 / 注册模板分离 |
| `POST /api/auth/sms/verify { phone, code }` | 登录；用户必须已注册；404 USER_NOT_FOUND 引导走 register |
| `POST /api/auth/sms/register { phone, code, licenseKey, studioName, displayName? }` | **双因素注册**：SMS 验证码 + License 激活码同时通过；复用 LicenseActivationService.activate；username 自动 `phone_<手机号>`；phoneVerified=true |
| `POST /api/admin/license-batches/{id}/mint-keys?count=N` | （配套）admin 一次性铸 N 把 key 并**返回 raw codes**（write-once；DB 只存 sha256） |

**SmsCodeService**（in-memory + 节流）：

- ConcurrentHashMap 存 `phone → { purpose, code, sentAt, failures, lockedUntil }`
- 60s 速率限制（单 phone）
- 5 次错误自动锁定 30 分钟
- 验证码 5 分钟 TTL；成功后**立即删除** entry（防重放）
- @Scheduled 60s 清理过期 entry

**web-celebrity `/login` 三 tab**：

| tab | 用途 |
|---|---|
| **手机号登录** | phone + 验证码 + 60s 倒计时发码按钮；失败 USER_NOT_FOUND 自动切到注册 |
| **注册** | phone + 验证码 + 激活码 + studioName + displayName? |
| **dev** | 保留原 dev-login 下拉（dev profile only） |

**`packages/api-client/src/api/auth.ts`** 新增 `smsRequestCode` / `smsLogin` / `smsRegister`。

**openapi.yaml**: `/auth/sms/*` 与 `/admin/aep-users/*` 路径全部入 schema。

---

#### 配置（application.yml）

```yaml
aep:
  sms:
    driver: ${AEP_SMS_DRIVER:log}        # log（默认）或 aliyun
    code:
      length: 6
      ttl-seconds: 300                   # 验证码 5 分钟有效
      rate-limit-seconds: 60             # 同 phone 60s 不能重发
      max-failures: 5                    # 错 5 次锁
      lock-seconds: 1800                 # 锁 30 分钟
      # dev 联调专用：driver=log + 非空 才生效；driver=aliyun 时忽略并 WARN
      dev-fixed: ${AEP_SMS_DEV_FIXED_CODE:}
    aliyun:
      access-key-id: ${ALIYUN_SMS_ACCESS_KEY_ID:}
      access-key-secret: ${ALIYUN_SMS_ACCESS_KEY_SECRET:}
      sign-name: ${ALIYUN_SMS_SIGN_NAME:}
      # 模板变量固定只有 code；sender 始终发送 {"code":"123456"} 形态
      login-template-code: SMS_507065062
      register-template-code: ${ALIYUN_SMS_REGISTER_TEMPLATE_CODE:}
      region: ${ALIYUN_SMS_REGION:cn-hangzhou}
      endpoint: ${ALIYUN_SMS_ENDPOINT:dysmsapi.aliyuncs.com}
      connect-timeout-seconds: ${ALIYUN_SMS_CONNECT_TIMEOUT_SECONDS:10}
      response-timeout-seconds: ${ALIYUN_SMS_RESPONSE_TIMEOUT_SECONDS:20}
      call-timeout-seconds: ${ALIYUN_SMS_CALL_TIMEOUT_SECONDS:30}
```

**dev-fixed 双门禁**：必须 `driver=log` + 非空才生效；启动 banner 会 WARN
「DEV-FIXED CODE ENABLED — all phones will receive code=xxxxxx」。配错（非纯数字 /
长度不匹配 code.length）直接 fail-fast。`driver=aliyun` 时 dev-fixed 即使配了也
被忽略并 WARN，防 prod 误开。

**生产切换路径**：
1. 阿里云控制台备案签名 + 创建登录/注册模板（都只带 `${code}` 变量）+ RAM 给 SMS FullAccess
2. `export AEP_SMS_DRIVER=aliyun ALIYUN_SMS_SIGN_NAME=... ALIYUN_SMS_REGISTER_TEMPLATE_CODE=...`
   并配置 AK，或让运行环境提供 Alibaba Cloud 默认凭据链
3. 重启 server，`AliyunSmsSender` bean 注入，`LogSmsSender` 自动停用

---

#### 当前 dev 账号清单

| 账号 | 表 | 登录方式 | JWT.role | 用途 |
|---|---|---|---|---|
| `admin` / `admin123` | admin_users | `/api/admin/auth/login` | SUPER_ADMIN | admin 后台超管 |
| `operator` / `operator123` | admin_users | `/api/admin/auth/login` | OPERATOR | admin 后台运营 |
| `celebrity_operator` | aep_users | `/api/auth/dev-login`（dev免密） | **OPERATOR** | web-celebrity 内嵌运营（管商品库） |
| `creator_luna` | aep_users | dev-login | STUDIO | 普通工作室 |
| `studio_starlight` | aep_users | dev-login | STUDIO | 普通工作室 |
| `agency_moonrise` | aep_users | dev-login | STUDIO | 普通工作室 |

prod 部署时 `dev-login` 关闭（`@ConditionalOnProperty aep.dev-auth.enabled=false`），
DataInitializer 不跑，真实运营账号通过 admin `/celebrity/operators` 页升级。

---

#### 跨节注意事项

- **AepUser.operatorRole 与 admin_users 独立**：两套表不互通，但 JWT.role 字符串
  对齐（OPERATOR / SUPER_ADMIN）→ 同 hasAnyRole 门禁均可通过。
- **operatorRole 变更不会主动 invalidate 旧 JWT**：用户被升级后，旧 JWT 里 role
  还是 STUDIO，要等 JWT 过期（1h）或重新登录才生效。当前是「告知用户重登」；
  改进路径：admin layout 加 setInterval 60s refresh /api/me 检测变化弹 toast；
  长期：Redis token 黑名单（v0.32+ 候选）。
- **SMS 验证码 in-memory**：单实例 ok；多实例 prod 部署前必须换 Redis（验证码 +
  失败次数 + 锁定状态都要共享）。
- **`/auth/sms/verify` 404 时验证码已消费**（防爆破）—— 用户切到注册需重新发码。
- **`/auth/sms/register` username 自动 `phone_<手机号>`**，用户不能自选。
- **`AliyunSmsSender` SDK 配置**：签名、模板、region、endpoint、超时都走
  `aep.sms.aliyun.*`；凭据可显式配 AK 或使用 Alibaba Cloud 默认凭据链。
- **`AdminProductsController.from-link` 的 userId 语义**：parseAndPersist 内部
  用 userId 给商品图作为 MixcutAsset 注册时打 owner 标记。admin 调用时素材归到
  admin 自己名下；用户从混剪消费走 isOfficial / public 路径，不按 owner 过滤。
- **DataInitializer.ensureCelebrityOperatorSeed 幂等**：按 username 检查，已存在
  跳过。老 H2 文件落库环境第一次启动 v0.31 也能自动补 celebrity_operator。
- **`CelebrityProductSeeder` 保持现状**：seed 6 行商品到公共池无 owner，合理。
- **前端角色门只是 UX 防御**：普通用户绕过 UI 直接 curl /api/admin/products →
  server 端 hasAnyRole 仍会 403。
- **本节不动其他端点**：mixcut / 发布 / 钱包 / 社交账号 等 user 私有数据已按
  ownerUserId 严格隔离（pre-v0.31），无需改动。

### v0.30（2026-05-23）— 混剪任务「重跑」入口（fork 新 job + 缺素材严格阻拦）

用户反馈「生成任务重跑时应该可以用当时的元素和配置重新生成」。诊断：任务态实际**已基本快照化**（v0.25+ 累积），缺的是「重跑入口」+「缺素材保护」。前端原「重新生成」按钮只跳 `/mixcut/create/<template_id>`，丢弃所有 binding 等于从零做。

**设计决策**（用户已确认）：
- 重跑 → **fork 新 job**（带 `forked_from_job_id` 指回原任务，保留 lineage）
- 缺素材 → **严格阻拦**（409 + missing_assets，不让 demo 沉默串进用户预期）
- 可调字段 → **仅 variants + profile**（其它快照原样复用；要换素材请走 create 页）

```
server : MixcutRenderJob +forked_from_job_id (length=64, nullable, 无外键约束)
       : MixcutRenderJobDto +forked_from_job_id
       : 新 MixcutRerunJobRequest(outputVariants?, perturbationProfile?) record
       : 新 MissingAssetItem(slotId, assetId, source, kind) record
       : 新 MissingAssetsException extends RuntimeException, carries List<MissingAssetItem>
       : MixcutJobService 注入 MixcutAssetRepository；create() 抽出 createInternal/createForked
       : 新 MixcutJobService.rerun(originalJobId, principalUserId, overrides):
           - findById + owner 校验（不属于则 404 MIXCUT_JOB_NOT_FOUND，不暴露存在性）
           - collectMissingAssets(slotBindingsJson): 遍历 binding，source∈{upload,library} 且
             带 asset_id 的条目 → assetRepo.findAllById 比对 → 缺失 throw MissingAssetsException
           - 通过 → 构造 MixcutCreateJobRequest（所有快照原样，仅 variants/profile 用 overrides）→ createForked
       : MixcutController +POST /api/mixcut/jobs/{jobId}/rerun（body 可空）
       : GlobalExceptionHandler +@ExceptionHandler(MissingAssetsException.class) → 409，
         body = { error: { code: "MISSING_ASSETS", message, details: { missing_assets: [...] } } }

specs  : openapi.yaml /mixcut/jobs/{jobId}/rerun (POST, tag mixcut, operationId rerunMixcutJob)

web-celebrity:
       : types.ts RenderJob +forked_from_job_id?: string；
         +MixcutRerunJobRequest / +MissingAssetItem 类型
       : api/mixcut.ts +rerunJob(jobId, overrides?): Promise<RenderJob>（USE_LOCAL 克隆 mock job）
       : 新组件 components/mixcut-zone/RerunJobDialog.tsx
           - shadcn Dialog + RadioGroup（来自 @ai-star-eco/ui/ui/*）
           - 两表单字段：output_variants (1-10) + perturbation_profile (light/moderate/aggressive)
           - 提交成功 → router.push(/mixcut/jobs/<new-id>)
           - 错误 409 MISSING_ASSETS → 切错误态视图，列出缺失 slot/asset，
             给「去素材库重传」(/mixcut/library?tab=assets) / 「用模板从头做」
             (/mixcut/create/<templateId>) 两按钮
       : jobs/[id]/job-detail-client.tsx:
           - 顶部 action 区加「重跑」按钮（completed/failed 都显示）
           - 现有「重新生成」按钮改名「换素材重做」→ 跳 create 页（与重跑互补）
           - 头部 status chip 区加「由 #xxxxxx 重跑」徽章（仅当 forked_from_job_id 非空）
```

**注意事项**：

- **不重算** `source_phash`：fork 新 job → 渲染流水线自然算（首段视频 aHash）。
- **不允许覆盖**其它快照字段：rerun 只接 variants + profile；要改 binding 请走 create 页。
- 缺素材检测**只覆盖 source ∈ {upload, library} 且 asset_id 非空**的条目；picgen/input/fixed 不涉及素材表，跳过。
- ApiError.details 字段是 unknown：前端 `(e.details as { missing_assets?: MissingAssetItem[] })?.missing_assets ?? []` 解结构。
- USE_LOCAL（mock）路径**跳过缺素材校验** —— mock 模式没真实 asset 表，直接克隆 mock job + 改 id + 标 forked_from_job_id 返回。要测缺素材态需 NEXT_PUBLIC_MIXCUT_USE_REAL=1。
- 老任务 fork：原 job 的 `slotBindingsJson` 缺 `asset_id`（v0.16 之前 binding 结构）→ collectMissingAssets 跳过 → 不阻拦。会用 file_url / picgen 等 fallback 路径继续渲。
- JPA `ddl-auto=update` 自动加列；H2 dev / MySQL prod 双兼容；不写 flyway/liquibase migration（与 v0.19 加 publishCount / v0.21 加 deletedAt 同惯例）。

**显式 out-of-scope**：sticker_pool 可视化重编、基于 job 预填 create 页 deep link、追加同 job 语义、多实例 ShedLock（rerun 是同步派单，不涉及 @Scheduled）。

### v0.29（2026-05-23）— 混剪主视频按 scene 严格匹配（fix v0.25 盲点）+ 模板预览中性化 + 段时长联动素材

三块独立小改动合并到一节，全部仅 web-celebrity + server，无契约 / DB schema 变更。

**A. 致命 bug 修复：混剪主视频跨段串色（v0.25 漏修）**

v0.25 把场景切分（segCount = scenes.size + per-scene durationSec）和 overlay 时段限制（enable=between(t,a,b)）做了，但 `MixcutRenderingService.renderOneVariant` 的主视频取源仍是平铺 round-robin：

```java
File src = sources.get((variantIndex + i) % sources.size()); // ❌ 跨段串色
```

`resolveBindings` 把所有 user-bound video slot 文件拍平进 `List<File> videos`，丢失了「哪条视频绑给哪个 scene」的归属。结果：

- 用户给 scene 1 绑 A，scene 2 没绑 → `videos=[A]` → 两段都拿 A 不同随机片段 → 视觉上 A 贯穿全片
- 用户 scene 1 绑 A、scene 2 绑 B → variantIndex=1 时取序变成 `[B, A]`

**修复（server 内部重构，无 API 变化）**：

```
server : ResolvedBindings +videoBySlotId: Map<String, File> +demoPool: List<File>
       : resolveBindings 在 VIDEO_LAYERS 分支同时写入 videoBySlotId.put(slotId, local)
       : resolveBindings 始终预填 demoPool（不只是 videos.isEmpty 时），useSceneSchedule
         scene 没绑 video 不能再回退到用户其它 video（会串色），改走 demoPool
       : renderOneVariant 签名 +Map<String, File> videoBySlotId / +List<File> demoPool
       : renderOneVariant 在 segment loop 之前算 perSegSrc[segCount] —— 按 scene.slotIds
         反查 video layer slot → videoBySlotId 取文件；未命中 → demoPool round-robin；
         demoPool 也空 → 最最兜底退回旧 sources round-robin
       : segments_detail 加 video_match 诊断字段：user_slot / demo_fallback / legacy_roundrobin
```

**注意事项**：

- 兜底链严格：未命中的 scene 走 demoPool（与用户视频隔离），永远不回填到用户其它 scene 的 video。这是修复的核心 —— scene 隔离不再被破坏。
- legacy 路径（useSceneSchedule=false，老任务 scenes_snapshot 为空）保持原 round-robin 行为，零回归风险。
- `apps/web/public/videos/showreel-*.mp4` 缺失（极少）→ demoPool 为空 → 退回 sources round-robin（与 v0.25 行为相同，不会比 v0.25 更糟）。
- 无 schema / API / openapi 改动；纯 server 内部逻辑修复。

**B. 模板预览统一中性配色（去除工厂 mock 色噪声）**

模板缩略图（列表 / 首页推荐）+ 模板详情/编辑器 + 创建页四处的 `TemplatePreview`，原本都吃 `template.canvas.background_color`（mock seed 各色不同 → 黄/绿/蓝灰拼盘）+ `BLUEPRINT_LAYER_STYLES` 按 layer_type 上色（sky/emerald/rose/violet），视觉极杂乱。用户无法在创建模板时指定 canvas 色 → 这套染色既无产品意义又拉低视觉一致性。

```
web-celebrity:
  template-preview.tsx
    - 删 canvas style 的 backgroundColor: template.canvas.background_color
      (className 已有 bg-black 兜底；数据真值保留，server ffmpeg 渲 mp4 仍按各模板自身 background_color 走)
    - BLUEPRINT_LAYER_STYLES 抽出 NEUTRAL_BLUEPRINT_FRAME = { bg: white/4%, border: white/30%,
      text: white/80% }，4 个 layer_type 共用同一套描线，仅 icon 字段按类型区分
```

效果：所有预览统一黑底 + 灰白虚线框 + 类型 icon；编辑器内 violet ring 选中态成为唯一彩色高亮，注意力不被无产品语义的颜色干扰。

**C. 模板编辑器：场景时长改动联动 slot.time_range**

`updateScene` 原本是机械合 patch，改场景时长（SceneFlowEditor 输入框 → onChange(idx, { duration: v })）后 slot.time_range 不动，导致：
1. 视觉脱钩（slot 还在老时间格上）
2. 触发 validateTimeRanges 的「结束时间超本场景时长」保存校验失败

```
web-celebrity:
  template-detail-client.tsx
    + rescaleSceneSlots(scene, newDuration) helper —— ratio = new/old 等比例缩放
      所有 slot.time_range，clamp 到 [0, newDuration]；旧时长 ≤ 0 兜底拍平到 [0, new]
    : updateScene 检测 patch.duration !== sc.duration 时先 rescale 再合 patch
  scene-flow-editor.tsx
    + 时长输入框下加一行 hint「改时长后，本段内的素材时长会按比例同步缩放」
```

策略选择：**等比例缩放**而非仅 clamp —— 用户改时长一般是整体节奏调整（"这段做短"），而非"保留前 N 秒砍后面"。要精修单 slot 端点可单独编辑 time_range。

### v0.38（2026-05-28）— 大模型配置化 + 内置预设 + 模型发现

把大模型 provider 从「seed 占位 + dev/prod 区分」彻底改成「纯 admin 配置 + 内置预设 + 接口拉模型」。
配套 v0.37 起的集成测试发现：`AiModelInvocationService` 只认 OPENAI/OPENAI_COMPATIBLE，
而 seed 把火山/阿里标为 VOLCENGINE/ALIYUN，启用后必 501（同期已放宽兼容集，见 server README）。

```
server : 删除 AiModelProviderDataInitializer（不再 seed 占位 provider；dev/prod 一视同仁走配置）
       : AiModelProviderDto / AdminAiModelProviderUpsertDto +models（落 ai_model_providers.models_json）
       : 新 dto AiModelEntryDto / AiModelProviderPresetDto / AiModelDiscoveryRequestDto / AiModelDiscoveryResultDto
       : AiModelProviderAdminService +listPresets（5 个内置：火山方舟/Kimi/DeepSeek/千问/OpenAI）
         +discoverModels(baseUrl,apiKey)（新建前拉）+fetchModels(id)（已存用落库密钥拉）；create/update 序列化 models→modelsJson
       : AiModelInvocationService +listModels(type,baseUrl,apiKey)：GET /models 解析 data[].id，
         过滤 status=Shutdown/Retiring（火山方舟会带 status）
       : AdminAiModelProviderController +GET /presets +POST /discover-models +POST /{id}/fetch-models
admin  : api/ai-models.ts +AiModelEntry/+AiModelProviderPreset/+ModelDiscoveryResult +listPresets/discoverModels/fetchModels；
         AiModelProvider/upsert +models
       : /platform/ai-models 页：顶部「快速添加」预设 chip；表单「可用模型」区（获取模型列表→点选默认）；
         列表 +模型数列 + 搜索框
openapi: +/admin/ai-models/presets +/discover-models +/{id}/fetch-models（骨架，沿用既有 admin 风格）
specs  : 契约 gate 不扫 apps/admin，故不阻断；openapi 仍补齐 path 以免 drift
```

**注意事项**：

- 模型发现 / fetch 都**不落库**，仅返回列表；持久化统一走 create/update 的 `models`，避免「拉一下就改库」。
- discover（新建）用表单里现填的明文 AK；fetch（已存）用解密后的落库 AK——所以已存 provider 不必重填密钥。
- providerType 兼容集放宽是同期 server 改动（除 ANTHROPIC/AZURE_OPENAI 外都走 OpenAI wire），预设里火山/阿里/Kimi/DeepSeek 因此可直接发起 chat 与 /models。
- 老部署若已有 seed 占位行（`REPLACE_WITH_*`）不会被自动清理——在 admin 列表里删掉即可。
- 模型 id 必须是服务商真实 id（如火山方舟 `doubao-1-5-lite-32k-250115`，非展示名）；「获取模型列表」就是为了避免手填错 id。

### v0.39（2026-05-28）— Agent 平台（Coze）配置化

把「形象锻造」这类挂在 agent 平台（Coze）上的会话能力从 env 写死改为后台可配。
与 v0.38 的 AiModelProvider（裸大模型 /chat/completions）互补：本表是「agent 平台托管的 bot」
（带知识库 / 工作流 / 工具编排），按 sceneKey 绑定到具体业务功能。

```
server : 新实体 AgentBotProvider（agent_bot_providers 表，sceneKey 唯一）+ AgentPlatform 枚举（COZE/DIFY/CUSTOM）
       : 新 repo AgentBotProviderRepository（findBySceneKeyAndEnabledTrue / findBySceneKey）
       : 新 dto AgentBotProviderDto（token 脱敏）/ AgentBotProviderUpsertDto（token 明文进，加密落库）/ AgentSceneDto
       : 新 service AgentScenes（场景目录单一真源：appearance-forge）+ AgentBotProviderAdminService（CRUD + listScenes）
       : 新 controller AdminAgentBotController → /api/admin/agent-bots（CRUD + /scenes）
       : ForgeCozeService 改造：按 sceneKey=appearance-forge 从 DB 解析 bot（token/botId/apiBase/userIdPrefix），
         env 兜底（envEnabled/envToken/...）保持老部署不破；client 按 (apiBase, token) 缓存
admin  : 新 api/agent-bots.ts（list/get/create/update/remove/listScenes）+ api/index 注册 AgentBotsApi
       : 新页 /platform/agent-bots（CRUD + 平台/场景下拉 + token 加密输入 + 高级项）；nav「平台与配置」加「Agent 平台」
       : Bot ID 列 / 表单渲染「在 Coze 打开 bot 配置页」深链（{console}/space/{spaceId}/bot/{botId}，
         console 由 apiBase 推断 coze.cn/coze.com）；AgentBotProvider +可选 spaceId（仅拼链，不参与调用）
       : 表单加「粘贴 Coze bot 链接」快速填充（parseCozeBotUrl 拆 apiBase/spaceId/botId 回填，纯前端）
web-music : 形象锻造前端 USE_MOCK 开关本就齐全（mock 本地回放 / live 走 /appearance-forge/coze/stream），本期未改
openapi: +/admin/agent-bots（GET/POST）+/scenes（GET）+/{id}（GET/PUT/DELETE）骨架
```

**注意事项**：

- **一个 sceneKey 唯一对应一个 bot**（DB unique + service 双校验）；要换 bot 是「编辑」而非新增第二行。
- **env 兜底**：未在后台为某 scene 配置 bot 时，回退到原 `aep.coze.*` env（老部署 / 现网不破）。两者都没有 → `/coze/status` 报未配置、stream 抛 503。
- **mock/live 切换在前端**（`NEXT_PUBLIC_USE_MOCK`）：mock 不碰后端;live 才用后台 bot。所以本地开发不配 Coze 也能跑形象锻造。
- **本期只接 Coze**；DIFY/CUSTOM 是枚举占位，invoke 路径未实现（admin 可建档但不生效）。
- 新增一个 agent 功能 = AgentScenes 加 scene + 写薄 handler（鉴权 + 拼 prompt，按 sceneKey 取配置）+ admin 配一行 bot。流式/解析核心（ForgeCozeService 的 Coze 事件解析）待第二个场景出现时再抽公共件（现在抽属于过早）。

### v0.40（2026-05-29）— 素材运营「文本三件」接真 LLM + prompt_template 表配置化

把素材运营之前是「前端表演 / 后端 stub」的三处文本 AI 接到现成的 `AiModelInvocationService.invokeChat`
网关（不引 agent / 编排框架）：脚本 AI 起稿、商品卖点提取、脚本变量抽取。prompt（system + user 模板）
建专用 `prompt_template` 表存储，运营可在 admin 后台改 / 灰度 / 回滚。方案见
[`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](docs/MATERIAL_OPS_AI_TEXT_PLAN.md)。

```
server : AiModelPurpose +SELLING_POINTS / +VARIABLE_EXTRACT（SCRIPT_DRAFT 复用）
       : AiModelInvocationService.doChat +response_format 透传（json_object 模式）
       : 新 PromptTemplate 实体（prompt_template 表：promptKey 唯一 / systemPrompt / userTemplate /
         paramsJson / version / enabled）+ PromptTemplateRepository
       : 新 PromptService —— resolve(key) 解析顺序 DB→resource(.md)→代码兜底；1min 缓存（PUT 立即失效）；
         占位符 fill；admin CRUD + dry-run；seedIfAbsent / reseedBaselineIfUntouched
       : 新 PromptTemplateSeeder（@Order 38）—— resources/prompts/material/*.md「缺行才插」，
         SEED_VERSION 推新基线仅刷 version==1 的行（绝不 clobber 运营改过的 prompt）
       : 新 MaterialAiService —— 文本三件薄流水线：resolve+fill → invokeChat → 解析/校验/
         自修复重试 1 次 → 仍失败抛带 code 的明确错误（不静默兜底）；脚本校验 blocks 3-8、变量过滤幻觉（原值须在脚本里出现）；ensureConfigured 先判 provider/prompt 是否配置
       : ProductService.extractSellingPoints 换实现（stub → MaterialAiService，失败回退原 stub）
       : 脚本起稿计费（后端可配置）：CelebrityActionPricingService +action material.script-draft（默认 0=不计费）；
         MaterialOpsService.draftScripts 走 CreditService hold(单价×稿数)→commit/release 三段式，余额不足抛 402，
         anonymous 不计费；方法标 @Transactional(NOT_SUPPORTED) 让 hold/commit 独立落账 + LLM HTTP 不占 DB 连接
       : MaterialOpsService +draftScripts / +extractVariables；MaterialOpsController
         +POST /material/scripts/ai-draft + POST /material/scripts/{id}/variables
       : 新 AdminPromptController /api/admin/prompts（GET list / GET {key} / PUT {key} / POST {key}/dry-run）
       : 新 dto PromptTemplateDto / PromptTemplateUpsertDto / PromptParamsDto
web-celebrity:
       : api/material-ops.ts +aiDraftScripts / +extractScriptVariables（USE_MOCK → []；live 失败抛 ApiError）
       : DraftingHub AIPicker.run 接 ai-draft（失败显示后端明确报错 + 重试；不静默兜底）
       : DeriveVariablesPanel 挂载时拉 extractScriptVariables（即时正则占位；AI 非空则升级，失败显式警示保留正则）
       : CelebrityProductForm「AI 提取卖点」失败 inline 报错
admin  : api/prompts.ts + 新页 /platform/prompts（system/user 双 textarea + params + 启用开关 + 试运行）
       : nav「平台与配置」加「Prompt 管理」；ai-models 页 PURPOSES +卖点提取/变量抽取（可路由 provider）
       : /celebrity/engine-pricing 动作单价表 +行 material.script-draft（AI 脚本起稿，0=不计费）
test   : MaterialAiE2ETest（@MockBean）—— 正常 JSON / 脏输出自修复 / 无 provider → AI_NOT_CONFIGURED 503 /
         调用失败 → AI_CALL_FAILED 502 / 卖点 join / 变量过滤幻觉（8 测）
       : MaterialDraftBillingTest（独立 datasource）—— 单价×稿数扣减 / 余额不足 402 / 单价 0 不计费（3 测）
```

**注意事项**：

- **不静默兜底，配置问题可见**（按用户要求）：provider 未配 / prompt 未配 / 调用失败（含 token 无效 401/403）/
  JSON 解析失败 → 抛带 code 的明确错误（`AI_NOT_CONFIGURED` 503 / `PROMPT_NOT_CONFIGURED` 503 /
  `AI_CALL_FAILED` 502 / `AI_BAD_OUTPUT` 502），前端展示。脚本起稿 / 卖点提取阻塞式报错（不再用占位池）；
  变量抽取保留正则兜底但显式警示 AI 未生效。`USE_MOCK` 前端模式不打后端、自有本地占位，与此无关。
  上线前需在 `/platform/ai-models` 配带 `SCRIPT_DRAFT/SELLING_POINTS/VARIABLE_EXTRACT` purpose 的
  provider + 真 apiKey（模型 id 用「获取模型列表」选真实 id），否则前端直接显示 `AI_NOT_CONFIGURED`。
- **prompt 真源在 DB**：system 与 user 模板都在 `prompt_template` 表，代码只填 `{{占位符}}`。
  `.md` 默认仅作 seeder 基线 + git 留底，运行时读表不读文件。
- **JSON 模式**：provider 支持时开 `response_format=json_object`；为兼容 array 用对象包裹
  （`{"scripts":[]}` / `{"variables":[]}` / `{"selling_points":[]}`）。弱模型建议用稍强模型降低重试/兜底率。
- **多实例缓存**：PromptService 1min 内存缓存单实例 OK；多实例时 admin 改 prompt 后其他实例最多 1min 生效。
- **脚本起稿计费**：已接 `CreditService` hold→commit/release 三段式，单价走 `material.script-draft` action
  （admin → 平台与配置 → 引擎价格 → 动作单价表；默认 0 = 不计费，运营设单价即开启）。卖点/变量量小暂不计费。
- **未做**：违禁词 server lint 端点（前端纯规则已够用）、Langfuse 埋点、视频生成引擎 / RAG。

**v0.40 修订（用户反馈 6 项）**：

1. **起稿 500 / JSON 截断**：起稿默认只生成 1 稿（之前 3 稿，输出过长在 maxTokens 处被截断 → JSON 不完整 →
   解析失败 → 偶发代理超时返回 500）；`PromptParamsDto.DEFAULT_MAX_TOKENS` 2048→4096；`extractJson` 加 markdown
   围栏剥离；`buildScriptAsset` 逐候选 try/catch（坏候选跳过不 500）；解析失败日志 body 截断阈值 240→1000。
2. **只起 1 稿**：`DraftingHub` AIPicker 去掉「起稿数量」选择器，固定 1 稿，不满意可重新生成。
3. **应用按钮去重**：起稿预览只保留「应用到编辑器」一个按钮（删「应用并预览」）。
4. **脚本/字幕语义**（最终口径，用户拍板，覆盖 goods_to_video 的相反方向）：`shot`＝脚本/画面/分镜
   （这一镜拍什么、怎么拍，描述视频内容，主），`text`＝字幕/口播语音（要念出来、显示为字幕的台词，会配音）。
   material.script_draft prompt、编辑器 ShotBlock 标签、前端 mock SCRIPT_ASSETS（对齐 server seed 的画面 shot）、
   DraftingHub 占位池均按此口径；ScriptBlock +`genVoice?`（字幕生成开关，取消则该镜纯画面）；
   编辑器去掉同期声/花字旧 chip，给「脚本·画面/分镜」加画面快捷填入。
   注：rebase 到 goods_to_video 时曾短暂反向（text=脚本/口播），随后按用户截图反馈翻回本口径。
   PromptTemplateSeeder SEED_VERSION 多次 bump 刷新 version==1 基线。
5. **商品详情提卖点入口**：素材库 `VideoLibraryView` 商品 hero 加「AI 提取卖点」（运营角色可见）→ 提取 + 落库 + 即时展示。
6. **错误可见 + 日志**：新增统一错误组件 `components/common/ai-error-notice.tsx`（展示报错 + 可复制「追查号」logId）；
   `MaterialAiService` 全链路 INFO/WARN 日志（promptKey / provider / model / finish_reason / tokens / 解析结果；
   finish=length 警告截断）；错误消息均带 `promptKey`（issue 5：方便定位调的哪个 prompt）。DraftingHub /
   DeriveVariablesPanel / CelebrityProductForm / 商品 hero 统一用该组件展示。

### v0.42（2026-05-29）— 素材运营带货视频生成接真后端（异步 submit + 轮询）+ 脚本预览修复

把素材运营「派生视频」从纯前端 mock 改成真实视频大模型生成 + 服务端轮询；同时修了脚本预览关联商品错配、简化了基线生成入口。**仅 celebrity 线 + server 改动**。

**1. 脚本预览关联商品修复（bug）**

`/material/workshop/{id}` 预览页（及编辑页）之前用 `MATERIAL_PRODUCTS.find(...) ?? MATERIAL_PRODUCTS[0]` 兜底解析商品 —— 商品选择器拉的是**全量商品库**，选了非这 6 个内置 mock 商品时落到 `MATERIAL_PRODUCTS[0]`（德绒高领打底衫），显示成完全无关的商品。修复：`material-ops.ts` 新增 `resolveProductForScript` / `resolveProductById`，按 `product_id` 查全量商品库（live `/api/products/{id}` / mock SEED_PRODUCTS）→ `toMaterialProduct`；查不到也只给中性占位，绝不张冠李戴。`getScript` 落库时即用它挂 `product`；preview-client / editor-client / ProductMaterial（派生入口）都改走它。

**2. 基线生成直给（去冗余选项）**

脚本预览「生成视频」之前弹出 6 轴画面维度 + 18 项结构化参数，对一键生成无用。`VideoGenDialog` baseline 模式重写为**直接生成**（脚本+商品摘要 + 一句话可选「补充要求」+ 生成按钮）；6 轴画面维度选项移到**派生**时才出现（`DeriveVariablesPanel` 新增折叠「画面维度」区）。

**3. 派生视频接真后端 + 轮询 + 每任务独立回显**

- 派生面板进入**不再自动跑 AI**：变量先用正则占位，用户点「AI 识别变量」才调真 LLM（可反复重新识别）。
- 点「生成 N 条」= 真实提交（不再 mock 进度动画）；进入 generating 阶段轮询每个任务、出片后内嵌 `<video>` 播放；支持「重新生成」。
- 任务持久化 + 独立查询：每个任务可单独轮询回显；任务也出现在素材库（库自带 3s 轮询），关弹窗不影响。

```
server : 新实体 MaterialVideoJob（material_video_job 表）+ MaterialVideoJobRepository
       : MaterialVideoModelClient —— 视频大模型「提交 + 轮询」HTTP 客户端（单一可替换点）。
       :   provider（baseUrl/apiKey/model）取自后台「AI 模型」配置（用途 = VIDEO_GENERATION）；
       :   submit/poll 协议细节取自 aep.material.video.*；响应解析对常见字段多形态兜底
       :   （默认对齐异步任务约定，如 智谱 CogVideoX：POST /videos/generations → GET /async-result/{id}）。
       :   未配 provider/apiKey → 抛 VIDEO_NOT_CONFIGURED（503，明确提示去 AI 模型页配）。
       : MaterialVideoJobService（submit 扣费+派发 / getJob / listJobs / →MaterialVideo 形状 wire 映射）
       : MaterialVideoWorker（@Async("materialVideoExecutor") 提交后服务端轮询直到出片/超时；
       :   成功 commitHold / 失败 release）；MaterialVideoAsyncConfig 线程池
       : AiModelPurpose +VIDEO_GENERATION；CelebrityActionPricingService +action material.video-generate（默认 30/条）
       : MaterialOpsController +POST /material/videos/generate + GET /material/videos/jobs[/{id}]
       : application.yml +aep.material.video.*（submit/poll 路径、轮询间隔、最大等待、并发、默认 model）
       : 测试 MaterialVideoModelClientTest（normalizeStatus / extractVideoUrl 多形态解析，4 测）

web-celebrity:
       : types.ts MaterialVideo +video_url/thumbnail_url/error_message/external_task_id；+VideoGenJobRequest
       : api/material-ops.ts +resolveProductForScript/resolveProductById +submitVideoJobs/getVideoJob/listVideoJobs；
       :   listVideos（live）合并真实任务卡；mock 沿用 localStorage 模拟
       : lib.ts +buildVideoPrompt（脚本+商品+画面维度→中文提示词）+buildJobRequests
       : VideoGenDialog 重写（baseline 直给 / variant 派生 + 真实提交轮询 + 重新生成 + 内嵌播放）
       : DeriveVariablesPanel（去自动跑 AI → 按钮触发 + 重新识别；+折叠画面维度；单一「生成」按钮）
admin  : ai-models 页 PURPOSES + PURPOSE_LABEL +「视频生成」(VIDEO_GENERATION)
openapi: +/material/videos/generate + /material/videos/jobs[/{id}]
```

**注意事项**：

- **token 在后台配，不在 env 配 token**：到 管理后台 → 平台与配置 → AI 模型 加一个服务商，勾「视频生成」用途，填 baseUrl + 有效 API Key、默认 model 用真实模型 id。未配前端发起生成会显示「未配置」明确错误（不静默兜底，对齐 v0.40 文本三件）。
- **换厂商**：多数只改 baseUrl（provider 里）+ `aep.material.video.submit-path/poll-path-template`；wire 差异大就替换 `MaterialVideoModelClient` 这一个文件，不影响调度/积分/前端。默认值对齐 智谱 CogVideoX 异步任务约定。
- **服务端轮询占线程**：worker 提交后在该线程上轮询直到出片/超时（视频生成慢，单任务可达数分钟），并发上限 = `aep.material.video.max-concurrent`（默认 3）。多实例 / 高并发需改 @Scheduled 轮询 + ShedLock（沿用 PublishJobScheduler 待办）。
- **积分**：单价走 `material.video-generate`（admin 可配，默认 30/条）；hold→commit/release 三段式（不可变账本约束）。失败 / 超时自动退款。
- **MaterialVideoJob 即视频源**：成功任务直接作为素材库的 ready 卡（带 video_url），不再额外写 MaterialVideo 行；旧的 `/material/videos/batch` + mock localStorage 模拟保留（USE_MOCK / seed 演示）。

### v0.41（2026-05-29）— 合并「AI 模型」+「LLM 网关 Key」为「模型接入端点 + Key」+ AI 应用绑定 + 大模型用量统计

把 admin 两个割裂入口（`/platform/ai-models` 服务商 / `/platform/llm-keys` 网关 Key）合并为**一个**「AI 模型与 Key」入口（双 Tab）。模型配置从「服务商（一对多模型/用途 + priority 兜底）」改成「**固定模型接入端点** = {上游密钥 + 单模型 + 地址}，端点自带网关 Key」；每个 **AI 应用（用途）固定绑一个端点**，前端用 AI 时经绑定路由到对应模型。

**核心设计决策**（用户确认）：
- **两层，端点自带 Key**：折叠旧 `LlmApiKey` 进端点（`sk-aep-*` 的 prefix/hash/usage/ownerUserId 落到 `ai_model_providers`）。
- **一用途一端点，无兜底**：废弃 `purposes` 过滤 + `priority` + 5xx fallback。
- **统一 Key 概念**：同一 Key 既供内部 AI 应用路由（经绑定），又供外部 llm-gateway 计费（`ownerUserId` 非空才扣钱包，空=平台级仅累计）。
- **范围仅 LLM 文本类用途**（`AiModelPurpose`）；Coze / `AgentBotProvider` / 形象锻造不动。

```
server : 实体 AiModelProvider → AiModelEndpoint（@Table 仍 ai_model_providers；@Column 复用 api_key_encrypted /
       :   default_model；+key_prefix/key_hash/owner_user_id/total_tokens/total_calls/last_used_at/key_revoked_at；
       :   删 purposes/priority 字段——物理列残留无害，迁移 seeder 在弃用前 native 读一次）
       : 新 AiAppBinding（ai_app_binding 表，AiModelPurpose 作 @Id → endpoint_id）+ AiAppBindingService（list/bind/unbind）
       : AiModelInvocationService：pickProviders → resolveEndpoint(purpose)（binding→endpoint，filter enabled，无兜底）；
       :   hasProviderFor → hasEndpointFor；doChat 用 upstreamApiKeyEncrypted + endpoint.model；AiModelResponse.providerUsed → endpointUsed
       : 新 AiModelEndpointKeyService（mint/revoke/validate/reportUsage；validate/usage 未命中端点→回退旧 LlmApiKeyService）
       : AiModelProviderAdminService → AiModelEndpointAdminService（+mintKey/revokeKey；删端点前 countByEndpointId 守卫）
       : AiModelProviderInternalService → AiModelEndpointInternalService（/upstreams 的 modelPrefixes=[endpoint.model]）
       : InternalLlmApiKeyController 改注入 AiModelEndpointKeyService（URL /api/internal/llm-keys/{validate,usage} 不变）
       : 控制器 AdminAiModelProviderController → AdminAiModelEndpointController（路由仍 /api/admin/ai-models；+mint-key/revoke-key）
       : 新 AdminAiAppBindingController（/api/admin/ai-app-bindings GET + /{purpose} PUT/DELETE）；删 AdminLlmApiKeyController
       : 迁移 AiModelEndpointBindingSeeder（@Order 55）：model 回填 + 旧 purposes/priority 升序回填绑定（首个最低 priority 胜）；
       :   全新 DB 无旧列 → native 读失败静默跳过。LlmApiKey 表/Service 保留作兼容回退（下一版删）
admin  : nav.ts 两条合并为「AI 模型与 Key」一条（删 /platform/llm-keys）
       : api/ai-models.ts 重写（AiModelEndpoint 删 purposes/priority、defaultModel→model、+key/usage/ownerUserId；
       :   +mintKey/revokeKey/listBindings/bind/unbind）；删 api/llm-keys.ts + index 的 LlmKeysApi 导出
       : /platform/ai-models 重写为双 Tab：模型接入端点（CRUD + 固定模型 + 生成/撤销网关 Key + 明文一次横幅 + ownerUserId）
       :   / AI 应用绑定（7 用途各一个端点下拉）；删 /platform/llm-keys 页
openapi: +/admin/ai-models/{id}/mint-key + /revoke-key；+/admin/ai-app-bindings (get) + /{purpose} (put/delete)
       : 既有 /admin/ai-models* 路径保留；/admin/llm-keys* 本就不在 openapi（无可删）
```

**注意事项**：
- **网关零改（Option A）**：`InternalUpstreamDto` 形状不变（`modelPrefixes=[endpoint.model]`，精确模型即自身前缀，`Upstream.matches` 仍生效）。`validate` 返回 `userId` 可空（平台级），gateway `path("userId").asText()`→"" 不 NPE。
- **破坏性 + 兼容**：表名 / 物理列 / 内部 URL / admin 路由全部保留；旧 provider 行经 seeder 自动迁为端点 + 绑定；旧 `sk-aep-*` 经 validate 回退继续可验。`ddl-auto=update` 加新列（`@ColumnDefault` 兜底），不删旧列（`purposes`/`priority` 残留，下一版清理）。
- **风险 R1**：`admin-sync` 开启后 gateway 按精确 model 键控 registry；两个启用端点 model 串相同时 `findForModel` 命中不确定 —— 约定启用端点 model 唯一。
- **未做**：Option B（key 完全决定 gateway 路由，需改 ApiKeyAuthFilter/ChatProxyService）；删 `llm_api_keys` 表；端点级多 Key。

**大模型用量统计（自建 token 流水，同期合并自 goods_to_video）**：把每次 `/chat/completions` 响应里的 `usage`（prompt/completion/total tokens）落库聚合，admin 端新增「用量统计」Tab。各厂商无统一用量查询协议，但响应 usage 字段对所有 OpenAI 兼容端点通用 → 自建流水最稳，也符合本仓「账本式只追加」哲学。

```
server : 新实体 AiModelUsageRecord（ai_model_usage_record：providerId(=端点 id)/providerName/model/purpose/
       :   prompt|completion|total Tokens/success/createdAt）+ AiModelUsageRecordRepository（Object[] 聚合）
       : 新 AiModelUsageService.record(...)（@Transactional REQUIRES_NEW + try/catch，best-effort）
       :   + report(days)/reportForProvider(id,days)（days 缺省 30 封顶 365）
       : AiModelInvocationService.doChat 解析 prompt/completion tokens + 末尾 usage.record(...)（透传 purpose）
       : AdminAiModelEndpointController +GET /usage +GET /{id}/usage
admin  : api/ai-models.ts +AiModelUsageStat/Report + getUsage/getProviderUsage；/platform/ai-models +「用量统计」Tab
       :   （时间窗 1/7/30/90/365 天 + 4 汇总数 + 按端点/按模型占比表）
openapi: +/admin/ai-models/usage + /{id}/usage
```

- **只记成功调用 + best-effort**：失败在 parse 前抛出不落流水；record 独立事务写库失败只 WARN，不阻断 chat。
- **provider 维度即端点维度**：usage 的 providerId/providerName 传 endpoint.id/name（端点已取代 provider）。

### v0.43（2026-05-29）— 三子产品平台访问隔离 + 音乐形象锻造接大模型 + 短剧脚本化生成

一次性补齐三件事：(1) music/drama/celebrity 账户登录的**平台访问隔离**；(2) **音乐形象锻造**从 Coze-only
升级为**优先走平台大模型**的流式对话，drama 形象锻造对齐同一逻辑（UI 独立）；(3) **短剧生成**（脚本化：
AI 起草分场景脚本 → 生成短剧视频），复用 celebrity 的视频任务管线。配套本地 fake 大模型，全链路在无真实
key 时也能端到端跑通。

**A. 平台访问隔离（access isolation）**

```
server : AepUser +platforms 列（CSV，如 "music,drama,celebrity"；空=全部可访问，老账号不被锁）
       : PlatformSupport（纯函数：parse/effective/canAccess/toCsv）+ PlatformAccessService（注册授予策略）
       : AepUserDto / MeDto +platforms（/api/me 透出 effective 列表）
       : LicenseActivationService.activate / SmsAuthController.register 按 PlatformAccessService 授予
       : application.yml aep.platform.dev-grant-all（默认 true）：true=一处注册三端可用；false=按注册来源 platform 授予
       : DataInitializer 种子账号补 platforms = 全平台
types  : account.ts +SubProduct（music/drama/celebrity）+ ALL_SUB_PRODUCTS + SUB_PRODUCT_LABEL_ZH；AepUser +platforms
shared : AuthProvider +requiredPlatform → 计算 hasPlatformAccess；packages/landing +AuthScreen（主题化三 tab
         手机号登录/注册/体验账号）+ PlatformAccessDenied（拦截屏）
web-*  : 三端 providers 注入 requiredPlatform；workspace 布局在「已登录但未开通本子产品」时渲染 PlatformAccessDenied
       : music/drama 登录页改用共享 AuthScreen（与 celebrity 对齐；注册透传 platform）
test   : PlatformSupportTest（5 测：canAccess 对未授予平台返回 false 即隔离成立；空配置宽松放行）
```

> 隔离拦截在前端（按 /api/me.platforms 判断），后端不做逐接口平台门禁 —— 用户私有数据本就按 ownerUserId 隔离。
> JWT 不带 platform；改 platforms 后需重新登录 / 刷新 /api/me 才生效。

**B. 形象锻造接平台大模型（music + drama 共用后端）**

```
server : AiModelPurpose +APPEARANCE_FORGE；PromptService +KEY_APPEARANCE_FORGE("appearance.forge") 入 KNOWN_KEYS
       : resources/prompts/material/appearance.forge.md（系统设定 + {{input}}）
       : ForgeChatService（混合通道）：APPEARANCE_FORGE 绑定端点 → invokeChat 取整段方案后服务端切流成 SSE delta；
         否则 Coze 已配 → 回退 Coze；都没有 → 503 明确文案。artist 归属校验（在 DigitalIp 表则校验，不在则放行）
       : ForgeController +/appearance-forge/chat/status + /chat/stream（/coze/* 保留为同行为别名）；安全放行 /chat/**
web-music : api/appearance-forge 改打 /chat/*；AppearanceForge.v3 聊天框接真流式回复（实时回写气泡）；去技术化文案
web-drama : api/appearance-forge 改打 /chat/*；/forge 页从 mock 渐变批量 重写为 对话式形象顾问（影院风独立 UI），
            移除 window.prompt 预设命名（违禁原生弹窗）
```

**C. 短剧生成（脚本化，参考 celebrity 商品视频脚本方案）**

```
server : DramaScript 实体（drama_scripts 表：ownerUserId/title/genre/durationSec/status/payloadJson 软删）+ repo
       : DramaScriptService（CRUD + aiDraft 大模型 + generateEpisodes 委派 MaterialVideoJobService）
       : DramaController /api/me/drama/{scripts*,scripts/ai-draft,episodes/generate,episodes/jobs*}
       : AiModelPurpose +DRAMA_SCRIPT_DRAFT；prompts/material/drama.script_draft.md（输出 scenes JSON：
         heading/summary/shot(画面)/dialogue(台词)/duration_sec）
       : 视频生成复用 MaterialVideoModelClient/Worker/Job —— 短剧任务以 kind="drama-episode" + scriptId 区分带货视频
web-drama : api/short-drama.ts + /short-drama 页（起草→预览→保存→生成→轮询回显视频）+ 侧栏「短剧生成」入口
```

**D. 本地 fake 大模型联调链路**

```
server : DevFakeAiSeeder（@ConditionalOnProperty aep.dev-fake-llm.enabled，dev 默认开）：接入 fake 端点 +
         为 APPEARANCE_FORGE/DRAMA_SCRIPT_DRAFT/SCRIPT_DRAFT/.../VIDEO_GENERATION 绑定（已被运营绑过的不动）
       : application.yml aep.dev-fake-llm.{enabled,base-url,model}
scripts: dev-fake-llm-server.mjs（零依赖 OpenAI 兼容 /chat/completions + 视频 submit/poll；按 prompt 关键词
         返回中文方案 / 短剧 scenes JSON / 视频任务）
```

**注意事项**：

- **不静默兜底**：短剧脚本起草 未配端点 → AI_NOT_CONFIGURED 503；未配 prompt → PROMPT_NOT_CONFIGURED 503；
  调用失败 → AI_CALL_FAILED 502；输出无法解析 → AI_BAD_OUTPUT 502。形象锻造同理（FORGE_NOT_CONFIGURED 等）。
- **生产接入**：管理后台 → 平台与配置 → AI 模型与 Key，为「形象锻造对话」「短剧脚本起草」「视频生成」用途各绑一个
  真实端点（模型 id 用「获取模型列表」选真实 id）。dev 不配也能用 fake 端点跑通。
- **drama 视频任务**与 celebrity 带货视频共用 material_video_job 表，靠 kind + scriptId 区分；listJobs 按 scriptId 过滤。
- **E2E 已验证**（dev + fake LLM/video）：/api/me 返回 platforms；形象锻造 SSE 经 Next dev proxy 流式回写；
  短剧 起草(4 场景)→保存(ready)→生成→轮询至 ready 带 video_url。
- ffmpeg 在本环境缺失，但形象锻造 / 短剧脚本 / 视频任务（fake）均不依赖本地 ffmpeg；混剪渲染仍需 ffmpeg。

### v0.44（2026-05-30）— celebrity 三类成片视频聚合进一级「视频库」(/library)

celebrity 子产品「看成片视频」的入口原本散在三处、数据模型各异，用户找视频要在多个菜单间跳。本版把三类**成片**聚合进现有左侧一级入口「视频库」(`/library`)，用顶层「来源 Tab」区分，全部只读浏览。**纯前端信息架构重组，不动 server / api 调用层 / `packages/types` / openapi。** 仅 web-celebrity 改动。

| 来源 Tab | `?source=` | 数据类型 | 来源 API | body 组件 |
|---|---|---|---|---|
| 明星视频 | `project`（默认） | `CelebrityProjectVideo` | `listAllVideos`+`listProjects`+`listStars` | `CelebrityVideoLibrary`（零改动，数据加载移入壳内 `ProjectVideosTab`） |
| 脚本视频 | `material` | `MaterialVideo` | `MaterialOpsApi.listVideos` | 新 `ScriptVideosTab`（只读，渲染中 3s 轮询，卡片跳 `/material/assets`） |
| 混剪成片 | `mixcut` | `RenderOutput` | `MixcutApi.listJobs` | 新 `MixcutOutputsTab`（从 `MyVideosTab` 抽只读版） |

```
web-celebrity:
  app/(workspace)/library/page.tsx              重写为壳：<Suspense> + 来源 Tab + ?source= 软同步 +
                                                条件渲染 active body（避免首屏同打三套接口）+ ?product= 透传脚本视频
  components/celebrity-zone/ScriptVideosTab.tsx  新：只读聚合 MaterialVideo，9:16 卡片，
                                                顶部说明「派生/详情/提卖点请前往商品素材库」，卡片点击跳 /material/assets?product=
  components/mixcut-zone/MixcutOutputsTab.tsx    新：从原 MyVideosTab 抽只读版，保留「第 N 条」「已分发 ×N」徽标 + 搜索，
                                                删软删按钮 + useConfirm + deleteOutput（删除迁回混剪任务详情页）
  app/(workspace)/mixcut/library/page.tsx       瘦身：删 videos tab（TopTab/MyVideosTab/VideoCard/EligibleOutput/VideoItem），
                                                标题「我的混剪库」→「混剪素材库」+「前往视频库 →」链接；
                                                ?tab=videos 旧深链 router.replace("/library?source=mixcut")
  app/(workspace)/layout.tsx                    侧栏「制作」组「视频中心」→「视频库」、去 badge:4；面包屑同步
  components/distribution/DistributeWorkbench.tsx  右栏「视频库」超链 /mixcut/library?tab=videos → /library?source=mixcut
```

**注意事项**：

- **全只读浏览**：脚本视频 = 只读聚合（生产动作在 `/material/assets` 商品素材库，含派生/详情/AI 提卖点，**保留不动**）；混剪成片 = 只读（保留「已分发 ×N」徽标，软删 UI 下线 —— 后端 `DELETE /mixcut/outputs/{id}` 端点仍在，删除迁回 `/mixcut/jobs/{id}` 任务详情页）。
- **生产功能与原始素材保留在原菜单**：素材运营→脚本工坊 / 商品素材库 / 混剪专区→素材库（瘦身后剩三素材 tab）各归各位，零改动。
- **三类数据不融合**：状态枚举（中文 `已发布|待审核…` vs `ready|rendering…` vs success output）、操作各异，用来源 Tab 隔离 + 各自复用现有卡片，不强行融成单一网格。
- **未做**：混剪成片软删的新入口（暂下线）；脚本视频在视频库内直接派生（仍引导回商品素材库）；三来源跨 Tab 统一搜索/排序。

### v0.45（2026-05-30）— AiAvatar 形象资产管理中心（第 4 个 web 子产品 + 独立 aiavatar 后端领域）

> ⚠️ **该领域已于 v0.51 整体删除**（从未被前端消费；web-aiavatar 由全新 dap 领域承接，见 v0.51 节）。本节仅作历史记录。

新增独立子产品「AiAvatar 形象资产管理中心」：真人授权复刻 / 纯 AI 原创两种创建模式，7 步标准链路
（打样 → 草稿迭代 → 精调 → 模板美化出图 → 定稿 → 衍生 3D/视频 → 入库）+ 资产版本管理 / 素材管理 /
真人授权管理 / AI 模板中心 / 异步任务中心。**独立实现**：新 server 领域包 `com.aistareco.aep.aiavatar.*`，
所有新表统一 `aiavatar_` 前缀；账户复用 `aep_users`，积分复用 `CreditService`。新前端 app `apps/web-aiavatar`
（Next 16 / React 19 / Tailwind v4 / pnpm，port **3013**，深色琥珀主题）。详见
[`apps/web-aiavatar/README.md`](apps/web-aiavatar/README.md) + [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md) +
[`docs/AIAVATAR_PROGRESS.md`](docs/AIAVATAR_PROGRESS.md)。

```
server : 8 实体（aiavatar_avatar / aiavatar_avatar_version / aiavatar_asset / aiavatar_source_material / aiavatar_license_grant /
         aiavatar_template / aiavatar_job / aiavatar_refine_edit）+ 10 枚举（8 态状态机 AiAvatarStatus / 13 能力 AiAvatarCapability …）
       : Provider 抽象层 CapabilityProvider + AiAvatarProviderRegistry（按 aep.aiavatar.app-mode + 每能力
         aep.aiavatar.providers.<cap> 选 mock/backend/selfhost，热切换）；13 能力实现：
         faceWarp=真实确定性液化(AiAvatarGeometryWarp，任务书§4硬要求不许mock)；nlu=BackendNluProvider 接
         AiModelInvocationService LLM 网关；其余 Mock（产出真 PNG/真 GLB，模拟真实进度）+ SelfHostHttpProvider 通用编排
       : AiAvatarJobRunner(@Async aiAvatarJobExecutor + 进度心跳 + 落资产/建版本快照/推状态机/积分 hold-commit-release)
       : AiAvatarJobWatchdog —— 监控线程（用户硬要求）：AiAvatarAsyncConfig 编程式调度每 aep.aiavatar.watchdog-interval-ms
         （默认 1h）巡检；RUNNING 心跳超 aep.aiavatar.job-stale-ms / FAILED 有额度 / 卡死 QUEUED → 自动续跑（重试上限）
       : AiAvatarCryptoStore（真人原始照片 AES-GCM 加密落 aiavatar-assets/secure/，UI 仅脱敏预览）
       : 6 控制器：AiAvatarController(/api/me/aiavatar/avatars，7步动作) / AiAvatarJobController(/jobs + SSE 进度流) /
         AiAvatarAssetController(上传/加密下载) / AiAvatarTemplateController / AiAvatarHealthController(/api/aiavatar/health/providers，公开可观测) /
         AiAvatarAdminController(/api/admin/aiavatar，工厂模板 CRUD + 手动 sweep)
       : AiAvatarTemplateSeeder（6 工厂模板，@Order 60）；AepSecurityConfig +/api/aiavatar/health permitAll + /api/aiavatar/** authenticated
       : application.yml +aep.aiavatar.*；测试 40 例（AiAvatarStatusTest 7 + AiAvatarProviderContractTest 22 +
         AiAvatarJobWatchdogTest 8 + AiAvatarJobIntegrationTest 3，真实 Bean+H2）
types  : packages/types/src/ai-avatar.ts（唯一契约：13 能力 / 8 态 / 全实体 / 请求体，camelCase）
web    : apps/web-aiavatar —— 10 页面（landing/login/资产总库三视图/创建/资产详情7Tab+工作流动作区/
         精调工作台/模板中心/授权管理/任务中心/能力健康）+ mock 引擎(store.ts，离线整跑) + apiFetch 双路径 +
         真实几何形变 lib(face-warp.ts，7 vitest) + ModelViewer(CSS3D 可旋转) + SourceBadge(MOCK 角标)
openapi: +33 aiavatar path 骨架（/aiavatar/health + /me/aiavatar/* + /admin/aiavatar/*）
```

**注意事项**：

- **三种运行路径均验证**：dev mock（USE_MOCK=1 离线）/ server+H2（dev profile）/ server+MySQL（mysql profile，
  docker mysql:8.0 验证 aiavatar_* 8 表自动建表 + 7 步链路 + 持久化 + 监控线程活体续跑）。
- **平台隔离**：ai-avatar 不接入 v0.43 的 `SubProduct`(music/drama/celebrity) 平台门禁（`requiredPlatform`
  仅那三者）；任何已登录账号可访问。要纳入隔离需扩 `SubProduct` 并同步后端 `PlatformSupport`（见 DECISIONS §A3）。
- **InsightFace 非商用**：InstantID(faceClone) / RetinaFace(faceDetect) 依赖的 InsightFace 仅限非商用研究；
  生产商用前必须换可商用人脸编码 / 检测或获授权（DECISIONS §C）。
- **能力切真实**：`AEP_AIAVATAR_APP_MODE=prod` 或 `AEP_AIAVATAR_PROVIDERS_<CAP>=selfhost` + `AEP_AIAVATAR_SELFHOST_BASE_URLS_<CAP>=...`；
  Mock 与 Real 走同一组契约测试，可无缝替换。
- **监控线程多实例**：内存进度 + 单实例调度；多实例需 ShedLock（沿用 PublishJobScheduler 同样待办）+ Redis 共享进度。
- **api-contract gate**：检查器（scripts/check-api-contract.mjs）已扫描 web-aiavatar；当前剩余 20 missing path
  + 1 missing method 来自 web-drama / web-celebrity 历史 drift，非 AiAvatar 引入。

### v0.46（2026-06-01）— web-drama 短剧工坊视觉与业务流整体重构（B1-B8.5）

按 Figma Make 原型「短剧工坊·桌面 + 移动端」逐项落地。**全站视觉令牌切到暖白橙红（`#fafaf9` 底 + `#f97316/#e11d48` 双点缀），业务主线从"短剧生成单页"重构为"6 阶段工作台流水线"。仅 web-drama 改动，后端契约不变。**

```
apps/web-drama:
  styles/tokens.css                    完全重写:暖白橙红 + Noto Sans SC/Quicksand,旧名(--bg-0/--fg-0/--accent-strong/--gradient-gold)作别名指向新值
  styles/app.css                       追加设计真源全部通用类(.btn/.chip/.tag/.card/.thumb/.overlay/.cost/.scroll/.skel/.fade-up/.pop-in/.slide-in-r/.phone-bezel)
  app/layout.tsx                       字体 Noto Sans SC + Quicksand,去 dark/data-theme="premium"
  app/providers.tsx                    Toaster light + 胶囊;挂 DramaConfirmHost
  app/(workspace)/layout.tsx           暗色残余清扫 + sidebar IA 重整 4 组(短剧工坊/创作素材/分发与洞察/账户) + 工作台沉浸态(isWorkshop 路径跳过通用 sidebar/topbar)
  app/(workspace)/projects/page.tsx    替换为「我的短剧」首页(项目卡格栅 + dashed 新建卡 + 6 项目按隔离 mock)
  app/(workspace)/projects/new/...     新建短剧两步流(选类型 9 卡 + 选模式仪式感双选 + 五维挖掘/模板预填)
  app/(workspace)/projects/[id]/...    短剧工作台沉浸态(StageRail + ProjectTopbar + EpisodeStrip + CastPanel + 6 阶段视图)
  app/(workspace)/short-drama/...      → redirect("/projects")(老单页能力并入 6 阶段)
  app/(workspace)/scripts/page.tsx     顶部主线引导 banner(跨项目脚本归档 vs 项目内单集剧本分工)
  app/(workspace)/cast/page.tsx        同 banner(跨项目 IP vs 项目内角色)
  app/(workspace)/dashboard/page.tsx   hero 重写 + "进入短剧工坊"主线 CTA;eyebrow 文案护栏
  app/(workspace)/scripts/[id]/page.tsx window.confirm → dramaConfirm(tone:"danger")

  components/drama-ui/                 10 个原语(Thumb/Avatar/Cost/useGen+GenSkeleton+GenError/AICollab+RewriteTagPill/ChipGroup/EngineTag/Editable/Meta/Field/DramaConfirmDialog+Host)
  components/drama-workshop/
    stages-config.ts                   6 阶段定义 + STAGE_BY_KEY + cost 预算
    project-card.tsx                   首页项目卡(9:16/16:10 渐变缩略 + 进度条)
    new-project/                       step-dot/pick-type/mode-card/guided-start/template-start/pick-mode
    workbench/                         stage-rail/episode-strip/cast-panel/project-topbar/stage-header/workshop-shell/run-all-dialog
    stages/                            topic/outline/cast/(char-card+avatar-picker+scene-picker)/script/board/(timeline-bar/layout-toggle/shot-bits/shot-cards/shot-detail/engine-limits/shot-prompt-peek)/prompt

  mocks/drama-workshop/                5 文件(types/avatar-themes/meta/projects/index):
                                       6 个项目全套样例数据(每项目独立
                                       projectInfo/topicCards/episodes/characters/script/storyboard/promptPack),
                                       严格按设计真源 data.js 一比一移植 — 切项目=切整套。
```

**核心交互保真度**(对照设计源):
- 视觉令牌、6 阶段轨、双模式(AI 引导 + 模板)、数字人沉浸大图选择器、剧集切换器、撤销重做(⌘Z/⇧⌘Z 60 步)、分镜三布局(timeline 默认 + flow + grid)、单镜精修侧栏(slide-in-r 384px)、ShotPromptPeek 弹层、成片配方@图片N → 真实头像缩略图、一键连跑两阶段弹层、平台自有 ConfirmDialog 替原生 confirm、骨架屏(.skel)、追查号失败态、移动响应式 ≤860/≤720/≤560 三档断点。

**注意事项**:
- 后端契约不动:仍走 `POST /api/me/drama/scripts*` + `/episodes/generate`(v0.43)。6 阶段富数据先以 mock 演示;持久化由 `DramaScript.scenes[]` 承接(结构化扩展见 v0.47+ 规划)。
- 文案护栏:UI 不出 "视频大模型 / 渲染 / 引擎 / Token / Prompt 包 / ⌘K / CINEMATIC" 等工程词;`engine` `avatar/seedance` 字段仅内部用,UI 一律说"数字人出镜 / 特效镜·待开通"。
- 老路由(/cast、/scripts、/forge、/wardrobe、/incubator、/distribution、/finance、/settings)未改造,通过别名让其暖白化;`/cast` `/scripts` 顶部主线 banner 明确"跨项目素材"vs"项目内角色/剧本"分工,引导回 /projects。
- 验收:`pnpm typecheck` 全绿;playwright 7 批 30+ 张截图覆盖(含移动 390px 单列);`grep 'confirm\|alert\|prompt'` 仅注释命中;主线动线 dashboard→/projects→/projects/new→/projects/<id> 一气呵成。

### v0.47（2026-06-03）— admin 秘钥批次「核销 / 总量」对齐 + 全链路账号登录注册审计日志

修两件事：(1) admin「秘钥批次」页面 `b.activatedCount` 长期 denormalized 列与真实 keys 表 drift，
出现「秘钥数量 20 / 核销总量 110」类违反不变量的展示；(2) 五条登录 / 注册 / 改密链路未落 audit_log，
排查暴力枚举 / 多端入口 / 失败原因只能靠 slf4j 日志 grep。

**A. License batch 核销 / 总量 真实派生 + 自愈**

```
server : LicenseKeyRepository +countByBatchIdAndStatus(batchId, status)
       : LicenseBatchDto +fromDerived(batch, totalCount, activatedCount) —— int 安全截断
       : LicenseService.listBatches / findBatchById 全改走 toDtoWithDerivedCounts(b)：
       :   - long derivedTotal = keyRepo.countByBatchId(b.id);
       :   - long derivedActivated = keyRepo.countByBatchIdAndStatus(b.id, ACTIVATED);
       :   - drift 时 WARN 日志 + 回写存储列 + ACTIVE↔EXHAUSTED 状态机自愈
       :     （REVOKED / EXPIRED 是人工决策，保留不动）
       : LicenseService.revokeKey +@Transactional + 反向递减：key 状态 ACTIVATED 时
       :   batch.activatedCount -1，并 EXHAUSTED→ACTIVE 状态机回拨
admin  : 前端 page.tsx 无需改 —— UI 仍读 b.activatedCount / b.totalCount，但这两个值
       :   由 server toDtoWithDerivedCounts 用 keys 表派生，stat 顶部「累计发放点数」
       :   reduce(b.initialCreditGrant * b.activatedCount) 自然修正
```

**B. 账号登录 / 注册 / 改密 全链路审计日志（含 IP / UA / 错因）**

```
shared model :
  AuditLog +username(VARCHAR 128) / +errorCode(VARCHAR 64) 两列；+4 个索引
  （createdAt / action / userId / username）；JPA ddl-auto=update 自动加列；
  老 H2 / MySQL 双兼容。

server :
  AuditService +Actions 常量表（9 个动作）+ Actions.AUTH_ALL List
    动作命名 ：admin.login / admin.operator_login / admin.change_password /
              auth.sms.request_code / auth.sms.login / auth.sms.register /
              auth.password.login / auth.dev_login / auth.license.activate
  AuditService +recordAuth(action, result, userId, username, errorCode, detail, req)
    - 从 HttpServletRequest 抽 IP（X-Forwarded-For → X-Real-IP → remoteAddr）+ UA
    - 永不抛：写库失败 ERROR 日志后吞掉，不影响业务 401/403 真错返回
  AuditService +recordAuthSuccess / +recordAuthFailure 便捷封装
  AuditService +search(actions, userId, username, ipAddress, result, errorCode, since, until, pageable)
  AuditLogRepository +search 自定义 JPQL（IN + LIKE 前缀 + 时间窗）

  AuditLogDto +username / +errorCode 字段

  AdminAuditController GET /api/admin/audit-logs：
    +actions(CSV) / +scope(=auth-all 便捷预设) / +username / +ipAddress /
    +errorCode / +since / +until 参数；老 (userId/action/result) 三维度兼容保留

  下列控制器全部注入 AuditService 并落审计：
  - AdminAuthController.login + changePassword（多失败分支 + 成功）
  - AepOperatorAuthController.operatorLogin（5 失败分支 + 1 成功）
  - SmsAuthController.requestCode / verify / register（多 try/catch 包裹 + 成功）
  - PasswordAuthController.login（4 失败分支 + 1 成功）
  - DevAuthController.devLogin（2 失败分支 + 1 成功）
  - LicenseActivationController.activate（失败 try/catch 包裹 + 成功用 AepUserDto
    取 userId/username）

admin :
  types/audit.ts AuditLog +username / +errorCode；+AUTH_ACTION_LABEL / +AUTH_ACTION_KEYS 字典
  api/audit.ts +listAuthLogs(params) —— scope=auth-all 默认 + actions/username/ipAddress 等过滤
  /platform/auth-logs/page.tsx 新页：StatCard ×4（总数/成功/失败/独立IP）+ 多维过滤栏
    （搜索/动作Select/结果Select/账号前缀/IP前缀）+ 行表（时间/动作icon/账号/IP/结果/错因/详情/设备）
    + 行点开详情 Dialog
  nav.ts「消息与日志」组追加「账号登录日志」入口
  mocks/audit.ts 补 username/errorCode 字段 + 9 条登录注册类样本
```

**C. ECS 本机直接部署脚本（不走 SSH）**

之前体系是「开发机 build → ssh 推 ECS」（`deploy.sh` = `build-release.sh` + `deploy-release.sh`），
开发机网络抖 / GitHub Actions 不可用时没有快速兜底。新增 `infra/scripts/deploy-local.sh`：
ssh 进 ECS 后一行命令完成 build + 翻新 + restart + verify，与 `deploy-release.sh` **完全一致**
的落位规则 + 备份约定，但全程本机操作。

```
新文件 : infra/scripts/deploy-local.sh（约 220 行）
  · all / 单服务 / 多服务（逗号或空格分隔）
  · 复用 build-release.sh 产物 → 复用 deploy-release.sh 的 cp/install/tar -x/systemctl restart 逻辑
  · 备份保留：.__previous__-<RELEASE_ID> 目录按 mtime 排序，默认保留 2 份（--keep-previous=N 可调）
  · 选项：--no-build / --no-restart / --no-verify / --no-fonts / --release-id=<ID>
  · systemd 单元不存在时 WARN 并跳过 restart，便于首次部署落位文件后人工建 unit
  · 完成后自动调 verify.sh LOCAL_MODE=1

改动 : infra/scripts/verify.sh +LOCAL_MODE=1 分支
  · LOCAL_MODE=1 时跳过 DEPLOY_HOST 校验、HOST_REMOTE 默认 127.0.0.1
  · 新 remote_exec() 函数：LOCAL_MODE=1 直接 bash -s，否则走 ssh
  · 远端 check 脚本（systemd 状态 / API /healthz / nginx -t / 中文字体）零改动 1:1 复用

文档 : infra/README.md +§4.1.1「ECS 本机直接部署（无 SSH，v0.47+）」+ 目录速览补 deploy-local.sh
       .claude/skills/aliyun-deploy/SKILL.md +「ECS 本机直接部署」一节
```

**注意事项**：

- **与 ssh 推送路径并存**：`deploy.sh` / `deploy-release.sh` 行为不动；GitHub Actions
  工作流不动。`deploy-local.sh` 是新增的第三条路径，不替换任何东西。
- **落位规则一致**：jar 经 `install -m 0644`；web/admin tar 解到 `${target}.__next__${RELEASE_ID}` 后 mv，
  失败可保留旧目录便于排查。sau-service Docker build 用 `--build-arg INSTALL_REAL=1` 同 deploy-release.sh。
- **首次部署 systemd 不存在时 WARN 不抛**：脚本检 `systemctl list-unit-files` 命中再 restart，
  否则只翻文件 + 提示参考 `infra/systemd/*.example` 建 unit。
- **备份策略改进**：`deploy-release.sh` 老路径只保留 `.__previous__`（一份），新落位会立刻覆盖；
  `deploy-local.sh` 改用带 RELEASE_ID 后缀的目录，默认保留 2 份，回滚时可指定具体 release。
- **verify 失败只 WARN**：文件已落位 + systemctl restart 已执行，verify 失败常为公网 path
  暂未起来 / 中文字体未就绪等次要问题，不阻断部署完成态。运维仍可手动重跑 `LOCAL_MODE=1 ./verify.sh`。
- **未做**：(a) `deploy-local.sh` 集成到 GitHub Actions（actions runner 仍是开发机模式 + ssh 推）；
  (b) 自动检测 deploy.sh 误在 ECS 本机执行并友好提示走 deploy-local.sh；
  (c) 多 ECS 节点的本机并行部署（当前是单机假设）。

**D. OSS / CDN URL 签名（防流量盗刷）**

背景：v0.46 之前 `AliyunOssCdnUploader.publicUrlFor(key)` 只是裸拼 CDN URL
（`https://cdn.aibuzz.cn/<key>`），URL 永不过期 + 无鉴权 + 落 DB 后随 DTO 出 wire。
任一泄漏（爬虫 / 浏览器缓存 / CDN 域名扫描）→ 持续被 hot-link 刷流量，
**夜单 CDN/OSS 几千 RMB 流量账单不是危言耸听**。

```
server : CdnUploader.signedUrlFor(key, ttlSeconds) 默认方法（v0.47+；回退到 publicUrlFor）
       : AliyunOssCdnUploader 构造器 +signStrategy / +defaultTtlSeconds / +cdnAuthKey 三个新字段
       :   strategy=none：明文 URL（dev / 调试）
       :   strategy=oss ：OSS SDK generatePresignedUrl（HttpMethod.GET + expires），
       :                  URL host 自动从 -internal endpoint 修正为公网 endpoint
       :   strategy=cdn ：阿里云 CDN URL 鉴权 Type A
       :                  auth_key = expires + "-" + rand + "-" + uid + "-" + md5(URI-expires-rand-uid-PrivateKey)
       :                  签名串走 SecureRandom + lowercase MD5 hex
       :   启动时 strategy=cdn 但 cdn-auth-key 空 → fail-fast；strategy=none → 启动 WARN
       : 新 CdnUrlSigner service（@Service，注入 ObjectProvider<CdnUploader> 让 dev 无 OSS bean 时不挂）
       :   maybeSign(url) / maybeSign(url, ttl) —— 自动识别 URL 前缀是否属 OSS/CDN base，
       :   是 → 抽 key 调 uploader.signedUrlFor；否 → 原样返回（local / 第三方外链 / null 透传）
       :   http ↔ https 双 scheme 前缀都支持（防配 https base 后请求换 http 跳过签名）
       :   uploader 抛错 → 不抛只 WARN，原样返回（不影响业务 wire）
       :   NOOP 单例 = 老 test / seeder 不便注入 Spring bean 时回退
       : MixcutRenderJobDto.from(job, mapper, signer) 新重载 —— outputs[*].cdnUrl + cdnThumbnailUrl
       :   出 wire 前过 signer.maybeSign(...) 加时效签名；老 from(job, mapper) 委派到带 NOOP 的入口
       : MixcutJobService 构造器 +cdnUrlSigner；listForUser / getForUser / create / rerun /
       :   updateProgressForUser 4 处 from() 调用统一带签名

config : application.yml aep.cdn.signed-url.{strategy, ttl-seconds, cdn-auth-key}
       : infra/env/server.env.example +AEP_CDN_SIGNED_URL_STRATEGY=cdn / TTL=3600 / CDN_AUTH_KEY=...

docs   : infra/oss/README.md +§3.1「URL 鉴权 / 签名」详细配置 + 验证 + 注意事项
       : .claude/skills/aliyun-deploy/SKILL.md 同步签名配置项

tests  : CdnUrlSignerTest（8 测）：noop / passthrough / 抽 key / 老 URL 已带 query / http-https
       : 互换 scheme / uploader 异常不抛 / 自定义 TTL / Type A 签名串格式 regex
```

**注意事项**：

- **当前签名范围**：v0.47 先覆盖 `MixcutRenderOutput.cdnUrl / cdnThumbnailUrl`（高带宽视频成片）。
  后续待补：`MaterialVideoJob.videoUrl`（素材运营生成视频）、`AiAvatarAsset` 资产 URL、
  ForgeResult 视频 URL —— 注入 `CdnUrlSigner` 到对应 service + DTO from() 加 signer 参数即可。
- **DB 落的是原始 CDN URL，不带签名**：`AliyunOssCdnUploader.upload(...)` 仍调
  `publicUrlFor(key)` 写库；签名只在 DTO 出 wire 一刻生成，每次请求都是一个新签名。
  这样老前端缓存的 URL 过期前可继续访问，过期后用户刷新页面自然换新 URL。
- **生产首选 strategy=cdn**：节省一半带宽费（CDN 0.24 元/GB vs OSS 外网 0.5 元/GB），
  且流量经 CDN 加速节点 + HTTPS。需先在阿里云 CDN 控制台「访问控制 → URL 鉴权 → Type A」
  生成 PrivateKey 并填到 `AEP_CDN_SIGNED_URL_CDN_AUTH_KEY`。
- **strategy=oss 的 host 修正**：OSS SDK 用构造器传入的 endpoint（可能是 `-internal` 内网）
  做签名 URL 的 host —— 我们在 `rewritePublicEndpoint` 替换为公网 endpoint，保证浏览器可访问。
- **TTL 建议 3600 ~ 14400**：太短（< 600）H5 视频播放进度过半就 403；
  太长（> 86400）URL 泄漏窗口大，hot-link 攻击仍能持续刷一天流量。
- **未做**：(a) `oss / cdn` 两种策略可热切（重启 server 即可换，但运行时不能切；
  v0.48+ 候选）；(b) Aliyun CDN 鉴权的 KEY 轮换流程（主备 KEY 切换）；
  (c) 上传路径的 STS 临时签名（让浏览器直传 OSS，本仓暂保留 server-mediated 上传，
  无浏览器 PUT，server 自身 AK 不外暴）；
  (d) 按用户的上传速率 / 配额限制 —— 与盗刷不同，是另一类安全问题，v0.48+ 候选。

**注意事项**：

- **DTO 派生为权威**：admin UI 直读 `b.activatedCount / b.totalCount`，但这两个值在
  listBatches / findBatchById 入口已被 server 用 keys 表实时派生覆盖，
  **denormalized 列保留以兼容老下游逻辑**（如 EXHAUSTED 状态机），但 DTO 永远返回派生值，
  不再依赖列值正确。
- **状态机自愈范围有限**：自愈只在 ACTIVE ↔ EXHAUSTED 之间，REVOKED / EXPIRED 是运营
  人工决策必须保留。
- **revokeKey 反向递减**：v0.46 之前缺失，导致只增不减是 drift 主源之一；本期补齐，
  配合 DTO 派生形成双保险。
- **审计日志永不抛**：try/catch 吞 persistence 异常，登录失败的 401/403 业务返回不会
  被「记日志失败」二次覆盖（与 ErrorLogService 同款防御）。
- **IP 抽取链**：X-Forwarded-For (取首段) → X-Real-IP → remoteAddr，按反代部署环境
  兼容。**生产 Nginx / 阿里云 SLB 必须开 forward-ip header**，否则只能记到 LB 内网 IP。
- **失败时 userId 可能为空**：用户名 / 手机号未命中 user 表的失败仍要落 username，
  便于排查暴力枚举（同一手机号在多 IP 高频出现 → 风控告警）。
- **AdminAuditController 新参数兼容老调用**：旧 `?userId=&action=&result=` 三参不变；
  新维度任一非空时走 search 入口。
- **/api/admin/audit-logs 安全**：沿用 `/api/admin/**` 通用门禁（hasAnyRole
  SUPER_ADMIN, OPERATOR）。OPERATOR 也能看登录日志（属于运营职责）；如需收口为仅
  SUPER_ADMIN，加 `.requestMatchers("/api/admin/audit-logs/**").hasRole("SUPER_ADMIN")`
  排在通用 matcher 之前。
- **未做**：(a) 多 IP / 高频失败的自动锁定 + 风控告警（v0.48+）；(b) 审计日志按用户
  聚合的 dashboard（如「过去 24h 登录失败 Top10 账号」）；(c) 日志归档 / 冷热分层；
  (d) `/api/admin/audit-logs` 加 openapi schema（管理后台路径不进 contract gate）。

### v0.48（2026-06-04）— 混剪「实例 / 草稿」层（模版 → 实例 → 生成任务）

用户反馈：celebrity 混剪里选模版、填素材后，想改模版就把填的内容全丢了；且没有可反复
复用的配置落点。本版在**模版**与**生成任务**之间补一层持久化的「实例 / 草稿」（`MixcutDraft`）——
一份「针对某模版配好的素材绑定 + 扰动设置」，可保存、可继续编辑、可多次生成；从实例生成的
每个任务都带 `draft_id` 指回，实现「生成任务回溯到当时配置的实例」。仅 celebrity 子产品改动。

**核心设计**：

- **实例字段 = 任务快照子集**：`MixcutDraft` 刻意与 `MixcutRenderJob` 的快照列对齐
  （slot_bindings / canvas / slots / scenes / perturbation_overrides / sticker_pool /
  profile / variants / product_id），本质是「还没提交渲染的任务配置」。生成时原样灌进
  `MixcutJobService` 标准创建链路（扣费 / 派发），不另起渲染逻辑。
- **血缘单向**：`MixcutRenderJob +draftId`；`MixcutDraftService → MixcutJobService`（无环，
  job service 只注入 `MixcutDraftRepository` 做 best-effort 计数 bump）。重跑（rerun）出的
  任务也保留同一 `draftId`。
- **改模版不丢内容**：create 页「改模板（先存草稿）」按钮先 PUT 草稿再跳模板编辑；
  重开实例时按 `slot_id` reconcile —— 仍存在的 slot 恢复绑定，模板已删的 slot 收集成提示，
  `template_version` 变化给「模板已更新」横幅。
- **缺素材严格阻拦**：从实例生成复用 rerun 的 `collectMissingAssets` —— 引用的
  upload/library 素材已删 → 409 MISSING_ASSETS（`error.details.missing_assets[]`）。

```
server : 新实体 MixcutDraft（mixcut_draft 表，userId 隔离 + 快照列）+ MixcutDraftRepository
       : 新 MixcutDraftDto / MixcutDraftUpsertRequest；新 MixcutDraftService（CRUD + generate）
       : 新 MixcutDraftController → /api/mixcut/drafts（GET/POST + /{id} GET/PUT/DELETE + /{id}/generate POST）
       : MixcutRenderJob +draftId 列；MixcutRenderJobDto +draft_id；MixcutCreateJobRequest +draft_id
       : MixcutJobService 注入 MixcutDraftRepository；createInternal 落 draftId + bump generatedJobCount/lastGeneratedAt；
         +public collectMissingAssets(JsonNode)；rerun 透传原 job 的 draftId
       : MixcutJobSchemaMigration +mixcut_render_job.draft_id（老库兜底加列）
web-celebrity:
       : types.ts +MixcutDraft / +MixcutDraftUpsert；RenderJob +draft_id
       : api/mixcut.ts +listDrafts/getDraft/saveDraft/deleteDraft/generateFromDraft（USE_LOCAL 走 localStorage）
       : mocks/mixcut.ts +mockDrafts（2 条演示实例）
       : create/[id]/create-client.tsx —— ?draft_id 恢复填充态 + reconcile 提示；「保存草稿 / 更新草稿」+
         「改模板（先存草稿）」+ 未保存指示；生成时透传 draft_id（active 草稿有改动先自动存回）
       : 新页 /mixcut/drafts —— 草稿箱（继续编辑 / 直接生成 / 删除）
       : jobs/[id] 加「来自实例」徽章（深链回 create?draft_id 继续编辑）；layout 侧栏 +「草稿箱」+ 面包屑；
         mixcut 首页 +「草稿箱」入口
openapi: +/mixcut/drafts（get/post）+/mixcut/drafts/{draftId}（get/put/delete）+/mixcut/drafts/{draftId}/generate（post）
```

**注意事项**：

- **实例是 opt-in**：用户不点「保存草稿」就不产生实例，生成任务无 `draft_id`（与 v0.47 行为
  一致）。点了「保存草稿」/「改模板（先存草稿）」/ 从草稿箱生成才进入三层模型。
- **生成与实例一致**：create 页生成时若 active 草稿有未保存改动，先自动 PUT 回实例再建 job，
  保证「任务 → 实例」回溯到的就是这次生成所用的配置。
- **reconcile 是冻结快照 + 名称对齐**：实例存自己的快照，不随模版改动自动同步；重开时按
  `slot_id` 恢复兼容绑定，模板删掉的 slot 内容丢弃（提示），新增必填项显示为未填。
- **USE_LOCAL 直接生成不跑模拟器**：纯 mock 下草稿箱「直接生成」产出 queued 任务不会自动推进
  （模拟器只在 create 页 handleSubmit 里）；真后端由 worker 正常处理。
- **未做**：(a) 草稿箱的批量操作 / 归档（status 预留 archived）；(b) 实例命名编辑 UI（当前自动
  命名「{模版名} · 草稿」，可在保存载荷里带 name）；(c) 实例级权限分享；(d) admin 侧实例审计
  （实例是用户私有工作态，不进 admin）；(e) 自动草稿（每次编辑静默落库）—— 当前显式保存，避免
  污染草稿箱。

### v0.49（2026-06-04）— 统一文件存储门面 FileStorageService（上传/生成/大模型产出收口）

把全系统「上传 / 生成 / 大模型返回」的图片、视频、音频、模型等**文件存储收口到一个服务**。
背景：底层早有 `CdnUploader`（local/oss driver）+ `CdnUrlSigner`（签名）抽象，但只有 mixcut 成片 /
aiavatar / material video 走了它；**用户上传素材（MixcutAssetService）、celebrity 档案图
（AdminCelebrityUploadController）还是各自 `Files.copy` 裸写本地、各自拼 URL**，既不统一也是本地
盘无界增长源。本版加一个高层门面 `FileStorageService`，把这些「真·绕过」的写入收编进来。

```
server : 新 service/storage/FileStorageService（门面）：
       :   store(MultipartFile/byte[]) / storeExisting(Path) → StoredFile{key,url,signedUrl,localPath,bytes,mime}
       :   signedUrl(key) / delete(key) / openForRead(key)（本地有则用,否则下载到 read-cache 给 ffmpeg/python）
       :   统一 key 约定 <category>/<owner?>/<uuid>.<ext>；底层委托 CdnUploader + CdnUrlSigner（不重复造）
       : 新 config/FileStorageProperties（aep.storage.local-dir / public-url-base / signed-ttl / keep-local-copy）
       : 新 config/FileStorageWebConfig（无 CDN driver 时把 local-dir 挂 /static/files 兜底）
       : [收口] MixcutAssetService.upload —— 落本地的同时经门面推 OSS + 记 cdnKey（best-effort,失败保留本地）
       :   MixcutAsset +cdnKey 列 + schema 迁移；MixcutAssetDto +cdn_url(签名)/+cdn_key；Controller 注入 signer
       :   渲染仍读 localPath（不受影响）；素材库展示从此走 OSS/CDN（省 ECS 带宽 + 防盗刷）
       : [收口] AdminCelebrityUploadController（avatar/cover/...）—— 裸写本地 → 门面 store → OSS；
       :   返回**未签名稳定公开 URL**（会被持久化进档案字段长期复用,签名会过期）
web-celebrity : MixcutAsset +cdn_url/cdn_key；素材库视频缩略图优先 cdn_url（图片经 thumbnail_url 已自动走 CDN）
```

**注意事项**：

- **已在 CdnUploader 层的域不强迁门面**：material video / aiavatar / mixcut 成片本来就走共享
  `CdnUploader`+`CdnUrlSigner`（prod 已落 OSS），各有自己的 key 方案。把它们折进新门面属**纯
  cosmetic dedup + 会改 URL/key 方案**，无运行时验证不盲改；要做应在 dev 验证后逐个迁。
- **Forge 当前是 fake**（随机派 showreel 占位 URL,无真文件写入）；接真 AI 视频生成时直接用门面。
- **本地副本仍保留**（`keep-local-copy=true`）：渲染读 localPath、file_url 兜底需要。**磁盘真正释放**
  是后续步骤 —— 渲染输入改走 `openForRead(cdnKey)` 从 OSS 拉 + `keep-local-copy=false`（需 dev 验证
  签名 URL 在异步渲染时不过期：渲染时按 asset_id→cdnKey 现签,不存快照签名 URL）。
- **DB 真值统一存 key**（§4.7.4）：MixcutAsset.cdnKey 是真值,URL 出 wire 由 signer 派生;celebrity
  档案字段当前仍存 URL（未签名公开),要防盗刷需改存 cdnKey + 出 wire 派生（留作后续）。
- **无新 endpoint / openapi 变更**：门面是内部服务;MixcutAssetDto 仅加 wire 字段(加性,契约门不受影响)。
- **未做**：(a) material video / aiavatar / mixcut 成片折进门面（cosmetic,待 dev 验证）；
  (b) MixcutAsset preset/official 上传 + 商品外链登记的门面化（admin/seed/外链,低频）；
  (c) keep-local-copy=false 的纯 OSS-read 终态 + 渲染 openForRead 切换；(d) celebrity 档案改 key-only；
  (e) 按 owner 配额 / sha256 去重 / 图片转码 —— 门面已留扩展位,未实现。

### v0.50（2026-06-06）— web-aiavatar 落地为移动端「数字人资产平台」SPA（前端）

按上传的《数字人资产平台 — 数据模型与系统逻辑规格》+ Figma Make 移动端原型
《数字人资产平台-移动端-v4》落地 `apps/web-aiavatar`（此前 workspace / 根脚本已预留位置，
但 app 目录一直不存在）。**纯前端、mock 驱动、自包含**；不改 server / openapi / 契约门。

```
apps/web-aiavatar (Next 16.2.6 / React 19 / TypeScript / pnpm, port 3013):
  app/layout.tsx + app/page.tsx              # 渲染客户端 <App />；字体走 React19 提升的 <link>（不用 next/font）
  src/styles/globals.css                     # 设计令牌 + 真实 H5 应用外层(app-root,安全区) + V4「清爽」单色青皮肤
  src/proto/data.ts                          # ★ 类型契约真源：Avatar/Look/Derivative/License/Job/BuiltinVoice(7)/
                                             #   Account/Application + 8 态状态机 + 5 步创建链路 + 6 类衍生 + 5 张标准图集
  src/proto/api.ts                           # ★ 前端 API 契约层(唯一数据出入口)：9 命名空间 + USE_MOCK 分支 + useApi + seed
  src/proto/{icons,portrait,ui,shell,toast}  # 图标库 / 占位图 / UI 原语 / AppShell+导航+底部Tab / Toast 桥接
  src/proto/app.tsx                          # ★ 根：Tab(home/library/apps/me) + 覆盖页栈 + 创建 sheet + #hash 深链
  src/proto/screen-*.tsx                     # 18 屏（home/library/avatar/voiceapps/lictaskme/more/real/chain/aicreate/voicepick）
```

**关键决策**（详见 [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md)）：

- **忠实移植、不绑共享层**：原型自带 HeyGen 风设计系统（纯白 + 单色青 `#12B3DE`），与 `@ai-star-eco/ui`
  的 shadcn 体系完全不同，故 app 自包含（依赖仅 next/react），屏幕层保留原型的
  `React.createElement` + 内联样式写法（脚本仅做 `window.X` 全局 → ES module 的机械转换）。
- **去原型化 = 真实 H5（非手机壳预览）**：移除 iPhone 外框 / 伪「9:41」状态栏 / 伪微信胶囊 / 伪 home 指示条 /
  桌面屏幕索引侧栏；`AppShell`(`.app-root`) `position:fixed` 铺满视口 + `env(safe-area-inset-*)` 真实安全区，
  桌面端居中为一列内容。系统状态栏/手势条交给系统呈现。
- **所有数据走 `src/proto/api.ts`**：9 个命名空间（Avatar/Voice/Job/License/Capture/Account/App/Scene/Template）
  对齐规格 §4，每个带 `USE_MOCK` 分支（mock 读 data.ts / live `apiFetch('/api/v1/*')` 解包响应壳）+ `useApi` hook
  + 同步 `seed`（mock 首帧无闪烁）。屏幕层不再 import `./data`；切真后端只需 `NEXT_PUBLIC_USE_MOCK=0`，屏幕零改动。
- **tsconfig 关闭 strict**：屏幕层是松类型 createElement；类型安全集中在 `src/proto/data.ts` 的 interface。
  `pnpm typecheck` / `pnpm build` 仍是门（已实测全绿，`/` 静态预渲染，dev `GET / 200` 渲染正常）。
- **与既有 server `aiavatar_*` 领域（v0.45）解耦**：那是「形象资产管理中心（桌面 / `/library` / 深色琥珀 /
  `real_clone`,`ai_original` / 4 张标准图 / 13 能力）」的另一种解释；本 app 是上传规格的「数字人资产平台
  （移动 / `real`,`ai` / 8 态中文状态机 / 5 张标准图 / 6 类衍生 / 7 款内置音色）」。首版不强行对接，
  接后端时以 `src/proto/data.ts` + `api.ts` 的 REST 面为对齐基准。

**注意**：v0.45 章节描述的 server-backed 桌面 AiAvatar 中心从未在本仓库副本落地为前端（仅 server 领域存在）；
本节是 web-aiavatar 的**首个**实际前端落地，主入口为 `/`（真实全屏 H5 移动应用），非 `/library`。

### v0.51（2026-06-06）— 数字人资产平台全栈打通（dap 领域 + Agnes 多模态 + 删除 v0.45 旧域）

web-aiavatar 从「纯前端 mock 原型」升级为完整产品：新 server 领域 `com.aistareco.aep.dap.*`
（表前缀 **`dap_`**，REST 面 **`/api/v1/**`** 精确对齐 `src/proto/api.ts` 契约），账户复用
`aep_users` + 钱包/不可变账本；大模型走 **Agnes AI**（apihub.agnes-ai.com，文本/图片/视频全免费 API）。
经用户确认，**v0.45 旧 aiavatar 领域整体删除**（77 文件 + 4 测试 + openapi 33 路径 +
`packages/types/src/ai-avatar.ts`；`V6__drop_legacy_aiavatar_tables` 幂等清表）。

```
server : com.aistareco.aep.dap.* —— 9 实体（dap_avatar / dap_avatar_version / dap_look /
       :   dap_derivative / dap_license / dap_job / dap_voice / dap_capture / dap_photo）
       : AgnesClient（chat=agnes-2.0-flash / images=agnes-image-2.1-flash，i2i 走 extra_body.image，
       :   本地文件转 dataURI、OSS 走签名 URL / videos=agnes-video-v2.0 异步 submit+poll）
       : DapJobRunner @Async("dapJobExecutor")：形象生成（chat 人设 JSON + 4 变体图）/ 真人复刻
       :   （照片或捕获帧 i2i）/ 自然语言迭代 / 几何精调（参数→英文编辑指令）/ 造型（场景库 promptEn）
       :   / 六类衍生（atlas 5 机位回填 shotKeys、expr 4、scene 2、ward 2、d3 4 角度诚实占位、
       :   video=Agnes 异步出 mp4 落库）；未配 AGNES_API_KEY 全链路降级本地占位产物 + avatar.mock 标记
       : 扣费：CreditService hold→commit/release 三段式（referenceId=jobId:rN，重试独立冻结）；
       :   月度赠送 1500 点幂等发放（LedgerEntry referenceId=userId:yyyyMM）；价格表 aep.dap.pricing.*
       : 文件一律走 FileStorageService（§4.7：DB 存 key，URL 出 wire 派生）；存储统计按 bytes 列分类汇总
       : 真人捕获：footage 上传 → ffmpeg 抽帧（best-effort）→ verify 自动登记 DapLicense + HTML 凭证下载
       : AepSecurityConfig：/api/v1/** authenticated（删 /api/aiavatar/* 两条）；principal=userId
web    : api.ts 重写：auth（token/localStorage + 401 全局事件）+ AuthApi（sms/dev-login）+ apiUpload
       :   + awaitJob 轮询 + mock 任务模拟器（USE_MOCK=1 全流程可观察推进）
       : 新 screen-login（手机验证码 / 注册（验证码+激活码）/ dev 体验账号三 tab）；app.tsx 登录门
       : 创建链路全接真：AI 四变体挑选 / 上传照片复刻（真实文件选择）/ 真人捕获（真实 getUserMedia
       :   + MediaRecorder 录制，失败引导上传）/ 5 步向导（人设→生成→迭代/精调→图集定稿→衍生）
       : 详情四 tab 真数据（图集 / 衍生生成+重生成 / 版本时间线 / 授权凭证下载）；造型档案轮询；
       :   声音克隆真麦克风 + 采样回放试听；任务中心真轮询 + 重试/取消；Portrait 支持真实图片
       : next.config +/cdn /static rewrites；data.ts Avatar +imageUrl/variantImages/shotImages/voiceName
工具   : scripts/dev-fake-agnes-server.mjs（零依赖 fake Agnes：chat 人设 JSON / 真 PNG 程序化生成 /
       :   异步视频任务内嵌微型真 mp4 —— 无外网/无 key 全链路联调）
       : scripts/dap-verify.sh + scripts/dap-e2e.py（一键：编译→起 server（H2/mysql）→ 30+ 步 API
       :   E2E（登录/创建/生成/迭代/图集/授权/声音/任务/越权负例/扣费对账，真实下载产物字节）→
       :   前端 typecheck；日志落 .dap-verify/，PROFILE=mysql / AGNES=real|fake|none / VIDEO=1 开关）
```

**注意事项**：

- **Agnes key 不入库不入 git**：`AGNES_API_KEY` 环境变量注入（dap-verify.sh 会自动从 ~/dev/Agnes.md 提取）；
  未配置时生成链路降级为占位产物（mock=true，前端 MOCK 角标），不阻断。
- **i2i 身份输入**：公网 URL（OSS/CDN 签名地址）直接给 Agnes；相对路径或 localhost/127.0.0.1
  地址（本地 fake-CDN）对 Agnes 云端不可达 → 自动转 base64 dataURI。多照片复刻取前 3 张。
  真实 Agnes 全链路在生产以 OSS 公网 URL 为正路；本地联调靠 dataURI 兜底即可跑通。
- **mysql profile 本地联调必须 `AEP_CDN_DRIVER=local`**（application-mysql.yml 默认 oss，无密钥会启动失败）；
  dap-verify.sh 已内置。`createDatabaseIfNotExist=true` 兜底建库。
- **取消语义**：cancel 置 cancelRequested，runner 在阶段检查点感知后落 failed+「已取消」+释放冻结；
  wire 状态保持 running|done|failed 三态。
- **诚实降级**：3D 模型 = 4 角度预览图（GLB 导出排期中，UI 明示）；声音克隆 = 原始采样存档/回放
  （TTS 合成上线后启用，UI 明示）；内置音色试听返回说明文案。
- **未做**：(a) Agnes 多图视频/关键帧模式；(b) 充值在线支付（UI 引导联系平台）；(c) 公开数字人
  复制到我的名录；(d) 注册自助开通（沿用平台激活码双因素）；(e) 多实例 job 恢复 watchdog（单实例假设）。

**v0.51 修订（创建链路简化 + prompt/端点后台可配 + Agnes 可观测）**：

1. **创建向导 5→3 步**：`CHAIN` 砍掉「出图定稿 / 衍生」两步（source → proof → adjust）。挑选 +
   调整后底部直接「完成创建」→ `POST /avatars/{id}/finalize {archive:true}`（templateId /
   confirmedShots 不再随向导传，server 本就 null-safe）。标准图集与六类衍生收口到资产详情
   tab（原有入口保留）。续作落位：pending/finalized/deriving → adjust。
2. **图集 tab 不再伪装 5 角度**：`MAtlas` 只有定妆主图（无 shotImages）时展示单张「定妆形象」+
   引导生成按钮；5 机位网格仅在真实 shotKeys 存在时渲染。配套 dap.image_* prompt 全部加
   「one single view / no character sheet」约束，防止模型出多视图拼图。
3. **dap prompt 全点位后台可配**：10 个 promptKey（dap.persona / dap.translate_edit /
   dap.image_{generate,clone,iterate,warp,look,atlas,deriv} / dap.video_orbit）入
   `PromptService.KNOWN_KEYS` + `resources/prompts/material/dap.*.md` 基线（seeder 缺行才插）；
   `DapJobRunner` 全部硬编 prompt 改 `prompts.resolve(key)` + `fill(vars)`；admin
   「Prompt 管理」页自动列出可改。
4. **dap 模型接入点后台可配**：`AiModelPurpose` +DAP_PERSONA/DAP_IMAGE/DAP_VIDEO；`AgnesClient`
   每类调用先 `resolveEndpoint(purpose)`（admin「AI 模型与 Key + AI 应用绑定」），用端点
   baseUrl+apiKey+model 覆盖，未绑定回退 env AGNES_API_KEY；`joinUrl` 兼容端点 baseUrl 带 /
   不带 `/v1`。
5. **Agnes 调用全量可 debug**：`[agnes] call start/ok/http-error/exception` 行带 request=
   （prompt 截 400、dataURI 只打 `data:image/png;base64 len=N`、不打 api key）+ response=
   （截 600）+ source=endpoint:xx|env + attempt；IOException 自动重试 1 次（1.2s backoff，
   对 `EOF reached while reading` 类瞬断有效）。
6. **dataURI 上行压缩**：身份图 >300KB 时缩到宽 768 JPEG q0.82（PNG alpha 铺白底）再 base64，
   显著缓解大请求体导致的 EOF/超时；压缩失败回退原图。
7. **数字人回收站（软删 + 30 天自动清理）**：`DELETE /v1/avatars/{id}` 软删（deletedAt，
   顺带 cancelRequested 该资产 queued/running 任务）→ `GET /v1/avatars/trash`（含 daysLeft/purgeAt）
   → `POST /{id}/restore` 恢复 / `DELETE /{id}/purge` 立即彻底删除（仅回收站内资产，防误触）。
   `DapTrashCleanupScheduler` 每日 03:50 物理清理超期行（`aep.dap.trash-retention-days` 默认 30）：
   删全部关联行（versions/looks/derivatives/photos/captures/licenses/jobs）+ best-effort 删存储文件；
   LedgerEntry 账本不动（审计真值）。前端：详情 header 删除入口（Confirm 二次确认）+
   「我的 → 回收站」覆盖页（恢复 / 彻底删除 / 剩余天数）；ui.tsx 新增共享 `Confirm` 原语。
   注意：账户页 creditsUsed=sumCost(dap_job)，彻底删除会连带删 job 行 → 当月「已用」统计随之减少（账本余额不受影响）。
8. **prompt 真值在 DB**（重申，与 v0.40 机制一致）：`prompt_template` 表是运行时真源
   （resolve 顺序 DB → resources/.md → 代码兜底）；`.md` 只是首启 seed 基线 + git 留底。
   admin「Prompt 管理」改的就是 DB 行（version+1，seeder 永不覆盖）。
9. **生产禁占位生成**：`aep.dap.allow-placeholder`（dev 默认 true / mysql 生产默认 false）。
   未配置生成引擎（AGNES_API_KEY / admin DAP_* 端点绑定）且不允许占位时，
   `DapJobService.submit/retry` 在扣费前直接 503 `DAP_ENGINE_NOT_CONFIGURED`——
   不建任务、不扣费、不产出灰底剪影占位图。dap-verify.sh `AGNES=none` 联调路径
   显式 export `AEP_DAP_ALLOW_PLACEHOLDER=true` 保持可用。

### v0.52（2026-06-07）— web-aiavatar 精调美颜端上化（确定性真实生效）

几何精调从「参数→英文指令→Agnes i2i 整图重绘」（不可控/漂移身份/无预览）改为**端上确定性美颜**：
浏览器内 MediaPipe Face Landmarker（478 关键点，WASM，Apache-2.0）+ WebGL 位移场液化 + 磨皮美白 +
滤镜，拖动滑杆实时生效，「应用」时全分辨率导出回传落库。方案调研见 `docs/FACE_BEAUTY_RESEARCH.md`
（阿里云 viapi 人脸美型已下架；Face++ 0.1 元/次可作备选；选定端上方案：零成本/实时/保身份）。

```
web-aiavatar : 新 src/proto/beauty/{landmarks,engine,presets}.ts + studio.tsx（精调工作台：
             :   精调 5 滑杆 / 一键美颜三档+磨皮美白 / 7 滤镜 / 按住对比 / 应用上传）
             : screen-chain step3：「精确精调」→ BeautyStudio；「自然语言迭代」更名「AI 重绘迭代」
             : api.ts +AvatarApi.imageBlob（同源取图）+applyRefine（multipart 成品回传）；mock 全程可演示
             : public/mediapipe/（~25MB 自托管 wasm+模型，离线/国内可用）+ scripts/fetch-mediapipe-assets.sh
server       : DapAvatarController +GET /api/v1/avatars/{id}/image（定妆图同源流式输出，解 CDN 跨域
             :   canvas 污染）+POST /api/v1/avatars/{id}/refine-apply（multipart file+params+note）
             : DapWorkflowService.refineApply：FileStorageService 落图 → 切定妆图 → addVersion("refine")
             : DapJobService.recordLocalDone：登记 done 作业（type=refine_local, mode=local, cost=0——
             :   端上处理无引擎成本，不扣积分，不要求 Agnes 已配置）
             : /avatars/{id}/warp（Agnes i2i）保留 legacy，前端不再调用
openapi      : +/v1/avatars/{id}/image (get) +/v1/avatars/{id}/refine-apply (post)
```

**注意事项**：

- **不是生成式**：精调结果像素级保身份、同参数可复算；§8.0 静默降级规则不涉及（无降级占位概念，
  WebGL 不可用时 UI 明示「不支持」，不产假图）。
- **关键点资产加载链**：`/mediapipe`（自托管）→ jsDelivr CDN（`NEXT_PUBLIC_MP_ASSETS_BASE` 可覆盖）；
  检测失败 → 标准构图近似锚点（UI 角标「近似调整」），流程不断。
- **取图必须走 `/avatars/{id}/image` 同源端点**，不要让画布直接 `<img src=签名CDN URL>` 再导出
  （canvas 跨域污染）。生产 CDN 无需为此配 CORS。
- **未做**：资产详情页独立精调入口（详情「调整形象」本就跳 chain adjust，已覆盖）；美颜参数
  服务端复算（beauty-service，研究文档 P1）；视频帧美颜；Agnes「AI 精修」独立按钮（迭代已覆盖语义编辑）。

**v0.52 修订（衍生生成可自定义 + 视频任务真实状态回显）**：

1. **衍生不再一键抽卡**：详情「标准图集 / 衍生资产」的生成入口先弹**生成配置 sheet**
   （`DerivConfigSheet`）：expr/scene/ward 预设条目多选（≤6，每项一张图）、video 运镜方式
   单选（环绕/推近/拉远/摇移）、d3 渲染风格单选、atlas 美化模板单选；全类型「补充描述」
   textarea（中文自动经 dap.translate_edit 翻译）+「查看将使用的提示词」透出实际 prompt。
   预设数据在 `data.ts`（DERIV_PRESETS / D3_STYLES / VIDEO_MOTIONS / DERIV_DEFAULT_PICKS）。
2. **契约**：`POST /v1/avatars/{id}/derivatives` 请求体 +`options{items[{label,prompt}]≤6,
   extraPrompt, motion}` + `templateId`（atlas）；server `DapJobRunner.runDerive` 消费
   （items 替换默认配方；extraPrompt 追加到每张图/视频；中文 prompt 自动翻译，含 CJK 检测）。
3. **视频任务云端状态回显**：`AgnesClient.VideoTask +progress(0-100，兼容 0-1 形态)`；
   awaitVideo 回调改收完整 VideoTask；runner 把云端真实态写进 job —— queued →
   「云端排队中…」/ in_progress → 「云端渲染中 · N%」（pct 18+0.65×真实进度），
   前端任务卡 / 衍生行直接显示 eta 文本。轮询日志带 progress；`operation=null` 修为
   video-status。
4. 走查：walk2 +3 断言（配置 sheet / prompt 透出 / 配置后生成）；walk3 精调断言适配
   v0.52 端上美颜改名（jsdom 无 canvas 实现 → 断言工作台挂载）。合计 82 断言全绿。

### v0.53（2026-06-07）— 秘钥按子应用拆分（批次 platforms + 追加激活）+ aiavatar 纳入平台门禁

秘钥从「全站统一」拆为「全站可用 / 指定子应用可用」：批次新增 platforms 维度（如「仅 aiavatar · 发 1000 积分」），
激活按批次授权平台；aiavatar 正式加入平台全集（PlatformSupport.ALL 3 → 4）并给 web-aiavatar 上平台门禁；
新增「已登录账号追加激活」端点 —— 老账号买新子应用秘钥不用换号。积分仍是**单一钱包**（批次只决定发放额度，
不分桶；扣费链路零改动）。

```
server : LicenseBatch +platforms（CSV，null/空 = 全站可用）；LicenseBatchDto +platforms（List 出 wire）
       : PlatformSupport +AIAVATAR；ALL = music/drama/celebrity/aiavatar
       : LicenseService.createBatch 接收 platforms（数组或 CSV，仅保留已知平台）
       : LicenseActivationService 抽 requireActivatableKey（注册/追加共用校验）；
       :   resolveGrantedPlatforms：批次 platforms 非空 → 按批次授权（优先于 dev-grant-all）；
       :   空（全站秘钥）→ 沿用注册来源策略
       : +activateForExistingUser(userId, code)：合并平台（全站秘钥→升全平台；指定→并集）+
       :   追加发放积分（wallet.licenseBalance + LedgerEntry LICENSE_GRANT，遵守 §4.2）+
       :   key 核销 + 老批次幂等补 Membership
       : 新 MeLicenseController POST /api/me/license/activate（authenticated；复用
       :   auth.license.activate 审计动作，detail 标「追加激活」，admin 日志字典零新增）
       : 新 PlatformsAiavatarMigrationSeeder(@Order 52)：platforms='music,drama,celebrity'
       :   （v0.43 时代 dev-grant-all 写的「老全集」）→ NULL（= 新全集含 aiavatar），防误锁；
       :   显式单/双平台收窄授权的行不动
types  : SubProduct +"aiavatar"；ALL_SUB_PRODUCTS/SUB_PRODUCT_LABEL_ZH 同步；
       : packages/types/license.ts LicenseBatch 补 tier/sellingChannelId/platforms（修审计 P1 drift）
api-client : AuthApi +activateAdditionalLicense(code) → POST /me/license/activate
landing: PlatformAccessDenied 内置「输入激活码开通」表单（成功后 refresh() 拦截屏自动消失）；
       :   music/drama/celebrity 三端 workspace 布局零改动自动获得该入口
admin  : types/account.ts +SubProduct/ALL_SUB_PRODUCTS/SUB_PRODUCT_LABEL_ZH + AepUser.platforms；
       : types/license.ts LicenseBatch +platforms；api/licenses.ts CreateBatchInput +platforms
       : /platform/licenses：批次表 +「适用范围」列（全站/子应用徽章）；CreateBatchDialog
       :   +子应用多选 chip + 自定义单包点数（覆盖等级默认，支持「仅 aiavatar 发 1000」类批次）
web-aiavatar : AuthApi.smsRegister 默认透传 platform=aiavatar；+me()/+activateLicense(code)
       : app.tsx 登录后拉 /api/me 校验 platforms 含 aiavatar；未开通 → MPlatformGate 拦截屏
       :   （激活码追加开通 / 退出换号）；me 拉取失败宽松放行（防网络抖动误锁）
openapi: +/me/license/activate (post)
```

**注意事项**：

- **积分模型不变**：仍是单一钱包 + 不可变账本；「按 app 区分发放」= 不同批次（绑定不同子应用）配
  不同 initialCreditGrant，不是按 app 分桶。要做分桶钱包需另立大版本（动 Wallet/LedgerEntry/CreditService）。
- **优先级**：批次 platforms 非空 > dev-grant-all > 注册来源。开发态建「仅 aiavatar」批次后，
  用它注册的账号即使 dev-grant-all=true 也只开 aiavatar —— 这是预期行为（便于本地验证门禁）。
- **历史账号迁移**：恰好等于老全集 "music,drama,celebrity" 的行被视为「全平台」语义升级为 NULL；
  该串是 v0.43~v0.52 dev-grant-all 唯一产出形态（toCsv 保 ALL 顺序），不会误伤真实收窄授权。
- **追加激活语义**：全站秘钥 → user.platforms 置 NULL（全平台）；指定子应用秘钥 → 并集；
  用户原本已是全平台（空配置）→ 保持。每把 key 仍一次性核销（ACTIVATED 后不可复用）。
- **审计**：追加激活复用 `auth.license.activate` 动作（detail 前缀「追加激活」），按 userId 可查。
- **未做**：(a) 按 app 分桶的积分账户；(c) 批次 platforms 的事后编辑（建批后不可改，防已售秘钥语义漂移）。

**v0.53 第二批（同日）— 三端对齐审计遗留全量治理**（详见 [`docs/ADMIN_ALIGNMENT_AUDIT.md`](docs/ADMIN_ALIGNMENT_AUDIT.md)，10 项发现全部处置）：

```
server : AdminAepUsersController +PATCH /{id}/platforms（SUPER_ADMIN；空/null = 全平台）
       : LicenseService +KNOWN_TIERS 白名单（trial/basic/standard/premium/annual_pro/city_agent；
       :   createBatch 入参校验，之前自由 string）—— tier 契约的唯一真源
       : 新 dap/service/DapPricingService —— dap 动作单价后台化：admin 动作单价表 dap.* 12 行
       :   （>0 覆盖）优先，aep.dap.pricing.* env 默认价 fallback；读失败回默认价不阻断业务。
       :   刻意不把 dap.* 写进 CelebrityActionPricingService 默认表（否则常量压过 env 自定义）
       : DapJobService.priceOf / DapVoiceService.clone / DapAccountService.account 三处接线
admin  : /celebrity/operators +「平台访问」列 + PlatformsDialog（chip 多选；不勾选 = 全平台）
       : api/aep-users.ts +updatePlatforms
       : /celebrity/engine-pricing 动作单价表分两组：明星带货/素材运营 5 行 + 数字人平台 dap 12 行
       :   （dap 行 0 = 走部署默认价；修改约 1min 内生效 —— action-pricing 缓存 TTL）
       : /platform/prompts KEY_LABEL 补全 16 keys（dap.*/appearance.forge/drama.script_draft 等）
       : types/selling-channel.ts +SellingChannelUpsertInput 镜像；api 入参改用（弃 Partial<SellingChannel>）
openapi: +/admin/aep-users/{id}/platforms；+/admin/license-batches*（7 paths）+ LicenseBatch/
       :   LicenseBatchStatus schema
核实   : RechargePackage 三方字段一致（admin 多 active? 为软删专属字段），无需改动
```

### v0.54（2026-06-07）— dap 大模型统一 server 端 admin 管理（删 Agnes env 兜底 + 改名 DapMultimodalClient）

数字人资产平台（dap）的多模态出口此前叫 `AgnesClient` 且保留 `AGNES_API_KEY` / `aep.dap.agnes.*`
env 作为「admin 端点未绑定时的运行时兜底」。这与「大模型统一 server 端 admin 管理」原则冲突
（配置散落 env + 品牌耦合）。本版彻底收口：运行时只读后台「AI 应用绑定」端点，无 env 兜底；
类改名 `DapMultimodalClient`；dev/联调用一个 dev-only 种子器把端点种进 admin 表，脚本不再注入 AGNES env。

```
server : AgnesClient → DapMultimodalClient（AgnesException → DapModelException，
       :   错误码 AGNES_* → DAP_MODEL_*，日志 [agnes] → [dap-ai]）；删 resolveTarget 的 env 兜底分支
       :   —— 端点缺失/key 空/model 空一律 return null（不再回退 props.getAgnes()）
       : DapProperties 删 Agnes 内部类；加 Http{timeoutSeconds} / Video{poll,maxWait} / DevSeed{enabled,
       :   baseUrl,apiKey,chat/image/videoModel}（client 改读 props.getHttp()/getVideo()）
       : 新 DapDevEndpointSeeder（@ConditionalOnProperty aep.dap.dev-seed.enabled，@Order 57）：
       :   开机 upsert dev-dap-{chat,image,video} 端点 + 绑定 DAP_PERSONA/DAP_IMAGE/DAP_VIDEO；
       :   端点用 dev 自有 id（每次刷新 baseUrl/key/model，便于 fake↔real 切换），绑定仅在缺失时新增
       :   （绝不覆盖运营已配）；生产默认 enabled=false（不跑），运行时仍只读 admin 端点
       : DapJobRunner/DapJobService/DapWorkflowService 注入改名 + 引擎标签去品牌
       :   （「Agnes Image 2.1」→「云端图像引擎」/「Agnes Video 2.0」→「云端视频引擎」）
       : application.yml aep.dap.agnes.* → aep.dap.http.* / aep.dap.video.* / aep.dap.dev-seed.*
config : infra/env/server.env.example 删 AGNES_*（改为「后台为 DAP_* 绑定端点」说明）
scripts: dev-fake-agnes-server.mjs → dev-fake-multimodal-server.mjs（去品牌，FAKE_MULTIMODAL_PORT）；
       :   dap-dev.sh / dap-verify.sh 改设 aep.dap.dev-seed.* env（fake→本地多模态；real→Agnes+真 key），
       :   不再 export AGNES_BASE_URL/AGNES_API_KEY 给 server；dap-e2e.py 不变（AGNES 仅作超时档位）
```

**注意事项**：

- **运行时零 env 依赖**：`DapMultimodalClient.isConfigured()` 只看 `hasEndpointFor(DAP_IMAGE/DAP_PERSONA)`；
  生产必须在后台「AI 模型与 Key + AI 应用绑定」为 DAP_PERSONA/DAP_IMAGE/DAP_VIDEO 三个用途各绑一个端点。
  未绑定 + `allow-placeholder=false`（mysql 默认）→ 提交直接 503 `DAP_ENGINE_NOT_CONFIGURED`（不扣费），
  符合 §8.0「生产禁静默降级」。
- **dev-seed 不是 env 兜底**：它在开机时把配置**写进 admin 表**（与运营在 UI 配端点等价），运行时路径仍统一只读
  admin 端点。仅 `aep.dap.dev-seed.enabled=true` 时跑（dev/脚本显式开），生产默认关。
- **fake↔real 切换**：dev-dap-* 端点每次开机 upsert（刷 baseUrl/key/model），同一持久库切换即时生效；
  绑定仅缺失时新增，不会抢运营已绑的用途。
- **持久库联调注意**：`AGNES=none`（测占位）需 isConfigured()=false，但持久库上若前次已绑过 DAP 端点则仍 true →
  测占位路径建议用 H2（dev profile 每次可控）或先清绑定。
- **未做**：(a) admin UI 给 dap-dev/verify 一键写端点（当前靠 dev-seed env）；(b) dev-seed 多端点共享一个
  baseUrl 时合并为单端点（现 3 端点便于 real 三类不同 model id）；(c) DapMultimodalClient 接 AiModelInvocationService
  统一网关（dap 走自有多模态协议含 image/video，与通用 chat 网关形态不同，暂保持独立出口）。

### v0.55（2026-06-07）— web-celebrity 运营内嵌管理「明星」+「混剪工厂模板」

把 v0.31 的「运营内嵌管理」模式（`operatorRole` 解锁写入口，写操作走 `/api/admin/**`，server
`hasAnyRole(SUPER_ADMIN, OPERATOR)` 兜底）从**商品库**扩展到 web-celebrity 的**明星**与**混剪工厂模板**。
角色判定统一抽到 `apps/web-celebrity/src/lib/operator-role.ts` 的 `canUseOperatorTools(role)`，
并回填到既有所有 `!!user?.operatorRole` 判断点（商品库 / 商品详情 / 素材提卖点 / 视频库删除等）。

```
server : MixcutTemplateService +deleteFactory(templateId)（factory scope 物理删除）
       : 新 AdminMixcutTemplateController → /api/admin/mixcut/templates/{templateId}
       :   PUT → upsertFactory（就地写工厂模板，全员可见）/ DELETE → deleteFactory
       :   落 /api/admin/** → AepSecurityConfig hasAnyRole(SUPER_ADMIN, OPERATOR) 自动保护（不改安全配置）
       :   明星 CRUD 复用既有 AdminCelebrityController（/api/admin/celebrity/stars[/{id}] + /uploads，无后端改动）
web-celebrity:
       : lib/operator-role.ts 新建 canUseOperatorTools（"operator" | "super_admin" → true）；全仓 gating 改走它
       : api/celebrity-zone.ts +createStar/updateStar/deleteStar/uploadCelebrityImage（URL → /admin/celebrity/*）
       : components/celebrity-zone/StarFormDialog.tsx（移植自 admin，@ai-star-eco/ui 原语 + 图片上传）
       : CelebrityMarket（运营「新增明星」+ 删除确认）/ CelebrityStarCard（封面左上「编辑/删除」覆盖按钮，
       :   阻断 Link 跳转）/ CelebrityStarDetail（header「编辑/删除」）；market & star 详情页传 onChanged 重载
       : api/mixcut.ts +saveFactoryTemplate/deleteFactoryTemplate（→ /admin/mixcut/templates）；
       :   USE_LOCAL 用 DELETED_FACTORY_TEMPLATES_KEY（localStorage 已删 id 集合）模拟「删了全员看不到」，
       :   listTemplates/getTemplate/mergeWithMockFallback 过滤之（含 REAL_BACKEND 删除后回写，防 mock fallback 复活）
       : mixcut/templates 列表页 + template-detail-client：运营写=工厂写（saveFactoryTemplate）、可删工厂模板；
       :   模板新建/编辑/删除入口统一 canManageTemplates 门控（普通用户只浏览 + 用模板创建任务）
openapi: +/admin/mixcut/templates/{templateId}（put/delete 骨架）+/admin/celebrity/uploads（post，补登既有端点）
```

**注意事项**：

- **明星无需改后端**：`/api/admin/celebrity/stars[/{id}]` + `/uploads` 早已存在且对 OPERATOR 开放（admin 后台在用）。
  web-celebrity 只是新增前端写入口 + API client；越权用户绕 UI 直接调仍被 server 403。
- **运营写 = 工厂写**：运营在 web-celebrity 管理的是「共享池」—— 编辑/删除工厂模板对全员生效（不再 fork 个人副本）。
  普通用户（STUDIO）的模板写入口关闭（`wantEdit && canManageTemplates`），仅浏览模板 + 用模板创建任务。
- **contract gate 不扫 web-celebrity**：`apps/web/scripts/check-api-contract.mjs` 仅扫 `apps/web/src/api`，
  新增的 web-celebrity admin URL 不被该 gate 校验；openapi 仍按 §9 补登路径。
- **USE_LOCAL 工厂删除是 localStorage 演示态**：清缓存/换浏览器会复现工厂模板；真后端 factory 删除才是稳态。
- **未做**：(a) 明星 photos/videos 子资源在 web-celebrity 的管理（admin 已有）；(b) 明星带货 `CelebrityTemplate`
  （非混剪）的 web-celebrity 编辑；(c) 明星授权状态机的运营改动；(d) 运营在 web-celebrity 建**个人**混剪模板。

### v0.56（2026-06-07）— 充值改为「下单 → 运营核准入账」+ aiavatar 密码登录 + celebrity 生产化整改

三块并到一节（celebrity 生产化 review + aiavatar 登录对齐）：

**A. 充值订单化（废止「点套餐直接加积分」）**

旧 MVP（`POST /me/wallet/recharge` → `RechargeService.recharge()` 直接入账）= 未付款即发积分的生产事故级漏洞。
改为：用户下单生成 `RechargeOrder`（PENDING，不入账）→ 平台运营在 admin 后台「线下收款后 approve」→
才经 `CreditService`（不可变账本，§4.2）入账（PAID）；或 reject（REJECTED）；用户可 cancel 自己的待确认单。

```
server : 新实体 RechargeOrder（recharge_order 表，PENDING/PAID/REJECTED/CANCELLED 状态机，套餐字段下单时快照）
       : RechargeOrderRepository / RechargeOrderDto（status 出 wire 小写）
       : RechargeService 重构：createOrder / listMyOrders / cancelOrder / listForAdmin / approveOrder / rejectOrder
       :   —— 删除旧 recharge() 直充；入账逻辑（main RECHARGE + 可选 GIFT bonus）移入 approveOrder
       : AccountController：POST /me/wallet/recharge 改为「下单」返回 RechargeOrderDto（不再入账）；
       :   +GET /me/wallet/recharge/orders +POST /me/wallet/recharge/orders/{id}/cancel
       : 新 AdminRechargeOrderController → /api/admin/finance/recharge-orders（GET list?status= / {id}/approve / {id}/reject）
types  : packages/types/src/wallet.ts +RechargeOrder / RechargeOrderStatus；RechargeRequest +note
api-client : account.ts rechargeWallet → createRechargeOrder（返回 RechargeOrder）+listMyRechargeOrders +cancelRechargeOrder
           : _bootstrap-mocks 加 /me/wallet/recharge（返回 pending 订单）+ /orders（[]）
admin  : types/recharge-order.ts + api/recharge-orders.ts + /finance/recharge-orders 页（待确认/全部/已到账/已驳回/已取消
       :   过滤 + 入账(useConfirm) / 驳回(requireReason)）；nav「财务」组 +「充值订单」
web-celebrity : wallet/page.tsx 重写 —— 点套餐 → 确认面板（可填付款备注）→ 提交充值申请（pending）；
       :   新增「我的充值订单」区（状态徽章 + 取消待确认单）；删「体验版直接到账」文案
miniprogram : recharge() 改下单语义（mock 返回 pending 订单，不改钱包）；recharge 页 submit/wxml 文案改「提交充值申请」
openapi: /me/wallet/recharge 改返回 RechargeOrder；+/me/wallet/recharge/orders[/{id}/cancel]；
       : +/admin/finance/recharge-orders[/{id}/approve|reject]；+RechargeOrder schema；RechargeRequest +note
```

**B. aiavatar 登录对齐（补密码登录 + 设密码）**

web-aiavatar 自包含登录（screen-login + proto/api.ts）此前只有 验证码登录 / 注册激活 / dev；后端
`POST /api/auth/password/login` + `POST /api/me/password` + `/api/me.hasPassword` 早就齐全，仅前端没接。

```
web-aiavatar : proto/api.ts AuthApi +passwordLogin（/auth/password/login）+setPassword（/api/me/password，带 Bearer）
             : screen-login 登录 tab 加「验证码 / 密码」切换；密码模式校验 + PASSWORD_NOT_SET → 切回验证码
             : screen-more 新增 MSecurity（账号与安全：读 /api/me.hasPassword，设置/修改密码）；MSettings「账户」组入口
             : app.tsx 注册 security 覆盖页 + go label
```

> 真实阿里云短信：后端 `AEP_SMS_DRIVER=aliyun` 即生效（aiavatar 调的就是同一套 `/api/auth/sms/*`，无需前端改动）。
> 保持 v0.50「自包含、不绑共享层」决策，不引 packages/landing。

**C. celebrity 假数据/固化项整改（用户视角 + 运营视角 review）**

- **仪表盘**：删硬编 GMV `¥8.42M` + mock 累计播放/转化；4 张 KPI 改为按真实资产派生（授权明星 / 在产项目 /
  已生成视频 / 待审切片）；「渠道流量」「本周热推 +32%」改诚实空态 / 去掉编造百分比。
- **数据中心**（`/data` + CelebrityDataCenter）：从纯 mock ZONE_OVERVIEW 改为按真实 stars/videos 派生
  （明星榜按真实生成视频数聚合）；播放/转化/GMV/周趋势/渠道占比无真实埋点来源 → 一律「暂无数据」诚实空态 + 顶部说明条。
- **账户页**：补「编辑资料」卡（昵称/头像/手机号/邮箱/简介，走后端 `PATCH /me`，此前只有改密码）。

**注意事项**：

- **不破坏其他消费方**：`api-client.rechargeWallet` 仅 celebrity 用（已改）；web-drama 的 recharge 走自家
  `finance.ts`（`{amount,method}` 形态，仅 USE_MOCK 生效，不打真后端）→ 不受影响；miniprogram 是 celebrity 消费方，已同步改为下单语义。
- **§4.2 账本不可变**：审批入账仍走 `CreditService.creditAccount`（main + bonus 双分录），不绕账本。
- **§8.0 不静默降级**：未付款不再发积分；审批是显式人工动作。生产支付网关（微信支付 / 对公）后续接入，
  当前为「线下收款 + 后台核准」轻量闭环（用户确认的方案）。
- **未做**：(a) 在线支付网关（wx.requestPayment / 对公自动对账）与回调端点；(b) 订单超时自动过期；
  (c) 充值发票；(d) celebrity 真实经营埋点（播放/转化/GMV 回传）—— 数据中心已留诚实空态位；
  (e) 明星档案 stats（粉丝/播放/GMV）仍是 mock 字段，未接真实来源（展示层未编造新假值，沿用既有 mock 卡片）。

---

### v0.57（2026-06-09）— 审计日志记录登录来源子应用（appCode）

admin「账号登录日志」(`/platform/auth-logs`，表 `aep_audit_logs`) 此前覆盖所有子应用的登录，但**无法
区分来自哪个子应用** —— `AuditLog` 无结构化来源列，只有 register/activate 把 `platform` 拼进自由文本
`detail`。本版加一个**结构化 `appCode` 维度** + admin 列表「来源应用」列 + 筛选。

**机制（一句话）**：每个客户端带 `X-App-Code` 请求头；server 在唯一审计入口
`AuditService.recordAuth(...)`（本就持 `HttpServletRequest`）统一读取并落库 → **零改动 auth controller**，
自动覆盖所有 登录/注册/激活/改密 事件。取值与 `PlatformSupport.ALL` 对齐 + 两个扩展：
`music` / `drama` / `celebrity` / `aiavatar` / `celebrity-mp`（微信小程序）/ `admin`（后台）。
server 端「清洗后原样存」（trim + 小写 + 截断 32），不做白名单硬校验（审计宁留未知来源也不静默丢）。

```
server : AuditLog +appCode 列（VARCHAR(32)，可空）+ idx_audit_app 索引
       : AuditService.recordAuth 读 X-App-Code（新 helper appCode(req)）→ 落库；search(...) +appCode 维度
       : AuditLogDto +appCode 字段；AuditLogRepository.search JPQL +appCode 精确匹配
       : AdminAuditController GET /admin/audit-logs +appCode query 参数
api-client : _client.ts +setAppCode() + apiFetch/apiFetchPaginated 注入 X-App-Code 头；index.ts 导出
           : AuthProvider +appCode prop（默认回退 requiredPlatform）→ music/drama/celebrity 零改动自动生效
web-aiavatar : proto/api.ts 自带 fetch 层 +APP_CODE="aiavatar"（authHeaders + 登录 authFetch 注入头）
miniprogram : utils/api.js apiFetch 头加 X-App-Code=celebrity-mp
admin  : api/_client.ts 头加 X-App-Code=admin；types/audit.ts +appCode + APP_CODE_LABEL/KEYS + appCodeLabel()
       : api/audit.ts 两入参 +appCode（query + mock 过滤）；/platform/auth-logs 页 +「来源应用」列 + 筛选下拉 + 详情字段
       : mocks/audit.ts 9 条登录样本补 appCode（老行留空 → 显示 "—"，演示老数据兼容）
```

**注意事项**：

- **覆盖范围（本次确认）**：四个 web 创作端 + 微信小程序 + admin 后台；遗留 `apps/web`（Phase 5 即将删）不投入，
  其登录该列为 NULL → 显示 "—"。
- **DB 迁移**：纯增量可空列，**无需 Flyway 文件**。本仓 schema 演进靠
  `spring.jpa.hibernate.ddl-auto=update`（application.yml，dev H2 + mysql 共用；提交的迁移仅 `V1__baseline.sql`），
  实体加字段即自动建列。已在内存库 + ddl-auto 实跑验证：app_code 自动建列、X-App-Code 落库、
  `?appCode=` 过滤精确生效、无头请求落 null。
- **与 register/activate 的 body `platform` 区分**：那是 license 授权语义（决定授予哪些平台），appCode 是
  「请求来自哪个 app」的审计归因，两者独立共存，不互相替代。
- **openapi 已补**：`specs/openapi.yaml` 增加 `/admin/audit-logs` path（含 `appCode` query）与 `AuditLog.appCode`。
  扫描暴露的其余历史缺口已在本版 Part B 一并补完（见下）。
- **未做**：(a) admin 列表「来源分布」统计卡片（仅做列 + 筛选）；(b) 历史老行回填 appCode（无来源信息可回填）。

**B. check:api-contract 改扫四个活跃子应用 + openapi 补全历史欠债**

契约守门从扫即将废弃的 `apps/web` 改为扫四个活跃子应用（`web-{music,drama,celebrity,aiavatar}` + `packages/api-client`），
方法级匹配。根 `scripts/check-api-contract.mjs` 早已是该形态（prior work），本版收尾：

```
scripts/check-api-contract.mjs : SCAN_DIRS → SCAN_TARGETS（每根可带 prefix）；web-aiavatar proto/api.ts 走 /api/v1，
                               :   补 prefix="/v1" 修 ~37 个前缀误报；normalizeUrl 兜底砍嵌套模板残留 "${…"
退役旧门 : 删 apps/web/scripts/check-api-contract.mjs + apps/web/package.json 的 check:api-contract 脚本；
        :   根 `pnpm check:api-contract` 为唯一门。文档全量改引用（AGENTS.md ×4 / specs/README / docs/INDEX /
        :   figma-migrate SKILL / BUSINESS_RULES / admin & web-celebrity README / TODO / product_spec）
openapi : 补全扫描暴露的 ~25 个真实未文档化端点（path × method 入契约止血，schema 后续细化）：
        :   drama /me/scripts*（10）+ /me/script-versions/{id}；film /film/dramas/{id}* + POST /film/dramas；
        :   celebrity /material/videos*（3）+ /celebrity/videos/{videoId} + /mixcut/outputs/{outputId}/download-url；
        :   distribution /distribution/jobs/{id}/{cancel,retry}；wallet /me/wallet/withdraw；
        :   dap /v1/avatars/{id}/versions/{version}/{fork,switch}；顺手修 1 处既有 YAML 语法（time_slots description 未引号）
```

**注意事项**：

- **门现态**：`pnpm check:api-contract` 全绿（308 call sites / 361 paths，0 missing path、0 missing method）。
- **新增 path 为极简 stub**（path+method+tags+operationId+200，无完整 request/response schema）—— 与文件内 `/fan/*` 等
  既有极简条目同风格，先把「端点存在」入契约止血；body schema 后续按域补。
- **遗留 `apps/web` 自有文档**（README / FIGMA_MIGRATION_GUIDE）仍引用已删的本地门 —— 随 apps/web Phase 5 整体删除，未单独改。
- **本仓 schema 演进靠 `ddl-auto=update`**（非每改一版写 Flyway 文件）；dev 文件库 `apps/server/data` 曾有 Flyway 历史漂移
  导致 `spring-boot:run` 失败 —— 本版 `清掉 ./data` 后重建干净（V1 baseline + ddl-auto 自动建 app_code 列 + 重 seed，实跑确认）。

---

### v0.58（2026-06-10）— admin 消息中心真实化（业务事件站内消息）+ 结算中心流水补全（账号/精确余额/秒级时间）

两个互相独立的 admin 真实性修复，合并为一版：

**A. 消息中心真实化**。此前 `aep_notifications` 只有 dev seeder 写的演示数据；admin 消息中心
`repo.findAll` 把**所有用户的个人通知**混进运营视图（运营标已读会改写用户自己的未读状态），且没有任何
真实业务事件产生站内消息。本版引入**运营收件箱**模型：

```
server : Notification +ADMIN_INBOX_USER_ID="__admin__" 常量 + audience 三列
         （audience_scope/audience_target_id/audience_target_name，可空，老行回退 scope=all）
       : NotificationPublisher（新 service）—— 业务事件 → 站内消息唯一写入口：
         notifyAdmins(...)（运营收件箱，audience 指向触发账号）/ notifyUser(...)（用户个人收件箱）。
         旁路写入：发布失败仅 WARN，不阻塞业务主链路（§8.0 观测类例外）
       : 事件接线（4 处）：
         RechargeService.createOrder  → admin「新充值订单待核准」（REVENUE，含登录名/套餐/金额）
         RechargeService.cancelOrder  → admin「充值订单已取消」
         RechargeService.approve/reject → 用户「充值已到账」/「充值订单被驳回」
         LicenseActivationService.activate → admin「新用户激活」（FAN，含登录名/工作室/初始积分）
       : AdminNotificationController 改为只读写 __admin__ 行（findByUserId 分页；
         markAsRead 对非收件箱行 403）+ 新增 POST /admin/notifications/read-all（批量落 viewedAt）
       : NotificationDto.audience 从实体落库字段读取（不再硬编码 "all"）
admin  : api/notifications.ts +markAllNotificationsRead()；消息中心页接通后端 read-all、
         删除假的「标为未读」切换（已读不可逆，已读行显示已读时间）、文案改为运营收件箱定位
```

**B. 结算中心（/finance/ledger）流水补全**。三个数据真实性问题：① 流水/钱包/交易只有 userId，
前端靠 `listUsers(0,500)` 客户端 join（>500 用户即丢失，且只显示昵称无登录名）；② 余额列用
`formatCompactNumber` 显示近似值（"433.1K"）；③ 时间只到日期。修复：

```
server : LedgerEntryDto/WalletDto +username/displayName（overload from(e, owner)；
         用户自查接口不填 → jackson non_null 下 wire 省略，零破坏）
       : CreditService.listWallets/listLedgerEntries、AdminFinanceService.listTransactions
         批量 findAllById join 账号（无 N+1）
       : TransactionDto +createdAt(Instant 秒级)/username/displayName；
         FREEZE 分录 status 跟随 CreditHold（ACTIVE → processing，终态 → completed），
         不再恒为 completed
types  : packages/types + apps/admin 两份 Wallet/LedgerEntry/Transaction 同步加可选字段
admin  : 结算中心页 —— 账号列显示 昵称+登录名+用户ID 前缀（AccountCell，老数据回退 userId）；
         余额/统计卡全部 formatCredits 精确值；全部时间 formatDateTimeCN 到秒；
         删除 listUsers 客户端 join；「导出对账单」真实现（CSV，UTF-8 BOM，原始整数 + ISO 时间）；
         删除假的「复核通过/驳回」按钮 + 无 onConfirm 的 ActionDialog（账本不可变，无复核后端；
         充值核准在「财务 · 充值订单」页）；业务交易视图改只读，「处理中」= hold 冻结中
specs  : openapi.yaml —— Wallet/LedgerEntry/Transaction schema 补字段；backfill
         /admin/wallets、/admin/ledger-entries、/admin/finance/transactions、
         /admin/finance/revenue/*、/admin/notifications{,/{id}/read,/read-all} 路径
```

**注意事项**：

- **DB 迁移**：纯增量可空列（notification audience 三列），与 v0.57 同理走 `ddl-auto=update`
  自动建列，无需 Flyway 文件。
- **admin 收件箱起点为空**：不 seed 假消息，真实事件（充值下单/取消、新用户激活）发生才入箱。
- **wire 兼容**：`viewedAt`/`username`/`displayName` 为 null 时 jackson non_null 序列化直接省略 key，
  前端按 `== null`（undefined 同样命中）判断，老消费方零影响。
- **端到端已验证**（dev H2 + dev-login）：下单 → admin 收件箱实时入箱（audience 溯源）→ 核准 →
  用户收「充值已到账」；取消 / 激活注册同样入箱；read-all 批量已读；admin 标用户个人通知 → 403。
- **未做**：(a) 更多事件源（混剪任务完成、发布失败告警等）后续按需接 NotificationPublisher；
  (b) admin 侧边栏未读红点 badge；(c) 结算中心服务端分页（仍取前 200 条窗口）。

---

### v0.59（2026-06-10）— 账号停用 / 恢复完整链路 + 消息中心未读角标 + 砍掉重复的积分包页

v0.58 全面 review 的三项落地（同日第二批）：

**A. /platform/accounts 账号停用 / 恢复真链路**。此前页面的「停用 / 恢复」按钮弹 ActionDialog
但没有 `onConfirm`（纯装饰），且前后端整条链路缺失。本版补全：

```
server : AepUserService +suspend()/reactivate()（状态机：仅 ACTIVE→SUSPENDED / SUSPENDED→ACTIVE，
         否则 409；DELETED 不可恢复）
       : AdminUserController +POST /admin/users/{id}/suspend（reason 必填，400 SUSPEND_REASON_REQUIRED）
         +POST /admin/users/{id}/reactivate（reason 选填）
       : AuditService +recordAdminAction()（运营管理操作审计通用入口：actor 从 SecurityContext、
         IP/UA/appCode 从 request，永不抛）+ Actions.ADMIN_USER_SUSPEND / ADMIN_USER_REACTIVATE
       : SmsAuthController /verify 补停用闸（此前短信登录漏查 status —— 停用账号仍可登录；
         现与密码登录一致返回 403 ACCOUNT_DISABLED）
admin  : api/users.ts +suspendUser/reactivateUser；accounts 页改 useConfirm + toast 模式
         （对齐 v0.56 充值订单页惯例），busy 态防重复点击；已注销账号显示「已注销」
         （删掉无 onClick 的「查看」死按钮）
```

**已知边界**：JWT 无状态 —— 已签发 token 在到期前（默认 7 天）仍可调 /api/me/**；
登录闸（密码 / 短信 / dev-login）即时生效。per-request 状态校验需要每请求查库，暂不做。

**B. 消息中心侧栏未读角标**。nav「消息中心」+`badgeKey: notif_unread`；`useSidebarBadges`
接 `listNotifications()` 数 `viewedAt == null`（与页面同一份 API + 同一过滤条件，遵循
badge-页面一致性原则）。

**C. 砍掉 /base/credit-packs（积分包）页**。与「财务 · 充值套餐」（真 CRUD）功能重复，
且自身「新建 / 编辑 / 归档」全是无后端死按钮。删除页面 + nav 项 + 独占的
api/settings.ts、mocks/settings.ts、types/settings.ts（git grep 确认无其他消费方）；
「基础数据」组因此整组隐藏（其余子项本就 enabled=false）。server 侧
SettingsController / AdminSettingsController 保留（遗留 apps/web 仍在调）。

**端到端已验证**（dev H2）：无原因停用 400 → 带原因停用 → dev-login 403 → 重复停用 409 →
恢复 → 登录恢复 200；审计日志两行落库（actor=admin、resource=aep_user、detail 含原因、IP）。
openapi backfill /admin/users 全组路径 + suspend/reactivate。

**未做（distribution 两页维持现状）**：分发渠道 / 发行队列的写操作（批准 / 驳回 / 断开 /
立即同步）仍是无后端假按钮，按决策暂不动，后续可能整页砍掉。

---

### v0.60（2026-06-10）— 第五子应用「明星商务工作台」web-star + celebrity↔star 双端打通

**新子应用 `apps/web-star`（port 3014，`@ai-star-eco/web-star`）**：明星本人 / 经纪团队的
审核与运营中枢。源自 Figma 原型 `CelebrityWorkbench.tsx`（明星端工作台 v3.0，暗色）——
全量浅色化复刻（白底 + 红黑灰 + 星光金，产品文档 §4.7 约束），桌面优先（≥1024 侧导航
240px，<1024 顶部横向 Tab）。13 个原型模块 + 新增 1 个打通模块「带货授权」：

```
dashboard / ip-auth / cooperation★ / whitelist / digital-human / ai-likeness /
content-review / product-onboard★ / product-library / brand-auth / revenue /
rules / infringement / contracts        （★ = 双端打通核心）
```

公开页：landing（自绘浅色，不用 ProductLanding）/ login（验证码+密码+dev 种子）/
onboard（明星入驻表单）。前端形态：types/mocks/constants/api 四件套 + page-kit 通用原语
（Modal / FilterChip / ActionButton / Pill / NoteBox / EmptyState / LoadingList）；
USE_MOCK=1 时 mocks 内存 store 让全部状态机操作可演示（人设「于震」）。

**新增 server star 域**（`/api/star/**` → authenticated，38 个端点）：

| 实体 | 用途 |
|---|---|
| `StarAccount` | AepUser ↔ CelebrityStar 绑定（unique user_id；agentView） |
| `StarIpAsset` | IP 资产 4 类 × 6 状态机（notStarted→…→active；火山 projectId 回执） |
| `StarWhitelistRequest` | 报白 5 步（received→…→authorized）+ 信用分/粉丝量（原始整数） |
| `StarDigitalHumanRequest` / `StarAiLikenessRequest` | 数字人三用途 / AI 形象三模型三风险 |
| `StarContentReview` | 内容四态（revision 带意见） |
| `StarProductOnboard` | 商品入库 6 步 + 双路寄样；`productId`+`submittedByUserId` 关联公共商品池与报备人；step=5 即商品库（libraryAt/salesCount 派生 `StarProductLibItemDto`） |
| `StarBrandAuthRequest` | 品牌授权 6 态 + 双向寄样 |
| `StarContentRule` / `StarInfringementCase` / `StarContract` / `StarRevenueMonth` | 规则 / 侵权 / 合同 / 月度分成（列名 `rev_month` 避 H2 保留字 MONTH） |

`StarWorkbenchService` 单服务收口全部状态机（只前进不回退）；`StarWorkbenchController`
所有单据按 principal → StarAccount 绑定逐条校验归属。seed：`StarWorkbenchDataInitializer`
@Order(3)，账号 `star_shenteng / star123`（platforms=`star`）绑 `star-shen-teng` + 全模块
演示数据。

**双端打通（本版核心）**：

1. **入驻 → 市场可见**：POST `/star/onboard` 创建 CelebrityStar（含默认 authorizationJson/
   pricing/stats）+ StarAccount 绑定 + 4 IP 资产 + 四区默认规则 → web-celebrity 明星市场
   立即出现该明星（同表读取，无同步动作）。
2. **带货授权闭环**：web-celebrity `CelebrityApplyForm` 真实提交（新端点
   POST `/me/celebrity/stars/{id}/authorization/apply`，CelebrityStarAuthorization upsert→
   PENDING + applicantNote 新列）→ web-star `/cooperation` 审批（approve 设 scenes/expireDate/
   availableStyles → AUTHORIZED；reject → UNAUTHORIZED）→ celebrity 端明星详情授权块实时
   变化 + NotificationPublisher 站内通知申请方。
3. **商品报备 6 步**：web-celebrity 商品库行内「报备」按钮（StarFilingDialog 选已授权明星）
   → POST `/me/celebrity/products/{id}/star-filings` 建 StarProductOnboard（source=creator，
   step=2 平台初审视为已过——商品池本身已运营审核）→ web-star 审核通过（step3 + 平台路
   默认验收 + 明星路寄样发货）→ 签收（step4）→ 确认（双路 approved → step5 入库 + 通知
   报备人）→ GET `/me/celebrity/star-filings` celebrity 端回查 stepLabel。重复报备 409
   `FILING_ALREADY_EXISTS`。

**平台体系**：`SubProduct` / `ALL_SUB_PRODUCTS` / `SUB_PRODUCT_LABEL_ZH`（packages/types +
admin 镜像）与 server `PlatformSupport.ALL` 同步加 `star`；AuthProvider
requiredPlatform="star"（X-App-Code 审计短码同值）。

**工程**：pnpm-workspace + 根 scripts（dev:star / typecheck:web-star）+
check-api-contract SCAN_TARGETS 加 `apps/web-star/src`；openapi.yaml +41 路径方法 +
19 schemas（Star* 前缀）。

**E2E 已验证**（H2 与 MySQL `aistareco_star_e2e` 双跑）：密码/dev 登录 → 申请→待审队列→
批准（弹层选场景/时长/风格）→ celebrity 授权态 authorized → 报备→审核→签收→确认→
入库 → 双端状态/角标/站内通知全同步；重复报备 409；新账号入驻「贾玲」→ 市场第 4 位明星
→ 对其申请授权即时出现在其工作台。浏览器级（playwright preview）双端 UI 全流程复核。

**坑位记录**：
- H2 保留字 `MONTH` → 列名必须 `rev_month`（首启崩溃 + 半截 seed；幂等按 user 存在判断会
  跳过未种完的表，dev 下删 `apps/server/data/` 重启即恢复）。
- motion（framer-motion 12）AnimatePresence exit 在 React 19 偶发卡死（遮罩残留）——
  web-star 弹层一律「条件卸载 + tw-animate 进场」，列表不做入场 stagger。
- mysql profile 本地联调需 `AEP_CDN_DRIVER=local` + 非默认 `AEP_JWT_SECRET` /
  `AEP_SECRET_KEY`（32 字节），否则 fail-fast。
            
### v0.61（2026-06-10）— 数字人收敛：music / drama 艺人形象统一引用 AiAvatar

**目标**：子应用不再自建艺人形象（孵化向导 / 形象锻造下线），数字人统一在 AiAvatar
创建与渲染，music / drama 经「引入数字人」把它变成本应用的艺人 / 演员壳——
**引用不复制**，AiAvatar 重渲染后子应用形象自动跟随。

**server**：

- `DigitalIp` + `dapAvatarId`（FK → dap_avatar.id）/ `dapDisplayRef`
  （首要展示图指针：null=跟随定妆照；`look:<id>` / `deriv:<id>`）
- 新增 `DapAvatarRefResolver`（dap 域）：出 wire 解析展示名 + 签名图 URL
  （key → `FileStorageService.signedUrl` 实时派生，资产删除静默回退定妆照 → null）；
  引入校验（本人所有 + 有定妆照 + 不在回收站）+ 展示图指针校验（资产属该数字人，
  deriv 仅图片类 kind atlas/expr/scene/ward）
- `POST /api/me/digital-ips/import-avatar`（AccountController）：创建艺人壳，
  status=ACTIVE、不扣孵化积分、name 缺省取数字人名；`PATCH /me/digital-ips/{id}`
  可改 / 清 `dapDisplayRef`；dapAvatarId 创建后不可改
- `DigitalIpDto` + 4 字段：dapAvatarId / dapDisplayRef / dapAvatarName / dapDisplayImageUrl
  （后两个实时派生；service 统一走 `toDto()`，admin 列表同样附带）

**packages/types**：`Artist` + 4 个可选字段；新增 `ImportAvatarRequest`；
`officialAppearanceId` 标记 @deprecated。

**web-music**：

- 「艺人管理」创建入口 → `ImportAvatarDialog` 两步 picker
  （①选数字人 ②选展示图：定妆照 / 造型 looks / 场景图 derivatives 图墙，
  缺图时深链去 AiAvatar `#/avatar/<id>/scene` 渲染）；艺人详情弹窗加「更换展示图」
- 新 `api/dap-avatars.ts`（/v1/avatars + looks + derivatives，同 JWT 直调 dap）+ mocks
- `ArtistAvatar` 统一优先 `dapDisplayImageUrl`（全 app 头像跟随数字人）
- sidebar 下线「AI艺人孵化」「AI形象锻造」；/incubator /appearance 路由保留
  → `RetiredFeatureNotice` 提示页（IncubationWizardV2 / AppearanceForgeV3 源码保留一版后删）
- 顺带清掉 §8.0 「music 形象锻造成片视频未实现（随机 showreel 占位）」技术债——退役而非实现

**web-drama**：

- cast「新增演员」→「从 AiAvatar 引入数字人」（ImportAvatarDialog，drama Dialog 体系）；
  卡片 hero / 详情 hero 有展示图时用图（否则保留品质渐变）；详情加「更换展示图」
- 新 api/dap-avatars + mocks/_handlers/dap-avatars（network 拦截层）+ import-avatar handler
- sidebar 下线「孵化新演员」「形象锻造炉」；/incubator /forge → RetiredFeatureNotice

**决策**：

- 引用不复制：URL 全部出 wire 实时派生（§4.7 key 真值规则），DB 只存 id/指针
- 数字人删除（回收站）不强拦、不级联：艺人壳展示回退占位，恢复后自动复原
- 同一数字人可被 music（singer）和 drama（actor）各引入一次 ——「一人多栖」
- 引入不扣孵化积分（生成费用已在 AiAvatar 端结算）
- 平台门禁照旧前端拦：未开通 aiavatar 的账号 picker 为空 + 引导文案；
  运营侧解决（发秘钥默认带 aiavatar 平台），不动门禁代码
- 遗留孵化艺人（无 dapAvatarId）继续可用，按原 avatarUrl 展示，不迁移

**v0.61 补丁（同日）**：

- 重复引入防护：同 (owner, dapAvatarId, kind) 唯一 → 409 `DAP_AVATAR_ALREADY_IMPORTED`
  （`DigitalIpRepository.findFirstByOwnerUserIdAndDapAvatarIdAndKind`）；两端 picker
  对已引入数字人「已引入」置灰；引入 bio 兜底空串（修复 drama `deriveRole` 的
  `bio.split` 崩溃）
- 展示图指针补全 `variant:<idx>`（形象变体）/ `shot:<name>`（三机位 front-half/right/left）；
  AvatarDto 出 wire `variantImages` / `shotImages`；picker 改两栏大图预览 + 分组资产墙
- music 艺人视图改造：引入艺人右列渲染新 `DapAvatarGallery`（实时引用 AiAvatar 资产，
  分组画廊 + 「设为首要展示图」+ 深链渲染新形象）；孵化参数卡 → 「数字人引用」卡；
  快捷入口「AI 形象锻造」→ AiAvatar 外链；日期格式化；sidebar 下线「动作姿态」
  （/poses → RetiredFeatureNotice）
- music mock artists API 会话内 store 化（引入后列表可见、PATCH 派生展示图）；
  drama mock import/patch 同步派生 `dapDisplayImageUrl`

**v0.61 补丁 2（同日）**：

- drama cast 页崩溃修复（「演员阵容加载失败 · reading 'length'」）：根因是
  `DigitalIpDto.from` 把老行的 `bio=null` 裸出 wire（TS `Artist.bio` 必填）→
  cast 卡片 `a.bio.length` 崩。DTO 层 bio 兜底空串（覆盖 v0.60 前的存量行，
  不止 import 路径）；前端 cast 列表 / 详情页对 `bio` / `domains` 加 `?? ""` /
  `?? []` 防御
- Spring Security 401/403 JSON 壳升级：内联 lambda 抽成
  `SecurityJsonEntryPoint` / `SecurityJsonAccessDeniedHandler` 两个 `@Component`
  （ObjectMapper 序列化 + body 带 MDC `traceId`，与 `GlobalExceptionHandler`
  同壳）；TODO.md 2026-04-21 块对应项关闭
- AiAvatar 资产存储 OSS 合规审计：dap 域全部经 `FileStorageService`
  （DB 存 key / `cdn.upload()` / 出 wire `storage.signedUrl()` 签名），
  无绕过写入点；AGENTS.md §4.7.6 陈旧的「`AiAvatarAsset` 待迁移」条目移除
  （仓库无此实体，真实实体 `dap_*` 表自 v0.51 起即合规）

**Phase 2 backlog**（见 TODO.md）：drama 成片以角色数字人形象作 i2i 身份输入、
voiceName 音色联动、~~aiavatar 反向「应用于」视图~~（✅ v0.61）、drama 角色实体化（多角色各绑数字人）。

### v0.61（2026-06-10）— 收敛 Phase 2 ①：aiavatar 反向「应用于」视图

数字人详情页展示「被哪些 music / drama 艺人壳引用」—— v0.60 收敛（艺人 → 数字人单向引用）
的反向视角，让用户在 AiAvatar 端能看到资产的下游使用面，删数字人前心里有数。

- **server**：
  - `GET /api/v1/avatars/{id}/references`（DapAvatarController）：仅 owner 本人可查
    （`required` 校验存在 + 归属 + 不在回收站）；返回 `AvatarReferenceDto[]`
  - `DapDtos.AvatarReferenceDto`：ipId / ipName / app / type / status / dapDisplayRef /
    importedAt（= 艺人壳 createdAt）；app 由 kind 派生（ACTOR → drama，其余 → music）
  - `DigitalIpRepository.findByOwnerUserIdAndDapAvatarIdOrderByCreatedAtAsc` +
    `DigitalIpService.listAvatarReferences`
- **web-aiavatar**：`AvatarApi.references` + `AvatarReference` 类型 + mock
  `AVATAR_REFERENCES`；详情页 `MAppliedTo` 卡片（概览统计与 Tab 之间；行 = 子应用图标 +
  艺人名 + 引入日期 + 状态徽标；空列表不渲染；公开形象 PA-* 不拉取）
- **契约**：openapi `/v1/avatars/{id}/references`；BUSINESS_RULES §6.4 反向视图规则
- **验证**：mock 无头 6/6（DH-2041 双引用渲染 / DH-2026 无引用不渲染）；live 端到端
  （dev server 实跑：创建数字人 → 占位生成 → pick → music/drama 双引入 → references
  返回 2 条、app/dapDisplayRef/排序正确、重复引入 409）；四门全绿

### v0.62（2026-06-11）— 明星档案编辑权移交 star 端（admin 编辑下线）

明星市场展示档案（CelebrityStar 营销字段）改为明星本人 / 经纪团队在明星商务工作台
自维护；admin 与 web-celebrity 运营内嵌的「编辑明星」入口全部下线（新增 / 软删保留，
运营字段 isHot / pricingTier / quota / pricing 不开放给明星端 —— 编辑接口下线后这些
字段暂无编辑面，后续若需要应做 admin 专属运营接口而非恢复整单 PUT）。

- **server**：
  - `PUT /api/star/profile`（StarWorkbenchController → `StarWorkbenchService.updateProfile`）：
    name / category / description（必填）+ bio / location / fans / avatar / cover
    （avatar、cover 留空 = 不变更；bio、location 传空串 = 清空）；归属由 JWT principal
    解析 StarAccount 绑定，改完即返回扩展后的 StarProfileDto
  - `POST /api/star/profile/uploads`（新 StarProfileUploadController）：multipart
    头像 / 封面上传，仅 kind ∈ avatar/cover、仅图片 MIME；要求已绑定明星档案；
    走统一 FileStorageService（OSS key 前缀 `celebrity/<kind>`），与 admin 上传同构
  - `StarProfileDto` 扩展 cover / description / bio / location（NON_NULL，老消费方兼容）
  - 下线 `PUT /api/admin/celebrity/stars/{id}` + `CelebrityZoneService.adminUpdateStar`
- **packages**：
  - types：`StarProfile` 加 4 个可选详情字段；新增 `StarProfileUpdateInput`
  - api-client：`apiFetch` 支持 FormData body（multipart 不设 Content-Type，对齐 admin 自有 _client）
- **web-star**：`/profile` 档案设置页（第 14 模块；导航新增「档案管理」组，侧栏身份卡
  可点直达）；`StarWorkbenchApi.updateProfile / uploadProfileImage`（含 USE_MOCK 分支，
  mock 下 fans 改动实时重算 tierLabel）；保存后 refreshProfile 同步壳层身份卡
- **admin**：明星档案页删「编辑」按钮，StarFormDialog 退化为仅新建；
  `CelebrityZoneApi.updateStar` 移除；页面描述注明编辑已移交工作台
- **web-celebrity**：运营内嵌编辑（v0.55 canManage 模式）同步下线 —— 市场卡片 / 详情页
  的 Pencil 编辑入口移除（删除保留），StarFormDialog 仅新建，api `updateStar` 移除
- **契约**：openapi 删 `PUT /admin/celebrity/stars/{id}`；加 `PUT /star/profile` +
  `POST /star/profile/uploads` + `StarProfileUpdateInput` schema + StarProfile 扩展字段
- **注意**：photos / videos 的 admin append/remove 端点保留（当前无 UI 使用方）；
  后续若给 star 端开放资料图集 / 形象视频管理，按本版同样姿势迁移

### v0.64（2026-06-12）— 短剧「六阶段项目工作台」接真后端（mock → 真实 API）

**背景**：web-drama 的项目工作台（选题 → 大纲 → 角色 → 剧集脚本 → 分镜工厂 → 成片配方）此前
是纯前端 mock（`mocks/drama-workshop` 静态 `ProjectData`），无任何持久化。本版补齐整套后端 +
前端切真，跑通「新建 → 加载 → 大纲 AI → 保存 → 持久化」主路径。

**后端（新增）**：
- 实体 `DramaProject`（`drama_projects` 表）——JSON-document：整套 `ProjectData` 存
  `payload_json`（LONGTEXT），另存列表卡片核心列 `title/type/type_key/ratio/episodes/progress/
  stage/mode/cover_from/cover_to`；按 `owner_user_id` 隔离 + `deleted_at` 软删。与 `DramaScript` 同惯例。
- `DramaProjectService`：`listProjects` / `getProject`（{meta,data}）/ `createProject`（按内容类型
  seed 一份**空但合法**的 ProjectData，各阶段渲染空状态）/ `saveProject`（整套落库 + 回算卡片字段）/
  `deleteProject`（软删）/ `outlineAiDraft`（大模型起草分集大纲 `[{no,hook,synopsis,beat}]`，复用
  `DRAMA_SCRIPT_DRAFT` 已绑定端点 + 大纲专属 prompt；未配 503 `AI_NOT_CONFIGURED` / 调用失败
  502 `AI_CALL_FAILED` / 解析失败 502 `AI_BAD_OUTPUT`，**不静默兜底**）。
- `DramaProjectController` → `GET/POST /api/me/drama/projects`、`GET/PUT/DELETE /{id}`、
  `POST /{id}/outline/ai-draft`。落 `/api/me/**` → JWT principal 隔离。
- 联调：`scripts/dev-fake-llm-server.mjs` 加「分集大纲」JSON 分支（先于脚本分支，避开 `episode` 子串）。

**前端（mock → 真实 API）**：
- 新 `api/projects.ts`（`ProjectsApi`：list/get/create/save/delete/outlineAiDraft，带 `USE_MOCK` 分支）。
- `/projects` 列表：`useAsync` 拉真实列表 + 加载/空/错误（重试）态；「继续上次」取最近更新项；
  新建（从零 `/projects/new` guided/template + 套模板弹窗 + 成片预览衍生）全部走 `createProject`
  真实立项（**修掉原先硬编码跳 `p1` mock id 的死链**）。
- `/projects/[id]` 工作台：`getProject` 真实加载（加载态 spinner / 找不到态）；整套 `data` 提升为
  可编辑副本，经 `StageContext.saveData` 注入各阶段，乐观更新 + `PUT` 落库。
- `OutlineStage`：「AI 生成大纲」调 `outlineAiDraft` 真连大模型 → 合并入文档 + 保存；空项目
  idle 引导态；失败 toast（带后端错误码文案）。

**验证**：curl 全链路（create→outline-AI→save→GET 持久化→list→delete 软删 404）+ 浏览器主路径
（空列表 → 工作台加载真实 logline/集数 → 点「AI 生成大纲」→ 真实大模型出 6 集 → 落库 → reload 仍在
→ 列表「继续上次」卡）。三门全绿：web-drama typecheck / `check:api-contract` / server compile。

**仍待办（下一阶段候选）**：
- 其余阶段（角色绑定 / 剧集脚本-分镜 / 成片配方）的**逐项编辑持久化**与 AI（剧集脚本可直接复用
  已验证的 `DRAMA_SCRIPT_DRAFT` 管线）尚为前端态；本版已铺好「整套文档 load/save + StageContext」
  的承接点，按 `OutlineStage` 同姿势接入即可。
- 视频工厂（分镜出片）走真实 agnes 视频端点**有额度**，本期保持联调态（fake :8091），未接真实计费。
- 大纲/生成动作的**真实积分扣减**（`CreditService`）未接（当前工作台余额为展示态）；接入时按
  `hold/commit/release` 三段式或 `debit` 同步扣。

### v0.65（2026-06-12）— 短剧全站接真后端（server 模式所有接口真连，与 mock 完全隔离）

承接 v0.64 工作台地基，把短剧剩余流程全部从前端态切到真后端：剧集脚本/分镜/选角 AI、
分镜首帧（图像）与视频渲染、分发、财务。`USE_MOCK=1` 仍走 `mocks/_handlers/*`，`USE_MOCK=0`
（server 模式）所有 `apiFetch` 真打后端 —— 两条路径在 `api/*.ts` 顶部 `if (USE_MOCK)` 处彻底分叉。

**后端（新增/扩展）**：
- `AiModelPurpose` +`IMAGE_GENERATION`（通用图像生成）；已纳入 `DevFakeAiSeeder` 种子绑定。
  ⚠️ 注意 H2 老库 `ai_app_binding.purpose` 是 enum 列，加枚举值后需把列 `ALTER` 成 `VARCHAR`
  （本版已对开发库执行；生产 MySQL 用 `VARCHAR` 不受影响）。
- `DramaProjectService` +3 个 AI：`epscriptAiDraft`（整集→分场 ScriptScene[] + 分镜 BoardScene[]）/
  `splitSceneShots`（单场→镜头表）/`castAiDraft`（选角 CharacterDef[]）；统一 `callJson` + 归一化
  （BoardShot id/no、dur 钳 1-30、engine→avatar|seedance；CharacterDef role→key|extra）。
  `DramaProjectController` +`/{id}/epscript/{ai-draft,split-scene}` + `/{id}/cast/ai-draft`。
- 新 `DramaRenderService` + `DramaRenderController`（`/me/drama/render/{frame,clip}`）：
  - **首帧**=图像生成（`IMAGE_GENERATION`，OpenAI `POST {base}/images/generations`，response_format
    url|b64_json）→ 字节经 `CdnUploader.upload` 落 CDN（key 真值 + `CdnUrlSigner.signKey` 派生 URL，
    遵 §4.7）→ `CreditService.debit` 按次扣 2 分。未配 503 `IMAGE_NOT_CONFIGURED` / 失败 502
    `IMAGE_CALL_FAILED`，不静默兜底。
  - **视频**=委派 `MaterialVideoJobService`（kind="drama-shot"，异步 submit+poll，自带 hold/commit/
    release 计费 30/条），前端轮询复用 `/me/drama/episodes/jobs/{id}`。
- 分发真后端：实体 `DramaPublishJob`（`drama_publish_jobs`）+ `DramaPlatformConnection`
  （`drama_platform_connections`，user×platform 唯一约束）；`DramaDistributionService`（14 平台静态
  目录 + 连接 CRUD + 发布任务 `@Scheduled(2s)` 状态机 queued→uploading→transcoding→publishing→live，
  支持 scheduledAt 定时）；`DramaDistributionController`（`/me/distribution/**`）。未连平台发布 409。
- 提现：`CreditService.withdraw`（账本侧 `WITHDRAW` 原子扣减，余额不足 402）+ `AccountController`
  `/me/wallet/withdraw`（返回 status=processing 的 Transaction，真实打款运营线下）。

**前端（mock → 真实 API）**：
- 新 `api/render.ts`（`RenderApi`：renderFrame/renderClip/pollClipJob，带 USE_MOCK 占位帧/即时任务）。
- `EpScriptStage`/`FactoryStage`/`CastStage`/`/shorts/make` 全部接 `ProjectsApi` + `RenderApi` +
  `ShortDramaApi`；镜头渲染态（frameUrls/frameUrl/videoUrl/jobId/flow）落 `BoardShot` 持久化；
  `Thumb` +`src`（真图 cover），成片用 `<video>`；`WorkshopShell` +`setChars` reducer action。
- `distribution.ts` 重指向 `/me/distribution/**` + 删 content/platform-views/connections 死函数；
  `finance.ts` 充值改走「套餐下单→运营核准」、提现走 `/me/wallet/withdraw`。
- 删死代码 `api/generation.ts` + `mocks/_handlers/generation.ts`（全仓 0 引用）。

**验证（真模型实测，最小请求）**：
- 🟢 **图像**：bind IMAGE_GENERATION → agnes-image-2.1-flash，`/me/drama/render/frame` 出**真
  720×1280 PNG**（11s，1.3MB，画面与 prompt 一致）→ 落 CDN → 浏览器工厂页点「首帧」真渲染、
  4 版候选落库、卡片转「选首帧」态。
- 🟢 **视频**：bind VIDEO_GENERATION → agnes-video-v2.0，真 submit（拿到 agnes taskId）+ 服务端
  轮询进度 11→95%；agnes 视频生成 >600s 超过 worker 默认 `AEP_VIDEO_MAX_WAIT_SEC=600`（生产
  需调高）。连通性已证（submit + poll 协议匹配 `POST /videos` + `GET /videos/{id}`）。
- curl 全链路：epscript/split/cast AI、frame(fake)、clip(fake 即时)、distribution（连接→发布→
  @Scheduled live→未连 409）、withdraw（余额 3000→2868，流水正确）。
- 浏览器：真列表「继续上次」、工作台加载真 logline、工厂首帧真渲染落库。
- 三门全绿 + `DramaProjectServiceTest` 9 用例（含 epscript/cast 解析）。dev 默认回绑 fake 端点。

**仍待办**：
- 真实视频要在生产把 `AEP_VIDEO_MAX_WAIT_SEC` 调高（agnes 视频 >10min）；首帧目前固定 2 分、
  视频 30 分，后续可挪 admin `CelebrityActionPricingService` 统一定价。
- 「成片配方」(PromptStage) 仍为前端态（只读汇总，不涉及生成，优先级低）；社交账号真实 OAuth
  分发（sau-service）与本版的服务端模拟传输并存，接入时替换 `DramaDistributionService.tick`。

### v0.66（2026-06-12）— 短剧扣费体验 + 按集隔离 + 成片合成（配方退役）

**① LLM 动作 server 端真扣积分 + 小额免打扰**：
- `DramaProjectService` 注入 `CreditService` + `PlatformConfigService`，四个 AI 动作（大纲起草 /
  整集分场分镜 / 单场拆镜 / 重抽角色）经 `withCharge`（hold → 生成 → commitHold；失败 releaseHold
  不扣，refType `DRAMA_AI`）；首帧单价同步改为配置读取。单价 0 = 免费跳过。
- 前端 `CreditButton` 增加阈值逻辑：消耗 **< confirmThreshold（默认 10）** 直接执行不弹确认；
  ≥ 阈值才弹 `dramaConfirm`。阈值与各动作单价由新 `GET /api/me/drama/config` 下发
  （`api/drama-config.ts` 模块级缓存 + `useDramaConfig()` hook，outline/epscript/cast/factory
  全部从硬编码常量切到配置价）。
- **admin 新「短剧专区」**（nav group + `/drama/config` 页）：扣费确认阈值 + 6 个动作单价的
  表单化管理，真值存 `PlatformConfig`（`drama.credit.*`，`DramaConfigSeeder` 幂等 seed 默认值）；
  分镜视频单价沿用 celebrity `material.video-generate` 定价（页内跳「引擎价格」）。
**② 按集存档（修切集互相覆盖）**：`ProjectData` + `episodeDocs: Record<ep, {script, storyboard,
assembled?}>`；epscript / factory / assemble 经 `getEpisodeDoc(data, ep)` 读（episodeDocs 优先，
老项目回读 legacy `script`/`storyboard` 字段）、`withEpisodeDoc` 写。浏览器实测 ep1↔ep2 内容互不污染。
**③「成片配方」退役 →「成片合成」**：分镜已真实出片，第 6 阶段改为按序拼接交付。
- server `DramaAssembleService`（复用 mixcut `FfmpegRunner`）：episodeDocs[ep].storyboard 取有
  videoUrl 的镜头按场序+镜号 → 下载临时区 → `ffmpeg -f concat -c copy`（失败回退 libx264 重编码）
  → `CdnUploader` 落 CDN → 返回 `{url, cdnKey, durationSec, shotCount}`；前端合并入
  episodeDocs[ep].assembled 落库。`POST /api/me/drama/projects/{id}/assemble`。
- 新 `AssembleStage`（stages-config key 沿用 `prompt` 防大改，名称/副标改「成片合成 · 拼接完整片」）：
  待拼镜头网格 + 一键拼接 + 成片播放器/下载/重拼；空态引导去视频工厂。`stages/prompt.tsx` 删除。
**④ 删冗余入口**：`RunAllDialog`（一键连跑）+ workshop 顶栏入口、(workspace) 顶栏「新建短剧」按钮删除。

**验证**：钱包 2864→2848（大纲6+分场10）→重抽-5；流水 hold/commit 成对；阈值 5<10 无弹窗 /
10≥10 弹窗 / admin 改 99 后 10 也免打扰（改回）；真 ffmpeg 拼 2 镜（2s+3s testsrc/smptebars）
→ 5.02s mp4 落 cdn-mock 可播；admin 专区页加载真值 + 保存 12 即刻生效（GET 同步）。
门禁：drama/admin typecheck 0 错、server compile 0 错、contract OK、`DramaProjectServiceTest` 11/11
（新增 hold/commit、失败 release 两用例）。

**已知未覆盖**：USE_MOCK=1 浏览器级回归本轮未跑（新 api 均带 mock 分支）；老项目（episodeDocs
启用前）首次保存某集后其它集回读切换为空文档属预期迁移语义。

### v0.67（2026-06-13）— 平台目录运营 CMS（drama 端自运营）+ 首页灵感接真 + 工程债收口

两条线：**平台目录自运营**与**工程债收口**。

**A. 平台目录运营 CMS（catalog）**：短剧的「内容类型 / 模板 / 格式 / 近期热点 / 创意推荐」从前端硬编码改为
运营可维护的平台目录。`DramaCatalogController`（`GET /api/me/drama/catalog`：任意已登录可读；
`PUT|DELETE /catalog/{field}`：仅 OPERATOR/SUPER_ADMIN 写），存储复用 `PlatformConfigService`
（key 前缀 `drama.catalog.*`），未配某项回退前端内置默认。维护入口在 **web-drama `/operations`
（非 admin）—— 「子应用自运营」模式**（与 v0.73 Recipe 审核同源决策：drama 的运营动作放子应用端，
admin 只保留扣费/prompt 等平台级配置）。消费端：`/dashboard` 首页灵感、新建对话框等改 `getCatalog()`
动态加载，删假种子。

**B. 工程债收口（根 TODO 的 D-7 / D-6 / D-3）**：
- **D-7 弹层 a11y 统一**：抽 `lib/use-modal-a11y.ts`（ESC + 焦点陷阱 + 初始/还原焦点 + body 锁，单一来源），
  `common/Dialog.tsx` 接入 + 补 `aria-labelledby/-describedby`；新增 `common/ModalShell.tsx` 给命令式弹层
  提供 `.overlay` + `role=dialog` + a11y，收编 short-clip / quick-create / preview 三个此前裸
  `<div className="overlay">`（全缺 ESC / focus）。**不换 packages/ui 的 shadcn dialog**（亮色 token 会破坏
  drama 暗色 premium 玻璃视觉），强化共享容器即让所有调用方一处受益。
- **D-6 测试基线**：真后端落地后建立首个 vitest（+ jsdom + @testing-library/react）。`format.test.ts`
  （15 例边界）+ `drama-query.test.tsx`（6 例缓存语义），`pnpm test` 21/21。测试驱动**修了一个真实 bug**：
  `drama-query` 取数失败时 re-throw 让 `useAsync` 丢弃的 promise 变 unhandled rejection（改为错误只落
  `entry.error`，两个消费者从那里读）。
- **D-3 重复样式提取（非全量迁移）**：实测 inline `style={{}}` ~1615 处（原 TODO 估 573 严重低估），drama 为
  Figma Make 移植、inline 精确定位是设计工作流的一部分，机械全迁移不可取 → 改为按重复模式提取：新增
  `.icon-badge` 工具类，迁移 4 处代表（computed-style 验证逐属性等价、零回归）。

### v0.71（2026-06-13）— 短剧工作台 prompt 数据化 + 短剧专区「提示词设置」后台

把六阶段工作台写死在 `DramaProjectService` 的 4 段 LLM prompt 抽进统一的 `PromptService`，运营
可在 admin 改提示词与调参，无需改代码或重启（1min 缓存，PUT 立即失效）。

- **后端**：`PromptService` 新增 4 个 key `drama.outline` / `drama.epscript` / `drama.split_scene` /
  `drama.cast`（并入 `KNOWN_KEYS`，`PromptTemplateSeeder` 自动从 resource seed），新增 4 个 resource
  默认 `resources/prompts/material/drama.*.md`（system + `---` + user 模板，占位符 `{{title}}`/`{{count}}`/
  `{{loglineClause}}` 等）。`DramaProjectService` 4 个 AI 方法（大纲/整集分场分镜/单场拆镜/选角）改为
  `promptService.resolve(key)` + `PromptService.fill(userTemplate, vars)`；可选片段（简介/主线/风格/出场/
  台词/分集梗概）由 Java 拼成 `{{xxxClause}}` 变量注入，行为与旧写死串 1:1 一致。4 个 prompt 仍共用
  `DRAMA_SCRIPT_DRAFT` 端点绑定（运营只需绑一个模型），但 prompt 各自可配。
- **参数**：`temperature`/`maxTokens`/`jsonMode` 取运营在 admin 设的值；为空回落到本动作推荐默认
  （大纲 0.9 / 分场分镜 0.85 / 拆镜 0.8 / 选角 0.9，maxTokens 4096，jsonMode 开）。
- **§8.0 不静默降级**：端点未绑 → `AI_NOT_CONFIGURED`；prompt 未配置（DB/resource 都没有，origin=code）
  → `PROMPT_NOT_CONFIGURED`；二者都在扣费前，**不调模型、不扣费、不兜假**。
- **admin**：新页 `/drama/prompts`（短剧专区 ·「提示词设置」），复用 `/api/admin/prompts`
  （SUPER_ADMIN/OPERATOR）按 `drama.*` 过滤，给每个 prompt 友好名 / 用途 / 可用占位符提示 / 试运行，
  并对 temperature / max_tokens / jsonMode 三个专业参数加人性化说明 + 推荐默认占位。
- 无新表 / 新实体 / 新端点（复用既有 `prompt_template` + `/api/admin/prompts`）；openapi 不变。

门禁：server compile 0 错、`pnpm typecheck:admin` 0 错、`pnpm check:api-contract` OK；
`DramaProjectServiceTest` 13/13（新增 `PROMPT_NOT_CONFIGURED` 闸 + 参数覆盖两用例）+ 新
`PromptServiceDramaResourceTest` 2/2（4 个 resource 真实解析 origin=resource + fill 占位符）。

**已知未覆盖**：v0.72 待做 —— 图像/视频 prompt 服务端化（`drama.frame_image` / `drama.clip_video`，
把前端 `factory.tsx` 的 `shotPrompt` 拼接挪到服务端模板）。运行中的旧 server 需重启后 seeder 才会
落 4 个新 key（本版无 schema 变更，重启零风险）。

### v0.72（2026-06-13）— 图像 / 视频 prompt 服务端化（出图 / 出片提示词进后台）

把 3 处前端写死的出图 / 出片 prompt 拼接（`factory.tsx` 的 `shotPrompt`、`epscript.tsx` 单镜渲染、
`shorts/make` 短视频单镜）全部抽到服务端模板，运营在 admin 可改，所有用户即时生效。

- **后端**：`PromptService` 新增 4 个 key —— `drama.frame_image` / `drama.clip_video`（工作台分镜）、
  `drama.short_frame_image` / `drama.short_clip_video`（短视频工坊）；resource 默认为单 prompt 模板
  （无 `---`，整块即 user，占位符 `{{visual}}`/`{{size}}`/`{{move}}`/`{{lineClause}}`/`{{castClause}}`/
  `{{styleSuffix}}`/`{{metaPrefix}}`）。`DramaRenderService` 新增 `buildMediaPrompt(body, workbenchKey, shortKey)`：
  按 `body.kind`（shot/short）选模板 → `resolve()` + `fill(vars)` → 清掉未填充残留 `{{}}`；
  `origin=code` → `PROMPT_NOT_CONFIGURED`（§8.0）。renderFrame/renderClip 不再读 `body.prompt`
  （保留过渡兼容：若仍传 `prompt` 则直用）。图像/视频不吃 temperature/maxTokens。
- **前端**：`render.ts` 的 `RenderFrameInput`/`RenderClipInput` 由 `prompt:string` 改为
  `{ kind?, vars }`；`factory.tsx`（`shotPrompt`→`shotVars`）、`epscript.tsx`、`shorts/make` 三处改为
  传结构化 vars（可选片段台词/出场/口播仍在前端按存在与否拼成整句，输出与旧 1:1）。
- **admin**：`/drama/prompts` 页新增这 4 个 `kind:"media"` key，编辑时隐藏 System / 调参（图像视频不适用），
  只露提示词模板 + 可用占位符 + 试运行；并提示比例/版数/首帧/单价的来源。
- 仍无新表 / 新实体 / 新端点（`/me/drama/render/{frame,clip}` 路径不变，仅请求体形态变；openapi summary 同步）。

门禁：server compile 0 错、`pnpm typecheck:all` 全绿、`pnpm check:api-contract` OK；
`DramaProjectServiceTest` 13/13 + `PromptServiceDramaResourceTest` 4/4（新增 4 media key 解析 +
fill 清洗残留占位符用例）。运行中旧 server 需重启后 seeder 落 4 新 key（无 schema 变更，零风险）。

### v0.72 补丁（2026-06-13）— 验证反馈三修：分镜补音效/BGM/特效 + 渲染产物灯箱 + AI 全链路日志

1. **短视频分镜补全音效 / BGM / 特效氛围**：之前所有分镜的 `sfx`/`bgm`/`fx` 恒为空（脚本 prompt 根本没要这几项）。
   `drama.script_draft.md` 场景 schema 加 `sfx`/`bgm`/`fx`（约束「按需填、平淡镜留空、不每镜硬塞」）；
   `DramaScene` TS 加可选 `sfx?`/`bgm?`/`fx?`；`shorts/make` 映射由写死 `""` 改读 `sc.sfx/bgm/fx`。
   后端 `parseScripts` 走 `deepCopy` 原样透传，无需改 Java。
2. **首帧 / 视频可点开预览**：新增 `MediaLightbox`（portal 到 body，避免被卡片裁切；图看大图 / 视频带 controls+自动播放，Esc/点遮罩关闭）。
   接入共用的 `ShotFormCard`（短视频工坊 + 工作台剧集脚本两处）渲染产物点击放大；工作台「视频工厂」抽屉的首帧 Thumb 也接灯箱（视频本就有 controls）。
   生产存储仍走 `CdnUploader`（OSS，§4.7）—— 首帧字节 `cdnUploader.upload` 落 OSS、出 wire 经 `CdnUrlSigner` 签名；本补丁仅前端展示层，无存储改动。
3. **AI 全链路日志（排查用）**：`AiModelInvocationService` 加独立 logger `aep.ai.chat.io`，记「发给大模型的最终提示词全文（messages）」+「模型原文返回」；
   `DramaProjectService.preparePrompt` / `DramaRenderService.buildMediaPrompt` 记「拼装后结构化数据（vars）」+ 出图/出片最终 prompt（图像生成不走 chat，故在此兜底记录）。运维可单独给该 logger 调级别/落盘。

门禁：server compile 0 错、`pnpm typecheck:all` 全绿、`pnpm check:api-contract` OK；drama 后端测试 17/17。
**未覆盖**：灯箱 / 音效字段为前端展示，本轮未跑浏览器级回归（建议重启 server 后连真模型验证「分镜带音效」+ 点开大图 + 日志落盘）。

### v0.73（2026-06-13）— 抽 skill 飞轮（Recipe MVP · 后端抽取核心）

「爆款项目 → 反向抽成可复用配方 → 运营审核发布 → 他人一键套用」飞轮的第一刀：后端抽取核心。
MVP 范围按拍板 = **官方/运营从爆款抽取**（暂不做用户自建市场 / 分成）。

- **新实体** `DramaRecipe`（`drama_recipes` 表，ddl-auto 自动建）：从爆款 `DramaProject` 蒸馏的可迁移结构
  —— 列字段 status(draft/submitted/published/rejected) / origin(extracted/official) / title / summary /
  typeKey / type / ratio / episodes / cover / useCount / reviewNote / sourceProjectId；`payloadJson` =
  `{ mainline, beats:[{no,hook,beat}], characters:[{role,archetype,desc}], hooks:[], notes }`。
- **抽取器** `DramaRecipeService.extractFromProject(projectId, userId)`：加载属主项目 → 把 ProjectData
  （大纲/角色）喂新 prompt `drama.recipe_extract`（resource 默认 + admin 可改）→ 大模型「去具体化」蒸馏
  成可复用配方 → 落库 status=submitted。§8.0：端点未绑 `AI_NOT_CONFIGURED`、prompt 未配
  `PROMPT_NOT_CONFIGURED`、缺大纲 `DRAMA_RECIPE_NEEDS_OUTLINE`、LLM 失败/解析失败
  `AI_CALL_FAILED`/`AI_BAD_OUTPUT`。复用 `DRAMA_SCRIPT_DRAFT` 端点绑定（不新增模型绑定）。
- **端点** `POST /api/me/drama/projects/{id}/extract-recipe`（属主，→ Recipe DTO）。`PromptService`
  加 key `drama.recipe_extract` + `KNOWN_KEYS`（admin Prompt 管理自动出现）+ resource `.md`。
- 抽取暂不扣费（运营 / power-user 动作；后续可加 `drama.credit.recipe-extract`）。

门禁：server compile 0 错、新 `DramaRecipeServiceTest` 5/5（归属 / 端点未配 / prompt 未配 / 缺大纲 /
LLM 解析为 submitted 配方）+ drama 后端 22/22、contract OK（openapi 补 extract-recipe path）。

**待续（v0.73 后续刀）**：运营审核/发布（web-drama 运营后台，**非 admin**）→ 已发布配方进创意库；
web-drama「把这部抽成模板」入口 + 创意库一键套用（用 Recipe 预填新项目 mainline + 分集骨架）。

### v0.73 补丁（2026-06-13）— 短视频制作 5 处验证反馈修复

1. **shorts/make 的 idea 不再走 URL**：改 sessionStorage 一次性带入（`drama.shorts.idea`，读完即清）—— 解决「长文案/敏感内容进 URL」+「每次刷新都重复请求、重复扣费」。四个入口（dashboard 自由文本 / 格式卡 / short-create-dialog / shorts 工坊）统一改造。
2. **不再强制「已套用口播带货」**：`fmt` 不再默认 `sell`；`hasTemplate=!!fmt`，没选模版就给中性开场白 + 不注入 templateRef + genre 用「通用短视频」。
3. **生成完成必给对话反馈**：runScript 成功后对话框总会追加一条「脚本和分镜已生成 ✓ 共 N 个分镜…」（之前只有「改一版」才有回复）。
4. **参考素材可删除**：`RefCell` 每个参考加 × 删除；正文里 `@` 出来的 `[参考N]` 行内 chip 也加 × —— 删除时同步从 refs 移除并把正文里更大的序号 −1（保持对齐）。
5. **分镜补音效/BGM/特效真正生效**：dev 用 file-H2（持久），`drama.script_draft` 早已 seed，v0.72 改的 resource 不会自动覆盖 → bump `PromptTemplateSeeder.SEED_VERSION`→`v7-2026-06-13-drama-prompts`，触发 `reseedBaselineIfUntouched` 刷新未改动行。**已验证**：重启后 `drama.script_draft` 含 sfx/bgm/fx；9 个新 drama key（含 `recipe_extract`）入库。

门禁：server compile、web-drama typecheck 绿；**真机验证**：server 重启 +9 key 入库 / 刷新 25 行基线 / `drama.script_draft` 含 sfx-bgm-fx / extract-recipe 端点 404 业务码均 OK。
**未跑**：fake-llm(8091) 未起，实际「生成出音效字段」+ 灯箱/删除的浏览器级回归未跑（前端 typecheck 绿、为标准实现）。

### v0.73 slice 2-3（2026-06-13）— 抽 skill 飞轮前端闭环 + 全链路浏览器验收

后端（slice 1-2）之上补齐前端，飞轮跑通：
- **运营审核/发布**（在 web-drama 运营后台，**非 admin**）：`/operations` 页新增 `RecipeReviewSection`
  ——`isOperator`(operatorRole) 可见，列待审配方（标题/摘要/题材/可展开看 mainline+beats 骨架），发布 / 驳回（带可空理由）。
- **用户主动抽取**：`WorkPreviewModal` 加「抽成模板」按钮（仅已完成项目），调
  `RecipesApi.extractFromProject` → 提交待审 + toast。
- **创意库一键套用**：短剧工坊 `/projects` 新增 `RecipeLibrarySection`（已发布配方横向卡），套用 →
  `RecipesApi.applyRecipe` → 后端建预填项目 → 跳工作台。
- `RecipesApi`（api/recipes.ts + index）：extract / listMine / listPublished / listForReview /
  publish / reject / applyRecipe，均带 USE_MOCK 分支。dev fake-llm 加「可复用配方」分支返回结构化 recipe。

**门禁全绿**：server compile + `DramaRecipeServiceTest` 10/10 + drama 后端 22/22；`pnpm check:api-contract` OK；
web-drama `typecheck` + `build` 绿。
**全链路真机验收**（8080 + fake-llm 8091 + web-drama 3011，真实浏览器，登录态 celebrity_operator/operator）：
① 用户在「午夜来电」点抽成模板 → toast「已提交运营审核」；② 运营 `/operations` 配方审核见待审 2，点发布 →
toast + 待审 2→1 / 已发布 1→2；③ 用户 `/projects` 创意库点套用开拍 → 落到新项目
`dp_7959ec1c80e6`，工作台「大纲分集 · 模板已预填」，主线 = 配方 mainline、6 段 beats 已铺成分集大纲、
mode=template / stage=2。**生产可上线**。

**已知**：dev fake-llm 仅联调用；生产连真模型时配方质量取决于真模型对 `drama.recipe_extract` 提示词的产出。
抽取暂不扣费（如需计费加 `drama.credit.recipe-extract`）。

---

### v0.74（2026-06-13）— 官方内置配方 seeder（19 条）+ 配方封面图

把 flova skill 转换的一批官方创意做成平台内置：
- 新增 `DramaRecipeSeeder`（`CommandLineRunner` `@Order(72)`）：声明式幂等 upsert
  `resources/seed/drama-recipes-official.json`（19 条 `origin=official`，`ownerUserId=__official__`，直接
  `status=published`）；按 id 更新内容字段但保留运行期 `useCount` + 首次 `createdAt`；dev 每启动重 seed，
  prod 首插后按 id 更新（改 seed 重启即生效）。
- `DramaRecipe` 加列 `coverImage`（官方配方真实预览图 `/recipes/<id>.webp`，落 `web-drama/public/recipes/`；
  为空时前端回退 `coverFrom/coverTo` 渐变）。`extracted` 配方默认无图。

### v0.75（2026-06-13）— 模板库 → 创意市场（双通道精选授权 + 我发布的创意）

把 mock 的「模板库」退役，统一为基于已发布 `DramaRecipe` 的**创意市场**（官方内置 + 用户发布同台）。

**后端（DramaRecipe 双通道 + 内置手建）**：
- `DramaRecipe` 加列 `authorName`（来源用户展示名 → 「来自用户@xx」）/ `invitedBy`（运营邀请审计）/
  `consentAt`（用户授权时刻）；`status` 增 `invited`（待用户授权）|`declined`（用户谢绝）；`origin` 增
  `featured`（运营精选用户作品）。
- `DramaRecipeService`：抽出公共蒸馏 `distillAndSave`，三通道复用 —— ① `extractFromProject`（用户自助→
  submitted）② `inviteFromProject`（运营对任意用户项目发起→invited，给作者发授权站内信）+ `respondInvite`
  （作者 approve→published/consentAt · decline→declined）③ `createBuiltin`（运营手建→origin=official 直接
  published）。`listCandidates` = 跨用户已铺大纲项目池（标作者 + 是否已抽过）。`resolveAuthorName`（注入
  `AepUserRepository`）。publish/reject/invite/approve 经 `NotificationPublisher` 发站内信（旁路，§8.0）。
- 仓库：`DramaProjectRepository.findTop80ByDeletedAtIsNullAndStageGreaterThanEqualOrderByUpdatedAtDesc` +
  `findByIdAndDeletedAtIsNull`；`DramaRecipeRepository.findBySourceProjectIdInAndDeletedAtIsNull`。
- 新端点（openapi 同步）：`GET /me/drama/recipes/candidates`、`POST /me/drama/recipes/invite`、
  `POST /me/drama/recipes/builtin`（均 `requireOperator`）、`POST /me/drama/recipes/{id}/respond`（属主授权）。

**前端（web-drama）**：
- `/templates` 重建为「创意市场」：`listPublished`（官方+用户）网格 + 源标（官方 ⭐ / 来自@昵称）+ scope
  （全部/官方内置/用户作品）+ 题材 + 搜索 + 详情弹窗 + 「套用开拍」；运营（operatorRole/运营身份）见
  「新建内置创意」表单 + 「从用户作品精选」候选弹窗（邀请）。
- 新子页 `/templates/published`「我发布的创意」：`listMine` 按状态分档（审核中/已上架/已驳回/运营邀请待授权/
  已谢绝），invited 行可「授权精选 / 谢绝」。
- 「抽成模板」去技术化改名 **「发布到创意市场」**（`WorkPreviewModal` 默认 + tooltip + toast）。
- **工坊移除「创意库·爆款模板」块**（删 `RecipeLibrarySection`）——模板选择只在新建时（创意市场套用 /
  `/projects/new`）。`RecipesApi` 加 `listCandidates/invite/createBuiltin/respondInvite`（USE_MOCK 分支）。
- 侧栏：模板库 → **创意市场**（+ 二级入口「我发布的创意」，父项激活时展开）；**戏服与道具 / 脚本工坊 /
  多平台分发** 打「建设中」标（`NavItem.badge`）。`/operations` 配方审核改称「创意审核」，加来源作者标。

**门禁全绿**：server 32/32（`DramaRecipeServiceTest` 19/19，含 invite/respond/builtin/candidates）+
`pnpm check:api-contract` + web-drama `typecheck`/`build`。
**真机浏览器全链路验收**（8080 + fake-llm 8091 + web-drama 3011，登录态 celebrity_operator/operator）：
创意市场渲染 23 条/源标正确；新建内置创意 → 计数 21→22；从用户作品精选 → 邀请 → toast；我发布的创意
授权精选 → 上架「来自@平台运营」（真 authorName）/ 用户作品 2→3；工坊无「创意库·爆款模板」；成片预览按钮
= 「发布到创意市场」；侧栏建设中标 ×3；零 console error。**生产可上线**。

**已知**：运营精选候选池为「跨用户、stage≥2、最近 80 条」（去重已抽过的）；旧 row 无 `authorName` 时前端
回退「来自@用户」。运营手建/精选/审核入口均在 web-drama 端（非 admin），与 v0.73 同源决策。

### v0.75 补丁（2026-06-13）— 创意市场三项硬化（重复守门 + 弹窗 a11y + 加载错误态）

针对 v0.75 评审发现的三处优化：

- **后端「重复入市」守门**：`DramaRecipeService.guardNoActiveRecipe(projectId)` —— 同一来源项目已有
  `submitted`/`invited`/`published` 配方时，`extractFromProject`（用户自助）与 `inviteFromProject`
  （运营精选）在蒸馏**前**抛 409 `DRAMA_RECIPE_ALREADY_EXISTS`（**不触发大模型、不落库、不发站内信**）；
  `rejected`/`declined` 视为可重来不拦。补 `DramaRecipeRepository.findBySourceProjectIdAndDeletedAtIsNull`。
  防「双运营 / 过期 UI 重复邀请」「用户狂点发布堆审核队列 + 免费刷 LLM」。`DramaRecipeServiceTest` 19→**22**
  （+extract 重复拦截 / rejected 可重来 / invite 重复拦截）。
- **弹窗 a11y**：`/templates` 三弹窗（详情 / 新建内置 / 从用户作品精选）+ `WorkPreviewModal` 由裸
  `<div className="overlay">` 迁到 `ModalShell`（`role=dialog` + `aria-modal` + 焦点陷阱 + ESC + 焦点还原），
  与 P2（v0.67）既有规范对齐。
- **加载错误态**：创意市场主页 `listPublished` 失败不再静默吞成空态 —— 显示错误条 + 「重试」（沿用
  `/operations` 内联卡片样式），空态加 `!error` 门控避免「后端挂了却显示『还没有创意』」。
- **详情弹窗重设计（不外露 payload）**：`RecipeDetailModal` 由「逐集列 beats / 列 character 描述 /
  展示 mainline·notes 原文」改为**营销式预览卡**（设计评审 3 版择优合成，editorial + 社会证明嫁接）——
  顶部范例视频 hero（`previewVideo` 有值→点播放真 video / 竖屏 contain；为空→「范例视频整理中」占位）+
  作者署名/大标题叠层 + 🔥「N 人用过」社会证明徽标；「简介 / 套用你会得到什么」双 tab：简介=summary+题材/
  集数/画幅 tag+更新时间，内容 tab=**高层能力清单 teaser**（主线骨架 / N 段分集节拍 / M 个角色原型 /
  完整分镜方案，只讲「套用后得到什么」不展开具体文字）。
- **previewVideo 字段端到端**：`DramaRecipe` 加列 `preview_video`（镜像 `cover_image`，静态营销素材
  `/recipes/<id>.mp4`）+ `toDto` 出 wire + `DramaRecipeSeeder` 映射（seed JSON 加 `"previewVideo"` 即生效）+
  前端 `recipes.ts` 类型 `previewVideo?`。openapi 这批 recipe 端点宽松定义（无 schema 组件）无需改。

**门禁全绿**：server `DramaRecipeServiceTest` 22/22 + `pnpm check:api-contract` + web-drama
`typecheck`/`build`。Mock 模式浏览器实测：详情弹窗 `role=dialog`/`aria-label`/焦点陷阱/ESC 关闭均生效；
重设计弹窗双 tab 渲染正确、payload 三处细节（mainline/notes/beat）零泄露、Flame 社会证明 + 视频占位 + 强化
CTA 到位、零 console error。

---

## 短剧线（web-drama）· 当前未完成事项（截至 v0.75，2026-06-13）

> 核心创作 → 渲染 → 分发 → 抽 skill 飞轮闭环已全部真后端落地并提交。以下为剩余项，按性质分层。
> 单项细节在各自版本节，本表只做集中索引，避免散落漂移。

**功能缺口（需外部联动 / 后续版本，非纯前端能收尾）**

- **真实平台发布 OAuth**：`DramaDistributionService` 当前是服务端模拟状态机（queued→uploading→
  transcoding→publishing→live），14 个平台目录已备好但不真传。接入抖音 / 视频号开放平台 API 由
  **sau-service** 后续完成，drama 侧仅做任务派发与状态管理（架构已预留）。
- **数字人成片用脸**（v0.74+ 规划）：drama 已能引入 AiAvatar（`import-avatar` + `dapDisplayRef`），
  但成片角色脸尚未真用数字人作 i2i 身份输入，仍是普通 img2img；需复用 dap imageKey / derivatives 资产。
- **生产视频超时调优**：`AEP_VIDEO_MAX_WAIT_SEC` 需按 agnes 视频实际延迟（>10min）在生产 env 调高。
- **Recipe 抽取计费**（可选）：当前抽取不扣费；如需计费加 `drama.credit.recipe-extract`。

**有意的设计决策（非缺口，列此防误判为待办）**

- **运营动作放 web-drama `/operations`，不进 admin**：Recipe 审核发布、平台目录（catalog）维护都在
  web-drama 端（OPERATOR 权限），admin 只保留扣费（`/drama/config`）与 prompt（`/drama/prompts`）等
  平台级配置。这是「子应用自运营」模式（类比 celebrity 端侧运营），有意为之。
- **素材库 mock**：wardrobe / pose / community / artists / film 等仍走 mock，刻意避免素材管理复杂度，
  不在核心创作路径上。

**工程 / 文档长尾**

- **admin `/content/dramas`** 仍是占位页：「已发布内容库 / 统计 / 下架」待做，但前提是先澄清 drama 是否需要
  「上架」概念（目前直接分发，无上架阶段）。
- **inline style D-3**：~1615 处，已定性为「按重复模式渐进提取」（v0.67 起 `.icon-badge`），非债务，可续。
---

### v0.76（2026-06-13）— 短剧 / 短视频制作支持「草稿」（刷新 / 返回不再丢进度）

**背景**：用户反馈「短剧和短视频制作，做到一半，刷新返回就没了」。排查发现两条链路根因不同：
- **短视频制作（`/shorts/make`）**：整页纯 React 内存态（脚本 / 分镜 / 首帧 / 片段 / AI 对话），唯一跨页的
  `idea` 存 sessionStorage 且读一次即删；「合成成片」按钮无任何 API 调用 —— **后端零持久化**，刷新即全丢。
- **短剧大纲（outline 阶段）**：项目本有 `DramaProject` 落库，但大纲的**拖拽调序 / 加一集 / 改梗概**
  都只改内存不落库（只「AI 生成」「锁定」才存）；「加一集」「重写梗概」还是假 toast。其余阶段
  （epscript / factory / cast）早已防抖落库（含出片产物）。

**方案**（用户决策：短视频建专用后端草稿表 + 两线统一「自动保存 + 离开提醒兜底」）：

后端（新实体，§5 SOP）：
- `DramaShort`（`drama_shorts` 表，ddl-auto 建）+ `DramaShortRepository` + `DramaShortService` + `DramaShortController`。
  整页编辑态 `payloadJson` = `ShortDraftData{step,meta,shots[],chat[],refs,idea,reopen,fmtKey}`；列表卡片核心列
  `title/fmtKey/fmtName/cover/durationSec/shotCount/doneCount/status(draft|done)/progress` 在保存时按
  `payload.shots` 回算。CRUD 按 `ownerUserId` 隔离 + 软删。端点 `/api/me/drama/shorts/**`（list/create/get/save/delete）。
  **不碰 AI / 计费**：出脚本 / 出片仍走既有 `/me/drama/scripts/ai-draft`、`/me/drama/render/*`。
- 测试 `DramaShortServiceTest` 4/4（新建 seed / 整页保存回算 / 完成态 / 归属隔离 + 软删）。

前端（apps/web-drama）：
- `api/shorts.ts`（`ShortsApi`，带 USE_MOCK 进程内存表）。`/shorts/make` 重构为「网关 + 制作页」：
  进页有 `?draft=id` 则读，无则按 fmt / idea / reopen 建草稿并把 id 写进 URL（刷新即命中读取分支）；
  整页状态防抖（1.2s）自动保存；「合成成片」`flushSave({status:'done'})` 后跳转；返回工坊前 flush。
- `/shorts` 工坊列表改读真后端草稿卡（草稿 / 已完成 + 进度 + 接着做）。
- 短剧 outline：调序 / 加一集 / 钩子 + 梗概行内编辑全部即时 `ctx.saveData` 落库（删假「重写梗概」按钮）。
- 共用 `lib/use-save-status.ts`（`useSaveStatus`：编辑代际 vs 已保存代际判脏）+ `save-status.tsx` 指示器
  （「保存中 / 已自动保存 / 保存失败」）+ `beforeunload` 离开提醒兜底；短剧工作台与短视频制作页共用。
  `StageContext` 加 `notifyEditing`（epscript / cast 防抖落库前标脏，指示器 + 兜底即时反映）。

**门禁全绿**：server compile + `DramaShortServiceTest` 4/4；`pnpm check:api-contract` OK；web-drama `typecheck` OK。
**全链路真机验收**（8088 server + web-drama → 8088，真实浏览器，dev-login 默认 STUDIO）：
① 短视频：建草稿 → URL 带 `?draft=`，编辑后切「视频工厂」步 → 顶部「已自动保存」；**hard reload** 后
URL 仍带 id、步骤 / 分镜 / 出片产物 / meta 全部恢复（含 `step=script` 的编辑也存活）；`/shorts` 列表见草稿卡
（0:15 · 草稿 · 1/2 镜）。② 短剧：项目大纲点「加一集」→ 后端 4 集 + 「已自动保存」→ **hard reload** 后大纲
仍是 01–04。**生产可上线**。

**版本号注**：本提交在 v0.73 分支线（`claude/competent-cartwright-e3c442`）并入 loving-maxwell 后记 v0.76（v0.74/0.75 已被官方配方 seeder / 创意市场占用）；并行分支
（`claude/loving-maxwell-qun0yw`）另有「创意市场 v0.74-75」不同特性，两线合并时需把版本号 / 文档归一。

### v0.77（2026-06-14）— 创意市场「套用」按单 / 多集分流（单集创意改去短视频工厂）

**背景**：用户反馈「创意市场套模版的逻辑错了，单极模版应该匹配去短视频」。原 `applyRecipe`（即旧
`applyToNewProject`）无论创意是单集还是多集，**一律新建六阶段短剧项目并跳 `/projects/{id}`**。但创意市场里
官方内置的 19 条全是 `episodes=1` 的「风格短片」（单集），套用后被丢进六阶段分集工作台 —— 形态完全不对。

**方案**（按创意 episodes 分流，路径不变 / 仅响应体变；无新表）：
- 后端 `DramaRecipeService.applyToNewProject` → 改名 `applyRecipe`，按 `episodes`：
  - **多集（&gt;1）** → 维持原逻辑：新建 `DramaProject`（mode=template + 分集骨架），返回 `{ kind:"project", projectId }`。
  - **单集（≤1）** → 新建一条 `DramaShort` 短视频草稿，返回 `{ kind:"short", shortId }`。两形态都累加 `useCount`。
- `DramaShortService.createFromRecipe(...)`：把创意的一句话说明 + 可迁移主线蒸成 `styleRef`（+ `styleName`）
  落进 `ShortDraftData`，**不套短视频模版**（`fmtKey=null`）；短视频工厂出脚本时把 `styleRef` 当风格参考
  （照创意风格拆用户主题，而非复述创意说明）。`ShortDraftData` 加可选 `styleName` / `styleRef`（自动保存随整页 deep-copy 落库）。
- 前端 `templates/page.tsx` 套用按 `kind` 分跳：单集 → `/shorts/make?draft=`、多集 → `/projects/{id}`；
  详情弹窗「套用你会得到什么」对单集如实改写（进短视频工厂逐镜出片，非六阶段）。`/shorts/make`
  顶栏标题 / AI 开场白识别 `styleName` 显示「已套用【XX】创意风格」。
- 契约：`/me/drama/recipes/{id}/apply` 路径与方法不变（openapi 该端点本就只声明 200，无 schema），仅响应体由
  `{projectId}` 变为判别式 `{kind, projectId|shortId}`，无需改 openapi。

**门禁全绿**：server compile + `DramaRecipeServiceTest` 24/24（+2：单集→短视频草稿 / 多集→项目）+
`DramaShortServiceTest` 4/4；`pnpm check:api-contract` OK；web-drama `typecheck` + `build` OK。
**真机浏览器验收**（mock 模式）：创意市场单集「韦斯·安德森风格短片」套用 → 跳 `/shorts/make?draft=`、
工厂顶栏 + AI 开场白显示已套用该创意风格、无报错、已自动保存；多集「反转悬疑·80 集」套用 → 仍跳 `/projects/`。

### v0.78（2026-06-14）— 统一 TipTap 输入组件 + 短视频新建流程重做（去重 + 引用 chip + 进工作台真扣费）

**背景**：用户三件事——① 把对话框输入「做成 TipTap」，全站输入处复用同一套（先落地短视频新建）；
② 重做短视频新建流程：首页短视频 tab 点创意推荐 → 预览弹窗下方只留一个「试试同款」→ 以引用 chip 形态进对话框
→ 开始制作进工作台（**这一跳真消耗积分，且可配，原写死 10**）→ 对话框内容带进工厂；③ `/shorts/new`「又重复实现了一套」
（`ShortCreateDialog` 用写死的 `SHORT_FORMATS`，不是创意中心），改成复用首页。

**关键发现**：原首页那个 `10` 只是 `CreditButton` 确认弹窗的展示数字 —— **进工作台并不真扣**，
`DramaShortService.createShort` 无任何 `CreditService`；短视频「AI 出口播脚本和分镜」（`DramaScriptService.aiDraft`，
进页 idea 非空时自动跑）**也不收费**，真正扣费只发生在逐镜首帧/出片。所以把「进工作台」做成真扣费 = 落在
**新建草稿** 这一步，且不与下游出图/出片重复（用户决策：「进工作台真实扣一笔」）。

**A. 后端 · 进工作台开拍真扣费（可配）**
- `DramaConfigSeeder` 加 key `drama.credit.short-entry`（默认 10）；`DramaConfigController` 暴露 `prices.shortEntry`。
- `DramaShortService` 注入 `CreditService` + `PlatformConfigService`，新增 `withEntryCharge`（hold→建草稿→commit，
  失败 release，价≤0 跳过，refType `DRAMA_SHORT`），包住 `createShort`（自建）与 `createFromRecipe`（套用单集创意）。
  二者皆「新建草稿 = 进工作台」各扣一次；**重开已有草稿走 `getShort`，不计费**。
- 客户端 `api/drama-config.ts`（`DramaCreditPrices.shortEntry` + 默认 10）+ admin `drama/config/page.tsx` 注册该 key。
- 测试：`DramaShortServiceTest` 4→8（hold+commit 一次 / 套用单集计一次 / 价 0 跳过 / 失败 release 不 commit 且不落库）。

**B. 复用 TipTap 输入组件 `DramaComposer`**（`components/drama-workshop/composer.tsx` + `composer-ref.ts`）
- 首个编辑器依赖：`@tiptap/react`+`pm`+`starter-kit`+`extension-placeholder`（v2.27，React 19 兼容；
  `immediatelyRender:false` 解决 Next 16 SSR hydration）。
- 「引用 chip 托盘 + 富文本正文」一体：`ComposerRef{kind,label,sub,from,to}` + `COMPOSER_REF_META`（kind→图标/中文名，
  加类型只动一处）；命令式句柄 `setText/getText/focus/clear`（给我灵感 / 回填用，不打断光标）；回车提交、Shift+回车换行、
  输入法合成中不拦截。占位符 CSS 落 `styles/app.css`（`.drama-composer .ProseMirror`）。

**C. 短视频新建流程重做（去重 + 引用 chip）**
- 新建 `ShortCreateConsole`（`variant=home|standalone`）—— 短视频创建唯一真源：`DramaComposer` 对话框 +
  创意市场**单集创意**（`RecipesApi.listPublished` 过滤 `episodes≤1`）创意推荐 + 给我灵感 + 开始制作。
- 首页 `dashboard/page.tsx`：短视频 tab 渲染 `<ShortCreateConsole variant="home"/>`；短剧 tab 维持原内联控制台
  （把短/剧共用的 `recipePromptSeed/recipeTags/recipeBeats/recipeEstimate` 抽到 `recipe-preview.ts` 共用）。
- `/shorts/new`：改渲染 `<ShortCreateConsole variant="standalone"/>`（带返回工坊头）；**删 `short-create-dialog.tsx`**
  （写死 `SHORT_FORMATS` 的重复实现）。
- 交互：点创意卡 → 预览弹窗下方**只一个「试试同款」** → 以引用 chip 进 `DramaComposer`（不自动填正文，留给用户补主题）
  → 开始制作（`CreditButton cost=cfg.prices.shortEntry` 确认）→ 带创意：`applyRecipe`（后端按风格 seed 草稿 + 扣费）
  + 自由主题经 `sessionStorage` 带入；纯点子：进工厂 `createShort` 扣费。`/shorts/make` 网关把带入的自由主题注入
  创意草稿（idea 空且无分镜时），工厂据「创意风格 + 你的主题」起草。

**门禁全绿**：server compile + 全量 drama 测试 48/48（`DramaShortServiceTest` 8 + `DramaRecipeServiceTest` 24 +
`DramaProjectServiceTest` 13 + `DramaRecipeSeederTest` 3）；`pnpm typecheck:admin` + `check:api-contract` OK；
web-drama `typecheck` + `vitest` 28/28 + `build`（含 TipTap SSR）全绿。
**契约**：路径/方法不变 —— 仅 `POST /me/drama/shorts` 行为加「进工作台扣费」、`GET /me/drama/config` 响应加
`prices.shortEntry`（openapi summary 已同步）。

### v0.84（2026-06-22）— 验证码登录未注册时免重输验证码（注册凭证 register ticket）

**痛点**：手机号验证码登录通过、但发现未注册 → 引导切到注册填激活码时，验证码又得重输一遍。
根因有两层：① `SmsCodeService.verifyCode` 成功即 `store.remove` 销毁码（防重放）；② 发码绑定
`purpose`（login/register），登录码无法用于注册校验（`SMS_CODE_NOT_REQUESTED`）。所以即便把码带过去也没用。

**方案（注册凭证）**：
- `JwtUtil.generateRegisterTicket(phone)` / `verifyRegisterTicket(ticket)→phone`：HMAC 签名、
  `typ=sms-register`、subject=手机号、TTL 10 分钟，不可伪造、与登录 JWT 区分。
- `POST /auth/sms/verify`：验证码通过但用户未注册 → 签发凭证，放进 404 `USER_NOT_FOUND` 的
  `error.details = { registerTicket, phone }` 回带（验证码仍已被消费，故用凭证而非透传旧码）。
- `POST /auth/sms/register`：新增可选 `registerTicket`。带有效凭证且手机号一致 → 跳过短信码校验；
  否则走原「register 用途验证码」路径（直接打开注册页的用户不受影响）。凭证无效/过期且未退回手输
  → 401 `REGISTER_TICKET_EXPIRED`，前端据此回退到验证码输入。
- 前端三处登录页（`web-celebrity` 独立页 / 共享 `packages/landing/AuthScreen`（music+drama）/
  `web-aiavatar` `screen-login`）：登录捕获 `USER_NOT_FOUND` 时取 `details.registerTicket+phone`，
  切到注册页预填手机号（只读）、以「✓ 手机号已验证」替换验证码输入框，提交带 `registerTicket`；
  凭证过期则清空回退手输。手动点「注册」tab 走全新流程（不带可能过期的凭证）。
- api-client `SmsRegisterPayload`：`code` 改可选、加 `registerTicket?`；新增 `SmsRegisterTicketDetails` 类型。
  `apps/web-aiavatar` 给 `UI.Input` 加 `disabled` 透传（用于锁定已验证手机号）。

**门禁全绿**：server compile + `JwtUtilTest` 5/5（凭证签发/校验/防篡改/类型隔离）+
`SmsAuthControllerTest` 10/10（**端到端 happy path**：未注册手机号→短信验证码登录拿 404 凭证→把该凭证喂回
register→注册并登录成功，全程不重输验证码；+ 登录未注册→404 带可验证凭证 / 登录已注册→token；
注册带有效凭证跳过验码 / 无凭证走 REGISTER 验码 / 凭证无效但带验证码回退 / 凭证手机号不符且无验证码→401 /
缺激活码→400 / 已注册→409 / 验码失败不激活；**SMS 发码与验码全程 Mockito mock，不发真实短信**）；
`web-{celebrity,aiavatar,music,drama}` typecheck + `check:api-contract` OK。
**契约**：路径/方法不变 —— `sms/register` 请求体加 `registerTicket`、`code` 改可选、`platform` enum 补 `aiavatar`、
加 401 `REGISTER_TICKET_EXPIRED`；`sms/verify` 404 details 形状已在 openapi 标注。

### v0.87（2026-06-28）— 首页「跟 AI 聊出故事」脑暴链路（设计稿 `AI短剧工作台.dc.html` 还原）

**背景**：设计稿首页是**对话式脑暴**——随口说一个念头 → 左侧与 AI 脑暴 → 右侧生成可编辑的「故事大纲」（标题/剧情脉络/一句话简介/核心人物/取景参考/制作设置 形态+尺寸）→「去制作」。
旧首页是「一句话点子 → 立即 `createProject`」，无对话、无立项前可编辑大纲。本版还原设计稿的 首页→对话→剧本/分镜生成 整链入口。

**核心决策**：脑暴是**立项之前的可恢复草稿**，用户决定形态（剧集/单片）前不污染 `DramaProject`（短剧工坊）/ `DramaShort`（短视频工坊）。
故新实体 `DramaBrainstorm` 承载，「去制作」时才按形态 promote 成项目或短视频。AI 对话/大纲**免费**（与 recipe/script-draft 一致，设计稿也无积分提示）。

**后端**：
- 新实体 `DramaBrainstorm`（`drama_brainstorms` 表，ddl-auto；列 id(`brs_`)/ownerUserId/title/status(`draft`|`promoted`)/promotedKind/promotedId/payloadJson/createdAt/updatedAt/deletedAt 软删）。
  `payloadJson` = 前端 `api/brainstorm.ts` 的 `BrainstormData`（`{seed?,direction?,messages[{role,text,quick?}],outline:OutlineDraft|null,settings{form:'series'|'single',ratio,episodes?}}`；
  `OutlineDraft{title,type,tone,logline,mainline,beats[],roles[{name,role}],scenes[]}`）。
- `DramaBrainstormService` + `DramaBrainstormController`（`/api/me/drama/brainstorms/**`）：
  `GET`(列表 继续上次脑暴) / `POST`(新建 seed 开场白 + 默认设置) / `GET {id}`(恢复) / `PUT {id}`(自动保存整页 + 回算标题) / `DELETE {id}`(软删) /
  `POST {id}/chat`(AI 对话 `{text,messages?}`→`{message:{role,text,quick}}`) / `POST {id}/outline`(由对话生成大纲 `{messages?}`→`{outline}`) /
  `POST {id}/promote`(去制作 `{form?,data?}`→`{kind,projectId|shortId}`)。
- AI 走 `DRAMA_SCRIPT_DRAFT` 端点绑定 + 新 prompt key `drama.brainstorm_chat`/`drama.brainstorm_outline`（`PromptService` 加 key + `KNOWN_KEYS` + resource `prompts/material/drama.brainstorm_{chat,outline}.md`）。
  **免费**（无 `CreditService`），`chat`/`outline` **不落库**（前端合并后 PUT，防前后端并发覆盖；与 `outlineAiDraft`/`epscriptAiDraft` 同惯例）。
- **§8.0**：端点未绑 503 `AI_NOT_CONFIGURED` / prompt 未配 503 `PROMPT_NOT_CONFIGURED` / 调用失败 502 `AI_CALL_FAILED` / 解析失败 502 `AI_BAD_OUTPUT`，均不产假数据。
- **promote**：`series`→`DramaProjectService.createProject`（免费立项）+ `saveProject` 把大纲 `roles` 预填为项目 `characters`（前两个 / 含「主」判 key）；`single`→`DramaShortService.createFromRecipe`（扣 `drama.credit.short-entry`）。
  脑暴标 `promoted` 且**幂等**（已 promote 直接回原去向，不重复立项/扣费）。

**前端（web-drama）**：
- 新 `api/brainstorm.ts`（`BrainstormApi`，TS 接口即契约真源）+ 加入 `api/index.ts` barrel。USE_MOCK 进程内存表 + canned AI（仿 `_aiReplies`/`_outlineFor`），promote 复用 projects/shorts mock 建实体。
- 重建 `/dashboard`：`<Suspense>` 包 `DashboardSwitch`，`?b=<id>` 渲染 `BrainstormStudio`（chatOn），否则 `HomeLanding`（chatOff）。
  chatOff：一句话输入 + 近期热点 chips + 今日灵感/套爆款模板/跟 AI 聊出故事 + **开始脑暴** + 爆款配方网格（保留预览 + 用这个开拍）+ **继续脑暴**（未完成草稿）+ 继续上次。
  chatOn：左 AI 脑暴对话（消息 + quick 追问 chips + 输入框）/ 右 故事大纲（空→生成中骨架→已生成；标题/logline/核心人物用 `drama-ui Editable` 行内编辑，制作设置 形态+尺寸 分段控件）+ 底部「去制作」。
  `?b=` 入 URL、`useSaveStatus` 防抖自动保存、刷新/返回可恢复；带 seed 进来自动发首条点子触发首条 AI 回复。
- `app.css` 加脑暴/改图共用动效与可编辑态（`typing-dot`+`typingBlink` / `gen-pulse`+`genPulse` / `gen-reveal` / `chat-anim` / `edit-field` / `chat-input:focus`，均 reduced-motion 友好）。

**门禁**：`DramaBrainstormServiceTest` 15/15 + 全量 74 drama 单测绿（含 `PromptServiceDramaResourceTest` 4/4 校验新 resource prompt）；
`typecheck:all` 10/10 + web-drama production build（29 路由）+ `check:api-contract` 全绿；openapi 加 6 path stub；`scripts/dev-fake-llm-server.mjs` 加脑暴 chat/outline JSON 分支（先于「分集大纲」分支，按指令标记 `请作为脑暴助手回复`/`整理成一份故事大纲` 命中）。
**真实 server + fake-llm API 级 E2E 24 断言**全过：dev-login(`studio_starlight`) → 新建脑暴(seed) → chat(AI 回复+quick) → PUT 保存 → outline(标题/脉络/人物/取景) → 改设置 → GET 恢复(对话/大纲/设置/卡片 meta) → promote 项目(标题/集数/logline/角色预填) → 幂等(同 projectId + status=promoted) → promote 单片(真实 DramaShort)。

**待续（设计稿剩余对齐项，见 `TODO.md` D-9，需浏览器可视验证）**：工作台 短剧设定 两视图合并 / 剧集脚本 平铺分镜表 / 首帧 AI 改图弹窗 / 短视频制作单页化。

### v0.88（2026-06-28）— 短剧工作台对齐设计稿（全栈 · 渲染数据后端读取 · 编辑落库草稿态）

承 v0.87 首页脑暴链路，继续把设计稿 `AI短剧工作台.dc.html` 的工作台与短视频还原，并满足用户两条硬要求：
**① 所有前端渲染的数据从后端读取（不前端写死，调试 mock 允许）；② 所有编辑落库为草稿态、可回溯。**
分镜内容（场景/对白/音效/特效）以**结构化字段**存储，后续作视频生成 LLM 提示词（设计本就如此，本版强化）。

**数据模型（均在 wholesale `ProjectData.payloadJson` 文档内，无新表/新端点）**：
- `ProjectData.scenes: SceneAsset[]`（`{id,name,mood,refUrl?,refCdnKey?}`）—— 项目级场景设定，去掉前端写死的 `SCENE_LIB`。
- `ProjectData.outlinePrefs{scope,dur}` —— 大纲分集 AI 参数落库。
- `EpisodeDoc.meta{plot,style,cast}` —— 本集叙事/作品风格/出场人物落库（此前仅内存即丢）。
- `BoardShot` 加结构化 `sfx/bgm/fx`（设计稿分镜表三件套）。

**后端**：`DramaProjectService.seedProjectData` seed `scenes:[]`+`outlinePrefs(trial)`；`normalizeShot` 默认 `sfx/bgm/fx`；
`DramaBrainstormService.promote(series)` 由大纲「取景参考」预填项目 `scenes`（新 `scenesFromOutline`，与 `characters` 同惯例）。
AI 改图复用 `POST /me/drama/render/frame`（`ref_images` 迭代），无新端点。`dev-fake-llm` 的 `/v1/images/generations` 占位图换可见暖橙 PNG。

**前端（web-drama）**：
- 短剧设定单页 `stages/setup.tsx`（`OutlineStage`/`CastStage` 加 `embedded`）+ 左轨两步 `stage-rail.tsx`；
  场景渲染 `data.scenes`、name/mood 可编辑 + 生成参考图 + 加/删（落库）；`outlinePrefs` scope/dur 落库；加个角色落库。
- 剧集脚本平铺分镜表 `storyboard-table.tsx`（设计稿表格，每格 `Editable` 结构化可编辑）替代 per-scene `ShotFormCard`（`shot-form.tsx` 保留供短视频用）；
  `epscript.tsx` 的 plot/style/cast 落库 `episodeDocs[ep].meta`。
- AI 改图弹窗（`storyboard-table.tsx` 内）：左指令对话 + 右 9:16 预览 + 版本号，`renderFrame` + ref 图迭代回填落库。
- 短视频 `/shorts/make` 单页化：去步骤切换 → 单页（左口播对话 / 右 短视频大纲[口播种草 + beat 流] + 分镜脚本，逐镜内联出片），`meta.style` 可编辑落库，每镜 beat 语义标签，删退役工厂网格。

**门禁 / 验收**：`typecheck:all` 10/10 + web-drama build（29 路由）+ `check:api-contract` + 全量 74 drama 单测 全绿；
**真实 server + fake-llm 浏览器（CDP headless，无 Playwright，Node 内置 WebSocket 自建驱动）可视验收**——
截图核对 首页 chatOff/chatOn+大纲、短剧设定（剧情大纲+角色+场景卡）、剧集脚本分镜表、AI 改图弹窗；
**持久化 API E2E** 全过：场景 name/mood/refUrl、大纲 scope/dur、本集 meta（叙事/风格/出场人物）、分镜结构化 sfx/bgm/fx 均落库 + GET 恢复。

**D-9 设计稿剩余对齐项①–⑤ 全部完成**（短剧设定单页 / 平铺分镜表 / AI 改图弹窗 / 短视频单页 / 编辑落库），均经 CDP headless 浏览器截图可视验收。

### v0.94（2026-06-29）— 支付多渠道直连（删 jeepay + 微信支付 V3 + 运行时 admin 可配）

充值支付从「env 固定单一 driver（jeepay 聚合，休眠）」重构为「多渠道直连 + 运行时 admin 配置 + 用户收银台自选」。分 5 阶段落地（同分支连续提交）：

1. **删 jeepay 聚合网关**：JeepayPaymentGateway / JeepaySignUtil / PayNotifyController + 3 测试整除；清理 PaymentProperties / PaymentService / yml / env / openapi / 前端类型 / 文档全部引用（从未对接真实实例，§8.0 风险面）。
2. **运行时多渠道配置**：新实体 `PaymentChannelConfig`（`aep_payment_channels`：code/enabled/sandbox/label/sortOrder/defaultWayCode/`credsEncrypted`/version）+ `PaymentChannelConfigService`（机密整块 AES-GCM 加解密复用 `AepCryptoUtil`、脱敏出 wire、upsert 合并[空=保留/`__CLEAR__`=清空/启用前校验齐全]、`seedFromEnvIfAbsent` 把旧 env 平滑迁库）+ `PaymentChannelCatalog`（渠道元数据单一事实源 + `channelFromWayCode`）+ `PaymentGatewayRegistry`（注入全部网关按 driverName 索引）。网关去 `@ConditionalOnProperty`：Alipay 改惰性 `ensureConfigured()`（按 version 缓存重配全局 Factory）；Shadow 常驻、`aep.payment.shadow.enabled` 门控。`PaymentService` 用 registry+config（checkout(channel) + enabledChannels() + syncOrder 按 wayCode 路由）；`PaymentReconcileService` 按订单渠道路由查单。
3. **微信支付直连 V3**：`WechatPaymentGateway`（官方 `wechatpay-java` 0.2.15）—— Native 扫码（code_url→qr）/ JSAPI 小程序（prepay+商户私钥 RSA 签 wx.requestPayment 参数，需 openid）/ H5（h5_url→redirect）+ 查单；`WechatNotifyController`（`/api/pay/notify/wechat`，V3 验签 + AES-GCM 解密收口在 gateway.parseNotify → 校验 + 幂等 settle）。
4. **admin「支付配置」后台**：`AdminPaymentConfigController`（`/api/admin/payment/channels`，FINANCE_ADMIN）GET 脱敏 / PUT 改启用·沙箱·机密 / POST test；admin 前端页（每渠道卡片：启用·沙箱开关 + 默认支付方式 + 机密表单[留空=保留，脱敏占位] + 保存/自检）+ nav 入口。
5. **收银台多渠道前端**：web-celebrity / web-drama 收银台从写死「仅支付宝」改为 `GET /me/wallet/recharge/channels` 动态列渠道供用户自选；按 payDataType 渲染（page 表单 / qr 本地 `qrcode` 渲二维码[token 不外发] / redirect 跳转 / shadow），网页端隐藏微信 JSAPI（小程序消费方承载）。

**入账幂等不变**：所有渠道回调 / 查单兜底共用 `settlePaidOrder`（条件 UPDATE 抢占），重复无害。机密永不明文出 wire；渠道启用但机密缺失 → 下单/回调期 503 `PAYMENT_CHANNEL_NOT_CONFIGURED`，绝不静默回退 shadow（§8.0）。

**门禁**：server compile + 支付单测全绿（PaymentService 6 / PaymentReconcile 5 / Alipay 6 / AlipayNotify 5 / Wechat 5 / WechatNotify 5 / PaymentChannelConfig 6 / Recharge 16）+ `typecheck:all` 10/10 + web-celebrity build + web-drama build（+vitest 35）+ `check:api-contract` 全绿。openapi 加 `/me/wallet/recharge/channels`、`/pay/notify/wechat`、`/admin/payment/channels*`；删 `/pay/notify/jeepay`。env 模版 §15 改为「机密首选后台 DB 配，env 仅 bootstrap」。

### v0.103（2026-07-12）— 短剧前端 UX 精细化打磨（纯前端，无新端点 / 无实体变更）

web-drama 四批体验打磨 + 审查修复，后端零改动、无契约变更。

1. **可达性**：`DramaConfirmDialog` / AI 改图弹窗 / `AvatarPicker` / 两处全屏分镜表弹窗补 `role`/`aria-modal`/Esc/focus trap（复用 `useModalA11y`）；`useModalA11y` 升级为**弹窗栈**——多层叠加时 Esc 与焦点陷阱只作用于栈顶。分镜表时长/说话人/场景参考控件补 `aria-label`；distribution 图标按钮补 aria。
2. **扣费体验**：出片「积分确认 + 一致性警告」双弹窗合并为单弹窗（`CreditButton` 新增 `getWarnings`，弹窗合并展示问题清单 + 费用，按钮「仍要继续 / 先去补齐」）；AI 改图弹窗费用前置（「每次生成消耗 N 积分」+ 首次发送确认）；脑暴「制作短视频」补 `CreditMark` + 阈值确认；互动剧 AI 起草确认注明将消耗积分。
3. **异步韧性**：`shorts/make` 渲染任务恢复（`ShortDraftShot` 加可选 `pendingJob` 字段随 `payloadJson` 持久化，进页 `listRenderTasks` 对账回填 / 恢复轮询；轮询超时不再当失败，提示后台继续，`POLL_TIMEOUT_MESSAGE` 常量全等判定）；一键连跑显示进度 X/N + 可停止；`useSaveStatus` 新增 dirty 态（「编辑中」），不再在防抖期谎报「保存中」。
4. **状态与视觉**：shorts 列表补 skeleton / error 态；templates/published 区分错误与空态；operations 双区独立未发布守卫（黄条 + beforeunload）；distribution 浅色主题隐形填充改语义 token、任务行项目 ID 改标题显示、平台空态、去「建设中」徽标；面包屑兜底映射（`/trash` 等）；全局搜索占位纠偏；wallet / distribution KPI 网格 `auto-fit` 响应式；影子支付按钮去 emoji；页头统一 `ViewHeader`（projects / shorts / templates / trash / operations）；多处溢出保护与 @提及浮层滚动关闭；删死代码 `projects/_dialogs/NewProjectDialog.tsx`。
5. **门禁**：`typecheck:all` 10/10 + web-drama build + `check:api-contract` 全绿；4 个既有 vitest 失败为 main 基线旧账（stash 对比确认）。真机浏览器走查通过（弹窗栈 / 合并确认 / 费用前置 / 面包屑 / 响应式）。**发现待办**（记 TODO.md 2026-07-12 段）：`drama.credit.interactive-draft` 单价未进 `GET /me/drama/config`、`shorts/make` 本地 `EditableField` 与 drama-ui `Editable` 未合并、distribution 平台卡名称列过窄换行、operations 未发布守卫缺 App Router 路由级拦截。

### v0.102（2026-07-10）— 短剧一致性引擎 C-3（服务端参考装配 + 双线共享 useShotRender）

一致性引擎 C 序列 L1 收官（真源 `docs/[Fabel5]drama-consistency-engine-design.md` §5）。把此前散落前端 `epscript.tsx:shotRefImages` 的参考图优先级链下沉服务端，render 接口收镜头坐标 `shot_ref`（保留 `ref_slots`/`ref_images` 过渡兼容），服务端按项目文档 + 角色/场景实体自装配并按端点 capability（D-11）裁剪、回报精确槽位 `applied_refs`；前端重建共享 `useShotRender` hook，工作台分镜表与短视频工坊两线共用（收敛 P-6 重复）。

1. **新服务 `DramaReferenceAssembler`**（`@Service`）：**只读文档/实体、绝不回写 `payloadJson`**（§6.1，不新增服务端文档写者）。三级入参优先级 `shot_ref` > `ref_slots` > `ref_images`（老前端数组直通兼容：只做 fetchable/capability 裁剪 + `applied_refs` 回报）；`ref_leading` 置顶锚（拆镜末帧出图的本镜首帧）。
   - 角色参考：`shot.cast` @提及 → 画面文本名兜底 → 本项目全体；每角色 `drama_character.refImages`（angle=front 优先）→ 实体缺失兜底文档 `avatarImage/refUrl`。
   - 场景参考：显式 `sceneRefId`（storyboard BoardScene / script ScriptScene）→ `drama_scene.refImages` → 文档 `refUrl`；否则 `ScriptScene.place` 名称匹配 `SceneAsset.name` 兜底。
   - 同场上一镜真实末帧：**文档优先（`lastFrameUrl ?? frameUrl ?? frameUrls[0]`）+ `MaterialVideoJob` 权威回退**——`variant_config` 内存扫描 succeeded 任务，读 C-1 的 `lastFrameCdnKey`→`signKey`（不用会过期的 `lastFrameUrl`；这正是 C-1 是 C-3 隐性前置的原因）。同场下一镜开场首帧作 clip 尾帧。
2. **capability 裁剪（纯函数 `classifyImageRefs`/`classifyClipFrames`）**：capability 用 D-11 candidate（未配置 null → legacy 兼容默认 `maxRefImages=6` = v0.97 前端 `slice(0,6)` 既有上限；视频首尾帧 null → C-1 协议关键字静态判定；**回归修正**：初版误按保守默认 1，会让 seeder 回填的全 null 存量候选在升级当天把多参考一致性削到 1 张，已改 legacy 默认，显式配置仍最高优先），裁剪优先级保 identity `character_refs > scene_ref > prev_last_frame`（末位先砍）；去重保先/高优先；超出标 `over_max_refs`，本地 `/cdn` 标 `local_unfetchable`（如实回报不静默，§8.0/§6.2）。`applied_refs.items[].role` 从 C-1 粗粒度 `ref` 升级为精确槽位（character/scene/prev_last_frame/first_frame/last_frame）。
3. **`DramaRenderService` 接入**：`renderFrame`/`renderClip` 统一走 `resolveEndpoint(purpose, endpointId)`（null→默认，携 candidate capability）→ `DramaReferenceAssembler.assembleFrame/assembleClip`。frame 用 `maxRefImages` 裁剪 image[]；clip 首尾帧能力候选显式 `supportsFirstLastFrame` 优先、否则关键字启发式（agnes 仅首帧），首/末帧由 shot_ref 服务端派生（显式 `frame_url/last_frame_url` 仍优先）。删旧 `computeClipAppliedRefs`/`appliedRefsJson`（并入 Assembler），保 `computeFrameAppliedRefs`（角色三视图锁脸参考仍用）。frame-job 后台路径（`DramaFrameJobWorker` 回放 body）透明支持 shot_ref。
4. **前端共享 `lib/use-shot-render.ts`**（放 lib 不随 stage 陪葬）：封装「shot_ref/ref_slots 打包 + 提交 + 轮询 + 出片模型（D-11 endpointId）选择」。`epscript` 删 `shotRefImages`/`sceneRefUrlFor`/`prevFrameInScene`/`nextFrameInScene`（一致性体检保留一个 UI 级 `sceneHasRef` 预判，纯前端不下沉），render/decompose 改传 `shot_ref`（+ chainConsistency/endpointId 从 hook 透传）；`shorts/make` 删 `shortRefImages`，改走 `ref_slots`（显式主角/场景槽位，短视频用 `DramaShort` 草稿、无项目实体，走结构化槽位路径）。两线净删约 60 行重复参考装配逻辑。`render.ts` 加 `ShotRefInput`/`RefSlotsInput` + body 映射 `shot_ref`/`ref_slots`/`ref_leading`；`RenderModelsState` export。
5. **测试**：`DramaReferenceAssemblerTest`（16 例，Mockito 无 Spring）——裁剪 priority/dedup/capability(maxRefImages=1/4/6)、`classifyClipFrames`(supportsFlf true/false/local)、shot_ref 定位 episodeDocs 嵌套 shot + @cast 命中/文本兜底/全员/无实体兜底文档、scene 显式 sceneRefId/名称兜底、prev_last_frame 文档 vs job 权威回退(lastFrameCdnKey)、三级入参优先级(shot_ref>ref_slots>ref_images) + clip shot_ref 派生首帧 + 尾帧受 capability 门控；`DramaRenderServiceTest` 精简（clip 归类下沉 Assembler，构造器补 assembler mock）。
6. **门禁**：server test-compile（Central 镜像）+ `DramaReferenceAssemblerTest`/`DramaRenderServiceTest`/`DramaReferenceAssetServiceTest`/`DramaProjectServiceTest`/`MaterialAiE2ETest`/`MaterialVideoWorkerTest`（61 例全绿，`@TestPropertySource`/Mockito `aep.cdn.driver=local`）+ web-drama typecheck/build + `typecheck:all` 10/10 + `check:api-contract` 全绿。**无新 path**（复用 `/render/frame,clip`，仅 summary 更新）。**C-4 backlog**：给 `MaterialVideoJob` 加 `shotId`/`sceneId` 索引列免内存扫 `variant_config`（DAG 时必做，见 TODO）。

### v0.101（2026-07-10）— 短剧一致性引擎 C-2（角色/场景实体化 + 多角度参考图集）

一致性引擎 C 序列 L0 地基（真源 `docs/[Fabel5]drama-consistency-engine-design.md` §4）。把散落 `DramaProject.payloadJson` 的角色/场景升级为独立表 + 结构化多角度参考图集（cdnKey 真值），渲染真值改读实体（过渡期双写 + 懒回填）；新增「角色一键三视图」端点。**类型真源沿用 drama 本地约定**（`apps/web-drama/src/mocks/drama-workshop/types.ts` + `api/*`，不进 packages/types）。

1. **两新实体 `DramaCharacter`（`drama_character`）/ `DramaScene`（`drama_scene`）**（ddl-auto 自动建，索引 `idx_dc_project`/`idx_ds_project`）：字段名对齐前端 `CharacterDef`/`SceneAsset`；`ref_images_json` = 多角度参考图集 `[{cdnKey,angle,label}]`（真值 cdnKey，§4.7.4，出 wire 由 `signer.signKey` 派生 url，不加 cdnUrl 列）；软删 `deleted_at` 随项目对齐。
2. **懒回填（read 时）**：`DramaReferenceAssetService.ensureBackfilled` 在 `getProject` 前跑——老项目文档 `characters/scenes` 非空但无实体行 → 从文档建实体（单图 `refCdnKey`→`refImages[0]{angle:front}` 迁移）；幂等闸=「项目实体行是否已存在」（含软删），跑两次不重复建。
3. **双写（write 时，§6.1 关键纪律）**：`saveProject` 落文档后 `syncFromDoc` **只 upsert 实体表、不重写 payloadJson**（实体是独立行，天然避开文档级 LWW，收敛并发面——渲染真值走实体表正是为绕开文档并发）；增/改名/软删对齐；文档缺 `refImages` 时保留实体已有（防旧前端 PUT 抹掉三视图产物）。
4. **出 wire overlay（read 时）**：`toDetail` 在 `resignAssetUrls` 后 `overlayEntityRefs`——把实体 `refImages`（cdnKey→派生 url）叠加进返回文档的 characters/scenes，让前端看到三视图产物；三视图端点只写实体表、不改文档，前端拿到 refImages 回 PUT 时 round-trip 带回实体。
5. **三视图端点** `POST /me/drama/projects/{id}/characters/{charId}/reference-sheet`（body `{angles?:[front|side|full],ratio?,appearanceHint?}` → `{characterId,refImages:[{cdnKey,url,angle,label}],cost}`）：复用 `IMAGE_GENERATION` + `drama.character_frame_image`（模板加 `{{angleClause}}` 注入拍摄角度，锁脸用角色已有定妆图作 ref），每角度一次出图，产物只写角色实体表。**计费 hold→逐角度 commit**（hold 总额=`drama.credit.frame`×角度数，逐张成功 `commitHold`，某张失败已成功保留、剩余 `releaseHold`，全失败 release 全额 + 抛错）——与 `renderFrame` 的一次性 `debit` 是**有意的分裂**（批产物需部分成功部分退，记 TODO「渲染扣费形态统一」）。§8.0：`preflightCharacterReferenceSheet` 在 hold 之前校验图像端点/提示词未配 → 503 `IMAGE_NOT_CONFIGURED`/`PROMPT_NOT_CONFIGURED`（不冻结、不扣费），`storage.checkQuota` 前置。
6. **前端（web-drama）**：`CharacterDef`/`SceneAsset` 加 `refImages?: DramaRefImage[]`；`api/projects.ts` 加 `generateReferenceSheet`。短剧设定页「角色与场景」角色卡加「一键三视图」按钮 + 正/侧/全身缩略图墙（生成中骨架、失败 toast 不用原生 alert、文案用户友好+宽度约束防溢出，`CreditButton` 走小额免打扰惯例）。
7. **测试**：`DramaReferenceAssetServiceTest`（回填幂等 / 双写 增·改名·软删 / doc 缺 refImages 保留实体 / 单图迁移 / 三视图 hold 总额·逐角度 commit·部分失败 release·全失败 502·未配端点 503 且 0 hold，8 例）；`DramaProjectServiceTest` 构造随新增 assets 依赖更新。**门禁**：server test-compile + 上述 + `DramaProjectServiceTest`/`MaterialAiE2ETest`（37 例全绿）+ web-drama typecheck/build(31 路由) + `typecheck:all`(8/8) + `check:api-contract` 全绿。openapi 加 `/me/drama/projects/{id}/characters/{charId}/reference-sheet`。

### v0.100（2026-07-10）— 短剧一致性引擎 D-11（一用途多候选端点 + capability + 出片模型下拉）

一致性引擎 D 序列（真源 `docs/[Fabel5]drama-consistency-engine-design.md` §3）。把「用途→单端点」升级为「用途→N 候选端点（带 capability 元数据）」，为 C-3 参考裁剪 / C-5 质检路由铺数据基础；分镜表 / 短视频出片入口恢复真·出片模型下拉（替代 v0.98 删掉的假下拉）。**核心裁决**：新表 `ai_app_endpoint_candidate`，`AiAppBinding` 保持不变（= 默认端点），`resolveEndpoint(purpose)` 行为零变化 → 所有现有调用者与 admin 默认绑定不受影响、零迁移。

1. **新表 + 兼容迁移**：`AiAppEndpointCandidate`（`ai_app_endpoint_candidate`，唯一 `purpose+endpoint_id` + 索引 `idx_aaec_purpose`）承载 capability（`maxRefImages`/`supportsFirstLastFrame`/`supportsSubjectReference`/`maxDurationSec`，null=未知按 legacy 兼容默认——图像 6 / 首尾帧协议静态判定，C-3 回归修正后口径）+ 可选单价 `creditCostOverride` + `enabled`/`sortOrder`。`AiAppCandidateSeeder`（@Order 60，跑在绑定 seeder 之后）幂等把每条现有 `AiAppBinding` 回填为置顶候选（sortOrder=0，capability 全 null）→ 老数据自动进候选池、UI 即可见、白名单可命中，无需人工。
2. **`resolveEndpoint` 重载**：`AiModelInvocationService` 加 `resolveEndpoint(purpose, endpointId)`（返回 `ResolvedEndpoint{endpoint,candidate,isDefault}`；endpointId 为空委派默认，指定则查启用 candidate + 启用端点，未命中 empty → 调用方 503 `ENDPOINT_NOT_ALLOWED`，§8.0 不回退默认、不扣费）+ `listCandidates(purpose)`（含默认标记，供 /render/models 与 admin）。`AiAppBindingService` 加候选 CRUD（bind 时幂等纳入候选池）。
3. **出片模型端点**：`GET /me/drama/render/models` → `{image:[...],video:[...]}`，每项 `{endpointId,name,isDefault,capability,creditCost}`（creditCost = override ?? 用途默认单价，仅启用候选+启用端点）。`DramaRenderService.renderFrame/renderClip` body 加可选 `endpoint_id`：命中的 candidate 单价 override 覆盖用途默认（frame 走 `debit`、clip 走 item `credit_cost`）；未命中 503 不扣费/不提交。
4. **视频线 endpoint_id 透传（§6.4 最深改动，四层串联）**：`renderClip` 把 endpoint_id 存进 `variant_config` → `MaterialVideoWorker.extractEndpointId` 抽出 → `MaterialVideoModelClient.submit/poll(..., endpointId)`（`pickEndpoint(endpointId)` 白名单，`SubmitResult` 带 endpointId 使 poll 落同一端点/baseUrl/apiKey）。**带货素材线不写 endpoint_id → null → 默认端点，celebrity 默认路径完全不变**（`MaterialVideoWorkerTest` 显式回归）。
5. **前端（web-drama）**：`api/render.ts` 加 `EndpointCapability`/`RenderModelOption`/`RenderModelsResponse` + `listRenderModels()`；`RenderFrameInput`/`RenderClipInput` 加 `endpointId`（body `endpoint_id`）。共享 `render-model-select`（`useRenderModels` hook + `RenderModelSelect`）：分镜表 / 短视频出片工具栏各挂「出图模型 / 出片模型」下拉，默认选 isDefault；候选 ≤1 时不渲染（走默认端点）；能力细节进 hover title、宽度约束防溢出（AGENTS §不溢出，不暴露内部字段名）。
6. **admin**：「AI 应用绑定」drama 组每用途加折叠「候选端点与能力」块——列候选、加/删、编辑 capability 4 字段 + 单价 override、启用开关、设默认（= 改 AiAppBinding）；禁用浏览器原生 confirm（走 `useConfirm`）。`api/ai-models.ts` 加候选 CRUD + 类型。
7. **测试**：`AiModelInvocationServiceTest`（resolveEndpoint 命中/未命中/candidate 停用/端点停用/null 回默认 + listCandidates 默认标记，+6）、`AiAppCandidateSeederTest`（首启回填 + 重启幂等，2）、`DramaRenderServiceTest`（renderFrame/renderClip 非法 endpoint_id → 503 `ENDPOINT_NOT_ALLOWED` 且 0 次 debit / 0 次 submit，+2）、`MaterialVideoWorkerTest`（默认 null endpoint 回归）。

**门禁**：server `test-compile`（离线）+ 单测全绿（`AiModelInvocationServiceTest` 20 / `DramaRenderServiceTest` 11 / `AiAppCandidateSeederTest` 2 / `MaterialVideoWorkerTest` 2 + 回归 `MaterialAiE2ETest` 8 / `MaterialVideoModelClientTest` 10）+ web-drama typecheck/build + `typecheck:all` 10/10 + `typecheck:admin` + `check:api-contract` 全绿。openapi：加 `/me/drama/render/models`、`/admin/ai-app-bindings/{purpose}/candidates[/{endpointId}]`，frame/clip summary 补 `endpoint_id`。

### v0.99（2026-07-10）— 短剧一致性引擎 C-1（末帧 CDN 镜像 + 参考生效回报）

一致性引擎 C 序列（C-1 → D-11 → C-2 → C-3，真源 `docs/[Fabel5]drama-consistency-engine-design.md`）首阶段，修审计 G-6「末帧存上游临时 URL 会过期 + 参考图静默被过滤」。**范围选择**：仅 `last_frame` 做 cdnKey 真值化（§4.7.4）；`video_url`/`thumbnail_url` 只在 `toCard` 加 `signer.maybeSign` 兜底（local `/cdn` 原样返回零影响），完整 URL→key 迁移留独立 PR。

1. **末帧 CDN 镜像**：`MaterialVideoJob` 新列 `lastFrameCdnKey`（ddl-auto 自动加列；旧 `lastFrameUrl` 降级为 fallback）。`MaterialVideoWorker` 成功分支在 video/thumbnail 镜像后追加下载上游末帧（seedance `return_last_frame`）→ `cdnUploader.upload`（key=`material-videos/<jobId>/last-frame.*`）→ `markSucceeded` 落 key。**失败语义（§8.0 观测类旁路例外）**：末帧镜像 best-effort，失败仅 WARN + 保留上游 URL，绝不 markFailed / releaseHold——视频本身已成功出片，缺末帧只是退化为「无末帧承接」。这是 C-3 服务端参考装配「同场上一镜真实末帧」权威来源的前置。
2. **出 wire 签名**：`MaterialVideoJobService.toCard` 注入 `CdnUrlSigner`——`last_frame_url` = `signKey(lastFrameCdnKey)` 派生（fallback `maybeSign(lastFrameUrl)`）；`video_url`/`thumbnail_url` 走 `maybeSign` 兜底（顺手偿还 §4.7.6 URL 时效欠债的签名部分）。celebrity 素材线共用 `toCard`，local driver 下零影响。
3. **参考生效回报 `applied_refs`**：`DramaRenderService` 把参考图过滤逻辑抽为纯函数 `computeFrameAppliedRefs` / `computeClipAppliedRefs`，`/me/drama/render/frame`、`/render/clip` 返回体加 `applied_refs = {requested, applied, items[{role,url,applied,reason}]}`（reason 枚举 `local_unfetchable`/`model_no_flf`/`over_max_refs`/`empty`，wire 全小写）。C-1 阶段 frame 的 `ref_images` 数组统一 role=`ref`（前端还无槽位，精确 role 由 C-3 Reference Assembler 提供）；clip 的 `first_frame`/`last_frame` 标准确 role，末帧生效与否按端点静态协议判定（`supportsFirstLastFrame`：agnes 仅首帧，seedance/generic 视为支持）。`DramaFrameJobService.toFrameTask` 透传到任务卡。
4. **前端（web-drama）**：`api/render.ts` 加 `AppliedRefs`/`AppliedRefItem`/`AppliedRefReason` 类型；`renderFrame` 返回体 `RenderedFrame[]` → `{frames, cost, appliedRefs}`（epscript 拆镜末帧 / cast 定妆图+场景图 / AI 改图弹窗 4 处调用点同步解构）；`DramaFrameJob`/`DramaRenderTask`/`DramaEpisodeJob` 加 `applied_refs?`；`FormShot`/`BoardShot` 加 `appliedRefs?`（render 回填 + payloadJson round-trip）；分镜表首帧格（`ShotFrameCell`，短剧/短视频共用）加「参考 N/M 生效」chip——仅部分生效时显示（全生效不打扰），定宽 + ellipsis，被过滤项与用户友好原因放 hover `title`（不暴露 `model_no_flf` 等内部枚举，§8 跨 app 约定）；shorts/make 出图/出片同步落 `appliedRefs`。
5. **测试**：新增 `DramaRenderServiceTest`（computeAppliedRefs 纯函数矩阵 9 例：全 fetchable / 本地相对 URL / 首尾帧 × 端点能力 / 空入参 / 协议关键字判定）+ `MaterialVideoWorkerTest`（纯 Mockito + 内嵌 HttpServer：成功分支三件镜像 + lastFrameCdnKey 落 key；末帧上传抛 IOException → 任务仍 succeeded、key=null、上游 URL 保留、0 次 releaseHold）。

**门禁**：server `test-compile`（离线）+ 单测 21（DramaRenderServiceTest 9 / MaterialVideoWorkerTest 2 / MaterialVideoModelClientTest 10）+ 回归 29（DramaProjectServiceTest 21 / MaterialAiE2ETest 8）+ web-drama typecheck/build + `check:api-contract` 全绿。openapi：`/render/frame`、`/render/clip` summary 更新（字段级变更无新 path）。

### v0.106（2026-08-03）— AiAvatar 真人授权证据链 + 移动端自动回流

修正 v0.105 把七牛 `liveness_face active` 直接等同于业务授权、把第三方 H5 当新窗口打开、以及把短时
`h5_link` 重复 GET 误称为“换新链接”的问题。

1. 新增 `dap_consent` 不可变协议确认快照；`POST /v1/real-auth/sessions` 必须携带当前
   `agreementVersion + agreementAccepted=true`，并记录协议 SHA-256、范围、期限、平台、确认时间、IP 与 UA。
2. LIC 同时保存平台确认与七牛技术证据（`consentId / agreementVersion / agreementHash / qgroupid /
   verifiedAt`）；老 liveness LIC 缺 consent 时对外降为 `pending / legacy_unconfirmed`，生成硬闸不再放行。
   声明式 `/v1/licenses` 禁止带 `avatarId` 直接给真人形象发授权。
3. 前端先展示服务端当前协议，再在**当前页面**进入七牛云；callback 落地页自动跳回
   `#/real-auth/{sessionId}`，该路由能在刷新、WebView 回流和重新登录后继续轮询、登记授权并恢复生成。
4. `h5_link` 过期改走 `POST /v1/real-auth/sessions/{id}/restart`，真实删除 failed 旧组并重建，沿用原协议
   快照；不再重复 GET 伪装换链。回调仍不判生效，只以服务端 GET 七牛分组的最终状态为准。
5. 授权凭证升级 v2，移动端排版并分开展示“平台授权确认”和“七牛本人刷脸核验”两类证据；文案明确
   刷脸不等同于证件实名、公证或全平台概括授权。生产 callback 默认域同步为 `aistar.aibuzz.cn`。

### v0.105（2026-08-02）— AiAvatar 真人授权刷脸实名认证 + 素材送审（接入七牛云 modelink）

数字资产平台的真人线此前有一处**假能力**：`POST /v1/captures/{id}/verify` 是「素材存在 + 抽帧成功即视为通过」，
无条件把捕获标 `verified` 并自动登记肖像授权（源码注释写着「活体/比对引擎接入预留」）。
本版接入**七牛云 modelink 资产合规 API**，把它换成真实的本人刷脸实名认证，并顺带把「素材送内容安全审核」补齐。
**授权与审核全程免费**（整条链路不接 `CreditService`，没有扣费面）。

#### 1. 两张新表（modelink 资源的本地镜像）

| 表 | 说明 |
|---|---|
| `dap_material_group` | 素材分组（`MG-xxxx`）。`kind=liveness_face` 即一次真人授权刷脸会话（`kind=aigc` 仅保留字段语义，本域不建本地 aigc 行）。状态 `preparing → awaiting_auth → validating → active / failed`；`qgroupid` 是上游分组 id；`callbackToken` 唯一、是无 JWT 回跳端点的防伪 `state`；`bytedToken` 是刷脸一次性凭证；`validateCalledAt` 是「已回传过结果」的幂等闸；`mock=true` 标记走了 mock 网关 |
| `dap_material` | 送审素材（`MAT-xxxx`）。`sourceKey` 是 §4.7.4 真值（storage key），**送审时才由 `FileStorageService.signedUrl` 派生一次可公网拉取的 URL，不落库 URL**；状态 `pending → reviewing → approved / failed`；`refType=capture`（真人捕获素材，挂 liveness 分组）/ `avatar`（人物定妆图，走平台 aigc 默认组）；`qassetUri` 出 wire 为 `qasset://{qassetid}`（生成引用格式，本版只存储不接生成） |

**三个新列**：`DapLicense.verifyMethod`（`liveness` = 刷脸取得 / `declared` = 声明式登记；**老数据 null 一律视作 declared**）、
`DapLicense.livenessGroupId`、`DapCapture.authGroupId`。均由 ddl-auto 自动加列。

#### 2. 网关三件套 + §8.0 路由

- `ModelinkGateway`（接口，只覆盖本域用到的 5 个动作：建分组 / 查分组 / 回传刷脸结果 / 建素材 / 查素材）
- `HttpModelinkGateway`（真实 HTTP，Bearer 鉴权，base 例 `https://api.qnaigc.com`）——
  **接入点不走 env**，与 dap 其余大模型能力一致，由后台「AI 模型与 Key + AI 应用绑定」把**新用途
  `DAP_REAL_AVATAR`**（中文名「数字资产 · 真人素材与授权」）绑定到七牛端点，运行时每次调用解析
  baseUrl / apiKey / model（解密与判空照抄 `DapMultimodalClient.resolveTarget`）。错误映射：
  429 → `DAP_MODELINK_QUOTA`；其它非 2xx / 网络失败 / 非 JSON → 502 `DAP_MODELINK_CALL_FAILED`。
- `MockModelinkGateway`（内存惰性状态机，**不开线程**，按「创建时刻 + 时间差」现算推进；测试可注入时钟）
- `ModelinkService`（业务侧唯一依赖的 facade）路由：
  1. 已绑定可用端点 → HTTP 真实调用；
  2. 未配置且 `aep.dap.modelink.allow-mock=true`（dev 默认） → mock，且落库行打 `mock=true`；
  3. 未配置且不允许 mock（mysql / 生产默认） → 503 `DAP_MODELINK_NOT_CONFIGURED`，**不建会话、不落假数据**。
  `@PostConstruct` 在生产 profile 检测到 `allow-mock=true` 打 ERROR 横幅（§8.0 四条件齐备）。

新配置 `aep.dap.modelink.{callback-base-url, allow-mock, poll-interval-seconds, http-timeout-seconds}`；
env `AEP_DAP_MODELINK_CALLBACK_BASE`（生产须 https 且能路由到 server 的 `/api/v1/real-auth/callback`）/
`AEP_DAP_MODELINK_ALLOW_MOCK`（mysql 默认 false）。`infra/env/server.env.example` 已补。

#### 3. 刷脸认证链路（`DapRealAuthService`）与两条官方红线

```
1. POST /v1/real-auth/sessions {captureId}
     → 建 liveness_face 分组（先调上游成功才落库：未配置 / 上游失败时不留悬空会话行）
     → 同一次捕获已有未 failed 会话则幂等复用，不重复建组
2. GET  /v1/real-auth/sessions/{id}（前端 2s 轮询）
     → 非终态时向上游刷新一次；awaiting_auth 时带出 h5Url（上游签发、约 120s 有效、不落库，
       过期就再 GET 一次换新链接）
3. 用户在 h5 页刷脸 → 浏览器回跳 GET /v1/real-auth/callback?state=&resultCode=&bytedToken=
     → permitAll（浏览器直跳没有我们的 JWT），返回一张自包含极简 HTML 落地页
4. 服务端把 result_code + byted_token 回传上游（202 受理）→ 本地 status=validating
5. 轮询 / getSession 收敛远端终态 → active（授权成立）或 failed
```

**红线 A — 回调绝不判定生效**：官方明确「不应仅凭浏览器回调参数认定分组已激活」。因此 callback 只负责
回传凭证并置 `validating`，`active` 只能由服务端 GET 分组的远端状态收敛而来。`refresh()` 里有一条
`holdValidating`：`validating` 期间远端仍报 `awaiting_auth` 时保持本地 `validating` 不回退，只有远端给出
`active` / `failed` 才落终态。

**红线 B — `byted_token` 一次性**：`handleCallback` **先占幂等闸（`validateCalledAt` + `saveAndFlush`）再调上游**，
并发 / 重复回跳只会回传一次。**回传抛错时当场判 `failed`** —— 凭证已作废、远端会永远停在 `awaiting_auth`、
`holdValidating` 会把本地永久 hold 在 `validating`（用户卡在「核验中」、轮询器每 10s 空转）；置 failed 后
轮询器不再碰（终态）、前端可「重新认证」、`start()` 会为 failed 会话另建新分组拿新凭证，链路自洽。

**安全**：`AepSecurityConfig` 只对 `/api/v1/real-auth/callback` 开 permitAll（顺序敏感，排在通用
`/api/v1/**` authenticated 之前），防伪靠不可枚举的 `state`（随机 UUID hex，一会话一枚）；未知 state 只
返回「链接已失效」页面并 WARN，不泄露任何存在性信息。

#### 4. verify = 唯一完成漏斗（409 语义）

`DapCaptureService.verify` 改为：
`requireActiveSession`（无会话 / 非 active → **409 `DAP_AUTH_NOT_COMPLETED`**，文案区分「认证进行中」与「上次未通过」）
→ 标 `verified` → 登记 / 回填 LIC（`autoCreateForCapture(..., "liveness", groupId)`；已存在的声明式授权
**升级**为 liveness，即「一旦通过刷脸认证，凭证从声明式升级为可取证」）→ best-effort 送审捕获素材
（footage + 关键帧；抛错只 WARN，不回滚核验与授权）。返回体加 `authSessionId` / `licenseId`。
`CaptureDto` 加 `authSessionId` / `authStatus`（无会话出 wire 为 `"none"`）。

#### 5. 素材送审（`DapMaterialService`）与轮询收敛

- `submitForCapture`：真人捕获素材挂**已 active 的 liveness 分组**送审（由 verify 调用）；
  `resubmitForCapture` 供失败重交。
- `submitAvatarModeration`：人物定妆图送审，`createAsset` **不传 group_id**、由平台落到默认组 ——
  本地因此不建 aigc 分组行（避免维护一份会异步 pending 的空壳）。
- 幂等：同一 `ref` + 同一 `sourceKey` 已有非 `failed` 行 → 跳过；`failed` 后允许重交（建新行）。
- `DapModelinkPoller`（`@Scheduled(fixedDelay = aep.dap.modelink.poll-interval-seconds)`）收敛非终态：
  分组 `preparing` / `validating`（**`awaiting_auth` 不主动拉** —— 那是「等用户去刷脸」，由前端查会话 /
  回调驱动）、素材 `pending` / `reviewing`。**无非终态行时直接 return（常态零上游请求）**；单行失败只 WARN。
- `AvatarDto` 加 `moderation{status,failReason}`：**只在详情接口注入**，列表刻意不带（避免每行一次
  `DapMaterial` 查询的 N+1）。

#### 6. 授权硬闸前移到生成入口

v0.104 只在合成路径（`DapCompositionService.checkLicense`）拦授权，生成路径无闸。本版
`DapWorkflowService.generate` 对 `path=real` 且无生效 LIC → **403 `DAP_LICENSE_REQUIRED`，不建任务、不冻结积分**。
依据：真人形象的既定流程是 `capture → footage → verify（登记 LIC）→ generate`，授权必然先于首次生成存在，
因此前移不会挡住正常首建；同时堵住「向导重跑 / 直接打 API」时授权勾选框只是客户端 UI 的漏洞面。
AI 原创人物（`path=ai`）不受影响。错误文案带资产名与当前授权状态的中文说明。

#### 7. 新端点

```
POST /api/v1/real-auth/sessions          # 开启（或幂等复用）刷脸认证会话
GET  /api/v1/real-auth/sessions/{id}     # 查询会话（非终态时刷新一次；awaiting_auth 带 h5Url）
GET  /api/v1/real-auth/callback          # 刷脸回跳落地页（permitAll，text/html）
POST /api/v1/materials                   # 送审（refType=avatar 定妆图 / capture 重交）
GET  /api/v1/materials?refType=&refId=   # 按引用对象查送审记录
```
`POST /v1/captures/{id}/verify` 返回体加 `licenseId` / `authSessionId`，并新增 409 / 503 语义。
`openapi.yaml` 已同步（含 `RealAuthSession` / `Material` 两个 schema）。
admin 侧「平台 · AI 模型」的 AiAvatar 绑定组加入 `DAP_REAL_AVATAR`（无新页面）。

#### 8. 前端（web-aiavatar，`src/proto/*`）

- `screen-real.tsx`：原 `RealVerify` 的假「身份核验」步骤真实化为 **`RealAuth` 屏** ——
  准备中 → 待认证（`window.open(h5Url)` + 「换新链接」）→ 核验中 → 通过后自动调 `verify` 登记授权 →
  未通过可「重新认证」。`verify` 撞 409 `DAP_AUTH_NOT_COMPLETED` 时**回到等待重试**而不是当作失败。
  流水线拆成 `runUpload`（建资产 + 捕获 + 上传素材）→ auth → `runGenerate`（复刻生成）；
  带既有资产进来且已有定妆图时走 **`authOnly`**（补认证即完成，不重复复刻生成）。
- 授权链路三个显式入口：`screen-lictaskme.tsx` 授权登记页顶部「**待授权**」块（真人资产 × 无生效授权，
  列表为空则整块不渲染 —— 授权徽标稀有是设计语义，不做常驻空状态）+ 每张授权卡可折叠「授权素材」
  （点开再拉，避免列表一次发 N 个请求）；`screen-library.tsx` 资产详情未授权提示条；
  `screen-compose.tsx` 合成工作台把 403 `DAP_LICENSE_REQUIRED` 从 toast 升级为拦截块
  （「本次没有建单，也没有扣算力」+「去完成授权认证」）。三处统一走新的 `ctx.startRealAuth(char)`。
- 新共用组件 `material-status.tsx`：`MaterialBadge`（待审核 / 审核中 / 已通过 / 未通过）、
  `MaterialRow` / `MaterialSection`（`submit` / `readonly` 两模式）、`LivenessBadge`（「已刷脸核验」，
  **只在 `verifyMethod=liveness` 时出现，未核验不显示任何负面文案**）。
- 契约（`data.ts`）：`License` 加 `verifyMethod`；新增 `RealAuthSession` / `RealAuthStatus` /
  `Capture`（含 `authSessionId` / `authStatus`）/ `DapMaterialInfo` / `MaterialStatus` / `MaterialRefType`。
  `api.ts` 新增 `RealAuthApi` / `MaterialApi`，`CaptureApi.verify` 返回体扩展。
- **mock 一等公民**：认证会话与素材审核都用「创建时刻 + 时间差」惰性推进（与 `mockJobStore` 同思路），
  mock 授权登记簿可被刷脸通过后追加；`ComposeApi.create` 的 mock 分支补 403 与 server 对齐；
  新样本 **DH-2044**（真人复刻、已出图、未授权）驱动三个入口的演示。`USE_MOCK=1` 整链浏览器实测走通。

#### 9. 门禁

server `compile` + dap modelink 4 个新测试类（`DapRealAuthServiceTest` / `DapCaptureServiceTest` /
`DapMaterialServiceTest` / `DapModelinkPollerTest`）+ `mvnw test` 全量回归全绿
（v0.104 基线 409 例 + 本轮新增；本机仍需 `AEP_CDN_DRIVER=local` 覆盖 `apps/server/.env`，
见 `TODO.md` 2026-07-27 段，与本轮无关）+ `pnpm typecheck:all` + web-aiavatar `build` +
`pnpm check:api-contract` 全绿。

#### 10. 已识别债务（详见 `TODO.md` 2026-08-02 段）

- `DapModelinkPoller` 多实例需 ShedLock（与 `DapTrashCleanupScheduler` 同一债务，归 Phase 5）。
- ~~modelink 账号默认限 **3 组 / 30 素材**，而 liveness 每次捕获建一组 → 需要终态分组清理策略~~
  → **已在下面第 11 节（同版补丁）落地**。
- `LicenseDto` / `AvatarDto` 未出 `captureId`，前端「授权素材」只能按 avatar 维度拉，拿不到 capture 维度。
- web-aiavatar 覆盖页栈只渲染栈顶：从合成工作台跳认证再返回会重挂工作台、已选槽位丢失（既有限制）。

#### 11. 分组治理补丁（2026-08-02，同版收尾）

用真实 key 探测线上 modelink API 后确认：**字段与 v0.105 网关解析完全一致**（无需改解析），
但暴露出两个必须修的问题 —— 一个生产阻断、一个产品要求。

**A. 分组配额泄漏（生产阻断）**。上限 **3 个分组 / 30 个素材**是**整个平台账号级**的，不是每用户。
而 `DapRealAuthService.start()` 遇到 `failed` 会话会新建一个上游分组，网关又**没有 delete 能力** ——
任何失败重试都永久漏掉一个槽位，两次重试或两个并发用户做实名认证就把认证通道堵死
（上游返回的是非 429 错误体，此前被包成笼统的 502 `DAP_MODELINK_CALL_FAILED`，运维看不出真因）。三处修：

1. **网关加删除动作**：`ModelinkGateway.deleteGroup(qgroupid)` +
   `HttpModelinkGateway` 的 `DELETE /v1/asset-groups/{qgroupid}`（实测 200 `{"message":"deleted"}`）+
   `MockModelinkGateway` 内存删除 + `ModelinkService` 委派。上游 409（**非终态或组内非空**才允许删的约束）
   如实回报为 409 `DAP_MODELINK_GROUP_NOT_DELETABLE`（**可识别**，不吞在网关里）——
   两个调用方各自 best-effort catch，删不掉只 WARN。
2. **失败重试即回收**：`start()` 复用分支里，failed 会话在建新分组**之前**先 `recycleGroup(existing)`
   把旧上游分组删掉还配额；删失败只 WARN，绝不阻断新会话创建。
3. **终态分组回收器**：`DapModelinkPoller.reclaimTerminalGroups()`（默认每小时一轮，
   `aep.dap.modelink.group-reclaim-interval-seconds`）。判定刻意保守，三条同时满足才删：
   kind=liveness_face 且状态 **failed**、创建超过 `group-retention-hours`（默认 24h，留排障窗口）、
   本地无挂在该组下的非 failed 素材。**`active` 分组绝不删** —— 那是生效授权的取证凭据。
   删除失败保留 `recycledAt=null`，下轮再试。无待回收行时零上游请求。
4. **配额错误可辨识**：`HttpModelinkGateway` 识别配额类错误（HTTP 429 或响应 message 含
   `quota`/`配额`/`limit`/`exceed`/`上限`）→ 503 **`DAP_MODELINK_QUOTA_EXCEEDED`**，
   文案给运维处置指引（「先清理不再需要的分组，或联系七牛提额」）。§8.0：不产假数据、不降级。

**B. 数字人专属 aigc 分组（产品要求，推翻 §M）**。AI 原创人物定妆图不再送进平台默认组，
改挂一个**数字人业务专属的 aigc 分组**。新增 `DapAigcGroupResolver`：

- 分组是**账号级共享**（所有用户的 AI 人物送审共用一个），本地行 owner 用约定的系统 owner
  `__platform__`（对齐既有 `__official__` / `__admin__`），查询**不按 owner 过滤**。
- **幂等**：去重键 `aigc:<model>` 落在 `DapMaterialGroup.callbackToken`（该列本就 unique，
  aigc 分组没有回调正好空着 —— 不新增列/索引就拿到 DB 级唯一约束）。「查 → 建 → 提交」整段在
  JVM 锁内 + 独立事务（`REQUIRES_NEW`，TransactionTemplate），同实例并发只建一个上游分组；
  独立事务同时保证送审失败回滚不会把已建好的分组行丢掉（否则下次又建一个＝再漏一个配额）。
- **异步 pending 不阻断**：aigc 组是 pending → active 异步生效。本次拿不到 active 就
  退回平台默认组（不传 `group_id`）并打 info，首次使用绝不失败。
- **认领已有分组**：`aep.dap.modelink.aigc-qgroupid` 配了就只 GET 确认、不建组
  （线上分组已手工建好时，自动建组会白吃掉仅剩的配额槽位）。
  本轮已用真实 API 建好该分组：`qgroup-1383618387-1785727504389729758`（`AiAvatar 数字人`，
  type=aigc，active），已写进 `infra/env/server.env.example`。当前账号占用 **2/3**。

**新增列 / 配置**：`dap_material_group.recycled_at`（上游分组已删、配额已还的时间；**保留本地行**
作审计追溯，不物理删 —— `capture.authGroupId` / `license.livenessGroupId` 仍指得到它）；
`aep.dap.modelink.{aigc-qgroupid, aigc-group-name, group-retention-hours, group-reclaim-interval-seconds}`。

**门禁**：`compile` + `AEP_CDN_DRIVER=local ./mvnw -Dtest='Dap*Test' test` **47/47 全绿**
（新增 `DapModelinkGatewayTest` 6 例，用本机 HttpServer 打桩上游、不打真实 API；
`DapRealAuthServiceTest` 14 / `DapMaterialServiceTest` 11 / `DapModelinkPollerTest` 10 / `DapCaptureServiceTest` 6）
+ `pnpm check:api-contract` 全绿。**无新端点**，openapi 无变更。
