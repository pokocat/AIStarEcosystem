# AGENTS.md

> 给所有 AI coding agent（Claude Code、Cursor、Aider、Continue、自建 SDK agent…）的统一指引。
> Claude Code 仍然通过 `CLAUDE.md` 注入，但 `CLAUDE.md` 是本文件的 symlink —— 只需维护一份。

**Single sources of truth**

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
- 子产品开通 **enrollment**（v0.149）：「能进哪个子产品」的真值是 `product_enrollment` 表，**后端真拦** —— `EnrollmentGuard` 按 `X-App-Code` 请求头（或 `/api/star`→star、`/api/v1`→aiavatar 前缀）把请求映射到子产品，无 ACTIVE 开通记录 → 403 `PRODUCT_NOT_ENROLLED`，缺头 → 403 `APP_CODE_REQUIRED`；开关 `AEP_ENROLLMENT_ENFORCE` 默认 true，**只允许测试关闭**。`MeDto.platforms` 退化为 active enrollment 的兼容投影（无 enrollment 行才回落读旧 `aep_users.platforms` CSV）。激活码兑换只有一条路径（`EnrollmentService`）：**条件更新占码**（`UPDATE license_key ... WHERE status='CREATED'`，影响 1 行才继续）+ `entitlement_grant` 的 `UNIQUE(source, source_reference)` 双闸，杜绝并发兑换发两份积分；调用方指定的产品不在批次授权范围内先判后占、不烧码。契约见 `specs/BUSINESS_RULES.md` §6.0 与 `apps/server/README.md`「子产品开通（enrollment）」。
- **未绑手机号只读**（微信游客）：账号中心允许「只有微信、没有手机号」的账号登录（令牌 `phone_verified=false`），这类账号在本仓**能看不能改** —— `PhoneVerificationGuard`（挂在 `EnrollmentGuard` 之前）放行 `GET/HEAD/OPTIONS`，任何写方法一律 403 `PHONE_VERIFICATION_REQUIRED`，`error.details.bindUrl` 指向账号中心的绑定入口（由 `aep.identity.issuer` 派生，不硬编码域名）。标记由 `JwtAuthenticationFilter` 写进 `Authentication.details`：RS256 按 `phone_verified` claim（缺 claim 的旧令牌按已验证），legacy HS256 一律 `true`（游客只由账号中心的微信登录建出来，而它从不签 HS256）；标记缺失的内部服务令牌不拦。同时把本地 `aep_users.phone_verified` 按令牌回填（此前 JIT 一律写 false 且无人回填）。前端由 `AuthProvider` 注册回调，403 时整页跳 `bindUrl`。契约见 `apps/server/README.md` §3.5。
- 小程序: **apps/miniprogram**（微信小程序，AI 明星带货线消费方）
- 遗留 **apps/web**（3002，Next 14）已于 **Phase 5（2026-08-03）删除**；类型真源已全部迁至 `packages/types/src/*`，历史沿革见 `docs/VERSION_HISTORY.md`
- `ipstudio` AI IP 工作台（v0.157 起；**v0.190 并入 `apps/web-aiavatar`**，真源 [`docs/ip-studio-plan.md`](docs/ip-studio-plan.md)）：前端不再是独立 app —— 画布在 `apps/web-aiavatar/src/canvas/`、胶水在 `src/canvas-bridge/`、工作台专属代码在 `src/ip/`；`src/ip/canvas-gate.tsx` 是**柔性**设备闸（手机上先提示「电脑上更好用」，但可以选择继续打开；不打开就不下画布 chunk）。样式令牌挂 `.ip-surface` 作用域而非 `:root`（两个 app 有 30 个同名变量、约 22 个值不同，都放 :root 会互相刷掉；见 `src/styles/ip-desktop.css` 头注释）；Tailwind **只引 theme + utilities、不引 preflight**。**不新增产品码**，共用 aiavatar 开通、接口全挂 `/api/v1/ip-studio/**`。**画布是搬来的**（`basketikun/infinite-canvas`，MIT，整体 vendor 进 `apps/web-aiavatar/src/canvas`，见那儿的 README）——**从此由我们维护，上游更新要手动合；搬进来的文件尽量少改、改了留注释**，胶水都放 `src/canvas-bridge/`。画布文档 `doc` 是**客户端拥有**、服务端整存整取不改内容（形状 = `nodes[{id,type,title,position,width,height,metadata}]` + `connections[{fromNodeId,toNodeId}]` + `viewport{x,y,k}`）；节点是通用类型（图 / 文字 / 视频…），**要画什么写在节点自己的 `metadata.prompt` 里，参考图就是连进来的上游图**。生成链复用 dap（`DapMultimodalClient` / `FileStorageService` / `PromptService` / `CreditService`），prompt key `dap.ip_identity` / `dap.ip_canvas_image`，单价 `dap.ip-identity`=2 / `dap.ip-image`=8 后台可配。**出图的参考图由画布点名**（`POST projects/{id}/generate` 带 `refKeys`）—— 用户框了哪几张、蒙版编辑只针对当前这张，服务端从文档回溯猜不出来；服务端管 key 归属闸（`requireOwnedAssetKey`，非本人 key 直接 400 而不是跳过）、提示词模板、模型白名单、计价与结算。计费照 `DramaReferenceAssetService` 范式：preflight（引擎 / 提示词）在 hold 之前、整批一次 hold、单价快照进 `_exec`、每张成功 commit 后才写候选；**worker 派发必须挂在 `afterCommit`**（事务里直接派发会让 worker 查不到行、任务永远 `queued`，真联调踩过）。**画布出视频**走通用视频链（`MaterialVideoJobService` 分区 `APP_IPSTUDIO`），不是 dap 的数字人衍生视频 —— 那条要求先有 `avatarId`（必须发布之后）。**模型配置在后台不在浏览器**：`GET /v1/ip-studio/models` 的候选来自 `AiAppBinding` + `ai_app_endpoint_candidate`（同短剧线 `render/models`），用户能选模型但不能填 Key；上游那套「Key 存 IndexedDB 直连厂商」已剥掉。**签名 URL 有 TTL（1h）而画布一开半天**：文档里只存 `storageKey`，出 wire 由 `resignDocAssetUrls` 按 key 重签（节点级与 `metadata.images[]` 两处都要，漏一处就是「有的图好的有的裂」），前端图加载失败时走 `POST /assets/sign` 换新地址。**画布本地持久化已改成纯内存**（服务端唯一真值），**加载完成前不渲染画布** —— 否则画布认为项目是空的，自动保存会把服务端内容覆盖掉。**上游的插件市场已关**（默认从 CDN 拉第三方代码进页面执行；要开必须先有我方托管 + 签名 + 白名单）。发布零积分：建 `DapAvatar(path=ai, status=finalized)` + `DapLook(source=design)`，重复发布 409 `IP_PROJECT_ALREADY_PUBLISHED`。表 `ip_project` / `ip_run` 走 **V27** SQL 迁移。

