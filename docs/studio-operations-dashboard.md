# Studio 积分与生成运营看板（一期）

## 入口与边界

- **运营配置 · 场景模板**（2026-10-29，本地未发布）：同一个应用的 `/scenes`，左侧「运营配置」分组。编辑 AI 图片 / AI 视频两页的场景、选项组和首页「你想做什么？」卡片，整份保存带版本号；这是本应用里唯一可写的页面（接口 `/api/admin/studio/scenes`，超管与平台运营），看板仍只读，「只读」标记只在看板页显示。真源 `docs/studio-scene-creation.md` §9。
- **新版独立入口**：`apps/web-aiavatar/studio-admin`，本地 `http://localhost:3004/`，生产挂载在 `https://aistar.aibuzz.cn/admin`；它归属 Studio 域但仍是独立 pnpm/Next 子工程。根路由默认经营首页，`/?view=technology&days=7` 为技术监控。该应用有独立构建、登录、侧栏与响应式外壳，不依赖 `apps/admin` 或 Studio 创作端的页面运行时。
- 旧实验路由：`/admin/studio/operations`（`apps/admin`）暂时保留用于回归，不再作为新版入口，也不删除已完成的只读能力。
- 服务端入口：`GET /api/admin/studio-operations`、`GET /api/admin/studio-operations/reconciliation-details`、`GET /api/admin/studio-operations/credit-events`。
- 角色：`SUPER_ADMIN`、`OPERATOR`、`FINANCE_ADMIN`。侧栏只负责可发现性，Controller 上的 `@PreAuthorize` 是跨账户数据的最终门禁。
- 全部端点只读。请求不会执行 SSH、shell、补扣、退款、重跑任务、重启或发布。
- 未登录请求返回 401；普通产品用户返回 403。只有 `SUPER_ADMIN`、`OPERATOR`、`FINANCE_ADMIN` 可访问三个只读接口，负向权限由 MockMvc 覆盖。
- 本页“人民币”只按 `1 元 = 100 积分`换算展示，不是收入、回款、利润或供应商成本。普通钱包余额与模型赠款分桶独立，不把赠款余额再加进普通余额。

## 一期已接入

### 共用健康栏

- A–I 九项对账：钱包分桶、负余额、总余额/流水、冻结/流水、赠款分桶、赠款负数、终态冻结剩余、模型扣费拆分、活动超发。
- 进行中超过 6 小时的冻结笔数。
- 任务数不少于 5 且退回率不少于 50% 的异常模型数。
- 非零对账项可打开分页只读明细。接口只返回账户/钱包/任务定位字段，不返回手机号；所有自由文本仍经过手机号打码。
- 对账 agent 报告尚无应用内安全读取通道，因此健康栏为“部分数据未接入”，即使 A–I 都为 0 也不会装成全绿。

### 经营页

- 今天 / 近 7 天 / 近 30 天，北京时间自然日窗口。
- 普通积分（`SPEND`）与模型赠款（`SCOPED_SPEND`）每日趋势及合计。
- 日趋势由数据库在一条查询里按最多 30 个北京时间 UTC 边界做条件聚合，不把窗口内全量流水加载进 JVM；发放与异常明细始终分页，也没有逐账户查询。
- 技术任务明细按来源最多读取 50,000 条；超过上限整页明确失败并提示缩短窗口，不会静默截断后计算成功率或 P95。
- 模型维度：任务、成功（`COMMITTED`）、退回（`RELEASED`）、进行中（`ACTIVE`）、普通/赠款结算拆分。
- 功能维度：出图、视频、对话、导演台、短剧、其他。由冻结引用类型和 `ip_run.kind/host_type` 统一归类；无法归类的保留为“其他”。
- 发出积分：赠送、调整、激活码、模型赠款、充值、现金退款、转入/转出，带服务端分页、类型/文本筛选、空状态和错误重试。
- 普通赠送积分进入混合桶，现有账本不能严谨追踪“某次赠送后来用了多少”，因此一期明确显示“未具备数据”，不伪算使用比例。
- 在线人数：不做。2026-10-30 决定不在用户端加心跳上报（每个打开的页面每 30 秒一次请求，担心服务器负担），看板不显示在线 / 活跃人数。
- 窗口消费用户：只统计已结算且实际扣费的模型任务，按用户去重；首次/回访按全历史首笔结算时间划分。由于普通积分消费没有保留 gift/license/recharge 逐次来源，真实“充值积分消费者”继续显示未具备数据。
- 真实到账/退款：只含 `manual/alipay/wechat` 的已到账/已登记现金退款，排除 shadow 和来源未知订单；到账金额不称收入。
- 导演台当前快照：项目 → 已建剧集 → 有效分镜 → 可用视频。推进率按同一批项目 distinct 计算，剧集/片段/分镜/视频数量单列为创作规模；有效分镜须关联同一项目内剧集、有镜头计划与有效采用 key，可用视频须同片段已有有效分镜与有效采用视频 key，候选重试不重复计数。

