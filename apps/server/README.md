# AI Star Eco Server

> 阿里云 **ECS + RDS + OSS** 部署的完整版本化基础设施在 [`../../infra/`](../../infra/README.md)。
> 新机器从零拉起、env / nginx / systemd / RDS / OSS 模板、deploy 脚本均在该目录。

Spring Boot 后端服务，承载账户注册、权益管理、许可证（秘钥）、积分钱包、审计日志等核心业务。

## 版本日志

- **v0.101（2026-07-10）**：一致性引擎 C-2（角色/场景实体化 + 多角度参考图集）。**两新表** `drama_character`（`DramaCharacter`，索引 `idx_dc_project`；列 `project_id`/`owner_user_id`/`name`/`role`/`cast`/`appearance_json`/`dap_avatar_id`/`voice_id`/`ref_images_json`/`created_at`/`updated_at`/`deleted_at`）+ `drama_scene`（`DramaScene`，索引 `idx_ds_project`；列 `project_id`/`owner_user_id`/`name`/`mood`/`style_tags_json`/`ref_images_json`/时间戳/`deleted_at`），ddl-auto 建。字段名对齐前端 `CharacterDef`/`SceneAsset`；`ref_images_json` = 多角度参考图集 `[{cdnKey,angle,label}]`（**真值 cdnKey，§4.7.4**；出 wire `signer.signKey` 派生 url，**不加 cdnUrl 列**）。新服务 `DramaReferenceAssetService`（区别于素材库 `DramaAssetService`）：**懒回填** `ensureBackfilled`（`getProject` 前，老项目文档→实体，单图 `refCdnKey`→`refImages[0]{front}` 迁移，幂等闸=项目实体行是否存在）+ **双写** `syncFromDoc`（`saveProject` 后，**§6.1 只 upsert 实体表、不重写 payloadJson**，增/改名/软删对齐，doc 缺 refImages 保留实体防抹除）+ **出 wire overlay** `overlayEntityRefs`（`toDetail` 把实体 refImages 叠加进文档）+ 三视图 `generateReferenceSheet`。`DramaProjectService` 注入本服务（构造 +1 依赖）。`DramaRenderService` 加 `preflightCharacterReferenceSheet`（hold 前校验端点/提示词/配额）+ `renderCharacterReferenceFrame`（单张出图不计费，供批量编排）。新端点 `POST /api/me/drama/projects/{id}/characters/{charId}/reference-sheet`（body `{angles?:[front|side|full],ratio?,appearanceHint?}` → `{characterId,refImages,cost}`）：复用 `IMAGE_GENERATION` + `drama.character_frame_image`（resource 模板加 `{{angleClause}}` 注入拍摄角度，锁脸用角色已有定妆图），**计费 hold→逐角度 commit**（hold 总额=`drama.credit.frame`×角度数，逐张 `commitHold`，部分失败剩余 `releaseHold`，全失败 release 全额+抛错——与 `renderFrame` 一次性 `debit` 有意分裂，见 `TODO.md`）；§8.0：preflight 在 hold 前，端点/提示词未配 → 503 不冻结不扣费。测试 `DramaReferenceAssetServiceTest`(8：回填幂等/双写增·改名·软删/doc 缺保留/单图迁移/三视图 hold·commit·部分退·全失败 502·未配 503 且 0 hold)；`DramaProjectServiceTest` 构造更新。门禁：server test-compile + 上述 + `DramaProjectServiceTest`/`MaterialAiE2ETest`（37 全绿）+ web-drama typecheck/build + typecheck:all(8/8) + contract；openapi 加 reference-sheet 端点。真源 [`docs/[Fabel5]drama-consistency-engine-design.md`](../../docs/%5BFabel5%5Ddrama-consistency-engine-design.md) §4。类型沿用 drama 本地约定（不进 packages/types）。
- **v0.100（2026-07-10）**：一致性引擎 D-11（一用途多候选端点 + capability 元数据）。**新表** `ai_app_endpoint_candidate`（`AiAppEndpointCandidate`，唯一约束 `purpose+endpoint_id` + 索引 `idx_aaec_purpose`；列 `sort_order` / `enabled` / `max_ref_images` / `supports_first_last_frame` / `supports_subject_reference` / `max_duration_sec` / `credit_cost_override`，ddl-auto 建）——purpose×endpoint 交点承载「端点在某用途下」的能力画像 + 可选单价 override。`AiAppBinding` **不变**（= 该用途默认端点），`AiModelInvocationService.resolveEndpoint(purpose)` 行为零变化。新增 `resolveEndpoint(purpose, endpointId)` 重载（白名单命中返回 `ResolvedEndpoint{endpoint,candidate,isDefault}`，未命中 empty → 调用方 503 `ENDPOINT_NOT_ALLOWED` 不回退默认、不扣费，§8.0）+ `listCandidates(purpose)`。`AiAppCandidateSeeder`（@Order 60）幂等把每条现有 `AiAppBinding` 回填为置顶候选（capability 全 null）；`AiAppBindingService` 加候选 CRUD（bind 时幂等纳入候选池）。`AdminAiAppBindingController` 加 `/{purpose}/candidates[/{endpointId}]`（GET/POST/PUT/DELETE）。`DramaRenderController` 加 `GET /me/drama/render/models`（image+video 候选 + capability + isDefault）；`DramaRenderService.renderFrame/renderClip` body 加可选 `endpoint_id`（frame debit / clip item credit_cost，命中 candidate 单价 override 覆盖用途默认单价）。**视频线 endpoint_id 透传**：`renderClip` 存进 `variant_config` → `MaterialVideoWorker.extractEndpointId` → `MaterialVideoModelClient.submit/poll(..., endpointId)`（`pickEndpoint(endpointId)` 白名单，`SubmitResult` 带 endpointId 使 poll 落同一端点）；**celebrity 素材线不传 endpoint_id → null → 默认端点，默认路径完全不变**（`MaterialVideoWorkerTest` 回归）。测试：`AiModelInvocationServiceTest`(+6)、`AiAppCandidateSeederTest`(2)、`DramaRenderServiceTest`(+2 非法 endpoint_id → 503 且 0 扣费/0 提交)。门禁：server test-compile + 相关单测全绿（含 `MaterialAiE2ETest` / `MaterialVideoModelClientTest` 回归）+ web-drama typecheck/build + typecheck:all(10/10) + typecheck:admin + contract；openapi 加 `/render/models`、`/admin/ai-app-bindings/{purpose}/candidates[/{endpointId}]`、frame/clip summary 补 `endpoint_id`。真源 [`docs/[Fabel5]drama-consistency-engine-design.md`](../../docs/%5BFabel5%5Ddrama-consistency-engine-design.md) §3。

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
- **v0.40（2026-05-29）**：素材运营「文本三件」接真 LLM（脚本起稿 / 卖点提取 / 变量抽取）—— 复用 `AiModelInvocationService.invokeChat`（+SELLING_POINTS/VARIABLE_EXTRACT purpose、response_format 透传），新增 `MaterialAiService`（解析/校验/自修复重试；**不静默兜底**：provider/prompt 未配或调用/解析失败抛带 code 的明确错误 `AI_NOT_CONFIGURED`/`PROMPT_NOT_CONFIGURED`/`AI_CALL_FAILED`/`AI_BAD_OUTPUT`，便于定位配置问题）。prompt（system+user 模板）建 `prompt_template` 表，`PromptService` 解析（DB→resource→代码兜底，1min 缓存）+ `PromptTemplateSeeder`（缺行才插）+ `AdminPromptController`（/api/admin/prompts CRUD + dry-run）。`MaterialOpsController` +`/material/scripts/ai-draft` + `/material/scripts/{id}/variables`。脚本起稿计费（后端可配置）：`CelebrityActionPricingService` +action `material.script-draft`（默认 0=不计费），`MaterialOpsService.draftScripts` 走 `CreditService` hold(单价×稿数)→commit/release，余额不足抛 402。方案见 [`docs/MATERIAL_OPS_AI_TEXT_PLAN.md`](../../docs/MATERIAL_OPS_AI_TEXT_PLAN.md)。
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

