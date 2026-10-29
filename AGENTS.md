# AGENTS.md

> 给所有 AI coding agent（Claude Code、Cursor、Aider、Continue、自建 SDK agent…）的统一指引。
> Claude Code 仍然通过 `CLAUDE.md` 注入，但 `CLAUDE.md` 是本文件的 symlink —— 只需维护一份。

**Single sources of truth**

企业群发邀请（2026-10-17，已生产发布）：`EnterpriseService` 新建邀请默认 90 天、可选 365 天，可多人接受、可撤销；匿名只读 POST preview 只回企业名称/ID/有效期，accept 仍要求原产品开通及手机号。`/enterprise/invite#token=...` 注册/登录后加入，不传企业令牌到 ID 推荐关系。V59 只清理旧企业邀请和 accepted_by，不动成员/钱包/作品；旧单次逻辑不兼容。见 `docs/releases/ip-studio-enterprise-invitation-production-release-20261017.md`。后台 `/admin/platform/accounts` 的测试账号仅 SUPER_ADMIN 可管理；ID 独立 TEST_ 身份无手机号，通过两分钟一次性入口和正常 OIDC 进入 Studio。仅已验签的明确测试身份免真实手机要求，开通/RBAC/积分不变；线上已用两个独立身份验收同链接入企，未重测真实短信。约束见 `docs/test-accounts-plan.md`。

| 维度 | 真值文件 | 备注 |
|---|---|---|
| 项目结构 / 工作流 | 本文件（**AGENTS.md**） | 给 agent 看的执行约束 |
| AiAvatar/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) | v2.7（2026-05-06） |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) | v0.5.x 滚动 |
| 后端 API 契约 | [`specs/openapi.yaml`](specs/openapi.yaml) + [`specs/BUSINESS_RULES.md`](specs/BUSINESS_RULES.md) | CI 守门 |
| 子应用产品 / 设计约束 | `apps/<sub-app>/PRODUCT.md` | music / drama / celebrity 各一份 |
| 子应用技术 onboarding | `apps/<sub-app>/README.md` | 启动 / 技术栈 / 版本日志 |
| 完整文档地图 | [`docs/INDEX.md`](docs/INDEX.md) | "我想找 X 在哪" |

**核心信息（避免新 agent 反复翻仓）**：

- 后端 server: Spring Boot 3.3.5 + Java 17，port **8080**，H2 (dev) / MySQL (prod)
- 五个新 web app: **web-music**（3010）/ **web-drama**（3011）/ **web-celebrity**（3012）/ **web-aiavatar**（3013，数字资产平台 · 六类资产 **+ AI IP 工作台**）/ **web-star**（3014，明星商务工作台）
  - **web-aiavatar 一个应用两套形态（v0.190，v0.193 改判定）**：手机端 H5（480px 列 + 底部 tab 栏）与桌面面（52px 深群青顶栏 + 1120px 内容 + 无限画布）。**只有一套路由**（`(mobile)/x` 与 `(desktop)/x` 会解析到同一个 URL，Next 不允许）。
    **形态的真值是 `<html data-layout>`，CSS 与 JS 读同一个**（`src/shell/layout-mode.ts`）：用户显式选过（「我的 → 切换到电脑版」）以他为准，没选过按 `matchMedia(min-width: 960px)`。**新增桌面样式写 `html[data-layout="desktop"] xxx`，不要写 `@media`** —— 媒体查询绕过用户的选择。断点是 960 不是 1024：手机浏览器的「请求桌面版网站」会忽略 viewport meta、改用约 980px 的布局视口，卡 1024 就等于那个开关不生效（真实反馈）。
    画布那一页的设备判定是**柔性提示不是拦路**：手机上先给一屏说明，但主按钮是「仍然在手机上打开」。仍走 `dynamic({ssr:false})`，chunk 只有真进画布才下（CSS 藏起来组件照样 mount、照样下 15k 行）。原 `apps/web-ipstudio`（3015）已删除，`ipstudio.aibuzz.cn` 保留为 308 跳转。