- `clip` 口播视频线（v0.132）：服务端独立 clip 域供军师 BFF 通过 service token + `externalOwnerId` 调用；Scheme A 下本仓不扣军师用户积分。作品 DTO 用任务 `createdAt` 和终态 `completedAt` 分别提供开始生成/真实成片时间，发布修改项目不得篡改成片时间；`DELETE /api/me/clip/works/{id}` 会取消该项目全部活跃 job，并把项目软删进现有 30 天回收区。本人素材必须走受限 OSS V4 PostObject 单次直传 + `clip_upload_session` 持久化受理；owner + clientRequestId 唯一，HEAD 精确核验后异步深检与供应商提交，HEVC/H.265 形象视频先转 H.264/AAC，禁止因客户端超时重传或重复建任务。项目把可编辑文案 `segments` 与视觉 `shots[{startNo,endNo,role,assetId}]` 分层；`ClipShotPlan` 是报价、preflight、worker 与总装的唯一投影层。一个 shot 可让多句共用画面，但 `materialize()` 必须保留逐句 `captions[{sourceNo,text,durationSec}]`，总装按真实段音频总时长比例缩放每句时间窗、逐张叠加字幕，禁止把合并文案烧成一张两行省略图。石榴链路统一采用 **V2 音色 TTS → avatar 段 `createByVoiceV2` 音频驱动**，b-roll 与数字人段共享同一音频生成策略。`ClipCapturePolicy` 用 ffprobe 在供应商调用前硬验形象/声音素材；声音真实时长必须 `>2s`，形象视频 `>=5s`，较长时长只作质量建议。`/avatar/create` 的 `speakerId` 只是制作 demo 的选填参数，`authId` 也只在确需授权校验时选填：数字人主链必须允许一段视频直接启动 Avatar 训练，不得恢复 `CLIP_CONSENT_REQUIRED` 或先采声音硬闸。没有可用音色时，服务 best-effort 从形象视频提取原声创建基础 V2 speaker；提取/声音训练失败不回滚形象，专属声音是独立增强。数字分身必须按 `DapAvatar` 多条资产返回，项目保存精确 `avatarId/voiceId`，worker 只解析项目指定的 engineRef；新形象可复用已有 ready `DapVoice`，单个形象可独立删除，禁止静默退回最新形象。`AvatarDto.voiceSource` 必须用 `video|dedicated` 区分视频原声与用户主动补录，供端上准确展示训练进度和增强完成结果。形象 ready 即代表数字人创建完成；真正出片仍需 speaker，视频原声不可用时 preflight 引导补录。上传形象视频时 `ClipAvatarPreviewExtractor` 必须先抽取约 0.5 秒 JPEG 并写入 `DapAvatar.imageKey`，`AvatarDto.imagePreviewUrl` 返回签名地址；老记录缺图时 `view()` best-effort 回填。普通视频素材由 `ClipAssetThumbnailExtractor` 抽取独立 JPEG 到 `ClipAsset.thumbnailCdnKey`，`AssetDto.previewUrl` 对图片指向原图、对视频只指向缩略图，禁止把视频源 URL 冒充 image 预览；`AssetDto.contentUrl` 返回原始媒体短期签名地址，只供用户主动点开预览，不得用于列表自动加载。旧视频素材可在读取时 best-effort 补图，删除同步清理缩略图。模板固定片段由 admin preset asset + `tailClips.assetId` 配置，DTO 必须同步回传片段名称、秒数、封面、视频并把同一配置写入项目骨架；内置竖屏固定视频只补缺失配置。完成作品若缺缩略图，读取时从最终 MP4 补抽。该字段必须由独立 `V15` 迁移添加，禁止修改已执行的 V14 导致 Flyway 校验和漂移。微信 `tmp_*`/长哈希文件名在 DTO 层归一为可读默认名。删除全部分身时必须遍历并软删该 owner 下全部未删除的石榴 Avatar/Voice 版本，同时请求供应商删除各 engineRef，并清理原始素材和预览帧；所有石榴时效结果均先镜像我方存储，再由 `ClipAssemblyService` 归一为 720×1280 H.264/AAC、烧录逐句字幕、按 `subtitleStyle.aiWatermark` 可选烧录「AI 生成」（缺省关闭）、混 BGM、固定品牌尾卡并做亮度/响度/真峰值质量门。`AEP_CLIP_FORCE_MOCK=true` 只供不耗点数的确定性测试媒体，production/mysql 硬拒绝；测试总装仍永久烧录独立「测试演示」标识。媒体机器审核、本人素材的供应商质量实测与四平台真实代发仍是生产门槛。当前事实见 `docs/clip-avatar-video-plan.md`。
- `clip` 配音预览与段级状态红线（v0.150）：`POST|GET /api/me/clip/projects/{id}/tts-preview` 一个项目只存一份预览（表 `clip_tts_preview`，**新迁移 V26**；编号横跨 `resources/db/migration/*.sql` 与 `src/main/java/db/migration/*.java` 两处，已执行的一律不改）。`timelineHash = sha256(voiceId + 每镜 no/role/文案)`，POST 幂等（同哈希且上次非 failed 直接返回已有结果，failed 允许重排一次），GET 只认当前这版文案、旧一版一律 404 `CLIP_TTS_PREVIEW_NOT_FOUND`。合成粒度必须是 `ClipShotPlan.materialize` 的**镜头**，与出片 tts 阶段同一套切分 —— 预览听到的就是成片会用的那条音频，段编号也因此与段级状态天然对齐。音频先镜像我方存储再出**短期签名 URL**，库里只存 key，签名 URL 既不落库也不进日志。没有可用音色 / 引擎未配置 / 供应商失败 / 拿不到可镜像的音频，一律 `status:"failed"` + 明确 `errorCode`，禁止用空 URL 或静音占位冒充成功（静音 WAV 只在 `AEP_CLIP_FORCE_MOCK` 的确定性测试媒体下产生）。`credits` 恒为 0：Scheme A 下 clip 域不碰钻石账本，试听只花石榴 `validPoint`。`GET /api/me/clip/jobs/{id}` 的 `segments[{no,role,status,errorCode?}]` 是 `segmentJobsJson` 的**只读投影**，不得新增第二处真值；出片失败必须落到具体那一段（第一段没留下产物的那一段）并带 `errorCode`；worker 没写过状态时返回空数组，让调用方回落整体进度。`script/ai-rewrite` 的 `scope:"all"` 里 `text` 是**改写/生成指令**（一句话 brief，≤500 字），按模板骨架逐段生成、不改段数不改 role、不动结尾固定段；真模型仍未接入，非 mock 网关一律 503 `CLIP_SCRIPT_ENGINE_NOT_CONFIGURED`，不许拿模板句冒充生成结果。
- `clip` 成片音频红线（v0.135）：最终音轨必须经 `ClipLoudnessNormalizer` 两遍测量/归一，处理目标为 -16 LUFS / -2.5 dBTP（给 AAC 编码回弹留余量）；编码后的真实文件仍以 ≤ -1 dBTP 失败关闭并记录实测指标，禁止通过放宽质量门掩盖峰值问题。
- `clip` 预发部署运维红线（2026-08-15）：军师宿主 `/tmp` 是最大 3.7GiB 的 tmpfs，`deploy-clip-preprod.sh` 上传的时间戳 JAR 必须由远端 `trap` 在成功/失败时删除，并在下次预检时兜底清理超过 60 分钟的同类残留；禁止把 `/tmp/aistareco-clip-*.jar` 留成随发布次数增长的 Shmem 占用。
- 视频生成（v0.131）：聚算 JusuanHub `minimax-h3` 走独立媒体 Job 协议（`/media/generations` → `/jobs/{id}?model=minimax-h3` → 受保护 `/assets/{id}/content?model=minimax-h3` 镜像 OSS），Account API Key 的查询/下载必须携带模型作用域，不能按 GENERIC `/videos/generations` 调。端点 `billingMode=PER_SECOND` + 候选 `creditCostOverride=40` 表示 40 积分/秒，带货与短剧入口都必须在 hold 前按费率×时长展开；存量端点仍按次。**首帧参考图（i2v）v0.183 已接通**：聚算的图不给 URL —— 先 `POST {base}/v1/assets/input?model=<别名>`（multipart，字段名 `image`）换 `asset.assetId`，再把它放进 `createMediaGeneration` 的 `input_image_asset_id`，并把必填的 `generationMode` 从 `t2v` 改成 `i2v`。**尾帧 / 多参考图 / 544p / 六种画布 / seed 只在「视频生成区」开放（v0.199，分区 `video-studio`，真源 `docs/video-studio-plan.md`）**：入参只由 `VideoGenSpec.fromVariantConfigJson` 一处解析，`MaterialVideoJobService.submit` 的分区闸挡住别的分区夹带原生规格（首帧 key 只许 `ipstudio` / `video-studio` / `drama` —— 三处的 variant_config 都由服务端组装、写 key 前验过归属；带货素材运营的入口原样透传客户端的 variant_config，所以挡着；新增分区放行首帧前先确认它不透传）；**没有清晰度的老路径（画布 / 脚本视频 / 短剧）只按画面比例补齐**：2026-10-03 厂商把「只发 `orientation`」的竖屏默认改成了 3:4，老路径横竖两档改为也带 `aspectRatio` + `outputSizeCode`（取值同视频生成区，#120），1:1 仍只发 `orientation`（`square` 这个值厂商认，视频生成区 10-03 真厂商实测出了 768×768）；除此之外字段不变，其它产品线仍只有首帧，候选的 `supportsFirstLastFrame` 对它们照旧是 false。非聚算协议的首帧 key 经 `FileStorageService.upstreamFetchUrl`（签名优先）交给厂商，不再静默丢。调用方自己定价（item 带 `credit_cost`）的任务 payload 标 `caller_priced`，管理端对账按冻结价结算。视频生成区的价格是**我们自己定的**（平台配置 `celebrity.video-studio-pricing`，每格 = 配置 ?? 候选每秒价（>0 才算）?? 未定价 → 503 `VIDEO_STUDIO_PRICE_NOT_CONFIGURED`），不照搬厂商价；智能优化走厂商 `/media/prompt-optimizations`（同步但最长约 10 分钟，`Idempotency-Key` = `clientRequestId` = 我方记录 id，重试必须同键同正文），**状态迁移与积分结算必须在同一个事务里**，派发挂 `afterCommit`。上传失败一律抛（`VIDEO_REF_UPLOAD_FAILED`），**不静默退回 t2v** —— 用户接了参考图却出一条无关的片，比直接报错难排查得多（§8.0）。误判失败但已有 `externalTaskId` 的任务只能走管理端对账恢复，禁止重新提交。**成片封面**（v0.199.1）：厂商不给（聚算 H3 就不给）时 worker 从成片截一帧（`MaterialVideoCover`，best-effort，截不出不影响出片与结算），视频生成区的老任务启动时后台补（`MaterialVideoCoverBackfill`）。

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
├── docs/                   # 跨应用文档（INDEX 索引 + ADMIN_PRODUCT_SPEC 等）
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
| **v0.207** | ✅ 本地，未发布 | Studio创作首页：主要功能直达、近期画布/模板、想法保存与原项目恢复；品牌保留，见 `docs/ip-studio-home.md` |
| **v0.206** | 2026-10-08 | Studio 界面区域分离、响应式工具/生成面板；人物库/添加/引用/商品/模板选择统一，精确版本回填与取消恢复；本地未发布，见 docs/ip-studio-ui-audit.md |
| **v0.205** | 2026-10-08 | Studio IP 人物库按人物汇总，素材详情/筛选/默认声音与精确版本引用；V45 素材分类与免费整理，浏览器恢复/账本验收通过。设定图系统提示词冲突已修，两次实图均未通过质量，未发布 |
| **v0.204** | 2026-10-08 | 有限图片模板执行/采用/费用上限/CAS重做与恢复、中文展示板/原图ZIP/归档/本人指标；进阶真实6/8部分输出，默认按用户澄清改为一次设定图，仅报价/免费套用通过，单图质量待验，未发布 |
| **v0.203** | 2026-10-08 | M7.1 模板输入槽、不可变发布版本、个人/官方范围、当前模型报价与独立套用；V44，两个不同人物输入/v1-v2/停用恢复和零账本变化通过。依赖执行、真实人物资产包及展示板仍待完成，未发布 |
| **v0.202** | 2026-10-08 | 统一 Studio M0–M4 真实 Agnes 本地验收通过；新增四模式导演助手、分集与有费用上限的连续制作，双集出片及刷新恢复通过；商品脚本/素材与中文包装通过，Qwen3 TTS 配音与 X-Dub 同音频口型短样片真实通过，人物固定声音版本绑定已接，专属声音未接；模板清理作者运行，标准模板 M7 有独立方案；V40–V43，未发布 |
| **v0.201** | 2026-10-07 | 画布完整生成历史与最近 50 版恢复；加入资产改云端并在顶部资产页显示；V39 文档 LONGTEXT，旧本人素材迁移，切页先保存 |
| **v0.200** | 2026-10-07 | 接手整合开放修复 PR；名片完整资产归属、混剪下载边界、视频镜像退款、DAP afterCommit；发布 retry_count 走 V38，首次冻结保留裸 jobId 兼容在途任务 |
| **v0.199.1** | 2026-10-04 | 视频生成区真厂商实测后的修补：厂商不给封面，worker 就从成片截一帧当封面（`MaterialVideoCover`，老任务启动时后台补），模板卡片不再是黑块；智能优化结果是英文时加一句说明，演示数据照真厂商改成英文。1:1 的 `square` 实测通过 |
| **v0.199** | 2026-09-30 | 明星带货新增「AI 创作 → 视频生成」（`/studio/video`）：把 MiniMax H3 四种原生模式原样搬过来（文生 / 首帧 / 首尾帧 / 全能参考，768p·544p × 六种画布，5–15 秒），出片复用通用视频链（分区 `video-studio`）；价格我们自己定、后台「引擎定价 → 视频生成」可配；可选的提示词智能优化（默认勾上，优化完能改再生成）；作品存为模板、做同款（官方模板只有运营能发）；V37 两张新表；顺手修画布选模型不生效、非聚算协议丢首帧、老接口可夹带原生规格、对账错价、工作台底部被裁 |


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
- 4xx 的 message **直出给用户**（截断，脱敏）：它说的是「我们请求哪儿不对」，
  是用户唯一据以行动的信息，而对一个永远不会自己好的 400 说「请稍后重试」本身就是错的。
  5xx 才笼统 + 状态码（厂商自己的问题，细节留日志）。响应体不是 JSON 时不外泄
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
| 加新文档 | 同时在 `docs/INDEX.md` 添加一行（含 last-reviewed 日期） |
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

