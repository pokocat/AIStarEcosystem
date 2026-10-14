# 平台后台模型管理接入

## 2026-10-13 本地补充：草稿端点检测与视频规格

Studio 视频模型目录返回 `supportsPromptOptimization`，由端点当前视频协议的实际优化支持决定。当前 Seedance 直接生成；前端不显示智能优化选项，优化接口在冻结积分和建任务前拒绝误调用。支持该能力的聚算视频端点沿用用户本机的优化偏好。

模型管理窄命令增加 `endpointProbe`，按表单中的厂商类型、HTTPS 地址、模型目录路径和可选上游密钥读取目录，不保存端点、不提交生成。未提供新密钥时，只允许同一已存端点、相同厂商类型及同源地址使用已保存密钥；换来源必须填写新密钥。返回 HTTP 状态与安全的业务原因，不向平台传供应商原始正文。已存连接不变仍走 `endpointTest` / `endpointFetchModels`。

V55 的 `video_request_spec_json` 将视频模式、素材规则、尺寸、时长、调用路径与附加请求字段保存在固定模型端点；Studio 视频列表还要求该端点处于开放候选、启用、具备可解密密钥与有效规格。仅创建端点不会自动加入 Studio。画布宽高、比例、清晰度条目和静态供应商字段按端点规格保存，不再把 H3 的 8192 像素、两位比例、12 条清晰度、16 个字段或 100 字字段值上限套给其他协议。附加字段接受静态 JSON 值（包括嵌套对象、数组、空字符串和 `null`）；已由协议生成的顶层字段仍拒绝重复配置。聚算协议的配置画布另存逐画布 `outputSizeCode`，提交时使用该编码和已配置的时长，不回落旧 H3 尺寸表；未配置规格的旧 H3 路径保持原行为。Studio 在选用参考素材时按当前模式的大小、格式和时长名单校验，不再用旧 H3 格式识别拒绝新模型已开放的容器。网页视频生成区上传素材时携带所选模型与模式，服务端从同一模型目录获取素材大小、格式和时长规则；转交聚算供应商时也复核该端点的允许格式。已配置端点的图片识别支持 JPEG/PNG/WEBP/GIF/BMP，视频支持 MP4/MOV/WEBM，音频支持 MP3/WAV/FLAC/OGG/AAC/M4A/MOV/WEBM；音视频还需通过 ffprobe 的轨道校验。后台格式选项只列出这些服务端可识别的格式，未配置规格的旧 H3 路径保留原上传校验。此次是本地代码与定向测试，尚未部署或调用真实供应商。

网关的异步回包字段不在默认字段名中时，可选填 `responseSpec`：`submitId`、`status`、`videoUrl`、`error` 使用 JSON Pointer（例如 `/data/task/id`）；`succeeded` 和 `failed` 列出网关状态值。提交时保存这份配置快照，轮询继续按受理时的映射解释回包；映射指定的任务编号或状态缺失时明确报错，不猜测其他字段。常见回包不用填，继续使用原解析。

`json-template` 适配器允许新增模式标识及展示名，并按每个已开放模式填写 JSON 请求正文；Studio 模式列表、任务记录和售价矩阵从端点规格及已保存价格读取自定义模式。预置协议仍按其实际协议支持的四种模式校验。模板值可引用 `${model}`、`${prompt}`、`${seconds}`、`${aspectRatio}`、`${resolutionTier}`、`${generationMode}`、`${seed}`、`${width}`、`${height}`、`${outputSizeCode}`、`${firstFrameUrl}`、`${lastFrameUrl}`、`${references}`。变量必须独占一个 JSON 字符串值，服务端会保留数字、数组、显式 null 和空对象等原类型，仅省略未提供的可选变量；缺少模式模板或首尾帧、多参考素材变量时保存即失败。参考素材单项可选用 `referenceItemTemplate` 定义，以 `${url}`、`${mediaType}`、`${index}` 填充，也可用 `referenceTemplates` 分别指定图片、视频、音频结构；省略时使用 `{mediaType,url}`。请求数组里的 `${...references}` 会将素材项逐个展开到该位置。受理任务保存整个端点规格快照，后续轮询不受配置修改影响。任务查询默认 GET；可配置 POST 和 JSON 请求体，使用 `${id}`、`${model}` 引用受理时的任务编号和模型名。任务编号须出现在查询路径或 POST 请求体中。提交与查询路径可带普通查询参数、`{model}`，查询路径还可用 `{id}`；变量会编码为 URL 值，旧任务查询使用受理时的模型名。模型目录路径也可带普通查询参数，不使用任务或模型变量；显式配置为空字符串表示该固定模型供应商没有目录，后台读取目录会明确拒绝且不请求供应商，不能把未检测说成连接成功。未配置目录路径的旧端点仍沿用原默认路径。密钥请求头名称和前缀由 `authHeader` 配置，默认 `Authorization: Bearer`，提交、查询与模型目录检测使用同一设置。非 OpenAI 模型目录可通过 `catalogSpec` 配置列表、编号、显示名和状态的 JSON Pointer；目录列表结构不符会返回明确失败，不能被误判为空。非 JSON 传输及查询参数或正文鉴权尚未配置化，路径中不得填写密钥。