### 技术页

- 汇总 `ip_run` 与 `material_video_job`：各模型任务数、终态成功率、失败、进行中。
- 按实际任务记录提供近 24 小时 48 个半小时有界分桶：成功且无失败为绿色、存在失败为红色、仅运行中为蓝色、无调用为灰色、选定窗口未覆盖为缺失。该分桶表示任务结果，**不是服务在线率**。
- 每个模型同时展示 24 小时 / 7 天 / 30 天终态成功率与样本数；运行中不进入分母。任务提交、终态成功/失败和实际持久化的图片/视频产物数量分开显示，不把任务数当产出数。
- 模型按任务记录中的供应商字段分组；没有可靠字段时明确归到“未记录供应商”，不猜供应商。
- 失败率分母只用终态成功 + 失败，排队/运行中不当失败；账务退回率不冒充技术失败率。
- 失败分类：超时、供应商拒绝、内容审核、无任务号/待核对、其他；同时区分我方请求、供应商、未知。
- 图片/视频耗时使用“任务创建到终态”的 P50/P95，只统计时间字段完整的终态样本。
- 排队数、可观测样本的平均等待、受理/用量待核对数。没有统一采集源的并发余量明确为“未接入”。
- 沿用现有“生成异常告警”和“错误日志”入口，不重复创建告警/日志页面。
- 供应商异常清单与调用排行复用现有模型用量聚合；异常可跳现有模型管理详情。未具备完整定价覆盖率时不展示估算成本或毛利。
- “发布标记”前端契约与未接入态已经实现；真正的线上版本/发布时间采集适配器尚未实现，两者在 UI 和接口中明确区分。

### 功能分类核对

- 已识别：图片生成、视频生成、lip-sync、Studio 对话、导演台、短剧引用。
- `studio-audio`、`studio-text`、`studio-adopt` 以及无法识别的引用统一进入“其他”，不会误记为出图。
- 技术任务指标当前只覆盖 `ip_run` 与 `material_video_job`；独立 DAP job、音乐、clip、非 Studio 产品任务不并入本看板，防止跨产品口径混杂。

## 状态与交互验收

- 首屏加载使用 `role=status`；请求失败使用 `role=alert` 和重试，绝不显示空数据或健康绿。
- 后端即时数据超过 10 分钟在前端标“数据已陈旧”。
- 经营/技术页签与统计窗口写入 URL（`view`、`days`），刷新可恢复。
- 无任务、无发放、筛选无结果分别使用不同空状态。
- 对账与发放明细使用 shadcn/ui Dialog；窄屏为底部可滚动面板，表格可横向滚动并可键盘聚焦。
- 页签、按钮、筛选框、表格区域和图表均有可访问名称。

## 尚未接入（一期不会显示为 0 或绿色）

- 仓库外对账 agent 的最近运行时间与结论。
- 服务器发布清单、线上版本及发布时间、安全发布标记读取。
- 飞书告警发送/失败记录。
- 供应商限流次数与配额余量（已有用量聚合已接入；缺失项仍不显示为 0）。
- 跨所有普通赠送的逐笔实际使用比例。
- 统一并发在途/上限/饱和度（没有可信运行时限流计数前保持未知）。

