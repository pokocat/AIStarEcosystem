# 生成失败收尾与飞书告警生产发布 — 2026-10-22

北京时间 20:35 发布 server、web-aiavatar、web-celebrity、web-drama、admin；20:38 补发后端告警状态码修正。两个版本均先合入并推送 main，再从干净 main 工作树构建。

## 变更

没有获得有效供应商任务回执时，图片、视频、配音及口型按失败收尾，原结算事务退回未完成部分冻结积分、释放并发，用户明确看到失败原因并可重新生成。历史未知回执沿用原结算服务清理。已经记录供应商任务 ID 的查询故障继续查询原任务，不重复提交。

Studio 任务列表可主动刷新原任务；刷新不重新生成或扣费。后台 AI 模型与用量顶部新增只读生成异常告警，含原任务、端点、错误码和追查号。异步模型错误日志接入持久化飞书通知，群为“模型告警群”，对配置用户发送应用内加急。通知线程独立，失败有限退避，加急失败只重试原消息。

## 制品

| 服务 | main 提交 | 发布包 | 制品证据 |
|---|---|---|---|
| server | `d35a373f2760f17d02f6f7d385f85785fcec2bfa` | `20261022-generation-alert-status` | `00e7c9bf2e0f2ca6e7314ddb232efba0c2b1dbb3b5426dde7788b6b640ccd70d` |
| web-aiavatar | `54e161e9721827ff05b93dc13c6b2515c5d49111` | `20261022-generation-failure-alerts` | `Xb6H0oXsgg6xtVzEWktvs` |
| web-celebrity | `54e161e9721827ff05b93dc13c6b2515c5d49111` | `20261022-generation-failure-alerts` | `Ccxwf7p50rYDQA_uJHOfA` |
| web-drama | `54e161e9721827ff05b93dc13c6b2515c5d49111` | `20261022-generation-failure-alerts` | `xa73NWdw3QVsleV2XqKGV` |
| admin | `54e161e9721827ff05b93dc13c6b2515c5d49111` | `20261022-generation-failure-alerts` | `JMBaIoWXWrCpIR7BbAAfF` |

后端 JAR 与服务器 SHA256 一致；四个前端 BUILD_ID、包含新行为的公网 JS chunk 与构建产物逐个校验一致。Flyway V64 成功，五个服务 active、NRestarts=0。两次部署 verify.sh 全绿。服务器 release-id / release-sha 标记已逐服务核对并写入。

## 检查与验收

- 四道提交门通过：全 workspace 类型检查、admin 类型检查、后端离线编译、API 契约检查。契约工具既有未实现接口提示保留，本次新增接口有真实 handler。
- 相关后端 87 项测试通过；Studio 102、共享状态 10、带货 108、后台告警 2 项测试通过。覆盖退款幂等、已交付图片保留、已知供应商任务不退款重投、旧任务收尾、通知去重/有限重试、加急失败不重复发消息、诊断脱敏与缺失 HTTP 证据。
- 生产普通用户访问告警接口返回403；超级管理员正常读取3条异常。真实浏览器展开视频错误记录，能看到失败/退款/重试说明、错误码及追查号。刷新只查询原记录。
- Studio 实际任务列表组件桌面和窄屏验收：失败任务显示重新生成；已受理但查询失败显示刷新结果；无假进度/待核对文案。生产原任务 GET 返回 failed、cost=0。

| 原任务 | 类型 | 退回积分 | 新追查号 | 飞书消息 |
|---|---|---:|---|---|
| `IPR-af62983c` | 图片 | 30 | `4RWFZAAW4AQK` | `om_x100b62947fa18ca8c42b7cb1fec4815` |
| `IPR-b7074fc9` | 图片 | 30 | `VQLAN8U8JNKC` | `om_x100b62947cd62cb0c0834ca6dcd5296` |
| `mvj_265ff6b6e166` | 视频 | 520 | `J6QUZY3347UN` | `om_x100b62947c0754a8dd234b11baa1735` |

共退回580积分，逐笔核对原钱包、用户、积分来源及冻结记录未换绑；原FREEZE流水保留，每笔只有一次UNFREEZE，两条合计净额0；3条队列记录均finished。视频对应Studio任务 `IPR-e0679edb33ef40e6a678` 同步失败且cost=0。15510936196所属账户退回520+30，另一图片任务所属账户退回30。

3条真实告警均state=sent、attempts=1，同时完成群发送和指定用户应用内加急；后端再次重启后没有重复发消息、没有重复退款。旧回执收尾异常没有保存HTTP状态，首批通知的默认500已通过官方消息编辑API原地更正为“未记录 HTTP 状态”，并同步通知正文；未新增消息、未再次加急。后续代码不会推断HTTP500，能够提取明确供应商HTTP状态时优先显示该值。

原供应商调用证据保留在请求日志，历史视频供应商请求追踪号 `req_01a16341-b439-7371-b964-86cb9690732b`。本次验收没有提交付费模型生成请求。

## 配置与边界

应用凭据已通过stdin验证并安装于服务器受限配置（0600）；发布记录及Git不含密钥。发送消息与应用内加急权限已真实验证。消息仅含错误分类、状态证据、任务号和追查号，不转发提示词、素材URL、供应商全文或手机号。

Impeccable 本次改动检测无新增问题；任务状态交互已修复，未增加任何忽略。此前 `studio-flow.css` 宽度动画告警属于既有样式，本次保留，未扩大到动画重构。

本地验收文件位于 `.studio-e2e/generation-help-20261022/`，包括构建/部署日志、after-final.json、artifacts-final.json、services-final.json、task-refresh.png 与 admin-production.png；服务器受限快照在 `/opt/ai-star-eco/backups/generation-help-20261022/`。部署运行手册见 `docs/runbooks/model-task-alerts.md`。
