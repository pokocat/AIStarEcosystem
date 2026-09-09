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
- 小程序: **apps/miniprogram**（微信小程序，AI 明星带货线消费方）
- 遗留 **apps/web**（3002，Next 14）已于 **Phase 5（2026-08-03）删除**；类型真源已全部迁至 `packages/types/src/*`，历史沿革见 `docs/VERSION_HISTORY.md`
- `ipstudio` AI IP 工作台（v0.157 起；**v0.190 并入 `apps/web-aiavatar`**，真源 [`docs/ip-studio-plan.md`](docs/ip-studio-plan.md)）：前端不再是独立 app —— 画布在 `apps/web-aiavatar/src/canvas/`、胶水在 `src/canvas-bridge/`、工作台专属代码在 `src/ip/`；`src/ip/canvas-gate.tsx` 是**柔性**设备闸（手机上先提示「电脑上更好用」，但可以选择继续打开；不打开就不下画布 chunk）。样式令牌挂 `.ip-surface` 作用域而非 `:root`（两个 app 有 30 个同名变量、约 22 个值不同，都放 :root 会互相刷掉；见 `src/styles/ip-desktop.css` 头注释）；Tailwind **只引 theme + utilities、不引 preflight**。**不新增产品码**，共用 aiavatar 开通、接口全挂 `/api/v1/ip-studio/**`。**画布是搬来的**（`basketikun/infinite-canvas`，MIT，整体 vendor 进 `apps/web-aiavatar/src/canvas`，见那儿的 README）——**从此由我们维护，上游更新要手动合；搬进来的文件尽量少改、改了留注释**，胶水都放 `src/canvas-bridge/`。画布文档 `doc` 是**客户端拥有**、服务端整存整取不改内容（形状 = `nodes[{id,type,title,position,width,height,metadata}]` + `connections[{fromNodeId,toNodeId}]` + `viewport{x,y,k}`）；节点是通用类型（图 / 文字 / 视频…），**要画什么写在节点自己的 `metadata.prompt` 里，参考图就是连进来的上游图**。生成链复用 dap（`DapMultimodalClient` / `FileStorageService` / `PromptService` / `CreditService`），prompt key `dap.ip_identity` / `dap.ip_canvas_image`，单价 `dap.ip-identity`=2 / `dap.ip-image`=8 后台可配。**出图的参考图由画布点名**（`POST projects/{id}/generate` 带 `refKeys`）—— 用户框了哪几张、蒙版编辑只针对当前这张，服务端从文档回溯猜不出来；服务端管 key 归属闸（`requireOwnedAssetKey`，非本人 key 直接 400 而不是跳过）、提示词模板、模型白名单、计价与结算。计费照 `DramaReferenceAssetService` 范式：preflight（引擎 / 提示词）在 hold 之前、整批一次 hold、单价快照进 `_exec`、每张成功 commit 后才写候选；**worker 派发必须挂在 `afterCommit`**（事务里直接派发会让 worker 查不到行、任务永远 `queued`，真联调踩过）。**画布出视频**走通用视频链（`MaterialVideoJobService` 分区 `APP_IPSTUDIO`），不是 dap 的数字人衍生视频 —— 那条要求先有 `avatarId`（必须发布之后）。**模型配置在后台不在浏览器**：`GET /v1/ip-studio/models` 的候选来自 `AiAppBinding` + `ai_app_endpoint_candidate`（同短剧线 `render/models`），用户能选模型但不能填 Key；上游那套「Key 存 IndexedDB 直连厂商」已剥掉。**签名 URL 有 TTL（1h）而画布一开半天**：文档里只存 `storageKey`，出 wire 由 `resignDocAssetUrls` 按 key 重签（节点级与 `metadata.images[]` 两处都要，漏一处就是「有的图好的有的裂」），前端图加载失败时走 `POST /assets/sign` 换新地址。**画布本地持久化已改成纯内存**（服务端唯一真值），**加载完成前不渲染画布** —— 否则画布认为项目是空的，自动保存会把服务端内容覆盖掉。**上游的插件市场已关**（默认从 CDN 拉第三方代码进页面执行；要开必须先有我方托管 + 签名 + 白名单）。发布零积分：建 `DapAvatar(path=ai, status=finalized)` + `DapLook(source=design)`，重复发布 409 `IP_PROJECT_ALREADY_PUBLISHED`。表 `ip_project` / `ip_run` 走 **V27** SQL 迁移。

