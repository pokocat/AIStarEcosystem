# AI 视频统一任务与走查修复发布（2026-11-07 CST）

| 项 | 内容 |
|---|---|
| 发布号 | `20261106-video-task` |
| 服务 | server + web-aiavatar |
| main | `367d330b1` |
| 构建 | 仓外干净工作区 `../AIStarEcosystem-release-inspiration`，带 `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`（已核对 `manifest.env`） |
| `app.jar` 校验和 | `3dfd7bd3d77a9bdd`，与发布包一致 |
| 上线时间 | 00:01 CST |
| 回滚 | server `20261106-identity-keys`，web-aiavatar `20261106-inspiration-wall`。没有迁移。回滚后已受理的视频任务不再有视频页入口，要先确认没有进行中的任务 |

## 上线内容

- 普通视频、长视频、爆款复刻都在 AI 视频页受理后台任务，看进度和成片不用进画布；失败步骤最多自动执行 3 次。
- 视频任务页和 AI 图片页统一样式，修了失败页按钮看不见、面板被裁切和「继续制作」没反应。详见[方案 §11](../studio-video-workflow-redesign.md)。
- [全面走查](studio-ui-walkthrough-validation-20261106.md)发现的 10 处问题。
- 同时带上线上之后 main 的改动：画布时长控件跟随模型、长视频折扣、导演台及时停止、停止按估算结算、共享工作线程 30。

## 发布前

- 线上 server 是 `682049984`，web-aiavatar 是 `50689b693`。
- 接口：只有新增。`PlanExecutionStep` 加 `errorCode`，`SegmentedVideoPrice` 加折扣字段，没有删除或改名，只改了 server 和 web-aiavatar，不用连带发其它前端。
- 没有数据库迁移。
- 没有运行中的 `ip_run`、执行和视频任务，账号中心 200。

## 窗口

- 重启期间（00:01:11–00:01:26）6 个 502，都是部署探测的 `/api/config`，没有用户请求。这个时段正好没有用户在用，不代表发布无中断。
- verify 全绿。

## 线上验收

只读检查，没有发起生成，没有花积分。

- 启动后到记录时 0 条 ERROR，没有 5xx。
- 未登录请求新接口 `/api/v1/ip-studio/video-tasks` 回 401。
- 用线上已登录账号打开：
  - `/video` 桌面三列 420 / 700 / 196，主按钮是渐变；最近任务显示真实记录，按今天和更早分组，时间是完整格式。
  - 口播带货显示折扣价（原价 930，折后 465 积分）和本次上限 3,120 积分；爆款复刻 15 秒约 1,606 积分，上限 4,818 积分。
  - `/projects` 显示「在 AI 视频中打开」，`/director` 列表正常，打开这些页面没有水合错误和脚本错误。

## 没有验证的

- **线上还没有真实跑过一次新的视频任务**，普通视频、长视频、爆款复刻都没有。第一条真实任务要看：能否受理、进度、成片、扣费。爆款复刻此前交给助手，改动最大，优先看它。
- 真实模型输出下的 `重试这一步`、三次失败和画布定位。
- 手机真机。

## 说明

- `codex/director-reference-order`（导演台参考图顺序）没有合入 main，这次没有带上。
- 本次上限高于用户余额时不挡提交：上限不会一次冻结，每一步按自己的费用冻结。代码核对过，线上没有实测。
