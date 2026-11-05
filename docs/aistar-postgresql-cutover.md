# AIStar PostgreSQL 导入与主备滚动发布

状态：准备与隔离演练；生产窗口另行确认。账号中心和军师已迁移，不在本 SOP 的停写范围内。ClassVibe 不迁正式数据。

## 发布边界

- 新 A/B：`infra/cluster/production.json` 为唯一节点清单。正式 API 两机 `AEP_BACKGROUND_ENABLED=false`；后台/SAU 在 A 单活，B 不启用。API 经 ALB，常态 A100/B0。
- `infra/scripts/deploy.sh server` 默认进入新双机流程；`--plan` 只读展示。旧 `deploy-release.sh`、`update-and-deploy.sh` 入口已禁用，不接受旧机覆盖参数。前端/SAU 需要对应组件的集群验收，不自动退回旧单机。
- `--stage` 只能使用 `aistar_schema_rehearsal/aistar_api_rehearsal`、Tair DB14、私有 Host/header 的演练组；JDK 屏障只允许 RDS/Tair，禁用子进程和付费外联。正式为 `aistar_prod`、Tair DB15，必须有正式导入凭证和激活标记。
- 发布包不含机密；只通过 SSH 传输，禁止 OSS 临时公开传输。环境 root:600，应用 UID10001，只读根文件系统；官方 Java17/Node/FFmpeg 固定镜像。

## 代码与顺序

1. `export_source_readonly.py` 仅抓取白天一致性快照：绑定 192 表、源 JAR/结构 SHA、JVM/JDBC Asia/Shanghai 时区。`temporal-plan.json` 是逐字段历史绑定规则，不能整体平移8小时。
2. `freeze_source.py` 仅供另行批准的窗口：剩余至少15分钟、入口关闭、SAU停写、在途清零、旧内存验证码/锁隔离、源包/结构/关键配置（含 AEP_SECRET_KEY、JWT、身份、微信支付、OSS）SHA 无漂移，才停止旧 AIStar unit。共享 MySQL/Redis、身份、军师不得停止。
3. `export_frozen_snapshot.py --frozen-context ...` 生成同次新鲜冻结快照；不准把白天 live 快照标成 frozen。
4. `cluster/import_snapshot.py` 默认只读预检；`--execute` 才执行。生产计划必须独立明确授权 UTC 起止窗口、源 PID0、同次冻结时间、快照/逐字段时区/迁移文件 SHA；Java `AistarCutoverGuard` 再验证。导入只能由新 A 以迁移角色执行。
5. `AistarSnapshotRestore` 申请数据库会话锁，拒绝非空目标；固定当前 V74–V77 字节，UTF8 COPY 一个事务恢复 192 表，全行/全列字段指纹、行数、序列和10项资金守恒全部通过后才提交。失败回滚业务事务；DDL可能已存在但业务表保持空，须查明原因，不覆盖非空库。
6. `AistarApplicationGrant` 在导入凭证核对后授权应用 DML/序列、禁止 CREATE，实测运行角色读取/UPDATE 权限且 DDL 被拒绝；若导入已提交但授权失败，只能带同一凭证 `--grant-only --execute` 重试授权，不重新导入。
7. CI 全后端 + PostgreSQL18 实库门禁成功后保存同一个 JAR/工具和 `verified-backend.json`；按该 SHA 构建不可变镜像/包。不能把单测打包、排队或本机 Docker 不可用算作完整验收通过。
8. `cluster/release.py` 先验证两机候选环境/镜像，再排空 B、更新 B、B100；严格 TLS 两VIP验收，再排空 A 至少180秒且连续3次请求/线程池/持久任务为0，更新 A，恢复 A100/B0。SSH flock 防并发；任何未知或在途任务阻止停止，不强杀，不盲目恢复旧版本。容器停止上限240秒、systemd停止上限300秒，使用显式podman stop和Spring graceful shutdown，避免默认10秒截断。
9. `/internal/deployment` 仅回环+强令牌：POST 取消未来调度但不打断已受理任务，GET 返回排空证据；异步Servlet请求计数到真正完成。Nginx必须拒绝该路径及子路径，即使私有探针 header 正确也不得公开代理。

## 正式窗口前和窗口内