- `clip` 口播视频线（v0.132）：服务端独立 clip 域供军师 BFF 通过 service token + `externalOwnerId` 调用；Scheme A 下本仓不扣军师用户积分。作品 DTO 用任务 `createdAt` 和终态 `completedAt` 分别提供开始生成/真实成片时间，发布修改项目不得篡改成片时间；`DELETE /api/me/clip/works/{id}` 会取消该项目全部活跃 job，并把项目软删进现有 30 天回收区。本人素材必须走受限 OSS V4 PostObject 单次直传 + `clip_upload_session` 持久化受理；owner + clientRequestId 唯一，HEAD 精确核验后异步深检与供应商提交，HEVC/H.265 形象视频先转 H.264/AAC，禁止因客户端超时重传或重复建任务。项目把可编辑文案 `segments` 与视觉 `shots[{startNo,endNo,role,assetId}]` 分层；`ClipShotPlan` 是报价、preflight、worker 与总装的唯一投影层。一个 shot 可让多句共用画面，但 `materialize()` 必须保留逐句 `captions[{sourceNo,text,durationSec}]`，总装按真实段音频总时长比例缩放每句时间窗、逐张叠加字幕，禁止把合并文案烧成一张两行省略图。石榴链路统一采用 **V2 音色 TTS → avatar 段 `createByVoiceV2` 音频驱动**，b-roll 与数字人段共享同一音频生成策略。`ClipCapturePolicy` 用 ffprobe 在供应商调用前硬验形象/声音素材；声音真实时长必须 `>2s`，形象视频 `>=5s`，较长时长只作质量建议。`/avatar/create` 的 `speakerId` 只是制作 demo 的选填参数，`authId` 也只在确需授权校验时选填：数字人主链必须允许一段视频直接启动 Avatar 训练，不得恢复 `CLIP_CONSENT_REQUIRED` 或先采声音硬闸。没有可用音色时，服务 best-effort 从形象视频提取原声创建基础 V2 speaker；提取/声音训练失败不回滚形象，专属声音是独立增强。数字分身必须按 `DapAvatar` 多条资产返回，项目保存精确 `avatarId/voiceId`，worker 只解析项目指定的 engineRef；新形象可复用已有 ready `DapVoice`，单个形象可独立删除，禁止静默退回最新形象。`AvatarDto.voiceSource` 必须用 `video|dedicated` 区分视频原声与用户主动补录，供端上准确展示训练进度和增强完成结果。形象 ready 即代表数字人创建完成；真正出片仍需 speaker，视频原声不可用时 preflight 引导补录。上传形象视频时 `ClipAvatarPreviewExtractor` 必须先抽取约 0.5 秒 JPEG 并写入 `DapAvatar.imageKey`，`AvatarDto.imagePreviewUrl` 返回签名地址；老记录缺图时 `view()` best-effort 回填。普通视频素材由 `ClipAssetThumbnailExtractor` 抽取独立 JPEG 到 `ClipAsset.thumbnailCdnKey`，`AssetDto.previewUrl` 对图片指向原图、对视频只指向缩略图，禁止把视频源 URL 冒充 image 预览；`AssetDto.contentUrl` 返回原始媒体短期签名地址，只供用户主动点开预览，不得用于列表自动加载。旧视频素材可在读取时 best-effort 补图，删除同步清理缩略图。模板固定片段由 admin preset asset + `tailClips.assetId` 配置，DTO 必须同步回传片段名称、秒数、封面、视频并把同一配置写入项目骨架；内置竖屏固定视频只补缺失配置。完成作品若缺缩略图，读取时从最终 MP4 补抽。该字段必须由独立 `V15` 迁移添加，禁止修改已执行的 V14 导致 Flyway 校验和漂移。微信 `tmp_*`/长哈希文件名在 DTO 层归一为可读默认名。删除全部分身时必须遍历并软删该 owner 下全部未删除的石榴 Avatar/Voice 版本，同时请求供应商删除各 engineRef，并清理原始素材和预览帧；所有石榴时效结果均先镜像我方存储，再由 `ClipAssemblyService` 归一为 720×1280 H.264/AAC、烧录逐句字幕、按 `subtitleStyle.aiWatermark` 可选烧录「AI 生成」（缺省关闭）、混 BGM、固定品牌尾卡并做亮度/响度/真峰值质量门。`AEP_CLIP_FORCE_MOCK=true` 只供不耗点数的确定性测试媒体，production/mysql 硬拒绝；测试总装仍永久烧录独立「测试演示」标识。媒体机器审核、本人素材的供应商质量实测与四平台真实代发仍是生产门槛。当前事实见 `docs/clip-avatar-video-plan.md`。
- `clip` 配音预览与段级状态红线（v0.150）：`POST|GET /api/me/clip/projects/{id}/tts-preview` 一个项目只存一份预览（表 `clip_tts_preview`，**新迁移 V26**；编号横跨 `resources/db/migration/*.sql` 与 `src/main/java/db/migration/*.java` 两处，已执行的一律不改）。`timelineHash = sha256(voiceId + 每镜 no/role/文案)`，POST 幂等（同哈希且上次非 failed 直接返回已有结果，failed 允许重排一次），GET 只认当前这版文案、旧一版一律 404 `CLIP_TTS_PREVIEW_NOT_FOUND`。合成粒度必须是 `ClipShotPlan.materialize` 的**镜头**，与出片 tts 阶段同一套切分 —— 预览听到的就是成片会用的那条音频，段编号也因此与段级状态天然对齐。音频先镜像我方存储再出**短期签名 URL**，库里只存 key，签名 URL 既不落库也不进日志。没有可用音色 / 引擎未配置 / 供应商失败 / 拿不到可镜像的音频，一律 `status:"failed"` + 明确 `errorCode`，禁止用空 URL 或静音占位冒充成功（静音 WAV 只在 `AEP_CLIP_FORCE_MOCK` 的确定性测试媒体下产生）。`credits` 恒为 0：Scheme A 下 clip 域不碰钻石账本，试听只花石榴 `validPoint`。`GET /api/me/clip/jobs/{id}` 的 `segments[{no,role,status,errorCode?}]` 是 `segmentJobsJson` 的**只读投影**，不得新增第二处真值；出片失败必须落到具体那一段（第一段没留下产物的那一段）并带 `errorCode`；worker 没写过状态时返回空数组，让调用方回落整体进度。`script/ai-rewrite` 的 `scope:"all"` 里 `text` 是**改写/生成指令**（一句话 brief，≤500 字），按模板骨架逐段生成、不改段数不改 role、不动结尾固定段；真模型仍未接入，非 mock 网关一律 503 `CLIP_SCRIPT_ENGINE_NOT_CONFIGURED`，不许拿模板句冒充生成结果。
- `clip` 成片音频红线（v0.135）：最终音轨必须经 `ClipLoudnessNormalizer` 两遍测量/归一，处理目标为 -16 LUFS / -2.5 dBTP（给 AAC 编码回弹留余量）；编码后的真实文件仍以 ≤ -1 dBTP 失败关闭并记录实测指标，禁止通过放宽质量门掩盖峰值问题。
- `clip` 预发部署运维红线（2026-08-15）：军师宿主 `/tmp` 是最大 3.7GiB 的 tmpfs，`deploy-clip-preprod.sh` 上传的时间戳 JAR 必须由远端 `trap` 在成功/失败时删除，并在下次预检时兜底清理超过 60 分钟的同类残留；禁止把 `/tmp/aistareco-clip-*.jar` 留成随发布次数增长的 Shmem 占用。
- 视频生成（v0.131）：聚算 JusuanHub `minimax-h3` 走独立媒体 Job 协议（`/media/generations` → `/jobs/{id}?model=minimax-h3` → 受保护 `/assets/{id}/content?model=minimax-h3` 镜像 OSS），Account API Key 的查询/下载必须携带模型作用域，不能按 GENERIC `/videos/generations` 调。端点 `billingMode=PER_SECOND` + 候选 `creditCostOverride=40` 表示 40 积分/秒，带货与短剧入口都必须在 hold 前按费率×时长展开；存量端点仍按次。**首帧参考图（i2v）v0.183 已接通**：聚算的图不给 URL —— 先 `POST {base}/v1/assets/input?model=<别名>`（multipart，字段名 `image`）换 `asset.assetId`，再把它放进 `createMediaGeneration` 的 `input_image_asset_id`，并把必填的 `generationMode` 从 `t2v` 改成 `i2v`。**尾帧 / 多参考图（`end_image_asset_id`、`referenceInputs`、`universal_reference_video`）仍未接**，候选的 `supportsFirstLastFrame` 保持 false。上传失败一律抛（`VIDEO_REF_UPLOAD_FAILED`），**不静默退回 t2v** —— 用户接了参考图却出一条无关的片，比直接报错难排查得多（§8.0）。误判失败但已有 `externalTaskId` 的任务只能走管理端对账恢复，禁止重新提交。

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
pnpm check:api-contract                          # 扫 4 个子应用 + api-client（⚠️ web-star 未纳入，见 TODO）
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

