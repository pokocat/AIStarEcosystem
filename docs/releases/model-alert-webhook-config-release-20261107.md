# 模型告警 Webhook 配置发布（2026-11-07）

时间采用 America/Los_Angeles（PST）。用户明确要求将此前提供的新 hook 配入生产并快速发布。

- 只在 `/etc/aistareco/server.env` 增加 `AEP_FEISHU_ALERT_WEBHOOK`。新地址与本地指定配置一致；地址为密钥，不写入本记录、Git 或日志。文件权限保持 0600，其他环境变量逐行核对不变。
- 原配置备份：`/opt/ai-star-eco/backups/20261107-alert-webhook-config/server.env.before`，0600；备份目录 0700。同目录 `metadata.json` 保存脱敏切换证据。
- 沿用线上已有 Webhook 支持制品，无构建、迁移或前端发布。重启前后 JAR SHA256 均为 `51b9341c5c7ab522057eb12e5c504cdfee94a4c678c69b76fb83154e011cf652`。
- 等待正在运行的生成任务和导演流程结束；重启前所有受查生成任务、队列、制作执行和导演 active 均为 0，最近 120 秒 API 写请求为 0。
- **09:56:40 PST** 重启 `aistareco-server`（生产日志为 2026-11-08 01:56:40 CST），MainPID 从 `2522665` 变为 `2537441`；**09:57:00 PST** 本机 API 就绪。
- 运行进程中的 Webhook 与指定地址哈希一致，格式有效；`AEP_FEISHU_ALERTS_ENABLED=true`、`AEP_FEISHU_ALERT_URGENT=false`。任务及额度告警共用 Webhook，代码会跳过应用机器人和加急。
- `verify.sh ALL GREEN`、退出码 0；主页、登录、项目及 `/api/config` 均 200，所查 systemd 服务 active、后端 `NRestarts=0`、启动后 ERROR 0；Nginx 配置检查通过。
- 截至 09:57:30 PST 没有新告警投递记录，未额外发送测试消息；本次确认配置切换及服务健康，不将它描述为已验证飞书群实际收信。历史通知没有重投，失败记录未重置。

回滚仅需恢复上述受限配置备份，在业务空闲时重启后端并执行健康检查；无需更换 JAR 或回滚数据库。
