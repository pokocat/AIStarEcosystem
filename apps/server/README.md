# AI Star Eco Server

> 阿里云 **ECS + RDS + OSS** 部署的完整版本化基础设施在 [`../../infra/`](../../infra/README.md)。
> 新机器从零拉起、env / nginx / systemd / RDS / OSS 模板、deploy 脚本均在该目录。

Spring Boot 后端服务，承载账户注册、权益管理、许可证（秘钥）、积分钱包、审计日志等核心业务。

## 后台账号归档（2026-10-10）

`GET /api/admin/users` 未指定 `status` 时排除 `DELETED`，搜索和身份筛选也在分页前排除；显式 `status=deleted` 可查历史。测试账号按精确 ID 注销，身份凭据归档、令牌撤销；账本与钱包保留，不直接修改余额。生产保持 `AEP_SEED_DEV_DATA_ENABLED=false`。

本次精确清理 11 个产品账号与 4 个统一身份，真实后台 API 默认返回 17 个未注销账号；两库备份在 `/var/backups/aistareco/test-account-cleanup-20261010T180720Z/`。原恢复账号及其他账号、钱包、账本逐项核对未变化。

追加验收：补归档 1 个无真实身份和权益的 SOP 占位账号；当前默认仍为 17 个正常账号，显式注销筛选为 15 个历史档案。最终后端发布 `20261010-test-validation-8a1abf7a` 保留当前生产身份修复，线上校验和、分页/搜索、原账号状态及非法 demoId 的真实 400 错误通过；详见 [追加发布记录](../../docs/releases/identity-phone-release-20261010.md)。

## CI 与 H2 测试库（2026-10-10）

构建前运行 `../../infra/scripts/prepare-platform-sdk.sh`，安装固定 release 的薄 SDK；制品来源与校验见 [SDK 说明](../../infra/vendor/platform-sdk/README.md)。使用 Java 17 执行 `./mvnw -DargLine=-Xmx3g -Dspring.test.context.cache.maxSize=2 verify`。

测试 classpath 的 `LegacyH2SchemaCustomizerFactory` 在 Flyway 前为 H2 设置 MySQL 兼容模式并创建旧 `ai_model_providers` 表骨架；仍执行并验证全部真实迁移，随后由 Hibernate 补齐实体字段。该类与注册文件只属于测试，不改变生产或普通 dev 启动，也不修改已执行的迁移。全局模板发布先校验 demoId 再访问项目与素材，非法 ID 直接返回原业务错误。

## 版本日志

### v0.210 · 2026-10-08 · Studio 多候选视频（本地未发布）

- `studio-runs` 视频 `count` 支持 1/2/4，`maxCost` 为整批上限；同一项目请求编号只绑定一批原视频 Job。规格、归属与整批费用在派发前校验，仍由原 Job 冻结与结算。
- `output.videoCandidates` 保留固定 index 与每条状态。任一活跃则整批 running，部分成功为 done 且保留失败原因，全部失败才为 failed。成功缺镜像 key 视为交付失败，但不虚构原任务退款。
- `_exec.nativeVideoJobIds` 兼容旧单 Job 字段；停止须整批仍 queued，任何已受理候选使取消事务回滚。客户端未知提交恢复原幂等编号。无新表或积分账本。
- 规格、接口及本地验证见 [视频模式与多候选](../../docs/ip-studio-video-modes.md)。本轮没有新增真实供应商生成。

### v0.200 · 2026-10-07 · 接手整合与资产/结算修复

- 整合 #101/#102/#106–#114/#122/#126/#127；#124 的独立 Storage 设置由 #125/#127 的共享实现取代。冲突保留当前画布、完整 ISO 时间与已落地的视频模型选择。
- 受保护视频镜像失败必须失败并释放冻结；DAP 作业在事务提交后派发。
- 名片 create/save 校验形象归属；存量公开读也检查归属。文档资产只允许当前用户名片目录 `card/<uid>/` 与当前名片历史目录 `cards/<cardId>/`，禁止任意 key/旧 URL 换签名；其他数字人资产走已验证 avatar 的 ref/motionRef。
- 混剪 asset_id 只解析本人或平台预置素材；本地静态路径校验属主和真实目录边界，拒绝任意 file/绝对路径。公网下载逐跳检查重定向，全部 DNS 地址校验后用于实际连接，拒绝内网地址；新缓存目录避免复用旧不可信下载。
- 发布重试新增 `aep_publish_jobs.retry_count`，**V38 Java migration** 幂等补列并将存量行设为 0。首次引用保留裸 jobId，兼容升级前在途冻结；后续尝试用 `jobId:rN`。禁止改旧迁移或重新冻结已有任务。
- IP 发布、clip 草稿和短视频 worker 写回增加行锁；补测试 fixture。JWT 篡改测试改动实际签名字节，避免只改变 Base64URL 填充位的随机误报。


