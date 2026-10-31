# 创作助手四处修复：server + web-aiavatar 发布

2026-10-31，Asia/Shanghai。用户确认「合入 main」后三个提交快进推到 main，随后确认「构建发布」。

## 内容

- `b1e8ac9a0`：带时长、画幅、横竖屏的出视频请求（「生成一段16:9、5秒视频」「做一段竖屏视频」）切到出视频，不再被留在出图。
- `90cf22841`：制作中只问不改的消息（「做到哪了？」「还要多久」）不再让制作停下等重新确认；聚算「个人资源空间不足，请清理资源(含回收站)」类原话不再原样给用户，换成平台侧说明（视频 / 配音 / 口型 / 出图与库里已存的旧报错读出时都生效）。
- `f3092980c`：模型回复末尾预告要做却没给动作（「好的，我来改」）不算做完，纠正一次接着做；纠正后仍不动手就结束，一轮最多纠正 2 次。读画布文字读用户采用的那一版。web-drama 跳转下拉列出本集并禁选（**这次没发 web-drama**，见下）。

提示词 `SEED_VERSION=v28-2026-10-30-say-it-do-it`。无数据库迁移，无接口改动。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 发布前基线 | server / web-aiavatar = `20261031-studio-scene-flow`（main `fe4a654ce`），main 已包含，不回退 |
| 正式构建 | main `f3092980c7a0ac6786036fcca60e30e56593668f`，仓外干净工作区 `../AIStarEcosystem-release-assistant-fixes`（`git worktree add --detach origin/main`） |
| CI | 仓库 CI 只在 PR / 手动触发时跑，这三个提交直接推 main，**没有 CI 结果**。本机：服务端全量 3341 个测试通过（rebase 前）；rebase 到 `c37380688` 之后 ipstudio 与报错过滤相关 1277 个通过；web-drama 编辑器 7 个测试与 typecheck、接口契约门通过 |
| 发布包 | `20261031-studio-assistant-fixes`（server + web-aiavatar） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（`manifest.env` 已核对） |
| server JAR SHA256 | `82be706634ffac1df5446a6fa3ef37b9da16e16e695cbade1262efacb1cdd53d`，线上与本地一致 |
| web-aiavatar tar SHA256 | `1b6b211f68286431ceef7d5b67ba85e3811ab4f85ff93e0e40016c01194c13bd`；BUILD_ID `guFvqqFm1xeQSeKxfcTtI`（线上一致） |
| 服务启动 | server 12:33:17 重启、启动用时 17.52 秒；web-aiavatar 12:33:18。两个服务 NRestarts=0 |
| 数据库 | Flyway 校验 72 个迁移，`No migration necessary` |
| 提示词 | `PromptTemplateSeeder: 刷新 54 个未改动的 prompt 基线 → v28-2026-10-30-say-it-do-it`；库里 `dap.ip_studio_skill_dialogue`（version=1，无人改过）12:33:36 更新，含新第 15 条 |
| env-check / verify | 均 ALL GREEN |
| 发布前在途 | `ip_run` running/queued 0、`material_video_job` 未结束 0、`ip_plan_execution` running 0、进行中的对话 0 |
| 重启后 ERROR | 0 条（同一 grep 近 24 小时命中 46 条，确认能匹配） |

## 重启窗口

nginx 访问日志 12:33:17–12:33:35 共 12 个 502：7 个是部署探测（`/api/config` 每 3 秒一次，同一来源），另有两个外部 IP 的 5 个请求赶上重启空档：一个页面在轮询对话（`GET …/conversations/IPT-IPP-6c8353e1`，4 次），一个 `GET /api/me/wallet`。都是读请求，页面会自行重试。不声称零中断。

## 没有做的

- **没有用真模型跑过整轮对话**：「只说不做」的纠正能不能让线上模型真去动手、会不会误伤，制作中问进度时助手会不会顺手提出新方案，都还没在线上或本地真模型上验过。没有在线上账号里操作，也没有触发付费生成。
- **web-drama 没发**：跳转下拉的改动在 main 上，但 web-drama 线上还是 10-25 的 `20261025-provider-error-privacy`（`3e45f6e4`），从那以后共享包（`packages/*`）改了三周，单独发 web-drama 前要先核对这些共享改动在 web-drama 上没问题。

## 回滚

上一版 `20261031-studio-scene-flow` 在生产机 `/opt/ai-star-eco/releases/` 下，取回后用原脚本部署：

```bash
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261031-studio-scene-flow/ dist/deploy/20261031-studio-scene-flow/
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261031-studio-scene-flow server,web-aiavatar
```

回滚后库里的提示词仍是 v28（种子只在版本号变化时刷新「没人改过」的行），旧代码读 v28 提示词没有兼容问题：新加的第 15 条只是要求说了就做。