真实“小紫 · 自然声 v1”使用 Vivian 与“自然明快，像朋友一样介绍。”，原试听 3.52 秒；同版本新台词生成 WAV 4.96 秒，唯一新增消费 8 积分。v2 以新台词为试听，保留同一官方音色/风格；v1/v2 采纳重放、默认切换及原任务重放没有新增账本记录，旧任务仍是 v1。两版本均能在画布查看和试听，当前默认切回 v1。证据见 `docs/ip-studio-unified-canvas-validation.md` §13。专属声音克隆、长口播和生产整体发布验收仍未完成。


### v0.203 · 2026-10-08 · Studio 模板发布版本与输入表单（本地通过，未发布）

沿用 IpDemoTemplate/IpTemplateResolver，增加个人与官方可见范围、不可变 IpTemplateVersion（V44）及 Project.templateVersionId。本人在同一画布配置图片/IP、文字或选项输入、图片步骤、依赖、尺寸、输出角色和采用确认点；个人模板仅本人可见，官方发布仍需超级管理员。模板发布只按白名单重建配方与画布，作者媒体、历史候选、任务、身份、对话和批准不进入版本；旧接口不能覆盖版本模板或删除历史发布，旧模板和项目保持兼容。

用户先填自己的真实图片或精确 IP 图片版本，使用平台当前 DAP_IMAGE 配置预览逐步费用，再免费创建独立画布。每份实例重建 node/connection id、保留自己的输入并锁定来源版本；模板更新后旧画布不跟随变化，下架阻止新套用，旧画布仍可恢复创建时计划。发布与套用均不启动模型、不冻结积分；生成任务仍走原生 IpRun/账本。新增本人模板停用/启用、来源版本与创建时计划查看。商品入口同步修复仅引用旧人物图片时漏显示驱动/声音状态，多人物引用不猜默认出镜人。

