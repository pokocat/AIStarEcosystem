# 平台后台模型管理接入

2026-10-10 第一轮实现。统一控制台通过独立窄契约操作原 Java 服务，AIStar 仍是配置及业务执行真值；不复制供应商密钥到 Runtime，不修改原生成协议或用户账本。

接口：`POST /api/service/model-management/v1/command`。请求 `{commandJson:string}`，commandJson 是平台 contracts 解析后的白名单命令序列化结果；返回既有 `{success:true,data:...}`。签名 JWT 通过 Authorization Bearer 发送，专用 audience=`aistar-model-management-v1`、issuer=`aibuzz-platform`、scope=`platform`、action、commandHash=SHA256(commandJson)，最多 30 秒有效。控制器独立校验，未建立 admin/INTERNAL 身份。仅精确接口被 Security/ProductRouteTable 放行；不开放整个 `/api/service` 子树。

配置：AIStar `aep.platform.model-management-key`（环境变量 `AEP_PLATFORM_MODEL_MANAGEMENT_KEY`），平台 `AISTAR_MANAGEMENT_KEY` 与 `AISTAR_MANAGEMENT_URL`。密钥为独立 64 位 hex，默认空时服务失败关闭；不复用 INTERNAL/JWT/Runtime 密钥，不放入代码、文档或日志。平台 URL 必须为受控 HTTPS origin，本地测试可 loopback HTTP。jti 防重放缓存目前在单服务实例内；多实例部署前需共享 nonce 存储或保证该管理入口固定单实例。

服务白名单覆盖端点配置/成本、共享用途绑定/候选能力、提示词编辑/历史/恢复/无付费展开、Agent 配置、原动作价、视频生成区矩阵价、Studio 场景策略、用量聚合读取；无任意 admin 路径代理。配置变化与 `aep_audit_logs` 前后 DTO 快照同事务；不记录明文请求密钥。原 DTO 仅返回掩码。

Studio 场景策略 `studio.script` 固定或选择 DAP_PERSONA，`studio.image` 指定 DAP_IMAGE 候选。默认必须在白名单中，fixed 恰一个候选；客户积分价不可缺失，0 可明确免费。后台保存时检查启用与能力用途，模型查询、文本生成与图片 preflight 使用同一策略。配置缺失兼容原规则；配置存在时不回落白名单外模型。其它应用的原功能模型与价格已登记到统一功能表，但尚未逐场景隔离，共享用途配置仍共同影响其消费者。

供应商成本继续使用端点人民币微元/千 Token、微元/次或秒；客户积分价格独立，不因成本缺失阻断固定价。V49 新增 supplier_billing_mode，成本修改不改变原客户 billingMode。Studio 原价格配置新增 customerPrices 按端点指定固定客户积分率，优先于旧成本倍率；旧任务快照及未覆盖记录保持兼容。原 DAP 动作 0 的部署默认语义继续保留，未改 Scheme A。新端点管理保存保留既有成本，成本编辑保留限额；候选能力编辑保留积分价。新增候选的 minImagePixels 原遗漏已补齐。

统一功能表新增 functionCatalog、functionPricingCatalog（安全售价批量投影）及按登记功能的窄写命令。音乐、短剧、带货、数字资产复用原用途绑定、候选价格、动作价、drama.credit.*、旧引擎价与视频规格矩阵；不新增价格权威。共享用途及共享价格写入须确认实际影响功能全集。局部更新在事务锁后读取并合并，供应商点价首次创建通过稳定的既有 action-pricing 配置行加锁，缺少该初始化行时失败关闭。仅价格权限不返回模型能力、供应商成本或凭据。

新控制台路径与完整覆盖/未覆盖清单：平台仓 `docs/aistar-model-migration.md`。原后台入口本轮保留；模型发现、连接检查、真实 test-run/replay、敏感日志正文继续留在原入口，不自动发供应商请求。

本地验收使用独立 loopback 18082 内存 H2、local CDN、log SMS、shadow payment，专用测试密钥和 example.invalid 端点。既有全新库 Flyway 前置表问题只在此隔离 fixture / route coverage 关闭，未修改生产迁移或持久数据库。没有生产部署。