- 管理后台 **apps/admin**（3003，已升级到 pnpm + Next 16）
- 统一账号中心 **独立仓库 [`pokocat/aibuzz-id`](https://github.com/pokocat/aibuzz-id)**（Spring Boot 3.3.5 + Spring Authorization Server，本地 `./mvnw spring-boot:run` 起 **8090**，生产 `id.aibuzz.cn`；建议 clone 到本仓同级的 `../aibuzz-id`）：全生态 OIDC 身份源（RS256 + JWKS），**v0.149 P1 落地 + 本仓 P2 接入完成，已于 2026-09-05 上线**；设计真源 [`docs/unified-identity-plan.md`](docs/unified-identity-plan.md)。**身份只有一份 uid，产品侧建档自动、开通显式，权益真值永远在产品侧**，账号中心不做任何「开通」写操作
- **账号注册邀请（2026-10-17，已发布并完成真实短信注册验收）**：关系、首建绑定与权限归 `../aibuzz-id`（README §25，V12）；Studio `/invitations` 提供本人链接生成/复制/预览、邀请人和直属记录、分页刷新，分享 `/invite/{code}` 品牌页直接输入手机号/验证码，ID 核验并签发令牌后进入 `/dashboard`。前端直连 ID，不在本仓 server 复制邀请规则或表。邀请不产生分佣/奖励，产品侧既有开通策略独立执行，见 [`docs/unified-account-referral-plan.md`](docs/unified-account-referral-plan.md)、[本地验收](docs/releases/unified-account-referral-validation-20261017.md)及[当前发布与线上验收](docs/releases/unified-account-referral-production-release-20261017.md)。
- 子产品开通 **enrollment**（v0.149）：「能进哪个子产品」的真值是 `product_enrollment` 表，**后端真拦** —— `EnrollmentGuard` 按 `X-App-Code` 请求头（或 `/api/star`→star、`/api/v1`→aiavatar 前缀）把请求映射到子产品，无 ACTIVE 开通记录 → 403 `PRODUCT_NOT_ENROLLED`，缺头 → 403 `APP_CODE_REQUIRED`；开关 `AEP_ENROLLMENT_ENFORCE` 默认 true，**只允许测试关闭**。`MeDto.platforms` 退化为 active enrollment 的兼容投影（无 enrollment 行才回落读旧 `aep_users.platforms` CSV）。激活码兑换只有一条路径（`EnrollmentService`）：**条件更新占码**（`UPDATE license_key ... WHERE status='CREATED'`，影响 1 行才继续）+ `entitlement_grant` 的 `UNIQUE(source, source_reference)` 双闸，杜绝并发兑换发两份积分；调用方指定的产品不在批次授权范围内先判后占、不烧码。契约见 `specs/BUSINESS_RULES.md` §6.0 与 `apps/server/README.md`「子产品开通（enrollment）」。
- **未绑手机号只读**（微信游客）：账号中心允许「只有微信、没有手机号」的账号登录（令牌 `phone_verified=false`），这类账号在本仓**能看不能改** —— `PhoneVerificationGuard`（挂在 `EnrollmentGuard` 之前）放行 `GET/HEAD/OPTIONS`，任何写方法一律 403 `PHONE_VERIFICATION_REQUIRED`，`error.details.bindUrl` 指向账号中心的绑定入口（由 `aep.identity.issuer` 派生，不硬编码域名）。标记由 `JwtAuthenticationFilter` 写进 `Authentication.details`：RS256 按 `phone_verified` claim（缺 claim 的旧令牌按已验证），legacy HS256 一律 `true`（游客只由账号中心的微信登录建出来，而它从不签 HS256）；标记缺失的内部服务令牌不拦。同时把本地 `aep_users.phone_verified` 按令牌回填（此前 JIT 一律写 false 且无人回填）。前端由 `AuthProvider` 注册回调，403 时整页跳 `bindUrl`。契约见 `apps/server/README.md` §3.5。
- 小程序: **apps/miniprogram**（微信小程序，AI 明星带货线消费方）
- 遗留 **apps/web**（3002，Next 14）已于 **Phase 5（2026-08-03）删除**；类型真源已全部迁至 `packages/types/src/*`，历史沿革见 `docs/VERSION_HISTORY.md`
- `ipstudio` AI IP 工作台（v0.157 起；**v0.190 并入 `apps/web-aiavatar`**，真源 [`docs/ip-studio-plan.md`](docs/ip-studio-plan.md)）：前端不再是独立 app —— 画布在 `apps/web-aiavatar/src/canvas/`、胶水在 `src/canvas-bridge/`、工作台专属代码在 `src/ip/`；`src/ip/canvas-gate.tsx` 是**柔性**设备闸（手机上先提示「电脑上更好用」，但可以选择继续打开；不打开就不下画布 chunk）。样式令牌挂 `.ip-surface` 作用域而非 `:root`（两个 app 有 30 个同名变量、约 22 个值不同，都放 :root 会互相刷掉；见 `src/styles/ip-desktop.css` 头注释）；Tailwind **只引 theme + utilities、不引 preflight**。**不新增产品码**，共用 aiavatar 开通、接口全挂 `/api/v1/ip-studio/**`。**画布是搬来的**（`basketikun/infinite-canvas`，MIT，整体 vendor 进 `apps/web-aiavatar/src/canvas`，见那儿的 README）——**从此由我们维护，上游更新要手动合；搬进来的文件尽量少改、改了留注释**，胶水都放 `src/canvas-bridge/`。画布文档 `doc` 是**客户端拥有**、服务端整存整取不改内容（形状 = `nodes[{id,type,title,position,width,height,metadata}]` + `connections[{fromNodeId,toNodeId}]` + `viewport{x,y,k}`）；节点是通用类型（图 / 文字 / 视频…），**要画什么写在节点自己的 `metadata.prompt` 里，参考图就是连进来的上游图**。生成链复用 dap（`DapMultimodalClient` / `FileStorageService` / `PromptService` / `CreditService`），prompt key `dap.ip_identity` / `dap.ip_canvas_image`，单价 `dap.ip-identity`=2 / `dap.ip-image`=8 后台可配。**出图的参考图由画布点名**（`POST projects/{id}/generate` 带 `refKeys`）—— 用户框了哪几张、蒙版编辑只针对当前这张，服务端从文档回溯猜不出来；服务端管 key 归属闸（`requireOwnedAssetKey`，非本人 key 直接 400 而不是跳过）、提示词模板、模型白名单、计价与结算。计费照 `DramaReferenceAssetService` 范式：preflight（引擎 / 提示词）在 hold 之前、整批一次 hold、单价快照进 `_exec`、每张成功 commit 后才写候选；**worker 派发必须挂在 `afterCommit`**（事务里直接派发会让 worker 查不到行、任务永远 `queued`，真联调踩过）。**画布出视频**走通用视频链（`MaterialVideoJobService` 分区 `APP_IPSTUDIO`），不是 dap 的数字人衍生视频 —— 那条要求先有 `avatarId`（必须发布之后）。**模型配置在后台不在浏览器**：`GET /v1/ip-studio/models` 的候选来自 `AiAppBinding` + `ai_app_endpoint_candidate`（同短剧线 `render/models`），用户能选模型但不能填 Key；上游那套「Key 存 IndexedDB 直连厂商」已剥掉。**签名 URL 有 TTL（1h）而画布一开半天**：文档里只存 `storageKey`，出 wire 由 `resignDocAssetUrls` 按 key 重签（节点级与 `metadata.images[]` 两处都要，漏一处就是「有的图好的有的裂」），前端图加载失败时走 `POST /assets/sign` 换新地址。**画布本地持久化已改成纯内存**（服务端唯一真值），**加载完成前不渲染画布** —— 否则画布认为项目是空的，自动保存会把服务端内容覆盖掉。**上游的插件市场已关**（默认从 CDN 拉第三方代码进页面执行；要开必须先有我方托管 + 签名 + 白名单）。发布零积分：建 `DapAvatar(path=ai, status=finalized)` + `DapLook(source=design)`，重复发布 409 `IP_PROJECT_ALREADY_PUBLISHED`。表 `ip_project` / `ip_run` 走 **V27** SQL 迁移。

- `clip` 口播视频线（v0.132）：服务端独立 clip 域供军师 BFF 通过 service token + `externalOwnerId` 调用；Scheme A 下本仓不扣军师用户积分。作品 DTO 用任务 `createdAt` 和终态 `completedAt` 分别提供开始生成/真实成片时间，发布修改项目不得篡改成片时间；`DELETE /api/me/clip/works/{id}` 会取消该项目全部活跃 job，并把项目软删进现有 30 天回收区。本人素材必须走受限 OSS V4 PostObject 单次直传 + `clip_upload_session` 持久化受理；owner + clientRequestId 唯一，HEAD 精确核验后异步深检与供应商提交，HEVC/H.265 形象视频先转 H.264/AAC，禁止因客户端超时重传或重复建任务。项目把可编辑文案 `segments` 与视觉 `shots[{startNo,endNo,role,assetId}]` 分层；`ClipShotPlan` 是报价、preflight、worker 与总装的唯一投影层。一个 shot 可让多句共用画面，但 `materialize()` 必须保留逐句 `captions[{sourceNo,text,durationSec}]`，总装按真实段音频总时长比例缩放每句时间窗、逐张叠加字幕，禁止把合并文案烧成一张两行省略图。石榴链路统一采用 **V2 音色 TTS → avatar 段 `createByVoiceV2` 音频驱动**，b-roll 与数字人段共享同一音频生成策略。`ClipCapturePolicy` 用 ffprobe 在供应商调用前硬验形象/声音素材；声音真实时长必须 `>2s`，形象视频 `>=5s`，较长时长只作质量建议。`/avatar/create` 的 `speakerId` 只是制作 demo 的选填参数，`authId` 也只在确需授权校验时选填：数字人主链必须允许一段视频直接启动 Avatar 训练，不得恢复 `CLIP_CONSENT_REQUIRED` 或先采声音硬闸。没有可用音色时，服务 best-effort 从形象视频提取原声创建基础 V2 speaker；提取/声音训练失败不回滚形象，专属声音是独立增强。数字分身必须按 `DapAvatar` 多条资产返回，项目保存精确 `avatarId/voiceId`，worker 只解析项目指定的 engineRef；新形象可复用已有 ready `DapVoice`，单个形象可独立删除，禁止静默退回最新形象。`AvatarDto.voiceSource` 必须用 `video|dedicated` 区分视频原声与用户主动补录，供端上准确展示训练进度和增强完成结果。形象 ready 即代表数字人创建完成；真正出片仍需 speaker，视频原声不可用时 preflight 引导补录。上传形象视频时 `ClipAvatarPreviewExtractor` 必须先抽取约 0.5 秒 JPEG 并写入 `DapAvatar.imageKey`，`AvatarDto.imagePreviewUrl` 返回签名地址；老记录缺图时 `view()` best-effort 回填。普通视频素材由 `ClipAssetThumbnailExtractor` 抽取独立 JPEG 到 `ClipAsset.thumbnailCdnKey`，`AssetDto.previewUrl` 对图片指向原图、对视频只指向缩略图，禁止把视频源 URL 冒充 image 预览；`AssetDto.contentUrl` 返回原始媒体短期签名地址，只供用户主动点开预览，不得用于列表自动加载。旧视频素材可在读取时 best-effort 补图，删除同步清理缩略图。模板固定片段由 admin preset asset + `tailClips.assetId` 配置，DTO 必须同步回传片段名称、秒数、封面、视频并把同一配置写入项目骨架；内置竖屏固定视频只补缺失配置。完成作品若缺缩略图，读取时从最终 MP4 补抽。该字段必须由独立 `V15` 迁移添加，禁止修改已执行的 V14 导致 Flyway 校验和漂移。微信 `tmp_*`/长哈希文件名在 DTO 层归一为可读默认名。删除全部分身时必须遍历并软删该 owner 下全部未删除的石榴 Avatar/Voice 版本，同时请求供应商删除各 engineRef，并清理原始素材和预览帧；所有石榴时效结果均先镜像我方存储，再由 `ClipAssemblyService` 归一为 720×1280 H.264/AAC、烧录逐句字幕、按 `subtitleStyle.aiWatermark` 可选烧录「AI 生成」（缺省关闭）、混 BGM、固定品牌尾卡并做亮度/响度/真峰值质量门。`AEP_CLIP_FORCE_MOCK=true` 只供不耗点数的确定性测试媒体，production/mysql 硬拒绝；测试总装仍永久烧录独立「测试演示」标识。媒体机器审核、本人素材的供应商质量实测与四平台真实代发仍是生产门槛。当前事实见 `docs/clip-avatar-video-plan.md`。
- `clip` 配音预览与段级状态红线（v0.150）：`POST|GET /api/me/clip/projects/{id}/tts-preview` 一个项目只存一份预览（表 `clip_tts_preview`，**新迁移 V26**；编号横跨 `resources/db/migration/*.sql` 与 `src/main/java/db/migration/*.java` 两处，已执行的一律不改）。`timelineHash = sha256(voiceId + 每镜 no/role/文案)`，POST 幂等（同哈希且上次非 failed 直接返回已有结果，failed 允许重排一次），GET 只认当前这版文案、旧一版一律 404 `CLIP_TTS_PREVIEW_NOT_FOUND`。合成粒度必须是 `ClipShotPlan.materialize` 的**镜头**，与出片 tts 阶段同一套切分 —— 预览听到的就是成片会用的那条音频，段编号也因此与段级状态天然对齐。音频先镜像我方存储再出**短期签名 URL**，库里只存 key，签名 URL 既不落库也不进日志。没有可用音色 / 引擎未配置 / 供应商失败 / 拿不到可镜像的音频，一律 `status:"failed"` + 明确 `errorCode`，禁止用空 URL 或静音占位冒充成功（静音 WAV 只在 `AEP_CLIP_FORCE_MOCK` 的确定性测试媒体下产生）。`credits` 恒为 0：Scheme A 下 clip 域不碰钻石账本，试听只花石榴 `validPoint`。`GET /api/me/clip/jobs/{id}` 的 `segments[{no,role,status,errorCode?}]` 是 `segmentJobsJson` 的**只读投影**，不得新增第二处真值；出片失败必须落到具体那一段（第一段没留下产物的那一段）并带 `errorCode`；worker 没写过状态时返回空数组，让调用方回落整体进度。`script/ai-rewrite` 的 `scope:"all"` 里 `text` 是**改写/生成指令**（一句话 brief，≤500 字），按模板骨架逐段生成、不改段数不改 role、不动结尾固定段；真模型仍未接入，非 mock 网关一律 503 `CLIP_SCRIPT_ENGINE_NOT_CONFIGURED`，不许拿模板句冒充生成结果。
- `clip` 成片音频红线（v0.135）：最终音轨必须经 `ClipLoudnessNormalizer` 两遍测量/归一，处理目标为 -16 LUFS / -2.5 dBTP（给 AAC 编码回弹留余量）；编码后的真实文件仍以 ≤ -1 dBTP 失败关闭并记录实测指标，禁止通过放宽质量门掩盖峰值问题。
- `clip` 预发部署运维红线（2026-08-15）：军师宿主 `/tmp` 是最大 3.7GiB 的 tmpfs，`deploy-clip-preprod.sh` 上传的时间戳 JAR 必须由远端 `trap` 在成功/失败时删除，并在下次预检时兜底清理超过 60 分钟的同类残留；禁止把 `/tmp/aistareco-clip-*.jar` 留成随发布次数增长的 Shmem 占用。
- 视频生成（v0.131）：聚算 JusuanHub `minimax-h3` 走独立媒体 Job 协议（`/media/generations` → `/jobs/{id}?model=minimax-h3` → 受保护 `/assets/{id}/content?model=minimax-h3` 镜像 OSS），Account API Key 的查询/下载必须携带模型作用域，不能按 GENERIC `/videos/generations` 调。端点 `billingMode=PER_SECOND` + 候选 `creditCostOverride=40` 表示 40 积分/秒，带货与短剧入口都必须在 hold 前按费率×时长展开；存量端点仍按次。**首帧参考图（i2v）v0.183 已接通**：聚算的图不给 URL —— 先 `POST {base}/v1/assets/input?model=<别名>`（multipart，字段名 `image`）换 `asset.assetId`，再把它放进 `createMediaGeneration` 的 `input_image_asset_id`，并把必填的 `generationMode` 从 `t2v` 改成 `i2v`。**尾帧 / 多参考图 / 544p / 六种画布 / seed 只在「视频生成区」开放（v0.199，分区 `video-studio`，真源 `docs/video-studio-plan.md`）**：入参只由 `VideoGenSpec.fromVariantConfigJson` 一处解析，`MaterialVideoJobService.submit` 的分区闸挡住别的分区夹带原生规格（首帧 key 只许 `ipstudio` / `video-studio` / `drama` —— 三处的 variant_config 都由服务端组装、写 key 前验过归属；带货素材运营的入口原样透传客户端的 variant_config，所以挡着；新增分区放行首帧前先确认它不透传）；**没有清晰度的老路径（画布 / 脚本视频 / 短剧）只按画面比例补齐**：2026-10-03 厂商把「只发 `orientation`」的竖屏默认改成了 3:4，老路径横竖两档改为也带 `aspectRatio` + `outputSizeCode`（取值同视频生成区，#120），1:1 仍只发 `orientation`（`square` 这个值厂商认，视频生成区 10-03 真厂商实测出了 768×768）；除此之外字段不变，其它产品线仍只有首帧，候选的 `supportsFirstLastFrame` 对它们照旧是 false。非聚算协议的首帧 key 经 `FileStorageService.upstreamFetchUrl`（签名优先）交给厂商，不再静默丢。调用方自己定价（item 带 `credit_cost`）的任务 payload 标 `caller_priced`，管理端对账按冻结价结算。视频生成区的价格是**我们自己定的**（平台配置 `celebrity.video-studio-pricing`，每格 = 配置 ?? 候选每秒价（>0 才算）?? 未定价 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`），不照搬厂商价；智能优化走厂商 `/media/prompt-optimizations`（同步但最长约 10 分钟，`Idempotency-Key` = `clientRequestId` = 我方记录 id，重试必须同键同正文），**状态迁移与积分结算必须在同一个事务里**，派发挂 `afterCommit`。上传失败一律抛（`VIDEO_REF_UPLOAD_FAILED`），**不静默退回 t2v** —— 用户接了参考图却出一条无关的片，比直接报错难排查得多（§8.0）。误判失败但已有 `externalTaskId` 的任务只能走管理端对账恢复，禁止重新提交。**成片封面**（v0.199.1）：厂商不给（聚算 H3 就不给）时 worker 从成片截一帧（`MaterialVideoCover`，best-effort，截不出不影响出片与结算），视频生成区的老任务启动时后台补（`MaterialVideoCoverBackfill`）。**H3 出片前默认改写提示词**（2026-10-20，本地未发布）：生成接口的 `optimizePrompt` 缺省开启、受理后才改写，改写结果在查询响应 `promptOptimization.effectivePrompt`；worker 存进 `payload_json.vendor_prompt`，解析 / 投影只在 `VideoPromptRewrite`。任务没有 `optimization_id` 不代表没被改写（那是视频生成区自己的「智能优化」）。Studio 关闭「智能优化」与视频生成区用了智能优化的生成发 `optimizePrompt:false`；写在描述里的「图1 / 尾帧」不会绑定图片。见 `docs/ip-studio-video-modes.md` 末节。

---

## 1. 仓库形态 & 进度

### 当前结构

```
Aisingerecosystem/
├── apps/
│   ├── server/             # 后端：Spring Boot 3.3.5 (Java 17) — port 8080
│   ├── admin/              # 管理后台：Next.js 16 / React 19 — port 3003（pnpm workspace）
│   ├── miniprogram/        # AI 明星带货 · 微信小程序
│   ├── web-music/          # AI 音乐人（Next 16 / React 19 / Tailwind v4）— port 3010
│   ├── web-drama/          # AI 短剧（同上）— port 3011
│   ├── web-celebrity/      # AI 明星带货（同上）— port 3012
│   ├── web-aiavatar/       # 数字资产平台（六类资产）+ AI IP 工作台（无限画布）— port 3013
│   │                       #   src/canvas/ vendored 画布 · src/canvas-bridge/ 胶水 · src/ip/ 工作台专属
│   ├── web-star/           # 明星商务工作台（明星/经纪团队审核中枢，浅色主题）— port 3014
├── packages/               # pnpm workspace 共享包（新代码真源）
│   ├── types/              # @ai-star-eco/types（22 域类型定义）
│   ├── ui/                 # @ai-star-eco/ui（48 shadcn + ThemeProvider + globals.css）
│   ├── api-client/         # @ai-star-eco/api-client（apiFetch + AuthProvider + format）
│   └── landing/            # @ai-star-eco/landing（ProductLanding 原语）
├── specs/                  # 后端契约（openapi + 业务规则）
├── docs/                   # 跨应用文档：根 = 现行设计真源 + INDEX + VERSION_HISTORY
│   ├── runbooks/           #   运维 / 联调操作手册
│   ├── audits/             #   带日期的一次性审计 / 调研报告
│   ├── archive/            #   已落地或已被取代的方案、关闭的 TODO 段（只读历史）
│   ├── releases/           #   发布与验收记录（上线制品、线上 / 本地验收证据）
│   ├── design/             #   子应用视觉系统与设计稿（celebrity / studio）
│   └── prototypes/ prompts/ training/  # 设计原型说明、可复用提示词、操作培训
├── figma/                  # ⚠️ Figma Make 一次性导出，仅 UI 原型参考
└── .claude/skills/         # AI agent 技能（figma-migrate 等）
```

### Monorepo 拆分进度（Phase 0a → 6）

仓库从「单 apps/web + 单 apps/admin + 单 apps/server」拆为「三个独立 web app + packages/* 共享层 + 共享 server（按子产品分租户）」；apps/web 已于 Phase 5 删除。

| Phase | 状态 | 描述 |
|---|---|---|
| **0a-b** | ✅ | pnpm workspace 脚手架（根 `package.json` + `pnpm-workspace.yaml` + `.npmrc`） |
| **1** | ✅ | 四个共享包就位（types / ui / api-client / landing）且 typecheck 全绿 |
| **2-4a** | ✅ | 三个新 web app shell + landing 全部 dev HTTP 200 |
| **4b** | ✅ | celebrity-zone 33 组件从 apps/web 迁入 web-celebrity；music / drama / celebrity 三端统一 `(workspace)` route group + 顶层语义化路径 |
| **v0.7** | ✅ | mixcut 内嵌为 web-celebrity 的「混剪专区」子功能（7 页 / 12 个 UI 原语 / Tailwind v4 brand-* 映射） |
| **v0.8** | ✅ | mixcut 真后端落地（Spring Boot @Async + ffmpeg 实拼接 / 实贴图 / 实剪切；不再 mock） |
| **v0.13** | ✅ | 扰动贴图池（preset GIF + DataInitializer 自动 seed + ffmpeg -stream_loop -1 overlay）+ MixcutController 安全前置（Principal 校验） |
| **v0.14** | ✅ | CdnUploader 抽象 + LocalFakeCdnUploader（./cdn-mock → /cdn）+ MixcutRenderOutput.cdnUrl 列 + 渲染后串行上传 |
| **v0.15** | ✅ | 混剪 → 发布桥接（/api/me/mixcut/publish-batch）+ @Scheduled 定时发布 + 三入口（jobs 详情按钮 / distribution 跳转 / /mixcut/publish 工作台） |
| **v0.17** | ✅ | 社交账号绑定 profile 落库（昵称 / 平台账号号 / 头像），sau-service 各平台 driver 独立提取 |
| **5** | ✅ | 删除 `apps/web`（2026-08-03；三新 app 已验证完整，无残留代码依赖） |
| **6** | ⏳ | server 按子产品分租户（DB migration 级别） |
| **Cookie SSO** | ❌ 改判 | 全域共享 cookie 方案作废（只能解决 5 个 web app 互认，解决不了跟军师 / 公社互认，且任一子站点 XSS 波及全生态）。由 **统一账号中心** 取代，见下行 |
| **统一账号中心** | ✅ P1+P2（v0.149，2026-09-05 上线） | 独立仓库 `pokocat/aibuzz-id`（OIDC，`id.aibuzz.cn`；初版代码曾在本仓 `apps/id-server` 孵化，v0.149 同日抽离）+ 本仓全部应用接入；P3 军师 / P4 公社 / P5 收尾见 [`docs/unified-identity-plan.md`](docs/unified-identity-plan.md) §9 |
| **apps/admin 升级** | ✅ | Next 16.2.6 + React 19，纳入 pnpm workspace |

### 技术栈分代（**重要**）

| 代次 | 仓 | 栈 |
|---|---|---|
| 新代码 | `packages/*` + `apps/web-{music,drama,celebrity,aiavatar,star}` + `apps/admin` | Next **16.2.6** + React **19** + Tailwind **v4** + **pnpm** |
| 后端 | `apps/server` | Spring Boot 3.3.5 + Java 17 |
| 小程序 | `apps/miniprogram` | 微信小程序原生 |

> `apps/web`（Next 14.2 + React 18 + npm）已于 Phase 5（2026-08-03）删除，不再是代次之一。

### Next 16 必知陷阱（新 app 写代码前必读）

- **中间件文件名 `proxy.ts`**（不是 `middleware.ts`，v16 重命名）
- **`cookies()` / `headers()` / `params` / `searchParams` 都是 Promise**，必须 `await`
- 客户端组件读 `params` 用 `use(params)` (React 19) 或拆 server outer + client inner
- 新 app 不属 workspace 时不要混 npm/pnpm；`pnpm-workspace.yaml` 纳入 `packages/*`、五个 web app、`apps/admin`
- **要在首帧之前跑的内联脚本，用裸 `<script>` 放 `<body>` 第一个子节点**，不要用 `next/script` 的 `beforeInteractive`（v0.193 实测）：后者先把脚本推进 `self.__next_s` 队列，等 app bootstrap 起来才真正插进 head —— 那时 `document.readyState` 已经是 `interactive`、应用标记全解析完了，很可能已经按错的形态画过一帧。裸 script 量到的是 `readyState: "loading"`。放 `<html>` 直下会报 hydration error（`<script>` 不能是 `<html>` 的子节点），放 `<body>` 里干净无报错；加 `async` 能消掉报错但也就不保证首帧前执行了

### Auth 多域规划

同根域名 + 四子域名（music.aibuzz.cn / drama.aibuzz.cn / celebrity.aibuzz.cn / aiavatar.aibuzz.cn）+ cookie sharing（domain=.aibuzz.cn）。当前 dev/local 走子端口而非子域名。

---

## 2. Daily Commands

**统一认证接入必读 SOP**：[`../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md`](../aibuzz-id/docs/INTEGRATION-GUIDE-FOR-AGENTS.md)
§7.9 / §10.6。登录成功之外，必须验证本人/后台昵称头像手机号、手机号搜索、服务端分页、换绑缓存失效、存量用户和本地重启登录；
完整手机号仅从获 phone 授权的 `/userinfo` 获取并核对 UID，不能把 `phone_verified` 当号码，也不能改变钱包/开通。

### 飞书 CLI

- 已配置飞书 CLI app：`cli_aaa471e87738dbdb`（brand: `feishu`）；后续先跑 `lark-cli doctor`，不要重复 `lark-cli config init --new`；禁止记录 `appSecret` / access token / refresh token。

### 后端 Spring Boot

```bash
cd apps/server
./mvnw spring-boot:run                                    # dev profile，H2 in-memory，seeds on boot
./mvnw spring-boot:run -Dspring.profiles.active=mysql     # MySQL profile
./mvnw compile -q -o                                      # 离线编译检查（快）
./mvnw test                                               # JUnit
./mvnw -Dtest=ClassName#method test                       # 单测
```

### pnpm workspace app（根目录运行）

```bash
pnpm install                                  # 装所有 workspace 依赖
pnpm dev:music                                # web-music — http://localhost:3010
pnpm dev:drama                                # web-drama — http://localhost:3011
pnpm dev:celebrity                            # web-celebrity — http://localhost:3012
pnpm dev:aiavatar                             # web-aiavatar — http://localhost:3013
pnpm dev:star                                 # web-star — http://localhost:3014
pnpm dev:admin                                # apps/admin — http://localhost:3003

pnpm typecheck:all                            # workspace 一次性 typecheck
pnpm --filter @ai-star-eco/web-celebrity typecheck    # 单个 app typecheck
pnpm --filter @ai-star-eco/web-aiavatar typecheck      # AiAvatar app typecheck
pnpm typecheck:admin                                  # admin typecheck
pnpm --filter @ai-star-eco/web-celebrity build        # 单个 app 生产构建
pnpm --filter @ai-star-eco/web-aiavatar build         # AiAvatar app 生产构建
pnpm --filter @ai-star-eco/admin-new build            # admin 生产构建
```

### 编译门（提交前必须全绿）

```bash
pnpm typecheck:all && \
pnpm typecheck:admin && \
(cd apps/server && ./mvnw compile -q -o) && \
pnpm check:api-contract                          # 扫五个子应用 + api-client
```

---

### 生产发布顺序（2026-10-20）

用户要求：改完先合入 `main`，再发布。功能分支完成后合入主线，保留 `main` 已有功能，解决冲突并通过检查；仅从干净的 `main` 构建正式制品。不得从落后于主线的功能分支直接覆盖生产。发布记录须写明构建所用的 `main` 提交、服务范围和线上验收结果。

## 3. 三端架构

### 数据流转

```
┌─────────────┐    rewrite /api/*    ┌──────────────────────────────┐
│  web-music  │ ──────────────────→ │                              │
│  web-drama  │                      │  Spring Boot server :8080   │
│  web-       │                      │                              │
│  celebrity  │                      │  /api/auth/*    permitAll    │
│  web-       │                      │  /api/me/*      authenticated │
│  aiavatar   │                      │  /api/aiavatar/health/** permitAll │
│  web-star   │                      │  /api/aiavatar/** authenticated │
└─────────────┘                      │  /api/celebrity/*            │
                                     │  /api/mixcut/*  (v0.8 新增)  │
┌─────────────┐    rewrite /api/*    │  /api/admin/*   SUPER_ADMIN  │
│ admin (3003)│ ──────────────────→ │                  / OPERATOR  │
└─────────────┘                      │                              │
                                     │                              │
┌─────────────┐  wx.request /api/*   │                              │
│ miniprogram │ ──────────────────→ │                              │
│ (微信小程序)  │                      │                              │
└─────────────┘                      └──────────────────────────────┘
```

- 前端通过 `next.config.mjs` 的 `rewrites` 把 `/api/*` 转发到 8080
- 静态文件（如 mixcut 渲染产出 `/static/mixcut/*`）也由 server 暴露 + 前端 rewrite
- 认证：Spring Security + JWT（JJWT 0.12.6），无状态 session
- 小程序通过 `wx.request` 直接调 `apiBaseUrl + /api/*`

### Mock vs Live 切换

所有前端走 `.env.local` 的 `NEXT_PUBLIC_USE_MOCK`：

- `=1` → `api/*.ts` 顶部 `if (USE_MOCK)` 分支命中，使用 `mocks/*.ts` 静态数据，无网络
- `=0` → 走 `apiFetch` → Next rewrites → server

**陷阱**：组件做默认视图渲染时应**直接 `import { DATA } from "@/mocks/xxx"`**，不要走 `api/*`；后者在 USE_MOCK=0 但 server 没起时会 404。

**个别模块独立开关**：v0.8 mixcut 加了 `NEXT_PUBLIC_MIXCUT_USE_REAL=1`，可在 USE_MOCK=1 时仅让 mixcut 走真后端，不影响其他模块。

---

## 4. 硬规则（违反会 break）

### 4.1 类型真值源

- **前端 TS 是契约真源**：`packages/types/src/*`
- Spring `*Dto.java` record 字段名**必须与 TS interface 完全一致**
- JPA entity 字段名可以不同，由 DTO `from()` 方法做映射
- enum 出 wire 时**全小写**：Java `ACTIVE` → JSON `"active"`；含连字符用 `wire` 字段
- admin types 与 web types **保持一致**（直接复制）；admin 独有字段用 `interface AdminXxx extends Xxx`

### 4.2 积分账本不可变

所有钱包余额变动**必须经 `LedgerEntry`**（不可变账本）：

- **禁止**直接 `UPDATE wallet SET balance = ...`
- `total_balance = license + recharge + gift`（`pending` 桶不计入）
- 实现见 [`apps/server/src/.../aep/service/CreditService.java`](apps/server/src/main/java/com/aistareco/aep/service/CreditService.java)

### 4.3 API 响应壳

```
单资源       → { success: true, data: T, message?: string }     # ApiResponse<T>
分页列表      → { success: true, data: T[], pagination: {...} } # PageEnvelope<T>（不嵌套 ApiResponse）
```

`apiFetch` 自动解包 `data`；调用方拿到 `T` / `T[]`。失败 `{ success: false, error: { code, message } }`。

### 4.4 安全模型

```
/api/auth/**               → permitAll（注册 / 激活）
/api/admin/auth/login      → permitAll（管理员登录）
/api/me/**                 → authenticated（JWT；controller 必须校验 ownerUserId == principal.id）
/api/star/**               → authenticated（v0.60 明星商务工作台；controller 按 StarAccount 绑定校验归属）
/api/admin/**              → hasAnyRole("SUPER_ADMIN", "OPERATOR")
/api/internal/**           → hasRole("INTERNAL")（X-Internal-Secret 校验）
其他                        → permitAll
```

Dev 种子账号（[`DataInitializer.java`](apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java)）：

- `admin / admin123` — SUPER_ADMIN
- `operator / operator123` — OPERATOR
- `finance / finance123` — FINANCE_ADMIN（v2 §9 资金面 + 大额复核；dev 由 `ensureFinanceAdminSeed` 幂等补）

> 角色拆分进度：`FINANCE_ADMIN` **已落地**（`AdminUser.AdminRole` enum + `AepSecurityConfig` authority + seed `finance/finance123` + `apps/admin/src/types/account.ts` + **v2 §6 资金财务控制台**：nav `roles` 门控 + `useAdminRole` 归一 + 资金面 controller `@PreAuthorize`）；曾计划的 `PLATFORM_OPERATOR` **已于 v0.31 反向决策不拆**（改在 `aep_users` 加 `operatorRole` 复用现有命名），别再按「待拆」处理。

### 4.5 数值字段

存原始整数，格式化在展示层（`packages/api-client/src/format.ts`）：

```
fans: 128_000          → formatCompactNumber → "128K"
revenue: 452_000       → formatCredits        → "452,000"
priceCents: 9_900      → formatCurrency       → "¥99.00"
duration: 7820         → formatDuration       → "2h 10min"
```

**禁止**类型定义里用预格式化字符串（如 `fans: "128K"`）。

### 4.6 中文单语

前端文案全部中文。删除 `{ zh: 'X', en: 'Y' }` 字典和 `lang === 'zh' ? ... : ...` 三元。Legacy `src/translations.ts` 已 tombstoned。

### 4.7 资产存储默认 OSS（v0.47+ 强制）

**所有持久化的「资产 / 文件 / 媒体」（图片、音频、视频、模型文件、PDF、用户上传素材、AI 生成产出等）
在生产环境的真值存储必须是阿里云 OSS**，不再写 ECS 本机文件系统。本机仅作短时临时区
（ffmpeg / Python 子进程中转）+ dev/local 联调 fallback。

**实现规则**：

1. **新增任何资产字段必须经 `CdnUploader`**。新代码不允许直接写 `/data/...` / `./xxx-assets/`
   做长期存储；ECS 本机目录只允许做 ffmpeg 渲染 / Python worker 子进程的临时工作区
   （tmp dir / pre-upload staging），完成后调 `cdnUploader.upload(...)` 推到 OSS，
   DB 存 OSS key + 派生的 CDN URL。

2. **生产用 OSS，dev fallback 本地**。统一靠 `aep.cdn.driver`：
   - `aep.cdn.driver=oss` → 注入 `AliyunOssCdnUploader`，所有 `cdnUploader.upload(...)`
     落 OSS；URL 出 wire 时经 `CdnUrlSigner` 加时效签名（防流量盗刷）。
   - `aep.cdn.driver=local`（默认 / dev / 未配 OSS） → 注入 `LocalFakeCdnUploader`，
     文件落 `./cdn-mock/`，URL 形如 `/cdn/<key>`（server 自带静态 mount）。
     上游业务代码完全不感知差异 —— 这就是 fallback 的实现位置。

3. **生产 server.env 必须**：
   ```
   AEP_CDN_DRIVER=oss
   AEP_CDN_OSS_BUCKET / ENDPOINT / ACCESS_KEY_ID / ACCESS_KEY_SECRET / BASE_URL
   AEP_CDN_OSS_KEY_PREFIX=media               # 多业务共享 bucket 时按前缀隔离
   AEP_CDN_SIGNED_URL_STRATEGY=cdn            # 防 hot-link 流量盗刷
   AEP_CDN_SIGNED_URL_TTL_SECONDS=3600
   AEP_CDN_SIGNED_URL_CDN_AUTH_KEY=<...>      # Aliyun CDN URL 鉴权 Type A
   ```
   未配 `AEP_CDN_DRIVER=oss` 的生产实例 = **配置错误**（启动会 WARN，但不阻断；
   线上巡检脚本应将 `aep.cdn.driver=local` 视作部署事故 P1）。

4. **DB 真值是 key，URL 是派生值**（v0.47F+ 强制规则）。
   所有 OSS-bound 资产字段的真值是「OSS object key」，URL 是出 wire 时由
   `CdnUrlSigner.signKey(cdnKey)` 实时构造的派生值，**不**作为 DB 真值。
   - **新增字段必须**：`cdnKey VARCHAR(512) NOT NULL`；不要再加 `cdnUrl` 列
   - **DTO 出 wire**：`signer.signKey(o.getCdnKey())` → 返回签名 URL；signer 失败/NOOP 时
     才退到 fallback（读老 `cdnUrl` 列）
   - **写库**：`cdnUploader.upload(...)` 返回 `CdnUploadResult.key()` 作为真值落库；
     `cdnUrl` 字段在过渡期内可双写但不再依赖
   - **不允许把裸 `https://cdn.xxx.cn/...` 直接塞进 response body** —— 必须经 signer

   收益：driver 切 local↔oss / CDN 域名换 / key-prefix 调整 → DB 零迁移，自动适配。

5. **DTO 出 wire 必经 `CdnUrlSigner`**。所有新增的 DTO 字段如果暴露资产 URL：
   - 在 DTO 工厂方法签名里加 `CdnUrlSigner signer` 参数
   - 优先 `signer.signKey(cdnKey)`（key → 派生 + 签名）；老 row 缺 cdnKey 时
     fallback `signer.maybeSign(storedUrl)`（URL → 抽 key → 重签）
   - 调用方（service）注入 `CdnUrlSigner` Bean
   - 当前已落地：`MixcutRenderOutputDto.from(o, mapper, signer)` 走 cdnKey 优先

6. **现有「local-only」字段必须分阶段迁移到 OSS**（按 §4.7.4 key-only 规则）：
   - `MixcutAsset.fileUrl`（用户上传素材，当前 `/static/mixcut-assets/...` 本地）
   - `MaterialVideoJob.videoUrl`（素材运营生成视频）
   - ~~AiAvatar 数字人资产~~ ✅ 已合规（2026-06-10 审计：dap 域全部走 `FileStorageService`
     —— DB 存 key、`cdn.upload()` 推 CDN、出 wire 经 `storage.signedUrl()` 签名；
     无任何绕过 FileStorageService 的直接文件写入。仓库无 `AiAvatarAsset` 实体，
     真实实体为 `DapAvatar` / `DapLook` / `DapDerivative` 等 `dap_*` 表）
   - `ForgeResult` 视频 URL

   迁移姿势：业务 service 在 `upload(...)` / `save(...)` 时调 `cdnUploader.upload(...)`，
   返回的 `CdnUploadResult.key()` 落 DB 的 `cdnKey` 列；DTO 出 wire 时由 signer 派生 URL。
   旧本地路径字段保留一两版做 fallback 读，然后删。

7. **wholesale JSON 文档（`payloadJson` 等）里的资产 URL 出 wire 必须重签**（v0.98 教训，**强制**）。
   当资产 URL 不是独立 DTO 字段、而是塞在一个整存整取的 JSON 文档里（如 `DramaProject.payloadJson`
   的 `frameUrls` / `videoUrl` / `endFrameUrl` / `lastFrameUrl` / 场景图 / 角色图；`DramaShort` 同理），
   **签名 URL 有 TTL（`AEP_CDN_SIGNED_URL_TTL_SECONDS`，默认 3600s）；存下来原样返回 → 1h 后签名过期
   → 403 图裂**。这类文档字段容易绕过 §4.7.4/§4.7.5（那两条针对 DTO record/列），必须额外守：
   - 文档里存的 URL 一律视为「非真值、会过期」，**禁止**原样 `return`。
   - service 在**出 wire 的唯一漏斗**（如 `toDetail`）里对整棵 JSON **递归 `signer.maybeSign(...)`
     重签所有资产 URL**（`maybeSign` 从 URL 反抽 key 重签，对已过期 URL 同样有效）；driver=local 的
     相对 `/cdn` 路径不匹配 OSS base → 原样返回，dev 不受影响。范式见 `DramaProjectService.resignAssetUrls`。
   - 新代码首选：文档里存 **cdnKey** 而非 URL，出 wire 时 `signer.signKey(key)` 派生。

6. **本地短时临时区必须 gitignored 且不进备份**。当前已 ignore：
   - `apps/server/mixcut-assets/` / `mixcut-output/` / `mixcut-work/`
   - `apps/server/dh-assets/` / `dh-work/`
   - `apps/server/aiavatar-assets/` / `aiavatar-work/`
   - `apps/server/cdn-mock/`（dev fake CDN）

   新增临时目录默认按这条规则 gitignore，**不要 commit 任何资产文件到 git**。

**Review reject 规则**：

- PR 中出现 `Files.copy(... new File("/data/..."))` / `new FileOutputStream("./xxx-assets/...")`
  并把 path 落 DB 当 wire-out URL 用 → review reject，要求改 `cdnUploader.upload(...)`。
- DTO `record` 里直接落 `https://cdn.xxx.cn/...` 字符串且未经 `CdnUrlSigner` →
  review reject，要求改 `signer.signKey(...)` 派生（首选）或 `signer.maybeSign(...)` 重签。
- 新增 entity 加 `cdnUrl` 列（不带 `cdnKey`）→ review reject，要求把 key 列做真值，
  URL 改为 DTO 出 wire 时派生（v0.47F+ key-only 规则，§4.7.4）。
- 配置生产部署但 `AEP_CDN_DRIVER=local` 或缺 `AEP_CDN_SIGNED_URL_STRATEGY` →
  review reject，要求补 OSS 配置。
- service 把 `payloadJson` / JSON 文档里存的签名 URL 原样 `return`（未在出 wire 漏斗里
  `signer.maybeSign(...)` 递归重签、或未改存 cdnKey 派生）→ review reject（签名 TTL 过期会图裂，
  v0.98 教训，§4.7.7）。

### 4.8 时间字段（v0.194+ 强制）

**wire 上是 ISO 8601，展示统一 `yyyy-MM-dd HH:mm:ss`。** 与 §4.5「存原始值、格式化在
展示层」是同一条道理的另一半。

- **服务端**：DTO 出 wire 一律给 ISO 字符串（`Instant.toString()` / `OffsetDateTime`），
  **不发预格式化的展示串**。dap 域的 `updated` 是历史例外（服务端算好中文），
  新字段不许再这么加。
- **前端**：一律 `formatDateTime()`（`apps/web-aiavatar/src/lib/datetime.ts`，
  按浏览器本地时区），**禁止**页面自己拼。
- **禁止相对时间**（「刚刚 / 3 小时前 / 昨天 / 上周」）。它读着轻快，但跨了四个精度档，
  同一列里两条记录没法比先后；而且对账、报障、跟同事说是哪一版，都得先在脑子里换算。
- **禁止 `iso.slice(0, 10)`**。它切的是 **UTC** 那一段 —— 晚上八点之后落库的东西
  在 +08 的页面上显示的是**前一天**。这个 bug 在四个页面上活了很久没人发现，因为
  「看起来是个日期」。
- **mock 数据必须与服务端同形**：服务端发 ISO，mock 就发 ISO；服务端发格式化串
  （dap 那种），mock 就发同格式的串。此前 mock 写「3 天前」而线上发的是别的东西，
  演示模式和真实模式长得不一样。

Review reject：新 DTO 字段发预格式化时间串 / 前端页面自己拼时间 / 出现
`slice(0, 10)` 或「N 分钟前」/ mock 与服务端时间形状不一致 → reject。

---

## 5. 新增领域 SOP

新增领域 `<domain>` 必须按以下顺序操作（前端真源先定，后端再 mirror，契约文档最后同步）：

### Step 1 — 前端真源

```
packages/types/src/<domain>.ts                        ← 类型定义（唯一事实源）

[归属子应用 apps/web-<music|drama|celebrity|aiavatar|star>]
src/mocks/<domain>.ts                                 ← USE_MOCK=1 时的样本
src/constants/<domain>-ui.ts                          ← UI 配置（图标 / 颜色 / 文案）
```

### Step 2 — 前端调用层

```
apps/web-<sub-app>/src/api/<domain>.ts                ← apiFetch + USE_MOCK 开关
apps/web-<sub-app>/src/api/index.ts                   ← 追加 `export * as XxxApi`
```

### Step 3 — 后端 mirror（字段名必须 1:1 匹配 TS）

```
apps/server/.../aep/model/<Entity>.java               ← JPA 实体
apps/server/.../aep/dto/<Entity>Dto.java              ← DTO record，字段名 = TS
apps/server/.../aep/repository/<Entity>Repository.java
apps/server/.../aep/controller/<Domain>Controller.java
```

### Step 4 — admin 镜像（URL 前缀 `/admin/`）

```
apps/admin/src/types/<domain>.ts      ← 与归属子应用同名同字段（直接复制）
apps/admin/src/mocks/<domain>.ts
apps/admin/src/api/<domain>.ts        ← URL: /admin/...
apps/admin/src/api/index.ts
```

### Step 5 — 契约文档（CI 强制）

```
specs/openapi.yaml                    ← components.schemas 加 schema；paths 加 path
specs/BUSINESS_RULES.md               ← 可选：openapi 表达不了的约束（扣费、状态机、跨字段）
```

> v2.7 起取消"契约 diff 文档"。drift 由 [`scripts/check-api-contract.mjs`](scripts/check-api-contract.mjs) 守门（**v0.57 起**改扫四个活跃子应用 `web-{music,drama,celebrity,aiavatar}` + `packages/api-client`，方法级匹配；aiavatar 的 `/api/v1` 前缀已处理；Phase 5 起 `apps/web` 已删除，不再需要排除）—— 任一 `apiFetch(...)` 的 URL/method 在 openapi.yaml 找不到对应 path → gate fail。根目录跑 `pnpm check:api-contract`。

### Step 6 — 四门验证

```bash
pnpm typecheck:all
(cd apps/admin && npx tsc --noEmit)
(cd apps/server && ./mvnw compile -q -o)
pnpm check:api-contract
```

> 对于 Figma 原型变更（新页面 / 新组件），调 [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) 技能。它把上述六步包成 web → admin → server 同步 SOP。

---

## 6. 五个 web app 子产品

每个子产品独立 brand / 路由 / 业务领域，但共享 server + 共享 packages 层。

| 子产品 | 路径 | Port | 产品规格 | 设计约束 | 主入口 |
|---|---|---|---|---|---|
| **AI 音乐人** | `apps/web-music/` | 3010 | [`apps/web-music/PRODUCT.md`](apps/web-music/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 短剧** | `apps/web-drama/` | 3011 | [`apps/web-drama/PRODUCT.md`](apps/web-drama/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AI 明星带货** | `apps/web-celebrity/` | 3012 | [`apps/web-celebrity/PRODUCT.md`](apps/web-celebrity/PRODUCT.md) | 同 PRODUCT.md | `/dashboard` |
| **AiAvatar · 数字资产平台** | `apps/web-aiavatar/` | 3013 | [`apps/web-aiavatar/PRODUCT.md`](apps/web-aiavatar/PRODUCT.md) | [`apps/web-aiavatar/DECISIONS.md`](apps/web-aiavatar/DECISIONS.md) | `/`（移动端 SPA） |
| **明星商务工作台** | `apps/web-star/` | 3014 | [`apps/web-star/PRODUCT.md`](apps/web-star/PRODUCT.md) | 同 PRODUCT.md §4 | `/dashboard`（浅色桌面端） |
| **AI IP 工作台** | `apps/web-aiavatar/`（同上，≥1024 的桌面面） | 3013 | [`apps/web-aiavatar/PRODUCT.md`](apps/web-aiavatar/PRODUCT.md) | [`docs/ip-studio-plan.md`](docs/ip-studio-plan.md) · [`DESIGN-desktop.md`](apps/web-aiavatar/DESIGN-desktop.md) | `/projects`（桌面无限画布；与数字资产平台同一份开通、同一个应用） |

前三个业务 app 路由形态一致：

```
/                          ← 公开 landing（ProductLanding，postLoginPath="/dashboard"）
/login                     ← 公开
/activate                  ← 公开
/dashboard …               ← 工作台（route group `(workspace)`，不出现在 URL）
```

详见各 PRODUCT.md。

---

## 7. 版本增量历史

> 详尽的连续多版本增量日志（新实体 / 路由 / 决策 / 注意事项）已拆分到 [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md)。本节仅保留**当前态运营要点**和**最近 5 版的一句话摘要**；查具体版本细节请打开 VERSION_HISTORY.md。

### admin sidebar 启用状态（当前）

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / **资金财务**（v2 §6：FINANCE_ADMIN 专属 —— `/finance` 控制台 + 充值订单/退款/对账/结算/异常风控/充值套餐，OPERATOR 看不到且后端 403）/ **积分运营**（OPERATOR 可见：调差/赠送）/ Notifications / Audit / 平台 > AI 模型 / Prompt 管理 / Agent 平台 / 销售渠道 / 后台管理员 / 账号登录日志 / **统一登录接入**（v0.195，只读）。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

**未完成事项**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、统一账号中心 P3–P5 接入（P1+P2 已于 2026-09-05 上线，见 `docs/unified-identity-plan.md`）、K8s ACK（Phase 6）。

### 近期版本速览（**只留最近 5 版一句话**；任何版本的细节都在 [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md)）

| 版本 | 日期 | 一句话 |
|---|---|---|
| **场景化首页与 AI 图片 / AI 视频** | 2026-10-29，本地未发布 | 参考茂隆掌柜 AI：登录后桌面改左侧导航栏；首页一句话开始 + 常用工具 + 「你想做什么？」+ 灵感搬到首页；`/image` 按场景一步出图（只显示场景标签 + 补充要求，草稿即画布），`/video` 照参考站「超级编导」：编导看素材写分镜脚本、可改稿，「用这个脚本生成」选模型时长确认后出片；两页场景由后台「Studio 场景模板」配置（`studio.scene-catalog`）；见 `docs/studio-scene-creation.md` §8–§9 |
| **新建画布与多段对话** | 2026-10-20，2026-10-21 已生产发布 `20261021-studio-new-canvas-threads` | 新建统一走 `startNewCanvas()` 直进画布、空画布中间给五个入口；助手加「新对话 / 历史对话」（三个接口，无迁移）；方案与确认卡合成一张、只说做什么花多少，完成总结一句话；见 `docs/ip-studio-new-canvas-and-threads.md` |
| **对话意图直达** | 2026-10-20（已生产发布 `20261020-studio-dialogue-intents`） | Studio 助手按意图落到出图 / 写剧本与文案 / 出视频 / 复刻四个技能，直达技能一轮一张确认卡、平手不再 400、按任务换技能，见 `docs/ip-studio-dialogue-intents.md` |
| **v0.207** | ✅ 本地，未发布 | Studio创作首页：主要功能直达、近期画布/模板、想法保存与原项目恢复；品牌保留，见 `docs/ip-studio-home.md` |
| **v0.206** | 2026-10-08 | Studio 界面区域分离、响应式工具/生成面板；人物库/添加/引用/商品/模板选择统一，精确版本回填与取消恢复；本地未发布，见 docs/audits/ip-studio-ui-audit-2026-10.md |


> **这张表刻意只留 5 行。** 它曾经堆到 110 行、占掉 AGENTS.md 的 **64%** —— 而本文件每个
> session 都会被注入上下文，等于每次都为一份别处已有的版本日志付一遍 token。
> 发新版时：详情写进 `docs/VERSION_HISTORY.md`，这里加一行、删最老那行。
> 查任何版本：`grep '^### v0.XXX' docs/VERSION_HISTORY.md`。

## 8. 约定与陷阱（违反会 review reject）

### 8.0 生产模式禁止静默降级（v0.51+ 强制，全仓适用）

> 背景：dap 占位生成曾出现「未配 AGNES_API_KEY → 默默产出灰底剪影占位图 + 照常扣费」；
> 卖点提取曾「AI 失败 → 默默返回规则模板假文案」。生产环境绝不允许这类行为。

**硬规则**：任何依赖外部服务 / 凭据的业务能力（大模型、OSS、短信、支付、渲染引擎、
sau-service…），当依赖**未配置**或**调用失败**时，在生产 profile（mysql / prod）下
**禁止**自动回退到 mock / 占位产物 / 规则模板 / 本地实现。必须二选一：

1. **启动期 fail-fast**：配置缺失即拒绝启动（如 `JwtUtil` / `AepCryptoUtil` 生产拒绝
   dev 默认密钥；`CdnUrlSigner` strategy=cdn 缺 auth-key 拒启）。适用于「没有它服务
   就不该跑」的硬依赖。
2. **请求期明确报错**：对用户动作抛**带错误码**的 4xx/5xx（如 503 `AI_NOT_CONFIGURED` /
   `DAP_ENGINE_NOT_CONFIGURED`、502 `AI_CALL_FAILED`），且**不扣费、不落假数据**；
   错误文案给出运维指引（去 admin 哪里配什么）。适用于按需使用的能力。

**降级仅允许 dev / 联调**，且必须同时满足四条件：
(a) 显式开关（如 `aep.dap.allow-placeholder`），生产 profile 默认关闭；
(b) 启动 banner 警示（生产 profile 下误开 → ERROR 横幅，如 `LogSmsSender` /
    `LocalFakeCdnUploader` 的 mysql-profile 横幅）；
(c) 降级产物打显式标记（`mock=true` → 前端 MOCK 角标），绝不与真产物混淆；
(d) 联调脚本里显式 export 开关（如 dap-verify.sh `AGNES=none` 路径），不靠默认值。

**允许的例外（仅观测类 best-effort）**：审计日志 / 用量统计 / 发布计数等**旁路写入**
失败时可吞异常仅 WARN（不阻塞业务主链路）；`CdnUrlSigner` 签名失败回退未签名 URL
（可用性优先于防盗刷）。例外仅限「丢观测数据」，**绝不允许**伪造业务产物、跳过扣费
校验或返回假内容。

**Review reject 规则**：
- 新增 `isConfigured() ? 真实现 : 占位实现` 类分支，而占位分支没有生产 profile 门控
  （开关 + 默认关 + ERROR 横幅）→ reject；
- `try { ai调用 } catch { return 模板/规则兜底 }` 把假内容当真产物返回 → reject，
  改为抛带 code 的 BusinessException；
- 新增外部依赖 driver（`xxx.driver=local|log|fake` 形态）但生产 profile 默认值仍是
  fake 形态且无启动横幅 → reject。

**现存门禁 / 开关审计表**（新增依赖时照此登记）：

| 能力 | 未配置时（生产） | dev 降级开关 / 兜底 |
|---|---|---|
| JWT / AES 密钥 | 启动 fail-fast | dev 默认密钥仅 dev profile |
| dap 数字人生成 | 503 DAP_ENGINE_NOT_CONFIGURED（不扣费） | `aep.dap.allow-placeholder`（dev true / mysql false） |
| dap 真人刷脸认证 / 素材送审（七牛 modelink，v0.105） | 503 DAP_MODELINK_NOT_CONFIGURED（不建会话、不产假数据；授权与审核免费，无扣费面）；上游分组配额打满 → 503 DAP_MODELINK_QUOTA_EXCEEDED（账号级仅 3 组，不降级、不产假数据） | `aep.dap.modelink.allow-mock`（dev true / mysql false，生产误开打 ERROR 横幅；mock 产物一律落 `mock=true`） |
| 文本三件 / 短剧脚本 / 形象锻造 | 503 AI_NOT_CONFIGURED · 502 AI_CALL_FAILED | dev-fake-llm（默认 false，显式开） |
| 素材视频生成 | 503 VIDEO_NOT_CONFIGURED | 同上 |
| 音乐生成（v0.138） | 503 MUSIC_NOT_CONFIGURED（端点/AK-SK 未配）· 400 MUSIC_DURATION_UNSUPPORTED（时长越界）· 502 MUSIC_CALL_FAILED —— 全部在 hold 之前判定，**不建任务、不冻结、不产假音频**；`upload-to-cdn=false` 时任务直接判失败并退款（不交付会过期的上游地址） | 无降级开关。未配置时 `GET /me/music/models` 返回空数组，前端显式提示「尚未开通」并禁用创作按钮 |
| 卖点提取 | 同文本三件（v0.51 起删规则模板兜底） | — |
| SMS 验证码 | driver=log 时 mysql profile ERROR 横幅（待运维改 aliyun） | log driver + dev-fixed 双门禁 |
| 资产存储 CDN | driver=local 时 mysql profile ERROR 横幅（P1） | local fake-CDN（dev 默认） |
| 支付渠道（v0.94 多渠道）| 渠道启用但机密缺失 → 下单/回调期 503 PAYMENT_CHANNEL_NOT_CONFIGURED（不入账、不回退）；机密走 admin 后台「支付配置」DB（加密），env 仅 bootstrap | shadow 影子渠道 `aep.payment.shadow.enabled`（dev true / mysql false，启用打 ERROR 横幅） |
| dev 免密登录 | `aep.dev-auth.enabled` 默认关 | 显式开 |
| 演示数据 seeder | mysql 默认 `AEP_SEED_DEV_DATA_ENABLED=false` | dev 自动 seed |
| music 形象锻造成片视频 | v0.60 已随形象锻造入口下线（债务以退役方式清除；遗留数据只读） | — |
| Studio 对话 agent / 技能规划 / 原生检查（2026-10-18） | 文本端点未配按量售价 → 503 `AI_TOKEN_PRICE_NOT_CONFIGURED`；看图能力未声明 → `STUDIO_VISION_UNAVAILABLE`；技能不在架 → 404 `STUDIO_SKILL_NOT_FOUND`；端点未声明流式就一次给出完整正文、**禁止拆字假流式**；未声明工具调用走 JSON 动作协议、不换端点；检查缺依据判 `unknown` 不判通过；父 / 子 run 费用不重复相加；模型输出永不等于付款或执行授权；后台技能试跑未配端点 → 503、不产假计划；蒸馏草稿不看提示词 / 原话 / key 且不自动生效 | `StudioFixtureProvider` 测试响应（既有口径：零成本、`mock=true`，不冒充供应商流式） |

### 8.0.1 排障与验证纪律（v0.184 起强制，2026-10-05 补到 13 条 —— 都是本仓真栽过、而且多数**栽过不止一次**的）

> 这一节不是通则，是事故清单。每一条后面都跟着它是在哪一版、以什么形态发生的；
> 再犯一次的成本已经量过了：一个 400 我猜了三轮（路径 / 别名 / Key 权限），全不对，
> 而答案一直在上游的响应体里躺着。

**① 上游拒绝时，先把它的原话记下来，再谈改代码。**
外部依赖（大模型 / 存储 / 支付 / 供应商 API）返回非 2xx 时，**必须**在服务端日志里留下
`status` + 响应体（截断）+ 足够定位的上下文（endpoint / model / url / 关键入参）。
- `BusinessException.internalDetail` **不算**留下 —— 它只在走 `GlobalExceptionHandler` 的
  请求路径上才落进 `ErrorLog`；`@Async` worker / `@Scheduled` 里抛的异常到不了那儿，
  等于什么都没记（v0.184 就是这么丢的）。
- **模型错误区分用户可操作原因与平台内部诊断**（2026-10-25 用户修正边界）：素材、尺寸、审核等可操作原因继续明确展示；供应商余额、预扣费、配额、费率/成本、密钥、签名链接与技术堆栈不得透传到客户端（包括错误详情、历史任务、导演作品和事件流）。`ProviderErrorMessage` 在源头过滤，`PublicModelErrorPolicy` / 公共 JSON 出口及前端兜底保护历史错误；原始证据仅留在有权限的后台日志/诊断中。客户真实的积分钱包不足提示和我方追查号保留，不把供应商额度不足引导成客户充值。不得以“脱敏后仍可读”为由保留内部经营信息；也不把全部可操作原因一律覆盖成通用提示。
  上游 HTTP 状态、明确拒绝 / 受理未知的分类、计费和重试策略仍按既有协议判断，不能因展示了上游消息就改判失败或重复付费提交。响应体不是 JSON 时不外泄
  （别把网关的 HTML 错误页糊到界面上）。范式：`DapMultimodalClient#upstreamMessage`、
  `MaterialVideoModelClient#uploadFailureMessage`。
- 发出去的**请求体**也要记（`ModelCallCtx.requestBodyJson` → `[upstream-io] REQUEST`）。
  不设这个字段那行就打成 `body=`，「参数到底发出去没有」只能靠猜（v0.183 的参考图、
  v0.176 的时长，两次都栽在这里）。
- 累犯记录：v0.166（`friendly()` 把所有异常抹成「请稍后重试」）→ v0.174 → v0.184。
- **Review reject**：新增外部调用的 catch / 非 2xx 分支里没有 `log.warn` 带响应体 → reject。

**② 先确认信号本身成立，再据它改代码。**
排障时用来支持结论的那个观察，要先证明它**能**支持这个结论。
- 真实事故（v0.172–v0.174）：我把「响应 `usage` 里没有 `input_images` 字段」当成
  「参考图没生效」的证据，连改两版（签名 URL → 未签名 URL、对公网域名签名）——
  而官方图生图示例（确实传了图）的响应**同样没有那个字段**。两版改动都不是对症的。
- 可操作的判据：这个信号在**已知成功**的样本里是什么值？拿不到成功样本就别用它当证据。
- **浏览器控制台是累积缓冲，改完代码要换个干净标签页再读**（v0.193 又栽一次）：
  我看到的「script cannot be a child of html」其实是**上一次改动残留的旧消息**，
  据它把方案换成了 `next/script`，而那个方案实测更差。同理：`preview_logs`、
  `journalctl` 都要带时间窗。
- **数日志也要先确认 grep 能命中**（2026-10-03）：线上日志的级别字段是 `-ERROR`（`%5p` 正好 5 个字符，前面没空格），`grep ' ERROR '` 永远 0 命中，我据此报过一次「重启后 0 条 ERROR」。用 `grep -E ' -ERROR | ERROR [0-9]+ ---'`，并先拿一条已知会打 ERROR 的日志试一下这个 grep。同一天还栽了一次：脚本按名字里带 `server` 自动挑 systemd 单元，挑中的是账号中心 `aistareco-id-server`，查出来 0 ERROR、0 条上游日志，看着全绿。主服务是 `aistareco-server`；本该有 `[upstream-io]` 的时间窗里一条都没有，就是查错了地方。
- **Review reject**：commit message 里写「因为观察到 X 所以改 Y」，但 X 没有对照样本 → reject。

**③ 验证要走到用户屏幕那一步。**
「服务端产物是对的」推不出「整条链是对的」。
- 真实事故（v0.174→v0.175）：我核对了产物图确实按参考图合成了，就断言链路正常；
  真正的 bug 在写回画布那一步（`primaryImageId` 悬空导致永远显示第一张）。
- 排「结果不对」必须把**服务端产出的那个东西**和**用户屏幕上的那个东西**逐一对上号
  （key 对 key、id 对 id），再谈模型和提示词。
- 说「修好了」之前，要么自己跑通到终态（生产实测 / 浏览器实测），要么明说「没验证」。
  v0.178 我没验就发，用户回「还是不行啊，你自己验证过吗」—— 底下压着的是另一个 bug。
- **PR 的 CI 也算验证的一部分**：开完 PR 说「CI 在跑」就收工、之后不再看 = 没验证。v0.198.1（#119）第一个提交
  CI 就红了（`frontend-tests`），而我报告「全部测试通过」—— 那是本机的结果；PR 照样被合进 main，main 红了两天。
  交付前看一眼 CI 结论，红了先查（见 ⑬），不能拿本机的绿顶替。

**④ 同一件事不要留两种调法；同一条规则不要写两遍。**
- v0.176：视频参数在 `config` 和 `options` 两处都可能有，只读了 options → 用户选的时长
  一路没送到；而字段全是可选，类型检查看不出来。
- v0.180：资产归属规则在 `ownsAssetKey` 和 `requireOwnedAssetKey` 各写了一份，
  只改一处 → 另一条路照旧拒绝。
- v0.183：删掉 `submit` 不带首帧的重载 —— 留着就迟早有人用少一个参数的那个。
- 做法：**参数收敛到一处解析**（config 为准、options 作显式覆盖）；**规则收敛到一个方法**，
  另一处 delegate 过去；**重载只在语义真的不同时才留**。

**⑤ 对外声明的类型必须按字节判，不按文件名。**
v0.184：`ipstudio_gen/**` 一律以 `.png` 落库（全仓十几处都写死 `("png","image/png")`），
而厂商给的是 JPEG。浏览器会自己嗅探、图照样显示，所以存了很久都没人发现；
**把这张图转交给另一个厂商**时才炸（`400 input image cannot be decoded`）。
- 存：`FileStorageService.store(byte[],…)` 已按 `ImageBytes.sniff` 自动改正，调用方不用管。
- 交给外部：**再判一次**（存量文件仍然是错的），并把文件名后缀也改成真实格式。
- **Review reject**：新代码按 `filename.endsWith(".png")` 决定 `Content-Type` 发给外部 → reject。

**⑥ 写完没人挂的组件，编译器不会告诉你。**
v0.159 的发布按钮、v0.160 的 `fetchModels()` —— 文件都在、typecheck 全绿、就是没有任何地方
引用，功能在生产上整整缺了一版。新增「用户能点到的东西」时，必须有一条**结构测试**
钉死它真的被挂上了（范式：`publish-wiring.test.ts`），或者当场在浏览器里点一次。

**⑦ 手抄的类型一定会和服务端漂移。**
v0.163：前端手抄了一份 `IpRun`，把 `output` 写成 `outputs`，于是「画布出图一次都没成功过」；
**而单测是绿的** —— fixture 跟被测代码犯了同一个笔误，配成一对互相印证。
- 跨端类型一律引 `@ai-star-eco/types`，不手抄。
- fixture 要照**服务端 DTO** 写，不照被测代码写。
- **mock 也要照服务端写**：mock 与真实响应形状不一致时，演示模式验收过了、
  线上仍然坏（v0.194 的时间字段就是：mock 写「3 天前」，服务端发的是别的东西）。
- **模拟厂商也要照真厂商写**（2026-10-03）：视频生成区的线上 mock 端到端全绿，但 mock 出片自带封面、真厂商（聚算 H3）不给，
  模板卡片全是黑块，直到真厂商实测才发现（v0.199.1 修）；智能优化的 mock 回中文、真厂商回英文，也是同一类。
  写 mock 前先拿一条真响应对一遍：真的有才给，真的没有就别编。
- **要求模型按我们的格式输出的地方，上线前拿目标端点真调一次**（2026-10-18，Studio 全能创作）：S1–S3 用确定性假响应验收全绿，
  上线后第一次真对话（聚算 Qwen，端点未声明 response_format / 工具调用）连撞三处：动作写成 `<tool_call>` 标签而不是约定的分隔行；
  规划回复裹着 ```json 围栏；问题列表写成 `{question, default}` 对象，各操作的 `settings` 键名更是整套自己编，因为对话里的规划提示词
  是后来另写的一份、漏了字段契约，而同一份契约在执行侧早就写全了（§8.0.1 ④ 又犯一次）。判据：提示词里有字段名的完整契约且只有一个来源，
  解析容忍围栏与常见变体、校验仍然严格，并且至少真调用过一次。另：`prompt_template` 行首次启动入库，之后只有 `PromptTemplateSeeder.SEED_VERSION`
  变更才会刷新「没人改过」（version=1）的行 —— 只改提示词文件，线上不会生效。
  2026-10-20 又一次：模型把动作写成 `<studio-actions>[…]</studio-actions>`（第三种写法），被当正文显示、方案从没提出；下一轮它干脆照着近期对话里内联的「[查看画布：done，…]」在正文里**假装**调用了工具。判据补充：解析器认真实出现过的每种写法并配用例；近期对话里的服务端记录不要写成模型能照抄的格式；正文里出现执行记录而没有真的调用，按格式错误处理。
  2026-10-21：执行器总是按 `<执行>-p-<步骤>` 另建结果节点，助手用 create_nodes 准备好的视频节点（提示词、9:16 / 5 秒、首帧连线都在）成了空壳，结果节点既没提示词也没连线；同一次 1:1 首帧被 9:16 请求原样交给厂商，画面被纵向拉长 1.78 倍，而 9:16 是助手按技能默认写的、没看首帧。判据补充：模型或用户为结果准备的对象，结果就放进它（规划给 `targetNodeId`、服务端校验并兜底绑定）；交给厂商的图形状与请求不一致时由我们裁剪并留记录，不交给厂商去拉伸；素材清单要给出图的真实尺寸，模型才能「跟首帧」。
  2026-10-21 第四种：v20 把「调用前先用一两句话告诉用户你准备看什么」改成「调用前不用预告」，提示词里又只有格式描述、没有完整的动作示例，聚算 Qwen3.8 27B 整条回复只写了「[调用工具 view_images]」（7 个 token，什么都没做照样扣费）。判据：提示词要有一个完整的动作示例（一句正文 + 分隔行 + JSON），并有测试证明示例本身能被解析器认出；纠正提示带同一种示例；写成正文的调用按已注册工具名认、不显示、按格式错误重试。
  2026-10-21 第五种：动作本身完全对，但数组后面又写了一遍 `<<<studio-actions>>>` 当结束标记，严格解析连判三次格式错误、什么都没做还扣了积分；每次失败的回复正文都显示了出来（同一句三遍）；而用户点的「用这张图做一段视频」是我们自己给的完成后建议，出视频却没有这个说法的关键词，和出图平手就留在了出图。判据补充：只在动作块末尾容忍明显的收尾、其它多余内容仍判错；格式错误重试时被判错那次的正文不追加、正文只出现一次；我们自己给的每一条建议都要有测试证明它路由到对的技能或明确不切换（`StudioSuggestionRoutingTest`）。

  2026-10-24 第六种（AI 导演台编剧，聚算 Qwen3.8 27B）：剧本 JSON 写完了、字符串也闭合了，finish=stop，只漏了最外层的 `}`，严格解析判失败、整单退款，用户只看到「这次创作没有完成」。`ModelJson` 现在只在「文本停在一个完整的值上、只缺结尾括号」时补括号，截在字符串中间或逗号、冒号后面照样失败（`ModelJsonTest`）。
  同类补充（2026-10-24，永久修复已合 main、普通 JAR 未发布；厂商响应 UTC 2026-10-25）：`finish=stop` 的剧本同时出现非法 `\远处` 和缺末尾 `}`。`ModelJson` 可组合恢复汉字前的多余反斜杠、字符串内原始换行 / 制表符、完整值后的尾逗号和末尾括号；合法转义保持原样。未知 ASCII 转义、残缺 Unicode 转义、半截字符串、缺值 / 缺分隔逗号、重复字段和多份 JSON 一律拒绝，不能从残缺数组里截一个对象冒充整份结果。恢复后仍走业务校验；`finish=length` 不进入修复。`StudioWorkflowWorker` 对不能修复的 JSON 保留原异常及上游诊断，以 `AI_BAD_OUTPUT` 明确提示「格式有误，无法自动恢复；本次未扣积分」，释放冻结、不自动重调模型。回归：`ModelJsonTest` / `StudioWorkflowWorkerJsonTest`。
  2026-10-25 UTC 已按用户要求无重启启用官方 JVM-Sandbox 1.4.0 临时模块（namespace `aep-json-20261024`，仅环回 `24769`）：只处理原 `ModelJson.parse` 的 Jackson 异常，正常返回不变，不能恢复则交原工作流按 `AI_BAD_OUTPUT` 退款。固定生产探针通过，PID / 启动时间 / JAR 均未变。临时模块不等同于永久严格解析规则；下次正常发布先卸载模块，再发布含永久修复的 main。见 `docs/runbooks/studio-json-jvm-sandbox.md` 和 `docs/releases/studio-json-jvm-sandbox-release-20261025.md`。

**⑧ 用脚本改代码时，锚点必须包住"不能被拆开的那一对"。**
2026-09-09 生产事故：用 python 往 `IpDemoTemplate` 里插两个常量，锚点选的是
`@Column(length = 32)`，而 `@Id` 在它上一行 —— 常量插进了 `@Id` 与 `id` 字段中间，
`@Id` 就落到常量上去了。`Entity has no identifier` → EMF 建不起来 → 整个上下文起不来
→ 服务重启 15 次、API 全挂 3 分钟。
- **四道门禁一个都没拦住**：`compile` 过（注解放在常量上是合法 Java）、122 个 ipstudio
  单测全是 mock 不碰 JPA 元模型、typecheck 与契约门不相干；唯一会炸的那批
  `@SpringBootTest` 早就因为别的原因红着。
- 做法：锚点取**整段**（注解 + 字段一起匹配），或者插在方法/类的边界上，不要插在
  「注解和它标的东西」中间。改完 `git diff` 扫一眼被改的那几行上下文。
- 现在有 `EntityIdentifierTest` 兜底（反射扫全部 `@Entity`），但那是这一类的事后网，
  不是所有"脚本把配对拆散"都有网。

**⑨ 不抛异常的失败，调用方必须判断返回值。**
v0.192：`saveNow()` 明确返回 `saved / failed / conflict`（保存失败不抛），而
「存为官方内容」只 `await saveNow()` 不看结果 —— 网络失败或版本冲突时照样发布，
推给全平台的是**库里的上一版**，界面还说「已存为官方模板」。两边都不报错，最难查。
- 判据：函数签名回的是**结果对象/联合类型**而不是 `void`，那它就是在告诉你「我会失败
  但不抛」。`await` 完直接往下走 = 漏判。
- 已有范式：`publishWithLatestDoc`（`canvas-bridge/publish-gate.ts`）—— 把「先存再发、
  存不上就不发」收成一道闸，所有发布路径都走它。

**⑩ 测试断言契约，不断言可视文案。**
v0.194 改文案时 `IpDemoAdminTest` 红了 —— 它断言的是「示例不存在」这句话。文案本来就会
改，错误码才是调用方依赖的东西。
- 断错误码（`e.getCode()`）、断状态码、断结构；不断言可视文案。
- 例外：**文案本身就是被测行为**时才断（如 §8.0 要求「未配置时必须明确报错而不是产假
  数据」，那可以断关键词）。这种断言要在测试名里写清楚为什么。

**⑪ 同一个字段名在不同类型上语义不同，"一刀切"必错。**
v0.192：模板剥素材时无条件删 `metadata.content` —— 图 / 视频 / 音频节点的 `content`
是派生地址（该删），**文字节点的 `content` 是正文**（删了模板里只剩一排空白方块）。
同一次还漏删了 `runId` / `videoTaskId`，别人打开模板会去接**作者的**那次运行，被归属闸
正确地拒掉，干净的模板变成一堆报错节点。
- 批量删/改字段前，先按**类型**列一遍这个字段在各类型上分别是什么，再决定删哪些。
- 「剥素材」这类操作要连**运行痕迹**一起剥（runId / taskId / status / errorDetails），
  只删产物不删凭据，前端会判定「上次没跑完」并自动接续。

**⑫ 「手机上弹窗贴边 / 被裁」先看它的父容器是不是 grid。**
v0.197：web-drama 所有弹窗在 375 宽下右边都被裁掉一截，四个簇的 agent 各自给自己的弹窗写了
`max-width: 100%` / `94vw`，**都没用**。根因在公共的 `.overlay`：它用 `display:grid` 居中，
没写 `grid-template-columns`，隐式轨道按内容宽度（弹窗的 `width: 420px / 560px`）撑开，
子元素的 `max-width: 100%` 量的是**这条被撑开的轨道**，等于没限制。修法是给容器写
`grid-template-columns: minmax(0, 1fr)`，一处修好全站好。
- 判据：子元素加了 `max-width:100%` 仍然超宽 → 查父容器的 `display` 与轨道定义，别在子元素上继续堆 `vw`。
- 同一轮的另一个 CSS 坑：`app.css` 里「`[style*="fr 1fr"]` 在 ≤720 一律折单列」这类**按内联样式字符串匹配**的
  全局规则，会把用 grid 画的表格行（发布记录、数据表）也折成一列五行。新代码的 grid 写进 class；
  确实要内联时加 `.keep-cols` 退出。
- 验证要在 **375** 下真打开弹窗看（`shot.mjs` / 浏览器），桌面宽度下这两个问题都不出现。

**⑬ 本机绿、CI 红，先找两边环境差在哪，别当成偶发。**
2026-10-05：web-drama `episodes-view.test.tsx` 两条用例 CI 上每次红、本机每次绿。根因是**测试之间串状态**
（一条用例把「这张画布选的视频模型」写进 localStorage，`beforeEach` 只清了内存缓存），而本机看不出来是因为
**Node 版本不同**：本机 Node 25 自带的 webstorage 全局（没给 `--localstorage-file` 时是个连 `setItem` 都没有的空壳）
盖住了 jsdom 的 localStorage，写入全被 try/catch 吞掉、什么都存不下；CI 用 Node 22，拿到的是 jsdom 真的 Storage。
同一个文件里还有一条纯时序的抢跑（价格没读到就点按钮），本机偶发、CI 上被前一个问题盖住。
- 判据：CI 稳定红、本机稳定绿 → 差的是环境（Node 版本、`.env*` 文件、时区、CPU 快慢），不是运气。
  先在**干净的 worktree**（没有本机 `.env.local`）里复现，再用能让失败率从 0% 变 100% 的开关证明根因（§8.0.1 ②）。
- 已做：所有 vitest 项目（web-drama / web-aiavatar / packages/api-client）的 `setupFiles` 共用 `scripts/vitest/setup-storage.ts`：
  jsdom 环境把 Storage 换回 jsdom 自己的那份，node 环境把 Node 25 的空壳删掉（Node 22 的 node 环境里本来就没有），本机与 CI 一致；
  用到 localStorage 的测试文件在 `beforeEach` 里 `localStorage.clear()`。web-celebrity 的测试走 `node --test`、不碰 Storage，不受影响。

**⑭ 交互改完要按用户的真实路径走一遍，不是只看结构测试和截图。**
2026-10-19 画布页改版：结构测试全绿、截图也对得上设计稿，用户一用就说「不顺畅」。端到端走一遍才发现五处一直坏着：
输入框按 Enter 只换行（首页的对话框按 Enter 就发）；「问助手」从来没把节点带进对话（助手默认打开，总有一份草稿，打开时恢复草稿就提前 return 了）；
在输入框里按 Esc 整个助手被关掉、画布上按 Esc 取消选中也顺手关掉停靠的助手；确认卡写「直接回复可以也行」而服务端不认「可以」（已改为服务端接受短肯定回复）；
**「在画布上看」从来没移动过画布** —— 节点是受控的、带显式宽高，React Flow 的 `measured` 一直是空的，`useNodesInitialized()` 永远是 false，
聚焦的 effect 一直卡在这个门上（所有「聚焦到某个节点」都一样）。这些单测都覆盖不到，因为测的是「挂上了没有」而不是「用起来对不对」。
- 做法：改了对话、画布上的交互，就用无头浏览器（CDP）或浏览器面板把这条路径从头点到尾：输入 → 发送 → 确认 → 进行中插话 / 暂停 / 停止 → 在画布上看 → 关掉再打开 → 选中节点问助手；
  每一步读 DOM 状态（焦点在哪、面板开没开、引用里有没有那个节点、节点是否在可见区域里），别只看最后一张截图。
- 受控节点不要用 `useNodesInitialized()` 当门：`git grep -n useNodesInitialized -- apps/web-aiavatar/src` 应 0 命中。

**⑮ 流式响应（SSE）要声明 `no-transform`，否则代理会把事件攒起来。**
2026-10-19 本地验收：对话回复已结算扣费，页面却一直停在「停止」，刷新才看到结果。根因是 Next 的 rewrite 代理对所有响应套 gzip（`router-server` 里的 `compression`），
`text/event-stream` 也被压，小事件全积在压缩缓冲里，直到连接关闭（30 分钟）才吐出来；服务端和前端各自的单测都是绿的，因为都不经过代理。
- 做法：SSE 接口的响应头带 `Cache-Control: no-cache, no-transform`（压缩中间件见到 `no-transform` 就跳过）和 `X-Accel-Buffering: no`（nginx 不缓冲），范式 `StudioDialogueController#events`。
- 判据：「服务端日志 / 库里已完成，页面没反应、刷新就好」→ 先怀疑中间层缓冲，抓一次经过代理的响应看 `content-encoding` 和事件到达时间，别先改前端状态机。
- 同一轮的前端教训：**持久化不要在卸载 / 页面隐藏时写**。助手草稿第一版在卸载时写本地存储，开发模式 StrictMode 双跑副作用时，卸载那一下读到的是还没恢复的空状态，把刚恢复的草稿抹了；改成初始化读取、改动即写回。
- Review reject：新增 `SseEmitter` / `text/event-stream` 接口不带 `no-transform` → reject。`git grep -n "new SseEmitter" -- apps/server/src/main` 的每一处都要能在同一条链路上找到这两个头（现存例外：已下线的 `ForgeController`，见 TODO）。
- 「没有」和「0」别混用（同日复测 R2）：画布游标 0 本来表示「从头按正常命令重放」，代码里写成 `cursor > 0 ? cursor : undefined` 当「没有」处理，重开就落进只重建执行产物的恢复回放，新线程里第一个没存上的节点永远回不来。持久化的序号、计数、金额，判断有没有值用 `!== undefined`，别用真值判断。
- 浏览器面板收起时页面不跑 `requestAnimationFrame`：`saveStudioDocument` 等两帧，面板隐藏时会一直等，看起来像「发送卡住」。用浏览器面板验收交互前先把面板显示出来（`show_pane preview`），这不是产品问题。

**⑯ 在 REQUIRES_NEW 里写、回到外层事务再读，MySQL 上读不到。**
2026-10-24 AI 导演台：任务在独立事务（`newTx`）里建好并提交，外层事务随后读任务列表返回给页面，生产（MySQL，默认可重复读）上读不到刚建的任务：
外层事务在第一次普通查询时就定下了快照。页面因此以为没在生成，也不轮询；用户再点一次，新请求查到了任务，报「该项生成中」。本地 H2 读得到，所以本机验不出来。
- 做法：独立事务里刚写的东西，要在外层返回前读出来，就也在新事务里读（`newTx.execute(tx -> repo.find...)`），或者直接用写入时拿到的对象。
- 判据：本地正常、线上「第一次点没反应，第二次报已在进行」→ 先怀疑事务快照，不是前端状态。
- 反过来的坑（2026-10-28 导演台删除，独立复核复现）：**持着行锁时不要再开 `REQUIRES_NEW` 去读**。外层连接和锁都不放，内层再要一条连接；并发 N 个请求就占 N 条等 N 条，连接池 3 条时全部 `CannotCreateTransactionException`（active=3 / idle=0），池子 20 只是阈值更高。要在锁内读到最新提交，就在同一事务里用读已提交（`@Transactional(isolation = READ_COMMITTED)`，Spring 对已参与的外层事务不改隔离级别）并只查标量列；回归 `DirectorDeletePoolTest`（小连接池 + 占满后并发）。
- 同一类（2026-10-25）：`@Transactional(readOnly = true)` 里调 `SELECT … FOR UPDATE`（导演台 `locked()`），MySQL 直接报 `Cannot execute statement in a READ ONLY transaction`，H2 照常执行。只读接口用不加锁的读（`DirectorService.owned()`）。导演台的视频报价、推荐预算、上传声音样本都因此在线上 500。

### 跨 app 约定

- **UI 文案：用户友好 + 不溢出** ⚠️（v0.98 起强制，全前端适用；所有将来变更都要遵守）。
  - **用户友好**：界面可见文字必须是终端用户看得懂的话，**禁止暴露内部黑话 / 字段名 / 枚举原值**（如 `variation_type`=small/medium/large、`ff/lf`/首末帧内部叫法、`frameLocked`、`flow`、技术 id、后端错误码原文等）。用业务语言表达；技术细节放 hover `title` / 说明里，不要塞进主可视文案。
  - **不溢出**：任何可能变长或宽度受限的可视文字（表格单元格、卡片、标签、chip、按钮、徽标），必须约束宽度并防溢出——`maxWidth` +（父级）`minWidth:0` + `overflow:hidden` + `textOverflow:"ellipsis"`（单行）或允许换行；超出部分进 `title`/tooltip。不要假设文字一定短。
  - **反例**：`已出末帧 · 变化小`（暴露「变化」黑话 + `whiteSpace:nowrap` 无溢出兜底）。**正例**：可视 `首尾帧就绪`（定宽 + ellipsis），「运动幅度：小幅/中幅/大幅 + 运动描述」放 hover `title`。
  - Review reject：新增/改动 UI 出现内部黑话可视文案，或宽度受限处的可变长文字没做溢出约束 → reject。
  - **不是翻译腔**（v0.194 起强制）：界面文字要是中文互联网产品**真会这么说**的话，
    不是把英文产品词直译过来。用户实测点名的一条：「开始一个 IP」—— 那是 Start an IP，
    中文产品这一栏就叫「新建」。判据不是"读得懂"，是"像不像人在这个界面上写的字"。
    - **少数几个几乎总是错的词**：`打造`（→ 做 / 起一个）、`赋能`、`助力`、`一站式`、
      `全方位`、`轻松`、`即可`（「点一下即可切换」→「点一下切换」）、`开启你的 X 之旅`。
    - **开发词不要漏进界面**：`全局`（global → 官方 / 平台）、`实例`（→ 示例）、
      `链`（→ 工作流）、`目录`（用户界面上没这个东西 → 说它实际长什么样，
      如「「新建画布」那一排」）、`项目`（本仓已统一叫**画布**）。
    - **排比是模板感最强的地方**：同一组卡片四条描述清一色「让……」、
      清一色「不是 X，而是 Y」，读起来就是模板。改成各说各的具体事。
    - **界面里不用 `——`**。它在正文里没问题，在按钮、提示、空态里是 AI 味最明显的标点，
      换成逗号或句号。
    - **同一个东西全站一个叫法**。改了名要全仓扫一遍，**包括服务端的报错文案、
      模板/种子数据、mock 和注释里引用界面标签的地方** —— v0.191 把「项目」改成
      「画布」，v0.194 才发现还有七八处没跟上。
    - **不动的**：已定稿的品牌主标题与 slogan（如落地页「一个你，不止一种想象。」，
      v0.152 定的），以及 §4.6 之外的专业术语。去 AI 味不等于把专业文本改口语。
    - 拿不准就调 `shuorenhua` skill（`/Users/donis/.claude/skills/shuorenhua`）。
    - **web-drama 有自己的术语表**（v0.197）：[`docs/drama-ux-copy-pass.md`](docs/drama-ux-copy-pass.md) §2，
      每个东西界面上只许一种叫法，「不再使用」列的旧词（提示词直出、直接出片、验收入片、立项、脑暴、配方、
      创意市场、演员 IP 阵容、财务中心……）不许回到可视文案；§2.6 是 drama 额外的文风（说后果不说机制、
      花钱的按钮说清花多少、禁用按钮就地说原因、不写「左侧 / 右侧」、不承诺不存在的功能）。
      用户点名的那一条：**「提示词直出」看不懂**（「直出」是内部说法），现在叫「粘贴写好的脚本」。
      改 drama 界面文字前先查表；要新增叫法，先改表再改代码。
  - Review reject：新增/改动 UI 出现上述任一类 → reject。
- **shadcn 原语**：放在 `packages/ui/src/ui/`（共享包）；不要手改，要扩展用 wrapper
- **`"use client"`**：新 client 组件保留
- **新代码 API 形态**：`async function xxx(): Promise<T>`，聚合为 namespace 导出（`MusicApi`, `CelebrityZoneApi`, `MixcutApi`, …）
- **mock 与 api 分工**：组件默认渲染 import mocks，用户动作走 api
- **OffsetDateTime / ISO 8601**：所有时间字段在 wire 上是 ISO 字符串，DB 是 OffsetDateTime（H2 / MySQL 都支持）
- **禁止用浏览器原生 `confirm()` / `alert()` / `prompt()`** ⚠️（v0.23 起强制）。
  - 原因：(1) 浏览器原生样式割裂 + 移动端 H5 上观感极差；(2) 按钮文案不可本地化（Chrome 显示英文 "OK / Cancel"）；(3) 同步阻塞 React render；(4) 缺 ARIA / focus trap / Enter-Esc 默认绑定。
  - 替代方案：
    - 二次确认弹窗 → `apps/web-celebrity/src/components/common/confirm-dialog.tsx` 的 `useConfirm()`（基于 shadcn `AlertDialog`）。Promise-based、可声明 `tone: "danger"`、可注入 ReactNode 描述。
    - 错误提示 → 组件内 inline error / toast（**禁止** `alert(e.message)`）。
    - 输入采集 → 弹一个真正的 `<Dialog>` 带 `<Input>` 表单，不要 `prompt()`。
  - PR review reject 规则：任意 `apps/**/*` 文件出现 `window.confirm` / 裸 `confirm(` / `window.alert` / 裸 `alert(` / `window.prompt` / 裸 `prompt(` 必须改成上述对应组件后才能 merge。
  - 历史欠债：`apps/admin/**` 还有数处 `confirm()` / `alert()` 调用未迁移（v0.23 单独成 backlog item），新代码不能再增加。

### 新代码（packages + web-{music,drama,celebrity,aiavatar,star}）特有

- **`proxy.ts` 替代 `middleware.ts`**（Next 16）
- **`params` / `searchParams` / `cookies()` / `headers()` 必须 await**
- **route group `(workspace)`** — URL 不出现，仅做布局复用
- **CSS 变量优先**：Creator 主题用 `var(--accent)` / `var(--bg-0)` 等；Tailwind v4 `@theme` 块映射 Tailwind palette
- **不混 npm/pnpm**：workspace app（web-music / web-drama / web-celebrity / web-aiavatar / web-star / admin）都用 pnpm

---

## 9. 文档同步纪律（**Strict — agent 必读**）

> 文档 drift 是这个仓库历史上最容易踩的坑（v0.5.4 文档审计：CLAUDE.md / apps/server/README.md 的角色名长达 2 周与代码不一致）。
>
> **每次大版本变更必须把文档作为 commit 的一部分一起改**。"代码先 merge，文档之后补" → **drift 源头，禁止**。

### "大版本"的定义

在 `product_spec*.md` 追加新版本节，或新增 / 修改 / 删除任何 server 实体 / API 路径 / 表结构，即视为大版本。

### 必更新清单（同 commit）

| 触发 | 必同步的文档 |
|---|---|
| 加 / 改 / 删 server 实体或表 | `apps/server/README.md` 数据模型段；`product_spec*.md`；本文件 v 增量节；`docs/INDEX.md` last-reviewed |
| 加 / 改 server 接口路径 | `specs/openapi.yaml`（CI 守门）；`product_spec*.md` 接口节；本文件 v 增量节 |
| 加 / 删子应用页面或大模块 | `apps/<sub-app>/PRODUCT.md` 模块清单；`apps/<sub-app>/README.md` 版本日志 |
| 加 / 删 admin 页面 | `apps/admin/README.md` sidebar 段；`docs/ADMIN_PRODUCT_SPEC.md`（如属新规划） |
| 加 / 改 / 删小程序页面 | `apps/miniprogram/README.md` 版本日志；`product_spec_ai_celebrity.md` 版本节；平台坑同步到 `apps/miniprogram/agent.md` |
| 加新文档 | 先按性质选目录：**现行设计真源放 `docs/` 根**（kebab-case 文件名，不加 `[xxx]` 前缀）、操作手册放 `docs/runbooks/`、带日期的审计 / 调研放 `docs/audits/`（文件名带 `-YYYY-MM`）、发布与验收记录放 `docs/releases/`（新文件名带 `-YYYYMMDD`，配图放同名子目录）；同 commit 在 `docs/INDEX.md` 加一行（含 last-reviewed 日期） |
| 方案落地或被取代 | 移到 `docs/archive/`，文件顶部加「已归档 + 现行真源在哪」一行；`git grep` 改掉所有引用（代码注释也算），INDEX 移到「归档」表 |
| 删旧文档 | 先 `git grep -n '<filename>' -- '*.md'` 改指真源；再 `git rm`，依赖 git history 留底 |
| 改环境变量 / 部署需求 | [`infra/README.md`](infra/README.md)；[`.claude/skills/aliyun-deploy/SKILL.md`](.claude/skills/aliyun-deploy/SKILL.md)；必要时同步 `infra/env/*.env.example` |
| **完成 / 搁置 / 新发现任一待办，或审计发现 TODO 与代码 drift** | **`TODO.md`（与产品说明、版本历史同等纪律，同 commit 改）** —— 详见下「TODO.md 维护纪律」 |

#### TODO.md 维护纪律（**Strict**）

`TODO.md` 是「已定位但未修的问题 + 候选排期」的真源，和 `product_spec*.md` / `apps/*/README.md` 版本日志一样，**必须随代码同 commit 维护**，不允许「修完代码 TODO 不勾」。规则：

- **完成一个待办** → 把对应条目改成 `- [x] ~~标题~~`（删除线），后接「**vX.YY 完成 / 已澄清**，YYYY-MM-DD」+ 一句落地说明（关键实体 / 端点 / 测试）。**不要删除条目**（保留可追溯）。
- **审计发现 TODO 与代码不符**（描述过时 / 其实早已做） → 同样标 `[x]` 并注「**审计确认**，YYYY-MM-DD：原描述过时，实际……」。本轮 v0.80 就发现 engine-pricing / operator 自授权 / recharge 三条已过时——**先核对真源再动手，避免照过时清单白做**。
- **新发现一个待办**（顺手定位但本轮不修） → 按主题段追加 `- [ ]`，带精确定位（`file:符号` / 错误码 / 触发条件），不要只写一句模糊描述。
- **降优先级 / 改判**（如「非漏洞，可后置」） → 保留 `[ ]` 但在标题后加判定 + 日期 + 理由，别让后人重复评估。
- 条目按现有主题段归并（持久化 / 安全 / sau-service / 通知 …），不要散落到版本日志里被忘掉。
- **整段都勾完了**（段内没有任何 `- [ ]`） → 整段移到 `docs/archive/todo-closed.md`，条目原样不改。TODO.md 只留还有未勾项的段，否则 1800 行里找一条开着的要翻半天（2026-10-18 第一次整理）。

### 验收

每次 v 升级 commit 之前：

```bash
# 0) TODO.md 已随本次改动维护？（完成项已勾 [x] + 注 vX.YY/日期；过时项已改正；新待办已追加）
git diff --name-only | grep -q '^TODO.md$' || echo '⚠️ 本次若动了待办相关代码，确认 TODO.md 是否需要同 commit 更新'

# 1) 文档与代码一致性
# 这里原来有一条 `grep PLATFORM_OPERATOR`。**v0.194 删掉了**，理由值得记下来：
# 它真逮到过东西（4 份文档还在写「v0.6+ 计划拆 PLATFORM_OPERATOR」，而这个拆分
# v0.31 就反向决策不做了）—— 但改完之后，解释「它已决定不拆」的**正确**句子照样命中。
# 收紧成 `计划.{0,16}PLATFORM_OPERATOR` 仍然命中「曾计划的 PLATFORM_OPERATOR」。
# **话题词和缺陷共用同一批词时，grep 门禁做不出来**，硬做只会得到一个永远为红、
# 因而被所有人忽略的检查。这一类改由下面「Staleness check」兜底（角色名查
# `AdminUser.AdminRole` enum 这个真值源），别再往这儿加词。
git grep -nE 'port 300[01]' -- '*.md'                       # 0 命中

# 1b) 时间字段（§4.8）与界面文案（§8）。**新代码必须 0 命中**；
#     存量清理进度见 TODO.md「时间显示与文案统一」段，别把存量当成放行理由。
git grep -nE '(publishedAt|updatedAt|createdAt|importedAt|lastActive)[^)]*\.slice\(0, ?10\)' \
  -- 'apps/*/src/**'                                                    # 应 0 命中
git grep -nE '"[^"]*(打造|赋能|助力|一站式|全方位|开启你的)[^"]*"' \
  -- 'apps/*/src/**' ':!*/translations.ts' ':!*.test.*' ':!*/mocks/*' \
  ':!*Seeder.java' ':!*/persona-studio.tsx' ':!*/proto/*'               # 应 0 命中
#     相对时间：前端应 0 命中；服务端 6 处存量（drama / notification / fan 线）待清
git grep -nE '(分钟|小时|天)前"' -- 'apps/*/src/**' ':!*/mocks/*' ':!*.test.*' ':!*/proto/*' \
  ':!apps/server/*'

# 1c) web-drama 术语表（docs/drama-ux-copy-pass.md §2，v0.197）：旧词不许回到可视文案。应 0 命中。
#     模式要求旧词前面紧挨着引号或 `>`（字符串 / JSX 文本），注释里提到旧词不算。
git grep -nE "[\"'>\`][^\"'<\`]*(提示词直出|直接出片|直出视频|验收入片|待验收|立项|脑暴|配方|创意市场|我发布的创意|爆款模板|套用开拍|试试同款|衍生新剧|演员 IP|脚本工坊|财务中心|视频工厂|成片配方|剧集工作台|分镜工作台|一键连跑|镜间一致性|补末帧)" \
  -- 'apps/web-drama/src/**' ':!*.test.*' ':!*/mocks/*' ':!apps/web-drama/src/translations.ts' \
  | grep -v 'QUICK_GO_TEMPLATES'                                       # 应 0 命中

# 排除项说明（改 grep 前先看这个，别把它们当命中）：
#   · `translations.ts` 是 §4.6 已 tombstone 的遗留字典，不再维护
#   · seed / mock 里的真实商品标题（如「【爱❤️助力】酒精湿巾」）是数据不是文案
#   · `persona-studio.tsx` / `proto/card.ts` 里的「赋能、闭环、生态位」是**给用户看的
#     反面例子**（人设编辑器的「避免这些词」占位）
#   · 1c 的 `QUICK_GO_TEMPLATES`（web-drama `api/brainstorm.ts`）故意留着旧按钮名「套爆款模板」：
#     库里已存的聊天记录里快捷回复还是这个字，前端要认得它才能跳模板广场；它不会显示在界面上
#   这几条已经写进上面的 pathspec —— 门禁要么 0 行要么真有问题，
#   「每次都吐几行已知无害的」等于没有门禁

# 2) 接口契约
pnpm check:api-contract

# 3) 编译门
(cd apps/admin && npx tsc --noEmit) && (cd apps/server && ./mvnw compile -q -o)

# 4) pnpm workspace
pnpm typecheck:all
```

### Staleness check（agent 在引用前的自检）

本文件可能在 commit 之间 drift。引用前先验证真值源：

- **端口** → `apps/<app>/package.json` 的 `dev` 脚本 `-p` flag
- **Admin 角色名** → `apps/server/src/main/java/com/aistareco/aep/config/AepSecurityConfig.java` 的 `.hasAnyRole(...)` + `AdminUser.AdminRole` enum
- **种子账号** → `apps/server/src/main/java/com/aistareco/aep/config/DataInitializer.java`
- **域清单** → 各 app 的 `src/types/` 目录（不是本文件的快照）
- **路由列表** → 各 app 的 `src/app/` 目录树

如果发现 drift，**同 commit 修两边**。

---

## 10. Pointers — 想查 X 在哪

| 问题 | 答案 |
|---|---|
| 完整文档地图 | [`docs/INDEX.md`](docs/INDEX.md) |
| 后端 API 列表 + schema | [`specs/openapi.yaml`](specs/openapi.yaml) + [`specs/README.md`](specs/README.md) |
| 后端业务规则（校验 / 计算 / 状态机 / 错误码） | [`specs/BUSINESS_RULES.md`](specs/BUSINESS_RULES.md) |
| AiAvatar/数字 IP 业务规格 | [`product_spec.md`](product_spec.md) |
| AI 明星带货业务规格 | [`product_spec_ai_celebrity.md`](product_spec_ai_celebrity.md) |
| 子应用产品功能 / 设计约束 | `apps/<sub-app>/PRODUCT.md` |
| 子应用启动 / 版本日志 | `apps/<sub-app>/README.md` |
| 部署流程 / 生产配置 | [`infra/README.md`](infra/README.md) + [`.claude/skills/aliyun-deploy/SKILL.md`](.claude/skills/aliyun-deploy/SKILL.md) |
| Figma 原型迁移 | [`.claude/skills/figma-migrate/SKILL.md`](.claude/skills/figma-migrate/SKILL.md) |
| 待办 / v0.6 候选 | `TODO.md` |


### v0.202 配音增量（2026-10-08，代码未发布）

`StudioSpeechService/Worker` 用 `DAP_AUDIO` 白名单调用聚算 `qwen3-tts`；V41 显式扩用途 ENUM（H2 和 MySQL），不修改旧迁移。仍复用 IpRun，前端配音 request 先存文档，后台 owner 行锁 + 指纹 + maxCost + afterCommit + hold/commit 保证同键不重复计费。实时服务契约要求 Idempotency-Key，保存原正文与原 Job；已受理永远查询原 Job，未确认受理超过短窗保留待核对，不退款后另发。配音 active hold 由 worker 拥有，reaper/sweeper 不作孤儿释放。下载携同 Key，先验返回 URL 主机、路径与 model 作用域，检查真实音频后存 CATEGORY_GEN key；SignedAudio 可换签。

平台用户按后台明确单次 price 收费，供应商按音频秒计量，不能照抄供应商积分价作为平台价格。`packaging.voiceoverStorageKey` 仅 assemble 放行，先验本人 key；长于成片拒绝，不截断，不能称为口型同步。线上仅登记 `ai-jusuan-qwen3-tts` 端点；新用途绑定与生产定价必须在代码/V41 发布后配置。真实固定配音与带字幕成片证据见验证文档 §11，克隆/驱动仍在 TODO。


### v0.202 口型增量（2026-10-08，代码未发布）

Studio `DAP_LIP_SYNC`/V42 为聚算 `x-dub` 的原生视频 + WAV 口型链，不能把通用 H3 图生视频当口型引擎。先验本人实际媒体、向上取整音频秒数和后台明确每秒价，再 hold；逐素材上传/原请求正文/Job 保存到同一 IpRun，派发 afterCommit，已受理只轮询原 Job，同 Key 下载保留 model 作用域，终态与结算同事务。输入 MP4≤128MiB/15–60fps、WAV≤25MiB/60秒，配音不得长于视频。已付费对照结果免费提取须匹配源片画幅/左侧像素（SSIM），保留原件，重复返回同文件；不额外调模型/改账本。真实短样片通过，生产绑定和定价未配置。人物固定声音版本绑定现已接通，专属声音仍待实现，证据见验证记录 §12。

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

### v0.205 · 2026-10-08 · Studio IP 人物库（本地，未发布）

`StudioIpLibrary` 按 avatarId 汇总，明确展示主形象、整张设定图、特写、表情、三视图/独立视角、细节与历史版本；缺少项不造假。目录补充已有属性和人物名称，默认声音来自 DapVoice 精确版本和真实试听。引用保留图片/造型/声音版本，不复制人物，保存失败恢复不重复添加节点。造型归档默认不覆盖主形象。新 V45 只加 dap_look.asset_role，免费分类 PUT 强验 owner/avatar/look；旧归档请求不因新 nullable 字段产生新指纹。见 `docs/ip-studio-character-library.md`。

设定图实测发现有效系统提示词仍禁止网格/拼版/文字，资源与本地配置已修正为遵从用户明确布局；生产未变。两次单图任务成功结算16积分，原请求和图片保留。用户随后明确本轮聚焦界面交互、功能逻辑和 LibTV 动线，模型画质不作通过条件，不再为效果反复生成。第二份结果用作功能验收素材，浏览器显式采用与归档；图像效果观察只保留备注。模板结果进入画布即恢复，关闭计划面板仍更新原任务。


### v0.208 · Studio 原生视频（本地，未发布）

Studio 支持模型开放首尾帧、全能参考、清晰度、六种画幅及种子：`StudioVideoService` 使用 IP 画布归属闸与实际字节/ffprobe 校验，再复用视频生成区规格与定价；类型化 `video` 入参转换为服务端生成的 `VideoGenSpec`。因此 `MaterialVideoJobService` 原生规格新增允许 `APP_IPSTUDIO`，素材运营和短剧仍拒绝。H3 默认用途绑定不改；旧协议保留文字/单首帧。真源 `docs/ip-studio-video-modes.md`；本轮没有提交收费生成。

### v0.217 · Studio 对话快照分享（2026-10-08，本地未发布）

助手历史旁“分享”仅在完成一轮对话后开放。先保存画布并预览服务端白名单文字快照，再明确创建链接；任何获得链接的人可匿名查看对话和创作建议。V47 新增 `ip_conversation_share` / `ip_conversation_copy`，不修改原画布、素材和积分。24字节随机 token，同内容发布幂等；更新快照撤销旧链接，撤销和源画布删除使公开读取失效。公开 GET 仅豁免精确路径，返回 no-store/noindex；复制和管理保留登录、aiavatar 开通、手机绑定及本人归属检查。

快照不含源节点、素材 key/URL、请求、模型、任务或账号字段，原参考绑定替换为重新选择提示。公开页“在 Studio 中继续创作”将文字与建议复制到本人新画布，创建新节点 ID并直接打开助手，无媒体和执行请求，未自动生成；同 owner/clientRequestId 幂等，浏览器 session 保留复制键以供失败/刷新重试。复制内容仍需显式选择本人参考素材、模型并确认费用。分享后新增消息不会自动公开，未发送草稿不进入快照。

这是 Studio 自有分享闭环；LibTV 当前可见“空对话不能分享”入口，但调研账号无历史，本轮未为探测弹窗调用模型，不能宣称其分享表单的所有行为逐项一致。公开画布与复制、社区展示仍是独立待办。验收见统一验证§28。


### v0.218 · 剧本原创/改编与连续制作（2026-10-09，本地未发布）

剧本面板明确区分原创与故事改编，可选择画布文字或已编辑剧本作为素材；提交时保存其当前正文快照，原稿保留。创作设定增加最多三种融合题材、人物关系与叙事结构，生成后的编辑器共用同一设定表单。设定修改只影响后续改写与拆镜，不改原受理请求，并提示既有下游内容需要重新制作。文本请求沿用已选模型；新可空字段不破坏旧请求幂等。

连续制作可选择图片/视频模型及画幅，确认步骤与费用上限后按序执行。已有采用首帧被替换时必须重新确认；计划及输出自动避开已有节点。弹窗内容滚动、确认/暂停固定在底部。暂停只停止后续提交，刷新从原请求继续。实际验收见统一验证§34。

用户明确暂不做整画布分享/复制，本轮保留个人画布发布为模板及新输入套用；不据对话分享推定已实现公开画布。

### v0.219 · 新画布图片/视频工具收尾（2026-10-09，本地未发布）

选中图片或视频后可直接下载当前采用版本，复用同源素材原件及字节判断后缀；裁剪、拆图、局部重绘自动避开已有节点。局部重绘保留原图，先保存标记/连接，再确认模型、候选数量与费用；新界面真实两图候选、第二版采用/刷新/下载已闭合。视频四模式、帧交换、编号参考、实际合同参数与整批报价使用同一面板；混合候选状态复用隔离交互样例、不新增供应商视频。证据与本地交付边界见统一验证 §35，个人模板保留，整画布分享暂缓。

### v0.221 · Studio 队列位置（2026-10-09，本地未发布）

`IpRunDto.queue`/原生视频候选 `queue` 是持久票据的实时只读投影：同一接入端点 FIFO 等待位次从 1 开始，已执行/结束为空；不持久化位次，不向客户端暴露其他用户任务。前端沿用 1.2 秒运行轮询，画布/任务列表统一提示、停止原请求，终态防迟到响应覆盖。不得编造倒计时或 ETA；验证见 `docs/releases/ip-studio-unified-canvas-validation.md` §37。

### v0.220 · 模型接入端点并发（2026-10-09，本地未发布）

用户确定按端点而非 vendor 分组。`concurrencyLimit` 在原后台配置，V48 增列与持久票据；`AiGenerationQueueService` 的端点行锁、FIFO 和派发租约为准入唯一真值。Studio 和通用视频 worker 超限即退出线程并排队，旧同步 chat/images 调用共用同一额度；ThreadLocal Scope 防内部重复占名额，结束必须清理。视频和配音/口型持有到上游终态，未知受理不可释放容量后重提；排队时长不当运行超时/孤儿 hold，停止退回原冻结。原业务任务/账本仍各自真值，票据不能保存密钥、素材或提示词。其他协议及人工容量核对边界见 `docs/ai-endpoint-generation-queue.md`。


### 图片受理未知不占执行名额（2026-10-22）

图片 `generate/running/image.provider.recovering/STUDIO_IMAGE_SUBMISSION_UNKNOWN` 保留原任务、供应商请求和冻结/付款授权，但不计入端点执行名额。准入、派发、`queue.running` 共用 `AiGenerationQueueRepository.countOccupyingSlots`，无迁移，旧记录读取即生效。不能据此重提或自动退款；视频/音频及已知图片任务的恢复规则保留。画布、任务列表和历史明确“受理结果待核对”，图片阶段不展示虚假百分比。

### v0.222 · Studio 画布浮层（2026-10-09，本地未发布）

创作操作默认在画布内无蒙层浮层，禁止恢复为强制右侧 Drawer。`studio-floating-panel.tsx` portal 到 stage 屏幕层，视口/节点 context 与 ResizeObserver 定位，不随画布缩放、不轮询 DOM；模型/费用/提交 footer 固定。助手 2026-10-18 起默认停靠右侧、占满画布高度（浏览器记住「改成浮窗」和拖出的宽度，见下「创作助手改版」）；普通节点选择不关闭工具浮窗。人物库返回保持原节点/草稿/视口，展开编辑器关闭回原内容。工作台 async session guard 防旧请求关闭新面板，助手历史草稿按项目/对话缓存在内存，不能写进已受理请求。无后端/API 改动，证据见统一验证 §38；手机/生产未验收。

### v0.223 · Studio 节点与浮层上下文（2026-10-09，本地未发布）

业务节点路由先于泛型媒体，单击/双击/右键与旧 editor 命令共用 `studio-node-command.ts`。口型入口固定打开对象，不读取动态 selected；视频有效输入与提示词 @ 编号共用映射，换序按 nodeId 重绑，移除被引用素材必须修正后才可生成。舞台内浮层焦点/层级与 Esc 统一；口型报价/执行固定 footer。剧本编辑器本体暂缓，后续 Markdown 专项。88 个不同定向用例、桌面零生成验收、类型/契约通过；独立 review `ship` 仅评价这五项，证据统一验证 §39，未部署。

### Studio 正式积分价格（v0.228）

新增配音/口型使用平台配置 `ipstudio.supplier-point-pricing`，供应商积分与平台积分当前 1:1，加 50% 溢价；不得将旧本地 8 积分/次、10 积分/秒作为正式成本。端点 `unitPriceMicros` 是金额，不承载聚算积分。整笔计费取整，价格快照随任务保存，预冻结多余部分经账本释放。未核实供应商单价的模型不开放调用。

### Studio 连线引用（v0.229）

连线是生成输入，不是装饰：从右侧输出端口拖到空白处，保留预览线并出现“引用该节点生成”菜单；文本/图片/视频新草稿与输入连接必须一次写入文档，再打开对应创作浮层。连接已有节点支持目标端口及节点内容区；自连、重复连线不新增。剪刀删除、撤销和保存刷新复用文档连接真值。断开媒体引用同步清掉当前创作面板的输入，不修改已受理请求；文字连线使用当前富文本稿快照拼入请求，并显示可移除的文本引用。不要再仅实现 `onConnect` 而遗漏 `onConnectEnd` 空白落点。

2026-10-10 线上 H3 首帧失败已定位为配置的 `api.jusuanhub.com:10443` 连接超时；标准 HTTPS `/v1` 已核实模型及输入资产上传后修正，未重提用户任务。端点密钥、模型、价格与并发限制保持原样。

### v0.230 账号与旧 Studio 外壳 · 2026-10-10

`src/shell/account-workspace.tsx` + `account-navigation.ts` 是桌面 `/me` 与 `/studio` 账号工具的共享外壳/入口映射；样式在 `account-workspace.css`，跟随 `html[data-layout]`。旧根入口转 `/projects`，业务深链、创建参数与 `#/real-auth/{sessionId}` 保留；账号菜单 hashchange/popstate 与旧 SPA 同步。详情与创建继续复用 proto 业务，未新增账号、计费或任务真值。见 `docs/aiavatar-account-unification.md`。

### Studio 平台配音定价（本地实现，2026-10-10）

可选 `aep.studio.platform-pricing.enabled` 默认 false，启用后由独立 aibuzz-platform 发布价驱动 Studio 配音，并通过固定版本 Java SDK 读取。权威成本与积分策略发布快照写入 `_exec.pointPricing`，已受理任务保持原价；钱包仍走 CreditService。缺价或平台错误不回退旧价。采用回执在任务行持久补报，不代表供应商成功。口型及其他图片视频未接入。配置与验收见 `docs/studio-platform-pricing.md`；本次没有生产配置或付费调用。


### v0.231 · 2026-10-10 · 模板直接复制为普通画布

官方/本人已启用模板经原 projects 创建接口直接免费进入个人副本，取消画布外输入、模型和报价门槛。IpTemplateResolver 按请求人解析；StudioTemplateCanvasCopy 从当前不可变版本重建节点/连线编号、默认文字、实际文本引用和媒体规格。新副本仅记 templateId 来源，不写版本执行锁；保存只改客户端拥有的个人文档，原模板不变，个人发布仍保留。旧版本实例与原任务恢复保持兼容。普通节点缺参考图/必填文本/选项在提交时提示，既有归属、模型、preflight、报价、账本和幂等继续生效。无新迁移/API 路径；新 metadata 由 packages/types 定义，胶水代码不改 vendor 引擎。

### v0.232 · 模板只读预览与显式个人副本（2026-10-10）

官方模板点击后先打开只读画布，浏览、缩放和查看节点提示词不创建项目。仅点击“存为个人副本”免费创建一份普通可编辑画布；保存中禁用重复提交，失败保留预览并由用户重试。首页、画布列表与画布内模板库共用这条路径，个人发布模板也按不可变来源预览。预览不挂载项目同步或生成工作台，不能拖动、增删、改写节点及连线；沿用现有节点样式和画布浮层查看设置。个人副本继续在节点内替换输入、编辑和确认生成费用，原模板不变，旧锁定实例保持兼容。本规则替代 v0.231 的“点击即创建”入口。

### Studio 节点交互增量 · 2026-10-11

故事板只投影画布原节点和连线，同屏详情复用原创作组件；普通文本 `operation=text` 的 `textEdit.content` 是受理正文快照，prompt 是修改意图，结果回写原节点，较新手改保留待采纳建议。任务仍走原端点队列、幂等与账本。V51 新增 `material_video_job.error_code`，用于厂商错误规范映射，不能用供应商队列拒绝冒充平台排队。发布状态见 `docs/releases/ip-studio-node-release-20261011.md`。


### 个人资产库 · 2026-10-11（已生产发布）

现有 /assets 为统一个人资产入口；剧本节点/编辑器素材面板负责提取，快速完善为任务内弹窗。V52 ip_library_record 保存对象身份、文件夹、来源绑定、画布文件夹偏好和归集回执，不使用假 finalized DapAvatar 承载无图草稿。名字不合并身份，引用锁具体版本，移动文件夹不复制对象。IpRun 与 ip_saved_asset 继续作为任务/文件真值，定时归集不调用模型或修改结算；生成与计费复用原 Studio 链。合同见 specs/openapi.yaml、specs/BUSINESS_RULES.md；方案与实际验收见 docs/ip-studio-personal-asset-library-plan.md、docs/releases/ip-studio-asset-library-validation.md。

### 模型合法请求规格 · 2026-10-13

供应商模型的可用参数和组合应保存在固定模型端点 `ai_model_providers`，由后台维护；场景候选只决定可见性和售价。V53 的聊天参数能力和 V54 的图片 `image_request_spec_json` 已按此执行：列表、提交校验和供应商组包读取同一条端点记录，受理时保存规格快照；缺图片规格时拒绝聚算图片任务，不按模型名选代码常量。V54 只初始化三个现有聚算图片端点，不是其他模型的通用默认值。当前 H3 视频及部分配音/口型协议限制仍在专用代码中，迁移前不得宣称全供应商已完成配置化；新增模型必须先核实供应商合法组合并配置到对应端点，不能直接复制其他模型的预设。

### 企业主子账号 · 2026-10-15（已生产发布）

`aep/enterprise` 为独立企业关系/RBAC，复用 OIDC 与现有 aiavatar 开通，不复用旧 Tenant/Studio、不新增企业席位。V56 建立企业/成员/当前归属/邀请/策略/移交/审计/划拨结构；current 的 userId 唯一，owner 由 Enterprise 单字段决定。钱包 accountKey 区分 personal/enterprise/enterprise_member，企业账户 userId 为空，成员用户另存 memberUserId；历史个人余额与账本不动。CreditService 按钱包 ID 共用核心，终态按 hold.walletId，企业资金锁 enterprise→按ID排序的全部企业wallet→hold→任务（个人仍wallet→hold）；划拨枚举为积分面且不计作发行/收入。`AEP_ENTERPRISE_ENABLED` 默认 false，控制新企业关系/积分操作；已有订单的平台财务处理不随开关关闭。E05 为预览指纹+正文幂等的原子划拨，E06 为固定企业根钱包的人工充值/退款；V57 保留原充值来源（移动/冻结/FIFO消费/释放），不得用后续充值顶替原单退款。退款待原单冻结结清后一次处理，记录人民币与凭据，不自动打款。Studio `/enterprise` 需构建期 `NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，后台沿用充值订单页；E07/E08 用 V58 持久化每个收费引用的付款授权和生命周期操作回执。全部 Studio 生成入口显式接受 billing，旧请求默认个人；授权固定 actor/enterprise/membership/wallet/endpoint/价格，不混扣。排队、受理未知均计入在途（零价模型接入点自模型赠款起一律报错，见文末「模型接入点赠款与折扣」）。停用/退出撤销原授权并取消未派发任务，已受理继续原任务结算；晚释放按原桶和充值来源回原企业，恢复/重入不改变原退款。关闭须无在途、冻结、余额或待核准充值。前台完整管理/消费流水与后台企业对账沿用原组件。图片/视频受理必须预先保存原路由和请求、随后保存供应商ID；轮询故障保留冻结并查原任务。无ID由SUPER_ADMIN/OPERATOR保存证据补原ID再查询；供应商明确证明未受理时，才允许显式确认释放原剩余冻结，FINANCE_ADMIN不能操作任务恢复。严禁重新生成或单凭查询故障退款。2026-10-15 已生产发布 `f068b51d`，前后端开关已开启、V56–V58成功，实际服务与资金基线见 `docs/releases/ip-studio-enterprise-production-release.md`。实施/验收见 `docs/archive/ip-studio-enterprise-development-tasks.md`、`docs/releases/ip-studio-enterprise-complete-validation.md`（早期批次记录另保留）；前端规划见 `docs/ip-studio-enterprise-ui-plan.md`。


### Studio 场景化首页与 AI 图片 / AI 视频（2026-10-29，本地未发布）

本节替代下面「七项导航」里的导航顺序：登录后桌面导航改为左侧一列「首页 / AI 视频 / AI 图片 / 画布 / 导演台 / 项目 / 资产 / 发行」（`DesktopTopBar` 非公开分支，`--desktop-bar-h` 在 body 上是 12px、左侧让出 `--desktop-rail-w`），公开落地页仍是顶栏；「灵感」搬到首页，`/templates` 归「首页」高亮；`/scenes` 转 `/video`。场景目录只在服务端一处：后台「Studio 场景模板」（`/api/admin/studio/scenes`，SUPER_ADMIN / OPERATOR，整份保存带版本号、同一套 `StudioSceneCatalog.validate`）改过就是平台配置 `studio.scene-catalog`，否则随包 `ipstudio/scenes.json`（`GET /api/v1/ip-studio/scenes` 只下发上架的，封面 / 示例只认 `ipstudio_scene/catalog/` 下后台上传的 key、出 wire 签名），出图描述和交给助手的话由 `POST /api/v1/ip-studio/scenes/compose` 拼（含每个视频场景的方法 `skillKey`），**前端不得另写场景数据或拼话**；草稿用 `ip_project.scene_id`（V72）认。图片场景的草稿就是一张画布，**先保存带 `clientRequestId` 的请求节点再提交 `studio-runs`**，之后只读运行记录，不确定时「确认原任务」用原请求编号重交；AI 视频照参考站「超级编导」：编导每一版脚本是草稿画布上的文字节点 + 普通文字任务（`compose` 的 `video-script`，`textEdit` 是上一版，能看图带 `readVisuals`——文字任务允许读图，规则在 `StudioTextRevision` 与提交校验同口径），「用这个脚本生成」后素材怎么交给模型只在 `scene-video-plan.ts` 判（全能参考 / 首帧 / 只按脚本，H3 带 `rewrite: auto`），视频节点同样先存请求再提交；爆款复刻和超出模型时长的片子才把拼好的话交给画布里的创作助手（`?start=assistant&send=1`，开始节点带 `studioSkill`），拼话固定禁止编价格 / 优惠、要成片不只要脚本，除「爆款复刻」外不得出现复刻类字眼（`StudioSceneCatalogTest` 守着）。Studio 视频任务到终态发 `MaterialVideoJobEnded`，即时推进制作计划。真源 `docs/studio-scene-creation.md`。

### Studio 七项导航与存量发行界面（2026-10-17，已生产发布）

主导航：`首页 / 项目 / 画布·自由创作 / 场景·专项创作 / 灵感 / 资产 / 发行`。项目为独立大预览画廊，创作页平铺十项能力入口。`/scenes` 前两项引用 `StudioScenePresets` 补缺的普通模板，不新建场景项目；旧 `/ips` 参数兼容到资产默认我的 IP。发行仅共享本人账号域和发布任务 GET；任务写权限不扩大，草稿、画布直发与未接通能力标【待建设】。页面/功能边界及本地验收见 `docs/releases/studio-workspace-refactor-validation.md`；代码 `81778bef` 已部署 server/web-aiavatar，实际版本与验收限制见 `docs/releases/studio-workspace-production-release-20261017.md`。

- **Studio 统一画布封面（2026-10-17，已发布 a4092626）**：项目/灵感共用 ProjectCardPreview 与 CanvasCoverEditor，人工封面 → 自动图片 → 画布缩略图。POST|PUT|DELETE /api/v1/ip-studio/covers/{project|template}/{id} 共用鉴权与存储生命周期；个人属主/官方 SUPER_ADMIN，封面不改 doc 或不可变模板版本，不触发生成或积分。

内置官方模板的人工封面使用 studio.builtin-cover.{id} 平台配置，仅 SUPER_ADMIN 可修改；目录和按 id 解析共用覆盖，不复制 classpath doc。

### 创作助手改版 · 2026-10-18（2026-10-19 已生产发布 `20261018-studio-assistant-redesign`，仅 web-aiavatar）

助手默认**停靠右侧、占满画布高度**（顶栏下到底部），宽 480、左边缘可拖到 400–760；「改成浮窗」是显式选择，浮窗也占满高度。停靠 / 浮窗和宽度是每个浏览器的记忆（`studio-floating:assistant`，`localStorage`，不是状态真值）。面板分三段：固定头（标题 + 当前技能 / 全能创作 chip + 演示标 + 使用说明）、**固定进度条**（`subheader`：制作进度 + 预算 + 暂停 / 停止，滚动对话不消失；每步可「在画布上看」，走 `studio-command: focus`）、独立滚动的对话区；输入区在底部，技能 / 模型是输入框下的 chip，不再藏在设置图标后（2026-10-21 起输入框下不再显示模型与技能，当前做法只在头部标签，见下「新建画布、多段对话与卡片精简」）；发送不可用的原因写在按钮旁边。

开场不再是口号 + 填字按钮：「想做点什么？」+「画布上现在有 N 条视频 / N 张图片」（点一下整类引用）+ 三到四张任务卡（2026-10-20 起只有标题和一行说明，「第一次用？」链接已去掉，见下「新建画布、多段对话与卡片精简」）。点「复刻一条短视频」进**素材清单**（`studio-assistant-checklist.tsx`；2026-10-21 起并入四张填空卡里的「复刻视频」，文件已删，见下「新建画布、多段对话与卡片精简」）：唯一的视频自动引用、技能切到 `reference-video-recreation`、输入框预填带方括号空位的一句话；参考视频 / 替换素材 / 空位三项齐了才能发，缺什么就在按钮旁写什么，清单可一键跳过。清单纯前端引导，服务端路由与报价不变。

回复下面的「放进画布」把回复建成一个普通文字节点（同样内容已在画布上就只定位过去），不依赖模型是否调用 `create_nodes`，哪些回复显示它见下「新建画布、多段对话与卡片精简」；早期回复正文里残留的 `<tool_call>` / `<<<studio-actions>>>` / `<studio-actions>` 原文折叠成「这一轮没有执行的操作原文」（`canvas-bridge/studio-reply-actions.ts`）。确认卡的现行样式见下「新建画布、多段对话与卡片精简」（2026-10-20 起不再有「调整上限」和「直接回复可以也行」）；打字确认仍走服务端 `StudioNaturalApprovals`（2026-10-19 起整句只由短肯定词组成的回复也算确认，演示模式 `mockSaysApprove` 同一套规则）。空线程不再自动滚到底（否则开场卡片被顶出视口）。结构测试：`studio-dialogue-wiring.test.ts` 钉死停靠默认、进度条、清单与使用说明都挂上了；交互在 `studio-assistant.test.tsx` 与 `studio-floating-panel.interaction.test.tsx`。手机端沿用全屏固定面板，停靠与拖宽不生效。

### 对话优先的创作入口 · 2026-10-19（同日已生产发布 `20261019-studio-dialogue-first`，仅 web-aiavatar）

用户从第一屏就按「跟助手说」来做：桌面首页英雄区、手机首页和「画布·自由创作」页的默认入口都是同一个对话框（`src/ip/studio-conversation-start.tsx`：一句话 + 四个示例开头 + 「开始对话」，Enter 发送、Shift+Enter 换行）。提交先免费建画布并把这句话存成想法，再以 `?start=assistant&send=1` 打开画布；画布的助手在线程就绪、且**线程为空**时把这句话自动发出一次（`StudioAssistant.autoSend`，按 projectId 只发一次，刷新后线程非空就不再发；发出后去掉地址里的 `send=1`）。那句话可能晚于默认打开的助手到达，所以由单独的副作用在线程读完后填入，不走「打开时恢复草稿」那条路（2026-10-19 曾因此一直不发）。未发出的草稿和选的对话模型按画布存在本浏览器（`canvas-bridge/studio-assistant-memory.ts`；2026-10-21 起没有模型选择控件，以前存过的选择仍沿用）。「先进画布看看」、`/create` 的方式切换框与「创作想法」文本框 2026-10-20 起已取消，新建直接进画布（见下「新建画布、多段对话与卡片精简」）。要照着参考视频做的话（复刻 / 照这条 / 拉片…，`studioBriefNeedsReference`）不自动发：进画布后打开复刻素材清单（2026-10-21 起是「复刻视频」填空卡）、保留用户原话，素材齐了由用户自己发（2026-10-19 线上验收：先扣一轮积分只换来「请上传视频」）。首页那句话同时用作画布名（`studioTitleFromBrief`）；没名字的画布（「· 新画布」/「未命名画布」）在第一条消息时按消息起名，用户改过的名字不动。

对话开始之后画布由对话驱动：服务端新建的节点通过 `studio-command: reveal` 进视野（只移视口不改选中；第一次看到结果时的一次性提示「结果放进画布了…」2026-10-20 起删除）；选中任何节点的操作条第一项是「问助手」（把节点带进对话）；空画布的空态已换成不论助手开关都显示的引导卡（见下「新建画布、多段对话与卡片精简」）；首页存的想法占位（没有任何回合的旧式对话节点）不再出现在「之前的对话」里。**助手在桌面画布默认打开**（同日追加）：`studio-assistant:open` 按浏览器记住用户最后一次开/关，只有 `html[data-layout="desktop"]` 才默认打开；停靠面板改为**通高**（舞台顶到底，去掉 72/16 的留白和 140px 的通用上限），并把 `has-docked-panel` 类与 `--studio-docked-panel` 宽度发布到 `.studio-flow-shell`（工作台覆盖层是舞台的兄弟层，不是子层），顶部工具条、视图切换、右侧入口按钮据此让位，其它浮层按剩余宽度定位。专业的画布操作照旧可用，只是不再是起点。证据：`studio-conversation-start.test.tsx`、`studio-assistant.test.tsx`（自动发送、进视野与提示）、两个首页测试、`studio-dialogue-wiring.test.ts`；演示模式下从首页一句话走到方案与确认卡已实测。

### 画布页改版 · 2026-10-19（第一遍同日已生产发布 `20261019-studio-canvas-redesign`，仅 web-aiavatar；第二遍照设计稿 Main 画板补齐，本地未发布）

照设计稿「画布页改版」实现，三条原则：**更少的按钮、一个焦点、AI 有自己的颜色**。顶栏只留返回 / 标题 / 保存状态 / 发布 / 积分，历史记录、上次发给模型、模板来源、存为模板收进「⋯」（`canvas-host.tsx`，antd Popover）。第二排工具条整条取消：画布 / 故事板 / 成片是画布上方居中的分段控件；素材库 / 画布模板进左栏；「AI 创作」按钮不再有，助手默认打开，关掉后右上角留一个 AI 圆钮（`.studio-ai-orb`）。左栏（`studio-flow-canvas.tsx`）按设计稿是**贴边通高的 56px 白色一列、只有图标**：平移、选择、「＋添加」（向右弹出：文字 / 图片 / 视频 / 声音 / 上传文件）、素材库、模板、查找、整理，创作任务在这列最底下（工作台渲染，桌面左栏 z 74 让它落在覆盖层 z 75 之上）。**没有「专项创作」**：商品 / 数字人视频模板在「模板」里，解析视频 / 拉片 / 口型同步在视频节点的「⋯」里，从资产库添加在「素材库 → 素材」里。复制 / 删除 / 更多节点操作只在右键菜单和多选条；撤销 / 重做 / 小地图在画布空白处右键（快捷键照旧），缩放条只有 − 百分比 + 适应。左栏通过 `studio-command`（`library` / `templates` / `speech`）叫工作台。

AI 的视觉身份：`.ip-surface` 新增 `--ai / --ai-2 / --ai-gradient / --ai-soft / --ai-ink / --ai-ring / --ai-glow`（群青紫 #4F5BD5 → #8B6CF0），**只给 AI 做过 / 正在做的东西**：节点头部的 AI 记号（`studio.runId / execution / request / speechRequest / lipSyncRequest` 任一存在即 AI 做的；`status=loading` 显示「生成中」并呼吸一圈 `is-generating`）、助手刚放进画布的节点亮 2.4 秒（`is-fresh`，由 `studio-command: reveal` 触发）、助手头部的星形记号与底纹、发送按钮、进度条、技能 chip、「问助手」的渐变描边、任务角标。**画布页不再用麦黄**（2026-10-19 按用户要求统一）：AI 去做的事（发送、开始制作 / 开始分析、带 AI 记号的「生成…」、和助手开始）一律 AI 渐变，其它主操作（发布、确认发布、完成、存为个人副本、＋）一律深色 `--ink`，次要白底细边，危险红字浅粉边，选中与链接群青；要花多少积分靠卡片上的大数字和按钮旁的价格说清，不靠颜色。浮层主按钮按「里面有没有 `.studio-ai-icon`」自动分两色；四角星只代表 AI，别处不再用星形（实心四角星 `AiMark`，`studio-ai-icon.tsx`）。无后端 / API 改动。证据：`studio-dialogue-wiring.test.ts` 钉住顶栏「⋯」、左栏七项、无第二排、AI 记号与圆钮；演示模式在 1440 与 375 宽实测。

**第二遍（照设计稿 Main 画板逐块补齐）**：第一遍只照批注文字收了外框，画出来的样子没逐块对照。补齐的是：顶栏「已保存」是标题旁一行灰字、右侧顺序 ⋯ / 积分 / 发布（插槽 `display:contents` + `order`）；视图切换只有文字、居中在左栏与助手之间；节点 AI 记号不再被 `.studio-flow-drag>span{flex:1}` 拉成长条，用户自己传的媒体标「你上传的」，生成中是 44px 渐变圆环 + 一行字；连线是灰色虚线（选中群青）；**选中节点的操作条在节点正下方、左对齐、按钮多宽就多宽**（`StudioFloatingPanel toolbar`），只放「问助手」+ 最多两个主操作（按 rank：任务状态 > 主生成 > 比较版本），其余进「⋯」（antd Popover）；助手头部是 26px 星标 + 标题 + 技能胶囊（点它展开使用说明，不再有单独的「?」）；进度条三行（`制作中 · 第 N 步，共 M 步` + 已用 / 上限 → 渐变条 → 当前一步 + 真实排队位次 + 暂停 停止），进行中 / 对话占用的积分明细在「已用」的提示里；**逐步清单在对话里**（`StudioDialogueSteps`，挂在最新一条回复里、建议之前），打勾 / 转圈 / 空圈 + 在画布上看；消息不写「你 / Studio」，你的话是靠右气泡。设计稿里两处**刻意不照做**：「约 2 分钟」（v0.221 规约不编 ETA，只写真实位次），每步「58 积分」（没有逐步实付数据）。

**第三遍（对话框与按钮区）**：并排截图对设计稿后补齐。按钮区的技能是无边框实心小胶囊「技能 · 名称」（有技能浅紫、自动浅灰、无下拉箭头），对话绑定技能后改为不可点的静态胶囊照样显示（2026-10-21 起输入框下不再显示模型与技能，当前做法只在头部标签，胶囊及其样式已删）；**antd 6 的 Select 是 `.ant-select-content` / `.ant-select-suffix`，旧的 `.ant-select-selector` 规则根本不生效**，chip 一直是白底描边带箭头就是这个原因。发送按钮始终是 AI 渐变、不能发时只变淡；输入框浅灰底细边，焦点时边框只略深。回复的顺序是正文 → 逐步清单 → 建议 → 一行小灰字（本轮积分、工作记录、从这里重新开始，`.studio-dialogue-meta`）；工具记录是无边框的一行；建议 30px 无图标；已确认的确认卡收成一行（`studio-dialogue-approval-done`，点开看做什么、报价和确认时间）；你的气泡里「已收到」在回复开始后消失（2026-10-21 起送达状态改为气泡底部靠右的小图标，悬停看文字：发送中转圈、已收到 ✓、排队中时钟、已应用双 ✓；发送失败仍是文字加「重新发送」）、「从这里重新开始」只在悬停或键盘聚焦时出现；停靠按钮是普通右侧面板图标；「停止」浅粉边。方案卡（制作计划）保持原样。输入框按设计稿逐像素再对一遍：发送键始终满色渐变（不能发时只换指针，原因写在旁边）；框里不再有费用说明那一行，「每轮回复最多 X 积分…」改到发送键的提示里（每轮实际花费仍在回复下面）；「技能 · 名称」的点两边留白、字重 500；占位字用 --ink-3。双击节点不做任何改动（保持原行为）。2026-10-20 起方案卡与确认卡合成一张、进度条只写「已用 N 积分」、每条回复下只一行合计积分、发送键提示只写「发送（Enter）」，见下「新建画布、多段对话与卡片精简」。

**第四遍（对话交互，端到端走查）**：见 §8.0.1 ⑭。输入框 Enter 发送、Shift+Enter 换行（⌘/Ctrl+Enter 照旧）；「问助手」监听 `studio-command: assistant`，把节点加进这条消息的引用并把光标放进输入框（助手开着、关着、有没有草稿都一样）；
Esc 规则（`studio-floating-panel.tsx`）：输入框里有字时 Esc 只离开输入框、不关面板，停靠的面板不响应焦点在画布上的 Esc，Antd 菜单 / 下拉 / 气泡自己的 Esc 在捕获阶段记下、面板不跟着关；
「在画布上看」、助手放进新节点、整理和「适应全部节点」都按**可见区域**适配（`visibleFitPadding`：左栏、顶部、缩放条和停靠面板都让开），聚焦只等目标节点被 React Flow 认得；
打字确认：服务端 `StudioNaturalApprovals` 增加「整句只由短肯定词组成」也放行（可以 / 好 / 行 / 嗯 / 对 / 是的…，逐段去掉句末语气词后判断；疑问、犹豫、改动照旧拒绝），对话提示词同步举例（`PromptTemplateSeeder.SEED_VERSION` 已 bump，否则线上不生效），确认卡上的这句提示 2026-10-20 起去掉、打字确认照旧（见下「新建画布、多段对话与卡片精简」）；演示模式 `mockSaysApprove` 同一套规则。**这一条要发 server**。

**第五遍（对话的动静与快捷答复，2026-10-20 用户反馈，已生产发布 `20261020-studio-assistant-activity`（GIT_SHA `8b408533`），仅 web-aiavatar）**：进行中的状态只从事件流推出（`dialogueActivity`）：已受理没回话 →「正在思考」、正文流入 →「正在回复」（正文末尾闪光标）、工具跑完回合未结束 →「正在思考」；跑工具时由那条工作记录自己转圈并写「进行中 · 已用 N 秒」；回合结束、失败、停止即消失，不编思考内容、不编百分比。工作记录是左侧细竖线的一行过程记录（不是带框的按钮），只有右边的小箭头展开详情，失败直接写原因。问题选项、后续建议、「改用这个做法」单击就作为一条用户消息发出（同一条发送链路：先存画布、同 clientMessageId 重试），不带草稿的引用、不动输入框；发送中禁用，发出后问题按「之后有你的消息」判为已回答（`answeredAfter`，服务端不标）。回复下的「放进画布 / 从这里重新开始」是小图标按钮（读屏有名字、悬停有提示），最新一条常显、旧的悬停或键盘聚焦才出现、手机常显；带问题、方案或确认卡的回复不给「放进画布」，已在画布上的显示「在画布上查看」。


### 成片编辑器改版 · 2026-10-19（本地，未发布，仅 web-aiavatar）

成片页是 `src/ip/studio-work-editor.tsx`（工作台只传数据、提交 `assemble()`）；片段规则在 `src/canvas-bridge/studio-work-clips.ts`。**片段进不进成片只有一个判断** `studioClipIncluded`：节点上显式的 `includeInWork` 为准，否则凡是被别的视频引用过的（连线指向非 work 视频，或出现在它的 `references` / `request.references` / `request.video.references` 里）、拉片切出来的片段（`studio.sourceRange`）、以及拉片分析的参考原片（连向 `kind=recreation` 的节点或被它的 `recreation.sourceNodeId` 点名；执行器出拉片节点时会把参考原片连过去）都算原片素材、默认不进。勾选框和 `assemble()` 的请求都走它，别再写 `includeInWork !== false`（爆款复刻曾因此把原片拼进成片）。时长以浏览器读到的文件为准（`loadedmetadata`），`seconds` / `durationMs` 只是读到之前的估计；配音过长、字幕超时、空字幕在合成按钮旁就地拦下，判定与 `StudioPackagingService` 一致，服务端仍是最终裁判。整片预览是前端连放（配音按成片时钟同步，文字按服务端位置叠加），界面注明以成片为准。片段按集再按 `order` 排，`reorderStudioClips` 是「移动」不是「交换」，跨集不能拖动或用箭头互换。`.studio-focused-view` 是名为 `studio-view` 的容器（`@container studio-view`），助手停靠时它让出 `--studio-docked-panel`；任务按钮在故事板 / 成片视图移到左上角。证据：`studio-work-clips.test.ts`、`studio-work-editor.test.tsx`、`studio-workspace.test.tsx`（复刻画布合成不带原片）。

### 成片高级编辑 · 2026-10-19（本地，未发布；web-aiavatar + server）

成片页的「高级编辑」用 **Twick 0.15.31**（`@twick/studio` 等四个包，固定版本 + `patches/` 下两个 pnpm 补丁修无限重试），组件是 `src/ip/studio-advanced-editor.tsx`，经 `next/dynamic` 只在打开时加载、`createPortal` 到 body，手机端不开放。**Twick 只负责编辑和预览，不在浏览器里导出**：导出时 `toEditTimeline`（`src/canvas-bridge/studio-edit-timeline.ts`，纯函数）把工程转成 `StudioEditTimeline`（视频 / 音频 / 文字 / 字幕 + 起止秒），工作台 `assemble(edit)` 照常建 work 节点、提交 `operation:"assemble"` 带 `edit`，服务端 `StudioEditGraph`（纯函数生成 FFmpeg 参数）+ `DramaAssembleService.renderStudioEdit` 合成：视频按开始时间排一条主轨、后开始的截断前一段、空隙补黑；音频按时间延后补静音再混（amix 后乘回路数）；文字和字幕由 `StudioPackagingService` 画成整幅 PNG 按时间叠加，用户文字不进滤镜语法。`edit` 只许 assemble，clips / audios 的 key 逐个过 `requireOwnedAssetKey`，校验错误码 `STUDIO_EDIT_INVALID`。工程存在成片方案 `workDraft.advanced`（Twick ProjectJSON，媒体只存 `metadata.storageKey`，`props.src` 不落库）。**素材一律用 `fetchAssetBlob` 取成 Blob 再给 Twick**：线上 OSS 没配 CORS 而 Twick 播放时设了 crossOrigin，别改成直接给签名地址。Twick 的样式会改全局（`body`、`:root` 变量、和 Tailwind 同名的工具类），所以不直接引入，用 `scripts/scope-twick-css.mjs` 生成只在 `.twick-scope` 生效的 `twick-scoped.css`，升级 Twick 后重跑。Twick 取缩略图时往 `<body>` 挂屏幕外 `<video>` 不收，编辑器卸载时按我们的 blob 地址移走。同批服务端把「配音过长 / 字幕超时」挪到拼接之前判（`StudioPackagingService.precheck`）。证据：`StudioEditGraphTest`（真 ffmpeg）、`DramaAssembleStudioPrecheckTest`、`studio-edit-timeline.test.ts`、`studio-work-editor.test.tsx`、`studio-workspace.test.tsx`（导出带时间线、不带包装）；本地真服务端 + 浏览器走过「切开、删段、加文字、导出、刷新后继续编辑、改回一键成片」。

### 对话意图直达 · 2026-10-20（已生产发布 `20261020-studio-dialogue-intents`，main `eea08f72`；server + web-aiavatar）

用户反馈「AI 对话里问太多」。真源 [`docs/ip-studio-dialogue-intents.md`](docs/ip-studio-dialogue-intents.md)。
- **合并 main 时**：main 同日的「原创创作」`original-creation` 与出图触发词重叠，已改 `status: withdrawn`（文件保留以便下架库里的行）；直达判定统一为 `StudioSkill.firstStage()`，`direct()` 委托给它。
- **四个技能**：出图 `image-generation`、写剧本与文案 `script-writing`、出视频 `video-generation` 是**直达技能**（`operations.analysis: []`，起始阶段 production）；参考视频复刻 `reference-video-recreation` 仍是分析 → 制作两阶段。
- **直达技能一张卡**：方案和制作确认卡同一轮发出，卡上不带 `executionId`，点按钮或回「可以」直接以 production 建执行；写剧本与文案的短稿（1500 字内）当轮 `create_nodes` 放进画布，不发卡。前端 `approve()` 只在卡上带 `executionId` 时才当阶段确认，**不再回退到面板上最近一次执行的 id**。
- **路由**（`StudioSkillRouter.decide`）：写作意图（写 / 改 / 润色 / 出几条 / 想几个…直接带「文案 / 卖点 / 标题 / 口播 / 脚本 / 剧本…」）先判，带图带视频也归写剧本与文案，除非这句话先要了图或视频（「画一张海报，上面写标题」仍是出图）；其余关键词 ×2、素材类型 ×1，唯一最高分胜出；文字一个词都没命中 → 沿用当前技能、没有就不绑（**只有素材不选方法**）；**平手一律不绑**（2026-10-21 起，当前技能在平手里也不沿用），线程清掉技能，由模型 `read_skill` 选，**不再抛 400 `STUDIO_SKILL_REQUIRED`**（前端处理保留）。
- **按任务绑定**（2026-10-23 起以「不锁方法」为准：有活跃执行时也按意图换方法）：没有活跃执行时每条消息重新路由，命中别的技能就换；有活跃执行时方法不变，显式换技能 400 `STUDIO_INPUT_INVALID`。
- **问题预算**：技能正文「必填与可选」是要不要问的唯一判据；必填缺且推不出才问，一轮一个，带候选和默认；可选项（画幅、张数、时长、风格、模型）一律用默认，不问不编。
- **提示词改了**：`PromptTemplateSeeder.SEED_VERSION` 已升到 `v19-2026-10-20-dialogue-intent-direct-merged`，不升线上不生效。演示 mock（`src/ip/mocks/studio-dialogue.ts`）已照服务端补三个直达技能与新路由。
- **未做**：真模型端到端（上线前按真源 §7 触发评测集至少真调一遍，§8.0.1 ⑦）；配音 / 口型技能接入对话。
### Studio 生产问题五项 · 2026-10-20（server + web-aiavatar）

已从干净 main `14260eea` 构建并发布 `20261021-studio-prod-fixes`；GPT 默认生图、视频仅 H3，Qwen 看图能力经合成图验证并声明。真实生图 / 视频未重跑；旧产品默认用途解绑的影响与验收边界见 `docs/releases/studio-prod-fixes-20261020.md`。

- **方法要对得上事**：没有参考视频的出图出片走「原创创作」（`original-creation`，只有制作阶段，`StudioSkill.firstStage()` 是唯一判定）；不要为了过流程给对话挂不相关的技能。无进行中执行时 `read_skill` 可换技能。
- **规格不能只写在提示词里**：助手用 `create_nodes` / `update_nodes` 的 `aspectRatio / durationSec / count / references` 写到节点（`metadata.studio.spec`，参考同时连边）；生成面板**不许静默钳制**时长或画幅，做不到就阻断并给修正按钮（`studio-composer-spec.ts`）。
- **看图要真看**：素材清单不含画面；描述图片内容只能经 `view_images`（本人 key、内联字节、对话端点须声明 `supportsVision`、计入本轮预算）。
- **失败节点只有一个恢复入口**；`VIDEO_MODEL_RETIRED` 的模型不再被预选或重投（服务端冻结前也拒绝）。

### 新建画布、多段对话与卡片精简 · 2026-10-20（2026-10-21 已生产发布 `20261021-studio-new-canvas-threads`；server + web-aiavatar）

真源 [`docs/ip-studio-new-canvas-and-threads.md`](docs/ip-studio-new-canvas-and-threads.md)。上面「创作助手改版」「对话优先的创作入口」「画布页改版」里与此冲突的写法以本节为准。
- **新建只有一条路**：所有「新建创作 / 新建画布 / 新建空白画布 / 创建空白画布」都调 `startNewCanvas()`（`src/ip/studio-entry.ts`；页面经 `use-start-new-canvas.ts` 加锁，连点、StrictMode 双跑只建一张），进 `/projects/{id}?start=assistant`，桌面助手停靠打开。最近一张仍叫「空白画布 · 新画布」、2 小时内建、没有节点也没有 `assistantConversations` 的画布直接复用，判断失败就新建。`/create`（「画布·自由创作」）桌面和手机同一个页面（2026-10-21 改判，已生产发布 `20261021-studio-create-page`，仅 web-aiavatar）：进来不建画布，最上面「新建画布」卡片点了才 `startNewCanvas()`，下面是能力入口（不含「空白画布」）和模板；没有方式切换框，也没有 `StudioConversationStart`（首页已有）（`studio-creation-brief.tsx` 已删）。形态判断按 `useLayoutMode()`，不写媒体查询。
- **空画布引导**（`studio-canvas-guide.tsx`）：无节点、画布视图、没有创作浮层打开时，在可见区域中间（让开左栏和 `--studio-docked-panel`）显示五个入口（文字 / 图片生成 / 视频生成 / 配音 / 上传素材）和「从模板开始」，一律发 `studio-command`，与左栏「＋添加」同一条路径，不另写建节点逻辑；外层 `pointer-events:none`，不挡拖动和双击。旧的「画布还是空的 / 和助手开始」空态已并入，不再有两套。
- **多段对话**：`GET|POST /api/v1/ip-studio/projects/{id}/conversations`、只读的 `GET …/conversations/{threadId}` 与切换用的 `POST …/conversations/{threadId}/open`（`StudioDialogueController`），无迁移、不调模型、不扣费。**读和切换分开**：只有用户主动打开才 `markOpened`，重连 / 轮询 / 补拉 / 看原对话预览（`GET …/messages`）一律只读，否则后台请求会把服务端的当前对话改回去（评审修正）。前端所有线程归属的异步请求带 `{threadId, generation}`，回包对不上就丢弃；确认制作在途时不能切换，切换在途时不能确认。POST `{clientRequestId}` 同人同键幂等，本人在这张画布已有空闲空对话就复用并设为当前；列表 `StudioDialogueThreadSummary` 的 `lastActivityAt` 取最后一条消息与创建时间中较晚的，最多 50 段。前端 `studio-dialogue-threads.tsx`（助手头部「新对话 / 历史对话」）。**当前对话在回复或制作（含暂停）时不能新建也不能切换**：画布节点是前端按当前对话的事件流写进去的，切走会漏节点；服务端不拦。打字「可以」确认的那一轮，回复结束时执行还没读到：从确认卡变成已确认（事件或快照）到读到这份执行之前同样不能切换（`DialogueStore.awaitingExecutionId`，读失败按确认重发的退避重读，2026-10-21 `20261021-studio-restore-fix`）。
- **卡片只回答做什么、花多少、按哪个按钮**：同一条回复里的方案 + 确认卡合成一张；不显示每步报价、上限、预留、过期时间、技能版本；上限输入只在预算不够（shortfall）时出现。打字「可以」仍能确认（`StudioNaturalApprovals` 不变），界面不再提示。`approaches[].rationale` / `tradeoffs` 永不显示（rationale 仍必填）。完成总结（`StudioExecutionSummary`）只一句结果 + 总花费，建议按实际产物给；「放进画布」不给完成总结、system 消息和本条已建 / 改过节点的回复，正文至少 80 字。
- **提示词改了要升版**：`dap.ip_studio_skill_plan.md`、`dap.ip_studio_skill_dialogue.md`、`RequestApprovalTool` 的 `scope` 说明一起改，`PromptTemplateSeeder.SEED_VERSION` 升到 `v20-2026-10-20-concise-cards`，不升线上不生效；真模型尚未验证（§8.0.1 ⑦，见 TODO.md）。
- **新对话的四张填空卡**（2026-10-21，真源 §5；仅 web-aiavatar）：空对话、没有引用节点时开场是「制作个人 IP / 写剧本 / 做个短视频 / 复刻视频」四张卡（`src/ip/studio-assistant-starters.tsx`：卡片配置、填空卡组件、拼句纯函数 `composeStarter`）。点开是素材位（「从画布选」走输入框的 @，「上传」走输入框的附件，画布上正好一个合适素材时只给必填位自动选上）、默认已选好的选项按钮和一两行文字位，实时拼成一句话写进输入框；**原复刻清单 `studio-assistant-checklist.tsx` 已并入并删除，别再留两套**。发送仍是输入框那一个按钮，缺必填素材不能发、原因写在按钮旁；发送**显式带技能**（`image-generation` / `script-writing` / `video-generation` / `reference-video-recreation`），不靠关键词路由。用户改过输入框后选项不再覆盖（出现「按选项重写」），点开卡片时输入框已有的字不覆盖；首页需要参考视频的原话照旧打开复刻卡、保留原话、不自动发（即使素材被自动选齐）。有引用节点时的那组卡不变。纯前端引导，服务端与报价不变；演示数据里的复刻技能已改成与服务端同名的 `reference-video-recreation`。
- **输入框下只有 @ 和附件**（2026-10-21 用户反馈，仅 web-aiavatar）：2026-10-21 起输入框下不再显示模型与技能，当前做法只在头部标签（`studio-assistant-mode`，显示技能名或「全能创作」；悬停写怎么选：有技能时「现在按「X」做。按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。」，没有时「按你说的话自动选择做法。」；点它仍展开使用说明）。模型：线上只有一个对话模型，禁用的胶囊点不动，还让人以为做视频也用它，所以可选不可选都不显示；发送照旧带默认模型的 `maxCost`（可选场景且多于一个模型时才带 `model`），本浏览器以前存过的选择仍沿用，已下架就回落默认。技能：服务端每条消息按意图路由（`StudioSkillRouter`），「自动」下拉和绑定后点不动的静态胶囊都去掉；填空卡仍显式带 `skillKey`。400 `STUDIO_SKILL_REQUIRED`（路由已不再抛，处理保留）改成输入框上方几个做法按钮（`aria-label="选一种做法"`），点一个就以该技能重发草稿，不再有要去找的下拉。`studio-dialogue-wiring.test.ts` 钉住组件和样式里不再有 `<Select` / `studio-dialogue-chip`。
- **结果落到助手准备的节点、首帧只裁不拉**（2026-10-21，真源 §6；server + web-aiavatar）：计划步骤可带 `targetNodeId`，确认时按已保存画布由 `StudioPlanValidator.bindTargets` 绑定（在画布上、类型对应、还空着、没被占用；模型没填时只在「本对话助手建的同类空对象唯一、同类步骤唯一」时自动绑定，有歧义不绑，不合格丢弃并写日志）；绑定后步骤 `nodeId` 就是那个对象，生成任务 `node_id`、`node.upsert`（`op=update`，保留标题 / 尺寸 / 规格 / 连线）、依赖连线、引用解析和恢复都用它，读步骤节点一律经 `StudioPlanExecutionIds.stepNodeId`，不再自己拼 `<执行>-p-<步骤>`。前端恢复（执行恢复与历史回放）按**结果是否已回填**判断，不按节点在不在：准备对象在画布上但空着（无媒体 / 文字 / 剧本、不在生成、无执行绑定，`nodeHoldsResult`）就补进去，与投影记录无关；不在画布上才看投影记录（删掉的不重建）；已绑定这一步的不覆盖（2026-10-21 `20261021-studio-restore-fix`）。每个结果节点带这一步实际发出的提示词（已有提示词不覆盖，照 keepText 作为可采纳建议）。图生视频首帧 / 尾帧比例与请求画幅差 2% 以上，`StudioVideoService.alignFrame` 先验归属再居中裁剪成本人派生图交给厂商，记 `_exec.firstFrameAdjusted`，裁不了就 400 `STUDIO_VIDEO_FRAME_CROP_FAILED`，不拉伸；生成面板就地提示「首帧图是 1:1，会按 9:16 居中裁剪」+「改成 1:1」（模型支持时），不挡发送。图片 / 视频结果落进节点时节点宽度不变、高度按产物比例（先按任务画幅，媒体加载后按真实尺寸，`studio.mediaFit` 标记一次性，`canvas-bridge/studio-media-fit.ts`）；卡片会记下所显示媒体的真实尺寸（`naturalWidth/Height`），素材清单因此能写出「1024×1024（1:1）」和草稿上的「设定 9:16、5 秒」。提示词 `SEED_VERSION` = `v23-2026-10-21-exec-target-node`。
- **一轮对话尽量做完，步数只算对话回合**（2026-10-23 起与「Studio 对话去掉继续」一节冲突的部分以该节为准）（2026-10-21，server；线上 `IPR-472ed89b5c174a95808f` 在确认卡发出前一步被 8 次调用上限截停，那 8 次里有 3 次是看图、规划工具自己的调用）：`DialogueLoop.TurnBudget` 分两种调用，循环里调对话模型走 `beginStep()`（算一步，`MAX_DIALOGUE_STEPS = 16`），工具内部调用与历史摘要走 `beginSubCall()`（不算步，只计入总调用保险 `MAX_MODEL_CALLS = 40`）；两种都照样计入 Token 与用时。工具运行上限 `MAX_TOOL_CALLS = 24`。真正管花费的是每轮积分上限（`rate.maxCost` 换算的 Token 总额）和 `MAX_DURATION` 10 分钟，步数只防死循环。新增模型调用必须二选一，不许绕开 budget。连续两步给出完全相同的动作批次（工具名 + 规范化参数，`DialogueLoop.batchSignature`；只读的 `view_images` / `read_canvas` 也算，中间被判格式错误的那次不算隔开，用户插话算）就停，原因 `loop`，重复的那批不执行。因上限停下（steps / calls / tools / time / tokens / loop）的说明只一句（「这一轮步骤太多，先停在这里。」「这一轮用时到上限了…」「这一轮的用量到上限了…」「这一步重复了…」），不再教用户打字；回复上附快捷答复「继续」（`StudioDialogueTurnWorker.limitSuggestions`，存进回复的 `requestJson.suggestions` 并随 `turn.done` 下发，与完成总结同一套）。格式错误（protocol）的说明不变、不给「继续」。

### 视频节点铺满与抽帧 · 2026-10-21（已生产发布 `20261021-studio-video-fit-frames`，仅 web-aiavatar）

- **视频节点的形状跟视频走**：只要知道真实尺寸（`naturalWidth/Height`，或加载时读到的 `videoWidth/videoHeight`），节点就按视频比例定形，不再只限带 `studio.mediaFit` 的新结果；规则只在 `studio-media-fit.ts` 的 `fitStudioVideoNode` 一处：保宽改高，媒体区超过 640 就缩窄宽度（不低于 220）而不是留左右白边，已经合比例的框不动（包括用户拖得比上限还大的），差不到 2px 返回同一个对象、不触发保存。上传替换（`replaceStudioVideo`）和附件 / 素材库导入（`attachmentNode`）有服务端给的宽高就当场定形。合上比例的视频用 `object-fit:cover` 铺满（`.is-fitted`），图片节点不在这条规则里。
- **拖大小保持比例**：已知尺寸的视频节点 `NodeResizer keepAspectRatio`，拖完 `fitStudioVideoToResize` 按新宽度校正高度（不封顶），和开始拖时的 checkpoint 是同一个撤销步骤；尺寸未知（空占位、还在生成）照旧自由拖。
- **抽帧**（`studio-flow-video-frames.tsx`，命令 `video-frames`，入口在视频节点操作条 rank 2 和右键菜单）：免费、纯前端。视频一律经 `fetchAssetBlob` 取成 Blob 再截（线上 OSS 没配 CORS，签名地址画到 canvas 会被污染），截出的 JPEG 走 `uploadImage` 成为本人图片，新节点 `origin:'derived'`、连线 视频→图片。截取过程中的「处理中」占位**只是画布本地状态**（`pendingFrames`，不进文档），不能用 `metadata.status='loading'` 或任何 studio 任务字段，否则任务恢复和「确认原任务」会把它当生成任务；失败删占位并说明原因。演示模式下面板直接说不能抽帧，不假成功。
- **单击视频 / 音频照常播放并弹出浮层**（2026-10-23）：`onNodeClick` 只跳过真控件（button / a / input / textarea / select / 连线端口），不跳过 `<video>` / `<audio>`，也不对它们 preventDefault —— 视频铺满后整张卡就是 `<video>`，跳过它等于单击永远不弹浮层（`studio-flow-node-click.test.tsx` 钉住）。节点标题（`studio-node-title.tsx`）单击不再 stopPropagation，单击标题栏 = 选中 + 弹浮层；但打开浮层会 fitView 到节点，画布在第二下点击前移动会把双击改名变成点到别处，所以标题单击等 `STUDIO_TITLE_CLICK_MS`（300ms）再派发，第二下点击（`detail>1`）、别处的单击、右键、点空白都取消它。
- **右键菜单只放平铺的按钮**：`studio-flow-canvas.tsx` 的 `nodeMenu` 逐项直接调 `onClick`，不支持 `children`（「素材拆解」曾因此点了就报错，现拆成「解析视频」「拉片」两项，`studio-dialogue-wiring.test.ts` 钉住）。

### 超管直接发放积分（2026-10-22）

有效 `admin_users.status=ACTIVE / role=SUPER_ADMIN` 可经 CreditOpsService 直接赠送/补偿积分，并批准本人历史待审单；其他角色保留阈值与独立复核，财务不可自批。例外只读服务端当前管理员记录，日限额、必填原因、工单/活动幂等、GIFT 桶与完整审计保留。审批通过锁原单，账本和状态同事务，防重复入账。不自动批量批准历史单。

### AI 导演台（2026-10-22，本地首版已实现，独立功能分支提交、未发布；真实 Agnes 出图已验，视频受厂商队列阻塞，见 `docs/audits/ai-director-local-acceptance-20261022.md`）

入口 `/director`（Studio 主导航「AI 导演台」），方案真源 `docs/ai-director-plan.md` v1.1。作品是**服务端拥有**的结构化对象（V65 `director_work.content_json`），不放进 `IpProject.doc`，不依赖分镜编辑方案。用户编辑带对象 `rev`，超长直接 400 不截断；生成结果回投前比对提交时的输入指纹（提示词 + 实际参考图 key / 正文哈希 / 本集片段修订基线），没变才填空着的采用位（`adoptedBy=auto`，要用户确认），变了只追加 `stale` 历史版本或留 `pendingPlan` 让用户决定。任务就是原生 `IpRun`（`host_type=director`，`project_id` 存作品 id，`node_id` 存目标），文字走 `StudioWorkflowService.submitDirectorText`、出图走 `IpRunService.generateForDirector`，付款选择与 `maxCost` 报价校验同 Studio。片段规划只做结构校验，镜头数 / 时长 / 未知资产与说话人一律原样保留，由片段 `issues` 阻止出图、就地修改。片段时长来自所选视频模型（`StudioVideoService.models()` 里支持全能参考的），没有可用模型时规划 503。一键连跑 `DirectorRunner` 每 3 秒推进，最多 2 个在途、预算硬上限、参考图（做到视频时还有分镜图）生成后停下等确认；做到视频只按集。片段视频走 `IpRunService.generateVideoForDirector`（全能参考：图1 采用并确认的分镜图，之后是资产参考图和说话角色绑定的声音样本 `asset.voice`，可选的供应商改写默认关闭），先 `quote` 报价再提交；原生视频任务记在片段 `video.pending`，读作品 / 后台推进时查询回投。整集导出按每个片段当前采用并确认的视频，走 Studio 合成（`studio-assemble`，不扣积分），导出记录保存所用版本，换过片段就标「这版是旧的」。连播预览在前端按顺序播已采用的视频，缺段跳过并标明。只支持首帧的视频模型（没有保存视频规格、走旧首帧路径的端点，如 Agnes Video 2.5）按「首帧出片」模式：一镜一段、采用的单张分镜画面作真正首帧（refKey 路径），不带参考图和声音；绑了声音的片段要用户显式勾「不带声音参考生成」，绑定保留。采用版本按生成指纹核对，与当前设置不一致时标原因、给重新生成入口，不自动重跑。


2026-10-24 改版（`20261024-ai-director`）：
- **资产提取：** 结果先存为 `pendingExtract`。用户在「确认资产」弹窗里勾选、改名后，`extract.save` 才入库；改名时原名记成别名。`extract.discard` 丢弃清单，一键制作在 `confirm-extract` 停下等，丢弃时停止。注意：清单项编号叫 `itemId`，不能叫 `key`，出参时名叫 `key` 的字段会被当成素材地址签名。
- **视频提示词：** 2026-10-26 起改成中文 H3 结构：【人物】【分镜参考】【画面】【声音】【配乐】无。每镜写画面里有谁，台词原文写进说话的那一句，说话人不在画面里写画外、听的人闭嘴；不写「禁止」清单和画幅时长。用户看、改的是这份中文；**提交 H3 前用文本模型 + MiniMax 官方 skill（`resources/h3-skill`，原文未改）改写成英文**（`H3PromptRewrite`，2026-10-27 起 Studio 画布与创作助手共用，见下「H3 视频提示词优化」）：台词认得全时模型只写画面、台词位置留 `{{Ln}}`，六段标题、`[Shot N] At` 切镜时间和 `(Sx) <d>[Chinese] 原文</d>` 由代码拼；认不全就由模型照官方写法写台词、代码逐句核对。检查只给提示不拦人（漏了的台词补回、放错镜头提示、零星中文删掉等），只有输出拼不出提示词才判失败退回并自动重试一次。英文存成带占位的模板（`clip.videoPromptEn`，含 `warnings / usable`，按画面结构的指纹复用），只改台词不重新改写。手动生成：没有提示就接着提交；有提示停在 `videoPromptRewrite=review`，片段上选「用优化稿生成 / 用原文生成」（`options.promptChoice`），「按原文生成」随时可用；一键制作不停，太长或两次没改成按原文。改写不报价、按实际用量另扣，完成后用用户确认过的视频价格与付款方接着提交（`chainVideo`）；改写期间付费输入（视频指纹，含素材 key）变了就不提交，一键制作的预算从发改写起就占着视频报价，续提被拒记为失败项、不换请求号重发。只对 H3（`supportsPromptOptimization`）生效，首帧出片模型照旧。依据见 `docs/audits/director-h3-video-prompt-ab-2026-10.md` §6–7。厂商智能优化关着。旧模板留作 `legacyVideoPrompt`，只核对旧格式生成的视频；新候选记 `promptFormat` 与实际发出的 `sentPrompt`。
- **角色音色：** `asset.voiceDesc` 文字描述写进视频提示词的【声音】段，参考音频可选。
- **分镜脚本写法（2026-10-26）：** 每镜台词不超过「秒数 × 4」字、一镜一人说话；机位写一种运镜（类型 + 幅度 + 速度），不写二选一和拍摄目的；不写外貌和抽象情绪词；光源声源写具体；小动作最多一个。`shotWarnings` 对台词超每秒 4 字、同镜两人说话给提示（不拦截）。
- **角色出图：** 改为横版 16:9 设定集，含全身三视图、头部正左右侧、喜怒哀乐四宫格、面部特征特写和半身展示。
- **资产的图（2026-10-26 改判）：** 资产只从剧本提取，每项资产可以「关联已有资产」或「上传图片」，角色、场景、道具一样，图直接作为采用的参考图（候选 `source=upload|library`，不会因设置改动过期）。此前「角色图只能由系统生成」的规则作废，`DIRECTOR_CHARACTER_UPLOAD_NOT_ALLOWED` 已删除；代价是普通照片不像设定集那样有多视角，人物一致性可能变差，由用户自己取舍。形象参考 `refImage`（`asset.setRef`）保留，只在生成设定图时作为图1、只取长相，改了参考已采用的生成图标「需更新」。
- **关联已有资产（2026-10-26，替代 10-25 的「从资产库导入」）：** 资产详情「关联已有资产」走 `asset.link`（targetId = 作品里的资产，data = `{objectId, versionId?}`），图和描述由服务端按本人资产库读（`IpLibraryService.object`），不信客户端带的文字。类型必须一致，资产库那项没有图就报错；记下 `libraryObjectId`，所选版本的图直接采用，描述空着才补，名字保留剧本里的叫法。批量「从资产库导入」（凭空新建资产）已去掉。「添加资产」保留作提取漏项的兜底，必须选出现在哪几集（`episodeIds`，默认全剧，服务端只认作品里真有的集）；编辑资产也能改出现的集。
- **自有图的两种用法（2026-10-29，已生产发布 `9ad3603b0`）：** 资产页把一张自己的图分成「直接上传作为资产图」（`asset.upload` / `asset.create` 带 `image.use=asset`：成为采用的资产图，`source=upload`、`adoptedBy=user`，不生成不扣积分，分镜图和视频按它出图，原版本留在历史）和「上传作为参考图」（`asset.setRef` / `image.use=ref`：角色、场景、道具都可以，只在生成资产图时作为图1，不替换资产图、不自动生成）。界面用语随之改为：分镜图和视频引用的叫「资产图」，生成时参照的叫「参考图」（原「形象参考」）。设了参考图后已采用的生成图标「需更新」，原因写「设置了参考图 / 参考图已更换 / 参考图已移除」。剧本文件同日放宽到 50 MB 并支持 HTML（jsoup 只解析不执行），见 `docs/ai-director-plan.md`。
- **长正文（2026-10-29，已生产发布 `9ad3603b0`）：** 剧本正文不限字数（新建、保存、集正文、设定资料、导入、助手写回都不截断）。一次模型调用读多少另算：`DirectorService.textBudget` = 文本模型输入 Token 上限 − 8000（没配按 32000），出 wire `pricing.textChars`；读不下时 AI 拆集 / 写分镜 / 重写分镜 400 `DIRECTOR_TEXT_TOO_LONG_FOR_MODEL`，全剧提取按集分批（`pendingExtract.batch`），助手只读光标 / 选区附近一段并在消息 `range` 里说明（`scope.window` 内定位修改）。分镜图讨论也带本集剧本。助手正文快照按哈希只存一份。页面：一次粘贴超过 3 万字在进编辑框前拦下、提示存 TXT 再上传（本机实测原生粘贴 10 万字约 10 秒）；超过 6 万字按段编辑（框里 6 万字打字约 0.1 秒，100 万字 10 秒以上）。新代码别把长正文整段放进一个 textarea、别在每次按键时对正文做 JSON 序列化。
- **剧本重新生成：** 剧本任务带 `regenerate:true` 可以重写。旧稿进 `scriptHistory`（最多 3 版），集、片段和待确认清单清空；资产保留，但要解绑集数。已有分镜图或视频候选的片段会让请求被拒（`DIRECTOR_CLIPS_HAVE_MEDIA`），不会悄悄丢掉已付费的产物。
- **编剧提示词：** 策划与写法按用户给的竖屏短剧编剧提示词（去 AI 味铁则、多集规则、创意发散、前 3 集功能、人物 / 场景 / 道具要具体到能画），输出格式仍是 `{title, logline, content}`。剧本页可选题材（6 个）和调性（5 个），存为作品的 `genre / tone`，各追加一组规则（`DirectorPrompts.GENRES / TONES`）；没写篇幅默认 3 集、每集 60–90 秒。
- **故事大纲：** 编剧同一次生成写 `outline`（世界观、人物的身份 / 秘密 / 毛病 / 变化、起承转合主线、反转与伏笔、主题），存在作品上，剧本页最上面显示；缺了不判失败。分集、规划的输入带上它，提取资产带上大纲里的人物。重新生成时旧大纲随旧剧本进 `scriptHistory`。
- **写分镜脚本（plan）提示词：** 多镜头模型照用户给的竖屏短剧分镜师规则（2026-10-25）：片段贴近模型时长上限（上限前 3 秒到上限，h3 即 12–15 秒）、每段 3–4 个镜头、常规镜头 2–4 秒、对话正反打、关键信息给特写、相邻镜头换景别、输出前自检；只按首帧出片的模型仍一段一个镜头；brief 写明镜头数 / 时长时照 brief。2026-10-25 晚又换成豆包建议的去 AI 味版本（动作不用模板套话、情绪用微动作、机位随情绪变、人物和环境互动、切镜要有动机、still 选中间态，输出前强制校验 5 项）；与原建议的差异：不放宽镜头数、不加 `relax_reason` 字段（长镜头理由写进 action）、「极致表情」改「关键表情变化」。共用段 `COMMON` 同时改为编号的 5 条基础规则。已写好的分镜要「重写分镜脚本」才按新规则。镜头数是硬规则（每段至少 3 镜，2026-10-25 用户确认不放宽）。程序检查 `shotWarnings`（镜头数、单镜 >4 秒、相邻同景别、非末段短于上限前 3 秒）写进片段的 `warnings`，只在卡片上提示，不进 `issues`、不拦截出图、不自动重写。
- **出图布光与肤色（2026-10-28，第一轮已随 `20261028-director-delete` 上线，第二轮本地未发布）：** 角色设定集、场景参考图、分镜图的提示词默认给演员打光、中性白平衡、按设定还原肤色（用户反馈 H3 成片脸黑发黄；要好看有气色，不是变白磨皮）。**布光是一段默认指导，不从描述里推断**（第二轮 review 后用户定，`DirectorPrompts.boardLighting`）：默认影视人像布光、适度补光、肤色自然有气色；风格写明的布光调色照风格，描述里明确写的剪影、暗面、特殊光色优先、只作用于写到的人物或区域。各格描述原样交给出图模型。**别再按关键词推断布光、追加「不补光」**：第一版把「自然色调」「不要逆光剪影」「低调地」都读反了，补正则也补不完；效果靠代表场景出图验证。改在 `DirectorPrompts`：原生图片协议只发导演台自己编的 `userPrompt`，改通用模板 `dap.ip_canvas_image` 不生效。视频提示词第 3 版让分镜图交代人物受光、肤色和色调，场景图只交代空间和光源位置，H3 改写的参考说明同改。**改出图或视频模板要升版本号（`IMAGE_PROMPT_FORMAT` 现为 3 / `VIDEO_PROMPT_FORMAT` 现为 3）并保留上线过的每一版**（出图 `legacyAssetPrompt` / `legacyBoardPrompt` 第 1 版、`assetPromptV2` / `boardPromptV2` 第 2 版；视频 `legacyVideoPrompt` / `videoPromptV2`），按候选记下的版本核对；改之前先查线上发布记录确认上一版有没有上线（第 2 版就是改到一半被另一个发布带上线的）：`refresh` 每次读作品都重编没手改的提示词，不这样做，所有已采用的图和视频都会被标成「需更新」。编剧和分镜规则同日改为服从题材（情绪幅度、爽剧打脸、治愈的亲密时刻）、人物顾虑服务主线、对白给正例、开场与制作可行性只作默认参考；台词放不下的处理按任务各写一次（写分镜脚本可顺延、重写不挪出本片段）；重写任务里【台词量】的上限、处理办法和输出前自检三处写同一个例外（用满时长和镜头数仍超出就保留原文），否则模型要在「全部保留」和「不达标请调整」之间二选一。**javac 会把 `static final String` 拼接常量内联进测试类**：改了 `SCRIPT` 等常量后测试比的还是旧值，先删 `target/test-classes` 下对应目录再跑。效果未实测，见 `docs/ai-director-plan.md` 末两节与 TODO。
- **反转线只给反转烧脑调性和悬疑题材**（都市悬疑、民国谍战）：三层反转和「3 集一小高潮、6 集一中反转、结局大反转」在 `DirectorPrompts.REVERSAL`，其他题材只保留「反转必须有可回溯伏笔」。
- **剧本页布局固定：** 标题行（保存 / 重新生成）→ 故事大纲 → 「下一步」→ 正文或分集列表，拆分前后同一个顺序。「下一步」里逐步做（推荐）和一键制作（快捷）并排，一键制作弹窗开头写明它是快捷方式。
- **分镜片段卡（2026-10-25）：** 两栏，左边成片画面（有视频看视频、没有看分镜图，宽度随画幅：9:16 188px / 1:1 220px / 16:9 300px）+ 视频版本号 + 「关联资产」「分镜图」两个入口；右边说明、问题 / 节奏建议、视频提示词，最后一行是生成设置 + 按钮 + 价格（`ClipVideo`）。分镜图没好时按钮旁给「去生成分镜图」，不再单独占一行。
- **资产页：** 工具栏有「生成全部参考图」（缺参考图、不是仅声音出场、没在生成的资产，确认后逐个提交，与分镜批量出分镜图同一套）；资产卡底部一行固定高度（状态 + 音色图标 + 主按钮，不换行）；详情抽屉分「头部（编辑 / 删除）→ 描述 → 参考图（形象参考、生成与费用、出图提示词）→ 角色音色」。切换工作区会清掉上一处的报错。
- **分集（2026-10-25，本地未发布）：** 模型只给每集起点和正文起点 `bodyStart`，区间由程序构造，不会漏段或重叠（线上《食神》漏最后一段、《谁让这个睁眼瞎修仙的》前 252 段是设定资料，都曾被判 `AI_BAD_OUTPUT`）。剧本里标好「第N集」时程序直接按标题分、不扣积分（`DirectorPrompts.headingStarts`，服务端唯一一处）。结果先存 `pendingSplit` 预览确认；开头资料默认存为设定资料 `reference`，可改、可并入第 1 集，作为创作材料交给提取和规划，不进输入指纹。全自动一键制作按默认直接采用并在 notice 里说明，拆分失败作为一集继续；不全自动停在 `confirm-split`。`split.undo` 在出图 / 视频前可撤销拆分。原则是先让用户跑完流程：原文不丢、做了什么说清楚、能一键改回。
- **一键制作默认做到成片**（`target=film`，2026-10-25 起；另有 `board` / `plan`，`video` 只供旧调用）：写剧本 → 拆分 → 提取资产 → 写分镜脚本 → 参考图 → 分镜图 → 片段视频 → 每集导出。`auto=true`（默认）全自动：资产清单原样入库，参考图 / 分镜图 / 片段视频自动确认；不勾全自动就在这四处（以及分集）停下等确认。整部作品也能做到视频。预算由 `POST pipeline/estimate` 推荐（与真提交同一套单价，视频在没分镜图时按模型价表和时长估，`StudioVideoService.estimate`），用户确认或调整。片段卡片只显示视频提示词，分镜图提示词在分镜图弹窗里。导演台出图尺寸按当前图片模型规格里该比例的尺寸选（同比例有几档取最大的），不写死。
- **出 wire 的任务列表在新事务里读**（`view()`）：任务在独立事务里建，MySQL 可重复读下外层事务看不到它，页面以为没在生成、不轮询（2026-10-24 线上「点生成剧本没反应、再点报该项生成中」）。本地 H2 复现不了。
- **作品删除（2026-10-28，已生产发布 `20261028-director-delete`）：** 软删除，复用 `DELETE /works/{id}`；在作品行锁内判在途，在途以 `ip_run` 和原生视频任务为准（`done / video.bound` 的绑定记录要查它指向的 `material_video_job`，未结案的受理待核对 / 重新查询中、查不到都算没结束；已按全局规则 failed 结案的 `VIDEO_SUBMISSION_UNKNOWN` 算结束），不信作品 JSON 的 `running`。在途检查与删除同一事务、同一条连接（入口读已提交），持行锁时不许再开 `REQUIRES_NEW`，否则并发删除耗尽连接池（`DirectorDeletePoolTest`）。前端「已删除」通知带作品 id，只作用于当前打开的那部作品。一键制作 running → 409 `DIRECTOR_WORK_BUSY` 先停止；paused / waiting 同事务标 stopped。本人重复删除成功，他人 404。规则见 `specs/BUSINESS_RULES.md`「AI 导演台作品删除」。
- **回收站与恢复（2026-10-29，已生产发布 `9ad3603b0`）：** `GET /works/trash`（只读投影，不回投不改内容）+ `POST /works/{id}/restore`（同一把作品行锁，本事务本连接，不走 `view()`）。恢复原 ID 原内容，`active=false`，遗留的 running / paused / waiting 一键制作改 stopped；写 `restoredAt`，恢复前提交的任务回投时只写结果、不接着付费派发（`DirectorService.beforeRestore`：改写完不自动提交视频、不自动重试改写），前端有 `restoredAt` 时不自动发创意对话开场。正常作品重复恢复 no-op。恢复不占新建额度（上限只拦新建）。规则见 `specs/BUSINESS_RULES.md`「AI 导演台回收站与恢复」。
- **页面外壳：** 导演台页面必须包 antd `App`（`director-antd.tsx`）。弹窗和抽屉的根元素挂 `dialogFocus`（`director-shared.tsx`）：打开时焦点移进去，Tab 在里面循环，关闭后还给触发按钮。
- **图片模型要出得了三种比例（2026-10-26，已生产发布 `20261026-director-image-viewer`）：** 一部作品只用一个接入点出图（道具 1:1、角色场景 16:9、分镜跟作品画幅），所以新选择只开放出图规格同时有这三种的接入点（`DirectorService.missingRatios`，按规格不按型号名）。作品里存着的旧选择原值照存、照原价出能出的画面，出不了的那类在冻结前报 `STUDIO_IMAGE_SIZE_UNSUPPORTED`，文案按资产类型说换模型还是换画幅。尺寸只在一个接入点里挑，**不要跨到同系列的 4K 接入点取「最大像素」**：4K 是另一个接入点、另一个价，那等于悄悄涨价。设置页读 `imageModelState`。
- **大图查看（2026-10-26，已生产发布 `20261026-director-image-viewer`）：** 导演台的大图用 antd 图片预览（`ZoomableImage`），与画布共用，不要再写一套查看器。`@rc-component/image` 有补丁（`patches/@rc-component__image@1.10.0.patch`，修复只沿一个方向拖或一帧内松手时不弹回、图被拖出屏幕的问题）。升级 antd 时先确认上游是否已修复，再决定删除还是重做补丁。预览层上下留白要相等，否则弹回会偏。
- **重写分镜脚本与一键制作无事可做（2026-10-27，已生产发布 `20261027-director-storyboard-rewrite` + `20261027-director-rewrite-credit-copy`，main `a0481b1c`）：** 分镜图提示词和视频提示词由镜头编出来，「重新生成提示词」就是重写分镜脚本。分镜页工具栏「重写分镜脚本」（整集）默认「保留现有片段，逐段重写」（task `reshoot`），「重新切分片段」（task `plan`）在本集已有分镜图或视频时不可选；片段上的「重写」只重写这一段。`reshoot` 片段 id 和位置不变、只换镜头 / 标题 / 摘要 / 关联资产，提示词回到自动生成，已有分镜图和视频留作历史标「需更新」，不出图、不碰别的片段和集；重写期间改过的片段，结果挂 `clip.pendingShots` 让用户选。**不要把旧镜头交给模型**：给了就照抄（2026-10-27 真模型实测，整集重写回来几乎一字不改），只给摘要、时长和台词。不能操作时按钮照样能点，点了说原因，不做点了没反应的灰按钮。一键制作 start 时什么都不用做（分镜脚本都写好了再选「分镜脚本」）409 `DIRECTOR_PIPELINE_NOTHING_TO_DO`，不再建一条「已完成」的空连跑（用户反馈「点了没反应」的根因）。本集摘要是随内容长高的多行框（`GrowTextarea`），不是单行输入框。新加的文字任务入口也只写「按实际用量结算」，不显示 `pricing.textMax` 这类冻结上限（首发时重写弹窗写了「最多 275 积分」，上线只读验收才发现，同日改掉；`git grep -n 'pricing.textMax.toLocaleString' -- apps/web-aiavatar/src` 应 0 命中）。规则见 `specs/BUSINESS_RULES.md` 同名条，验收见 `docs/releases/director-storyboard-rewrite-validation-20261027.md`。
- **操作失败用错误弹窗、资产解除关联（2026-10-27，已生产发布 `20261027-studio-error-dialogs`，main `4a9b5f18`）：** 用户点了某个操作、它没做成（业务规则挡下、冲突、前置条件不够、请求失败），要弹错误弹窗：标题「X 没有完成」，写原因、下一步，可展开「错误详情」（错误码、logId、可复制），同一个错误开着时不重复弹。**不要再加只挂在页面上方的横幅**：手机上资产详情是全屏抽屉，横幅被整个挡住，用户点了删除什么都看不到（2026-10-27 用户反馈）。做法：全站报错都经 `reportStudioError`（`src/ip/studio-errors.tsx`），它记下用户最近一次按下的按钮 / 菜单项，之后报上来的第一个错误弹窗、标题用控件上的字（确认框的「确定」「确认删除」用弹窗标题），知道更准操作名的地方传 `action`；后台失败（自动保存、轮询、媒体加载、旧任务恢复）传 `background` 或 `once`，只右上角提示，轮询不会反复弹窗；打开着的弹窗已经就地写出这条错误就不叠弹窗。导演台用 `useStudioFailure`（`failed(setError, "操作名")`），冲突类先把作品刷新到最新再说「已经刷新」。新代码别绕开这个出口去用 antd `message.error` 或底部 toast。资产「被用着」包括台词说话人；片段「关联资产」抽屉里每项都有「解除关联」（`clip.unlinkAsset`，片段出分镜图或视频时 409 拒绝），资产详情列出「用在哪些片段」并能「前往」。共享整理错误的 `publicModelErrorMessage` 从子路径 `@ai-star-eco/api-client/public-model-error` 引入（包根常被测试整个 mock 掉）。验收见 `docs/releases/director-error-dialog-unlink-validation-20261027.md`。
### AI 导演台全能创作助手（2026-10-28；后端 2026-10-29 随 server `20261029-image-url-result-alerts` 上线，前端未发布）

真源 `docs/ai-director-assistant.md`。工作台右侧可收起的助手（手机全屏），一部作品一份连续对话，剧本 / 资产 / 分镜共用；每条消息绑定一个对象（作品 / 某集 / 选中正文 / 本集分镜 / 片段镜头 / 分镜图或视频提示词 / 资产 / 参考图或分镜图），服务端核对并命名。一轮回复是导演台文字任务（节点 `assistant`，提示词与校验在 `DirectorAssistant`），计费、幂等、测试响应都走 `submitDirectorText`；不新增表、迁移和路径。建议只是建议：`assistant.apply` 写入前核对（剧本按逐字原文局部替换，定位规则前后端同一份；镜头比签名；用户改过的不覆盖，409 `DIRECTOR_PROPOSAL_STALE`），写入效果与手动修改相同、不触发生成，可撤销。图片的「生成新版本」是独立的 `asset-image` / `board` 任务，`baseOnCurrent` 把当前图追加为最后一张参考，不承诺局部精确修改、不自动替换采用版本。只有声明 `supportsVision` 的文字模型才交图。还没有剧本时剧本页默认是写剧本前的创意对话（节点 `brief`，最多 3 轮、每轮 ≤2 问，整句「你决定」直接写，「跳过」随时可用，剧本请求带上问答与整理要求）。剧本建议按锚点改具体一处（选区带位置、没选区要唯一），撤销找回那一处；发送前先保存眼前未保存的修改，请求记在浏览器、不确定时按原请求恢复（`director-pending.ts`）。分镜页左栏可看本集剧本，片段位置只用 `sourceQuote`（写分镜时模型摘抄的起始句，找得到才记）或台词逐字匹配，找不到就说明，不伪造。2026-10-28 本地接聚算 qwen38-27b 实测通过（记录见真源 §6）；写分镜脚本的起始句命中率与看图路径未实测（见 TODO）。内容旁的紫色入口和选中正文的「问 AI」弹出只针对这处内容的浮层对话（不展开侧边栏、不显示之前的对话，消息仍进同一份连续对话），顶栏「创作助手」才开侧边栏（2026-10-29）。

### Studio 对话独立额度（2026-10-23 已生产发布）

2026-10-23 起与「Studio 对话去掉继续」一节冲突的部分以该节为准。

本节替代上文「一轮对话尽量做完」中的共用 Token 额度与旧提示文案：普通文本 `tokenPricing` 不变，对话使用 capabilities 的 `dialogueTokenPricing`；单价同源，累计上限来自 `studio.dialogue-token-budget`，缺省输入 1048576 / 输出 65536 Token，可全局 / 按端点覆盖。前端报价、服务端冻结、运行快照与阶段对话预留使用同一额度；受理后的任务仍用旧快照。用量保护只在累计额度不足继续时暂停，说明已完成内容保留、点「继续」接着做且后续按实际用量计费；16 步 / 40 次总调用 / 24 次工具 / 10 分钟与重复保护保留。格式与校验见 server README 同名章节。无需迁移。

### Studio 确认继续（2026-10-23 已生产发布）

2026-10-23 起与「Studio 对话去掉继续」一节冲突的部分以该节为准。

本人同线程受限任务之后明确回复「继续」时，服务端派生 `_exec.continueUntilDone` / `continuationOf`；新任务不继承，模型与客户端不能自行开启。继续期间按已确认的金额预算运行，不再因 Token 输入 / 输出分配、步数、总调用、工具次数或 10 分钟阈值反复暂停；仍保留真实预算、停止、付款授权、制作确认与重复动作保护。同一父 run / 助手消息 / 冻结不拆不重放，超出原 Token 分配但未超金额预算的真实用量可正常结算。支持并过滤实际出现的 `<studio-action name="…" args='JSON' />`，错误批次仍不执行、历史原文不补执行。线上证据与回放见 `docs/audits/studio-dialogue-continuation-replay-2026-10.md`。

### Studio 发送恢复（2026-10-23 已生产发布）

`useStudioDialogueSession.post` 对不确定送达先读同线程快照核对 clientMessageId，再同正文/同报价/同付款编号退避重试；明确业务拒绝不重试，网关 HTTP_ERROR 不视为确定拒绝。不要把结构化异常换成文案字符串；保留真实 logId，没有时以消息编号定位。报价更新只刷新并保留草稿，不替用户增加批准金额。发布与真实断连/账本证据见 `docs/releases/studio-message-delivery-release-20261023.md`。


### Studio 对话跨制作类型续接（2026-10-23）

用户要做的产物优先于参考素材名称：出第一段视频 + 人物设定图不再路由到出图。「继续下一步」在 `ProposePlanTool` 用具体 brief 再选方法，走原线程锁和快照更新，活跃执行不切换。新计划失败时本轮纠正，`request_approval` 只能确认本轮成功保存且方法/阶段一致的计划，不准拿旧图片方案发卡。详见 `docs/ip-studio-dialogue-intents.md` 末节。


### 发布期间 HTTP 连续性（2026-10-23 事故补充）

当前单实例 `systemctl restart` 会使用户读取/保存短暂 502；保护在途生成不等于 HTTP 无中断。发布必须同时记录重启窗口的公网 5xx 与恢复结果，不能把发布后 `verify ALL GREEN` 描述为发布期间无中断。无停机切流尚未实施，见 TODO 与 `docs/releases/studio-stage-continuation-release-20261023.md` 末节。

2026-10-26 导演台补充：发布前必须检查 `ip_run` 的在途 `studio-director`，不能只查原生视频任务。同步文字调用没有可查询的外部任务号，重启后不得自动重新提交付费请求。本人作品可通过 `/director/works/{id}/tasks/{runId}/stop` 停止后续创作。**用户纠正：已提交模型有真实消耗，不能因停止全额退款。** 未提交才释放冻结；已提交则保留调用直到真实用量回执，按实际用量结算、仅退余量，停止后的内容不回投；用量不明必须 `STUDIO_USAGE_PENDING` 保留冻结待核对，不猜费用、不自动退款，hold sweeper 不得误释放。进程关闭中断同样按提交与用量处理。原生图片/视频/音频仍按各自受理和恢复规则处理。此前 `20261026-director-stop` 的全额释放行为已被用户否定；修正已发布为 `20261025-director-stop-usage`（main `6ff1835d`）。见 `docs/audits/director-script-stale-and-latency-20261026.md`。


### Studio 读取、进度与保存恢复（2026-10-23，本地修复，未发布）

2026-10-23 起与「Studio 对话去掉继续」一节冲突的部分以该节为准。

对话 `maxCost` 是用户批准的金额上限；旧页面额度低于新默认值时，`Rate.withinBudget` 保留单价并缩减本轮 Token 额度，冻结与运行快照不超过原授权，不再要求用户被动接受更高默认额度。`read_canvas` 目录可翻过 120 个节点，正文以 Unicode 字符游标分页，不得把前 4000 字叫全文；相同只读请求有一次纠正机会，任何写/付费动作都不重放。`read_production_status` 复用 `IpProjectService.toRunDto` 的真实视频任务投影，旧内容已采用不等于最新重做成功。画布保存对网络/502/503/504 有界退避；丢回执后完全相同的业务文档视为已保存，真正不同版本仍拒绝覆盖。该恢复不等于发布无停机。依据与运行时替换建议见 `docs/audits/studio-agent-runtime-assessment-2026-10.md`。


### Studio 对话去掉继续（2026-10-23，本地未发布）

用户说一句话助手就做完，只有付费生成（确认卡）和必填问题才停下等用户；真源 `docs/ip-studio-dialogue-no-continue.md`，规则 `specs/BUSINESS_RULES.md` Studio 对话第 30 条。单轮的 16 步 / 40 次调用 / 24 次工具 / 10 分钟 / Token 输入输出分配**删除**，`limitSuggestions`、`saysContinue` / `resumedTask` 删除；用户打「继续」只是普通消息，旧 `_exec.continueUntilDone / continuationOf` 只读兼容。

- **一条用户消息 = 一个 run = 一条助手回复**，从头做到尾；不接出新 run / 新消息 / 新 turn（没有 `chained`）。对话没有自己的预算，钱包真没钱才停。
- **同一 run 追加冻结**（`CreditService` 未改）：受理先冻结 `min(find(endpoint).maxCost(), 可用余额)`（普通文本价那档，**不用** `findDialogue` 的百万 Token 额度）；每次模型调用（含 view_images、propose_plan、历史摘要）前放不下就追加一笔 `runId#n`，金额 `min(max(增量, 本次所需), 余额)`，企业成员走 `EnterpriseBillingService.reserveExtension`（同成员同钱包，不占在途任务上限，绝不回退个人钱包），记进 `_exec.holdRefs`；结束时按实际用量依次 commit、其余 release，企业授权逐笔 complete；失败 / 停止 / 过期全部释放。`CreditHoldSweeper` 按 `#` 前的 runId 跳过活着的对话；`IpRunReaper` 把对话交给对话 worker 回收。
- **停下来的只有**：追加被拒（余额不够 → 「积分不够了，已经做好的都留在画布上。充值后跟我说一声，我接着做。」+ 充值入口；其它业务原因 → 该错误自己的中文原话，不加套话）；相同动作批次纠正后再重复（`loop`）；格式纠正两次仍错（`protocol`）；单个 run 300 次调用或 2 小时（`safeguard`，按失败结束、ERROR 日志、仍按真实用量结算）。结束语都不提「继续」。
- **对话费用不计入制作预算**：`attributeTurn`、`dialogueReserve()`、执行器里的 `dialogueRuns` 统计和 `dialogueSpent / dialogueInFlight` 全部删除；确认卡上限 = 报价 + 重做额度。旧数据里这些字段读到不报错。绑定制作的线程，对话仍由制作的固定付款人付（D10）。
- **单轮上下文裁剪**（`DialogueContextWindow`）、长文分段读（素材概要写全文字数与 `read_canvas` offset，返回 `total / nextOffset`）、子任务最多等 10 分钟（`ChildRuns.MAX_FOLLOW`）。
- 提示词 `SEED_VERSION=v25-2026-10-23-dialogue-no-continue`。无迁移。**未用真模型验证**（§8.0.1 ⑦：上线前至少用线上同款聚算 Qwen 真调一次长任务）。

### H3 视频提示词优化 · 2026-10-27（已生产发布 `20261027-studio-h3-optimize`，main `384dfe31`；server + web-aiavatar）

导演台的 H3 改写抽成全站共用的 `ipstudio/h3/H3PromptRewrite`（官方 skill 资源移到 `resources/h3-skill`），Studio 画布与创作助手出 H3 视频也先优化。**2026-10-27 修正：三处优化统一用后台独立用途 `DAP_VIDEO_PROMPT` 的绑定端点（初始绑定聚算 Qwen），不跟随用户文字模型或剧本默认模型；不可用时报错，不回落其它模型。估价、冻结、结算均按同一绑定端点与输出预算。**
- **画布卡片上的「智能优化」**（`StudioPromptOptimizeToggle`，从参数弹层挪出来）：只对 H3 显示，默认开，开着是 AI 浅紫，关着旁边写「H3 建议开启，台词更完整」；价格后面写「优化另需少量积分」。
  开着发 `video.rewrite="review"`，关着发 `optimizePrompt=false`（原文直发）。**厂商自己的改写不再用**。
- **一行任务两段**：`StudioWorkflowService.submitVideoRewrite` 先预检视频并核对视频报价（制作计划按视频 + 改写上限合计），再冻结改写上限、建 `studio-video` 行；`StudioWorkflowWorker.rewriteVideo` 改写后 `handOver` 在同一个事务里先结算改写（企业在途上限）、再 `generateVideoBatch`，失败整体回滚、改写不扣费；只用模型赠款也照常改写（用户定：以效果为准，积分不够就取消）；
  任务号写进 `_exec.nativeVideoJobIds`，之后按视频任务投影（`videoBindingDto` 加上改写花费并带 `output.videoPrompt`）。改写中 stage `prompt.optimizing`（「正在优化提示词」）。
- **不拦人**：画布（review）有提示时不出片，节点上「优化稿有需要留意的地方，选好再出片」，卡片上 `StudioPromptReview` 给「用优化稿生成 / 用原文生成」（没改成给「重新优化 / 用原文生成」）；
  选择发一次普通视频请求（`optimizePrompt=false`，用优化稿时 prompt 是英文、节点上仍显示中文），记 `studio.promptChoice`，开关仍算开着。创作助手（auto）不停：能用就用，用不了按原文并写 `videoPromptNotes`。
- **创作助手**：出视频 / 原创 / 复刻技能要求按导演台格式写中文（「第N镜（起–止 秒）：」「名字说：「原文」」），这样镜头固定、台词由代码填；制作计划的视频步骤 `ModeSpec.rewrite`，报价加改写冻结上限（`videoRewriteHold`）。
- 规则见 `specs/BUSINESS_RULES.md`「H3 视频提示词改写」；测试 `H3PromptRewriteTest`、`StudioVideoRewriteWorkerTest`、`DirectorH3VideoFlowTest`、`studio-video-prompt-notes.test.tsx`。

### Studio 对话不锁方法（2026-10-23，本地未发布）

真源 `docs/ip-studio-dialogue-intents.md`「2026-10-23：不锁方法」。每条用户消息、每次 `read_skill` / `propose_plan` 都按意图选方法，有活跃制作时也一样（`requireSkillSwitchAllowed`、`ReadSkillTool` 的拒绝、`planningSkill` 的执行锁、受理处「有活跃执行时方法不变 / 显式换技能 400」全部删除）。切换只走 `StudioDialogueService.switchMethod`：同方法不动；换方法时作废待确认卡，旧制作没有在生成的就按停止收尾，有在生成的就暂停并解绑（不取消，完成的结果仍发到原线程的画布，不发消息，不占画布，生成完自行结束）。方案里有当前方法不允许的操作时先换到能覆盖的方法再校验。`STUDIO_SKILL_OPERATION_NOT_ALLOWED`、「第 N 步…不在当前阶段允许的范围内」这类内部原因不进用户界面，统一说「这份方案还没准备好，我会按你要做的内容重新整理。」（`STUDIO_PLAN_NOT_READY`）。提示词 `SEED_VERSION=v26-2026-10-23-dialogue-unlocked-methods`。未用真模型验证。

### Studio 方案素材范围跨轮（2026-10-24，已生产发布 `20261024-studio-plan-material-scope`）

线上 `PEX-fc87e857…`：首轮点选的「三视图」隔两轮才出方案，确认后执行的素材名单里没有它，「编排制作计划」三次被拒、用户点「继续」撞同一个错。现在对话方案的素材范围只由 `StudioPlanMaterials.scope` 算（出方案那轮点选 → 方案 `materialNodeIds` → 步骤点名 → 同一对话更早用户消息的点选 / 附件；只留画布上还在的，≤16），两条加载路径共用，不放开校验、不加整张画布。越界报 `STUDIO_PLAN_MATERIAL_OUT_OF_SCOPE`（列出全部 id），执行停下时用画布标题说清是哪个素材，进度条给「在画布上看 / 加入这次制作，重新编排（`resume.addMaterialNodeIds`）/ 不用它，重新编排」，都只重跑编排、不重跑拉片。提示词要求分析方案写 `materialNodeIds`、替换人物时外观按设定图写、不沿用原片外观。`SEED_VERSION=v27-2026-10-24-plan-material-scope`。真源 `docs/ip-studio-dialogue-intents.md` 末节，规则 `specs/BUSINESS_RULES.md` Studio 对话第 32 条。未用真模型验证。

### 模型接入点赠款与折扣（2026-10-25，已生产发布 `20261025-model-grants`）

真源 `docs/model-billing-design.md`。唯一适用标识为现有 `ai_model_providers.id`；后台每个接入点行可进入「赠款与折扣」。价格沿用既有配置，折扣取适用的最优惠一条、不叠加；折后优先扣该接入点未过期赠款，再扣普通积分。企业折扣自动覆盖其主账号、现有和新成员的企业消费钱包；个人钱包独立。赠款批次、冻结、流水分开记账，不改变原钱包余额。

`ModelChargeContext.forCredits` 接收实际接入点和现有服务端已算好的积分费用；统一计费层处理优惠与资金来源，不分对话、脚本、画布或工作流。追加冻结沿用原价格决定，整笔结算一次取整。V67/V68 建立账务与审批，V69 关联追加冻结；历史资源字段和价格表不作为新配置入口。后台无第二套标准售价和供应商资源配置。用户已确认数字人组合任务按文本与媒体分两笔费用；`DapModelBilling` 编排独立接入点冻结、Token 用量结算和释放，优惠仍归统一计费层。文本完成后媒体失败保留文本实际费用，月用量读真实消费流水。当前验证状态见真源；未上线。

通用积分转赠款（2026-10-25）：后台「积分转赠款」仅 SUPER_ADMIN，把客户的赠送 / 激活码积分（充值永不动）按 ADJUST 流水扣出、同事务发成所选活动的模型赠款，每人默认保留 1000 通用积分；每客户独立事务，`ops_grant_conversion:<requestId>:<userId>` 幂等。见 `specs/BUSINESS_RULES.md` 同节。

评审后修正（2026-10-25）：企业成员报价是只读事务，在途任务数改用不加锁的查询（MySQL 只读事务里 `SELECT … FOR UPDATE` 报 ERROR 1792，`EnterpriseModelQuoteReadOnlyTest` 可指向 MySQL 复现）；视频对账恢复只拦当初用过赠款或折扣的任务；冻结只锁本钱包可用且适用的赠款行，只有带资源计数的活动才锁活动行，且用只取 ID 的查询先锁再读（先读再锁会被 Hibernate 按旧版本号校验）；活动发出赠款后适用接入点锁定（`SCOPED_CAMPAIGN_TARGETS_LOCKED`）；赠款全额抵扣不写零金额普通流水；Studio / 后台 / 短剧 / 服务端报错统一叫「模型赠款」，celebrity 按用户要求不改。另修了一个上线即坏的问题：启动时的 `EnumColumnWideningMigration` 会把 V67 改成 VARCHAR 的流水类型列改回不含 SCOPED_* 的 ENUM，第一笔赠款就报 `Data truncated`；现在流水类型不在加宽清单里，加宽也只处理当前是 ENUM 的列。**往 Hibernate 原生 ENUM 列加值时，要么同步加宽清单，要么像这里一样改成 VARCHAR 并移出清单，两头都不做就会在 MySQL 上坏，H2 测不出来。** 零价接入点一律报 503 `MODEL_PRICE_NOT_CONFIGURED`，免费只能发模型赠款（用户 2026-10-25 拍板）；接入点没填 `model` 时计费记录用 `endpoint:<ID>`（`ModelBillingTarget.providerModelOf`），不拒绝扣费。


### Studio 模型选择（2026-10-25）

用户明确要求恢复模型入口：创作助手输入框底部的 @ / 附件之后是紧凑胶囊按钮，点击切换「对话模型」，不要单独在输入框上方排表单。仅场景 `selectable` 且至少两候选时展示；当前回复期间不可切，按画布记住选择，仅影响后续对话，不替用户改出图 / 视频模型。单价放悬停说明，必须保留小数。此前「不显示模型按钮」的约束被本条取代，技能仍只在头部。
导演台「作品设置 → 图片模型」保存 `settings.imageModel`（null 跟随默认），候选 `imageModels` 只来自 Studio image 场景白名单；资产图 / 分镜图、参考图上限、画幅尺寸、估价、实际生成都用该选择。原模型下架时需重新选择，不悄悄换模型。Seedream 4.5 的真实 ID 是 `doubao-seedream-4-5-251128`，不能把名称含 4.5、实际 model 为 4.0 的旧端点当成它。供应商配置与验收见 `docs/releases/studio-model-switch-20261025.md`。


### 导演台与视频提示词优化输出预算（2026-10-27）

导演台写剧本、拆集、提取资产、分镜脚本，以及画布 / 助手 / 导演台的视频提示词优化不再使用业务代码的 8192 / 16384 / 100000 / 4096 输出上限。新任务的输出预算读取后台端点 defaultMaxTokens，受 chatMaxOutputTokens 能力上限约束；仅默认值缺失时使用端点能力上限，两者均未配置时回落后台 Token 售价配置的 maxOutputTokens。Token 单价与输入预算仍读售价配置，输出预算随端点配置形成受理快照；报价、冻结和调用使用同一快照，不能超出调用方批准的 maxCost。已有任务不改预算、不自动重试。

### 导演台角色声音参考（2026-10-29，本地实现，未发布）

角色音频上传必须使用可写事务，自动入本人素材库会持用户行锁；只把作品查询换成无锁读仍不能修复 MySQL 只读事务 500。样本按真实字节及 ffprobe 校验（MP3 / WAV / M4A，2–15 秒、最多 15 MiB）。`asset.setVoice` 绑定前重验本人 key 与实测时长，当前为聚算全能参考模型时先上传取得回执，失败不替换原声音。人物保存我方 key，V71 `material_video_input_asset` 按端点、地址、模型、凭据及来源 key 隔离 assetId；保存音色与 worker 共用同一路径，距厂商有效期不足 60 秒或没有有效期就重新上传。浏览器绑定失败保留已上传样本重试，不重复上传或误用旧描述版本。不调用声音训练，不表示音色效果已验收。见 `docs/audits/director-voice-reference-validation-20261029.md`。

### 企业手机号添加成员 · 2026-10-29（本地实现，未发布）

`POST /api/v1/ip-studio/enterprises/{id}/members` 接收 `{phone}`，主账号和管理员可直接添加已有、手机号已验证且已开通 aiavatar 的有效产品账号。默认普通成员、无附加授权、零余额；重复添加同企业有效成员幂等返回，其他企业/停用成员拒绝，手机号不入审计。邀请与直接添加共用用户→企业锁顺序。`/enterprise` 成员页新增手机号表单，失败保留输入；刷新按钮沿用品牌次按钮，刷新不卸载管理表单，刷新失败显示旧数据提示。未注册或尚未登录本产品的同事仍可通过分享链接加入。

批量补充（2026-10-29，本地未发布）：添加表单可切换「单个添加 / 批量添加」，每批最多 100 个手机号，支持换行、逗号、分号粘贴并去重。`POST /api/v1/ip-studio/enterprises/{id}/members/batch` 接收 `{phones}`，逐人独立事务执行单人规则，返回成功/失败及原因，失败项保留可重试，已成功关系幂等。
