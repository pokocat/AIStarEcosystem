# Studio 图片长任务恢复修复 — 2026-10-28

已先合入并推送 main，再从干净的 main 提交 `fda4e43376aaebceb6d0bb535f5f7ab4fbabcf2e` 构建，仅发布 server。保留 main 既有功能及其他工作区未提交改动。

## 问题与变更

三个同步图片请求在北京时间 2026-10-28 23:36 的服务重启中丢失响应。原记录只有 `submitAttempted=true`，没有任务号、镜像图片或错误码：恢复要求有回执，超时/冻结清理又跳过已尝试提交的记录，导致一直 running。

队列现在也会检查没有错误码的缺失回执。结算时在锁内重新核对任务与当前图片状态，保护仍有效的执行租约及原请求快照的超时窗口（另留 60 秒处理余量）。过期且无回执、无产物才进入既有失败事务，保留已成功图片及费用，仅释放剩余冻结；不重新提交供应商。有任务号或镜像产物的任务继续原任务恢复。

同时将飞书告警的代码与 env 示例默认值改为普通消息。生产进程核对 `AEP_FEISHU_ALERT_URGENT=false`。

## 制品与检查

- 发布包：`20261028-image-orphan-recovery`；server JAR SHA256：`9d48cbbd4639a11745a0dbed70158359c0e9fd93607143cb4f42b3c6fd218466`，本地与生产逐字节摘要一致。
- 后端 63 项相关回归通过，包括没有错误码的崩溃检查点、请求超时保护、执行租约保护、原任务/原产物恢复、部分成功保留和重复收尾幂等；包含 14 项告警相关测试。
- workspace 类型检查、admin 类型检查、后端离线编译及 API 契约门通过；干净重编译后测试通过。
- `verify.sh` ALL GREEN；服务 active、NRestarts=0；Flyway 仍为 V69.1，无新增迁移。部署脚本没有更新逐服务发布标记，核实实际 JAR 摘要后已补齐 server 的 release-id/release-sha。

## 线上验收

| 原任务 | 结果 | 释放积分 | 队列 |
|---|---|---:|---|
| `IPR-0e3213ba` | failed / STUDIO_IMAGE_SUBMISSION_UNKNOWN | 55 | finished |
| `IPR-cfa261cc` | failed / STUDIO_IMAGE_SUBMISSION_UNKNOWN | 16 | finished |
| `IPR-2f204536` | failed / STUDIO_IMAGE_SUBMISSION_UNKNOWN | 16 | finished |

合计释放 87 积分。三笔 hold 均为 RELEASED、remaining_amount=0；每个任务只有原来一次 FREEZE 和新增一次 UNFREEZE，金额互相抵消。再次查询后账本与 hold 完全相同，无重复退款。未通过 SQL 修改任务或钱包，由新代码自动收尾。

分别以原 owner 调用用户接口读取三个原任务，均返回 failed、cost=0，以及未完成部分已退款、可重新生成的说明。进程启动后的日志没有三个原请求的新供应商提交，用量记录与发布前相同。

对应三条普通飞书告警均 sent、attempts=1，message_id 分别为 `om_x100b611df64b54a4df69721b8d40748`、`om_x100b611df7fd50a4df241bfd8d66650`、`om_x100b611df71740b0c0ceae5def441a9`。未调用加急。

生产快照：`/opt/ai-star-eco/backups/image-orphan-recovery-20261028/{before,after}.json`。本地脱敏证据保存在原工作区 `.studio-e2e/long-task-review-20261028/`。