- 再合并最新 main、核对最终 SHA 所有 CI，核对旧源 JAR、192表结构、AES/JWT/身份/微信支付配置摘要无漂移。不要替换业务密钥或真实付款验收。
- 完整冻结备份及恢复权限、磁盘/数据库容量、严格TLS、SLS采集；正式目标确认空。保留旧静态资源及DNS缓存桥。API先迁时，旧Next前端的rewrites仍访问localhost:8080，必须在旧API停止后安装 `infra/nginx/aistar-legacy-loopback-bridge.conf.example` 对应回环桥，并保留旧公网API的缓存桥。两者只代理固定ALB域名，Host/SNI保持api.aibuzz.cn并严格验TLS；前端逐域迁移另行验收。
- 生产入口写保护→等待所有外部生成/回调/资金冻结处理完成→SAU停写且任务为空→旧内存短信有效期/锁隔离→仅停止旧AIStar→同次冻结 SQL/本地文件最后增量→正式导入→应用最小权限授权和 schema validate。
- 双机本地文件的跨节点真源为OSS（private+签名）。`openForRead` 本地缺失会下载OSS。旧约4GB缓存预置只是加速；窗口内必须校验仅本地存在的历史素材和DB内绝对路径、权限及最终增量，不能用预置替代校验。
- API两机后台关闭；独立后台/SAU在A单活，B禁用。后台更新必须先等待持久任务清零，再取消未来调度并核对线程排空，禁止取消轮询后等待仍在运行的上游任务。该角色交接须单独验收，不由API滚动脚本暗中启停。
- 正式窗口中先将已核对的私有 `formal-environment-private.json` 和 `formal-contract-private.json` 安装为 `/etc/aistar/server.json` 与 `/etc/aistar/deployment-contract.json`（root:600）；部署实际容器须逐字段匹配契约，不改业务加密/支付密钥。正式导入完成后，将脱敏 receipt 文件名及SHA写入 root 私有 `/opt/aistar-cluster/production-activated.json`；仅能指向 `/opt/aistar-migration/preparation/` 的正式receipt。正常API尚未切流时私有端点验收登录/跨机token、支付配置/回调签名逻辑、账本读写事务（隔离合成数据）、SSE退出、文件读取。
- ALB新正式组和正常Host规则/公有Nginx标记/DNS，只在窗口验收成功后激活。默认ALB组也可能把请求送到节点80，不能以“尚无正常Host规则”代替Nginx入口隔离。
- PostgreSQL接受真实用户写入后成为唯一真源，禁止回启旧MySQL写入。恢复旧应用版本也只能指向同一个PG并先验证兼容性。

## 验收和保留项

凭证需包含实际 SHA/JAR/镜像、192表行数/字段指纹、10项资金检查、重复导入拒绝、两机真实进程/环境、TLS两VIP、持续鉴权请求、ALB A100/B0、180秒排空和失败保护。SLS、其他服务、旧源未变更另有保护记录。

本次准备不会：导入 `aistar_prod`、启动新正式后台/SAU、停旧生产、启用正常Host/DNS。完整生产迁移还需上述独立窗口和前端/后台/文件最终验收；API演练成功不等于全栈已切换。

## 跨机素材与存量预置（2026-11-05）

混剪有独立于file-storage的本地目录：`/data/aistareco/mixcut-assets`、`mixcut-output`、`mixcut-work`。已查到133条素材中9条仅本地，89条成片中4条没有OSS key；不能仅预置file-storage就视为完整。读源文件清单有300文件、约1.56GB，其中约1.52GB可只读GET原有业务OSS对象并逐文件SHA核对，约45MB历史文件/预览通过私有SSH预置。禁止重新启用归档的OSS迁移中转上传工具，也不写旧生产DB。

`aep.storage.require-durable-uploads` 在postgres默认true。新上传（含preset/official）和成片必须OSS成功才确认保存；失败不确认本地独有结果。缩略图共享失败不返回已经不可用的本地链接。缺本机副本时，从已授权的资产记录cdnKey回源，缓存用临时文件原子发布；相对URL仍检查属主与路径边界。旧静态素材URL支持读共享副本和Range，不从DB任意localPath读文件。