- **v0.199.1（2026-10-04）**：**成片封面**。聚算 H3 的结果里只有视频、没有封面，`material_video_job.thumbnail_url` 一直空着，模板卡片只剩黑底。新 `MaterialVideoCover`：厂商不给封面（或给了没存下来）时，`MaterialVideoWorker` 在镜像成片那一步从本机成片 0.5 秒处截一帧（宽 ≤ 720、不放大；每次 30 秒超时，`FfmpegRunner` 新增带超时的重载），存 `material-videos/<jobId>/thumbnail.jpg`；best-effort，截不出来不影响出片与结算。新 `config/MaterialVideoCoverBackfill`（`CommandLineRunner`，后台线程，开关 `aep.material.video.cover-backfill.enabled`，dev 关）：启动后给视频生成区（`kind=studio-*`）已成功但没封面的老任务补截，每次最多 50 条。仓库新增 `findCoverless`、`setThumbnailIfMissing`（条件更新，只写封面和更新时间）。测试 `MaterialVideoCoverTest`（真 ffmpeg，没有就跳过）、`MaterialVideoCoverBackfillTest`（真 JPQL）、`MaterialVideoWorkerTest` +4。无迁移、无接口变化。
- **v0.199（2026-09-30）**：**视频生成区**（web-celebrity「AI 创作 → 视频生成」，设计真源 [`docs/video-studio-plan.md`](../../docs/video-studio-plan.md)，规则 `specs/BUSINESS_RULES.md` §6.8）。
  - **新域** `com.aistareco.aep.videostudio`：`/api/me/celebrity/video-studio/{models, uploads, jobs, jobs/{id}}`，把 MiniMax H3 的四种原生模式（`t2v` / `i2v` / `first_last_frame_video` / `universal_reference_video`）原样开放。厂商合同集中在 `JusuanH3Contract`：768p/544p × 六种画布、`orientation` 含 `square`、`outputSizeCode h3-<tier>-<W>x<H>`、5–15 秒、种子。
  - **出片不建表**：复用 `MaterialVideoJobService` / `Worker` / `ModelClient`，新分区 `app=video-studio`（`APP_VIDEO_STUDIO`），`kind=studio-*`。
  - **价格我们自己定、后台可配**（二版）：`VideoStudioPricingService` 读平台配置 `celebrity.video-studio-pricing`（60 秒缓存，`GET / PUT /api/admin/celebrity/video-studio-pricing`）。
    每格 = 配置 ?? 模型候选的每秒价（`creditCostOverride` > 0 且端点按秒）?? 未定价 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`。
    总价 = (每秒价 + 超出 `freeRefImages` 的图片数 × `extraRefImagePerSecond`) × 秒数，以 `credit_cost` 冻结。
  - **智能优化**（二版）：`VideoStudioOptimizationService` / `Worker` / `Reaper` / `Settlement`，`POST / GET …/prompt-optimizations[/{id}]`。
    厂商 `/media/prompt-optimizations` 同步但最长约 10 分钟，所以做成后台任务（独立线程池 8 线程 / 队列 64）。
    `Idempotency-Key` = `clientRequestId` = 我方记录 id，409 / 429 / 5xx 同键同正文重发，总预算 12 分钟（从上传素材前开始算）。
    同一用户同一 clientRequestId 先插行再冻结；状态迁移与扣 / 退在 `VideoStudioOptimizationSettlement` 的同一个 `REQUIRES_NEW` 事务里；
    每 5 分钟回收超过 20 分钟仍未结束的记录（判失败、退冻结；结算时用 `failIfStale` 再判一次「还卡着」，列出后刚被 worker 领走的不动）。单价 `promptOptimizationPerCall`（默认 0 = 不收费）。
  - **模板 / 做同款**（二版）：`VideoStudioTemplateService`，`GET / POST …/templates`、`GET / DELETE …/templates/{id}`。只存配方
    （模式、最终提示词、规格、种子、模型、素材 key），不拷运行痕迹；官方模板只有 `aep_users.operatorRole` ∈ operator / super_admin 能发
    （`InAppOperatorGuard.isOperatorUserId`，服务端查库）。做同款时归属闸放行该模板自己的素材（类型一致），成功建任务后 `use_count + 1`（单条 UPDATE）。
  - **迁移 V37**（`V37__video_studio_optimization_and_template.sql`，两张新表，见下方数据模型）。
  - **上传**：`VideoStudioUploadService` 按字节判格式（新 `MediaBytes`），音视频过 ffprobe，key 分类 `video-studio-<image|video|audio>/<uid>/` 即类型真值，归属闸用新的 `FileStorageService.ownedKeyPrefix`。
  - **共享链改动**：
    - `MaterialVideoModelClient.submit` 的最后一个参数从首帧 key 换成 `VideoGenSpec`（worker 唯一解析入口），老路径的聚算请求体逐字段不变。
    - 素材上传泛化为 `image` / `video` / `audio`；创建请求被 4xx 拒时，任务失败原因用厂商原话。
    - **修画布两处老问题**：`IpRunService` 选的模型写错层、一直没生效；非聚算协议把画布首帧 key 静默丢掉，现在改为经 `FileStorageService.upstreamFetchUrl`（签名优先）传过去。
    - `submit` 加分区闸：原生规格只许 `video-studio` 带，首帧 key 只许 `ipstudio` / `video-studio` / `drama` 带（短剧在 2026-09-30 首帧热修后会写 `first_frame_key`，写之前验过归属；带货素材运营的入口透传客户端 `variant_config`，挡着）。
    - 对账恢复：调用方定价的任务（payload `caller_priced`）按冻结价结算。
    - worker 写给用户的失败原因去掉 `status=` / `taskId=`，账本文案用 `credit_label`；`toCard` 出 wire 时剥掉 `credit_label` 与 `caller_priced` 两个内部字段。
  - **测试**：`videostudio/*Test`（含真事务的 `VideoStudioOptimizationTransactionTest`：结算原子、线程池拒绝后确实退了冻结、同键并发拿到同一条）、`VideoStudioMigrationTest`、`JusuanH3ContractTest`、`VideoGenSpecTest`、`MediaBytesTest`、`MaterialVideoModelClientBodyTest` / `WireTest` / `RetryHintTest`、`MaterialVideoWorkerSpecTest`、`MaterialVideoJobServiceStudioTest`、`IpVideoModelChoiceWiringTest`；本机对模拟聚算服务的端到端检查见 `docs/video-studio-plan.md` §7。
- **2026-09-30 热修（不占版本号，基线 `ada3e17c`）**：短剧 / 短视频在聚算 H3 上「生成视频」首帧送不到模型、静默变成文生视频。聚算协议的图不收 URL，worker 只认 `variant_config.first_frame_key`，而 `DramaRenderService.renderClip` 从没写过它。现在 `renderClip` 经 `MaterialVideoJobService.firstFrameNeedsStorageKey`（判定只在 `MaterialVideoModelClient.usesUploadedFirstFrame`）识别聚算端点后，由 `DramaReferenceAssembler` 用 `CdnUrlSigner.keyOf` 从最终首帧 URL 反抽 key，按存储台账（`storage_assets`，app=drama + owner）或本人短剧任务的 `lastFrameCdnKey` 确认归属，再写进 `first_frame_key`（同 `IpRunService`）。不属于本人 → 冻结积分前 400 `DRAMA_FRAME_NOT_OWNED`；外链派不出 key → 照旧出片但 `applied_refs` 报 `not_in_storage`；候选 `maxRefImages=0` → 不派生，照旧 `model_no_image_input`。非聚算协议（seedance / agnes / generic）行为不变。新增两条只读查询：`StorageAssetRepository.findByAppAndOwnerUserIdAndCdnKeyIn`、`MaterialVideoJobRepository.findScopedByLastFrameCdnKeyIn`，无表结构变更、无迁移。
- **v0.135（2026-08-18）**：`clip` 最终音轨改为两遍响度归一，第二遍消费第一遍 `measured_*`，编码前目标 -16 LUFS / -2.5 dBTP，为 AAC 峰值回弹留余量；编码后的真实文件仍按 ≤ -1 dBTP 质量门失败关闭，并在日志记录实测亮度/响度/真峰值。
- **v0.132（2026-08-18）**：`clip` 本人素材改为受限 OSS V4 PostObject 单次直传 + `clip_upload_session` 持久化受理号 + 异步媒体校验/供应商提交；同一 owner + clientRequestId 只复用一个对象和任务。形象视频若为 HEVC/H.265，服务端先转 H.264/AAC 再走既有 ffprobe/预览/克隆，旧 multipart 路由保留兼容。
- **v0.131（2026-08-17）**：修复聚算 Account API Key 的模型作用域：Job 查询和产物读取统一携带 `?model=minimax-h3`；带货素材入口在 hold 前校验 H3 时长并按 40 积分/秒报价。新增既有上游成功 Job 的幂等对账恢复，不重新提交生成。
- **v0.130（2026-08-17）**：视频生成新增聚算 JusuanHub `minimax-h3` 媒体 Job 协议（768P、横/竖屏、5–15 秒）：`/media/generations` 提交、`/jobs/{id}` 轮询，受保护产物经 `/assets/{id}/content` 鉴权下载后镜像 OSS；候选报价支持 `PER_SECOND`，H3 按 40 积分/秒计费，存量模型继续按次。当前先开放 t2v，首/尾帧资产上传未接通前能力标记为不支持，避免误报。
- **v0.198.2（2026-10-05）**：画布合成成片的目标尺寸优先跟画布比例：`DramaAssembleService.assembleKeys(…, canvasRatio)` 在片段尺寸不一致时，先只看宽高比与画布比例相差 2% 以内的片段取众数（并列取面积大的、再取靠前的），一个都对不上才按全部片段的众数；比例在受理时快照进运行的 `_exec.canvasRatio`（老运行没有 → 老规则）。
- **v0.198.1（2026-10-03）**：画布线上实测修复（真源 [`docs/drama-canvas-plan.md`](../../docs/drama-canvas-plan.md) §11、规则 `specs/BUSINESS_RULES.md` §6.7「文字类调用」）。**文字类**：补括号恢复抽成共用 `service/ai/ModelJsonRepair`（`DramaScriptService` 同用），输出不合格同样消息再问一次、两次都不行日志带头尾摘录；`finish_reason=length` 一律当不合格（补括号会把截断的输出补成少半截的合法对象）；上游 429 / 5xx / 网络错误 5s → 15s → 30s 退避重试、超时只重试一次；并发闸 `aep.drama.canvas.text-concurrency`（`AEP_DRAMA_CANVAS_TEXT_CONCURRENCY`，缺省 2，聚算 Key 同时只许 2 个推理），文字类另开一个线程池（在线程里排队等许可并刷心跳，不再挤占出图 / 合成的池）；分镜按 `minSegmentSec` 把太短的片段并进相邻片段（按精确秒数并、只取整一次）。**出图**：`DramaRenderService.callImageModel` 识别厂商「size must match preset (W×H)」，比例一致按固定尺寸重试一次、不一致 400 `IMAGE_SIZE_UNSUPPORTED`（进程内记住，下次不白调）；4xx 把厂商原话（脱敏、截断）给用户；请求体进 `[upstream-io] REQUEST`（参考图去掉签名）。**render/models** 视频项带有效时长区间（`minDurationSec` / `maxDurationSec`）。**合成**：片段分辨率 / 音轨不一致时先按众数尺寸逐段归一（等比缩放 + 补边、30fps、缺音轨补静音）再拼。提示词 5 个改写（示例名换「人物甲」、想法里的人都要进人物小传、台词不带 △、不重写上一集、拆角色以人物小传为准），`PromptTemplateSeeder` 升 v13（线上只有这 5 条会刷新）。
- **v0.198（2026-09-30）**：web-drama「画布」服务端（照小云雀短剧 Agent 的流水，和「我的短剧」互相独立；真源 [`docs/drama-canvas-plan.md`](../../docs/drama-canvas-plan.md)、契约 `packages/types/src/drama-canvas.ts`、规则 `specs/BUSINESS_RULES.md` §6.7）。**新表**（V36 SQL 迁移，部署前核对线上 `flyway_schema_history` 最大号）`drama_canvas`（整份画布文档 + 文档版本）/ `drama_canvas_run`（运行记录，`UNIQUE(owner_user_id, client_request_id)`）。**接口** `/api/me/drama/canvases/**`：CRUD、`script/split`（粘贴剧本按「第 X 集」切，免费）、`assets/sign`（签名换新，只签本人 key）、`runs/script|extract|image|image-batch|storyboard|video|assemble`、`GET runs?ids=`、`GET runs/lookup`、`runs/{id}/cancel`。**四条红线**：① 文档只存 key，保存剥 `url`、读出只签本人的（查 `storage_asset`，画布全部产物都记账）；② 保存必须带 `baseDocVersion`（= 规范化文档 + 标题的指纹），对不上 409 `DRAMA_CANVAS_STALE`；③ 服务端不改文档，结果进运行记录由前端合并；④ 生成的一切输入（提示词、连线 / @ 引用的参考图、首帧、合成顺序）都从**已保存的**文档读，请求带 `docVersion`，文档里别人的 key → 400 `DRAMA_CANVAS_ASSET_NOT_OWNED`、不冻结。**计费**：文字类冻结 → worker 结算 / 退回；出图整批冻结、每张「存储 + 记归属 + 结算 + 写结果」同一短事务、失败退剩余；视频走 `MaterialVideoJobService`（kind=`drama-canvas`，写 `first_frame_key` 与 `require_mirror=true`：镜像失败判失败并退款）；合成免费（`DramaAssembleService.assembleKeys`）。所有终态迁移是条件更新（回收与完成互斥），`DramaCanvasRunSweeper` 回收卡死（文字 / 图 10 分钟、合成 20 分钟、视频从没交给厂商的 30 分钟），对账恢复成功的视频会把失败的运行改回成功。**共用改动**：`MaterialVideoWorker` 取任务改成条件认领（与取消互斥，旧任务行为不变）；旧工作台任务中心排除 kind=`drama-canvas`；`DramaRenderService` 抽出可复用的出图 / 出视频函数（`renderFrame` 存图改按字节判格式）。新价格 `drama.credit.canvas-*`（2/6/4/4/4，后台「短剧专区 → 画布」可改），新提示词 `drama.canvas_*` 10 个，新配置 `aep.drama.canvas.max-concurrent`（`AEP_DRAMA_CANVAS_MAX_CONCURRENT`，缺省 4）。新增只读 `GET runs/lookup`（按幂等键只查不建，前端离页 / 响应丢失后确认是否受理，禁止用原键重发确认）。测试：`Drama*Test` / `MaterialVideo*Test` 等 42 个类 395 条全过，含竞态、事务回滚、H2 真 SQL 的条件认领。
- **v0.197（2026-09-28）**：web-drama 文案 / 路径收口的服务端部分（真源 [`docs/drama-ux-copy-pass.md`](../../docs/drama-ux-copy-pass.md)）。① drama 域给用户看的报错与 AI 开场白按术语表改写（`Drama*.java` 约 190 条字符串），**错误码与 HTTP 状态一个没动**；`*_NOT_CONFIGURED` 里给运营的配置指引保留（§8.0），前端按错误码换成用户能懂的话。② `POST /me/drama/brainstorms/{id}/promote`：`form=single` 按 body `clientRequestId` 幂等（透传 `DramaShortService.createFromRecipe` 的带键重载，同键重试回原草稿、不重复扣开拍费），并把「一句话剧情 + 主线」写进草稿 `data.idea`（制作页进来即自动写口播脚本，不再把故事名当成「风格」）；已 promoted 的对话 PUT 返回 409 `DRAMA_BRAINSTORM_ALREADY_PROMOTED`，不覆盖。③ `createFromRecipe` 的幂等键校验与 `createShort` 一致（空白 / 超长视为无键）。④ `DramaShort` 在实体 `@Table` 上补 `uk_drama_short_owner_client_req`（与 V23 同名）：全新库上 Flyway 先于 Hibernate 跑、V23 建索引时表还不存在被跳过，原来新环境永远没有这把索引；已有同名索引的库不受影响。⑤ `/me/drama/config` 的 `prices` 加 `interactiveDraft`（`drama.credit.interactive-draft`，默认 18）。⑥ `GET /me/ledger` 排序加 `id` 次排序键（`createdAt` 相同的几条跨页不再重 / 漏）。⑦ 上传超限提示按 KB / MB 保留小数。测试：`Drama*Test` 176 条全过，新增 `DramaBrainstormPromoteIdempotencyTest` / `DramaShortUniqueIndexTest` / `DramaConfigControllerTest` / `DramaAssetUploadControllerTest` / `AccountControllerLedgerPagingTest`。
- **v0.116（2026-08-11）**：`clip` 新增官方采集契约和服务端 ffprobe 质量闸，`/me/clip/avatar/requirements` 下发授权/形象/声音硬限制与固定口播；声音固定 V2.0，avatar 与 b-roll 统一复用段 TTS，数字人改走 `/video/createByVoiceV2`。训练/生成回传真实进度和失败原因，授权 `authId` 不再表述为独立实名认证。本轮测试均为桩与离线编译，不调用石榴真实生成。
- **v0.111（2026-08-11）**：`clip` 从工程骨架升级为石榴 AI 官方真实适配：授权视频、speaker/avatar 训练、TTS、文案/音频出片、轮询/删除和时效成片持久化；内置 3 套正式模板。新增仅监听 127.0.0.1:8081 的 `clip-preprod` profile 与隔离部署资产。真实密钥只读 env、不打印；媒体审核、完整多段总装与代发继续 fail-closed。
- **v0.110（2026-08-10）**：新增供军师「快出片」调用的独立 clip 域：四表 Flyway 迁移、`externalOwnerId` 强隔离、service-token 入口、模板与 preset 管理、项目/素材/授权/克隆、权威报价与 preflight、幂等任务、数据库租约 worker + stale reaper、作品和四平台发布契约，并同步 `packages/types/src/clip.ts` 与 OpenAPI。Scheme A 下用户积分只在军师 BFF 扣，本仓只记外部报价。真实石榴字段、ffmpeg/CDN 总装和真实发布仍未接，production/mysql 禁止 mock，所有缺口 fail-closed；详见 [`docs/clip-avatar-video-plan.md`](../../docs/clip-avatar-video-plan.md)。
- **v0.108（2026-08-03）**：修复**跨子产品视频资产串号**（明星带货素材库出现 AI 短剧分镜视频，反向亦然）。根因：`material_video_job` 被带货线（`kind=baseline|variant`）与短剧线（`kind=drama-shot|drama-episode`，v0.43/v0.65 起复用本管线）共用，而 `MaterialVideoJobService.listJobs` 只按 `ownerUserId` 过滤 —— 不带 `script_id`/`product_id` 的列表（`GET /api/me/material/videos/jobs` 无参、`GET /api/me/drama/render/tasks` 无 `project_id`）会返回该用户在另一个子产品生成的任务。**新列** `MaterialVideoJob.app`（`celebrity`|`drama`，索引 `idx_mvj_user_app`，ddl-auto 补）：`submit`/`listJobs`/`getJob` 一律要求显式传 app（新常量 `MaterialVideoJobService.APP_CELEBRITY`/`APP_DRAMA`；`getJob` 跨 app 查当不存在）；查询走 `MaterialVideoJobRepository.APP_EXPR`（`case when app is not null then app when kind like 'drama-%' then 'drama' else 'celebrity' end`），故对**老数据 app=null 自动兜底、正确性不依赖回填**；`MaterialVideoJobAppBackfill`（@Order 70，幂等，只改 `app is null`）补历史行仅为走索引。调用方：`MaterialOpsController`→celebrity，`DramaRenderService`/`DramaScriptService`/`DramaFrameJobService.listTasks`/`DramaReferenceAssembler.jobLastFrame`→drama。**无 API 路径 / 请求体 / 响应体变更**（openapi 不变），前端零改动。测试 `MaterialVideoJobAppScopeTest`（真实 H2 跑 JPQL：分区 / null-app 老数据 / 跨 app getJob 拒绝 / 回填）3/3；`mvnw test` 471 全量（1 失败为既有 flaky `JwtUtilTest`，与本次无关，见 `TODO.md`）。
- **v0.101（2026-07-10）**：一致性引擎 C-2（角色/场景实体化 + 多角度参考图集）。**两新表** `drama_character`（`DramaCharacter`，索引 `idx_dc_project`；列 `project_id`/`owner_user_id`/`name`/`role`/`cast`/`appearance_json`/`dap_avatar_id`/`voice_id`/`ref_images_json`/`created_at`/`updated_at`/`deleted_at`）+ `drama_scene`（`DramaScene`，索引 `idx_ds_project`；列 `project_id`/`owner_user_id`/`name`/`mood`/`style_tags_json`/`ref_images_json`/时间戳/`deleted_at`），ddl-auto 建。字段名对齐前端 `CharacterDef`/`SceneAsset`；`ref_images_json` = 多角度参考图集 `[{cdnKey,angle,label}]`（**真值 cdnKey，§4.7.4**；出 wire `signer.signKey` 派生 url，**不加 cdnUrl 列**）。新服务 `DramaReferenceAssetService`（区别于素材库 `DramaAssetService`）：**懒回填** `ensureBackfilled`（`getProject` 前，老项目文档→实体，单图 `refCdnKey`→`refImages[0]{front}` 迁移，幂等闸=项目实体行是否存在）+ **双写** `syncFromDoc`（`saveProject` 后，**§6.1 只 upsert 实体表、不重写 payloadJson**，增/改名/软删对齐，doc 缺 refImages 保留实体防抹除）+ **出 wire overlay** `overlayEntityRefs`（`toDetail` 把实体 refImages 叠加进文档）+ 三视图 `generateReferenceSheet`。`DramaProjectService` 注入本服务（构造 +1 依赖）。`DramaRenderService` 加 `preflightCharacterReferenceSheet`（hold 前校验端点/提示词/配额）+ `renderCharacterReferenceFrame`（单张出图不计费，供批量编排）。新端点 `POST /api/me/drama/projects/{id}/characters/{charId}/reference-sheet`（body `{angles?:[front|side|full],ratio?,appearanceHint?}` → `{characterId,refImages,cost}`）：复用 `IMAGE_GENERATION` + `drama.character_frame_image`（resource 模板加 `{{angleClause}}` 注入拍摄角度，锁脸用角色已有定妆图），**计费 hold→逐角度 commit**（hold 总额=`drama.credit.frame`×角度数，逐张 `commitHold`，部分失败剩余 `releaseHold`，全失败 release 全额+抛错——与 `renderFrame` 一次性 `debit` 有意分裂，见 `TODO.md`）；§8.0：preflight 在 hold 前，端点/提示词未配 → 503 不冻结不扣费。测试 `DramaReferenceAssetServiceTest`(8：回填幂等/双写增·改名·软删/doc 缺保留/单图迁移/三视图 hold·commit·部分退·全失败 502·未配 503 且 0 hold)；`DramaProjectServiceTest` 构造更新。门禁：server test-compile + 上述 + `DramaProjectServiceTest`/`MaterialAiE2ETest`（37 全绿）+ web-drama typecheck/build + typecheck:all(8/8) + contract；openapi 加 reference-sheet 端点。真源 [`docs/drama-consistency-engine-design.md`](../../docs/drama-consistency-engine-design.md) §4。类型沿用 drama 本地约定（不进 packages/types）。
- **v0.100（2026-07-10）**：一致性引擎 D-11（一用途多候选端点 + capability 元数据）。**新表** `ai_app_endpoint_candidate`（`AiAppEndpointCandidate`，唯一约束 `purpose+endpoint_id` + 索引 `idx_aaec_purpose`；列 `sort_order` / `enabled` / `max_ref_images` / `supports_first_last_frame` / `supports_subject_reference` / `max_duration_sec` / `credit_cost_override`，ddl-auto 建）——purpose×endpoint 交点承载「端点在某用途下」的能力画像 + 可选单价 override。`AiAppBinding` **不变**（= 该用途默认端点），`AiModelInvocationService.resolveEndpoint(purpose)` 行为零变化。新增 `resolveEndpoint(purpose, endpointId)` 重载（白名单命中返回 `ResolvedEndpoint{endpoint,candidate,isDefault}`，未命中 empty → 调用方 503 `ENDPOINT_NOT_ALLOWED` 不回退默认、不扣费，§8.0）+ `listCandidates(purpose)`。`AiAppCandidateSeeder`（@Order 60）幂等把每条现有 `AiAppBinding` 回填为置顶候选（capability 全 null）；`AiAppBindingService` 加候选 CRUD（bind 时幂等纳入候选池）。`AdminAiAppBindingController` 加 `/{purpose}/candidates[/{endpointId}]`（GET/POST/PUT/DELETE）。`DramaRenderController` 加 `GET /me/drama/render/models`（image+video 候选 + capability + isDefault）；`DramaRenderService.renderFrame/renderClip` body 加可选 `endpoint_id`（frame debit / clip item credit_cost，命中 candidate 单价 override 覆盖用途默认单价）。**视频线 endpoint_id 透传**：`renderClip` 存进 `variant_config` → `MaterialVideoWorker.extractEndpointId` → `MaterialVideoModelClient.submit/poll(..., endpointId)`（`pickEndpoint(endpointId)` 白名单，`SubmitResult` 带 endpointId 使 poll 落同一端点）；**celebrity 素材线不传 endpoint_id → null → 默认端点，默认路径完全不变**（`MaterialVideoWorkerTest` 回归）。测试：`AiModelInvocationServiceTest`(+6)、`AiAppCandidateSeederTest`(2)、`DramaRenderServiceTest`(+2 非法 endpoint_id → 503 且 0 扣费/0 提交)。门禁：server test-compile + 相关单测全绿（含 `MaterialAiE2ETest` / `MaterialVideoModelClientTest` 回归）+ web-drama typecheck/build + typecheck:all(10/10) + typecheck:admin + contract；openapi 加 `/render/models`、`/admin/ai-app-bindings/{purpose}/candidates[/{endpointId}]`、frame/clip summary 补 `endpoint_id`。真源 [`docs/drama-consistency-engine-design.md`](../../docs/drama-consistency-engine-design.md) §3。

- **v0.97（2026-06-30）**：短剧分镜一致性优化（借鉴 [ViMax](https://github.com/HKUDS/ViMax)，真源 [`docs/drama-storyboard-consistency.md`](../../docs/drama-storyboard-consistency.md)）。**P1**：`drama.epscript`/`drama.split_scene` resource prompt 补电影语言规则（叙事目的/机位复用/画面位置/摄像机vs画面内运动/单镜一句台词）；`normalizeShot` 透传 `camId`（`ProjectData.payloadJson` 内，无表变更）。**P2 视频层关键帧 i2v**：① `MaterialVideoModelClient` 加 `PROTOCOL_SEEDANCE`（火山方舟 `content` 数组 `role=first_frame/last_frame` + `return_last_frame:true` + 默认 `/contents/generations/tasks` 提交/轮询路径；按端点名/baseUrl/model 含 `seedance` 自动识别），GENERIC 分支补 `image`/`end_image`（**修复**：seedance 此前落 GENERIC 连首帧都没传），AGNES 不变；尾帧由 `DramaRenderService.renderClip` 经 `last_frame_url` marker 拼进 prompt，客户端按协议抽出，下游不支持则忽略（§8.0 传入不生效≠静默伪造）。② **新列** `MaterialVideoJob.last_frame_url`（ddl-auto 补；`PollResult.lastFrameUrl`←`extractLastFrameUrl(content/data/output.last_frame_url)`→`MaterialVideoWorker.markSucceeded` 落库→`toCard` 出 `last_frame_url`），供前端链式承接（下一镜首帧参考）。③ **新 prompt key** `drama.decompose`（`PromptService` + resource 默认 + `KNOWN_KEYS`）+ **新端点** `POST /api/me/drama/projects/{id}/shot/decompose`（`DramaProjectService.decomposeShot`：单镜→`{ffDesc,ffChars,lfDesc,lfChars,motionDesc,variationType,variationReason}`，`ff/lf_chars` 做角色名存在性校验过滤编造，复用 `DRAMA_SCRIPT_DRAFT` 端点）+ **新单价** `drama.credit.decompose`（默认 3，`DramaConfigSeeder` + `/me/drama/config`）。§8.0：端点未绑 503 `AI_NOT_CONFIGURED` / prompt 未配 503 `PROMPT_NOT_CONFIGURED`，扣费前不调模型不扣费。门禁：server 单测 35/35（`MaterialVideoModelClientTest` 10 / `DramaProjectServiceTest` 21 / `PromptServiceDramaResourceTest` 4）+ `typecheck:all` 10/10 + web-drama build(31 路由) + contract 全绿；openapi 加 `/shot/decompose`、clip 加 `last_frame_url`。
- **v0.88（2026-06-28）**：短剧工作台对齐设计稿（配合前端「渲染数据后端读取 + 编辑落库草稿态」）。`ProjectData`（wholesale `payloadJson` 文档，**无新表/新端点**）扩字段：① `scenes`（项目级场景设定 `SceneAsset{id,name,mood,refUrl?,refCdnKey?}`，短剧设定页「角色与场景」用）；② `outlinePrefs{scope,dur}`（大纲分集 AI 参数）；③ `episodeDocs[ep].meta{plot,style,cast}`（本集叙事/作品风格/出场人物）；④ `BoardShot` 加结构化 `sfx/bgm/fx`（设计稿分镜表三件套，即喂视频生成提示词的结构化字段）。`DramaProjectService.seedProjectData` 默认 seed `scenes:[]`+`outlinePrefs(trial)`，`normalizeShot` 默认 `sfx/bgm/fx:""`；`DramaBrainstormService.promote(series)` 把大纲「取景参考」`scenes[]` 预填进项目 `scenes`（与 `characters` 同惯例，新增 `scenesFromOutline`）。AI 改图复用既有 `POST /me/drama/render/frame`（`ref_images` 迭代），无新端点。`scripts/dev-fake-llm-server.mjs` 的 `/v1/images/generations` 占位图换成可见暖橙 PNG（出图/参考图/改图链路在 dev 可见）。门禁：全量 74 drama 单测绿（seed/normalize/promote 改动无回归）；持久化 API E2E（场景/参数/本集 meta/sfx-bgm-fx 落库恢复全过）+ 真实 server+fake-llm CDP 浏览器可视验收。
- **v0.87（2026-06-28）**：首页「跟 AI 聊出故事」脑暴链路（按设计稿 `AI短剧工作台.dc.html` 还原 首页→对话→剧本/分镜生成）。**新实体** `DramaBrainstorm`（`drama_brainstorms` 表，ddl-auto 建；列 id(`brs_`)/ownerUserId/title/status(`draft`\|`promoted`)/promotedKind/promotedId/payloadJson/软删）—— 立项之前的可恢复草稿，对话与故事大纲在用户决定形态（剧集/单片）前都不污染 `DramaProject`/`DramaShort`。`payloadJson`=前端 `api/brainstorm.ts` 的 `BrainstormData`（`{seed?,messages[{role,text,quick?}],outline:OutlineDraft|null,settings{form,ratio,episodes?}}`，`OutlineDraft{title,type,tone,logline,mainline,beats[],roles[{name,role}],scenes[]}`）。`DramaBrainstormService`/`Controller`：`/api/me/drama/brainstorms/**`（CRUD 软删 + 归属隔离 + 自动保存回算标题）+ `/chat`(AI 对话，返回 `{message:{role,text,quick}}`) + `/outline`(由对话生成故事大纲，返回 `{outline}`) + `/promote`(去制作 `{form?,data?}`→`{kind,projectId|shortId}`)。**AI 对话 / 大纲免费**（复用 `DRAMA_SCRIPT_DRAFT` 端点绑定 + 新 prompt key `drama.brainstorm_chat`/`drama.brainstorm_outline`，`PromptService` 加 key + resource 默认 + `KNOWN_KEYS`），与 recipe/script-draft 一致不扣费、设计稿也无积分提示。`chat`/`outline` **不落库**（前端合并后 PUT 自动保存，与 `outlineAiDraft`/`epscriptAiDraft` 同惯例，防前后端并发覆盖）。**§8.0**：端点未绑 503 `AI_NOT_CONFIGURED` / prompt 未配 503 `PROMPT_NOT_CONFIGURED` / 调用失败 502 `AI_CALL_FAILED` / 解析失败 502 `AI_BAD_OUTPUT`，均不产假数据。**「去制作」promote**：`series`→`DramaProjectService.createProject`（免费立项，再 `saveProject` 把大纲 `roles` 预填成项目 `characters`）/ `single`→`DramaShortService.createFromRecipe`（扣 `drama.credit.short-entry`）；脑暴标 `promoted`（**幂等**：已 promote 直接回原去向，不重复立项/扣费）。门禁：`DramaBrainstormServiceTest` 15/15 + 全量 74 drama 单测绿 + `PromptServiceDramaResourceTest` 4/4（新 2 个 resource prompt 校验）；openapi 加 6 path stub；`scripts/dev-fake-llm-server.mjs` 加脑暴 chat/outline JSON 分支。**真实 server + fake-llm API 级 E2E 24 断言**全过（dev-login→脑暴→对话→大纲→落库→恢复→promote 项目/单片→真实实体+幂等）。
- **v0.86（2026-06-27）**：admin 财务工作台辨识用户身份 —— 充值订单 + 结算中心（钱包·流水·业务交易三 Tab）+ 充值核准确认弹窗 + 对账 CSV 展示用户**手机号**（与登录名分列）。`RechargeOrderDto`/`WalletDto`/`LedgerEntryDto`/`TransactionDto` 加 `phone`，沿用 v0.58 read-time 回填法（`RechargeService.listForAdmin` 批量 `usersByIds` + `XxxDto.from(.., owner)` 取 `owner.getPhone()`）—— **无新表 / 无快照列**，旧订单也能显示、手机号始终最新；用户自查接口 owner=null → `@JsonInclude.NON_NULL` 自动省略。门禁：server test-compile + RechargeService 16 / CreditOps 15 / AlipayNotify 5 / PayNotify 6 全绿；typecheck:all + contract 绿；openapi `Wallet`/`LedgerEntry`/`RechargeOrder`/（deprecated）`Transaction` 加 `phone`。
- **v0.85（2026-06-19）**：大模型调用层结构性统一（落实 v0.84 记的架构债）。新增共享原语 `service/ai/UpstreamModelHttp`（`@Component`）+ `ModelCallCtx`（builder：purpose/endpoint/model/requestId/ownerUserId/appCode/requestBodyJson/replayOfRecordId + 控制位 recordFailureUsage/maxAttempts/retryBackoffMs/client）+ `UpstreamCallException`（网络层失败语义 + isTimeout）。`sendJson(req, ctx)` 统一做：发送 → io 记原始请求/响应（独立 logger `aep.ai.upstream.io`）→ 非 2xx WARN raw body + best-effort 落失败 `AiModelUsageRecord`（含 `responseBodyJson`/latency/errorCode）→ **返回 resp 供调用方按自己的错误码处理**（非 2xx 不抛，保持对外行为/错误码不变）；网络层失败按 `maxAttempts` 退避重试后抛 `UpstreamCallException`；`recordBadOutput(ctx, rawBody, code)` 供「2xx 但解析失败」用。四个客户端的同步 JSON 调用全部改走它：文本 `AiModelInvocationService.doChat`、图像 `DramaRenderService.callImageModel`、视频 `MaterialVideoModelClient.submit/poll`、数字人 `DapMultimodalClient.postJson/getJson`（保留其 IOException 重试 1 次：`maxAttempts=2`）。**职责边界**：成功路径的 token/计费单位只有调用方能解析，故成功用量仍由各调用方落库（chat 带 tokens、image/video/dap 带 metered units/seconds）；本原语只统一原始日志 + 失败/基础用量。**保持不变**：各模态对外错误码（AI_PROVIDER_TIMEOUT/AI_CALL_FAILED/AI_BAD_OUTPUT、VIDEO_SUBMIT_FAILED/VIDEO_POLL_FAILED、IMAGE_CALL_FAILED/IMAGE_BAD_OUTPUT、DAP_MODEL_HTTP_*/DAP_MODEL_CALL_FAILED）、积分 hold/commit/release、appCode 归属（video 按 job.kind、首帧→drama）。video poll 与 dap 沿用历史「失败不在此处落用量」（poll 避免瞬时失败刷表；dap 用量在调用方按 metered 记）→ `recordFailureUsage=false`，仅原始日志统一。Coze SDK 流式（`ForgeCozeService`）暂留，已记 TODO。无新表/端点/契约变化。新测试 `UpstreamModelHttpTest`（7/7）；全量 188 测试除 4 个预存在失败（`MaterialOpsE2ETest`×3 + `PlatformSupportTest.toCsv_roundTrips`，与本次无关）外全绿。
- **v0.84（2026-06-18）**：大模型调用失败时统一记录上游原始响应（排查用），覆盖全部模态。文本 `AiModelInvocationService`（2xx 但响应不可解析也 WARN raw body + 落 `responseBodyJson`，抛 `AI_BAD_OUTPUT`）、图像 `DramaRenderService`（缺 `data[0].url/b64_json` 的 bad-output 记 raw body）、视频 `MaterialVideoModelClient`（poll 失败 WARN raw body，配合 v0.83 `extractFailReason`）、数字人 `DapMultimodalClient`（video poll 失败 WARN raw body）。纯可观测性增强，无行为/契约变化。**架构债已记 TODO**：图像/视频/数字人各有独立 HTTP 客户端（仅文本走唯一入口），可观测性靠逐站点补；下一步抽共享 `UpstreamModelHttp` 原语统一 send + 原始日志 + usage 落库。
- **v0.83（2026-06-17）**：短剧视频任务两修。① **用量归属错记**：drama 分镜视频走 `MaterialVideoJob`（kind=drama-shot），但 `MaterialVideoModelClient` 记 `AiModelUsageRecord` 时 appCode 传 null → 落到 `inferAppCodeForPurpose(VIDEO_GENERATION)` 默认值 `celebrity`。现 `submit(...)` 加 `appCode` 参，`MaterialVideoWorker` 按 `job.kind` 派生（`drama-*`→drama，否则 celebrity）。（首帧图 `IMAGE_GENERATION` 本就推断 drama，未受影响。）② **失败无原因**：上游 poll 返回 status=failed 时只记「status=failed, taskId=...」。新增 `MaterialVideoModelClient.extractFailReason`（抽 `fail_reason`/`error`/`message`/`detail` 等 + `data.*`）→ 进 `PollResult.failReason` → `MaterialVideoWorker.markFailed` 拼进 `errorMessage`，前端任务浮窗失败行展示原因。无新实体/表/端点。测试 `MaterialVideoModelClientTest` +1（10/10）。配套 web-drama 任务浮窗（`render-task-dock`）：仅在 `/projects/[id]` 与 `/shorts/make` 出现（其它页不挂不轮询）、活跃优先 + 最多 6 条、失败行显示失败原因。
- **v0.82（2026-06-17）**：修短视频草稿重开「首帧/成片」图裂。`DramaShort` 草稿 `payloadJson` 里 shots 存的是生成时返回的**带时效签名 OSS URL**（前端只存了 url），重开草稿超过签名 TTL（默认 3600s）→ 私有桶 403。`DramaShortService.toDetail` 出 wire 前新增 `resignPayloadAssets`：遍历 shots 的 `frameUrl`/`frameUrls`/`videoUrl` 走 `resolveAssetUrl`（`CdnUrlSigner.maybeSign` 从存的 URL 反抽 key、砍过期 query 参数、重签），与 meta 卡片同口径。兼容历史草稿（key 内嵌在 URL 路径里可恢复），**无需数据迁移**，已修复线上 `dvs_2a05a3af5ccd`。`DramaShortServiceTest` +1（10/10）。
- **v0.81（2026-06-17）**：移除 AI 端点的「外部 API Token」对外网关（自用场景不需要对外暴露 LLM）。**删**：`EmbeddedLlmProxyController` + `EmbeddedLlmProxyService`（对外 OpenAI 兼容网关 `/v1`、`/api/llm/v1`）、`AiModelEndpointKeyService`（mint/revoke/validate/reportUsage `sk-aep-*` Token）、`AiModelEndpointKeyMintedDto` / `LlmUsageReportDto`、admin 端点 `POST /admin/ai-models/{id}/mint-key`、`/revoke-key`。`AiModelEndpoint` 删字段 `keyPrefix`/`keyHash`/`keyRevokedAt`（物理列保留无害，免迁移），`AiModelEndpointDto` 删 `keyPrefix`/`keyMasked`/`hasKey`/`keyRevokedAt`，repo 删 `findByKeyPrefix`。**保留**：上游密钥 `upstreamApiKeyEncrypted`、`ai_app_binding`（用途→端点，内部 AI 应用调用命脉）、用量计数器（内部 `AiModelInvocationService` 仍写）、`ownerUserId`。admin「AI 模型与用量」页删「生成 Key/重生成/撤销」按钮 + API Token 列 + 明文弹窗；overview 删「缺 Key」指标。openapi 同步删 3 path。门禁：server compile + Ai-model 单测 + `CelebrityZoneServiceTest` 全绿；admin typecheck + contract OK。
- **v0.80（2026-06-17）**：高优技术债收口（安全 + 持久化）。① **生成任务落表**：新实体 `GenerationJob`（`generation_jobs` 表，ddl-auto 建）+ `GenerationJobRepository`，替换 `CelebrityZoneService` 的静态 `ConcurrentHashMap`。`startGeneration` 落表（`startedAt`/`totalSec`/`engine`/`userId`/`creditCost`/`committed`）、`getJobProgress` 从 repo 读并按 `startedAt + totalSec` 实时算进度；重启后任务进度仍可恢复、done 时幂等 `commitHold`（`committed` 标记守门，不再产生孤儿冻结额度）。进度本身不存（实时计算）。② **`AdminStaffController` self-protect**：`delete` 拒删自己；`update` 拒改自己的 `role`/`status`（防锁死 / 自我提权），仍允许本人改昵称/邮箱/密码；均抛 403。③ 审计澄清（无代码改动）：engine-pricing 实际早已落 `PlatformConfig`（key=`celebrity.engine-pricing`，内存仅 cache）；`AdminAepUsersController.updateOperatorRole` 早已是 `hasRole('SUPER_ADMIN')` + 自保护；`/me/wallet/recharge` 非「mock 直接落账」而是建 PENDING 订单 + 运营 `approveOrder` 才落账（无刷余额风险）。无新端点 / 无 DTO 改动（openapi 不变）。测试 `CelebrityZoneServiceTest` 5/5。
- **v0.79（2026-06-15）**：互动剧（剧情互动短剧）= `DramaProject` 的形态，**无新实体 / 无新表**。互动剧的分支编排（互动点 / 接线 / 全局标记 / 起始集 / 结局）作为叠加层存进既有 `drama_projects.payload_json` 的 `ProjectData.interactive`（`{enabled,startEpisodeId,globalFlags,nodes:{episodeId→{interactions[],nextVideoId,isEnding,endingLabel}}}`）；剧集即项目大纲分集，每集视频仍是六阶段「成片合成」产物（`episodeDocs[no].assembled`）。`DramaProjectService` 新增 `interactiveDraft(id,{theme?})`：复用 `DRAMA_SCRIPT_DRAFT` 端点 + 新提示词 `drama.interactive_draft`（`PromptService` 新 key + resource 默认 + KNOWN_KEYS），把一句话主题蒸成「大纲分集 + 分支叠加层」`{episodes, interactive}`（不落库，前端合并后 PUT 保存）；`createProject(mode=interactive)` 与 `saveProject`（payload 带 `interactive.enabled`）回写 `mode=interactive`。新单价 `drama.credit.interactive-draft`（默认 18，`DramaConfigSeeder`）。§8.0：端点未绑 503 `AI_NOT_CONFIGURED` / prompt 未配 503 `PROMPT_NOT_CONFIGURED` / 调用失败 502 `AI_CALL_FAILED`，均扣费前不调模型不扣费。新端点 `POST /api/me/drama/projects/{id}/interactive/draft`（属主）。测试 `DramaProjectServiceTest` +3（互动剧 seed / 未配置 / 图解析）共 16/16。（删除前一版误起的独立实现 `DramaInteractive` 实体 + repo + service + controller + test + `drama.interactive_clip_video`。）
- **v0.76（2026-06-13）**：短剧 / 短视频制作支持「草稿」（刷新 / 返回 / 换设备接着做）。短视频制作此前**零持久化**（前端整页内存态）→ 新实体 `DramaShort`（`drama_shorts` 表，ddl-auto 建）+ `DramaShortRepository` + `DramaShortService`（CRUD 软删 + 按 `ownerUserId` 隔离 + 新建 seed 最小 ShortDraftData + 保存时按 `payloadJson.shots` 回算 `durationSec`/`shotCount`/`doneCount`/`progress`，`status` draft\|done）+ `DramaShortController`（`/api/me/drama/shorts/**`：list/create/get/save/delete）。`payloadJson` = 前端 `api/shorts.ts` 的 `ShortDraftData`（`{step,meta,shots[],chat[],refs,idea,reopen,fmtKey}`）。本服务**不碰** AI / 计费 —— 出脚本 / 出片仍走既有 `/me/drama/scripts/ai-draft`、`/me/drama/render/*`，本表只持久化「做到一半」的整页状态。测试 `DramaShortServiceTest` 4/4（seed / 回算 / 完成态 / 归属隔离 + 软删）。短剧侧无后端改动（大纲漏存为纯前端修复）。（原并行分支记 v0.74，并入本线顺延 v0.76）
- **v0.75（2026-06-13）**：创意市场双通道精选授权 + 运营手建内置。`DramaRecipe` 加列 `author_name` / `invited_by` / `consent_at`（ddl-auto 补）；`status` 增 `invited`（待用户授权）| `declined`；`origin` 增 `featured`（运营精选用户作品）。`DramaRecipeService` 抽公共蒸馏 `distillAndSave`，三通道复用：① `extractFromProject`（用户自助→submitted）② `inviteFromProject`（运营对任意用户项目→invited + 给作者发授权站内信）+ `respondInvite`（作者 approve→published/consentAt · decline→declined）③ `createBuiltin`（运营手建→origin=official 直接 published）。`listCandidates`=跨用户已铺大纲项目池（标作者 + 是否已抽过），`resolveAuthorName` 注入 `AepUserRepository`，publish/reject/invite/approve 经 `NotificationPublisher` 旁路发站内信。新仓库方法：`DramaProjectRepository.findTop80...StageGreaterThanEqual...` + `findByIdAndDeletedAtIsNull`、`DramaRecipeRepository.findBySourceProjectIdInAndDeletedAtIsNull`。新端点：`GET /api/me/drama/recipes/candidates`、`POST /api/me/drama/recipes/invite`、`POST /api/me/drama/recipes/builtin`（`requireOperator`）、`POST /api/me/drama/recipes/{id}/respond`（属主授权）。测试 `DramaRecipeServiceTest` 19/19（+invite/respond/builtin/candidates）。
- **v0.74（2026-06-13）**：官方内置配方 seeder。新 `DramaRecipeSeeder`（`CommandLineRunner` `@Order(72)`）声明式幂等 upsert `resources/seed/drama-recipes-official.json`（19 条 `origin=official`、`ownerUserId=__official__`、直接 `published`；按 id 更新内容字段但保留运行期 `useCount` + 首次 `createdAt`）。`DramaRecipe` 加列 `cover_image`（官方真实预览图 `/recipes/<id>.webp`，落 `web-drama/public/recipes/`；空则前端回退 cover 渐变）。
- **v0.73（2026-06-13）**：抽 skill 飞轮（Recipe MVP · 后端抽取核心）。新实体 `DramaRecipe`（`drama_recipes` 表，ddl-auto 建）+ `DramaRecipeRepository`：从爆款 `DramaProject` 蒸馏的可迁移配方（列 status/origin/title/summary/typeKey/ratio/episodes/cover/useCount/sourceProjectId；`payloadJson` = `{mainline,beats[{no,hook,beat}],characters[{role,archetype,desc}],hooks[],notes}`）。`DramaRecipeService.extractFromProject(projectId,userId)`：加载属主项目 → ProjectData（大纲/角色）喂新 prompt `drama.recipe_extract`（PromptService 新 key + resource 默认 + KNOWN_KEYS）→ 大模型「去具体化」蒸馏 → 落库 `status=submitted`。端点 `POST /api/me/drama/projects/{id}/extract-recipe`（属主）。复用 `DRAMA_SCRIPT_DRAFT` 端点绑定。§8.0：`AI_NOT_CONFIGURED` / `PROMPT_NOT_CONFIGURED` / `DRAMA_RECIPE_NEEDS_OUTLINE` / `AI_CALL_FAILED` / `AI_BAD_OUTPUT`。测试 `DramaRecipeServiceTest` 5/5。待续：运营审核发布 `/admin/drama/recipes*` + 创意库套用。
- **v0.72（2026-06-13）**：图像 / 视频 prompt 服务端化。`PromptService` 新增 4 个 key —— `drama.frame_image` / `drama.clip_video`（工作台分镜出图/出片）、`drama.short_frame_image` / `drama.short_clip_video`（短视频工坊），resource 默认为单 prompt 模板（无 `---`，整块为 user；占位符 `{{visual}}`/`{{size}}`/`{{move}}`/`{{lineClause}}`/`{{castClause}}`/`{{styleSuffix}}`/`{{metaPrefix}}`）。`DramaRenderService` 新增 `buildMediaPrompt(body, workbenchKey, shortKey)`：按 `body.kind`（shot/short）选模板 → `resolve()` + `fill(vars)` → 正则清掉未填充残留 `{{}}`；`origin=code` → 503 `PROMPT_NOT_CONFIGURED`（§8.0）。`renderFrame`/`renderClip` 不再读 `body.prompt`（保留过渡兼容：仍传 prompt 则直用），改由结构化 `vars` 服务端组装。`/me/drama/render/{frame,clip}` 路径不变、仅请求体形态变（openapi summary 同步）。测试 `PromptServiceDramaResourceTest` 4/4。
- **v0.71（2026-06-13）**：短剧工作台 prompt 数据化。`DramaProjectService` 4 段写死 LLM prompt（大纲/整集分场分镜/单场拆镜/选角）抽进统一 `PromptService`：新增 key `drama.outline` / `drama.epscript` / `drama.split_scene` / `drama.cast`（并入 `KNOWN_KEYS`，`PromptTemplateSeeder` 自动从 resource seed）+ 4 个 resource 默认 `resources/prompts/material/drama.*.md`（system + `---` + user 模板，占位符 `{{title}}`/`{{count}}`/`{{loglineClause}}` 等）。调用改 `promptService.resolve(key)` + `PromptService.fill(userTemplate, vars)`；可选片段（简介/主线/风格/出场/台词/分集梗概）由 Java 拼成 `{{xxxClause}}` 注入，行为与旧写死串 1:1。4 prompt 仍共用 `DRAMA_SCRIPT_DRAFT` 端点绑定，但 prompt 与 `temperature`/`maxTokens`/`jsonMode` 各自可配（运营在 admin `/drama/prompts` 改，留空回落推荐默认 0.9/0.85/0.8/0.9 + 4096 + JSON 开）。**§8.0**：端点未绑 → `AI_NOT_CONFIGURED`；prompt 未配置（origin=code）→ `PROMPT_NOT_CONFIGURED`，二者均在扣费前、不调模型不扣费。无新表/实体/端点（复用 `prompt_template` + `/api/admin/prompts`）。测试：`DramaProjectServiceTest` 13/13 + 新 `PromptServiceDramaResourceTest` 2/2。
- **v0.65（2026-06-12）**：短剧全站接真后端（server 模式所有接口真连，与 mock 完全隔离）。
  - **工作台 AI 扩展**：`DramaProjectService` +`epscriptAiDraft`（整集→分场+分镜）/`splitSceneShots`（单场拆镜）/`castAiDraft`（选角）；`DramaProjectController` +`/{id}/epscript/{ai-draft,split-scene}` + `/{id}/cast/ai-draft`。均复用 `DRAMA_SCRIPT_DRAFT` 端点 + JSON 模式，归一化 BoardShot（dur 钳 1-30、engine→avatar/seedance）。
  - **分镜渲染**：新 `DramaRenderService` + `DramaRenderController`（`/me/drama/render/{frame,clip}`）。首帧=图像生成（新用途 `AiModelPurpose.IMAGE_GENERATION`，OpenAI images 兼容 → 字节经 `CdnUploader` 落 CDN，URL 由 `CdnUrlSigner` 派生，`CreditService.debit` 按次扣 2 分）；视频=委派 `MaterialVideoJobService`（kind="drama-shot"，异步 submit+poll，自带 hold/commit/release），轮询复用 `/me/drama/episodes/jobs/{id}`。未配 503 `IMAGE_NOT_CONFIGURED` / 失败 502 `IMAGE_CALL_FAILED`。
  - **分发真后端**：新实体 `DramaPublishJob`（`drama_publish_jobs`）+ `DramaPlatformConnection`（`drama_platform_connections`，user×platform 唯一）+ `DramaDistributionService`（平台静态目录 + 连接 + 发布任务队列 `@Scheduled` 推进 queued→uploading→transcoding→publishing→live）+ `DramaDistributionController`（`/me/distribution/**`）。未连平台发布 → 409 `PLATFORM_NOT_CONNECTED`。
  - **提现**：`CreditService.withdraw`（账本侧原子扣减 + `WITHDRAW` 流水，余额不足 402）+ `AccountController` `/me/wallet/withdraw`。
  - **真模型实测**：agnes-image-2.1-flash 出真 720×1280 首帧 PNG；agnes-video-v2.0 真 submit + 轮询（视频生成 >600s，`AEP_VIDEO_MAX_WAIT_SEC` 生产需调高）。dev 默认仍绑 fake（`AiModelPurpose.IMAGE_GENERATION` 已纳入 `DevFakeAiSeeder`）。详见 `docs/VERSION_HISTORY.md` §v0.65。
