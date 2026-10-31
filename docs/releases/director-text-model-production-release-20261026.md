# AI 导演台文本模型选择与剧名同步发布（2026-10-26）

发布编号 `20261026-director-text-model`，服务 `server,web-aiavatar`，构建自远端 `main` `16a1b61dac56747be96f43fc87b71b483927f384`（合并 `codex/ai-director` 的 `cb0d110c`，合并提交 `257bb6e2`）。

## 变更

- **作品可以选文本模型。** 作品设置新增「文本模型」（`settings.textModel`，空 = 后台默认，候选来自 Studio `script` 场景）。剧本、拆分集、提取资产、分镜脚本和一键制作的估价与执行都用所选模型；受理时端点和费率随任务固定，之后改设置不影响已受理的任务。显式模型进幂等指纹，同一请求编号换模型重提返回 409 `STUDIO_REQUEST_CHANGED`。后台固定模型时下拉不可选。
- **不展示文字积分数字。** 按 e563cdf8 的规则（导演台文字界面不展示报价、费率、冻结值），设置里只列模型名，写「按实际用量结算」。冻结额沿用 e563cdf8 的做法，按各任务自己的输出上限算，只是改成按所选模型的费率。
- **旧选择停用不挡保存。** 与图片模型一致：原值照存、不重新提交；估价按默认价，提交时明确报错，作品页照常打开。
- **新剧本用上时同步作品名。** AI 第一次写或重新写的剧本被采用时，用剧本里非空的剧名更新作品名；失败、生成期间用户改过正文、剧名为空时保持原名。重新写剧本时旧剧名留在 `scriptHistory`。
- **重新写剧本时整块显示加载状态。** 拆分前后都一样：写的过程中收起旧大纲、设定资料、正文和下一步按钮，「保存」「展开全部」不可点；失败后旧稿原样回来。

无迁移。

## 合并

分支落后 main 97 个提交，main 期间新增了图片模型选择（`imageModel` / `imageModelState`）、按任务输出上限冻结（e563cdf8）、设定资料与拆分预览、设置面板拆到 `director-settings.tsx`。冲突按以下处理：

- 文本模型的解析收成一处 `StudioWorkflowService.directorTextModel`，`directorPrices(model)` 与 `directorTextPrice(model, maxOutputTokens)` 都走它；导演台侧 `DirectorService.textModel(c)` 是读取所选模型的唯一入口。
- 设置面板的文本模型加进 main 的 `director-settings.tsx`，删除分支上那份旧面板；价格展示按用户决定全部去掉。
- 既有测试 `DirectorImageModelTest`、`DirectorSplitTest`、`StudioEnterpriseWorkflowTest` 按新签名调整了 mock。

合并期间另一会话往 main 推了 `92d74f05`（Studio 运营看板）并已单独发布 server（`20261026-studio-operations-92d74f05`），本版基于它，不回退。

## 构建与发布

- 在仓外干净工作区 `AIStarEcosystem-release-director` 合并、检查，快进推送 main，再构建。构建参数：`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。
- 直推 main，没有 CI 结果。
- 制品 SHA-256：`server/app.jar` `ec4c7a2ec8488cf4e6ac8a267be99bbbcfa37a93bfa575ed01ee9ac4cc54b97a`（与线上运行的一致），`web-aiavatar.tar.gz` `f47eb0d4563a5844bd304208a9a5cbab7e829f10f482f09602db4d0673078394`。
- 发布前只读查库：有 1 个图片任务在生成，等它结束、确认没有进行中的 `ip_run` 和视频任务后才部署。
- server 于 20:41:38 CST 重启，17.6 秒启动完成；Flyway 校验 69 个迁移，无变化；重启后 0 条 ERROR（同一 grep 在 24 小时窗口能数到 80 条，确认能命中）。`verify.sh` 全绿。

## 检查

- 合并结果：`typecheck:all`、`typecheck:admin`、API 契约检查通过。
- 服务端：导演台、企业付款、Studio 工作流与运营看板相关测试 76 项通过，包括新加的 `DirectorTextModelTest`（所选模型的估价、按任务输出上限冻结、固定模式拒绝、端点与费率随任务固定、重试不重复扣费）和 `DirectorScriptTitleTest`（采用 / 冲突 / 失败 / 空剧名四种情况）。
- web-aiavatar 全量 1310 项中 1306 项通过。失败的 4 项：2 项是 `director-script.test.tsx` 的测试数据缺 main 新增的字段，补齐后通过；`personal-asset-library.test.tsx`、`studio-template-source.test.tsx` 各 1 项在不含本次改动的 main 上同样失败，与本次无关。

## 线上验收

在已登录账号的浏览器里只读操作，没有提交生成、没有保存设置。

- 打开作品设置：「文本模型」显示「默认（DeepSeek Flash）」，可选 DeepSeek Flash、qwen38-27b；说明写「用于剧本、拆分集、提取资产和分镜脚本，按实际用量结算。」，面板里没有 Token 价格或冻结额。点「取消」关闭，未保存。
- 匿名请求 `/api/v1/ip-studio/director/works` 返回 401。
- 选模型后真实写剧本、剧名同步、重新写剧本的加载态没有在线上实测，以测试为准。

## 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh <20261026-studio-operations-92d74f05 的制品目录> server
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261026-director-image-viewer web-aiavatar
```

server 的制品在 ECS `/opt/ai-star-eco/releases/20261026-studio-operations-92d74f05`；web-aiavatar 的在 `AIStarEcosystem-release-director/dist/deploy/20261026-director-image-viewer`。回滚后作品里存的 `settings.textModel` 会被旧版忽略，不影响打开。
