# 模型告警北京时间与服务方响应发布 — 2026-10-24

北京时间 2026-10-25 01:14:34 完成部署命令。按用户要求，本次不做部署后验证，由用户后续观察告警。

## 变更与范围

- 告警时间固定为 Asia/Shanghai，北京时间 `yyyy-MM-dd HH:mm:ss.SSS`，删除 Unix 毫秒。
- 保留服务方响应正文、具体异常原因、实际取得的 HTTP 状态、追踪号、任务号及后台入口。删除空字段、参数摘要与固定说明。
- 文本解析失败及图片、视频、配音、口型终态失败保留对应服务方返回；密钥/令牌/素材链接脱敏，媒体数据省略，超长响应明确标注。
- 仅部署 `server`，未更改环境配置或数据库结构。

## 提交与制品

| 项目 | 记录 |
|---|---|
| 功能提交 | `d11adad7` |
| 构建所用 main 提交 | `477936a114e20a498ac4e0957e13b18f148b8687` |
| 发布包 | `20261024-model-alert-bjt-response` |
| JAR SHA256（构建产物） | `d54c7eaa592d7bb2dbafa8aa8779d80c792dfd9222d49b375557348f54569ba6` |
| 目标服务 | `aistareco-server` |
| 上一 JAR 备份 | `/opt/ai-star-eco/backups/20261024-model-alert-bjt-response/server-app.jar` |
| 远端发布包目录 | `/opt/ai-star-eco/releases/20261024-model-alert-bjt-response` |

先将本次告警改动单独提交，合入 main 并推送，再从干净的 main 构建。主线既有功能保留，原工作区其他未提交改动未纳入本次提交。

构建使用 `MAVEN_ARGS='-o -Dmaven.test.skip=true' RELEASE_ID=20261024-model-alert-bjt-response ./infra/scripts/build-release.sh server`。部署使用标准 `deploy-release.sh`，设置 `VERIFY=0`；脚本原有依赖及环境预检保留。部署命令成功返回，已执行 JAR 替换及 `systemctl restart aistareco-server`。

## 验证边界

前一开发轮次已完成156项定向测试；本次提交/合并/发布不重复测试，不运行 `verify.sh`、健康检查、真实业务验收或测试告警，不对部署后服务健康和群消息效果作已验收声明。

需要回退时可恢复上述备份 JAR 并重启同一服务；备份在替换前完成。本次未执行回退。