M7.1 验收：两个不同人物输入分别建立独立画布，8 图片配方按当前单价报价 64 积分，v1/v2 锁定、停用阻止新建、恢复与作者私有素材清理通过，账本零变化。M7.2 的依赖执行/人工采用暂停/单步恢复与 M7.3 中文展示板/资产包归档尚未完成，八张图片尚未生成；不能将准备好的画布标为成功资产包。验证记录见 `ip-studio-unified-canvas-validation.md` §14。

### v0.204 · 2026-10-08 · 图片模板执行与一次人物设定图（本地，未发布）

有限图片配方复用原生 IpRun/账本，支持依赖、人工采用、逐步费用上限、单步指令调整、显式 CAS 重做和同键恢复；原任务/候选保留，上游变化标记过期，不自动重跑。未知受理结果不能修改原正文后重新提交。画布文档仍由客户端维护，执行指针和模板来源由服务端维护。

进阶模板可免费将采用且未过期的原图打包为 ZIP（来源清单）与可读中文展示板；部分选择明确显示 n/总数。主形象与人物造型显式归档，归档/打包重放复用原结果。本人版本统计派生自原生任务实际费用和采用状态，不含全平台指标。真实进阶样例14次生成/112积分、同请求恢复零新增扣费、pending=0；六张通过并在浏览器完成6/8部分资产包下载，两张仍因侧视角/面部风格未通过，不称完整成功。

