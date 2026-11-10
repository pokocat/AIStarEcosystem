# 爆款复刻：逐镜细读、每镜开场画面、自动检查重出 · 发布记录（2026-11-10）

发布号 `20261110-keyframes-e6e2de04`（server + web-aiavatar）。PR [pokocat/AIStarEcosystem#191](https://github.com/pokocat/AIStarEcosystem/pull/191)，设计与实测见 [`docs/ip-studio-recreation.md`](../ip-studio-recreation.md) 第一节。

## 内容

- 拉片第二遍逐镜细读（提示词库 `stage-video-shot-detail`）：相邻镜头凑成不超过 6 秒的小段，每秒 5 帧再看一遍，写场景、用光、机位、开场构图、动作、视觉把戏、后期效果；按开始时间对镜头。
- 每个镜头截一张开场画面（对齐真实切镜点、只取开头 0.4 秒），写分镜脚本（`stage-recreation-compile` 第 4 版）时为每张写修改要求；方案里每段先出开场画面（`stage-recreation-keyframe`，走 Studio 默认出图模型），视频从这些图开始拍。
- 视频页的复刻每段加检查，不合格自动重出一次；检查做不了不挡成片。
- `scripts/recreation-eval/score.py`：评测打分脚本。
- 同时带上线：PR #188（导演台读作品连接池第二轮修复：作品在进程内排队、续接已受理先查回、写回前不回投），Codex 评审「可以合并」，此前只合在本机 main。

只对发布后新建的复刻任务生效：拉片是旧方式、没有截图的任务照旧出片。

## 构建

- 构建提交：`e6e2de043c2358f0ea4eef8d751383ceae53bc02`（PR 191 头提交，CI 29 项全绿后 main 直接快进到它）。
- 仓外干净工作区 `../AIStarEcosystem-recreation`，本机 devq 构建（Mac mini 磁盘只剩 2.4G），参数同上一版：`NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn` 等。第一次构建失败：工作区里留着上一次构建的 `.next` 与 `tsconfig.tsbuildinfo`，还记着 PR 189 删掉的页面，类型检查报找不到模块；清掉缓存后重建通过。**仓外工作区复用前要先清这些缓存。**
- 校验和：`app.jar` `ef02a34d…`、`web-aiavatar.tar.gz` `0ff4dd59…`；jar 内有两个新环节文件和 V80。
- 线上基线：server + web-aiavatar `20261110-account-ia-f27ed14c`，数据库 V80。从基线到本次，DTO 和 `specs/openapi.yaml` 没有改动，没有新迁移；web 只有导演台轮询相关的几处改动。

## 发布

- 2026-11-10 21:37（北京时间）：账号中心 200；线上没有排队或运行中的 `ip_run` 和制作计划，只有 1 条视频已在厂商生成中（重启后接着查）。
- `deploy-release.sh` 退出码 0，`verify ALL GREEN`。server 21:39:02 启动完成，80 个迁移校验通过，重启后 0 条 ERROR。
- 重启窗口 502：21:38 共 24 个、21:39 共 2 个，之后 0 个。

## 配置

- 备份 `ai.chat-token-pricing` 到 `/opt/ai-star-eco/backups/recreation-keyframes-20261110T134000Z`，第 11 版只把 `ai-1583b53c-52e` 的 `maxOutputTokens` 从 16000 改成 32000（第二遍细读多用输出 Token，60 秒的片子会超 16000）。单次冻结约 21 → 30 积分，按实际用量结算。

## 验证

- 发布前：相关后端测试全部通过；真模型全自动跑美食那条（Seed 拉片 + 细读、线上同款 Terra 写提示词、Seedream 4.5 出开场画面、H3 出片），五个捏合镜头都做出来了，评分 38/50（看点 8、镜头结构 9）。
- GPT Image 2.5（线上默认出图模型，`ai-c120fb1f-769`）用同一份清单出了第 1、7、8 镜的开场画面：远处的人保持很小、构图贴近原片，比 Seedream 更守构图。第 8 镜原片里的人极小，两个模型都画得几乎看不见。
- 发布后：`/video`、`/director`、`/api/config` 返回 200。
- **没验**：线上视频页从头到尾跑一条新的复刻（开场画面、检查、自动重出在线上的真实表现）；手指「捏住后张开」仍做不出来（每秒 5 帧看不到，下一步用 Hypit 原始帧密读）。

## 回滚

- server、web-aiavatar 回 `20261110-account-ia-f27ed14c`，可以分开回；导演台的进程内排队随 server 一起回退。
- 没有迁移；售价配置回滚用备份文件，或把 `maxOutputTokens` 改回 16000。