新节点的 `/opt/aistar-cluster/work` 独立可写并属UID10001；同时挂到 `/app/work` 和 `/data/aistareco`，为旧DB绝对路径提供兼容映射。旧file-storage读别名只读挂载到 `/opt/ai-star-eco/server/file-storage`。daytime预置不取代窗口最后增量。

网关使用显式include，不能仅把配置放入conf.d后运行nginx -t就宣布生效；须核对nginx -T的实际include并走真实鉴权请求。两VIP探针同时验证`X-Aistar-Node`与目标A/B一致。ALB必须关闭粘滞会话、开启至少180秒连接排空并检查正确Host的`/internal/ready`。冷启动必须就绪与实际运行验收在300秒内共同收敛，失败留私有诊断并保留当前健康主节点。

## 本轮资料补充

正式私有探针模板为 `infra/nginx/aistar-private-readiness.conf.example`，独立Host `api-readiness.aibuzz.cn`，需ALB Host+本次强header规则；该规则和正式服务只能在另行确认的窗口激活。正常Host的public marker保持关闭直至私有验收通过。探针与正常入口都拒绝deployment控制接口。

混剪素材上传与任务生成集中于2026年5–6月，近90天没有新上传/生成/草稿更新，但61条素材仍有历史引用，11月3日仍有列表GET；源站素材静态访问最后为8月25日，成片为8月23日。源站日志不覆盖直接OSS/CDN访问，不能据此删除或断言全为测试数据。72条无上述引用的素材仅列为清理候选，清理另行确认；本轮不新增NAS。

单活后台模板同时保留 `/app/work` 与 `/data/aistareco` 路径，旧file-storage别名只读，执行前固定检查新A实例身份；不得安装启动到B。后台/SAU真实接管、前端域名迁移、真实付款和第三方发布仍须独立窗口/验收，不把API隔离演练等同于全栈上线。

CI产物的镜像构建、OCI归档和发布包压缩均在新ECS B完成；本机仅进行SSH传输、流式摘要与发布控制，不并发启动本机构建/压缩。本机确需构建/测试时仍必须进入devq，不改动其他聊天的任务。

窗口排空证明需逐项包含 `ip_run`、`material_video_job`、`aep_publish_jobs`、`clip_render_job`、`clip_shot_job`、`music_gen_job`、`video_studio_prompt_optimization`、`ai_generation_queue`、`ip_dialogue_message`，并核对旧入口在途请求、后台线程、供应商未知受理及SAU任务。缺失或未知任一项都不能执行停写。

## 私有镜像传输恢复（2026-11-06）

`archive_transfer.py` 对B源归档先核全量SHA，A已有文件必须逐字节前缀SHA相同才从原长度继续传输，完成后再核完整SHA。长度超界或前缀不符时保留拒绝的私有文件并从0重传，禁止加载半文件。流传输允许900秒并回收本次SSH生产者；只读元数据查询允许三次传输重试，停止/启动/切权重等动作不盲目重放。B已有完整OCI仅在归档config digest、实际镜像、CI提交标签与固定基础层一致时复用。云端发布包压缩和SSH传输仍不使用OSS迁移中转。

夜间已用云端65,536字节夹具实测：4,096字节正确前缀续传剩余61,440字节；错误前缀保留后从0重传；两种结果均全量SHA一致。639,812,096字节既有OCI归档也已复查A/B全量SHA一致。该传输验收不等同于新应用滚动验收，最终应用仍须使用对应CI产物完成全流程。

## 连续制作与退出残留（2026-11-06）

新main的连续制作/长视频可能处于两个子任务之间，子任务全为0时 `ip_plan_execution` 仍在running。API排空增加该计数；正式permit必须包含全部10项计数。源停写脚本在停unit前再只读即时核查实际10项SQL计数，缺字段、非零、未知或超过60秒的证明均拒绝停写。没有修改生产状态来演示这些拒绝。

Podman4.9实测留有已退出的旧演练容器（Pid0、Exited=true、Removing），导致同名新进程反复125退出。启动器仅在同名旧容器能绑定本集群已验证release/镜像/模式，Pid0且Exited、目标端口没有服务时，用官方CLI退役该精确ID；不删镜像/卷，不处理未知或运行中容器，不重置运行时状态/锁。CI验证活进程、未知标签和端口仍活动时均拒绝移除。
