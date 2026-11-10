# 编导脚本出片分层发布（2026-11-10）

已发布，2026-11-10 11:08（北京时间）。只发 `server`、`web-aiavatar`。

## 内容

- AI 视频页编导写的六段脚本，出片时只发和画面有关的部分：剧情概述不发，素材压成一行对照，去掉每镜的「这一镜的作用」和「始终保持」，禁止项写成最后一行。认不出六段结构就整份原样发。判断只在 `apps/web-aiavatar/src/ip/scenes/scene-script-layers.ts`。
- 用到的地方：「生成视频」、视频裂变、H3 提示词优化，以及画布上连到视频节点的文字（出视频时）。完整脚本存 `studio.sceneScript`，「修改后生成」放回的是它。
- 编辑框里不发的内容显示成灰字，剧情概述那行末尾标「仅参考」；字数按实际发出的算。
- 先优化提示词再出片的任务，受理时就按模型规则核对素材（参考视频 2–15 秒等），不合规当场报错，不建任务、不冻结（`StudioVideoService.quoteChecked`）。
- 规则见 [`docs/studio-scene-creation.md`](../studio-scene-creation.md) 末节。

## 发布

- 构建提交：main `8c43f1d036d30e42403debf4443b7fece6635f17`（直推 main，无 PR CI）。仓外干净工作区 `../AIStarEcosystem-scene-script`，Mac mini 队列 `72a533fd72d0` 构建（含接口契约检查），退出码 0；制品 `20261110-scene-layers-8c43f1d0`，参数 `NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。
- 发布前：分支上 web-aiavatar 类型检查通过，前端相关测试（场景页、编辑器、视频裂变、画布连线、工作台）通过，后端 `StudioVideoRewriteModelTest`、`DirectorH3VideoFlowTest`、`StudioVideoRewriteWorkerTest`、`H3PromptRewriteTest` 82 项通过；main 合并前没有新提交，合并后的代码与分支一致。本机演示模式下看过编辑框的灰字、「仅参考」和字数。用线上 11-06 至 11-09 的 40 份编导脚本核对，全部认得出，发出去的平均从 2568 字降到 1943 字。
- 账号中心 200；线上没有在途的 IpRun，只有一条视频任务停在「参考人像需要核验」等用户确认（`mvj_ffd2f9428616`，未交给厂商），重启不影响。无数据库迁移。
- `deploy-release.sh` 自带的 `verify.sh` 全绿。JAR 校验和 `eb65c74be07dab2f…` 与制品一致；服务 11:08:58 重启、18 秒启动完成，重启后 0 条 ERROR，当小时 12 个 502。

## 没做

- 没有真实出片对比（整份 / 挑过、带秒数 / 不带秒数），并入 TODO.md「AI 编导爆款化」的成片对比。

## 回滚

server 和 web-aiavatar 都回生产机 `/opt/ai-star-eco/releases/20261110-scene-script-cbbfa030`，可分开回：只回 web 时出片恢复发整份脚本；只回 server 时受理核对恢复成到交给视频时才核对。