按用户澄清，默认旗舰模板改为一个 `sheet` 图片步骤，一次生成一张包含人物档案、三视图、表情、面部/服装细节、配饰与材质配色的设定图。整图继续供图像参考，先生成单独镜头再做视频；独立资产/拼板为可选进阶流程。提示词见 `docs/prompts/ip-character-sheet.md`，按用户附图编写，不称作者原词。本地个人模板与独立实例只验证一张/8积分报价、零生成/零扣费；一次成图质量及整图参考出镜头尚待真实验收。代码与新增表尚未生产发布，详情见 `docs/ip-studio-unified-canvas-validation.md` §15。

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

`IpRunDto.queue`/原生视频候选 `queue` 是持久票据的实时只读投影：同一接入端点 FIFO 等待位次从 1 开始，已执行/结束为空；不持久化位次，不向客户端暴露其他用户任务。前端沿用 1.2 秒运行轮询，画布/任务列表统一提示、停止原请求，终态防迟到响应覆盖。不得编造倒计时或 ETA；验证见 `docs/ip-studio-unified-canvas-validation.md` §37。

### v0.220 · 模型接入端点并发（2026-10-09，本地未发布）

用户确定按端点而非 vendor 分组。`concurrencyLimit` 在原后台配置，V48 增列与持久票据；`AiGenerationQueueService` 的端点行锁、FIFO 和派发租约为准入唯一真值。Studio 和通用视频 worker 超限即退出线程并排队，旧同步 chat/images 调用共用同一额度；ThreadLocal Scope 防内部重复占名额，结束必须清理。视频和配音/口型持有到上游终态，未知受理不可释放容量后重提；排队时长不当运行超时/孤儿 hold，停止退回原冻结。原业务任务/账本仍各自真值，票据不能保存密钥、素材或提示词。其他协议及人工容量核对边界见 `docs/ai-endpoint-generation-queue.md`。