- **v0.66（2026-06-12）**：短剧扣费+配置+成片合成。`DramaProjectService` 四个 AI 动作接 `CreditService`（hold→commit/失败 release，refType `DRAMA_AI`），单价/确认阈值存 `PlatformConfig`（`drama.credit.*`，`DramaConfigSeeder` seed；admin「短剧专区」`/drama/config` 管理）；新 `DramaConfigController`（`GET /api/me/drama/config`）。新 `DramaAssembleService` + `POST /api/me/drama/projects/{id}/assemble`：episodeDocs[ep] 已出片分镜 ffmpeg concat（复用 mixcut `FfmpegRunner`，copy 失败回退重编码）→ `CdnUploader` 落 CDN。`ProjectData.payload` 新增 `episodeDocs` 按集存档（无表结构变更）。详见 `docs/VERSION_HISTORY.md` §v0.66。
- **v0.64（2026-06-12）**：短剧「六阶段项目工作台」接真后端。新实体 `DramaProject`（`drama_projects` 表，JSON-document：整套 `ProjectData`〔选题/大纲/角色/剧集脚本/分镜/成片配方〕存 `payload_json`，列表卡片核心列〔title/type/typeKey/ratio/episodes/progress/stage/mode/cover〕另存）+ `DramaProjectService`（CRUD 软删 + 按 `ownerUserId` 隔离 + 新建 seed 空 ProjectData + `outlineAiDraft` 大模型起草分集大纲，复用 `DRAMA_SCRIPT_DRAFT` 绑定端点；未配 503 / 调用失败 502，不静默兜底）+ `DramaProjectController`（`/api/me/drama/projects*` + `/{id}/outline/ai-draft`）。前端 web-drama 项目列表 / 新建（从零 + 套模板 + 衍生）/ 工作台加载 / 保存 / 大纲 AI 全部从 mock 切真（`ProjectsApi`）。详见根目录 [`AGENTS.md`](../../AGENTS.md) 最近 5 版表 + `docs/VERSION_HISTORY.md` §v0.64。
- **v0.62（2026-06-11）**：明星档案编辑权移交 star 端。`StarWorkbenchService.updateProfile` + `PUT /api/star/profile`（营销字段：name/category/description 必填 + bio/location/fans/avatar/cover；归属由 JWT principal 解析 StarAccount 绑定）；新 `StarProfileUploadController` → `POST /api/star/profile/uploads`（multipart，仅 avatar/cover 图片，走 FileStorageService，与 admin 上传同构）；`StarProfileDto` 扩展 cover/description/bio/location。**下线** `PUT /api/admin/celebrity/stars/{id}`（`adminUpdateStar` 删除；新增/软删/photos/videos 端点保留）。无表结构变更。详见根目录 [`AGENTS.md`](../../AGENTS.md) 最近 5 版表 + `docs/VERSION_HISTORY.md` §v0.62。
- **v0.55（2026-06-07）**：web-celebrity 运营内嵌管理「混剪工厂模板」补后端。`MixcutTemplateService` +`deleteFactory(templateId)`（factory scope 物理删除）；新 `AdminMixcutTemplateController` → `PUT /api/admin/mixcut/templates/{templateId}`（`upsertFactory` 就地写工厂模板，全员可见）+ `DELETE`（删工厂模板）。落 `/api/admin/**` → `AepSecurityConfig` 的 `hasAnyRole(SUPER_ADMIN, OPERATOR)` 自动保护（不改安全配置）。明星 CRUD 复用既有 `AdminCelebrityController`（`/api/admin/celebrity/stars[/{id}]` + `/uploads`，**无后端改动**）。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.55。
- **v0.43（2026-05-29）**：三子产品平台访问隔离 + 音乐/短剧形象锻造接平台大模型 + 短剧脚本化生成。
  - **平台隔离**：`AepUser` +`platforms` 列（CSV；空=全部可访问），`/api/me` 透出；`PlatformAccessService` 按 `aep.platform.dev-grant-all`（默认 true=一处注册三端可用 / false=按注册来源 `platform` 授予）决定注册授予。拦截在前端，后端不做逐接口平台门禁。
  - **形象锻造**：`AiModelPurpose` +`APPEARANCE_FORGE`；`ForgeChatService` 混合通道（大模型优先 `invokeChat`+服务端切流 SSE，Coze 回退，都没配 503）；`ForgeController` +`/appearance-forge/chat/{status,stream}`（`/coze/*` 保留为别名）。music + drama 共用。
  - **短剧生成**：新实体 `DramaScript`（`drama_scripts` 表）+ `DramaScriptService`（CRUD 软删 + `aiDraft` 大模型起草分场景脚本 + `generateEpisodes` 委派 `MaterialVideoJobService`）+ `DramaController`（`/api/me/drama/scripts*` + `/episodes/{generate,jobs}`）；`AiModelPurpose` +`DRAMA_SCRIPT_DRAFT`。视频生成复用 `material_video_job`，以 `kind="drama-episode"` + `scriptId` 区分带货视频。
  - **联调**：`DevFakeAiSeeder`（`aep.dev-fake-llm.enabled`，dev 默认开）一键接入 fake 端点 + 绑定用途；配套 `scripts/dev-fake-llm-server.mjs`。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.43。
- **v0.42（2026-05-29）**：素材运营「带货视频生成」接真后端（异步 submit + 轮询）。新实体 `MaterialVideoJob`（`material_video_job` 表）+ `MaterialVideoModelClient`（视频大模型「提交+轮询」HTTP 客户端，单一可替换点；端点取自后台「AI 模型与 Key」用途 `VIDEO_GENERATION` 的绑定，submit/poll 协议走 `aep.material.video.*`，默认对齐 智谱 CogVideoX 异步约定；未配 → `VIDEO_NOT_CONFIGURED` 503）+ `MaterialVideoJobService`（提交扣费+派发 / 查询 / wire 映射）+ `MaterialVideoWorker`（`@Async("materialVideoExecutor")` 服务端轮询直到出片/超时，成功 `commitHold` / 失败 `releaseHold`）。`AiModelPurpose` +`VIDEO_GENERATION`；`CelebrityActionPricingService` +action `material.video-generate`（默认 30/条）。`MaterialOpsController` +`/material/videos/generate` + `/material/videos/jobs[/{id}]`。配套修脚本预览关联商品错配（前端按 `product_id` 查全量商品库）+ 基线生成直给。详见根目录 [`AGENTS.md`](../../AGENTS.md) §v0.42。
- **v0.41（2026-05-29）**：合并「AI 模型」+「外部 API Token」为统一的**模型接入端点 + Token**，并加**大模型用量统计**。
  - 实体 `AiModelProvider` → `AiModelEndpoint`（表名仍 `ai_model_providers`，复用列 `api_key_encrypted`/`default_model`）：一行 = 固定 {上游密钥 + 单模型 + 地址}，自带外部 Token（`key_prefix`/`key_hash`/`owner_user_id`/`total_tokens`/`total_calls`/`last_used_at`/`key_revoked_at`）；删 `purposes`/`priority` 字段（物理列残留无害）。
  - 新增 `ai_app_binding` 表（用途 `AiModelPurpose` 作主键 → `endpoint_id`）：每个 AI 应用固定绑**一个**端点，**无优先级/无 5xx 兜底**。`AiModelInvocationService` 改 `resolveEndpoint(purpose)` 单端点解析（`hasProviderFor`→`hasEndpointFor`）。
  - 外部调用链已内嵌进 server：`/api/llm/v1/**` 与 `/v1/**` 直接校验端点 Token、调用上游并落 usage；独立 LLM 服务与旧 internal 同步接口已删除。
  - 新端点 `POST /api/admin/ai-models/{id}/mint-key`（铸外部 Token，明文一次）/ `revoke-key`；新 `GET /api/admin/ai-app-bindings` + `PUT/DELETE /api/admin/ai-app-bindings/{purpose}`。旧独立 Key CRUD 折叠进端点页。
  - 迁移 `AiModelEndpointBindingSeeder`（@Order 55）：旧 provider 行按 `models[0]` 回填 `model`，按旧 `purposes`/`priority` 升序回填绑定（首个最低 priority 胜）；全新 DB 无旧列时静默跳过。
  - **大模型用量统计（自建 token 流水）**：新增 `ai_model_usage_record` 表（`AiModelUsageRecord`：providerId(=端点 id) / providerName / model / purpose / prompt/completion/total Tokens / success / createdAt）+ `AiModelUsageRecordRepository`（Object[] 聚合）+ `AiModelUsageService`（`record(...)` best-effort 落库 + `report(days)`/`reportForProvider(id, days)` 聚合，days 缺省 30 封顶 365）。`AiModelInvocationService.doChat` 解析 `prompt_tokens`/`completion_tokens` 并在末尾落流水（`REQUIRES_NEW` 独立事务 + try/catch，绝不阻断 chat）。新增 `GET /api/admin/ai-models/usage` + `GET /api/admin/ai-models/{id}/usage`。把响应里返回的 `usage` 自行落库聚合（对所有 OpenAI 兼容端点通用，不依赖各家计费接口）；仅记成功调用。
- **v0.40（2026-05-29）**：素材运营「文本三件」接真 LLM（脚本起稿 / 卖点提取 / 变量抽取）—— 复用 `AiModelInvocationService.invokeChat`（+SELLING_POINTS/VARIABLE_EXTRACT purpose、response_format 透传），新增 `MaterialAiService`（解析/校验/自修复重试；**不静默兜底**：provider/prompt 未配或调用/解析失败抛带 code 的明确错误 `AI_NOT_CONFIGURED`/`PROMPT_NOT_CONFIGURED`/`AI_CALL_FAILED`/`AI_BAD_OUTPUT`，便于定位配置问题）。prompt（system+user 模板）建 `prompt_template` 表，`PromptService` 解析（DB→resource→代码兜底，1min 缓存）+ `PromptTemplateSeeder`（缺行才插）+ `AdminPromptController`（/api/admin/prompts CRUD + dry-run）。`MaterialOpsController` +`/material/scripts/ai-draft` + `/material/scripts/{id}/variables`。脚本起稿计费（后端可配置）：`CelebrityActionPricingService` +action `material.script-draft`（默认 0=不计费），`MaterialOpsService.draftScripts` 走 `CreditService` hold(单价×稿数)→commit/release，余额不足抛 402。方案见 [`docs/archive/material-ops-ai-text-plan.md`](../../docs/archive/material-ops-ai-text-plan.md)。
- **v0.39（2026-05-28）**：Agent 平台（Coze）配置化。
  - 新增 `agent_bot_providers` 表 + `/api/admin/agent-bots/**`（CRUD + `/scenes` 场景目录）。把「形象锻造」这类挂在 Coze 等 agent 平台上的会话能力从 env 写死改为后台可配；token AES-GCM 加密落库，永不明文返回；一个 `sceneKey` 唯一对应一个 bot。
  - `ForgeCozeService` 改为按 sceneKey（`appearance-forge`）从 DB 解析 bot 配置（token / botId / apiBase / userIdPrefix），**env 兜底**保持老部署不破；按 (apiBase, token) 缓存 Coze client。
  - 前端 `apps/web-music` 的形象锻造已自带 `USE_MOCK` 开关（mock 本地回放 / live 走真实 SSE），本期未改；live 路径自动用后台配置的 bot。
  - `platform` 字段预留 DIFY / CUSTOM 扩展位（本期仅 COZE 真实接通）。
  - `AgentBotProvider` 加可选 `spaceId`：仅供 admin 拼 Coze 控制台 bot 配置页深链（`{console}/space/{spaceId}/bot/{botId}`，console 由 apiBase 推断 coze.cn/coze.com），不参与调用。
- **v0.38（2026-05-28）**：大模型配置化收口。
  - 删除 `AiModelProviderDataInitializer`（不再 seed 占位 provider）——provider 完全走 admin 配置，dev / prod 不再区分。
  - 内置常见服务商**预设**（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI）：`GET /api/admin/ai-models/presets`，admin 选中即填 baseUrl / 默认模型，补 apiKey 即可建档。
  - **模型发现**：`POST /api/admin/ai-models/discover-models`（新建前用表单 baseUrl+apiKey 拉 `GET /models`）与 `POST /api/admin/ai-models/{id}/fetch-models`（已存 provider 用落库密钥拉），解析 `data[].id` 并过滤 `status=Shutdown/Retiring`。
  - `AiModelProviderDto` / upsert 新增 `models`（落 `ai_model_providers.models_json`），可视化挑选默认模型。
  - `AiModelInvocationService` providerType 兼容集放宽：除 `ANTHROPIC` / `AZURE_OPENAI` 外均走 OpenAI 兼容 wire（含 VOLCENGINE / ALIYUN / MOONSHOT / DEEPSEEK / BAIDU / TENCENT）。
- **v0.34（2026-05-27）**：
  - 引入 **Flyway**（`db/migration/V<N>__xxx.sql`）；首启 baseline-on-migrate 自动到 V1，后续 schema 改动走 V2+
  - 演示数据 seeder 全部加 `aep.seed.dev-data.enabled` gate（mysql profile 默认 `false`），生产空库不会写入 admin/admin123 等演示账号
  - **密钥 fail-fast**：mysql/prod profile 启动时检测到 `AEP_JWT_SECRET` / `AEP_SECRET_KEY` 仍是 dev default → 立即抛异常拒绝启动
  - HikariCP 显式参数化（maximum-pool-size 等），便于按 RDS 规格调
  - 完整 deploy 模板在 `infra/`

## 技术栈

| 组件 | 版本 |
|------|------|
| Java | 17 |
| Spring Boot | 3.3.5 |
| Spring Security | JWT (JJWT 0.12.6) + BCrypt |
| ORM | Spring Data JPA / Hibernate |
| 数据库 | H2（本地开发） / MySQL 8（生产） |
| 构建 | Maven |
| 端口 | 8080 |

## 快速启动

### 本地开发（默认，无需数据库）

```bash
cd apps/server
mvn spring-boot:run
```

默认激活 `dev` profile，使用 **H2 内存数据库**（`MODE=MySQL` 兼容模式）。启动即用，每次重启自动 seed 种子数据。

### 环境变量

| 变量 | 用途 | 必配？ |
|---|---|---|
| `AEP_SECRET_KEY` | AES-GCM 对称密钥（加密 `AiModelEndpoint` 上游 apiKey 等敏感字段；32 字节，短/长会用 SHA-256 派生）。生产**必须**配；dev 缺省时回退到固定字符串。 | 生产**必配**；dev 可缺省 |
| `aep.secret.key` | 同上的系统属性别名（`-Daep.secret.key=...`）；优先级低于环境变量 | 可选 |
| `SPRING_PROFILES_ACTIVE` | `dev`（默认）或 `mysql` | 看部署环境 |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | mysql profile 时的数据源 | mysql profile 必配 |
| `AEP_VIDEO_*`（`_SUBMIT_PATH` / `_POLL_PATH` / `_POLL_INTERVAL_SEC` / `_MAX_WAIT_SEC` / `_MAX_CONCURRENT` / `_DEFAULT_MODEL` …） | v0.41 带货视频生成（`aep.material.video.*`）协议 / 轮询调参。**视频大模型 token 不在这里配**，走后台「AI 模型」页（用途 `VIDEO_GENERATION`）。换厂商一般只改 submit/poll 子路径。 | 可选（有默认值） |

启动后可访问：
- API: http://localhost:8080
- H2 控制台: http://localhost:8080/h2-console（JDBC URL: `jdbc:h2:mem:aistareco`，用户名 `sa`，密码留空）

### MySQL 环境

```bash
# 1. 建库
mysql -u root -p -e "CREATE DATABASE aistareco CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. 启动（指定 mysql profile）
# ⚠️ Spring Boot 3.x maven plugin 用 -Dspring-boot.run.profiles（dash 不是 dot）
#    旧写法 -Dspring.profiles.active=mysql 在 3.x 不生效，会回退到 dev profile + H2
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

**v0.34+ 本地用 mysql profile 联调的最小 env 集**（必须 export 后再 mvn 启动，否则
JwtUtil / AepCryptoUtil 启动时 fail-fast 抛 IllegalStateException）：

```bash
export AEP_JWT_SECRET='dev-local-jwt-secret-≥32-chars-aaaaaaaa'   # 至少 32 字符
export AEP_SECRET_KEY='dev-local-aes-key-32bytes-bbbbbbbb'        # 任意 ≥1 字符，内部会 SHA-256 派生
export AEP_SEED_DEV_DATA_ENABLED=true                              # 想要本地有 admin/admin123 等演示数据
mvn spring-boot:run -Dspring-boot.run.profiles=mysql
```

为什么：mysql profile 被设计为「生产形态」，启动时拒绝 dev-default 密钥；上面三个 env
让本机也能用 mysql profile 联调。生产 server.env 用真正高熵密钥（见
`infra/env/server.env.example`）。

MySQL 默认连接配置（可在 `application-mysql.yml` 中修改）：

| 参数 | 默认值 |
|------|--------|
| host | localhost:3306 |
| database | aistareco |
| username | root |
| password | root |
| charset | utf8mb4 |
| timezone | Asia/Shanghai |

`ddl-auto: update` 会自动建表。

**v0.34+ 重要变化**：演示数据 seeder（`DataInitializer` 等）受 `aep.seed.dev-data.enabled` 控制：
- `application.yml` 默认 `true`（H2 dev / 联调环境会自动种 admin/admin123 + 演示明星 + license keys）
- `application-mysql.yml` 默认 **`false`**（**生产空库不会**自动种）

生产首次部署后建第一个 SUPER_ADMIN：

```sql
INSERT INTO admin_users (id, username, password_hash, role, status, created_at)
VALUES (
  UUID(),
  'your-admin',
  '<bcrypt-hash-of-your-password>',   -- 用 BCryptPasswordEncoder 离线生成
  'super_admin',
  'active',
  NOW()
);
```

或临时启用 seeder 跑一次（不推荐，因为会一并种全部演示数据）：

```bash
AEP_SEED_DEV_DATA_ENABLED=true java -jar ...   # 启动一次
# 然后 admin/admin123 登录 → 立即改密码 + 新建生产管理员 → 删 admin/operator 演示账号
```

## Profile 配置说明

| 文件 | 用途 |
|------|------|
| `application.yml` | 公共配置（端口、JPA、Jackson、JWT、日志） |
| `application-dev.yml` | H2 内存数据库，本地开发默认激活 |
| `application-mysql.yml` | MySQL 数据源，联调/生产使用 |

切换方式：

```bash
# 方式一：spring-boot-maven-plugin 专属参数（注意 dash `-` 不是 dot `.`）
# 旧写法 -Dspring.profiles.active=mysql 在 Spring Boot 3.x 不生效（plugin fork
# 子进程不继承 JVM system property），会回退到 application.yml 的默认 dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=mysql

# 方式二：环境变量（推荐，2.x / 3.x 都通）
SPRING_PROFILES_ACTIVE=mysql mvn spring-boot:run

# 方式三：修改 application.yml 中的 spring.profiles.active
```

## 认证体系

### 管理员登录

管理后台（`apps/admin`）通过用户名密码登录，仅允许以下角色访问：

| 角色 | 说明 |
|------|------|
| `SUPER_ADMIN` | 超级管理员，拥有所有数据操作权限 |
| `OPERATOR` | 平台运营，拥有所有数据操作权限 |

> `AdminUser.AdminRole` enum 是 `{SUPER_ADMIN, OPERATOR, FINANCE_ADMIN}`。曾计划再拆一个 `PLATFORM_OPERATOR`（**v0.31 已反向决策不拆**：改在 `aep_users` 加 `operatorRole` 复用现有命名；`FINANCE_ADMIN` 后来单独落地了，`PLATFORM_OPERATOR` 不再计划）。

开发环境默认账户（由 `DataInitializer` seed）：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | SUPER_ADMIN |
| `operator` | `operator123` | OPERATOR |

登录流程：`POST /api/admin/auth/login` -> 返回 JWT Token -> 前端存储并在后续请求中通过 `Authorization: Bearer <token>` 传递。

### 用户注册（秘钥激活）

普通用户通过秘钥（License Key）激活注册，不需要密码：

```
POST /api/auth/activate
Content-Type: application/json