启用：Platform / Artists / **Celebrity**（含 stars / templates / template-scripts / star-authorizations / engine-pricing / projects / videos）/ Distribution / **资金财务**（v2 §6：FINANCE_ADMIN 专属 —— `/finance` 控制台 + 充值订单/退款/对账/结算/异常风控/充值套餐，OPERATOR 看不到且后端 403）/ **积分运营**（OPERATOR 可见：调差/赠送）/ Notifications / Audit / 平台 > AI 模型 / Prompt 管理 / Agent 平台 / 销售渠道 / 后台管理员 / 账号登录日志。

隐藏（源码保留，URL 直访仍可用）：music / film / nft / forge / digital-ip / community / coach / fan / membership / store / monetization。

切换：[`apps/admin/src/constants/nav.ts`](apps/admin/src/constants/nav.ts) 改 `enabled` 字段。

**未完成事项**：小程序的 wx.subscribeMessage / WebSocket（v0.6+）、统一账号中心 P3–P5 接入（P1+P2 已于 2026-09-05 上线，见 `docs/unified-identity-plan.md`）、K8s ACK（Phase 6）。

### 近期版本速览（**只留最近 5 版一句话**；任何版本的细节都在 [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md)）

| 版本 | 日期 | 一句话 |
|---|---|---|
| **v0.194** | 2026-09-09 | 时间戳全站统一 `yyyy-MM-dd HH:mm:ss`（修掉 `slice(0,10)` 切 UTC 差一天）；界面文案去翻译腔；把去 AI 味 / 时间格式 / 四条新踩的坑写成规约（§4.8、§8、§8.0.1 ⑧–⑪）并配可跑门禁 |
| **v0.193** | 2026-09-09 | 手机上的画布从硬拦改成柔性提示（可以选择继续打开，chunk 仍按需下）；形态真值挪到 `<html data-layout>`，断点 1024→960，手机浏览器的「请求桌面版网站」现在真的生效 |
| **v0.192** | 2026-09-09 | 官方内容运营后台（发得出去也撤得回来）；存为官方内容区分模板 / 示例；**生产事故**：脚本把 `@Id` 挤到常量上 → EMF 建不起来 → API 挂 3 分钟，补 `EntityIdentifierTest` |
| **v0.191** | 2026-09-08 | 根域名换回工作台落地页、原主页移到 `/dashboard`；名片补「人设」（对话式，落点是按 voice 重写访客看得见的那几句）；发现页改竖屏卡 |
| **v0.190** | 2026-09-08 | AI IP 工作台并入 web-aiavatar，一个应用两套设备形态；`apps/web-ipstudio` 退役，`ipstudio.aibuzz.cn` 转 308 |

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

