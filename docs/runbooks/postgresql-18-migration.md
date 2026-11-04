# PostgreSQL 18 适配与迁移边界

本阶段完成隔离代码、本地 PostgreSQL18.0 门禁和真实阿里云 RDS18.6 恢复/双机 API/受保护 ALB 演练。AIStar 生产仍为旧 MySQL，没有切流或停服；云端只使用独立演练库与角色。测试镜像固定 `postgres:18.0-alpine`，云端验收另有独立证据。

## 代码与配置

- 新增 `apps/server/src/main/resources/application-postgres.yml`：生产 profile，独立 Flyway `classpath:db/postgresql`、禁止自动 baseline、Hibernate validate、UTC 连接和时间映射；数据库地址、账号、口令均无本地默认。
- 空库基线 `db/postgresql/V74__postgresql_baseline.sql` 包含当前 190 个模型表、JDBC 专用的 `model_alert_delivery` 、历史软删/已读列和固定参数索引。旧 MySQL/H2 的 V1–V74 SQL/Java 文件不变，也不被 PG 扫描。
- V74 单独基线曾比源库少1张历史表；已由 V75 补齐并保留旧版本不可变。当前 V74–V77 恢复192张业务表（各自加Flyway共193张），逐表全字段摘要一致。后续主线/源库漂移必须重新对账，不能把本次非冻结快照作为最终切流数据。
- 88 个实体文件的大文本映射移除 MySQL `LONGTEXT` 硬编码及 JDBC `@Lob` 字符定位器，改为标准 LONGVARCHAR/VARCHAR 字符绑定和 LONG32 列长度：MySQL 保持 longtext 容量，PG 使用 text。原 TEXT 列容量约定保留，Map/List 转换器序列化格式不改，不擅自转 jsonb。
- `MaterialVideoInputAssetWriterImpl` 按真实数据库元数据选择原子 upsert：PG 的冲突目标仅 id，更新回执/有效期，不替换首次 source_key。`FeishuModelAlerts` 在 PG 用 `ON CONFLICT(id) DO NOTHING`，保持持久去重；测试不发飞书消息。
- `MixcutJobSchemaMigration` / `SellingChannelMigrationSeeder` 对 PG 不再执行启动 DDL；`PlatformsAiavatarMigrationSeeder` 不再重写导入授权字段，渠道 Seeder 不再回填导入批次的历史归属，仅保留缺失的当前默认渠道初始化。旧引擎路径保留。`PostgresRuntimeGuard` 检查生产 profile、真实 PG18、UTC、Flyway/validate 以及禁用开发认证、假 CDN/短信/模型/支付等配置。现有人工生产判断已纳入 postgres。
- 新环境模板 `infra/env/server-postgres.env.example`；部署预检按 profile 校验 JDBC 引擎。TLS 示例使用 verify-full，迁移前配置 RDS 正确 CA/sslrootcert。

## 持续开发顺序

1. 短期保留旧 MySQL 生产兼容路径；新数据库字段必须同时给旧迁移目录与 PG 目录新增版本，不修改已执行历史。产品功能继续按短分支合并，避免长期迁移分支落后主线。
2. 先通过旧默认测试与 PG 门禁，再把脱敏源库快照导入隔离 PG，完成上面的完整结构对账；不在生产应用启动时自动补列。
3. 数据转换要显式定义源 DATETIME 的原时区，按真实写入配置转成 UTC timestamptz；不得把 Asia/Shanghai 的本地时间当作 UTC。钱包、冻结、账本、会员 billing_default、V73 已修改策略、任务回执、OSS key、加密密文原值保留，不重跑历史数据种子。
4. 按实际源表逐表计数、主键分块摘要、金额/冻结不变量、外键/孤儿、NULL/空串、精度、枚举和大文本字节核对；校准所有 identity 序列。发现源库独有结构时必须先补迁移方案。
5. 在新 ECS 的隔离环境接 RDS 做受控演练，关闭真实模型提交、付款和通知；验证账号中心联登、钱包/优惠/授权、持久队列恢复、供应商已有任务只查回执、不重复提交。
6. PG 适配与双 ECS 横向扩展分开验收：ALB 两节点 API、共享 Redis/OSS、worker 单独角色或分布式认领、任务幂等和滚动重启均通过后才申请生产窗口。当前代码不能据此宣称所有后台 worker 已支持双活。
7. 切换窗口暂停写入/worker、等待受理任务按方案收敛、最终导入和校准、业务核对后切换。PG 收到新写入后，回滚须先处理 PG 新增写入，不能只把 DNS 切回旧 MySQL。

## 本地门禁

所有本机重任务遵守统一 devq，以下命令应作为 devq 包装内命令执行，不启动常驻服务。

