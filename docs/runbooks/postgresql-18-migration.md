# PostgreSQL 18 适配与迁移边界

本阶段只做隔离代码与本地真实数据库验收，尚未迁移生产、切流或创建云端账号。新 RDS 为 PostgreSQL 18.0，测试固定使用上游 `postgres:18.0-alpine`；上游镜像无法代替阿里云具体内核验收。

## 代码与配置

- 新增 `apps/server/src/main/resources/application-postgres.yml`：生产 profile，独立 Flyway `classpath:db/postgresql`、禁止自动 baseline、Hibernate validate、UTC 连接和时间映射；数据库地址、账号、口令均无本地默认。
- 空库基线 `db/postgresql/V74__postgresql_baseline.sql` 包含当前 190 个模型表、JDBC 专用的 `model_alert_delivery` 、历史软删/已读列和固定参数索引。旧 MySQL/H2 的 V1–V74 SQL/Java 文件不变，也不被 PG 扫描。
- **该基线是当前应用结构的可执行基线，不等于已完成源生产结构全量对账。** 之前源库快照有 193 张表（含 Flyway）；该基线建成 192 张表（含 Flyway）。上线导入前必须查清这 1 张遗留表以及全部源库独有列、动态创建索引、外键、默认值和手工修表；不能直接丢弃或假定无用。对账完成后用新 PG 迁移补齐，不能伪造旧 Flyway 历史。当前基线不能作为“所有历史数据已可无损迁移”的证明。
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

上线前的源库对账还包括排序规则及业务唯一键的比较语义（登录名、短链、代码等），不能把身份 uid 的严格大小写规则机械套到全部业务字段；以现网契约及脱敏数据回归确认。当前未使用云端数据库口令、未导入真实业务数据。

最终本地结果（源码冻结后）：devq `78394c656d0b` 默认后端回归3481项，0失败/错误、12既有条件跳过，并通过离线compile及部署脚本bash-n；devq `f21254d899e6` 真实PG18.0五类57项零失败/错误/跳过，报告检查通过。Flyway三模块11.14.1。未部署、未提交、未触发GitHub CI。