> v0.6+ 计划拆分为 `PLATFORM_OPERATOR / FINANCE_ADMIN`（职责分离）。当前 `AdminUser.AdminRole` enum 实际是 `{SUPER_ADMIN, OPERATOR}`。

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
| `credit_adjustment_requests` | **v2 §4.5 / §9.2** 运营调差/赠送审批单（maker-checker）。`type`(COMPENSATE/GRANT)/`target_user_id`/`amount`/`reason`/`incident_ref`\|`campaign_id`/`status`(PENDING_APPROVAL/APPROVED/REJECTED)/`maker_id`/`checker_id`/`ledger_entry_id`。小额直发也落 APPROVED 审计单（全量审计 + per-actor 日限额计数）；大额需 FINANCE_ADMIN 复核（maker≠checker 服务端硬校验） |
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
| `aep_users.platforms` | **平台访问授权列**（v0.43）：CSV（`music,drama,celebrity` 子集；空=全部可访问）。`/api/me` 透出 effective 列表，前端按本子产品判断放行 |
| `celebrity_stars` 扩字段 | bio / location / fans / cooperation_count / avg_gmv / photos_json / videos_json |
| `celebrity_templates` 扩字段 | preview_cover / preview_video_url / duration_sec |
| `aep_notifications` 扩字段 | bot_id（关联 5 个 AI Bot 同事；v0.5.2 拉模式后保留作扩展点）；**v0.58** +`audience_scope`/`audience_target_id`/`audience_target_name`（推送对象溯源，可空，老行回退 scope=all）。运营收件箱行用保留 `user_id='__admin__'`（`Notification.ADMIN_INBOX_USER_ID`），由 `NotificationPublisher` 写入（充值下单/取消、新用户激活），admin `/api/admin/notifications` 只读写该收件箱 |
| `aep_social_accounts` | sau 绑定账号，存 `display_name` / `platform_account_id` / `avatar_url` 清洁 profile；`storage_state_encrypted` 为 AES-GCM 密文且不出 DTO |
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