Studio 画布和配方模板使用端点合同决定可选模式、模式名称、首尾帧与参考素材组合、清晰度、画幅、时长、提示词是否必填及最大字数。视频候选能力也按已存端点规格下发清晰度和比例；只有未配置规格的旧聚算端点沿用固定画幅。配方发布只检查字段形状和引用关系，实际报价与提交再按所选模型的合同校验；画布再次打开时保留自定义模式、清晰度和比例。画布的时长输入读取合同的最短、最长秒数，不再用旧界面的 30 秒上限截断；自定义清晰度与比例在收起的参数摘要中也按合同回显。批量候选的指定种子按该模型的 `seedMax` 轮转。旧视频端点仍沿用原协议和历史默认值。

自定义 JSON 的请求正文、提交/查询路径和查询请求体均不引用模型编号时，供应商模型标识可以留空；内部任务使用端点 ID 标记，不会向供应商发送全局默认模型编号。引用 `${model}` 或 `{model}` 时仍须填写供应商模型标识。Seedance 与聚算协议始终需要该标识。

提交幂等请求头名称由 `submitIdempotencyHeader` 配置；Seedance 未配置时沿用 `Idempotency-Key`，其他协议未配置时不发送。配置为空字符串可显式关闭 Seedance 默认头；每次提交生成独立请求 ID，作为该头的值。

Studio 受理视频任务时把当次选定的宽高写入原任务的 `variant_config`，任务列表从这份快照回显；旧任务没有宽高快照时继续按原 H3 规格读取。运营之后修改端点尺寸，不会改写已受理任务的展示。

功能目录中的 `studio.video` 售价现在标为原视频价格矩阵，与明星带货视频生成区共用相同原配置；不能再显示成“不计费”。候选按秒售价仍是原共享 `VIDEO_GENERATION` 候选记录，未配置的格子才回落该模型单价。更改共享矩阵需向运营说明两项功能都受影响。

矩阵中的免费参考图数量仍由运营设置为非负数，不再被 H3 最多 9 张的素材合同锁住；某次生成实际能用多少张参考图，仍由所选模型的模式素材规格校验。

平台控制台在 Studio 视频开放操作及售价页中使用 `functionCandidatePriceSave` 维护按秒端点的候选售价；它要求独立的售价权限和共享功能影响确认，不通过端点保存或模型权限修改价格。没有候选每秒价且共享矩阵也未配置相应模式与清晰度时，原生成服务仍按既有规则拒绝报价。

2026-10-10 第一轮实现。统一控制台通过独立窄契约操作原 Java 服务，AIStar 仍是配置及业务执行真值；不复制供应商密钥到 Runtime，不修改原生成协议或用户账本。

接口：`POST /api/service/model-management/v1/command`。请求 `{commandJson:string}`，commandJson 是平台 contracts 解析后的白名单命令序列化结果；返回既有 `{success:true,data:...}`。签名 JWT 通过 Authorization Bearer 发送，专用 audience=`aistar-model-management-v1`、issuer=`aibuzz-platform`、scope=`platform`、action、commandHash=SHA256(commandJson)，最多 30 秒有效。控制器独立校验，未建立 admin/INTERNAL 身份。仅精确接口被 Security/ProductRouteTable 放行；不开放整个 `/api/service` 子树。

配置：AIStar `aep.platform.model-management-key`（环境变量 `AEP_PLATFORM_MODEL_MANAGEMENT_KEY`），平台 `AISTAR_MANAGEMENT_KEY` 与 `AISTAR_MANAGEMENT_URL`。密钥为独立 64 位 hex，默认空时服务失败关闭；不复用 INTERNAL/JWT/Runtime 密钥，不放入代码、文档或日志。平台 URL 必须为受控 HTTPS origin，本地测试可 loopback HTTP。jti 防重放缓存目前在单服务实例内；多实例部署前需共享 nonce 存储或保证该管理入口固定单实例。

服务白名单覆盖端点配置/成本、共享用途绑定/候选能力、提示词编辑/历史/恢复/无付费展开、Agent 配置、原动作价、视频生成区矩阵价、Studio 场景策略、用量聚合读取；无任意 admin 路径代理。配置变化与 `aep_audit_logs` 前后 DTO 快照同事务；不记录明文请求密钥。原 DTO 仅返回掩码。

Studio 场景策略 `studio.script` 固定或选择 DAP_PERSONA，`studio.image` 指定 DAP_IMAGE 候选。默认必须在白名单中，fixed 恰一个候选；客户积分价不可缺失，0 可明确免费。后台保存时检查启用与能力用途，模型查询、文本生成与图片 preflight 使用同一策略。配置缺失兼容原规则；配置存在时不回落白名单外模型。其它应用的原功能模型与价格已登记到统一功能表，但尚未逐场景隔离，共享用途配置仍共同影响其消费者。