### 8.0.1 排障与验证纪律（v0.184 起强制，v0.194 补到 11 条 —— 都是本仓真栽过、而且多数**栽过不止一次**的）

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
- **Review reject**：commit message 里写「因为观察到 X 所以改 Y」，但 X 没有对照样本 → reject。

**③ 验证要走到用户屏幕那一步。**
「服务端产物是对的」推不出「整条链是对的」。
- 真实事故（v0.174→v0.175）：我核对了产物图确实按参考图合成了，就断言链路正常；
  真正的 bug 在写回画布那一步（`primaryImageId` 悬空导致永远显示第一张）。
- 排「结果不对」必须把**服务端产出的那个东西**和**用户屏幕上的那个东西**逐一对上号
  （key 对 key、id 对 id），再谈模型和提示词。
- 说「修好了」之前，要么自己跑通到终态（生产实测 / 浏览器实测），要么明说「没验证」。
  v0.178 我没验就发，用户回「还是不行啊，你自己验证过吗」—— 底下压着的是另一个 bug。

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

# 排除项说明（改 grep 前先看这个，别把它们当命中）：
#   · `translations.ts` 是 §4.6 已 tombstone 的遗留字典，不再维护
#   · seed / mock 里的真实商品标题（如「【爱❤️助力】酒精湿巾」）是数据不是文案
#   · `persona-studio.tsx` / `proto/card.ts` 里的「赋能、闭环、生态位」是**给用户看的
#     反面例子**（人设编辑器的「避免这些词」占位）
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