### v0.222 · Studio 画布浮层（2026-10-09，本地未发布）

创作操作默认在画布内无蒙层浮层，禁止恢复为强制右侧 Drawer。`studio-floating-panel.tsx` portal 到 stage 屏幕层，视口/节点 context 与 ResizeObserver 定位，不随画布缩放、不轮询 DOM；模型/费用/提交 footer 固定。助手默认可拖动浮窗，停靠为显式选择；普通节点选择不关闭工具浮窗。人物库返回保持原节点/草稿/视口，展开编辑器关闭回原内容。工作台 async session guard 防旧请求关闭新面板，助手历史草稿按项目/对话缓存在内存，不能写进已受理请求。无后端/API 改动，证据见统一验证 §38；手机/生产未验收。

### v0.223 · Studio 节点与浮层上下文（2026-10-09，本地未发布）

业务节点路由先于泛型媒体，单击/双击/右键与旧 editor 命令共用 `studio-node-command.ts`。口型入口固定打开对象，不读取动态 selected；视频有效输入与提示词 @ 编号共用映射，换序按 nodeId 重绑，移除被引用素材必须修正后才可生成。舞台内浮层焦点/层级与 Esc 统一；口型报价/执行固定 footer。剧本编辑器本体暂缓，后续 Markdown 专项。88 个不同定向用例、桌面零生成验收、类型/契约通过；独立 review `ship` 仅评价这五项，证据统一验证 §39，未部署。

