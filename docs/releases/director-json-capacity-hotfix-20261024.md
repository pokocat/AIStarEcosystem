# 导演长剧本任务容量应急修复

记录日期：2026-10-24（America/Los_Angeles）；服务器事件时间：2026-10-25 14:44 CST。

## 原因与范围

作品 `DW-8104bc39f1ad4440b17f` 的已保存剧本为 22,429 字符、64,061 UTF-8 字节。拆分任务额外包含段落编号、系统提示词和执行参数，写入 `ip_run.input_json` 时超过生产 TEXT 的 65,535 字节上限，两个 POST 返回 500：

```text
Data truncation: Data too long for column 'input_json' at row 1
traceId=mUMrrayPyHBDNnSM
traceId=jupRtcTMBuqU8uRV
```

任务没有提交成功，也没有调用模型。两次事务的冻结记录均未留存，作品正文、revision=1、无分集状态保持原样。V27 建表本来为 LONGTEXT，但 `IpRun` 实体映射为 TEXT；生产实际两列均为 TEXT。实体不一致是明确缺陷，未追溯历史上具体哪次 schema update 改窄了列。

## 生产处置

- 先以 single-transaction 导出 `ip_run`，备份 `/var/backups/aistareco/iprun-capacity-20261025/ip_run.sql`，文件权限 0600，8,070,083 字节。
- MySQL 8.0.46 不支持该类型变更使用 INPLACE；明确指定 INPLACE 的首次尝试失败，未改表。
- 对 `input_json/output_json` 同时执行 LONGTEXT NULL 扩容，保留 utf8mb4_unicode_ci；`lock_wait_timeout=2`、`ALGORITHM=COPY, LOCK=SHARED`，期间可读，写入会短暂等待。DDL 实测 0.226 秒。
- 扩容前后均 776 行。未重启、未改正文、未提交生成请求、未修改积分。
- 服务 PID 2556307、启动时间 2026-10-25 13:49:26 CST 不变。
- 按生产表 `CREATE TEMPORARY TABLE ... LIKE ip_run` 验证两列分别写入 60,000 个汉字的 JSON（各 180,014 字节），JSON_VALID=1，逐字比较一致；临时表已删除。无真实任务或扣费。

## 代码与验收边界

代码改为 LONGTEXT 实体映射，新增 V66 幂等迁移，生产已扩容时直接跳过，不篡改 Flyway 历史。用户要求先合主线，待低峰再发布；本轮不发布制品、不重启服务。本次没有替客户重新触发 AI 拆分，因此模型拆分终态和客户浏览器显示仍待客户操作验证。

本地 `./mvnw -q -o -Dtest=V66IpRunJsonCapacityTest test` 通过：3 个测试覆盖旧字段合并扩容、已扩容跳过、缺列明确失败；`git diff --check` 通过。生产临时表读写验证补足 H2 无法复现 MySQL TEXT 字节限制的边界。

2026-10-25 合主线前检查：`pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract`、后端离线 compile 均通过。`ModelJsonTest,Studio*Test,DirectorPromptsTest,ProposePlanToolTest,V66IpRunJsonCapacityTest` 共 99 个测试类、595 项，0 failures / 0 errors / 5 skipped。首次扩大回归的 JVM 被系统以 137 终止；设置 `-Xmx768m -XX:MaxMetaspaceSize=384m` 和 Spring 测试上下文缓存上限 2 后完整重跑通过。未执行生产发布或服务重启。
