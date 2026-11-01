# 提示词里的参考图标签 + 导演台 H3 修复：server + web-aiavatar 发布

2026-11-01，Asia/Shanghai。用户确认「提交并发布」，#148 快进合入 main（没等 CI，按用户此前「先发、有问题再修」的要求）。main 上另有一个会话已合入、未发布的导演台 H3 修复，它的前端要新后端支持；问过用户后选择「两个一起发」，从 main 同时发 server 与 web-aiavatar。

## 内容

- **AI 视频提示词里的参考图标签**（#148，`1e0ae2b72`）：编辑框换成 Tiptap，「图1」「@图1」显示成「缩略图 + 图1」的标签，点一下看大图；存的仍是纯文本，编号只认这次交给视频模型的图。编导的脚本卡片同样显示。大图查看拆成共用的 `ip/image-lightbox.tsx`。详见 `docs/studio-scene-creation.md` §21。
- **同包带上的导演台 H3 修复**（另一会话，`9d95e2e4e`、`0f506096d`，文档 `2a16f9b71`）：H3 不再把系统说明当台词念、认得角色别名、优化稿保留全部参考、去掉空的【声音】标题；片段可单独「重新优化」提示词（新任务类型 `video-prompt`，只改写不出片），视频记下用的是优化稿还是原文。这部分前端调用新的 `video-prompt`，只发前端会在旧后端上报错，所以和后端一起发。

无数据库迁移。`git diff fa72c50e2 1e0ae2b72 -- 'apps/server/**/dto/**' specs/openapi.yaml` 只有 openapi 一处说明文字（任务类型列表加了 video-prompt），没有删除或改名的字段；除 web-aiavatar 外没有别的前端读这些改动（`packages/types` 只改了 director.ts）。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 正式构建 | main `1e0ae2b72e2896647f67bdb3b11894c131e14cc5`，仓外干净工作区 `../AIStarEcosystem-release-studio-redesign`（detached 在该提交）构建 |
| CI | #148 合入时 8 项都在跑，结果见文末 |
| 本地门禁 | 合并后 `tsc --noEmit` 通过；合并前定向 vitest（场景页、导演台、选择框、canvas-bridge，37 个文件 218 条）+ 新增编辑器测试通过；本地真后端 + 无头 Chrome 1440 / 375 走过打字变标签、点标签看大图 |
| 发布包 | `20261101-studio-prompt-chips`（server + web-aiavatar） |
| server JAR SHA256 | `1fa920e73e55974e010038260d5be882424527fb028a505a893106921cbed426`（线上一致） |
| web-aiavatar tar SHA256 | `7cff301d7fc1e8f1a7997e389aa8708e78998d4d8293edb2316567ccfb59db6d`（线上一致）；BUILD_ID `OJnWuRuRqi8B1gQ3AyRI-`（线上一致） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（`manifest.env` 已核对） |
| 服务启动 | server 09:04:26 重启、17.1 秒启动完成；web-aiavatar 09:04:27；两个服务 NRestarts=0；env-check / verify ALL GREEN |
| 数据库 | 无新迁移；Flyway 校验 72 个迁移，`No migration necessary` |
| 发布前在途 | 09:03:47 `ip_run` 未结束 0（含导演台文字任务）、`material_video_job` 未结束 0、`ip_plan_execution` 进行中 0 |
| 上一版 | server `20261101-video-delivery-recovery`（`fa72c50e2`），web-aiavatar `20261031-studio-avatar-polish`（`0921222f6`） |

## 线上核对

- `/`、`/video`、`/image`、`/assets`、`/projects`、`/director` 200；`/video` 页面里的 BUILD_ID 是新版；线上样式含 `.scene-prompt-ref`、`.scene-prompt-editor`、`.scene-prompt-field`。
- server 重启后 ERROR 0 条（同一 grep 近 24 小时命中 37 条，确认能匹配）。
- 没有在线上账号里走登录后的流程，也没有触发付费生成。导演台「重新优化」的线上效果没有验证（那部分的验证见另一会话的记录 `docs/audits/director-h3-cl45-prompt-review-2026-10.md`）。

## 重启窗口

nginx 09:03–09:06：200 共 64、302 共 1、502 共 12。502 全在 09:04:26–09:04:44（server 重启的 17 秒里），都是 GET：6 个 `/api/config` 和 3 个 `/api/me/wallet` 来自部署脚本探测的出口地址，另外 3 个 `/api/me/wallet` 来自两个外部地址（页面会重新读余额）。不声称零中断。

## 回滚

两个上一版都在生产机 `/opt/ai-star-eco/releases/` 下：

```bash
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261101-video-delivery-recovery/ dist/deploy/20261101-video-delivery-recovery/
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261031-studio-avatar-polish/ dist/deploy/20261031-studio-avatar-polish/
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261101-video-delivery-recovery server
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261031-studio-avatar-polish web-aiavatar
```

两个要一起回：只回 server 会让新前端的「重新优化」报错；只回 web 没问题（旧前端不发新任务类型）。

## CI

写这份记录时（发布后约 10 分钟）#148 的 8 项检查里 7 项已过、1 项还在跑、没有失败。最后一项的结果另行补记。