### Studio 正式积分价格（v0.228）

新增配音/口型使用平台配置 `ipstudio.supplier-point-pricing`，供应商积分与平台积分当前 1:1，加 50% 溢价；不得将旧本地 8 积分/次、10 积分/秒作为正式成本。端点 `unitPriceMicros` 是金额，不承载聚算积分。整笔计费取整，价格快照随任务保存，预冻结多余部分经账本释放。未核实供应商单价的模型不开放调用。

### Studio 连线引用（v0.229）

连线是生成输入，不是装饰：从右侧输出端口拖到空白处，保留预览线并出现“引用该节点生成”菜单；文本/图片/视频新草稿与输入连接必须一次写入文档，再打开对应创作浮层。连接已有节点支持目标端口及节点内容区；自连、重复连线不新增。剪刀删除、撤销和保存刷新复用文档连接真值。断开媒体引用同步清掉当前创作面板的输入，不修改已受理请求；文字连线使用当前富文本稿快照拼入请求，并显示可移除的文本引用。不要再仅实现 `onConnect` 而遗漏 `onConnectEnd` 空白落点。

2026-10-10 线上 H3 首帧失败已定位为配置的 `api.jusuanhub.com:10443` 连接超时；标准 HTTPS `/v1` 已核实模型及输入资产上传后修正，未重提用户任务。端点密钥、模型、价格与并发限制保持原样。

### v0.230 账号与旧 Studio 外壳 · 2026-10-10

`src/shell/account-workspace.tsx` + `account-navigation.ts` 是桌面 `/me` 与 `/studio` 账号工具的共享外壳/入口映射；样式在 `account-workspace.css`，跟随 `html[data-layout]`。旧根入口转 `/projects`，业务深链、创建参数与 `#/real-auth/{sessionId}` 保留；账号菜单 hashchange/popstate 与旧 SPA 同步。详情与创建继续复用 proto 业务，未新增账号、计费或任务真值。见 `docs/aiavatar-account-unification.md`。
