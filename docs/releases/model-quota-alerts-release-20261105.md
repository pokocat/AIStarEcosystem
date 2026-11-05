# 模型额度告警发布（2026-11-05）

- 发布：`20261105-model-quota-alerts`，仅 server，构建自 main `23c211a2e`，在仓外工作区 `../AIStarEcosystem-release-sonnet-stream` 构建。无数据库迁移。
- 上一版 server：`20261104-sonnet-streaming-editor`（`d43997a18`）。两版之间 server 只多了告警。web-aiavatar 未动，仍是 `20261105-prompt-limit-notice`。
- 直接推 main，没有远端 CI。

## 为什么做

当天 Sonnet 接入点的 Key 额度用完。机器人其实已经发了一条【模型任务告警】（`IPR-2aa9f1f0e26b43909463`），但它的错误原因写的是「生成服务暂时不可用」，真正的原因在服务方返回那一段，并且和其他逐任务告警混在一起。用完之前也没有提醒。

## 做了什么

规则见 [`docs/runbooks/model-task-alerts.md`](../runbooks/model-task-alerts.md)「额度告警」。

- 服务方因额度拒绝调用时，每个接入点每小时发一条【模型额度告警】。
- `ai.quota-watch` 里列的接入点每 5 分钟查一次余额：低于提醒线每天一条，用完或 Key 失效每小时一条，连续半小时查不到发一条。
- 线上配置：`ai-onetoken-sonnet55`，`usagePath=/usage`，提醒线 10 美元。这个数是我定的，用户可以改。

## 检查

- `ModelQuotaAlertsTest` 22 项、`FeishuModelAlertsTest` 12 项、`DialogueStreamingInvocationTest` 9 项通过；`AdminCreditControllerSecurityTest` 6 项通过（确认新 bean 能在完整 Spring 上下文里启动）。后端全量和其他门禁没有跑，这次没有 TS、接口和表结构改动。
- 用例里的 429 响应和余额响应字段取自线上真实返回。

## 上线情况

时间是 UTC（北京时间 = UTC+8）。

- 重启前有一个用户视频在生成，等到 00:54:20 跑完才重启，重启时没有进行中的任务。
- 00:55:20 启动完成（16.5 秒），`NRestarts=0`，JAR SHA256 `28991d35a3710223fe4c5ca048c6a7d03c90ee110e0089e5db6627b9266b92f2`，与本地一致。重启后到验收结束 0 条 ERROR。
- 发布窗口 10 个 502（00:55:03–00:55:19）：6 个部署探测，3 个读余额，1 个读企业列表，都是 GET。不是零中断。

## 线上验收

把提醒线临时设成 999999，走真实链路发一条：

- 00:56:20 第一次查询：`remaining=72.58324485 unit=USD mode=unrestricted valid=true`，用的是线上新 Key。
- 00:56:26 消息送达飞书群，`state=sent`、`attempts=1`、`message_id=om_x100b61890d5668a4c48e7aa2afa8dbb`。群里能看到一条「余额偏低，提醒线 999999」，这是这条验收消息。
- 验收后提醒线改回 10。

这条消息占用了当天的「余额偏低」名额，所以今天余额真的跌破 10 美元也不会再发这一种；额度用完的告警不受影响。按当天余额 72.58、今日用量 0.57 美元，今天不会跌到。

## 验收发现的问题

余额偏低的消息写着「走这个接入点的调用都会失败」，但这时调用其实还正常。已在 main 改成「余额用完后……」，**这次改动没有发布**，为一句话不值得再重启一次，随下一次 server 发布上线。

## 未验证

- 「额度用完」那种告警只有自动化测试，线上没有真实触发（不能为了验收把额度用完）。
- Key 单独设了额度时查到的是什么不清楚。线上这个 Key 的 `mode=unrestricted`，`remaining` 是钱包余额。当天额度用完时钱包还有 70 多美元，所以用完的是 Key 自己的额度，这种情况余额查询看不出来，只能靠被拒绝时那条告警。

## 回滚

恢复生产机 releases 下 `20261104-sonnet-streaming-editor` 的 server JAR（备份在 `/opt/ai-star-eco/backups/20261105-model-quota-alerts-20261105T005442Z/`），旧代码不读 `ai.quota-watch`，配置可以留着。只想关余额提醒：删掉这个配置，或把接入点从里面去掉，不用重启。
