# AIStar PostgreSQL 导入与主备滚动发布

状态：准备与隔离演练；生产窗口另行确认。账号中心和军师已迁移，不在本 SOP 的停写范围内。ClassVibe 不迁正式数据。

## 发布边界

- 新 A/B：`infra/cluster/production.json` 为唯一节点清单。正式 API 两机 `AEP_BACKGROUND_ENABLED=false`；后台/SAU 在 A 单活，B 不启用。API 经 ALB，常态 A100/B0。
- `infra/scripts/deploy.sh server` 默认进入新双机流程；`--plan` 只读展示。旧 `deploy-release.sh`、`update-and-deploy.sh` 入口已禁用，不接受旧机覆盖参数。前端/SAU 需要对应组件的集群验收，不自动退回旧单机。
- `--stage` 只能使用 `aistar_schema_rehearsal/aistar_api_rehearsal`、Tair DB14、私有 Host/header 的演练组；JDK 屏障只允许 RDS/Tair，禁用子进程和付费外联。正式为 `aistar_prod`、Tair DB15，必须有正式导入凭证和激活标记。
- 发布包不含机密；只通过 SSH 传输，禁止 OSS 临时公开传输。环境 root:600，应用 UID10001，只读根文件系统；官方 Java17/Node/FFmpeg 固定镜像。

## 代码与顺序

1. `export_source_readonly.py` 仅抓取白天一致性快照：绑定 192 表、源 JAR/结构 SHA、JVM/JDBC Asia/Shanghai 时区。`temporal-plan.json` 是逐字段历史绑定规则，不能整体平移8小时。
2. `freeze_source.py` 仅供另行批准的窗口：剩余至少15分钟、入口关闭、SAU停写、在途清零、旧内存验证码/锁隔离、源包/结构/关键配置 SHA 无漂移，才停止旧 AIStar unit。共享 MySQL/Redis、身份、军师不得停止。
3. `export_frozen_snapshot.py --frozen-context ...` 生成同次新鲜冻结快照；不准把白天 live 快照标成 frozen。
4. `cluster/import_snapshot.py` 默认只读预检；`--execute` 才执行。生产计划必须独立明确授权 UTC 起止窗口、源 PID0、同次冻结时间、快照/逐字段时区/迁移文件 SHA；Java `AistarCutoverGuard` 再验证。导入只能由新 A 以迁移角色执行。
5. `AistarApplicationGrant` 在导入凭证核对后授权应用 DML/序列、禁止 CREATE，实测运行角色读取/UPDATE 权限且 DDL 被拒绝；若导入已提交但授权失败，只能带同一凭证 `--grant-only --execute` 重试授权，不重新导入。
6. `AistarSnapshotRestore` 申请数据库会话锁，拒绝非空目标；固定当前 V74–V77 字节，UTF8 COPY 一个事务恢复 192 表，全行/全列字段指纹、行数、序列和10项资金守恒全部通过后才提交。失败回滚业务事务；DDL可能已存在但业务表保持空，须查明原因，不覆盖非空库。
7. CI 全后端 + PostgreSQL18 实库门禁成功后保存同一个 JAR/工具和 `verified-backend.json`；按该 SHA 构建不可变镜像/包。不能把单测打包、排队或本机 Docker 不可用算作完整验收通过。
8. `cluster/release.py` 先验证两机候选环境/镜像，再排空 B、更新 B、B100；严格 TLS 两VIP验收，再排空 A 至少180秒且连续3次请求/线程池/持久任务为0，更新 A，恢复 A100/B0。SSH flock 防并发；任何未知或在途任务阻止停止，不强杀，不盲目恢复旧版本。
9. `/internal/deployment` 仅回环+强令牌：POST 取消未来调度但不打断已受理任务，GET 返回排空证据；异步Servlet请求计数到真正完成。Nginx必须拒绝该路径及子路径，即使私有探针 header 正确也不得公开代理。

## 正式窗口前和窗口内

- 再合并最新 main、核对最终 SHA 所有 CI，核对旧源 JAR、192表结构、AES/JWT/身份/微信支付配置摘要无漂移。不要替换业务密钥或真实付款验收。
- 完整冻结备份及恢复权限、磁盘/数据库容量、严格TLS、SLS采集；正式目标确认空。保留旧静态资源及DNS缓存桥。
- 生产入口写保护→等待所有外部生成/回调/资金冻结处理完成→SAU停写且任务为空→旧内存短信有效期/锁隔离→仅停止旧AIStar→同次冻结 SQL/本地文件最后增量→正式导入→应用最小权限授权和 schema validate。
- 双机本地文件的跨节点真源为OSS（private+签名）。`openForRead` 本地缺失会下载OSS。旧约4GB缓存预置只是加速；窗口内必须校验仅本地存在的历史素材和DB内绝对路径、权限及最终增量，不能用预置替代校验。
- API两机后台关闭；独立后台/SAU在A单活，B禁用。后台更新必须先等待持久任务清零，再取消未来调度并核对线程排空，禁止取消轮询后等待仍在运行的上游任务。该角色交接须单独验收，不由API滚动脚本暗中启停。
- 正式导入完成后，将脱敏 receipt 文件名及SHA写入 root 私有 `/opt/aistar-cluster/production-activated.json`；仅能指向 `/opt/aistar-migration/preparation/` 的正式receipt。正常API尚未切流时私有端点验收登录/跨机token、支付配置/回调签名逻辑、账本读写事务（隔离合成数据）、SSE退出、文件读取。
- ALB新正式组和正常Host规则/公有Nginx标记/DNS，只在窗口验收成功后激活。默认ALB组也可能把请求送到节点80，不能以“尚无正常Host规则”代替Nginx入口隔离。
- PostgreSQL接受真实用户写入后成为唯一真源，禁止回启旧MySQL写入。恢复旧应用版本也只能指向同一个PG并先验证兼容性。

## 验收和保留项

凭证需包含实际 SHA/JAR/镜像、192表行数/字段指纹、10项资金检查、重复导入拒绝、两机真实进程/环境、TLS两VIP、持续鉴权请求、ALB A100/B0、180秒排空和失败保护。SLS、其他服务、旧源未变更另有保护记录。

本次准备不会：导入 `aistar_prod`、启动新正式后台/SAU、停旧生产、启用正常Host/DNS。完整生产迁移还需上述独立窗口和前端/后台/文件最终验收；API演练成功不等于全栈已切换。
