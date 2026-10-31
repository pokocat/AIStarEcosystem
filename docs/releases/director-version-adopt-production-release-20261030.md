# 导演台切换版本即采用：生产发布

2026-10-30，Asia/Shanghai。按用户要求先合入 main，再发布最新代码。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 本轮功能提交 | `39fe31c9c`（codex/ai-director） |
| 合入 main | `bfba14bfc`（合并分支）、`97ca7fc28`（并入远端新增的 Seedance 文档提交），已推到 origin/main |
| 正式构建 main | `97ca7fc28b62a2a2b3760830f945755d8f38ba93`，仓外干净工作区 `../AIStarEcosystem-release-version-adopt` 构建 |
| 服务 / 发布包 | `server` + `web-aiavatar` / `20261030-director-version-adopt` |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`；mock 与开发登录关闭 |
| server JAR SHA256 | `0010a00c8de48bb82140d1c0040a5f8bfd8a4434c59a8ae3ba4801bbce954356`（线上与本地一致） |
| Studio tar SHA256 | `1a0214acc93ba15d5fdd8bd4c652f6055ad4c2277877629de2dc77cdfe3f8177` |
| Studio BUILD_ID | `emWdNpdVgQFhPUGFvihx-`（线上与本地一致） |
| 服务启动 | server、Studio 01:20:43–44 重启；后端 01:21:01 完成启动，两个服务 NRestarts=0 |
| 数据库 | 无新迁移，Flyway「Schema is up to date」 |

发布前线上是 `20261029-director-ai-entries`（main `9ad3603b0`）。除本轮改动外，本次同时上线 main 上此后合入、尚未发布的内容：

- 企业手机号单个 / 批量添加成员（`e986755b2`，含 `POST /api/v1/ip-studio/enterprises/{id}/members` 与 `/members/batch`）。
- 导演台浮动 AI 对话（可拖动、可调大小、可换模型，`4e9ba7e46`）。
- 文档与证据整理（`9d2422346`、`295030a1d` 等）。

这两项功能由各自会话本地验收，本次线上没有逐项点验。

### 合并说明

codex/ai-director 上的 `3644d7980`（企业手机号加人）与 main 上的 `e986755b2` 是同一功能的两个版本：后者已按 main 的错误报告改动整合。合并时该提交涉及的文件全部保留 main 的版本，合并结果与 main 的差异只有本轮三个文件。`director-storyboard.tsx` 在 main 上已改用错误弹窗（`failed(setError, …)`），本轮改动按 main 的写法重新落上：视频换版失败走「采用片段 N 的这版视频」错误弹窗，分镜图弹窗内的失败仍就地显示。

## 本轮改动

分镜页的视频版本（片段卡片上的 1 / 2 / 3、视频抽屉里的「视频 N」）和分镜图弹窗的历史版本：点哪一版就直接采用，服务端记为用户已确认（`clip.adoptVideo` / `clip.adoptBoard` 本来就写 `adoptedBy=user`），去掉「采用这一版」按钮。版本下方一行提示「点哪一版，这个片段就用哪一版。」/「点哪一张，这个片段就用哪一张。」，换版请求进行中写「正在换成这一版…」并不接新的点击。系统自动填上、从没换过的版本仍保留「确认使用」。只有一条视频但还没采用时也显示版本条，保证能选上它。无接口与迁移变化。

## 验证

- 四道门：workspace 类型检查、admin 类型检查、后端 Java 17 离线编译、API 契约，全部通过。
- 导演台前端 24 个文件 123 条通过（含新加的 `director-storyboard.test.tsx` 三条：卡片点版本即采用并打开抽屉、抽屉内换版、分镜图弹窗点版本即采用；三条在旧代码上均失败）。
- web-aiavatar 全量 1429 条中 1428 通过；失败的 `director-brief.test.tsx`「answers are sent…」本次未改动，单独重跑 4/4 通过，判为满载时的等待超时。另见 `director-settings.test.tsx`「a 404 that cannot be attributed…」同类偶发（单独重跑 8 次失败 1 次），该测试把分镜页整体替换掉，与本次无关。
- 本地隔离环境（库副本 + 三条测试视频）浏览器实测：卡片点「3」→ 采用第 3 版并打开抽屉；抽屉点「视频 1」→ 服务端 `vv1 / user`；分镜图弹窗从「第 1 版 · 采用中 · 待确认」点第 2 版 → 大图标签变「采用中」、卡片分镜图入口变「已确认」，服务端 `m19 / user`。
- 官方 `verify.sh` ALL GREEN。

## 线上验收

- 线上 JAR 校验和、Studio BUILD_ID 与构建产物一致；重启后后端 0 条 ERROR（同一 grep 在近 24 小时命中 25 条，确认能匹配）。
- 线上导演台页面脚本 `page-a2882245aa42b43c.js` 与构建一致，含新提示文案。
- 用已登录账号只读打开「枯绿」第 1 集片段 1（3 条视频）：卡片版本号悬停为「点一下换成第 N 版」；点主画面打开抽屉，显示「视频 1 / 视频 2 · 采用中 / 视频 3」与提示行，没有「采用这一版」。没有点任何版本，采用仍是第 2 版，没有改动用户作品，没有发起付费调用。

## 发布窗口

单实例重启，01:19:30–01:22:30 nginx 记录 49 个 200、8 个 502 及少量 3xx/4xx。502 全部是 GET（`/api/me/wallet`、部署脚本轮询的 `/api/config`），集中在 01:20:43–01:21:00，后端 01:21:01 启动完成后恢复。不声称零中断。

## 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh <20261029-director-ai-entries 制品目录> server,web-aiavatar
```

制品在 ECS `/opt/ai-star-eco/releases/20261029-director-ai-entries/`（server/app.jar + web-aiavatar.tar.gz），本机没有时 scp 回来。无迁移，回滚只换应用制品。线上 `/opt/ai-star-eco/server/release-id.txt` / `release-sha.txt` 已手动更新为本次发布（部署脚本不改这两个文件）。