- 原回归：`./mvnw -q test -DforkCount=1 -DreuseForks=true`。
- PG18.0：`./mvnw -B -Ppostgres-test -Dapi.version=1.44 -DforkCount=1 -DreuseForks=true test`。
- OrbStack 环境按本机 Docker context 提供 DOCKER_HOST；缺 Docker 或数据库启动失败必须失败，禁止 skip。
- `StoragePostgresIT`：基线/所有实体 validate，长中文/emoji 名片、画布和提示词真实读写，12 并发供应商回执 upsert，告警重复插入不破坏事务且不发消息。
- 钱包、模型赠款、队列和 Studio 多次冻结测试通过 `*PostgresIT` 继承原业务断言，动态注入真 PG、开启 Flyway+validate，并检查实际 PG 版本与基线，防止被原 H2 注解替换。
- `LobColumnDefinitionTest` 继续守住原 tinytext 截断事故，增加字符 LOB/OID 风险约束；不能通过删除原断言来制造绿色。
- Flyway core/mysql/postgresql 统一固定 11.14.1；官方该标签的 PostgreSQLDatabase 已明确支持 PG18。旧 10.10 首轮仅作为问题排查证据；升级后须重新完成全部旧回归和 PG18.0 门禁，不连带升级 Boot/OIDC 技术栈。

测试结果与失败修复明细见本次隔离适配验收报告；CI 增加同样的 PG18.0 门禁，不能把本地候选结果当作线上验收。