这些项目应分别增加应用内、鉴权后的只读适配器；禁止由网页请求 SSH 或读取服务器 env。

## 第二期扩展点

- 经营：用户消耗排行与余额、24h/单笔阈值、低余额持续使用、真实充值积分消费者、赠款活动发/用/余/到期提醒、指定 H3 转换赠款追踪。
- 技术：服务在线与重启、重启窗口 502、错误/慢接口、磁盘/内存/DB 连接、上传失败。
- 以后：模型售价与供应商真实成本来自可信飞书或结算数据源；数据源接通前不计算毛利。

## 本地预览与验证

```bash
# 根目录
pnpm dev:studio-admin
# 另一个终端
cd apps/server && ./mvnw spring-boot:run
```

访问 `http://localhost:3004/`。生产模式仍需使用已有管理员或平台运营账号登录；跨账户权限只由服务端 Controller 的 `@PreAuthorize` 判定。开发检查：

经营和技术页视觉验收可分别在开发模式打开 `http://localhost:3004/?view=business&days=7&demo=1`、`http://localhost:3004/?view=technology&days=7&demo=1`。`demo=1` 只在 `NODE_ENV !== production` 时注入明确标记的本地演示样本，用于检查消费用户与到账、导演台推进、供应商分组、模型卡与半小时时间轴；生产构建始终读取只读聚合 API，不会走演示数据分支。

```bash
pnpm --filter @ai-star-eco/studio-admin typecheck
pnpm --filter @ai-star-eco/studio-admin test
pnpm --filter @ai-star-eco/studio-admin build
cd apps/server && ./mvnw compile -q -o
cd apps/server && ./mvnw -Dtest=StudioOperationsDashboardServiceTest,StudioOperationsDashboardIntegrationTest,AdminStudioOperationsControllerSecurityTest test
```

若要从独立后台跳转现有 Admin 的请求日志页，可配置 `NEXT_PUBLIC_ADMIN_APP_URL` 为 Admin 所在源（例如本地 `http://localhost:3003`）；未配置时只展示接入状态，不生成错误链接。

## 独立前端发布边界

- 独立制品：`./infra/scripts/build-studio-admin-release.sh` 只构建 `@ai-star-eco/studio-admin`，输出 `studio-admin.tar.gz`；不会构建 `apps/server` 或 `apps/web-aiavatar`。
- 独立运行单元：`infra/systemd/aistareco-studio-admin.service.example` 监听环回地址 `127.0.0.1:3004`，与 Studio 主前端 `3013` 分离。
- 独立部署：`./infra/scripts/deploy-studio-admin-release.sh <release-dir>` 只替换 `/opt/ai-star-eco/studio-admin` 并重启 `aistareco-studio-admin`。脚本会先确认专用 env 和 systemd 单元存在，不修改 Nginx，不重启共享 server 或 Studio 主前端。
- 生产入口：`https://aistar.aibuzz.cn/admin`。独立应用以 `basePath=/admin` 构建，`/admin/_next/**` 只代理到 3004；Studio 主前端的根路径及 `/_next/**` 仍由 3013 提供。根 `/api/**` 继续使用现有共享后端代理，不开放新权限。
- 首次上线前必须运行 `nginx -t`，再 reload（不是 restart）Nginx，并分别核对 `aistareco-web-aiavatar` 的 PID/启动时间未变化和 `aiavatar.aibuzz.cn` 仍为 200。
- 看板聚合接口尚未随前端发布时，登录接口仍可沿用现有管理员认证，但经营/技术数据请求会明确进入错误或未接入状态；不得切到 mock 或把演示数据发布为实时数据。

2026-10-26 的 A–I 全 0、CATech 25 个退回、H3 两个成功/920 积分只用于人工对照测试，不写入 UI、mock 或生产指标。

> 2026-10-30 合入 main：导演台推进、现金流、消费用户、模型 24 小时 / 7 天 / 30 天成功率、半小时时间轴、产物数与供应商异常（2026-10-26 本地完成）。在线人数心跳按决定未合入。尚未发布，生产页面仍以已发布版本为准。
