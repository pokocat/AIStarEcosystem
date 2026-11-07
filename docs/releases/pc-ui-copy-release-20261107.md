# PC 站文案优化发布（2026-11-07 CST）

| 项 | 内容 |
|---|---|
| 发布号 | `20261107-pc-ui-copy` |
| 服务 | server + web-aiavatar |
| main | `bd4c0d385`（[PR 152](https://github.com/pokocat/AIStarEcosystem/pull/152)，CI 8 项全绿，快进合并） |
| 构建 | 仓外干净工作区 `../AIStarEcosystem-release-inspiration`，带 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 manifest） |
| `app.jar` 校验和 | `c497d1d379be94d5`，线上与发布包一致 |
| web-aiavatar BUILD_ID | `dQ4-rkCpG6menYdNMa5lN`，线上与发布包一致 |
| 上线时间 | 08:51 CST |
| 回滚 | server 和 web-aiavatar 都回 `20261106-video-task`。没有迁移 |

## 上线内容

- PC 站全站文案：按钮、状态、说明、空态、报错、确认框，以及用户能看到的服务端报错和场景目录。逐条改动见[优化记录](../audits/pc-ui-copy-review-2026-11.md)。
- 文字之外的小调整，都是用户定的：
  - 公开名片里写死的内容只在演示名片显示。
  - 配音按钮写每秒单价，不写冻结上限。
  - 不能点的按钮，原因写在旁边。
  - 导演台片段生成中不能删除（409 `DIRECTOR_TASK_RUNNING`），删除前有确认框。
- 没有带上的：admin（一处「IP Studio」叫法）和 web-drama（英文原文盖掉错误码提示的修复）已合入 main，下次发这两个应用时才上线。

## 发布前

- 线上 server 和 web-aiavatar 都是 `367d330b1`。
- 接口：`git diff 367d330b1 bd4c0d385 -- 'apps/server/**/dto/**' specs/openapi.yaml` 没有改动，不用连带发其它前端。
- 没有数据库迁移。
- 重启前 10 秒复查：没有运行中的 `ip_run`、执行和视频任务，账号中心 200。
- 平台配置 `studio.scene-catalog` 线上没有保存过，`scenes.json` 里的新文字直接生效。

## 窗口

重启期间（08:51:31–08:51:47）13 个 502：

- 6 个是部署探测的 `/api/config`。
- 7 个是用户请求：5 个视频任务页的轮询（`video-tasks` 和 `PEX-c8b5df841d164717b81c`，这个任务状态是 `needs_user`，没有在运行），2 个读余额。

verify 全绿。发布后到记录时 0 个 5xx。

## 线上验收

只读检查，没有发起生成，没有花积分，没有改数据。

- 启动后到记录时 0 条 ERROR，2 条 WARN 都是启动时的已知提示（`MySQLDialect`、`UserDetailsServiceAutoConfiguration`）。
- 未登录请求 `/api/v1/ip-studio/video-tasks` 回 401。
- 用线上已登录账号打开首页、`/video`、`/image`、`/director`、`/projects`、`/enterprise`、`/me`，都正常加载，桌面形态，没有横向滚动。
- 首页显示新标语「一个 IP，无限可能」。
- 第一次打开时控制台有 3 个 401（`templates`、`demos/examples`、`/api/me`），之后这些接口和页面都正常。看着是令牌过期后的刷新，没有进一步确认。
- 按文案规则扫描上面这些页面，只有两处残留，已记入 TODO：「自由出图」和「每张画布都在这里，点开可继续编辑」。

## 没有验证的

- 线上没有点付款弹窗、错误弹窗、删除确认、AI 编导对话和一键制作弹窗。本地 UI 走查也没走到付款弹窗、错误弹窗、AI 编导对话和一键制作弹窗，这几处只有单测。
- 手机端不在这次范围内。

## 说明

- 这次第一次在本机跑全量服务端测试（3665 个），查出 main 上已有的红项；连同前端红项一起在 PR 152 修掉。工作流只在 PR 和手动触发时跑，直推 main 不跑 CI，见 AGENTS.md §8.0.1 ⑬。
- 短剧画布的模型输出被截断时，只要能修复成合格结构就直接交付并照常结算，可能少了后半段。这是 2026-11-05「模型正常回包保留」之后的线上行为，这次只改了测试，没有改行为。