Flyway PG18 支持依据：[11.14.1 官方源码](https://github.com/flyway/flyway/blob/flyway-11.14.1/flyway-database/flyway-database-postgresql/src/main/java/org/flywaydb/database/postgresql/PostgreSQLDatabase.java#L47)。

适配中已复现并修复：PG保留字 `drama_character.cast`（PG配置启用auto_quote_keyword并在基线引用标识符）；Hibernate6.5把LONG32VARCHAR JDBC类型排除在LIKE/length字符串语义之外（改标准LONGVARCHAR绑定、保留LONG32容量）；旧H2测试动态地址覆盖PG（PG Maven profile显式门控原H2配置，各PG类独立schema）。每项均须由最终门禁证明，不能引用失败的首轮结果。

上线前的源库对账还包括排序规则及业务唯一键的比较语义（登录名、短链、代码等），不能把身份 uid 的严格大小写规则机械套到全部业务字段；以现网契约及脱敏数据回归确认。当前已在专用演练库恢复真实只读快照，未向正式目标或源生产写入数据。

早期适配结果（已被后面的最终门禁取代）：devq `78394c656d0b` 默认后端回归3481项，0失败/错误、12既有条件跳过，并通过离线compile及部署脚本bash-n；devq `f21254d899e6` 真实PG18.0五类57项零失败/错误/跳过，报告检查通过。Flyway三模块11.14.1。该早期记录当时未提交；当前提交、CI和云端证据以本节之后的结果为准。

## 2026-11-04 主线对齐后的准备

迁移准备在隔离 `codex/postgres18` 中与 GitHub main `35c24240a372de037c9c33fdaccdca2c9ebc2ac1` 合并；不能拿早期分支覆盖持续开发的新功能。原开发目录的未提交工作不属于本次补丁。

数据库版本链为 V74 → V75 → V76 → V77。V74 已执行基线保持不变；V75 保留历史 `llm_api_keys`、provider 历史字段、16 个非空约束、103 个默认值、10 个索引和3个外键。`ModelPrice/ModelDiscount` 创建时补齐 `updatedAt`，不覆盖显式提供的历史时间。源 192 张业务表全部保留，不能根据是否有 JPA 实体或产品是否公开筛表。

### 比较规则与重试保护

`db/postgresql/key-comparison-policy.json` 明确登记源259组文本唯一键：

- 用户名、邮件、slug、渠道、批次、配置、模型价格、提示词及技能键采用限定列的 ICU `und-u-ks-level1`，不改数据库全局排序规则。查询和表达式唯一索引都使用 `rtrim`，兼容大小写、重音及尾部空格，同时保留原存储字节。
- `client_request_id/client_message_id/source_reference/reference_id` 等重试引用保留上述比较语义。业务查询、悲观锁查询和唯一约束同时适配；并发变体重试必须返回同一个 hold，仅冻结一次。
- owner UID、任务主键、上游任务号、token/hash/密文保持精确比较，不能将凭据或不同身份转小写。枚举继续按固定合法值处理。不得把“数据库默认C”描述成完整兼容。
- ICU 与 MySQL 使用不同 Unicode 实现，必须在全量恢复副本上实际建索引；发生历史碰撞应中止并报告，不能去重、改主键或覆盖业务记录。

### 时间字段实证

`SourceTemporalPostgresIT` 在真实 MySQL8、Asia/Shanghai JVM/JDBC 下验证当前 Hibernate 6.5 的绑定：`Instant` 和 `OffsetDateTime` 的 DATETIME 存储为 UTC；JDBC-only DATETIME 按 Asia/Shanghai 解释。源 TIMESTAMP 用 UTC session 导出，DATE 保持 DATE。逐列计划覆盖336个时间列；历史表及 `model_alert_delivery` 的8个未映射 DATETIME 单独登记，不把所有列统一减8小时。时区配置变化必须重做此契约，不沿用身份中心的转换规则。

### 真实 RDS 恢复与账务核对

隔离库 `aistar_schema_rehearsal` 使用独立非超级角色 `aistar_rehearsal`。`infra/migration/export_source_readonly.py` 通过一笔只读一致性事务生成192业务表快照，明确标记 `source_frozen=false`，不能作为切流数据。`AistarRehearsalRestore.java` 仅允许该演练库，严格证书/域名校验、空目标、完整元数据及末尾标记；按外键顺序 COPY，校准序列，逐表SHA256 sum/xor全字段校验后才提交。非空目标拒绝覆盖，不支持正式库模式。

首次实跑192表、28,280行全部指纹一致。`AistarFinancialAudit.java` 以只读事务复查V77之后的数据指纹及钱包桶守恒、冻结余额范围、终态剩余、赠款/分配守恒、模型结算拆分、企业批次和账本孤儿。源快照的10类异常计数均为0；目标结果和最终运行证据记录在本次验收报告中。不运行真实模型、支付、短信或通知，也不重放历史任务。

### 后台任务与后续双机部署

`AEP_BACKGROUND_ENABLED` 控制所有 `@Scheduled` 注册，以及发布服务启动时的恢复；新 postgres profile 默认 false，原 MySQL/dev 默认行为保持。新备用节点及导入验证进程必须关闭；主节点仅在正式迁移数据对账和外部依赖就绪后显式打开。该开关提供单活控制，不等于全部worker已经支持双活或整机自动接管。HTTP触发的异步执行仍存在，不能将这个开关当成完整“停写/停任务”。

首次部署清单：A/B各一份同SHA后端与前端；HTTP A100/B0，备用常驻；仅A后台调度。发布组件 sau-service 的浏览器登录态、任务回执和本地文件保持单活，OSS key及JWT/AES/机器认证契约保持。切流前必须把所有在途任务列入排空检查，尤其无外部任务号的同步文字调用；用量未知不能重提或自动退款。

日常滚动入口需要固定新ECS、不可变产物、备用先验收、ALB切权重、连接/任务排空、更新原主及A100/B0恢复。此时尚未迁AIStar生产，旧脚本的地址不是迁移完成标志；不得在本轮运行旧机或新机生产部署命令。将默认入口切到新集群必须与首次激活一起完成，并拒绝旧机覆盖参数。

### 正式窗口另行安排

本轮没有AIStar停写/切流授权窗口，不自动沿用账号中心的11月5日04:00–06:00。先确认最终main/CI及源版本未漂移，再另排维护窗口：停止接收写入和新付费提交→等待/逐类处理在途任务→只停AIStar自有服务及worker→生成全新的同次冻结快照→恢复与全量/账务对账→受保护双节点验证→ALB/旧DNS缓存桥→DNS→日志与客户端验收。新PG接收真实写入后为唯一真源，不能只切DNS回旧MySQL。

后续新schema变更同时维护MySQL与PG迁移，版本编号在各目录分别检查；严禁改已执行V74–V77来修复漂移。最终验收以对应提交的CI、本地devq退出码及真实RDS回执为准。

生产postgres配置由 `PostgresEnvironmentGuard` 在EnvironmentPostProcessor阶段检查，早于DataSource/Hibernate创建；拒绝旧环境遗留的ddl-auto=update或MySQL Flyway目录等覆盖。源env复制后必须显式替换数据库/driver/dialect、schema、Flyway目录/开关、UTC、日志目录与后台角色，不能只改DB_URL。实际数据库版本/角色/时区仍在连接后另行验证。

### 最终白天验收与运行镜像

加入Tair共享短信后的后端最终门禁3537项，0失败/错误、12项既有外部条件跳过；PG专项67项零失败/错误/跳过，额外基线/调度4项及共享短信9项通过。两机真实RDS分别完成190实体validate及合成管理员跨节点认证（最终Tair/容器回执另附）。受保护ALB主备演练267次带登录态请求全部200，包含180秒排空、重启及错误备用配置拦截；没有修改正常域名/DNS。

`infra/images/server/` 提供不可变Java17/FFmpeg/Noto镜像构建，基础镜像必须固定digest，并固定已验收JAR SHA。两机Podman通过Cloud Assistant从官方alinux3-updates安装；已有服务PID保持。SLS独立aistar-app保留14天，采集/var/log/aistar/*.log，复用现有机器组；正式日志必须挂载此目录。镜像离线媒体、日志入库、最终提交CI的验收回执见此次准备报告，不能把包已安装或任务已受理当作通过。

前端回归同时修复旧轮询pending覆盖人工同步paid的竞态：acceptedOrder引用先接受终态，再忽略旧pending；退款等后续终态允许更新。单测覆盖同一React批次乱序回复，Chromium实际点击验收只用合成订单，不发真实付款请求。

仍留正式窗口的动作：最终源版本/结构复核、停写排空、正式库最小权限角色及首次导入、真实生产配置与外部依赖验收、后台主备交接、默认发布脚本切换新集群、ALB/旧DNS缓存桥/DNS切流和观察。AIStar未获窗口，不沿用账号中心窗口。

AIStar PG 主备滚动补充：旧 `/api/auth/sms/*` 的验证码、用途、单次消费、60秒限流、5次失败锁定改用 Tair 单键 Lua 原子状态。`TairSmsCodeStore` 只存 HMAC 手机号键和验证码摘要；短信发送先占位，显式失败释放自己的占位，未知供应商受理状态保留限流；Tair故障返回503且readiness撤下，不回退单机内存。旧MySQL/dev保留原行为。postgres默认tair并强制TLS，正式专用DB15/prefix `aistar:prod:sms:v1:`，演练DB14/prefix `aistar:rehearsal:sms:v1:`；逻辑库与命名空间隔离不等于账号ACL限制。迁移首次停写要处理旧进程内存验证码（TTL默认5分钟）、失败锁定（默认30分钟）和进行中的扫码；无法导出旧锁定时，旧短信接口按最长状态时长保守维护，不能只等待验证码TTL；不能声称可迁出旧进程内存。源码、真实Redis契约及双机真实Tair验证以最终回执为准。

Tair TLS使用阿里云实例`DescribeInstanceSSL`返回的官方CA链；为AIStar复制独立Java truststore（仅trustedCertEntry，保留默认公共根），不修改系统或账号中心信任库。原始JRE默认cacerts不包含此托管私有CA，不能关闭证书或主机名校验绕过。正式镜像入口要求挂载`AISTAR_JAVA_TRUSTSTORE=/etc/aistar/java-truststore`只读；完整API验收必须在相同truststore与不可变镜像上通过。

迁移保持源JVM业务时区`Asia/Shanghai`，JDBC/Hibernate和PG连接仍UTC。源码4个未显式zone的凌晨03:30/40/45/50清理cron及若干LocalDate.now依赖JVM，不能随数据库迁移改成UTC导致业务日/调度晚8小时；用实际镜像的离线时钟/cron边界验收，后台依旧关闭。

正式运行账号与DDL账号分离的验收要在隔离副本先跑：app仅目标schema的DML/序列权限、历史表SELECT，无superuser/createdb/createrole/schema CREATE。JDBC开启hideUnprivilegedObjects，仅向Hibernate暴露有权限的表。旧IdentityUidIndexCheck/V24.uniqueIndexOn使用未限定schema的getIndexInfo并按索引名分组；演练库同时保留public快照与API副本时仍会产生重名索引告警。已直接验证API副本的唯一索引存在且有效；正式库仅使用public，窗口前仍须复核真实约束，不能用隐藏metadata当作修复索引。最终容器启动/合成登录必须使用同类权限的运行账号，不能以演练owner启动代替。

PG18低权限元数据兼容：固定pgJDBC42.7.14（旧42.7.4的hideUnprivilegedObjects会引用已移除RULE权限）；生产postgres运行期Flyway仅validate，DDL由迁移角色先执行，待执行迁移使运行期失败且不建表/不写历史。MySQL/dev及postgresit建库门禁保留原迁移行为。COPY使用UTF8字节流，避免Reader分块拆开emoji代理对；真实PG测试覆盖隐藏无权schema、只读历史验证/拒绝待执行DDL、超64KiB中文/emoji/引号/换行COPY。官方说明：https://jdbc.postgresql.org/changelogs/2025-01-14-42/ ，当前固定发行：https://jdbc.postgresql.org/changelogs/2026-10-07-42.7.14-release/ 。

AIStar运行镜像必须同时固定官方Java与Node镜像digest；Studio仿片分析使用JAR内置Hypit适配器，单有Java/FFmpeg会返回STUDIO_HYPIT_UNAVAILABLE。仅从官方node镜像复制Node22+二进制，不安装npm依赖或替换宿主Node。AistarHypitRuntimeVerification离线调用真实StudioHypitMedia的requireReady/read，合成红蓝视频并验证24帧原始时间戳；两机在禁网/只读根目录下运行，不调用模型/支付/短信或发布平台。
