# AI 视频页失败重试与界面调整 发布记录（2026-11-08 CST）

| 项 | 内容 |
|---|---|
| 发布号 | `20261108-video-task-retry-11907af69` |
| 服务 | server + web-aiavatar |
| main | `11907af69`（[PR 166](https://github.com/pokocat/AIStarEcosystem/pull/166)，CI 8 项全绿后合并） |
| 构建 | 仓外干净工作区 `../AIStarEcosystem-video-task-retry`，带 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 manifest） |
| `app.jar` 校验和 | `1748df604cc7f81b`，线上与发布包一致 |
| web-aiavatar BUILD_ID | `QzvQz_lrDdRyU5dUCs1EF`，线上与发布包一致 |
| 上线时间 | 09:31 CST |
| 回滚 | server → `20261107-paired-quotes-831ee12a`，web-aiavatar → `20261108-asset-library-f63970b5f`，可以分开回：server 只多了场景开头建议的文字和企业收款凭据的修复，web 只多了视频页的改动。没有迁移 |

## 上线内容

方案见 `docs/studio-video-workflow-redesign.md` §12–13。

- AI 视频页：停下等用户或暂停的任务直接给「重试这一步 / 继续生成」，规则与服务端「继续」一致（`videoTaskResumeLabel`，画布任务条共用）。起因是线上 `PEX-9caea05b1848414ca167`：第 1 段分镜图生成服务没回结果，积分已退，页面只有「在画布上查看」。
- 进度页：状态、进度条、操作在上，分镜图在下一行；有分镜图时不摆视频空框；操作旁只写已消耗积分。
- 生成按钮下不再写费用明细和分段说明，上限放价格的悬停提示。
- 示例页不再列做法。
- AI 编导开头建议：21 个视频场景各六条短的开场思路，两列，点一条替换输入框。文字在服务端 `ipstudio/scenes.json`。

**同一个包带上线的（都已在 main）：** server 带上另一个会话的 [PR 165](https://github.com/pokocat/AIStarEcosystem/pull/165)（企业收款凭据只插入，防并发重复入账；线上 MySQL 可重复读，原先就不受影响）。

## 发布前

- 账号中心 200（发布前两次确认）。
- 接口与迁移：`git diff 831ee12a4 11907af69 -- 'apps/server/**/dto/**' specs/openapi.yaml` 无变化，没有新迁移，不用连带发其它前端。server 只多了 `scenes.json` 和 `EnterpriseRechargeService` 6 行。
- 场景目录：线上 `aep_platform_configs` 没有 `studio.scene%` 的记录，用的是包里的 `scenes.json`，所以开头建议的新文字随 server 生效。
- 重启前（09:20、09:31 两次查）没有未结束的 `ip_run`、视频任务和运行中的制作，最近 10 分钟没有新任务。

## 窗口

server 09:31:39 启动。09:31:41–09:31:53 共 8 个 5xx：

- 5 个是部署探测的 `/api/config`。
- 3 个是用户请求：2 个视频任务列表轮询、1 个读余额，下一次轮询即恢复。

verify 全绿。启动后到记录时 0 条 ERROR。

## 线上验收

只读检查，没有点重试、没有点开头建议（点了会改用户草稿），没有花积分。

- **那条失败的任务**（`PEX-9caea05b1848414ca167`）：标题「第 1 段分镜图没有完成」，下面是进度条，再下面一行「已消耗 75 积分」+「在画布上查看」+「重试这一步」，分镜图在最下面。上线前这里只有「在画布上查看」。
- **场景种草**：示例页只剩示例图、场景名和一句说明。AI 编导页是新的六条开头建议，两列各 187px，每条一行，不截断。
- **没有在线上验证的**：没有实际点「重试这一步」（会重新生成、花积分），继续的调用参数由单测确认，服务端的继续规则 2026-11-07 已上线（PR 157）。

## 留下的问题

- ~~直接出视频时按钮下还有一行「优化提示词按实际用量另计。」~~ 同日 10:18 补发，见下节。
- 预算不够停下的视频任务，视频页仍只能去画布：视频任务没有对话，没有追加预算的入口（已记 `TODO.md`）。

## 同日补发：价格细节挪进悬停提示（10:18 CST）

| 项 | 内容 |
|---|---|
| 发布号 | `20261108-video-price-hover-ca6eca853` |
| 服务 | 只有 web-aiavatar，server 没有重启 |
| main | `ca6eca853`（[PR 168](https://github.com/pokocat/AIStarEcosystem/pull/168)，CI 8 项全绿后合并） |
| 构建 | 同一个仓外工作区切到 `ca6eca853`，三个构建参数同上，已核对 manifest |
| web-aiavatar BUILD_ID | `IT9EZtOsqZlTG3LRsyscM`，线上与发布包一致 |
| 回滚 | web-aiavatar → `20261108-video-task-retry-11907af69` |

内容：用户确认把「优化提示词按实际用量另计。」也挪进悬停提示。价格里的模型赠款抵扣、个人和企业账户各多少同样只放悬停提示；按钮下只留生成不了的原因（积分不足、暂时无法生成）。画布里的报价行没动。

窗口：web 10:18:33 重启，10:17–10:19 没有 5xx，verify 全绿。

线上验收（只读）：场景种草页按钮显示「原价 930，折后 465 积分」，悬停提示是「H3限时折扣，省 465 积分」和「优化提示词按实际用量另计。」两行；按钮下只有「请添加商品图」。