供应商成本继续使用端点人民币微元/千 Token、微元/次或秒；客户积分价格独立，不因成本缺失阻断固定价。V49 新增 supplier_billing_mode，成本修改不改变原客户 billingMode。Studio 原价格配置新增 customerPrices 按端点指定固定客户积分率，优先于旧成本倍率；旧任务快照及未覆盖记录保持兼容。原 DAP 动作 0 的部署默认语义继续保留，未改 Scheme A。新端点管理保存保留既有成本，成本编辑保留限额；候选能力编辑保留积分价。新增候选的 minImagePixels 原遗漏已补齐。

统一功能表新增 functionCatalog、functionPricingCatalog（安全售价批量投影）及按登记功能的窄写命令。音乐、短剧、带货、数字资产复用原用途绑定、候选价格、动作价、drama.credit.*、旧引擎价与视频规格矩阵；不新增价格权威。共享用途及共享价格写入须确认实际影响功能全集。局部更新在事务锁后读取并合并，供应商点价首次创建通过稳定的既有 action-pricing 配置行加锁，缺少该初始化行时失败关闭。仅价格权限不返回模型能力、供应商成本或凭据。

新控制台路径与完整覆盖/未覆盖清单：平台仓 `docs/aistar-model-migration.md`。原后台入口本轮保留；模型发现、连接检查、真实 test-run/replay、敏感日志正文继续留在原入口，不自动发供应商请求。

本地验收使用独立 loopback 18082 内存 H2、local CDN、log SMS、shadow payment，专用测试密钥和 example.invalid 端点。既有全新库 Flyway 前置表问题只在此隔离 fixture / route coverage 关闭，未修改生产迁移或持久数据库。没有生产部署。

## 2026-10-10 生产发布

模型管理接口与场景开放/定价逻辑已部署，运行提交 `9b111607af57367ffa8fb09a8bdc90c904e1134e`，发布编号 `20261010145313-9b111607`；后台入口 https://ops.aibuzz.cn，运行 Platform `2158e153b8e6332ae51876323052c7aa29030576`。

V49 成功新增可空供应商计量字段；JAR SHA256 `fcb138dd5e6f6e90935f5a0f81863a14d96c2576d63e605163ea7f12724d6960` 与部署产物一致。workspace/后台类型、API 契约、Java 编译与 65 项专项测试通过，正式 verify ALL GREEN。生产配置启用独立短时命令签名通道，已有身份与供应商密钥不变。

实际浏览器可读取 15 个生产模型端点、56 项应用功能及既有用户价格；未保存改价、建立模型或创建付费生成。Studio 剧本/图片专属策略仍未配置，沿用兼容行为；平台定价开关保持原状态。发布前数据库、环境文件及旧 JAR 备份位于受限 `/opt/aibuzz-platform/backups/model-console-20261010T144512Z`。

详细证据见 Platform 仓库 `docs/reviews/2026-10-10-model-management-production-release.md`。Studio 与旧后台前端没有在本轮重新部署。

## 用户管理与模型运营第一批（本地实现，尚未发布）

用户命令走 `POST /api/service/user-management/v1/command`，复用同一独立管理密钥，但 audience 为 `aistar-user-management-v1`，与模型令牌隔离。白名单仅查询、详情、停用和恢复；委托给原 `AepUserService`，状态变更及原 `audit_log` 写入在同一事务。未增加用户表、钱包、积分结算或模型配置真源。原停用行为不撤销已签发的用户 JWT，本轮保留该既有语义。

模型新增 `endpointTest`、`endpointFetchModels`、`usageRecords`，均委托原服务；连接检查与拉取目录只使用已保存的配置，目录由用户保存端点时落库。调用记录最多 500 条，支持日期窗口、应用、用途、端点、用户、租户、结果和关键词筛选；不返回生成正文、不开放重放。

平台端要求全平台范围：用户查询 `users.read`，联系方式另需 `users.sensitive.read`，状态变更另需 `operations.manage`；模型探测 `models.manage`，调用记录 `modelLogs.read`，成本 `costs.read`。未修改原 admin 的入口或普通应用接口。

## 2026-10-10 第一批管理功能生产发布

用户授权提交部署后，用户窄命令与模型操作通道已随 `76debecff` 推送至 `codex/unified-ip-studio`，只部署 server，发布 `20261011040736-76debecf`。Platform 运行 `bf96d698137bdf40a13073928070aeffa4df7627`，入口仍为 ops.aibuzz.cn。保留原生产身份与测试账号清理修复，没有新增业务表或迁移。平台权限与原 Java 签名分别校验；匿名用户命令 401。线上浏览器已验证原用户分页/档案、15 个端点、概览与调用记录读取；没有生产用户状态变更、价格变更或供应商调用。定向 Java 13 个用例通过，线上 JAR 与本地产物 SHA256 一致。完整发布记录在 aibuzz-platform 的 `docs/reviews/2026-10-10-admin-production-release.md`。
