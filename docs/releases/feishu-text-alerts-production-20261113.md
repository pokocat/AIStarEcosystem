# 飞书模型任务文本告警生产发布（2026-11-13）

- 应用提交为 `caa912a02277bdf0d5abb05b9dbf47ad96c5bd6e`，包含文本告警提交 `545c0a683`。[正式 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43471148655) 的 30 项检查全部通过，含后端三分片及 PostgreSQL 18 实库检查。Mac mini 提交前的工作区类型检查、后端编译、API 契约检查及 48 项告警定向测试通过。
- 发布范围为正式 API 及节点 A 的独立后台。制品 `30e9f943e0bd9917`，JAR SHA-256 `30e9f943e0bd9917c48ce4a87c9adbe5e4ce76252d25d62b1ed84a32f9c007bd`，镜像配置 `sha256:25044de3de48d6e63f62644489b44d1345b8d78f4576601e8f71d9fc8421e743`。A/B 私有 OCI 归档 SHA-256 `7ea0c0f932fabf77a738c42992223f13974624fdadf7b73425e81e9bbe25902e` 一致。PostgreSQL 运行角色与 Flyway V82 核验通过，数据库结构、前端制品、独立导出进程、SAU 和 DNS 无本次变更。
- 北京时间 2026-11-14 01:41:38，API 切为 A100/B0。两个正式 VIP 均由 A 响应，就绪 200、普通发布探针账号 200、匿名 401 和普通账号访问后台 403。A API 与独立后台运行新制品，后台连续三次确认本机工作排空后完成交接，就绪通过且重启计数为 0。B 热备保留 `27bed09c1` / `9fdc91574addfc26`。回退前核验同一数据库兼容性，按统一 API 切流入口及独立后台排空流程执行，后台旧配置保存在 A 的 `/opt/aistar-cluster/control/background-before-30e9f943e0bd9917.conf`。
- 首次发布在 A 本机验收后因 SSH 发布锁连接中断而停在切流前。首次续跑遇到本机到 ALB 管理接口的连接超时，恢复到原承流 B，并通过双 VIP 验收。随后从已就绪的 A 继续切流成功。两机 SLS 采集进程均运行，发布窗口内 SLS 聚合返回 95 行。A 新版 API 启动窗口及新版后台日志未发现错误。
- 在实际运行的新版 API 制品中，以模拟输入验证了 Webhook `msg_type=text`、用户、操作、完整页面网址及文本分隔。此次未向群发送测试消息，切流后查询暂未出现自然触发的新模型任务告警。
- 发布及验收回执保存在本机 `/tmp/aistar-feishu-text-20261113.KmA7Bo/`。