{
  "code": "原始秘钥明文",
  "username": "用户名",
  "email": "可选",
  "phone": "可选"
}
```

激活流程：秘钥 SHA-256 匹配 -> 校验状态 -> 创建用户 + 租户 + 钱包 + 权益 -> 激活秘钥 -> 返回 JWT Token。

**v0.53 批次平台范围**：`LicenseBatch.platforms`（CSV，null/空 = 全站可用）声明该批次秘钥可激活的
子产品（music / drama / celebrity / aiavatar）。非空时激活按批次授权 `aep_users.platforms`
（优先级高于 `aep.platform.dev-grant-all`），积分发放额度仍走批次 `initialCreditGrant`
（单一钱包，不按 app 分桶）。

**v0.53 追加激活**：已登录账号 `POST /api/me/license/activate { code }` —— 合并开通批次绑定的
子应用 + 追加发放该批次积分（LedgerEntry LICENSE_GRANT），老账号开通新子应用不必换号。

秘钥来源：
- **后台导入**：管理员通过 `POST /api/admin/license-batches` 创建批次（可带 `platforms` 数组），自动生成秘钥
- **外部 CRM 对接**：预留 `channelPartnerId` 字段，后续实现同步

## API 端点

以 `/api/admin/**` 为前缀的接口对齐 `apps/admin` 运营后台；`/api/**`（不含 `admin/`）给终端用户使用（`apps/web`）。列表响应走 `PageEnvelope`，单体响应走 `ApiResponse`，见 product_spec.md §6.4。

### 公开端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/auth/login` | 管理员登录（用户名/密码 → JWT） |
| POST | `/api/auth/activate` | 用户侧秘钥激活注册 |

### 管理后台（需 Bearer Token，SUPER_ADMIN / OPERATOR）

#### 平台账户 / 权益

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/auth/me` | 当前登录管理员信息 |
| GET | `/api/admin/stats` | 仪表盘统计（用户/作品/收益聚合） |
| GET · POST · PUT · PATCH · DELETE | `/api/admin/users/**` | `AepUser` CRUD；`GET /{id}/wallet`；`POST /{id}/credits/adjust` 调账 |
| GET · POST · PUT · PATCH | `/api/admin/tenants/**` | `Tenant` 列表 / 创建 / 更新 |
| GET | `/api/admin/memberships` | `Membership` 列表，支持 `?tenantId` / `?userId` 过滤 |
| GET · POST · PUT · PATCH | `/api/admin/studios/**` | `Studio` CRUD；`GET` 返回 `AdminStudioDto`（含聚合指标） |
| GET | `/api/admin/license-batches` | 秘钥批次列表（v0.53 起含 `platforms` 适用范围） |
| POST | `/api/admin/license-batches` | 新建批次（v0.53 可带 `platforms` 指定可激活子应用） |
| GET | `/api/admin/license-batches/{id}/keys` | 批次下的秘钥 |
| GET | `/api/admin/license-keys` | 秘钥全局列表（支持 `batchId` / `status`） |
| PUT | `/api/admin/license-keys/{id}/revoke` | 吊销秘钥 |

#### 财务 / 钱包

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/wallets` | 钱包列表（`WalletDto`） |
| GET | `/api/admin/wallets/{userId}` | 按用户查钱包 |
| GET | `/api/admin/ledger-entries` | 点数流水，支持 `walletId` / `userId` 过滤 |
| GET | `/api/admin/finance/transactions` | 业务交易（由 `LedgerEntry` 派生，见 product_spec §9.7） |
| GET | `/api/admin/finance/revenue/monthly` | 近 6 月入账趋势 |
| GET | `/api/admin/finance/revenue/sources` | 入账来源饼图 |

#### 内容 / IP / 分发

| 方法 | 路径 | 说明 |
|------|------|------|
| GET · POST · PUT · PATCH · DELETE | `/api/admin/digital-ips/**` | AI 艺人档案 |
| GET · POST | `/api/admin/music/songs`<br>`POST /songs/{id}/approve`<br>`POST /songs/{id}/reject` | 歌曲管理 + 人工复核 |
| GET | `/api/admin/music/albums` · `/concerts` · `/genres` | 专辑 / 演唱会 / 曲风 |
| GET · POST · PUT | `/api/admin/film/**` | 短剧 / 电影 / 广告 / 配音 |
| GET · POST · PUT | `/api/admin/distribution/**` | 渠道接入与发行队列 |
| GET | `/api/admin/social-accounts` | sau 绑定的社交账号审计（含昵称 / 平台账号号 / 头像；不含 storage_state） |
| GET · POST · DELETE | `/api/admin/store/**` | NFT / 点数包 / 商品 |
| GET · POST · PUT | `/api/admin/community/**` | 动态 / 活动审核 |
| GET · POST | `/api/admin/fan/**` | 粉丝域（档案/等级/活动） |
| GET · POST | `/api/admin/coach/**` | 教练与培训 |
| GET · POST | `/api/admin/appearance-forge/**` | 形象工坊模板 / 蓝图 |

#### 平台配置 / 审计 / 消息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET · POST · PUT | `/api/admin/settings/**` | 平台设置 |
| GET · POST · PUT | `/api/admin/platform-configs/**` | 键值配置项 |
| GET · POST · PUT · DELETE | `/api/admin/ai-models/**` | 大模型 provider 配置（含 `/presets` 预设、`/discover-models` 与 `/{id}/fetch-models` 模型发现、`/{id}/test` 连通测试） |
| GET · POST · PUT · DELETE | `/api/admin/agent-bots/**` | Agent 平台 bot 配置（Coze 等；含 `/scenes` 场景目录；按 sceneKey 绑定业务功能如形象锻造） |
| GET | `/api/admin/audit-logs` | 审计日志 |
| GET | `/api/admin/notifications` | 运营推送 |
| GET · POST · DELETE | `/api/admin/staff/**` | 后台运营账号（P2） |

> 响应约定：分页接口返回 `{ success, data, pagination }`（`PageEnvelope`）；其余返回 `{ success, data }`（`ApiResponse`）。前端 `apiFetch` 只解 `data`。

## 项目结构

```
src/main/java/com/aistareco/aep/
├── AiStarEcoApplication.java              # 入口
├── config/
│   ├── AepSecurityConfig.java             # Spring Security 配置
│   ├── JwtUtil.java                       # JWT 生成/验证
│   ├── JwtAuthenticationFilter.java       # JWT 过滤器
│   └── DataInitializer.java               # 种子数据
├── controller/                            # REST 控制器
│   ├── AdminAuthController.java           # 管理员认证
│   ├── AdminStatsController.java          # 仪表盘统计
│   ├── AdminUserController.java           # 平台账号
│   ├── AdminTenantController.java         # 机构
│   ├── AdminMembershipController.java     # 用户-机构归属（只读列表）
│   ├── AdminStudioController.java         # 业务主体（含聚合指标）
│   ├── AdminLicenseController.java        # 秘钥批次 / 单码
│   ├── AdminCreditController.java         # 钱包 / 点数流水
│   ├── AdminFinanceController.java        # 业务交易 / 入账趋势 / 来源饼图
│   ├── AdminDigitalIpController.java      # AI 艺人档案
│   ├── AdminMusicController.java          # 歌曲 / 专辑 / 演唱会
│   ├── AdminFilmController.java           # 短剧 / 电影 / 广告 / 配音
│   ├── AdminDistributionController.java   # 分发渠道 / 队列
│   ├── AdminStoreController.java          # NFT / 商品
│   ├── AdminCommunityController.java      # 动态 / 活动审核
│   ├── AdminFanController.java            # 粉丝域
│   ├── AdminCoachController.java          # 教练
│   ├── AdminForgeController.java          # 形象工坊
│   ├── AdminSettingsController.java       # 平台设置
│   ├── AdminPlatformConfigController.java # 配置键值
│   ├── AdminAuditController.java          # 审计日志
│   ├── AdminNotificationController.java   # 运营推送
│   ├── AdminStaffController.java          # 运营账号
│   └── LicenseActivationController.java   # 秘钥激活（公开）
├── model/         # JPA 实体（AepUser / Tenant / Membership / Studio / LicenseBatch / LicenseKey / Wallet / LedgerEntry / DigitalIp / Song / ...）
├── repository/    # Spring Data JPA 仓库
├── service/       # 业务逻辑层（StudioService / TenantService / LicenseService / CreditService / AdminFinanceService / ...）
└── dto/           # 传输对象（含 PageEnvelope / ApiResponse）
```

## 数据模型

### 角色体系

| 角色 | 类型 | 说明 |
|------|------|------|
| `SUPER_ADMIN` | 系统管理员 | 所有数据操作权限，管理后台登录 |
| `OPERATOR` | 系统管理员 | 平台运营，管理后台登录 |
| `PRODUCER` | 普通用户 | 制作人，通过秘钥注册 |
| `COACH` | 普通用户 | 掌门人，通过秘钥注册 |
| `FAN` | 普通用户 | 粉丝，通过秘钥注册 |

### 明星商务工作台域（star_*，v0.60）

> 服务 apps/web-star（`/api/star/**`，authenticated）。账号经 `star_accounts` 绑定
> celebrity 域 `celebrity_stars`（一账号一明星）；带货授权直接复用
> `celebrity_star_authorizations`（web-celebrity 申请 → 明星端审批，同表同状态机）。

| 实体 | 表 | 说明 |
|------|----|------|
| `StarAccount` | `star_accounts` | AepUser ↔ CelebrityStar 绑定（unique user_id；agentView 经纪人视角） |
| `StarIpAsset` | `star_ip_assets` | IP 资产 4 类（portrait/clip/digitalHuman/documents）× 6 状态机 notStarted→preparing→uploaded→techReceived→volcanoSync→active |
| `StarWhitelistRequest` | `star_whitelist_requests` | 账号报白 5 步 received→contacting→sms→processing→authorized；fans/avgViews 原始整数 |
| `StarDigitalHumanRequest` | `star_digital_human_requests` | 数字人授权（live/shortVideo/ads） |
| `StarAiLikenessRequest` | `star_ai_likeness_requests` | AI 形象授权（voice/face/fullBody × low/medium/high） |
| `StarContentReview` | `star_content_reviews` | 内容审核四态（revision 带 revisionNote 回流） |
| `StarProductOnboard` | `star_product_onboards` | 商品入库 6 步 + 双路寄样；productId/submittedByUserId 关联公共商品池与报备人；step=5 即商品库（libraryAt/salesCount） |
| `StarBrandAuthRequest` | `star_brand_auth_requests` | 品牌授权 pending→platformReview→celebReview→sampleStage→approved + 双向寄样 |
| `StarContentRule` | `star_content_rules` | 绿/黄/橙/红四区规则启停 |
| `StarInfringementCase` | `star_infringement_cases` | 侵权巡查 pending→investigating→confirmed→resolved |
| `StarContract` | `star_contracts` | 合同（authorization/amendment/settlement）|
| `StarRevenueMonth` | `star_revenue_months` | 月度分成（列名 `rev_month` 避 H2 保留字 MONTH；金额存分） |

打通端点（`/api/me/celebrity/**`）：`POST stars/{id}/authorization/apply`（创作者申请授权）、
`POST products/{id}/star-filings` + `GET star-filings`（商品报备与回查）。
种子（dev）：`star_shenteng / star123` 绑 `star-shen-teng`，全模块演示数据
（`StarWorkbenchDataInitializer` @Order(3)）。

### 数字资产平台域（dap_*，v0.51 起；v0.104 扩为六类资产）

> 服务 apps/web-aiavatar（/api/v1/**）。账户复用 aep_users + 钱包；多模态大模型（文本/图片/视频）经 `DapMultimodalClient` 统一从后台「AI 应用绑定」端点解析（purpose=DAP_PERSONA/DAP_IMAGE/DAP_VIDEO，无 env 兜底）。
>
> **v0.105**：真人授权链路接七牛云 modelink —— `captures/{id}/verify` 不再「有素材即通过」，必须先有 **active 的刷脸认证会话**（`POST /v1/real-auth/sessions` → 上游 h5 刷脸 → 浏览器回跳 `GET /v1/real-auth/callback`（permitAll，靠不可枚举 state 防伪）→ 服务端回传 result_code + byted_token → 轮询上游确认 active），否则 409 `DAP_AUTH_NOT_COMPLETED`。核验通过登记的 LIC 标 `verifyMethod=liveness` + `livenessGroupId`。素材送审（`/v1/materials`）把捕获素材与定妆图推给 modelink 审核，结论由 `DapModelinkPoller` 收敛。接入点走后台「AI 应用绑定」的新用途 `DAP_REAL_AVATAR`；未配置且 `aep.dap.modelink.allow-mock=false`（生产默认）→ 503 `DAP_MODELINK_NOT_CONFIGURED`，不建会话不产假授权（§8.0）。同版把合成路径的授权硬闸前移到**生成入口**：真人复刻缺生效 LIC → 403 `DAP_LICENSE_REQUIRED`，不建任务不冻结积分。
>
> **v0.104**：数字人不再是唯一的资产种类，而是六类之一 —— `DH-` 人物 / `IP-` 品牌 / `SC-` 场景 / `PD-` 产品 / `VO-` 声音 / `ST-` 风格。授权登记只发给真人肖像人物与 IP；场景 / 产品 / 风格是轻资产只记来源。IP 是容器（成员靠各实体的 `ipId` 指向），合成产物回流为它的衍生物并双向记引用。

| 表 | 说明 |
|------|------|
| `dap_avatar` | 数字人本体（8 态状态机 draft→…→archived；def/deriv/counts JSON；imageKey/variantKeys/shotKeys 存 storage key；v0.104 加 `ipId` 归属列） |
| `dap_avatar_version` | 版本时间线（init/iterate/refine/template/finalize/archive 事件 + 当时主图） |
| `dap_look` | 造型（design 描述 / scene 场景替换，异步生成） |
| `dap_derivative` | 衍生产物（atlas/expr/scene/ward/d3/video 单条文件 + bytes 存储统计） |
| `dap_license` | 电子授权（真人肖像捕获核验自动登记 / IP 容器手动登记；HTML 凭证 certKey；v0.104 加 `ipId`，与 `avatarId` 二选一） |
| `dap_job` | 异步作业（wire 三态 running/done/failed；cost + hold referenceId=jobId:rN；v0.104 加 `assetId` 承载 SC-/PD-/CP- 类作业） |
| `dap_voice` | 我的声线（克隆采样加密存档，试听=采样回放） |
| `dap_capture` | 真人捕获会话（footage + ffmpeg 抽帧 frameKey） |
| `dap_photo` | 形象照片素材（上传照片复刻输入） |
| `dap_asset_ip` | **v0.104** IP 容器（IP-xxxx；六类里唯一的容器，下挂人物/场景/产品/声音；`licenseId` 指向 LIC 凭证） |
| `dap_scene` | **v0.104** 场景资产（SC-xxxx；`source=shot\|ai` 只记来源不进授权；`variantsJson` 光线变体**只存 cdnKey**，§4.7.7） |
| `dap_product` | **v0.104** 产品资产（PD-xxxx；`anglesJson` 多角度**只存 cdnKey**；`brandAuthorized`/`brandLicenseUntil` 是备注不是凭证） |
| `dap_style` | **v0.104** 风格模板（ST-xxxx；`promptEn` 叠加进出图 prompt；`useCount` 被合成引用次数） |
| `dap_composition` | **v0.104** 跨资产合成单（CP-xxxx；人物 × 场景 × 产品 → 成片；`licenseNote` 出片前授权核对结论快照） |
| `dap_composition_output` | **v0.104** 合成产物单张（入库即该 IP 的衍生物） |
| `dap_asset_usage` | **v0.104** 引用台账（驱动详情页「APPLIED TO · 已用于」；同一对 资产→用处 重复引用累加 `times` 不新增行） |
| `dap_material_group` | **v0.105** 素材分组（MG-xxxx；七牛 modelink asset-group 本地镜像。`kind=liveness_face` 即真人授权刷脸会话，状态 preparing→awaiting_auth→validating→active/failed；`callbackToken` 唯一，是无 JWT 回跳端点的防伪 state；`validateCalledAt` 是一次性凭证 byted_token 的幂等闸；**v0.105-补丁** `kind=aigc` 启用为「数字人专属 aigc 分组」的账号级共享单例行（owner=`__platform__`，`callbackToken` 改承载去重键 `aigc:<model>`）；`recycledAt` = 上游分组已删、配额已还的时间〔本地行保留作审计；账号级只有 3 分组配额，failed 组超期回收、active 组永不删〕） |
| `dap_material` | **v0.105** 送审素材（MAT-xxxx；modelink asset 本地镜像。`sourceKey` 是 §4.7.4 真值，送审时才派生签名 URL；状态 pending→reviewing→approved/failed；`refType=capture` 挂 liveness 分组、`refType=avatar` 走平台 aigc 默认组） |

### AI IP 工作台域（ip_*，v0.151；迁移 V27）

> 领域 `com.aistareco.aep.ipstudio.*`，挂 `/api/v1/ip-studio/**`，**共用 aiavatar 开通**
> （已被 `ProductRouteTable` 的 `any("/api/v1/**", AIAVATAR)` 兜底，不新增产品码）。
> 生成链路全部复用 dap 域（`DapMultimodalClient` / `DapImageInput` / `FileStorageService` /
> `PromptService` / `CreditService` hold→commit / `DapPricingService`），不另起第二条图像生成链。
> 设计真源 [`docs/ip-studio-plan.md`](../../docs/ip-studio-plan.md)，业务约束见
> [`specs/BUSINESS_RULES.md`](../../specs/BUSINESS_RULES.md) §6.6。

| 表 | 说明 |
|---|---|
| `ip_project` | 画布项目（IPP- + 8 hex）。`doc_json` = `IpProjectDoc`（nodes/edges/viewport）**整存整取**：客户端拥有、服务端逐字保存、绝不改写 —— 运行与发布结果一律另存，否则前端 1.2s 防抖 PUT 与异步 worker 互相覆盖（v0.101 同一条教训）。`cover_key` 是主形象选中图的 storage key（§4.7.4，coverUrl 出 wire 派生）；`published_avatar_id` 指向发布产出的 `dap_avatar`；软删 `deleted_at` |
| `ip_run` | 一次节点运行（IPR- + 8 hex，`kind=identity\|generate\|studio-*`，wire 三态 `running\|done\|failed`）。`input_json` 是本次实际提示词 + 参考图生效回报（`_exec` 段是含 storage key 的服务端执行参数，出 wire 时剥掉）；`output_json` 的 `candidates[{key}]` **只存 key 不存签名 URL**（签名有 TTL，落库就是埋雷）。hold `referenceType=ip-run` / `referenceId=runId`，`cost` 恒为真实账本值。同节点重跑新开一行、旧行保留（用户可能仍在用旧运行里选中的候选图）；`cancel_requested` 由用户置、终态由 worker 落；`heartbeat_at` 供 `IpRunReaper` 扫僵死 |
| `ip_skill` | Studio 技能（S3，V63；主键列 `skill_key`，避开 MySQL 保留字 KEY）。只存技能级状态：`status`（active \| draft \| withdrawn，运行时真值，覆盖版本 YAML 头里的 status）、`current_version`（生效版本）、`name / summary`（当前版本的冗余展示）、`updated_by`（`seed` = 只被仓库种子写过，才允许文件变更时重新种子）、`seed_file` |
| `ip_skill_version` | 技能的不可变版本（S3，V63，`UNIQUE(skill_key, version)`）。`frontmatter_json`（YAML 头的 JSON）+ `body_md` 写入后不再修改；`content_digest` 为快照摘要（种子 = 文件摘要，与 S1/S2 的快照一致）；`source` seed \| admin \| rollback \| distilled；`status` published \| draft（只有草稿的 status 会在发布时变）；草稿另带 `base_version / source_project_id / source_execution_id / source_run_id` |
| `card_profile` | AI 数字名片（CARD- + 8 hex，v0.153）。名片是「个人 / 企业 IP 的对外发布面」，**不产生任何新资产**：形象一律以 `dapDisplayRef`（`look:<id>` / `deriv:<id>` / `null`=跟随定妆照）引用 dap 形象，资产改了名片自动跟着变、永不拷贝图片。`payload_json` 整存整取，**只存 cdnKey 与 dapDisplayRef，绝不存签名 URL**（签名有 TTL，落库一小时后全是裂图，§4.7.7）；出 wire 时由 `DapAvatarRefResolver` 把 `figure.ref` 与 `figure.looks[].ref`（衣柜：可切换的装扮与表情）解析成签名图 —— **不做这一步真名片就是没有形象的**，解析不出的那件从衣柜里摘掉；再由 `CdnUrlSigner` 把 `xxxKey` 派生成 `xxxUrl`，**落库前再由 `stripDerivedUrls` 剥掉这些派生字段** —— 编辑器 GET 到的文档带着现签的 URL，原样 PUT 回来就把签名写进库了（没有 key 兄弟的 URL 是用户自己填的外链，保留）。`slug` 全局唯一进 URL（`/card/p/<slug>`，`demo` 等为保留短链），与展示用的 `reg_no` 分离：换短链不换登记号。`avatar_id` 供形象被删 / 授权撤销时反查受影响的名片。软删 `deleted_at`。**公开读**（`GET /api/v1/card/p/{slug}`）匿名可访问，需 `AepSecurityConfig` 对 GET permitAll + `ProductRouteTable.PUBLIC_GETS` 登记 + service 只吐已发布未软删三处同时成立；找不到 / 未发布 / 已软删一律 404 `CARD_NOT_FOUND` 同一个码，避免短链枚举 |

新增服务：`IpProjectService`（CRUD / 上传 / runs 投影 / doc 读写）、`IpRunService`（输入编译 → preflight → hold → 派发）、
`IpRunWorker`（@Async `ipRunExecutor`，逐张 commit 后才落产物）、`IpRunReaper`（@Scheduled 僵死运行判失败 + 释放冻结）、
`IpPublishService`（建 `DapAvatar` + `DapLook`，零积分、复用同一 storage key 不重复上传）、
`IpCatalogService`（`resources/ipstudio/templates/*.json` 两套工作流 + `styles.json` 六套风格）。
新增 prompt key `dap.ip_identity` / `dap.ip_look_image`，新增单价 `dap.ip-identity`（默认 2）/ `dap.ip-image`（默认 8，按张）。

### 核心表（账户与计费域）

> 已废弃：`aep_products` / `aep_plans` / `aep_features` / `aep_plan_features` / `aep_entitlements` —— 订阅 / 权益模型被「一次性点数发放 + License」替代，见 product_spec.md §0.1、§0.2。

| 表 | 说明 |
|------|------|
| `aep_users` | 用户（含 `password_hash` 供管理员使用） |
| `aep_tenants` | 机构（PLATFORM / PERSONAL / ORGANIZATION），承载 License 发放方统计 |
| `aep_memberships` | 用户 ↔ 机构 关系（含 `source` / `license_key_id`） |
| `aep_studios` | 业务主体（1:1 AepUser，kind: personal_creator / music_studio / drama_studio / variety_studio / agency / mcn） |
| `aep_license_batches` | 秘钥批次（含 `initial_credit_grant`） |
| `aep_license_keys` | 秘钥单码 |
| `aep_wallets` | 钱包（license / recharge / gift / pending 四科目，`total_balance` = 前三项之和）。并发写余额走悲观行锁 `findByUserIdForUpdate`（v2 §5） |
| `aep_ledger_entries` | 不可变点数流水，Admin Finance 图表由此派生。**v2 §1/§4.2** +`plane`(MONEY/CREDIT 两平面归类)+`cash_artifact_id`（资金面非空 / 积分面必 null）+ DB `CHECK(plane<>'CREDIT' OR cash_artifact_id IS NULL)`——把「调差/赠送不碰现金」升级为数据库不变量；entry_type 增 `REFUND_CASH`（资金面真实现金退款，与积分面 `REFUND` 严格区分）。plane 由 `@PrePersist` 派生、历史行由 `LedgerPlaneBackfill` 启动回填 |
| `credit_adjustment_request` | **v2 §4.5 / §9.2** 运营调差/赠送审批单（maker-checker）。`type`(COMPENSATE/GRANT)/`target_user_id`/`amount`/`reason`/`incident_ref`\|`campaign_id`/`status`(PENDING_APPROVAL/APPROVED/REJECTED)/`maker_id`/`checker_id`/`ledger_entry_id`。小额直发也落 APPROVED 审计单（全量审计 + per-actor 日限额计数）；有效 SUPER_ADMIN 可不受单笔复核阈值限制直接发放，日限额仍适用，并可批准本人历史待审单；其他角色大额仍须独立复核，FINANCE_ADMIN 不可自批。例外按当前 ACTIVE admin_users 记录判断，非客户端参数；所有直发与批准保留审计和 GIFT 账本，原审批单加悲观锁防并发重复入账 |
| `aep_audit_logs` | 审计日志 |

内容/IP 域相关表（`digital_ips` / `aep_songs` / `aep_albums` / `aep_concerts` / `aep_dramas` / `aep_movies` / `aep_advertisements` / `aep_voice_works` / `copyright_items` / `distribution_*` / `nft_items` / `community_*` / …）见 product_spec.md §4–§5。

### v0.5 新增表（明星带货线）

> 全部由 v0.5.0 ~ v0.5.3 落地。详细字段与契约见 `/product_spec_ai_celebrity.md`。

| 表 | 用途 |
|---|---|
| `celebrity_star_authorizations` | 用户 × 明星授权关系（4 态状态机；unique(user_id, star_id)） |
| `recharge_packages` | 充值套餐（admin CRUD；软删走 `active=false`；落账走 `LedgerEntry`）。**v2 §6** +`app_scope`（VARCHAR，`all`=通用 / `music`\|`drama`\|`celebrity`\|`aiavatar`\|`star`）—— 按子应用配套餐；`/me/wallet/packages?sourceApp=X` 过滤「通用 + 该子应用专属」，checkout 校验套餐归属（`PACKAGE_NOT_FOR_APP`） |
| `recharge_order` | v0.56：充值订单 / 账单（PENDING/PAID/REJECTED/CANCELLED/**CLOSED**）。用户下单生成 PENDING（不入账），运营 admin 线下收款后 approve → 经 `CreditService` 入账（PAID）/ reject；套餐字段下单时快照。**v2** +在线支付列（`pay_order_id` 唯一/`way_code`/`pay_state`/`paid_at`/`paid_via`/`channel_pay_no`/`source_app`）；幂等结算核心 `settlePaidOrder`（手工核准/在线回调/影子确认共用 + 条件 UPDATE `markPaid` 幂等闸）。**v2 §6 状态机硬化**：①防重复支付三道闸 = 幂等下单 `createOrReuseCheckoutOrder`（同用户同套餐复用 TTL 30min 内 PENDING 单）+ 网关 out_trade_no 复用 + `markPaid` 闸；②`CLOSED` 超时关单 `markClosed`（reconcile 每轮扫超 30min PENDING + 收银台 `syncOrder` 超时即关）；③逐单查单 `GET .../orders/{id}` + `POST .../sync`（收银台「我已支付」主动查网关→结算/关单，归属校验）。**v2 §15.5/D17** +`REFUNDED` 态 + `refunded_at`/`refund_ledger_entry_id`/`refunded_credits`：现金退款回收未消费积分（clamp 到 rechargeBalance，写资金面 REFUND_CASH，FINANCE_ADMIN） |
| `template_scripts` | 模板脚本（双模 text / video_ref；同 templateId 仅一条 PUBLISHED；JSON 列容纳 persona/scenes/variables/engineAdapters/durationVariants/postProcess/safety/referenceClip 等） |
| `ai_model_providers` | **AI 模型接入端点**（v0.41，实体 `AiModelEndpoint`）：固定 {上游密钥 + 单模型 + 地址}，含外部 API Token（`key_*`/`owner_user_id`/usage 列）；上游 apiKey 列存 AES-GCM 密文，Token 存 bcrypt，均永不明文返回。旧 `purposes`/`priority` 列弃用 |
| `ai_app_binding` | v0.41：AI 应用（`AiModelPurpose` 作主键）→ 端点（`endpoint_id`）绑定，一用途一端点、无兜底 |
| `ai_model_usage_record` | 大模型调用用量流水（v0.41；每次成功 chat 落一行，记端点/model/purpose + prompt/completion/total tokens；只追加，供 admin 用量统计聚合） |
| `llm_api_keys` | **历史弃用表（v0.41）**：外部 Token 已收敛到 `ai_model_providers.key_*`；当前代码不再映射、不再验证回退 |
| `agent_bot_providers` | Agent 平台 bot 配置（Coze 等；token 列存 AES-GCM 密文；sceneKey 唯一，绑定业务功能如形象锻造） |
| `user_bot_read_state` | per-user-per-bot lastReadAt（驱动消息首页未读 dot 与 chat 已读机制） |
| `drama_scripts` | **短剧脚本**（v0.43，drama 子产品）：`ownerUserId`/`title`/`genre`/`durationSec`/`status` + `payloadJson`（完整脚本含 `scenes[]`：heading/summary/shot(画面)/dialogue(台词)/duration_sec）+ 软删 `deletedAt`。短剧视频生成复用 `material_video_job`（kind=`drama-episode`） |
| `drama_shorts` | **短视频制作草稿**（v0.74，drama 子产品）：`ownerUserId`/`title`/`fmtKey`/`fmtName`/`coverFrom`/`coverTo`/`durationSec`/`shotCount`/`doneCount`/`status`(draft\|done)/`progress` + `payloadJson`（整页编辑态 ShortDraftData：`{step,meta,shots[],chat[],refs,idea,reopen,fmtKey}`）+ 软删 `deletedAt`。让 `/shorts/make` 做到一半刷新/返回/换设备可恢复；卡片列由 payload 回算 |
| `drama_character` | **短剧角色实体**（v0.101 一致性引擎 C-2，drama 子产品）：`projectId`/`ownerUserId`/`name`/`role`(key\|extra)/`cast`/`appearanceJson`/`dapAvatarId`/`voiceId` + `refImagesJson`（多角度参考图集 `[{cdnKey,angle,label}]`，真值 cdnKey，出 wire signer 派生 url）+ 时间戳 + 软删 `deletedAt`（随项目对齐）。渲染真值从 `drama_projects.payloadJson.characters` 下沉到本表；过渡期懒回填 + saveProject 双写（§6.1 只 upsert 不重写文档）。索引 `idx_dc_project` |
| `drama_scene` | **短剧场景资产实体**（v0.101 C-2，drama 子产品）：`projectId`/`ownerUserId`/`name`/`mood`/`styleTagsJson` + `refImagesJson`（同上）+ 时间戳 + 软删。跨集共享取景地；与 `drama_character` 同双写/回填机制。索引 `idx_ds_project` |
| `drama_canvas` | **画布**（v0.198，drama 子产品，和 `drama_projects` 互相独立）：`id`(`dcv_`)/`ownerUserId`/`title`/`ratio`(9:16\|16:9) + `docJson`（LONGTEXT，整份 `DramaCanvasDoc`：剧本 / 角色与造型 / 场景 / 素材 / 画布布局 / 逐集片段；**只存资产 key**，出 wire 只给本人的 key 派生签名 url） + `docVersion`（规范化文档 + 标题的 sha256 前 16 位，保存的乐观锁）+ 时间戳 + 软删 `deletedAt`。V36 迁移。索引 `idx_drama_canvas_owner` |
| `drama_canvas_run` | **画布运行记录**（v0.198）：`canvasId`/`ownerUserId`/`kind`(script\|extract\|image\|storyboard\|video\|assemble)/`target`（合回文档的位置，如 `look:<id>`、`video:<集>:<片段>`）/`status`(queued\|running\|succeeded\|failed\|canceled)/`cost`/`clientRequestId`/`jobId`（视频 = `material_video_job.id`）/`inputJson`（单价快照）/`resultJson`（只存 key）/`refsJson`（参考图实际送到模型的情况）/`errorCode`/`errorMessage` + `createdAt`/`updatedAt`/`finishedAt`。`UNIQUE(owner_user_id, client_request_id)`（实体 `@Table` 同名声明）；所有终态迁移走条件更新。V36 迁移 |
| `aep_users.platforms` | **平台访问授权列**（v0.43）：CSV（`music,drama,celebrity` 子集；空=全部可访问）。`/api/me` 透出 effective 列表，前端按本子产品判断放行 |
| `celebrity_stars` 扩字段 | bio / location / fans / cooperation_count / avg_gmv / photos_json / videos_json |
| `celebrity_templates` 扩字段 | preview_cover / preview_video_url / duration_sec |
| `aep_notifications` 扩字段 | bot_id（关联 5 个 AI Bot 同事；v0.5.2 拉模式后保留作扩展点）；**v0.58** +`audience_scope`/`audience_target_id`/`audience_target_name`（推送对象溯源，可空，老行回退 scope=all）。运营收件箱行用保留 `user_id='__admin__'`（`Notification.ADMIN_INBOX_USER_ID`），由 `NotificationPublisher` 写入（充值下单/取消、新用户激活），admin `/api/admin/notifications` 只读写该收件箱 |
| `aep_social_accounts` | sau 绑定账号，存 `display_name` / `platform_account_id` / `avatar_url` 清洁 profile；`storage_state_encrypted` 为 AES-GCM 密文且不出 DTO |
| `material_video_job` 扩字段 (v0.108) | `app`（VARCHAR(16)：`celebrity`\|`drama`\|`ipstudio`（v0.157）\|`video-studio`（v0.199），索引 `idx_mvj_user_app`）—— 本表被带货线与短剧线共用，列表 / 单查按本列分区，否则会跨子产品串号（带货素材库出现短剧分镜视频）。老行 `app=null` 时查询按 `kind like 'drama-%'` 兜底推断（`MaterialVideoJobRepository.APP_EXPR`），`MaterialVideoJobAppBackfill` 幂等回填仅为走索引 |
| `video_studio_prompt_optimization` (v0.199，V37) | 视频生成区的智能优化记录：`id`（= 交给厂商的 Idempotency-Key）、`owner_user_id`、`client_request_id`（`UNIQUE(owner_user_id, client_request_id)`）、`endpoint_id`、`status`（queued / running / succeeded / failed，只经条件更新迁移）、`spec_json`（已校验的请求快照）、`original_prompt`、`optimized_prompt`、`vendor_optimization_id`、`error_message`、`credits_held`（冻结额，refType `video_studio_prompt_optimization`、refId = id）、`created_at` / `updated_at` / `completed_at` |
| `video_studio_template` (v0.199，V37) | 视频生成区的模板：`owner_user_id`、`scope`（official / private）、`status`（active / withdrawn，软删）、`title`、`description`、`source_job_id`、`recipe_json`（模式、最终提示词、规格、种子、模型、素材 role / mediaType / key / label；不含任务状态 / 积分等运行痕迹）、`preview_video_key` / `preview_thumbnail_key`（存 key，出 wire 现签）、`use_count` |
| `mixcut_render_output` 扩字段 (v0.19) | `publish_count`（INT NOT NULL DEFAULT 0）/ `last_published_at`（OffsetDateTime nullable）—— `MixcutPublishService` 每次派单成功后按 target 数累加；视频库 UI 用此显示「已发 ×N」徽标，允许同一变体再次分发 |
| `mixcut_render_output` 扩字段 (v0.21) | `deleted_at`（OffsetDateTime nullable）—— 用户在「视频库」点删除后置非空；DTO 转换过滤 `deletedAt != null` 的 output；`MixcutOutputCleanupScheduler @Scheduled(cron="0 30 3 * * *")` 每日凌晨清理 30 天前软删行（本地 mp4 / CDN / DB 全删） |
| `mixcut_asset` 扩字段 (v0.21) | `is_official`（BOOLEAN NOT NULL DEFAULT false）/ `official_category`（直播切片 / 综艺 / 访谈…）/ `related_star_id`（关联 `celebrity_stars.id`，可空）—— 运营后台上传的「官方明星片段」，端点 `POST /api/admin/mixcut/official-clips`；用户端只读 `GET /api/mixcut/assets/official-clips` |
| `products` 扩字段 (v0.28) | `price_cents`（INT nullable）/ `commission_rate`（INT nullable, 0-100 整数百分比）—— 选品表格导入 + 抖音链接解析的价格 / 佣金信息 |
| `mixcut_asset` 扩字段 (v0.28) | `related_product_id`（VARCHAR(64), 关联 `products.id`，可空）/ `subkind`（VARCHAR(32), 区分 `"user-upload"` / `"product-photo"` / `"product-video"` / `"ai-marketing-video"`）—— 商品链接解析时把外网 CDN 图片直接登记为 MixcutAsset 行，create 页 `?product_id=X` 按此过滤「本商品素材」 |
| `mixcut_render_job` 扩字段 (v0.28) | `product_id`（VARCHAR(64), 关联 `products.id`，可空）—— 从商品库「生成视频」入口透传，分发抽屉用它反查 Product 自动 prefill 抖音商品挂载字段（productLink / productTitle） |
| `mixcut_draft`（v0.48 新表） | 混剪「实例 / 草稿」—— 模版与生成任务之间的中间层。字段与 `MixcutRenderJob` 快照列对齐（`slot_bindings_json` / `canvas_snapshot_json` / `slots_snapshot_json` / `scenes_snapshot_json` / `perturbation_overrides_json` / `sticker_pool_json` / `perturbation_profile` / `output_variants` / `product_id`）+ `name` / `template_version` / `status`（draft）/ `generated_job_count` / `last_generated_at`。`userId` 隔离。端点 `/api/mixcut/drafts`（CRUD + `/{id}/generate`）。保存填了一半的配置 → 可继续编辑 / 反复生成 |
| `mixcut_render_job` 扩字段 (v0.48) | `draft_id`（VARCHAR(64), 关联 `mixcut_draft.id`，可空）—— 从实例 / 草稿生成时填入；任务详情页据此显示「来自实例」徽章并深链回 create 页继续编辑该实例。`MixcutJobSchemaMigration` 兜底加列 |
| `mixcut_asset` 扩字段 (v0.49) | `cdn_key`（VARCHAR(512), 可空）—— 用户上传素材经统一 `FileStorageService` 推 OSS 得到的 object key。出 wire 时 `MixcutAssetDto` 用 `CdnUrlSigner.signKey` 签成 `cdn_url`（素材库展示走 CDN，省 ECS 带宽 + 防盗刷）；渲染仍读 `localPath`。`MixcutJobSchemaMigration` 兜底加列 |
| `aep_ledger_entries.entry_type` / `admin_users.role` enum 加宽 (v2 钱包) | MySQL（及 H2 `MODE=MySQL`）下 Hibernate 6 把 `@Enumerated(STRING)` 映射成原生 `enum(...)` 列；`ddl-auto=update` **不会**给既有 enum 列追加新值 → C2 加 `FINANCE_ADMIN`（不加宽则启动播种即崩）、C3/D17 加 `REFUND_CASH`（不加宽则首次现金退款写库崩）需手动 `ALTER ... MODIFY COLUMN`。`EnumColumnWideningMigration`（`@Order(0)`，**先于 `DataInitializer` 播种 FINANCE_ADMIN**）启动期幂等加宽：仅 MySQL/MariaDB 生效、读 `information_schema.COLUMNS` 已含全部枚举值则跳过、保留原 nullability、失败仅 log 不阻断启动。目标枚举集由 `EnumColumnWideningMigrationTest` 反射对齐实体 enum 守门（加值忘同步 → CI 红）。Flyway 接管后改版本化脚本 |

**v0.49 统一文件存储门面 `service/storage/FileStorageService`**：全系统「上传 / 生成 / 大模型返回」的图片/视频/音频/模型文件存储收口入口 —— `store(MultipartFile/byte[])` / `storeExisting(Path)` → `StoredFile{key,url,signedUrl,localPath,bytes,mime}`；`signedUrl(key)` / `delete(key)` / `openForRead(key)`。统一 key 约定 `<category>/<owner?>/<uuid>.<ext>`，底层委托 `service/cdn/*`（driver + 签名）。已收口：用户上传素材（`MixcutAssetService.upload`）+ celebrity 档案图（`AdminCelebrityUploadController`）从本地裸写改为推 OSS。已在 `CdnUploader` 层的 material video / aiavatar / mixcut 成片暂不强迁（cosmetic）。配置 `aep.storage.*`。

**v0.28 新增端点**：

```
POST /api/me/products/parse-link    仅解析（preview，不写库）
POST /api/me/products/from-link     解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)
GET  /api/mixcut/assets?related_product_id=X    按商品过滤素材（自动短路 listVisibleTo）
```

server 内部 `aep/service/productlink/ProductLinkHandler` 是策略链接口，Spring 按 `@Order` 注入有序列表：
- `DouyinQueryEmbeddedHandler` @Order(10) — query 内嵌 `goods_detail` JSON 时直接 URLDecode + parse
- `DouyinHtmlScrapeHandler` @Order(20) — host 白名单 `*.jinritemai.com|*.douyin.com`（防 SSRF），HttpClient GET（UA=desktop Chrome, timeout=8s），正则抓 og tags + `window.__INITIAL_STATE__`

新平台扩展只加 handler；不动 `ProductLinkController` / 前端。`ProductLinkPersistService` 串起 ProductService.createWithId + `MixcutAssetService.registerExternalUrl(userId, kind, subkind, externalUrl, productId)`，单事务，图片登记单条失败 log + 继续。

### v0.5 关键服务

- `PromptAssemblyService` —— 按需把 TemplateScript 装配为引擎请求体（变量替换 + 引擎 adapter + 风控）
- `NotificationService` —— Bot 消息按需查询合成（5 composer，零事件总线）
- `NotificationPublisher` (v0.58) —— 业务事件 → 站内消息唯一写入口：`notifyAdmins`（运营收件箱 `__admin__`，audience 指向触发账号）/ `notifyUser`（用户个人收件箱）。旁路写入：失败仅 WARN 不阻塞业务主链路。已接线：充值下单/取消（→admin）、核准/驳回（→用户）、激活码注册（→admin）
- `AiModelInvocationService` —— OpenAI / OPENAI_COMPATIBLE 的 chat 调用 + provider 测试连通
- `RechargeService` —— v0.56 充值订单流：`createOrder`（下单 PENDING，不入账）/ `listMyOrders` / `cancelOrder` / `listForAdmin` / `approveOrder`（运营核准 → recharge 主分录 + 可选 gift bonus 副分录入账）/ `rejectOrder`
- `CelebrityZoneService` —— 引擎价格 in-memory（`mutablePricing`）+ JOBS in-memory（重启失效；v0.6 落表）
- `MixcutPublishService` (v0.15 / v0.19 / v0.20) —— 混剪批量派单。v0.20 新加 `expandSchedule(spec, n) → Instant[]`：把顶层 `ScheduleSpec`（`immediate / single / daily_recurring`）算成 outputs.size 长的 `scheduledAt` 数组，daily_recurring 按 `outputs[i] → slots[i%K]` 在 `startDate + ⌊i/K⌋` 天起飞，过去 slot clamp 到 `now()`，可选 `jitter_minutes` 加 [-N, +N] 分钟随机偏移。`PublishJob` / `PublishJobScheduler` 零改动 —— 错峰 `scheduledAt` 直接走现有 10s tick。

### 通用工具

- `AepCryptoUtil`（`com.aistareco.common`）—— AES-GCM 加密/脱敏；密钥从 `AEP_SECRET_KEY` 读

## 统一账号中心接入（v0.149，`aep.identity.*`）

真源：[`docs/unified-identity-plan.md`](../../docs/unified-identity-plan.md) §12.1 / §12.3 / §12.4。
本节只讲 server 侧这一半：**接受账号中心签发的令牌**、**把 uid 映射成本地档案**、**和账号中心对账**。

统一接入 SOP 真源：[`aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md`](../../../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md)
§7.9 / §10.6（资料消费、后台搜索、存量补齐和真实验收，2026-10-10）。

> **账号中心本身不在本仓**：代码与部署都在独立仓库
> [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)。本地联调时先 clone 到本仓同级目录
> （`../aibuzz-id`）并 `./mvnw spring-boot:run` 起在 **8090**，再把本仓的 `AEP_ID_ISSUER`
> 指过去；生产部署（8091 / 独立库 `aistareco_id` / 本机 Redis）见该仓 `deploy/README.md`。

### 1. 双验（HS256 老令牌 + RS256 新令牌并存）

`JwtAuthenticationFilter` 是唯一鉴权入口，按 JOSE 头选链路：

| 令牌 | 验签 | `sub` 的含义 |
|---|---|---|
| HS256（本仓 `/api/auth/**`、`/api/admin/auth/**` 自签） | `AEP_JWT_SECRET` | 本地 `aep_users.id` / `admin_users.id` |
| RS256（账号中心签发） | 账号中心 JWKS 公钥 | 账号中心 uid |

RS256 分支的进入条件：JOSE 头 `alg=RS256`，或 HS256 验不过但（未验签读到的）`iss` 等于
`aep.identity.issuer`。校验 `iss` / `exp` / `aud` 含 `aep.identity.audience`（默认 `aistar-api`），
并要求 `amr` 非空 —— 没有 `amr` 的是机器令牌（client_credentials），不建立用户上下文，
因此在 `/api/me/**` 上必然落 401。

`aep.identity.issuer` 留空 = **整体关闭**：RS256 令牌一律 401，HS256 链路不受任何影响。
§8.0：不存在「未配置就本地伪造 uid」的降级路径。

### 2. JIT 建档（登录即有档案，但**不等于开通**）

`IdentityProvisioningService`：`sub`(uid) → `aep_users.identity_uid` 命中就用；没命中就现场建一行
（`kind=PERSONAL`、`status=ACTIVE`、`username=id_<uid 前 12 位>`、`platforms` 留空）。
先插后读：唯一键冲突时按 `identity_uid` 回读赢家，并发首登只会有一行。
建档成功后异步 best-effort 回报账号中心 `PUT /api/products/aistar/links/{uid}` `{localSubjectId, PROVISIONED}`，
失败只 WARN —— 账号中心抖动不许把用户挡在登录外。

**建档 ≠ 开通**：能不能用某个子产品由 enrollment 决定（§12.2）。本地账号 `SUSPENDED` / `DELETED` 时，
即便令牌合法也直接 401 `ACCOUNT_DISABLED`。

### 2.1 手机号展示副本与后台搜索（2026-10-10）

`IdentityPhoneSyncService` 只对已验签且实际授权含 `phone` 的用户令牌，调用固定 issuer 的
`GET /userinfo`，要求响应 `sub` 与令牌 UID 一致；`syncUserInfo` 行锁后复查本地 UID/ACTIVE 与读取代次，按实际 scope 更新完整号码和昵称/头像。未含 phone 的 profile-only 响应不改号码，未带可选头像保留、明确 null/空值清除。JWT 昵称/头像为签发快照，不再每次覆盖当前资料。
主体映射、开通、权限和钱包继续使用原有 UID/本地 ID，资料同步不创建第二份账号或钱包。

读取成功最多缓存 5 分钟且不超过 token 有效期；新令牌自动重新读取；失败 15 秒后可重试，
连接超时 2 秒、请求超时 3 秒，不跟随重定向。进程只缓存 token 的 SHA-256 摘要和时间，
不缓存明文 token；失败日志只报安全原因码，不打印响应体或完整号码。未授权不覆盖旧号；
获 phone 授权且成功响应无号码则清除旧号；读取失败保留已有副本，不阻断原有验签登录。

`GET /api/admin/users?q=` 在数据库分页前搜索手机号、昵称、用户名、邮箱、本地 ID 和身份 UID，
兼容原有 status/kind；size 仍最多 100，返回 PageEnvelope 的真实总数。%/_ 按字面量匹配。
后台 `/platform/accounts` 使用该服务端搜索和分页；存量账号在下一次合法用户请求时补齐，
立即补资料的运维动作必须按 UID 核对并记录旧值，不能改变开通或账本。

### 3. 后台令牌与消费者令牌分离（`typ=admin`）

- `POST /api/admin/auth/login`、`POST /api/admin/auth/operator-login` → `JwtUtil.adminToken(...)`，
  带 `typ=admin`。**只有**这种令牌会被映射成 `ROLE_SUPER_ADMIN` / `ROLE_OPERATOR` / `ROLE_FINANCE_ADMIN`。
- 激活 / 短信 / 密码 / dev-login → `JwtUtil.consumerToken(user)`，`role` 只放账号类型
  （`PERSONAL` / `STUDIO`），**不再**放 `operatorRole`。持有 `operatorRole` 的账号要进后台，
  只能走 `operator-login` 另换一张 `typ=admin` 令牌。
- RS256 令牌**永不**映射后台角色（账号中心只管「你是谁」）。

> **过渡兼容（限期）**：v0.149 之前签发的后台令牌没有 `typ`（TTL 7 天）。这类令牌只要 `role`
> 落在后台角色名里仍然放行，但每次都打 WARN（`放行无 typ=admin 的历史后台令牌`）。
> 上线 7 天后老令牌全部过期，应删掉 `JwtAuthenticationFilter.LEGACY_ADMIN_ROLES` 及其两处分支。

### 4. 事件消费（outbox）

`IdentityOutboxPoller`（默认 30s 一轮，游标存 `aep_platform_configs` 的 `identity.outbox.cursor`）拉
`GET /api/products/aistar/outbox?after=&limit=`：

| 事件 | 本地动作 |
|---|---|
| `USER_MERGED{fromUid,toUid}` | `toUid` 本地没档案 → 被并方档案改指 `toUid` 并清旧号，flush 后为旧 UID 留 DELETED 墓碑；已有档案 → 被并方保留旧 UID、清号码、SUSPENDED + WARN，业务数据不自动合并；被并方未建档也留墓碑 |
| `USER_CLOSED{uid}` | 本地档案 `DELETED`，`identity_uid` 保留作墓碑；首次登录前注销也建无权益墓碑，旧 token 不能重新 JIT |
| `PHONE_CHANGED` | 清除完整号码展示副本，使缓存及在途读取失效；脱敏号不回填，下次合法用户请求补齐 |
| `PROFILE_CHANGED` | 更新当前昵称/头像；明确 null/空头像清旧图，使缓存及在途读取失效 |

每条事件一个事务；游标只推进到本批最后一条**处理成功**的事件，中途失败就地停住下轮重放
（处理幂等）。注销/合并须本地事务提交后向中心 PUT outbox receipt（COMPLETED），回执成功才前进；回执失败不按坏事件死信跳过。事件 ID 必须正整数且严格递增，nextAfter 与末条 ID 一致，产品归属匹配或广播 null。机器 HTTP 连接 2 秒/读取 5 秒、禁止重定向。`issuer` 或 `client-secret` 留空 → 轮询直接跳过。

### 5. 老用户导入（运维一次性）

```
POST /api/admin/identity/import        （SUPER_ADMIN）
body  {"batchSize": 200, "dryRun": false}      两字段都可选
200   {"success":true,"data":{"scanned":N,"linked":N,"created":N,"skipped":N,"errors":N}}
503   IDENTITY_NOT_CONFIGURED
```

把「有手机号且 `identity_uid` 为空」的账号按批送到账号中心 `POST /api/products/aistar/import-users`，
用返回的 uid 回写 `identity_uid`。幂等可重跑（回写过的行不再进候选集）；分批用 **id 游标**而不是
offset（处理中候选集在缩小，offset 会漏行）。`dryRun=true` 只统计候选条数，**不调账号中心**
（那个端点会真的建 uid）、不写库。无手机号的老账号无法映射，继续走 legacy 登录。

### 6. 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AEP_ID_ISSUER` | dev `http://localhost:8090` | 账号中心 issuer。**留空 = 关闭整个能力** |
| `AEP_ID_JWKS_URI` | 空 | 显式覆盖 JWKS 地址；留空则惰性经 `<issuer>/.well-known/openid-configuration` 发现 |
| `AEP_ID_AUDIENCE` | `aistar-api` | 令牌 `aud` 必须包含它 |
| `AEP_ID_CLIENT_ID` | `aistar-server` | 机器互调 client id |
| `AEP_ID_CLIENT_SECRET` | 空 | 机器互调机密。**留空 = 不回报、不拉 outbox、不能导入** |
| `AEP_ID_OUTBOX_POLL_SECONDS` | `30` | outbox 轮询间隔 |

## 子产品开通（enrollment）（v0.149，`aep.enrollment.*`）

真源：[`docs/unified-identity-plan.md`](../../docs/unified-identity-plan.md) §12.2；
规则速查另见 [`specs/BUSINESS_RULES.md`](../../specs/BUSINESS_RULES.md) §6.0。

**一句话**：登录只保证「有档案」，能不能进某个子产品由 `product_enrollment` 说了算，
后端真拦 —— 此前只有前端按 `/api/me` 的 `platforms` 判断，换个子域名直接调 API 就能绕过。

### 1. 两张表

| 表 | 作用 |
|---|---|
| `product_enrollment` | 当前开通状态。`UNIQUE(user_id, product)`，一个账号 × 一个子产品一行，写入一律 upsert |
| `entitlement_grant` | 不可变授权凭据（这次开通凭什么来的）。`UNIQUE(source, source_reference, product)` = 「一把激活码对一个子产品只能兑一次」的硬约束；一把全站秘钥开几个产品就留几行（v0.150） |

建表迁移：`db/migration/V25__product_enrollment.sql`（新表用 `.sql`，H2 与 MySQL 8 通用）。

- `status`：`PENDING` / `ACTIVE` / `SUSPENDED` / `REVOKED`。只有 `ACTIVE` **且** `valid_until`
  为 null 或在将来才算已开通；过期行不删，前端要能展示「已过期，去续」。
- `source`：`LICENSE`（激活码）/ `TRIAL` / `ADMIN` / `GRANT_ALL`（dev 全授予）/ `LEGACY`（回填）。

### 2. 回填与新账号

`EnrollmentBackfill`（`ApplicationRunner`，`@Order(110)`，幂等，分页 500 一批）对
「一条 enrollment 行都没有」的账号按旧 `aep_users.platforms` CSV 建行：CSV 有值 → 每个平台一条
`ACTIVE/LEGACY`；CSV 为空（历史语义 = 全集）→ 五个子产品各一条。重复启动是 0 写入。

`MeDto.platforms` 从此是 `enrollments` 中 active 项的**兼容投影**；只有账号一条 enrollment 行都没有
（回填还没跑到的瞬间）才回落读旧 CSV。CSV 仍在双写，给未升级的读取方兜底。

新账号（统一账号中心 JIT 建档、无激活码）调 `EnrollmentService.grantForNewUser(userId, platform)`：
dev（`aep.platform.dev-grant-all=true`）→ 五个产品 `ACTIVE/GRANT_ALL`；生产 → **一条都不建**，
用户进产品看到开通页。

### 3. 激活码 = 开通（唯一兑换路径）

三个入口共用 `EnrollmentService` 的同一实现，**不再各写一套**：

| 端点 | 用途 |
|---|---|
| `POST /api/me/enrollments/{product}/activate` `{licenseKey}` | v0.149 新契约，返回 `ApiResponse<Enrollment>` |
| `POST /api/auth/activate` | legacy：激活码注册新账号（响应形状不变） |
| `POST /api/me/license/activate` | legacy：已登录追加激活（响应形状不变） |

两道防重复兑换的闸：

1. **条件更新占码** —— `UPDATE license_key SET status='ACTIVATED', activated_by=?
   WHERE id=? AND status='CREATED'`（`LicenseKeyRepository.claimForActivation`）。影响 1 行才继续；
   0 行一律 409 `LICENSE_KEY_UNAVAILABLE`。此前是「读到 CREATED 再改」的 read-modify-write，
   并发兑换会各发一份积分。
2. **`entitlement_grant` 唯一约束** —— 同一 `(LICENSE, 激活码 id, 子产品)` 只能落一行。
   本次开通的每个子产品各写一条（v0.150）：全站秘钥开五个产品就是五行，
   日后要按产品分别退权 / 对账时才有凭据可依。

其余步骤：算授权产品集合（批次声明 `platforms` → 按批次；未声明 → 按注册来源策略）→
调用方指定的 product 不在集合内则 400 `LICENSE_KEY_PRODUCT_MISMATCH`（**先判后占，激活码不被烧掉**）→
幂等补 `Studio` / `Wallet` → 按批次 `initialCreditGrant` 发积分（走 `CreditService.creditAccount`
的悲观行锁 + 不可变账本）→ upsert enrollment → 同步旧 CSV → 发 `EnrollmentActivatedEvent`。

> `EnrollmentActivatedEvent(userId, product)` 是给统一账号中心那条线用的：
> `@EventListener` 监听它，best-effort 把 `id_product_link` 置 `ACTIVE`（§12.2 末句）。
> 用事件而非直接调客户端，是为了让开通链路不因外部服务抖动而失败。

### 3.5 只读闸 `PhoneVerificationGuard`（微信游客）

`OncePerRequestFilter`，挂在 `EnrollmentGuard` **之前**。

账号中心允许「只有微信、没有手机号」的账号登录进来（令牌 `phone_verified=false`），
但手机号才是全生态的身份识别。这类账号**能看不能改**：

| 请求 | 判定 |
|---|---|
| `GET` / `HEAD` / `OPTIONS` | 不拦 —— 这正是「只读」的定义 |
| 未登录 | 不拦（留给安全链出 401，别把它改写成一个词不达意的 403） |
| `/api/auth/**`、`/api/internal/**` | 不拦（登录本身；服务间调用主体不是人） |
| 已登录且 `phone_verified=false`，方法为写 | **403 `PHONE_VERIFICATION_REQUIRED`**，`error.details.bindUrl` 给出账号中心的绑定入口 |

`bindUrl` 由 `aep.identity.issuer` 派生（`<issuer>/account/manage/phone`），不硬编码域名；
issuer 没配时只是少一条 `details`，不编假地址。

**标记从哪来**：`JwtAuthenticationFilter` 在两条认证链路上都会把 `phoneVerified` 显式写进
`Authentication.details` —— 账号中心 RS256 令牌按 `phone_verified` claim（缺这个 claim 的旧令牌
按已验证处理），legacy HS256 一律 `true`（微信游客只由账号中心的微信登录建出来，而它从不签
HS256，所以 legacy 定义上不可能是游客）。标记缺失（内部服务令牌）一律放行。

同时 `IdentityProvisioningService.syncPhoneVerified` 会按令牌把本地 `aep_users.phone_verified`
回填 —— 此前 JIT 建档一律写 `false` 且无人回填，`/api/me` 对所有账号中心用户都报「未验证」。
只在值变了才写库。

> 为什么不在各个 controller 里判：本仓有上百个写端点，「每个都记得判一下」守不住，
> 漏一个就是一个缺口。与 `EnrollmentGuard` 一样，统一闸门一处拦住全部。

### 4. 后端开通闸 `EnrollmentGuard`

`OncePerRequestFilter`，挂在 `AuthorizationFilter` 之前（此时 JWT filter 与 dev 自动登录都已跑完，
`SecurityContext` 是最终状态）。

**产品归属由服务端说了算**（v0.150）。第一版只覆盖 `/api/me/**` 等五个前缀，且除
`/api/star` / `/api/v1` 外一律信客户端自报的 `X-App-Code` —— 只开通短剧的账号带
`X-App-Code: drama` 就能调 `/api/celebrity/**`（闸门查 drama 的开通状态，请求打的是带货接口），
而 `/api/material/**`、`/api/appearance-forge/**` 压根不在管辖内。现在改成一张
**服务端路由表** `enrollment/config/ProductRouteTable.java`：

| 请求 | 判定 |
|---|---|
| 产品无关白名单（精确）：`/api/me`、`/api/me/messages-overview`、`/api/me/password`、`/api/me/tenants`、`/api/me/ledger`<br>产品无关白名单（前缀，按「精确或下一段」匹配）：`/api/me/enrollments`、`/api/me/license`、`/api/me/wallet`、`/api/me/notifications`、`/api/me/storage`、`/api/me/clip`、`/api/notifications`、`/api/auth`、`/api/admin`、`/api/internal`、`/api/config`、`/api/dev`、`/api/pay/notify`、`/api/v1/admin`、`/api/v1/real-auth/callback`、`/api/aiavatar/health` | 不拦 |
| **单产品路由**：产品由路径决定，`X-App-Code` **只作审计归因**，客户端怎么自报都改不了判定 | 见下表 |
| **共享路由**：`X-App-Code` 必须落在允许集合内 | 缺头 / 非法 → 403 `APP_CODE_REQUIRED`；合法但不在集合内 → 403 `PRODUCT_NOT_ENROLLED`（`details.allowed` 给出集合） |
| 未登记的 `/api/**` 业务路由 | 403 `PRODUCT_ROUTE_UNMAPPED`（fail-closed）+ WARN 出路径 |
| 定到产品后无 ACTIVE enrollment（或已过期） | 403 `PRODUCT_NOT_ENROLLED`，`error.details.product` 给出产品 key |

单产品路由：

| 子产品 | 路径 |
|---|---|
| `celebrity` | `/api/celebrity`、`/api/mixcut`、`/api/material`、`/api/products`、`/api/template-scripts`、`/api/me/celebrity`、`/api/me/mixcut`、`/api/me/products`、`/api/me/publish-jobs`、`/api/me/social-accounts` |
| `drama` | `/api/me/drama`、`/api/me/distribution`、`/api/film` |
| `music` | `/api/me/songs`、`/api/me/albums`、`/api/me/concerts`、`/api/me/music`、`/api/music`、`/api/tracks`、`/api/singers`、`/api/nft`、`/api/marketplace`、`/api/fan`、`/api/coach`、`/api/distribution`、`/api/analytics` |
| `star` | `/api/star` |
| `aiavatar` | `/api/v1/**`（下表的只读形象清单除外） |

共享路由：

| 路径 | 允许集合 | 为什么共享 |
|---|---|---|
| `GET /api/v1/avatars`、`GET /api/v1/avatars/*/looks`、`GET /api/v1/avatars/*/derivatives` | `{aiavatar, music, drama}` | music / drama 的「引入数字人」选择器只读 dap 域（v0.61）。同路径的 POST（创建形象）仍只属 `aiavatar` |
| `/api/me/digital-ips`、`/api/me/inventory` | `{music, drama}` | 数字 IP 壳：music 的「艺人」与 drama 的「演员」共用一套 |
| `/api/appearance-forge`、`/api/community`、`/api/finance`、`/api/settings`、`/api/store`、`/api/wardrobe`、`/api/poses`、`/api/expressions`、`/api/gestures` | `{music, drama}` | 两端共用的创作素材面 |

**防漂移门**：`ProductRouteTableCoverageTest` 起真实上下文枚举每一个 `/api/**` handler，
要求它三选一 —— 白名单 / 已登记 / 明确列进 `UNGUARDED_ALLOWLIST`（当前只有 `/api/store/catalog`
一条：登录前可浏览的公开商品目录）。新增 controller 不登记，构建期就红。

- 未登录请求不抢答（放行给授权链出 401）；机器 / 后台身份（clip 服务令牌、`INTERNAL`、
  `SUPER_ADMIN` / `OPERATOR` / `FINANCE_ADMIN`）不经此闸。
- `/api/me/license/**` 在白名单里是**有意为之**：未开通的账号必须能走 legacy 追加激活来开通，
  否则闸门自锁。
- 白名单前缀按 `path.equals(p) || path.startsWith(p + "/")` 匹配（不是裸 `startsWith`），
  否则 `/api/me/license-of-someone-else` 这类同前缀异语义路径会被误放。
- v0.150 同时把一批此前落在 `anyRequest().permitAll()` 兜底的业务路由收紧为 `authenticated()`
  （`/api/celebrity/**`、`/api/appearance-forge/**`、`/api/tracks/**`、`/api/nft/**`、
  `/api/wardrobe/**`、`/api/distribution/**`、`/api/notifications/**` 等），
  它们此前既可匿名调用、也因此完全绕过本闸（闸门对未登录请求不判定）。

### 5. 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `AEP_ENROLLMENT_ENFORCE` | `true`（含生产） | 后端是否真拦。**只允许测试关闭** —— 生产关掉等同把子产品隔离退回纯前端拦截 |
| `AEP_AUTH_LEGACY_ADMIN_ROLES_ENABLED` | `false` | v0.149 之前签发的后台令牌（没有 `typ=admin`）是否仍按后台身份放行。默认关：部署后管理员重新登录一次即可，代价极小；开着则任何持有旧格式令牌的人都能进 `/api/admin/**`（v0.150） |


### v0.201 · 2026-10-07 · 画布历史恢复与云端素材

生成结果重新打开后只能看到最新候选，旧 `adhoc` 运行没有可见入口；「加入我的资产」只写浏览器 IndexedDB，顶部资产页无法找到。新增完整运行历史（30 条分页）、最近 50 个画布内容版本与恢复入口、云端画布素材（图片/视频/文本）。历史成图与提示词可恢复到画布，无须重新生成或扣费；新运行另保留原始指令。项目卡自动从本人图片取封面。

V39 新增 `ip_project_revision` / `ip_saved_asset`，项目文档 TEXT 扩为 LONGTEXT，与既有 2MB 上限一致。版本与当前文档同事务，PUT 行锁串行检查指纹；素材按本人内容幂等，owner 行锁防并发重复。只保存 key，读取重签；删除素材条目不删除被文档/历史共用的原件。旧浏览器中有本人 key 的素材迁移到云端，未能确认归属的文本/data URL 不自动导入。

离开画布的导航先等待保存，保存失败留在画布并允许重试；在途失败不自动再次发 PUT，避免无限重试和错误基线。节点内容同步提前到 layout effect，候选图加载失败强制重签一次并给出明确重试入口。版本记录从更新后开始；旧操作不能凭空补造，既有生成记录直接可查。

接口：`GET /api/v1/ip-studio/projects/{id}/runs?page=0`；`GET projects/{id}/history`；`GET projects/{id}/history/{revisionId}`；`GET|POST /api/v1/ip-studio/saved-assets`；`DELETE saved-assets/{id}`。恢复整版沿用项目 PUT 与 `baseDocVersion`。运行历史、版本与素材均只允许属主访问。


### v0.202 · 2026-10-08 · Studio 工作流适配（未发布）

新增 `StudioWorkflowService/Worker`、`StudioIpAssetService` 与 `/api/v1/ip-studio` 接口（能力、本人 IP 素材、本人商品/声音/驱动目录、统一运行、显式采用）。V40 给 `ip_run` 加 `client_request_id` / `input_fingerprint`、唯一(project_id,client_request_id) 并扩充 kind。未新建 IP/作品/任务副本表；剧本和镜头正文仍在客户端画布文档，执行结果在原 IpRun。

采用复用 DapAssetIp / DapAvatar / DapAvatarVersion / DapLook。旧主形象按明确版本和 key 校验，造型按真实 lookId/owner/avatar/key 校验；不根据客户端文档授予归属。真实视频的 IpRun 行仅是不可变绑定，状态/产物/费用实时投影 MaterialVideoJob（ipstudio 分区），只由原视频链结算。Studio 终态、取消、超时使用行锁；异步派发 afterCommit，派发拒绝的收尾独立事务。

无 ipId 的既有 publishedAvatarId 仍可返回引用素材，显式采用时将原人物关联 IP；禁止复制人物或重置归属。合成成功按来源 IP 登记既有 DapAssetUsage（usedByType=studio-project），不新建作品状态真值。Studio 合成按显式所选画幅决定是否补边重编码，同画幅保留原分辨率和音轨；旧短剧合成策略不变。

文本生成提示词后台 key 为 `dap.ip_studio_script`：受理前解析并保存模板、实际正文、角色上下文和模型参数的私有执行快照，未配置先报错后才允许冻结。StudioScriptValidator 严格检查字段、正文、唯一镜头编号及有限正时长，坏输出不结算。行锁认领防止同 worker 重复执行，完成/取消/超时及派发拒绝用独立事务处理。

四种助手模式使用 `dap.ip_studio_assistant`，限定本人项目内显式选定节点和有限对话；所选 DAP_PERSONA 模型必须在后台白名单。助手的未知操作保留为只读建议，无法解析的引用要求用户补选，不能直接触发收费任务。1–6 集设定及单集范围严格校验；每镜必须明确所属集。`maxCost` 在图片/文本/原生视频 hold 前核对，旧请求缺新增字段仍能幂等恢复。Studio 文本超时可达 300 秒，不改变其它产品的超时。

`StudioAssetCatalogService` 只读本人商品、人物驱动和声音记录，不调用供应商；固定音色由下节的 StudioSpeechService 接通，X-Dub 同音频口型短样片已接，人物固定声音版本绑定已接通，专属声音仍未完成。`StudioPackagingService` 校验明确时间段和文本上限，用 Java2D 绘制文字再由 ffmpeg 叠加，合成仍零模型积分；不将用户文字插入 shell/filter，也不冒充 ASR。模板及示例发布清理 Studio 执行/审批/对话/采用身份，保留创作结构；模板移除素材，示例复制为平台自有素材。v0.203 已补输入槽、不可变发布版本、独立套用与创建时制作计划；后续有限图片依赖与部分资产包已接入（v0.204），默认一次设定图仍待真实单图验收。

测试参数 `--aep.ipstudio.fixture-enabled=true --aep.ipstudio.fixture-directory=<绝对目录>` 默认关闭，prod/production/mysql 启动硬拒绝。只供隔离的本地 H2 验证；mock 前端仍使用 NEXT_PUBLIC_USE_MOCK=0，调用真接口。旧原生模型入口在此模式下拒绝执行；bridge 将普通图片/视频生成也导入 fixture 运行。准备与验收脚本在 `scripts/studio/`；命令、结果和限制见 `docs/releases/ip-studio-unified-canvas-validation.md`。


### v0.202 配音增量 · 2026-10-08（本地验收通过，代码未发布）

Studio 新增固定音色配音节点、试听/下载、刷新恢复和成片采用配音。供应商为聚算 `qwen3-tts`，后台用途 `DAP_AUDIO`，9 个官方预设音色，正文最多 600 字、风格最多 160 字。新增 `GET /api/v1/ip-studio/studio/speech-catalog`、`POST /api/v1/ip-studio/projects/{id}/speech-runs`；仍以 IpRun 保存唯一任务，不新建任务或资产身份副本。V41 为两个用途 ENUM 添加 DAP_AUDIO，保留已有绑定；迁移必须先于用途配置。

平台按明确配置的单次配音价格校验 maxCost、冻结和结算；供应商按实际音频秒计量，两者分开。持久化原请求与 Job，afterCommit 派发，Idempotency-Key=runId，已受理任务重启只查询，超时不新建任务；音频鉴权下载、实际格式检查后转存 key，短期地址与到期换签。合成可用 `packaging.voiceoverStorageKey` 替换原轨，先验本人归属；长于成片拒绝，不截断台词（2026-10-19 起在拼接之前先判，`StudioPackagingService.precheck`）。成片高级编辑（2026-10-19）：assemble 请求带 `edit`（时间线）时由 `DramaAssembleService.renderStudioEdit` 按时间线合成，FFmpeg 参数由纯函数 `StudioEditGraph` 生成，文字 / 字幕画成 PNG 叠加，产物落 `ipstudio_gen/`，规则见 `specs/BUSINESS_RULES.md`。

真实 Vivian WAV 3.52 秒与带中文包装的 5.066016 秒成片通过，新增 8 积分、pending=0，恢复/重放不重复扣费。线上仅登记 Qwen3 TTS 端点，Studio 代码和 DAP_AUDIO 绑定仍待发布，生产售价未定。固定预设音色不代表专属声音克隆或数字人口型驱动完成。详见 `docs/releases/ip-studio-unified-canvas-validation.md` §11。


### v0.202 口型增量 · 2026-10-08（本地短样片通过，未发布）

Studio 口型同步采用聚算 `x-dub`：选择本人 MP4 人物片段与已生成 WAV，先按真实音频秒向上取整报价，再确认生成。单独后台用途 `DAP_LIP_SYNC` 与 V42，平台明确配置每秒积分；本地测试为 10 积分/秒，生产售价未配置。只上传已选两份素材，原生请求仅 `model/input_video_asset_id/input_audio_asset_id`，不混入通用视频的提示词、时长或清晰度参数。输入/原 Job/checkpoint 保存在同一 IpRun，已受理后只查原 Job，同 Key 鉴权下载保留 `model=x-dub`。预检为 MP4、15–60fps、128MiB；WAV、最多 60 秒/25MiB，配音不得长于视频。成功转存真实视频后同事务结算，失败释放原冻结。

结果另存片段，先检查再采用。X-Dub 此次返回左原片/右口型的对照；“提取口型片段 · 免费”在画幅及左侧与源片 SSIM 匹配后取右侧，保留对照版本，不调供应商、不改输入或账本，重复提取返回同一文件。采用口型片段显式排除原片；合成保留该片段的原音轨。任务列表可定位画布结果。

真实小紫卡通 IP + 原 Vivian WAV 3.52 秒完成，原口型结果 1408×1280/25fps、提取为 704×1280，中文包装成片 720×1280/3.540998 秒。新增 40 积分，提取/合成 0，同键恢复/提取重放没有新增扣费，pending=0；浏览器下载与我方文件一致。详细证据见 `docs/releases/ip-studio-unified-canvas-validation.md` §12。仅证明短样片闭环与可见嘴部变化，未量化音素同步质量或长口播。人物固定声音版本绑定后续已接通（验证记录 §13），专属声音克隆仍未接通；本次未修改线上绑定，代码未提交、未发布。

### v0.202 人物声音版本增量 · 2026-10-08（本地真实验收通过，未发布）

官方预设声音现可归属于人物：在完成的配音节点选择“设为人物声音”，保存音色、风格与真实试听，生成不可变版本，并明确设为默认；保存和切换免费。配音入口可选人物与历史声音版本、播放试听，已选择的版本锁定音色与风格。修改风格需要使用临时固定音色，再显式保存新版本；临时配音不改默认，旧任务继续使用原版本。

复用 `DapVoice(kind=preset,engine=qwen3-tts)`，新增 `profileVersion/stylePrompt/sourceRunId`；`DapAvatar.voiceId` 为默认声音的精确引用，新增 V43，不修改旧迁移，不给旧采样伪造训练状态。来源必须是本人当前项目成功的 studio-audio；音色/风格/试听来自服务端任务，人物行锁、expectedVoiceId 与唯一(avatar_id,source_run_id) 防止覆盖和重复采纳。采纳重放返回原版本，不将当前默认切回旧版本。试听只存 key、实时签名；画布只保存声音版本和 key 的快照。

新增 `GET /api/v1/ip-studio/studio/voice-profiles`、`POST /api/v1/ip-studio/projects/{id}/adopt-voice`、`PUT /api/v1/ip-studio/studio/performers/{avatarId}/voice`。TTS 请求可带 avatarId/voiceId，服务端校验本人、同人物、就绪、音色与风格一致；输入保存 appliedVoice 快照，已受理任务复用原请求正文。原请求兼容新增空字段的旧指纹，重放先于当前配置检查。成功配音与原积分结算同事务记录声音在项目的使用，不建立第二份任务或声音库存。

真实“小紫 · 自然声 v1”使用 Vivian 与“自然明快，像朋友一样介绍。”，原试听 3.52 秒；同版本新台词生成 WAV 4.96 秒，唯一新增消费 8 积分。v2 以新台词为试听，保留同一官方音色/风格；v1/v2 采纳重放、默认切换及原任务重放没有新增账本记录，旧任务仍是 v1。两版本均能在画布查看和试听，当前默认切回 v1。证据见 `docs/releases/ip-studio-unified-canvas-validation.md` §13。专属声音克隆、长口播和生产整体发布验收仍未完成。


### v0.203 · 2026-10-08 · Studio 模板发布版本与输入表单（本地通过，未发布）

沿用 IpDemoTemplate/IpTemplateResolver，增加个人与官方可见范围、不可变 IpTemplateVersion（V44）及 Project.templateVersionId。本人在同一画布配置图片/IP、文字或选项输入、图片步骤、依赖、尺寸、输出角色和采用确认点；个人模板仅本人可见，官方发布仍需超级管理员。模板发布只按白名单重建配方与画布，作者媒体、历史候选、任务、身份、对话和批准不进入版本；旧接口不能覆盖版本模板或删除历史发布，旧模板和项目保持兼容。

用户先填自己的真实图片或精确 IP 图片版本，使用平台当前 DAP_IMAGE 配置预览逐步费用，再免费创建独立画布。每份实例重建 node/connection id、保留自己的输入并锁定来源版本；模板更新后旧画布不跟随变化，下架阻止新套用，旧画布仍可恢复创建时计划。发布与套用均不启动模型、不冻结积分；生成任务仍走原生 IpRun/账本。新增本人模板停用/启用、来源版本与创建时计划查看。商品入口同步修复仅引用旧人物图片时漏显示驱动/声音状态，多人物引用不猜默认出镜人。

M7.1 验收：两个不同人物输入分别建立独立画布，8 图片配方按当前单价报价 64 积分，v1/v2 锁定、停用阻止新建、恢复与作者私有素材清理通过，账本零变化。M7.2 的依赖执行/人工采用暂停/单步恢复与 M7.3 中文展示板/资产包归档尚未完成，八张图片尚未生成；不能将准备好的画布标为成功资产包。验证记录见 `ip-studio-unified-canvas-validation.md` §14。

### v0.204 · 2026-10-08 · 图片模板执行与一次人物设定图（本地，未发布）

有限图片配方复用原生 IpRun/账本，支持依赖、人工采用、逐步费用上限、单步指令调整、显式 CAS 重做和同键恢复；原任务/候选保留，上游变化标记过期，不自动重跑。未知受理结果不能修改原正文后重新提交。画布文档仍由客户端维护，执行指针和模板来源由服务端维护。

进阶模板可免费将采用且未过期的原图打包为 ZIP（来源清单）与可读中文展示板；部分选择明确显示 n/总数。主形象与人物造型显式归档，归档/打包重放复用原结果。本人版本统计派生自原生任务实际费用和采用状态，不含全平台指标。真实进阶样例14次生成/112积分、同请求恢复零新增扣费、pending=0；六张通过并在浏览器完成6/8部分资产包下载，两张仍因侧视角/面部风格未通过，不称完整成功。

按用户澄清，默认旗舰模板改为一个 `sheet` 图片步骤，一次生成一张包含人物档案、三视图、表情、面部/服装细节、配饰与材质配色的设定图。整图继续供图像参考，先生成单独镜头再做视频；独立资产/拼板为可选进阶流程。提示词见 `docs/prompts/ip-character-sheet.md`，按用户附图编写，不称作者原词。本地个人模板与独立实例只验证一张/8积分报价、零生成/零扣费；一次成图质量及整图参考出镜头尚待真实验收。代码与新增表尚未生产发布，详情见 `docs/releases/ip-studio-unified-canvas-validation.md` §15。


### v0.205 · 2026-10-08 · IP 人物库与功能验收（本地，未发布）

画布入口改为“IP 人物库”，以人物为单位汇总主形象、历史、设定图、特写、表情、视角、服装细节和声音。对标 Chrome 中实际观察的小云雀角色库：搜索与分类 → 人物详情 → 选择具体素材 → 添加到画布。缺少素材显示未添加，人物属性只读取既有设定，不猜测。引用保存精确人物/图片版本/lookId/key 与默认声音版本，保存失败可恢复；已归档造型继续保存为人物素材。

V45 为 DapLook 增加可空 assetRole；免费分类接口只修改本人同人物的已完成造型类别，不改主图、版本或积分。旧请求缺此字段仍按旧指纹恢复，避免重复归档。模板结果在画布打开时恢复，计划关闭期间原任务仍继续更新，无需打开制作计划才找回图片。

用户明确本轮验收聚焦界面交互、功能逻辑与 LibTV 创作动线，图片美观及人物一致性不作为功能通过条件，不为改善效果反复生成。一次设定图已通过原生任务受理、结果返回与恢复；浏览器采用、人物sheet归档、跨画布整图引用和一次真实镜头生成均通过，原请求恢复没有新增费用。历史画质观察保留为模型效果备注，不阻塞已实现功能的验收。模板仍为有限图片配方；高级视频模式、专属声音克隆及生产发布不在已完成范围。详细交互与持久化证据见 docs/ip-studio-character-library.md 和 docs/releases/ip-studio-unified-canvas-validation.md §16。

### v0.212 · 2026-10-08 · Studio 视频特效描述库（本地，未发布）

`StudioEffectController` 的列表/发布、收藏和应用接口挂 `/api/v1/ip-studio/video-effects`，仍使用 aiavatar 身份和开通。`StudioEffectService` 对个人条目校验本人、官方发布由超级管理员闸控制；模型采用通用画布视频的 `VIDEO_GENERATION` 白名单，图片封面强验本人归属及真实图片 bytes，只持久化 key、响应签名。V46 新建不可变描述和按账号/条目唯一的活动记录，收藏/最近先锁账号再读改；三条官方文本种子可重启幂等补齐。发布、收藏、应用不创建生成任务、不写积分账本。完整提示词仍由客户端画布维护；供应商原生效果、完整社区视频目录与长视频未由本接口提供。服务7项/迁移1项及六个真实API拒绝案例通过，见 `docs/ip-studio-video-effects.md`、统一验证 §23。

### v0.215 · Studio 助手画面读取（本地，未发布）

`StudioRunRequest.readVisuals` 仅用于assistant，缺失仍按文字。端点当前model匹配的后台models条目必须 `supportsVision:true`；不得靠模型名称推断。本人图片/视频key和16帧预算在hold前核验，worker解码图像或抽取60秒内视频4帧后发OpenAI兼容image_url内容块；原任务只存key，解码/时长失败释放原hold。JPEG长边768px，图片8MiB/2400万像素，视频128MiB，不读取音轨。用量/IO观测脱敏图片内容，后台纯文字重放拒绝 `LLM_REPLAY_MEDIA_UNAVAILABLE`；原请求幂等仍返回原run。真实5份内容块调用消费2积分，视频主体有效、三色图未有效回答；36项定向测试通过，见统一验证§26。

### Studio 故事文档导入（v0.214，本地未发布）

POST /api/v1/ip-studio/projects/{id}/story-import，multipart字段file，返回{success:true,data:{text,format}}。共用aiavatar开通与登录，先验证本人项目；PDF / DOC / DOCX最多8MB，PDF最多100页，正文最多24000字。只提取文字，不保存原附件、不创建IpRun、不冻结或扣积分；宏、链接、嵌入对象不执行，不提供OCR。提取失败返回400 STUDIO_STORY_INVALID 和可操作提示；缺登录401、非本人画布404。客户端负责保存可编辑文字节点。

### v0.216 · Studio 统一附件（2026-10-08，本地未发布）

助手“添加附件”共用本地上传/素材库两条入口，支持图片、MP4、音频和故事多选，逐项报错保留成功项和草稿，保存失败可独立重试且不重传、不启动付费消息。现有云端画布素材库增加audio，搜索/筛选/多选后引用普通节点；已有同key/同正文节点复用。音频可试听、加入我的资产和再引用。免费media-import先验本人项目和实际字节/时长/编码/像素，再计aiavatar存储；上限详见助手文档。实际验收四类文件及损坏PNG、刷新五节点、音频试听/保存，运行0，钱包账本不变。345前端/22后端、构建/类型/契约通过。音轨/完整连续视频理解、Skill/分享和超长模式仍未接通，见统一验证§27。

### v0.217 · Studio 对话快照分享（2026-10-08，本地未发布）

助手历史旁“分享”仅在完成一轮对话后开放。先保存画布并预览服务端白名单文字快照，再明确创建链接；任何获得链接的人可匿名查看对话和创作建议。V47 新增 `ip_conversation_share` / `ip_conversation_copy`，不修改原画布、素材和积分。24字节随机 token，同内容发布幂等；更新快照撤销旧链接，撤销和源画布删除使公开读取失效。公开 GET 仅豁免精确路径，返回 no-store/noindex；复制和管理保留登录、aiavatar 开通、手机绑定及本人归属检查。

快照不含源节点、素材 key/URL、请求、模型、任务或账号字段，原参考绑定替换为重新选择提示。公开页“在 Studio 中继续创作”将文字与建议复制到本人新画布，创建新节点 ID并直接打开助手，无媒体和执行请求，未自动生成；同 owner/clientRequestId 幂等，浏览器 session 保留复制键以供失败/刷新重试。复制内容仍需显式选择本人参考素材、模型并确认费用。分享后新增消息不会自动公开，未发送草稿不进入快照。

这是 Studio 自有分享闭环；LibTV 当前可见“空对话不能分享”入口，但调研账号无历史，本轮未为探测弹窗调用模型，不能宣称其分享表单的所有行为逐项一致。公开画布与复制、社区展示仍是独立待办。验收见统一验证§28。


### v0.218 · 剧本原创/改编与连续制作（2026-10-09，本地未发布）

剧本面板明确区分原创与故事改编，可选择画布文字或已编辑剧本作为素材；提交时保存其当前正文快照，原稿保留。创作设定增加最多三种融合题材、人物关系与叙事结构，生成后的编辑器共用同一设定表单。设定修改只影响后续改写与拆镜，不改原受理请求，并提示既有下游内容需要重新制作。文本请求沿用已选模型；新可空字段不破坏旧请求幂等。

连续制作可选择图片/视频模型及画幅，确认步骤与费用上限后按序执行。已有采用首帧被替换时必须重新确认；计划及输出自动避开已有节点。弹窗内容滚动、确认/暂停固定在底部。暂停只停止后续提交，刷新从原请求继续。实际验收见统一验证§34。

用户明确暂不做整画布分享/复制，本轮保留个人画布发布为模板及新输入套用；不据对话分享推定已实现公开画布。

### v0.221 · Studio 实时排队位置（2026-10-09，本地未发布）

`IpRunDto.queue` 及原生视频的每个 `videoCandidates[].queue` 返回同一端点实际 FIFO 等待序号 `position`（从 1 开始）、等待数 `waiting`、执行数 `running` 和 `concurrencyLimit`。每次读取基于持久票据计算，不保存第二份位置真值；已准入/结束返回空。只返回汇总，不暴露其他用户任务。混合批次只在全部活跃候选均等待时提供运行级排位。Studio 复用现有轮询自动更新位置、停止原请求并清除排队状态；完整证据见统一验证 §37。

### v0.220 · 端点并发与持久排队（2026-10-09，本地未发布）

`AiModelEndpoint.concurrencyLimit` 经现有 admin 端点配置，V48 新增字段和 `ai_generation_queue` 票据表。端点行锁保证跨进程准入，按票据顺序排队；Studio 与通用视频等待不占工作线程，同步文字/图片请求也共用额度。视频、配音/口型保留名额到上游终态，重启仅恢复原任务；排队取消退回原冻结、等待不算生成超时，端点有活跃票据时禁止删除。配置省略/null 保留，0 清空，1–1000 限制，不中断原任务。其他独立协议和人工处理未知受理容量的边界见 [`ai-endpoint-generation-queue.md`](../../docs/ai-endpoint-generation-queue.md)。

2026-10-22 最新无回执策略：图片/视频/配音/口型提交未获得有效任务回执，按失败终态处理，事务内退回未完成部分冻结，保留已成功产物；用户可主动重新生成。旧 unknown 记录由原 worker 收尾，无需 SQL 改账。原始请求与诊断保留，`GET /api/admin/ai-generation-attention` 为 SUPER_ADMIN/OPERATOR 提供只读异常告警。已知供应商任务号的查询异常仍查询原任务，不重复提交。

2026-10-23 飞书模型告警格式（本地未发布）：消息增加告警入队时间（ISO 8601 UTC 与 Unix 毫秒时间戳），投递重试沿用原消息时间；远端 HTTP 状态与我方 HTTP 状态分开。图片、视频、配音、口型及聊天 HTTP 失败保留响应头白名单与响应 JSON 的 `logid/request_id/trace_id`，经原异常携带到告警，原错误类型及对外文案不变。远端任务号读取该任务的 `external_task_id` 或失败图片/配音检查点 `jobId`，与我方任务号、追查号分列；未返回或历史未保存的标识明确显示未获取。继续展示供应商、模型、API 基址与脱敏参数，不向群发送密钥、完整响应、提示词、素材内容或签名链接；不补发历史告警、不调用供应商重试任务。

V53 为每个固定聊天模型端点保存 `chat_supports_temperature`、`chat_supports_top_p`、`chat_supports_response_format` 与 `chat_max_output_tokens`。`AiModelInvocationService` 是内部聊天用途的请求参数执行点：能力列为 null 时沿用原先发送行为，false 时调用方和默认配置均不得发送该参数；输出上限在组装请求后收敛。有限制的端点拒绝调用方改用另一模型，防止把此模型规则误套到别的模型。迁移将存量 Qwen3.5/3.6 的已验证限制写入端点行，运行时代码不按模型名猜能力。管理端可修改；输出上限更新请求省略/null 保留，0 清空。媒体协议仍由对应客户端及候选能力配置负责。

V54 为图片模型端点新增 `image_request_spec_json`：每个端点保存提示词上限、参考图范围、引用字段和允许的画布到供应商请求字段映射。迁移仅初始化已有的三个聚算图片模型；后台编辑同一端点记录。Studio 列表从端点返回可用画幅，受理前按该记录校验并把规格快照写入运行，worker 使用快照组包；缺规格拒绝新聚算图片任务。新图片模型接入时必须先核实并保存该模型的合法规格，不能在运行时代码按模型名猜预设。视频 H3 的 `JusuanH3Contract` 仍是代码中的旧合同，尚未迁移到端点记录。

### v0.228 · Studio 供应商积分计价与上线收尾（2026-10-10）

按用户确认，新增配音、口型同步暂以 1 聚算积分 = 1 平台积分，加 50% 溢价；人民币换算后续统一调整。配置 `ipstudio.supplier-point-pricing` 分开保存供应商每秒积分、换算比例和溢价，不混用端点的人民币微元字段。先对供应商计费秒数向上取整，再对整笔平台积分向上取整，避免每秒取整造成额外溢价。生产确认成本前不开放模型，旧验收单价不作为正式售价。

配音按正文 Unicode 字符数 + 10 秒（上限 600 秒）确定并显示预冻结上限，生成完成按实际音频时长结算、退回剩余冻结；这是一笔消费上限，不是时长预测。极端慢速音频超出上限则明确失败并释放冻结，不追加扣费。口型同步按已解码驱动音频时长报价。任务保存完整定价快照，重启恢复、同键重放和后台调价不改变原请求；已受理旧任务保留旧快照兼容。

正式发布覆盖后端、AiAvatar 和管理后台；保留个人画布发布模板，整画布分享仍暂缓。发布前已完成生产数据库/旧服务备份，隔离 MySQL 8.0.46 上 V39→V48 九项迁移与重复启动零迁移检查；正式部署与线上验收事实记录在 `docs/releases/ip-studio-production-release.md`。

### v0.231 · 模板复制为普通个人画布（2026-10-10）

`POST /api/v1/ip-studio/projects {templateId}` 支持已发布版本的官方/本人模板；`IpTemplateResolver.resolve(id, userId)` 延续启用与可见范围闸。复制从不可变版本 doc/recipe 产生独立 node/connection id、输入默认值、文字变量连线与图片/视频规格，无供应商/模型预检和积分变化。新画布只记录 templateId 来源，不设置 templateVersionId/templateInstanceJson 执行锁；服务端仍整存整取客户端文档。旧实例与模板执行 API 保留兼容，发布权限和素材剥离不变。无新表、迁移、配置或 API 路径。

## 统一认证跨应用复核（2026-10-10，本地未发布）

本次共享后端覆盖 music/drama/celebrity/aiavatar（含 Studio）/star 的相同身份代码。资料写入与事件使用行锁并复查 UID/ACTIVE；合并/注销的旧 UID 保留墓碑，避免旧 token 重新建档；注销/合并回执失败停止游标。专项回归及范围见 [跨应用复核记录](../../docs/audits/unified-identity-sop-audit-2026-10.md)。本节不改变此前手机号发布记录的线上结论，本轮新增修复尚未部署。

## Studio 文本改稿与视频错误字段（2026-10-11）

既有 Studio run 接口新增 `operation=text` 与 `textEdit.content` 正文快照，输出 `textRevision {summary,content}`；复用 script 场景文本模型、计价、端点队列、afterCommit 派发和积分结算。仅普通文本节点可使用，结构化剧本继续原改稿链。

V51 为 `material_video_job` 增加可空 `error_code VARCHAR(64)`，和原 `error_message` 分开；厂商提交错误按 HTTP 状态与厂商错误码映射为平台码，Studio 原生视频投影回传该码。供应商队列满不会显示为平台排队位置。Agnes Video 2.5 使用其独立 mode/seconds/size 协议；生产 Studio 候选仍由后台白名单决定。


## 个人资产库增量（2026-10-11，已生产发布）

现有 `/assets` 升级为资产库，一级导航只放资产库；提取属于画布剧本/文本节点及剧本编辑器「素材 → 本剧资产」。核对人物、场景和道具后入库，即使没有图片也保留为草稿。已有结构化设定免费整理，正文分析沿用配置的创作模型和明确报价；原文与任务先保存，同键确认原任务，不采纳未确认的 AI 改稿。

文件夹为本人手工建立的单层组织，不引入正式项目。名称不作为身份：不同来源同名默认独立，复用已有资产必须显式选择。一个对象可保存多个剧本依据、描述、生成提示词、上传参考图和图片版本；快速完善支持逐项编辑和按缺图批量提交，已有主图/运行中的项跳过，失败项独立重试。新版本不覆盖旧画布引用，引用保存 objectId/versionId 与文件 key、描述快照。

成功的 IpRun 图片候选、视频、音频及完整文本在服务端持续归集，包括未采用候选；上传媒体自动保存。关闭页面不影响归集。库按本人、文件夹、名称/来源、状态/媒体类型分页。新画布可从资产库添加，创作输入的 @ 菜单保留画布候选并可搜索个人资产；同名候选展示来源，图片明确选择版本，无图对象以文字设定引用。原人物形象和声音入口保留。删除文件夹内容移到未分类；删除对象不删除旧画布文件。

持久化使用 V52 `ip_library_record`（folder/object/binding/preference/receipt），原媒体仍用 `ip_saved_asset`，原生成、积分与画布文档继续各自为真值。接口为 `/api/v1/ip-studio/library/**` 与 `projects/{id}/library/{extract,save-extraction,folder}`；分页直接返回 PageEnvelope，资源返回 ApiResponse。跨子产品的音乐/短剧/带货资产统一、团队共享及自动项目归属不在本轮范围。

发布与本地/生产验收范围见 `docs/releases/ip-studio-asset-library-validation.md`（2026-10-11）；本地样例不自动迁移到生产。

### Studio 错误追查（2026-10-13）

同步错误响应增加可选 error.logId；原 message 后缀保持兼容。异步 Studio 失败由 StudioRunErrorLog 关联现有 ErrorLog，把 ID 保存在 IpRun.output.logId 并投影 IpRunDto.logId；保存部分产物，取消不记录为故障。视频原 Job 失败信息保存真实追查号，videoCandidates 返回 errorCode/logId。ErrorLogService.recordTask 用独立事务和明确 owner/task 上下文，记录失败不得回滚任务或积分结算。无数据库迁移，历史任务不补造故障记录。

## 企业主子账号（2026-10-15，本地实施，未生产发布）

2026-10-17 增量（已生产发布）：企业邀请改为群发链接，默认 90 天、可选 365 天、可多人接受并可撤销。匿名只读 `POST /api/v1/ip-studio/enterprise-invitations/preview` 仅回企业名称/ID/有效期；接受仍检查登录、手机号和 aiavatar 开通。V59 清空旧邀请并删除 `accepted_by`，不迁移单次使用逻辑，不改成员或资金。页面 `/enterprise/invite#token=...` 在短信注册/登录后接受邀请，企业令牌不进入账号中心的推荐关系。验收见 [生产记录](../../docs/releases/ip-studio-enterprise-invitation-production-release-20261017.md)。超级管理员的 `/api/admin/test-accounts` 代理账号中心创建/生成入口/停用并审计；仅已验签 TEST_ 身份可免真实手机要求，不放宽普通游客、产品开通、RBAC 或计费。

- 设计：[精简方案](../../docs/ip-studio-team-accounts-plan.md)、[任务拆分](../../docs/archive/ip-studio-enterprise-development-tasks.md)。类型真源 `packages/types/src/enterprise.ts`，业务代码 `aep/enterprise`。
- 基础 API：`/api/v1/ip-studio/enterprises` 的创建/当前企业、成员分页、邀请/接受/撤销、角色能力、模型策略、主账号移交和审计。默认 `AEP_ENTERPRISE_ENABLED=false`，显式开启才注册 controller；仍要求现有 aiavatar 开通和手机号验证。
- V56 数据模型：`aep_enterprises`、`aep_enterprise_members`、`aep_enterprise_current`（userId主键）、`aep_enterprise_invitations`、`aep_enterprise_policies`、`aep_enterprise_ownership_transfers`、`aep_enterprise_audit`、`aep_enterprise_points_batches/transfers`。划拨行为由 E05 实现。
- `aep_wallets` 新增 accountType/accountKey/enterpriseId/memberUserId，企业账户 userId 为空。旧个人钱包 ID、余额不变，accountKey 回填 personal:userId；历史账本不重写。冻结和账本补充 actor/enterprise/membership/authorization，任务和订单补充付款关联。
- CreditService 新钱包 ID 核心与个人包装共用扣桶/冻结逻辑；终态按 hold.walletId 取钱包；企业资金锁顺序为 enterprise→按ID排序的企业wallet→hold→任务，个人仍wallet→hold；跨账户/金额/授权的引用重用409。内部划拨枚举为积分面，收入统计排除 TRANSFER_IN。
- E05：`points/allocate|reclaim/preview` → `points/allocate|reclaim`，批次查询 `points/batches/{batchId}`、流水分页 `points/transfers`。1–100人、确认指纹、正文幂等、整批原子，保留来源、不回收冻结。
- E06：产品侧 `wallet`、`member-balances`、`recharges`；平台 `/api/admin/finance/enterprise-recharges` 列表、`/{orderId}/confirm|reject|refund-preview|refund`。核准固定企业根钱包；原单有冻结先等结算，退款按原单可用额和原比例人民币登记，不自动打款。
- V57：企业现金凭据唯一、充值申请/核准/退款快照、原单积分来源及冻结分配。原个人订单与余额不改，旧收银台/核准/退款入口拒绝企业单；人工单不走在线支付超时关单。
- Studio `/enterprise` 和后台充值订单的企业页接真接口，沿用原组件；前端入口须构建期 `NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。成员管理、模型/在途策略、付款选择与消费报表接入真接口；代码默认关闭；2026-10-15 生产已显式开启，迁移及资金核对见 [发布记录](../../docs/releases/ip-studio-enterprise-production-release.md)。平台财务 controller 不随新企业入口开关关闭。
- 验收：`EnterpriseFoundationTest`（H2或独立MySQL）、`EnterpriseMigrationTest`、`EnterpriseFeatureGateTest`，加旧钱包/财务权限回归。MySQL 测试使用一次性独立库，绝不能指向开发业务库或生产库。

- V58：`aep_enterprise_billing_authorizations` 固定每笔实际任务的付款、成员版本、最终模型/冻结金额、撤销与终态；`aep_enterprise_lifecycle_operations` 保存正文幂等回执。`credit_lot_holds.released_amount` 标出本次释放的原充值来源，避免误回收重入后的新分配。
- 生成：所有 Studio 入口支持可选 `billing`，个人省略兼容；企业在 `reserve` 同事务保存授权/冻结/任务，派发前重验策略，afterCommit 派发。视频上层不二次冻结。原生run/generate/generate-video企业付款必须带clientRequestId；项目锁+持久绑定使重试读取同一任务，不二次冻结。worker 成功/失败与原账户结算同事务。
- 生命周期：`POST /enterprises/{id}/lifecycle/preview` → `POST /lifecycle`，action 为 suspend/resume/remove/leave/close。确认指纹覆盖关系、余额与在途；停用/退出回收可用，已受理任务的晚退款回原企业。停用成员仍可查询本人余额、退出，不能发新企业任务。
- 报表：用户 `GET /enterprises/{id}/my-balance|usage`；管理者查询全企业，普通/停用成员仅本人。平台 `/api/admin/finance/enterprises` 服务端分页检索，并有 `/{id}/wallet|member-balances|points/transfers|usage`。不返回私有文档/提示词。
- 受理恢复：图片/视频保存原供应商路由/请求与任务号，轮询故障保留冻结；仅 SUPER_ADMIN/OPERATOR（不含纯 FINANCE_ADMIN）GET `/api/admin/material-video-jobs/{id}` 或 `/api/admin/ip-studio/runs/{id}` 核对，reconcile 可带原任务号和证据，只查询原任务。不提供无证据强制退积分或重新提交。
- 完整结果见 [交付验收](../../docs/releases/ip-studio-enterprise-complete-validation.md)；产品场景见 [端到端用例](../../docs/releases/ip-studio-enterprise-scenario-acceptance.md)；发布与回退边界见 [发布准备](../../docs/releases/ip-studio-enterprise-release-readiness.md)。

历史人工核对接口仍保留严格的状态和原冻结校验；已按新策略失败并退回的无回执任务不得补录恢复或补扣积分。


## Studio 场景模板与发行共享（2026-10-17，已生产发布）

`StudioScenePresets` 在应用就绪时只补缺失的剧情带货、爆款复刻普通画布模板，不覆盖或重新启用已有模板。仅保存四个通用节点及引用连线，复用原模板解析与个人副本创建，无新表、API路径、执行计划或账本行为。

`ProductRouteTable` 将原本人社交账号域 `/api/me/social-accounts/**` 共享给 celebrity / aiavatar；`GET /api/me/publish-jobs` 及子路径共享读取。均须匹配 `X-App-Code` 与该产品 ACTIVE enrollment，owner 检查不变。发布任务 POST（包括创建/开始/取消/重试）继续仅 celebrity。前端没有把 QUEUED 任务当草稿，不在本轮新增画布成片发布。

边界与验收见 `docs/releases/studio-workspace-refactor-validation.md`；无迁移改动。

2026-10-17 后端与 AiAvatar 已发布 `81778bef`，V58 零新增迁移、两模板实际落库通过；见 [生产记录](../../docs/releases/studio-workspace-production-release-20261017.md)。

## Studio 拉片原声提取（2026-10-17，已发布f8d8cf1b）

`StudioSourceAudio`在全片解析/分段拉片时用原媒体运行时提取完整混合音轨，生成48kHz双声道16bit PCM WAV；无音轨返回`absent`，不创建占位、不做ASR或人声/BGM分离。`output.sourceAudio`先检查点保存，后续模型失败保留；分段继续只复用本人原任务同源结果，key持久化、出wire签URL。前端落为普通音频节点，可选入原成片合成`packaging.voiceoverStorageKey`替换音轨，无新增供应商调用、积分项、表或路径。既有Studio原生视频全能参考链可按模型合同传入音频，首尾帧等不支持的模式仍拒绝，原声按原样复用可走生成后合成。契约见`specs/openapi.yaml`，技术和验收见[分享第7节](../../docs/audits/studio-film-study-technical-sharing-2026-10.md#7-按产品边界收简拉片只提取原声)。

## Studio 视频上传兼容修复（2026-10-17）

`StudioMediaImportService` 不再因 MP4 内部编码直接拒收：可读的非H.264/非AAC素材用 ffmpeg 自动规范为H.264/AAC；仅音轨不兼容时保留画面码流。最多2编码线程、150秒超时，重新校验音轨和时长后才存储、计配额，异常清理输入/输出临时文件。免费导入，无模型调用。`StudioMediaImportServiceTest` 覆盖原逻辑/转码/失败，`StudioVideoCompatibilityTest` 可通过 `-Dstudio.video.demo=本地视频路径` 验真实HEVC+MP3、MPEG4+MP3、H264+MP3三类素材。

### Studio 统一画布封面（2026-10-17，已发布 a4092626）

POST/PUT/DELETE /api/v1/ip-studio/covers/{project|template}/{id} 共用 CanvasCoverService：个人项目和模板属主、官方模板 SUPER_ADMIN，可上传 JPG/PNG、选择目标画布图片、恢复自动。只改 coverKey，不改 doc 或版本；独立封面提交后清理旧文件，回滚清理新文件，不删除画布素材。见 docs/releases/studio-shared-covers-validation-20261017.md。

内置官方模板的人工封面使用 studio.builtin-cover.{id} 平台配置，仅 SUPER_ADMIN 可修改；目录和按 id 解析共用覆盖，不复制 classpath doc。

## Studio 对话 agent、技能与计划执行（2026-10-18，本地实现，未发布）

真源 [`docs/ip-studio-conversational-video-recreation-plan.md`](../../docs/ip-studio-conversational-video-recreation-plan.md)。

**对话（`ipstudio/dialogue/**`）**：每轮对话是一条父 `IpRun`（kind `studio-dialogue`，nodeId = 线程 id，clientRequestId = 用户消息 id）。`DialogueLoop` 是纯状态机：模型 → 类型化动作 → 技能阶段白名单与参数校验 → 工具 → 结果回传 → 继续；（2026-10-23 起一条消息一个 run，不再有步数 / 调用 / 工具 / 时间 / Token 分配上限，冻结不够时在同一 run 上追加冻结，见下文「Studio 对话去掉「继续」」与 `specs/BUSINESS_RULES.md` Studio 对话 30）。端点 `chat_supports_tools=TRUE` 用原生 tool_calls，否则走 `<<<studio-actions>>>` JSON 动作协议（也接受模型常写的 `<tool_call>{"tool":…,"args":…}</tool_call>` 块，`name` / `arguments` 同义；正文与动作分开解析，动作块不出 wire，写不完整的块整批不执行）；`chat_supports_streaming=TRUE` 才 `stream:true` + `stream_options.include_usage` 真流式（`AiModelInvocationService.invokeChatTurnOnEndpoint` / `UpstreamModelHttp.sendStream`，看门狗处理空闲、总时长与停止；断流 `AI_STREAM_INCOMPLETE`），否则完整回复作为**一次** delta，不拆字不延时（§8.0）。计费：受理时要求按量售价（否则 503 `AI_TOKEN_PRICE_NOT_CONFIGURED`）、首笔冻结 min(普通文本额度, 付款账户可用余额)、不够时同一 run 追加冻结，客户端 `maxCost` 只记录、不再 409（2026-10-23 起），按付款选择冻结，afterCommit 派发；本轮全部模型调用累计真实用量，结束时在同一个 REQUIRES_NEW 事务里条件更新 running → done/failed、结算 / 退回、关闭消息、追加 `turn.done`，提交后才广播。**用户停止**：已完成的调用按真实用量结算，被中断那段流不计费也不按字数估算（与现有 Studio 取消的全额退回不同，刻意为之）。线程活动轮次 3 分钟无心跳由 `StudioDialogueSweeper` 判失败并退回。

工具（`dialogue/tools/`）：`read_canvas` / `read_skill` / `analyze_video`（子 run = recreation segments，带 `recreation.maxSegmentSec=model`）/ `propose_plan`（`skill_plan` 提示词，规划输入——阶段说明、操作白名单与各操作 `settings` 字段契约、视频模型合同——与执行侧、后台试跑共用 `StudioWorkflowService.skillPlanStageText/skillPlanConstraints/planCapabilities`，不再各写一份；回复经 `ModelJson` 去掉 ```json 围栏后解析 → `StudioPlanValidator.validateSkillPlan`（`questions` 接受字符串或 `{question, default}`）+ `quotePlan` 报价 → 消息块 `plan`，指纹 64 hex）/ `request_approval` / `confirm_approval`（用户在本轮明确用文字确认某张卡）/ `ask_question` / `propose_text` / `create_nodes` / `connect_nodes`（只发 `node.upsert` 事件，服务端不写画布文档）/ `submit_generation`（必须先过 `StudioExecutionGate` 且线程已绑定执行，否则回复「制作尚未授权」、不冻结）/ `stop`。

持久化（**V61**）：`ip_dialogue_thread`（每画布主线程 `IPT-<projectId>`、分支、`last_opened_at`、历史摘要、活动 run / 执行指针）、`ip_dialogue_message`（text + blocks_json，`UNIQUE(thread_id, client_message_id)`）、`ip_dialogue_event`（`UNIQUE(thread_id, seq)`）、`ip_dialogue_steering`。旧四模式对话节点只导入一次，不重跑不重计费。SSE（`GET …/conversations/{threadId}/events`）：先补放 `afterSeq` / `Last-Event-ID` 之后已入库事件再接实时；id = seq；15 秒注释心跳；游标过期 410 `STUDIO_EVENT_CURSOR_EXPIRED`；事件只在行提交后广播；实时广播为进程内（多节点需换跨节点发布订阅）。父 run 的回复正文存 `output.reply`（不是 `output.text`，否则资产库收集器会把聊天回复收进资产）。

**技能（`ipstudio/skill/`）**：`StudioSkillCatalog` 的 YAML 头 = 服务端边界（阶段操作白名单、limits（`maxSteps` 表达式求值）、checks ⊇ autoFixChecks，可选路由提示 `triggers`）；Markdown 正文 = 给模型的方法；`GET /v1/ip-studio/studio/skills` 只列启用中的技能。S3 起技能存库（V63），仓库文件只作种子，见下方「S3 技能库、意图路由与方法草稿」。

**计划与执行（`ipstudio/execution/**`，V62 `ip_plan_execution`）**：`StudioPlanValidator` 对带 `skillKey` 的计划按技能当前阶段白名单与类型化 `settings` 校验，步骤上限 `limits.maxSteps`（8 段 → 28），模型不得填 `quotedCost / approvedCap / confirmedApproachId / resultNodeId`；`check` 正式进 `StudioWorkflowService.OPERATIONS`（文本类 run，服务端从目标 run 成片抽帧建 `visualContext`，输出 `output.check` 三态，证据时刻只能是真实采样时刻）；`recreation.maxSegmentSec`（`model` = 读所选视频模型合同上限）接入 `StudioFilmStudy` 的段数 / 连续 / 覆盖校验，不满足 400 `STUDIO_SEGMENT_TOO_LONG`。执行器：创建分析执行 / 在同一执行上确认制作阶段（`approvalId` 与 `confirmationMessageId` 必填，必须是本线程助手消息上、对应线程当前计划修订的确认卡，`StudioDialogueApprovals.requireApproval` → 同一事务 `markApproved` 写授权快照并绑定线程），每项目一份活跃执行；每步提交前在租约内核对 `spent + inFlight + quotedCost ≤ approvedCap`，不够 → 步骤 `needs_user`、402 `STUDIO_PLAN_BUDGET_EXCEEDED`（带 shortfall）；租约 `lease_owner / lease_until / lease_version` CAS，启动扫描 / 定时 / 用户继续共用同一推进入口；`paused` 只刷新已有 run；`cancel` 取消可取消任务；`deadline_at` = 开始 + 90 分钟 → `partial`；每步 `clientRequestId` 由 `executionId + stage + stepId + attempt` 派生，重复唤醒不重复提交。执行器自己不冻结一分钱（冻结 / 结算在原生 run）。首版 `autoFixChecks` 为空：检查只建议。

**端点能力（V60）**：`ai_model_providers.chat_supports_tools / chat_supports_streaming`（NULL = 未知 = 不支持，不按模型名猜），后台「AI 模型与 Key」两个开关。

错误码：`STUDIO_SKILL_NOT_FOUND`(404) · `STUDIO_SKILL_OPERATION_NOT_ALLOWED`(400) · `STUDIO_PLAN_STALE`(409) · `STUDIO_PLAN_BUDGET_EXCEEDED`(402) · `STUDIO_PLAN_EXECUTION_BUSY`(409) · `STUDIO_SEGMENT_TOO_LONG`(400) · `STUDIO_THREAD_NOT_FOUND` / `STUDIO_MESSAGE_NOT_FOUND` / `STUDIO_APPROVAL_NOT_FOUND`(404) · `STUDIO_EXECUTION_NOT_ACTIVE`(409) · `STUDIO_EXECUTION_UNAVAILABLE` · `STUDIO_EVENT_CURSOR_EXPIRED`(410) · `AI_TOOLS_NOT_SUPPORTED` · `AI_STREAM_INCOMPLETE` · `AI_USAGE_MISSING` · `STUDIO_PRODUCTION_NOT_AUTHORIZED`(403) · `STUDIO_CHECK_TARGET_INVALID`(400) · `STUDIO_PLAN_INPUT_MISSING`(400) · `STUDIO_VIDEO_MODEL_UNAVAILABLE`(503) · `STUDIO_SOURCE_AUDIO_UNAVAILABLE`(503) · `STUDIO_PLAN_EXECUTION_NOT_FOUND`(404)。

执行器的已知边界：制作开始后不能换新的计划修订（409 `STUDIO_PLAN_STALE`，只能调高同一份计划的预算上限）；视频步骤报价与提交用默认 Studio 视频模型，拉片步骤的 `videoModel` 只用来定段长上限。

**验收修复（2026-10-18，Codex 端到端验收 D01–D10，本地实现未发布）**：
- **确认卡只认当前修订（D01）**：线程出现新的计划修订或新的待确认卡时，其余 `pending` 卡在同一把线程锁里改为 `superseded`（带 `supersededAt`，并发 `approval.required` 更新事件）。`StudioDialogueApprovals.requireApproval` 在调用方事务里锁线程行，返回卡片和线程当前计划（最新的非导入 plan 块）的修订与指纹；执行侧在项目锁（确认制作阶段时还有执行锁）内核对「卡片指纹 = 线程当前指纹 = 请求指纹，expectedRevision = 当前修订」，否则 409 `STUDIO_PLAN_STALE`，不建执行。卡片标 approved 与建执行在同一事务里（不再 afterCommit）。
- **确认来源必填（D02）**：`plan-executions` 的 `approvalId` 与 `confirmationMessageId` 必填（缺失 400 `STUDIO_INPUT_INVALID`），对话确认服务不可用 503 `STUDIO_EXECUTION_UNAVAILABLE`。原先「没有确认卡就只记录」的隐式路径，以及 `StudioDialogueConfirmations.requireConfirmation`（用户消息找卡）已删除。
- **D09**：确认消息不存在、不属于本人本画布，或那条消息上没有这张卡（例如传了用户消息）→ 404 `STUDIO_APPROVAL_NOT_FOUND`；卡已确认、过期、被替代或不是当前修订 → 409 `STUDIO_PLAN_STALE`。
- **授权快照（D10）**：卡片被确认时写入 `approvedBudgetCap / approvedAutoFixCap / approvedPlanRevision / approvedAt / approvedByMessageId / executionId`（按钮确认时 `approvedByMessageId` 是卡片所在消息，文字确认时是用户那条消息）；`budgetCap / autoFixCap` 保留为提议值。分支复制时这些字段一并清除。
- **文字确认（D04）**：新工具 `confirm_approval`（`approvalId` 加用户亲口说的 `budgetCap / autoFixCap`）。权威是本轮用户自己的消息（排队未读的不算）。服务端 `StudioPlanExecutionService.confirmNatural` 核对：卡片在这条消息之前出现，且是唯一的待确认卡（否则 409 `STUDIO_APPROVAL_AMBIGUOUS`）；消息不是提问或犹豫（`StudioNaturalApprovals`，只会拒绝，不会放行；放得过去的是含确认词的句子，或整句只由短肯定词组成——「可以」「好」「行」「嗯，可以」「好吧」，确认卡上写着「直接回复「可以」也行」；「可以吗」「行不行」「可以把第 2 段换成横屏」仍拒）；上限高于卡片时，用户原话里必须有这个数，且不低于报价；付款人取卡片上的。然后走与按钮完全相同的创建 / 阶段确认，`confirmationMessageId` 记用户消息。同一次确认重放幂等。
- **后台制作中的新消息（D03）**：线程绑定的执行处于 `running` 时（即使没有进行中的 turn），新消息存为 `ip_dialogue_steering`（`executionId` 为该执行，`queued`），返回 `queueState=queued`，提交后唤醒执行器。执行器每次推进时，在提交下一步之前读本执行还没处理的转向（`steps_json.steeringSeen` 去重）：执行停在 `needs_user`（「收到新指令，等待重新确认」，已受理的任务照原样完成），并请对话打开回复这条消息的 turn（提示词带上执行实况）。`paused / needs_user` 的执行本来就不提交，这时的消息是普通对话。用户确认新阶段、提高上限或继续时，之前的转向视为已处理。
- **父对话计入阶段预算（D06）**（2026-10-23 起作废：对话费用不计入制作预算，见「Studio 对话去掉「继续」」）：turn 受理时，若线程绑定活跃执行（running / paused / needs_user），先在执行锁内按同一公式核对「已花 + 在途 + 本轮费用上限（hold）≤ 本阶段上限」，不够 → 402 `STUDIO_PLAN_BUDGET_EXCEEDED`（带 shortfall），不冻结、不建 run；够则登记到 `steps_json.dialogueRuns`：运行中按上限计在途，结算后按实际积分计已花，按 run id 去重。`budget.update` 与执行 `budgets` 新增 `dialogueSpent / dialogueInFlight`（父对话那部分，已含在 spent / inFlight 里，不能再加一次）。第一次确认之前的规划对话不属于任何阶段（那时还没有阶段预算），由它自己的 maxCost 授权；分析结束后规划制作方案的对话属于分析阶段（与方案「分析阶段授权覆盖制作方案推导」一致）。为免默认卡片一确认就没有对话余量，`request_approval` 省略上限时，默认总上限 = 报价 + 重做额度 + 一轮对话的费用上限（卡片带 `dialogueReserve`）。turn 结算后唤醒执行器刷新预算。
- **收尾（D07）**：执行到 done / partial / failed / canceled 时（`steps_json.summaryPosted` 保证只发一次），执行器在线程上发一条助手消息（`StudioExecutionMessages.postExecutionMessage`，按 `exec-summary-<executionId>` 幂等）：各阶段实际花费（其中对话多少、还有多少在结算）、做完与没做完的步骤（已采用的标出来）、AI 判断没通过或无法判断的检查及其理由，以及按真实产物推出的 2 到 3 条建议（「重做第 N 段」「把这条成片存为模板」「换成 16:9 横屏再出一版」「把做好的片段合成一条成片」等）。事件为 message.delta（整段一次：服务端文字，不是模型输出）加 turn.done（带 `suggestions`）；建议同时存在消息上（`requestJson.suggestions` → `Message.suggestions`），刷新后仍在。付费的后续动作仍要走确认卡。
- **执行器的卡片是真消息**：预算不够时的「提高上限」卡，以及分析编排出的制作方案（plan 块加卡片，成为线程最新修订），都以助手消息落库，按钮和文字都能确认；不再只发一个刷新就丢的事件。
- **端点受理与 worker 同一规则（D08）**：`AiModelInvocationService.resolveAcceptedEndpoint`：不指定模型即用途默认绑定（不要求 candidate）；指定的端点是启用的 candidate，或仍是该用途当前默认绑定，才放行，否则为空。对话受理、对话 worker、Studio 创作 worker（含拉片）共用；受理时选了既不是默认也不是候选的模型 → 503 `ENDPOINT_NOT_ALLOWED`，提示去后台哪里配。
- `StudioExecutionControl` 现在有实现（`StudioPlanExecutionControl`）：对话快照带上执行投影，对话的 stop 会停掉绑定的执行（执行已结束时 stop 照常成功）。

### S3 技能库、意图路由与方法草稿（2026-10-18，本地实现，未发布）

真源同上（§第三阶段 S3）。代码在 `ipstudio/skill/**`，管理接口 `AdminStudioSkillController`，用户接口在 `StudioSkillController`。

**存库与种子（V63 `ip_skill` / `ip_skill_version`）**：启动时 `StudioSkillCatalog`（`@PostConstruct`）把每个 `resources/studio/skills/*.md` 种进库：不存在 → 写 v1（source=seed）；已存在且**没人动过**（所有已发布版本都来自种子、技能行最后由种子写入、当前版本就是最新种子版本）而文件变了 → 追加一个新的 seed 版本并设为当前（v1 不改写，状态跟随文件）；管理员发布过、回滚过、发布过草稿或改过状态 → **库为准**，文件变更只打日志。仓库文件解析失败照旧拒绝启动（fail-fast）。运行时缓存每个技能的当前版本，60 秒 TTL（多节点 60 秒内收敛），本节点写入提交后立即失效；重新读库失败时继续用上一份。对外 API 不变：`list()`（只含 active）、`available()`、`find(key)`（任意状态）、`requireForNewWork(key)`（未停用即可，已绑定的线程在方法转为草稿后仍可继续）、`parse(text)`；新增 `requireForNewSelection(key)`（给还没方法的线程选方法，只认 active）与 `snapshotFor(key, version)`（任意历史版本含草稿，供后台对比与试跑）。所有入口（仓库文件、后台发布、回滚、草稿、读库）都经 `StudioSkillCatalog.fromHeader` 同一套校验。

**后台（`/api/admin/studio/skills`，SUPER_ADMIN / OPERATOR，FINANCE_ADMIN 403）**：`GET` 列表（含待审草稿数）/ `POST` 用整份文件新建（key 取 YAML 头，重复 409 `STUDIO_SKILL_EXISTS`）/ `GET {key}` / `GET {key}/versions`（含草稿与来源）/ `GET {key}/versions/{v}` / `POST {key}/versions` 发布新版本（YAML 文本或 JSON + 正文 + 说明，`expectedVersion` 条件更新；key 必须与路径一致，version / status 由服务端定；校验不过 400 `STUDIO_SKILL_INVALID`，`error.details.reason` 为具体原因）/ `POST {key}/versions/{v}/publish` 原样发布草稿（草稿的 `baseVersion` 必须等于当前版本，否则 409 `STUDIO_SKILL_DRAFT_STALE`）/ `PUT {key}/status`（让平台一个启用中的技能都不剩 → 409 `STUDIO_SKILL_LAST_ACTIVE`；所有技能行加锁，两人各停一个也不会停空）/ `POST {key}/rollback/{v}`（复制已发布过的历史版本为新版本 source=rollback；草稿不能作回滚目标）/ `POST {key}/dry-run` 试跑。同一时间只能有一个启用中的 `default` 方法（409 `STUDIO_SKILL_DEFAULT_CONFLICT`）。每次写入都在技能行锁内校验全文、插入新版本行、移动 `current_version`，同一事务。

**试跑**：用样例分析 / 用户目标 / 素材清单，按当前版本、指定版本（含草稿）或未保存的修改，调用一次 `dap.ip_studio_skill_plan`（提示词变量与正式规划共用 `StudioWorkflowService.skillPlanStageText / skillPlanConstraints / planCapabilities`），回复走 `StudioPlanValidator.validateSkillPlan`；返回 `{plan, validation:{ok, errors[]}, usage}`。不向任何用户计费、不报价、不加指纹、不保存。没指定端点时用 Studio 创作（studio/script）的默认文本模型，没有 → 503 `AI_NOT_CONFIGURED`，提示词缺失 → 503 `PROMPT_NOT_CONFIGURED`，绝不产出假计划。

**意图路由（`StudioSkillRouter`，`StudioDialogueService.startTurn`）**（本段是 S3 初版，打分、平手与「绑定后不换」已被下一节「意图直达」取代）：线程还没有技能时：带 `skillKey` → 必须 active；不带 → 0 个启用技能照旧不带方法回答，1 个就用它，多个则按钉住 / 附件节点的媒体类型（每命中一种 +2）与消息关键词（每个 +1，不区分大小写）给各技能打分，唯一最高分胜出，平局或都没命中用唯一的 `default: true`，仍定不下来 → 400 `STUDIO_SKILL_REQUIRED`（`error.details.skills=[{key,name,summary}]`，界面请用户选）。结果写线程（`skill_key / skill_version`，已有列），出 wire 在 `StudioDialogueThread.skillKey / skillVersion`；绑定后不再改。`read_skill` 绑定新线程也只认 active。仓库技能文件加了 `triggers: {media:[video], keywords:[复刻, 拉片, …], default: true}`。

**从成功画布整理方法草稿（`POST /v1/ip-studio/projects/{id}/skill-drafts`）**：只限运营（`InAppOperatorGuard.isOperator`，即 `aep_users.operatorRole` 或后台令牌），其他人 403 `STUDIO_SKILL_DRAFT_FORBIDDEN`。执行必须属于本人本画布（否则 404 `STUDIO_PLAN_EXECUTION_NOT_FOUND`）且为 done / partial（否则 409 `STUDIO_SKILL_DRAFT_NOT_READY`）；测试响应模式 400 `STUDIO_SKILL_DRAFT_UNAVAILABLE`。受理一个 kind=`studio-text`、operation=`text`、purpose=`skill-distill` 的按 Token 计费任务（nodeId `SKD-<executionId>`）：冻结前核对 studio/script 默认模型、提示词 `dap.ip_studio_skill_distill`（新 key，已入 `KNOWN_KEYS`）与按量售价，`maxCost` 须不低于报价，冻结（个人或企业）与任务同事务，`afterCommit` 派发；同 `clientRequestId` 幂等。模型只拿到当前技能正文与执行的结构化记录（各阶段方案与理由、每步结果 / 重做次数 / 是否被采用、检查结论与各项理由），**不给步骤提示词、用户原话、存储 key**。worker（`StudioSkillDistill.normalize`）再移除疑似网址、存储 key 与媒体路径、内部编号、长哈希以及照抄的案例原句（计数进 `strippedReferences`），丢弃模型自带的 YAML 头，缺章节时在说明里提醒审核人。`StudioSkillDraftSink` 在**结算同一事务**里插入 `ip_skill_version(status=draft, source=distilled, author=用户 id)`，YAML 头沿用基础版本（模型文字改不了操作、上限与检查项），不改当前版本与状态；保存失败则事务回滚、任务失败并全额退回。`output.skillDraft = {skillKey, version, baseVersion, changeNote, strippedReferences}`，不写 `output.text`（否则资产库会把它收成文字素材）。发布是管理员动作。

错误码（S3 新增）：`STUDIO_SKILL_INVALID`(400) · `STUDIO_SKILL_REQUIRED`(400，2026-10-20 起路由不再返回，保留给将来的显式冲突) · `STUDIO_SKILL_EXISTS`(409) · `STUDIO_SKILL_VERSION_CONFLICT`(409) · `STUDIO_SKILL_VERSION_NOT_FOUND`(404) · `STUDIO_SKILL_LAST_ACTIVE`(409) · `STUDIO_SKILL_DEFAULT_CONFLICT`(409) · `STUDIO_SKILL_DRAFT_STALE`(409) · `STUDIO_SKILL_DRAFT_FORBIDDEN`(403) · `STUDIO_SKILL_DRAFT_NOT_READY`(409) · `STUDIO_SKILL_DRAFT_UNAVAILABLE`(400；worker 侧草稿服务缺失时 503)。

已知边界：缓存按节点，跨节点最多 60 秒才看到后台改动；版本号由技能行锁内 `max(version)+1` 分配；草稿只修订正文，改 YAML 头（含 `autoFixChecks`）只能由管理员发布新版本；`autoFixChecks` 仍为空，要等检查项实测与版本评审。

### 意图直达（2026-10-20，本地实现，未发布）

设计真源 [`docs/ip-studio-dialogue-intents.md`](../../docs/ip-studio-dialogue-intents.md)。背景：对话里问太多、只生成一张图也要两张确认卡、换个事就得从消息分叉。

**技能目录（`resources/studio/skills/*.md` 种子，四项）**：出图 `image-generation`（production：text, image）、写剧本与文案 `script-writing`（production：text）、出视频 `video-generation`（production：text, image, video, check, assemble）、参考视频复刻 `reference-video-recreation`（analysis：recreation, text → production：text, image, video, check, assemble）。每个技能正文有「必填与可选」一节，是模型「要不要问」的唯一判据。关键词至少两个字（「画」会命中「画布」），`StudioSkillCatalogTest` 钉住。

**direct 规则**：`operations.analysis: []` 的技能是直达技能（`StudioSkill.direct()` / `StudioSkillRules.Rules.direct()`），`firstStage()` 为 production，其余为 analysis。不允许 `check` 的技能 `checks` 可以为空（`StudioSkillCatalog.fromHeader` 按「是否有阶段允许 check」判断）。

**路由新规则（`StudioSkillRouter.decide(active, media, text, bound)` → `MATCH / KEEP / OPEN`；`route(…)` 是它的 Optional 形式）**：写作意图先判（写作动词在同一分句里直接带文案 / 卖点 / 标题 / 口播 / 脚本 / 剧本等文字产物 → 写剧本与文案，带图带视频也一样；先要了图、视频或复刻的句子例外，此时写稿技能的关键词不计分）；其余关键词每个 +2、素材类型每种 +1（词优先于素材）；唯一最高分胜出（MATCH）；文字一个关键词都没中 → 沿用线程当前技能，没有就不绑（KEEP，只有素材不选方法）；平手 → 一律不绑（OPEN，2026-10-21 起当前技能在平手里也不沿用），`startTurn` 清掉线程 `skillKey / skillVersion / stage`、本轮不带技能，日志 `[dialogue] routing tie thread=… among [...]`，由模型在回合内 `read_skill`；**不再抛 400 `STUDIO_SKILL_REQUIRED`**，`triggers.default` 只是给模型的提示。`StudioDialogueService.startTurn` 按任务绑定：线程没有活跃执行时每条消息重新路由，换技能就改写 `thread.skillKey / skillVersion` 并把 `stage` 设为新技能起始阶段；有活跃执行时方法不变，显式换 → 400 `STUDIO_INPUT_INVALID`。`bindExecution(…, null, null)` 解绑时清空线程 `stage`；分叉线程的 `stage` 取技能起始阶段；`read_skill` 在没有活跃执行时可换方法（`Effects.bindSkill` 可覆盖）。

**一张卡的执行路径**：`ProposePlanTool` 对直达技能接受 `stage=production`（无执行也可），拒绝 `analysis`；`StudioPlanValidator` 允许直达技能的制作计划没有 `approaches`；`StudioWorkflowService.skillPlanConstraints` 的 `stageGuide` 按技能写（直达技能说明没有分析阶段、不写 plan-compile，只列本技能允许的操作）。`StudioPlanExecutionService.create` 收到 `stage=production` 且无 `executionId` 时先 `locatePlan` 查技能：直达 → 直接以 production 阶段建执行（步骤、预算、授权快照、afterCommit 唤醒与分析阶段同一套代码）；非直达 → 400 `STUDIO_INPUT_INVALID`（原行为）。`confirmNatural`（文字确认）同样放行；`replanStage` 只在计划有 `recommendedApproachId` 时核对 approachId。写剧本与文案的短稿（1500 字以内）由对话模型当轮写好、`create_nodes` 放进画布，不走计划。

**提示词**：`dap.ip_studio_skill_dialogue.md` / `dap.ip_studio_skill_plan.md` 改写（意图表、问题预算、一轮确认），`PromptTemplateSeeder.SEED_VERSION` = `v19-2026-10-20-dialogue-intent-direct-merged`（不升版本线上不刷新）。`StudioDialoguePromptWiringTest` 钉住提示词里提到的工具名、意图表里的技能名与 worker 填的模板变量都真实存在，两份提示词的问题预算一致。

测试：`StudioSkillRouterTest`、`StudioDialogueRoutingTest`、`StudioSkillCatalogTest`、`StudioPlanValidatorSkillTest`、`ProposePlanToolTest`、`StudioPlanExecutionServiceTest`（`aDirectSkillsProductionCardStartsTheExecutionInProduction`）、`StudioDialoguePromptWiringTest`；`StudioSkillRegistryTest` / `AdminStudioSkillControllerSecurityTest` 按四个种子技能调整。未做：真模型按设计 §7 评测集端到端（§8.0.1 ⑦）；配音 / 口型技能。
### 原创创作技能、看图、节点规格与动作协议（2026-10-20，生产问题修复）

- **原创创作**（`resources/studio/skills/original-creation.md`）：`operations.analysis: []`，只有制作阶段。`StudioSkill.firstStage()` / `Rules.firstStage()` 是唯一判定：线程绑定、`propose_plan` 默认阶段、`StudioPlanExecutionService.create` 的起始阶段都读它。新执行可以直接从 production 开始（仍须推荐方案、报价不超上限、卡片 / 自然语言同一套确认）；复刻技能照旧先分析。没有进行中的执行时 `read_skill` 可换技能（`Effects.bindSkill` 覆盖线程技能与阶段，作废旧卡）；`startTurn` 的阶段 = 进行中执行的阶段，否则技能第一阶段。
- **`view_images`**（`dialogue/tools/ViewImagesTool`）：`StudioVisualContext.snapshot` 校验本人 key → `parts` 内联字节 → 本轮对话端点（须 `supportsVision`）→ 返回客观描述；调用前按「文字 + 每张 1200 token」查本轮预算，用量记进本轮账单；视觉预算被拒时同一批图缩到 640 边再试一次。`DialogueCanvasDigest` 在图片 / 视频对象上注明「这里只有名称，画面要用 view_images 看」。
- **节点规格**：`NodeSpecs` 解析 `aspectRatio / durationSec / count / references`；`create_nodes` 写进新节点 `metadata.studio.spec` 并为每个参考发 connect；新工具 `update_nodes` 对已有图片 / 视频节点发 `update`（prompt 走客户端改稿建议）+ connect。
- **动作协议**：`DialogueActionProtocol` 接受 `<<<studio-actions>>>`、`<tool_call>`、`<studio-actions>` / `<studio_actions>`；`MarkerFilter` 在闭合标签后继续推送正文，标记里含的标签写法不误判；正文模仿工作记录按格式错误处理；`DialogueLoop` 连续 2 次格式纠正后以 `LIMIT/protocol` 结束本轮。`DialogueHistory.line` 把工具记录放到单独的「（服务端记录…）」行。
- **模型下架**：`VideoProviderErrorMapper` 把 `400 model_delisted` 映射为 `VIDEO_MODEL_RETIRED`；`MaterialVideoModelClient` 记住（进程内 24h）并在 `validateRequest` / `submit` 冻结前拒绝同一端点 + 模型。
- 提示词：`dap.ip_studio_skill_dialogue` 新增规则 10–13（选对方法、看图要真看、规格写到对象上、不模仿记录），`PromptTemplateSeeder.SEED_VERSION` = `v18-2026-10-20-dialogue-original-vision-specs`。无迁移、无 HTTP 路径变化。

### 一张画布多段对话（2026-10-20，本地实现，未发布）

设计真源 [`docs/ip-studio-new-canvas-and-threads.md`](../../docs/ip-studio-new-canvas-and-threads.md) §3。不加迁移：V61 的 `ip_dialogue_thread` 早就按 `project_id + owner_user_id` 存多段，「当前那段」= `last_opened_at` 最新（`GET …/conversation` 返回它）。`StudioDialogueController` 新增四条（列表、新建、只读快照、打开），都不调用模型、不冻结、不扣费；只有新建、打开、分支会 `markOpened`，读取一律不改当前那段（`messages()` 不带 `beforeSeq` 也不再 `markOpened`，分支的原对话预览靠它读父对话）：

- `GET /api/v1/ip-studio/projects/{id}/conversations` → `ApiResponse<ThreadSummary[]>`（`StudioDialogueService.threads`）：有消息的对话 + 当前那段，按 `lastActivityAt` 倒序（最后一条消息时间与对话创建时间取较晚，分支复制的消息保留原时间，所以新分支排在原对话前面），最多 50 段，超出时当前那段替换掉第 50 段。`title` 由第一条有文字的用户消息派生（`threadTitle`：压空白、24 个码点、「…」，否则「新对话」），不读线程的 `title` 列；`messageCount` 为全部消息（时间线显示什么就数什么，含系统提示和排队中的用户消息）；`active` = `activeTurnId` 或由这段创建的执行处于 running / paused / needs_user（`StudioExecutionControl.activeByThread`，一次查询；没有执行器时退回看执行指针）。查询条数固定：线程列表、`IpDialogueMessageRepository.statsByCanvas`（按线程分组的条数与最后时间）、`firstUserTexts`（相关子查询批量取每段第一条有文字的用户消息）、一次活跃执行；只有仍指着回复 run 的线程会额外 `reconcile`。
- `POST …/conversations {clientRequestId}` → `ApiResponse<State>`（`createThread`）：键用 `branch()` 同一个正则校验，不合法 400 `STUDIO_INPUT_INVALID`。事务里先锁画布行（`requiredForUpdate`，并发新建串行），同人同键已有 → 设为当前返回（键属于别的画布或分支 → 409 `STUDIO_REQUEST_CHANGED`）；否则复用本人这张画布最新创建的空闲空对话（无消息、无回合 / 回复 run / 执行指针、不是分支、没有技能），不改它的 `client_request_id`（`UNIQUE(owner_user_id, client_request_id)` 不冲突，重放按同一规则回到同一段）；都没有才新建 `IPT-<uuid20>`（标题默认值、技能与阶段为空、记下请求键）。
- `GET …/conversations/{threadId}` → `ApiResponse<State>`（`readThread`，只读）：`requireThread`（404 `STUDIO_THREAD_NOT_FOUND` / `IP_PROJECT_NOT_FOUND`）→ `reconcile` → `snapshot`，**不** `markOpened`。前端的断线重连、轮询与补拉都走它：此前补拉调的是「打开」，在途的旧请求会把服务端的当前对话切回去，刷新后落到错误的那段（Codex 评审 2026-10-20）。
- `POST …/conversations/{threadId}/open`（请求体可为空）→ `ApiResponse<State>`（`openThread`）：`ensureMainThread` → `requireThread` → `markOpened` → `reconcile` → `snapshot`。只有用户在「历史对话」里点一行时调用。与 `…/conversations/{nodeId}/share` 路径末段不同，不冲突。

当前这段在回复或制作时不能新建 / 切换由前端拦，服务端不拒绝（切走后原对话照常进行和结算）。测试：`StudioDialogueThreadsTest`（真持久化：列表范围与排序、50 上限保留当前、标题截断、新建设为当前、空对话复用、同键幂等、跨画布 / 分支键 409、非法键 400、他人线程 404、`active` 判定、路由字段、只读 GET 与读消息不改当前而 `POST …/open` 才改）。

同批卡片精简（真源 §4.4–§4.5，不改接口）：执行完成总结 `StudioExecutionSummary` 只写一句结果和总花费（「做好了，花了 30 积分。」），不分阶段列花费、不复述步骤，没做完的步骤和检查没通过的原因各一行，建议按实际产物给（兜底「把这张画布存为模板」/「再试一次」）；`dap.ip_studio_skill_plan` / `dap.ip_studio_skill_dialogue` 与 `RequestApprovalTool` 的 `scope` 说明收短，`PromptTemplateSeeder.SEED_VERSION` 升到 `v20-2026-10-20-concise-cards`。`StudioNaturalApprovals`、确认卡 24 小时过期与上限提议都不变。

### Studio 原生 GPT 图片接入（2026-10-20）

图片端点协议支持 `wire.inputMode="multipart"` 和 `referenceSubmitPath`：无参考图沿用 JSON `submitPath`，有参考图以原始文件按顺序提交到编辑路径，多图字段采用 `image[]`。尺寸、提示词、候选数、来源归属及价格继续由原端点规格和场景策略校验；提交前验证文件，未知受理仍保留原检查点，禁止自动重投。`capability.imageSizes` 仅暴露尺寸/比例，Studio 选择后把精确 `size` 保存到请求与草稿，不向客户端暴露供应商参数或密钥。接入与实测记录见 `docs/releases/studio-gpt-image-native-20261020.md`。

`wire.requireExactOutputSize=true` 按原始图片字节校验返回尺寸；不匹配作为供应商已完成但无效的结果在结算前拒绝，不重投、不伪装尺寸。


### 正式模型与旧入口兼容（2026-10-20）

DAP / 短剧图片经 `ConfiguredImageGenerator` 复用 Studio 配置化原生传输：文生图 JSON、图生图 multipart 实际文件，旧固定像素按合法原生画布等比处理（16:10 场景采用中央安全区），不放宽 Studio 原生输出尺寸校验。DAP 文本经统一 chat 适配端点能力与输出预算。DAP 运镜经 `DapVideoBridge` 复用持久化媒体 worker，`dap` 子分区仅接本人形象首帧，子任务零价，父作业仍按原动作计费并持久保存子任务 ID。爆款雷达由 `VideoAnalysisFrames` 读取实际视频取四帧交给看图模型，结果明确采样范围与未知指标，失败不凭链接生成分析。实现、正式模型配置与发布证据见 [验收记录](../../docs/releases/production-model-compat-20261020.md)。

### Studio 单轮对话独立额度（2026-10-23 已生产发布）

> 2026-10-23 起与下文「Studio 对话去掉「继续」」一节冲突的部分以该节为准。

capabilities 的文本模型新增 `dialogueTokenPricing`，普通文本仍用 `tokenPricing`。`AiChatTokenPricing.findDialogue` 沿用 `ai.chat-token-pricing` 的模型单价，整轮上限读取 `studio.dialogue-token-budget`，未配置时默认累计输入 1048576 / 输出 65536 Token。配置形状：

```json
{"maxInputTokens":1048576,"maxOutputTokens":65536,"endpoints":{"端点ID":{"maxInputTokens":1048576,"maxOutputTokens":65536}}}
```

端点覆盖优先，否则取全局值；输入须为 1–2000000 的整数、输出 256–2000000。后台「预设参数 → AI 文本计费」可独立维护。对话提交、冻结、运行快照与制作阶段的对话预算预留使用同一报价；受理后的 `_exec.tokenPricing` 快照保持不变，结束按真实用量结算并释放余量。普通改稿 / 剧本 / 分镜 / 资产提取不受影响，无需新表或迁移。仍保留 16 步 / 40 次模型调用 / 24 次工具 / 10 分钟与重复动作保护，单次输出继续受提示词和端点限制。

用量保护提示改为「本轮对话已达到用量保护上限，已暂停。已完成的内容已保留，点「继续」接着做；后续按实际用量计费。」；快捷答复沿用原消息发送和幂等路径，不自动另开付费轮次。

### 对话确认继续（2026-10-23 已生产发布）

> 2026-10-23 起与下文「Studio 对话去掉「继续」」一节冲突的部分以该节为准。

服务端从真实受限 run 和明确的本人续接消息派生 `continueUntilDone` / `continuationOf`，不接收客户端开关；新任务不沿用。继续期间使用同一循环与父 run，原目标和完成的操作保留在上下文；取消单轮 Token 分配、步数 / 调用 / 工具次数和用时阈值，以已冻结的 `rate.maxCost` 为实际金额约束，按真实用量结算。调用前按剩余金额收敛输出，预算不足 reason=`budget`，停止、制作授权和重复保护保留。`<studio-action name="…" args='JSON' />` 进入原动作校验，流式隐藏、坏批次不执行。详见对话续接回放审计。


### 对话跨制作类型续接（2026-10-23）

`StudioSkillRouter` 优先识别明确的视频产物，避免首帧/人物参考图名称把视频需求分到出图。`ProposePlanTool` 对「继续下一步」整理出的具体 brief 再次选择有效方法，沿用 `Effects.bindSkill` 的线程锁、旧卡失效和父任务快照；活跃执行仍不切换。`RequestApprovalTool` 只为本轮成功整理、方法/阶段一致的计划发卡；规划失败后继续修正，不会拿历史计划发卡、重复原图片步骤。无新 API、迁移或生产配置。规则见 `docs/ip-studio-dialogue-intents.md`。


### Studio 读取与保存恢复（2026-10-23 本地修复，未发布）

> 2026-10-23 起与下文「Studio 对话去掉「继续」」一节冲突的部分以该节为准。

客户端仍持有较低旧 `maxCost` 时，`Rate.withinBudget` 保留现行单价、按原金额上限缩减本轮输入/输出额度；受理、冻结、执行与结算共用缩减后的快照。最低回复预算也放不下时才返回 `STUDIO_PRICE_CHANGED`，不自动增加用户授权。

`read_canvas` 无 nodeIds 时提供目录分页，指定 nodeIds 时返回正文片段、`offset/nextOffset/hasMore/totalChars`；offset 按 Unicode code point 计算，不拆开 emoji。`DialogueLoop` 遇到第一次相同 read_canvas 批次时不重读，回传明确游标纠正，第二次仍不推进则停止；写入和付费工具的重复保护不放宽。

`read_production_status` 免费查询当前项目的最新对象任务，必须走 `IpProjectService.toRunDto`，不能把 `studio-video` 的受理行 done 当作供应商成功。`hasAdoptedContent` 与 `latestStatus` 分开表示旧采用结果和最新任务状态，不暴露签名 URL 或 storageKey。仅有工具与提示词修复，真实模型行为尚待验收。

项目 PUT 的基线过期但规范化 doc、请求中的名称和封面与当前完全一致时视为幂等成功，用于恢复已提交却丢失回执的保存；只要内容不同仍返回 `IP_PROJECT_STALE`。前端只对网络和临时网关状态做同快照重试，不强行更新基线。

### Studio 对话去掉「继续」（2026-10-23，本地未发布）

设计真源 `docs/ip-studio-dialogue-no-continue.md`，规则见 `specs/BUSINESS_RULES.md` Studio 对话第 30 条。

- **结束条件**（`DialogueLoop`）：模型不再给动作、用户停止、付费生成等确认卡、`ask_question` 照旧；单轮的 16 步 / 40 次调用 / 24 次工具 / 10 分钟 / Token 输入输出分配全部删除。剩下的 `limit`：`budget`（追加冻结被拒：钱包没钱或付款授权失效；工具内部调用被拒时工具返回 `end=LIMIT`）、`loop`（相同动作批次第一次给纠正，纠正后再相同才结束）、`protocol`（格式纠正两次仍错）、`safeguard`（单个 run 300 次调用或 2 小时，ERROR 日志带 threadId / runId / 调用次数）。
- **一个 run 从头到尾**：一条用户消息只有一个 run、一条助手回复、一个 `turn.done`。`TurnBudget.metered(rate, held, …, topUp)` 以已冻结总额判断每次调用，放不下先调 `topUp`（`StudioDialogueTurnWorker.extendHold`）再判断；`settleWithin(in, out, held)` 按金额结算。
- **冻结**：受理（`StudioDialogueService.startTurn`）冻结 `min(AiChatTokenPricing.find(endpoint).maxCost(), 付款账户可用余额)`，余额不够一次最小调用时请求完整增量、由冻结返回 402；`_exec.tokenPricing`（普通文本价）、`_exec.holdIncrement`、`_exec.holdRefs=[{ref,amount}]`。`extendHold` 在独立事务里：结算锁 → run 行锁 → 读付款钱包余额 → 金额 `min(max(增量, 本次所需), 余额)`，付不起本次调用就拒绝 → 引用 `runId#n`：企业成员 `EnterpriseBillingService.reserveExtension`（复制原授权的成员 / 钱包 / 模型，校验授权仍有效、成员关系未变、模型仍允许，不计入在途任务上限；授权引用含 `#` 的不算新任务），个人 `credits.hold` → 追加进 `holdRefs`、`run.cost` 记冻结总额。被拒抛 `HoldRefused`，Turn 记下原因、本次调用不做。
- **结算**（`finish`，`DialogueHolds`）：对每个引用加结算锁 → 按实际用量从第一笔起依次 commit（每笔不超过自身金额），其余 release；失败 / 取消 / 过期 `releaseAll`；企业授权逐笔 `complete`。`expireIfStale`、`IpRunReaper`（对话 run 交给 `expireIfStale`）、`CreditHoldSweeper`（`DialogueHolds.runOf` 找 run，`isLive` 跳过）都覆盖追加的引用。余额不够的系统提示带 `requestJson.notice=recharge|recharge-enterprise`（`Message.notice` 出 wire），`output.holdRefused=balance|other`。
- **对话费用不计入制作预算**：`StudioExecutionGate.attributeTurn`、`StudioPlanExecutionBridge.attributeTurn`、`StudioExecutionMessages.dialogueReserve` 删除；`StudioPlanExecutor.refresh` 不再统计 `dialogueRuns[]`，`budget.update` 与 `PlanExecutionBudget` 去掉 `dialogueSpent / dialogueInFlight`（旧行刷新时去掉这两个字段）；`RequestApprovalTool` 与制作阶段卡上限 = 报价 + 重做额度。
- **兼容**：旧 `_exec.continueUntilDone / continuationOf` 照样能读（`continuationContext`），不再写；旧数据里的「点继续接着做」系统提示照常显示；没有 `holdRefs` 的旧 run 按 `[runId, run.cost]` 结算。
- **上下文窗口**：`DialogueContextWindow.trim`，最近 6 轮完整，更早的工具结果一行摘要、长参数换成合法占位 JSON（原生 tool_calls 与 tool 消息一一对应不变），估算超 80k 时降到 3 轮 / 1 轮；只影响发给模型的视图。
- **其它**：`DialogueCanvasDigest.full` 写明全文字数与 `read_canvas` 分段参数，`read_canvas` 文字对象返回 `total`；`ChildRuns.follow` 最多等 10 分钟，拉片仍在进行时不再 `HANDED_OFF` 结束，交给模型告诉用户。提示词 `dap.ip_studio_skill_dialogue` 规则 14 + 分段读用法，`PromptTemplateSeeder.SEED_VERSION=v25-2026-10-23-dialogue-no-continue`。无迁移、无新表。

### Studio 对话不锁方法（2026-10-23，本地未发布）

真源 `docs/ip-studio-dialogue-intents.md`「2026-10-23：不锁方法」。

- **受理**（`StudioDialogueService.startTurn`）：有活跃制作时也路由（显式 `skillKey` 或 `StudioSkillRouter`），平手且有活跃制作时沿用当前方法；方法与绑定制作不同 → `switchMethod`。
- **`switchMethod(userId, lockedThread, nextSkill, bound, turnId, runId)`**：唯一的切换规则，返回 `MethodSwitch(kept, events)`。同方法 → `kept=bound`；不同 → `supersedePendingApprovals` + `StudioExecutionControl.releaseForSwitch` + 清 `activeExecutionId / stage`。`StudioDialogueTurnWorker.Effects.bindSkill`（read_skill、propose_plan 换方法）在线程锁内同样调用它，并把 `ToolContext.executionId` 置空。
- **`StudioPlanExecutionService.releaseForSwitch`**：没有在生成（`inFlight==0` 且没有 submitted / running 步骤或子任务）→ `canceled`、`summaryPosted=true`；有在生成 → `paused`、`state.detachedThreadId=原线程`、`threadId=null`。`StudioPlanExecutor`：解绑的制作 `publish` 只发 `node.upsert / check.result` 到 `detachedThreadId`，暂停中不再生成时转 `canceled`；结束时清线程指针改为 `StudioDialogueService.unbindExecution(threadId, executionId)`（只在指针仍是它时清）。`create` 的画布占用检查跳过解绑的制作。
- **`ProposePlanTool`**：`planningSkill` 不再看执行锁；校验前若方案操作不全在当前方法起始阶段 → `coveringSkill`（路由结果优先，其次目录顺序第一个能覆盖的）→ `bindSkill` 切换后再校验；失败的工作记录码 `STUDIO_PLAN_NOT_READY`、文案「这份方案还没准备好，我会按你要做的内容重新整理。」，原因只进日志与模型侧结果。
- **用户可见文案**：`StudioDialogueTurnWorker.toolFailure`（`STUDIO_SKILL_OPERATION_NOT_ALLOWED / STUDIO_SKILL_LOCKED / STUDIO_PLAN_STALE`）、`StudioPlanExecutionService` 计划校验、`StudioPlanExecutionBridge.authorizeChild`、`StudioPlanSteps`、`StudioWorkflowWorker.skillPlan` 均改为人话 + `internalDetail`；前端 `userFacingError`（`studio-errors.tsx`）兜底旧记录。

