# 账号区新版页面（任务历史、存储用量、回收站、设置）

2026-11-09。发布范围 `server`、`web-aiavatar`；无数据库迁移，两个新开关默认关闭。设计与接口说明见 [`docs/aiavatar-account-unification.md`](../aiavatar-account-unification.md)，规则见 `specs/BUSINESS_RULES.md`「账号区任务历史、存储用量与画布回收站」。

## 用户看得到的变化

- 电脑版「我的账号」和 `/studio#/membership|tasks|storage|realmaterials|trash|settings` 换成新版页面：白底细线、13px 正文、渐变主按钮，顶部是头像、可用积分、模型赠款和分页标签；手机端是返回「我的」的单页。
- 「任务中心」改名「任务历史」：画布、AI 图片 / 视频、导演台、创作助手对话、数字人任务合在一张表里，每条写实际消耗的积分（含其中模型赠款、待结算、已退回）和付款账户，可按状态、类型、时间筛选，进行中的画布媒体任务可取消，失败的数字人任务可重试。
- 「存储空间」显示与数字资产、IP Studio 生成和上传文件同一口径的用量和分类；历史文件在第一次打开时后台补记。
- 「回收站」新增画布：可恢复、可彻底删除（只删画布本身，生成记录和文件留在资产库）；导演台作品同样可彻底删除。
- 「设置与安全」合并原设置和安全页：默认付款账户、账号中心的资料 / 手机号 / 微信 / 密码 / 注销入口、隐私与退出。

## 服务端

新接口均在 `/api/v1/ip-studio` 下：`GET task-history`、`GET storage`、`GET projects/trash`、`POST projects/{id}/restore`、`DELETE projects/{id}/purge`、`DELETE director/works/{id}/purge`、`GET trash/policy`。只读既有真值，不新增计费口径、不改任务或账本。

开关（默认关，本次不打开）：

| 开关 | 作用 |
|---|---|
| `AEP_IPSTUDIO_STORAGE_ENFORCE` | 打开后按存储上限拦上传（402 `STORAGE_QUOTA_EXCEEDED`），生成不拦 |
| `AEP_IPSTUDIO_TRASH_RETENTION_DAYS` | 大于 0 时每天 04:20 清理超过天数的回收站画布和作品 |

## 评审

Codex `gpt-6.1-sol` 独立评审两轮。

- 第一轮 13 条：两条阻塞（恢复与彻底删除没抢同一把锁；彻底删除前的在途核对漏了绑定的视频任务和制作计划）已修，应修项中的台账写入移出业务事务、素材导入旧配额检查、任务历史连接占用、数字人计费明细、回填完成判定、前端分页竞态、演示开关均已修。
- 第二轮复核：两条阻塞确认修好，没有新的阻塞。随后修掉三条会显示错数的：没有明细的旧数字人失败任务按已退回算；数字人重试中的冻结算待结算；素材导入不再另记一笔用量。

未修，留到后续（见 `TODO.md`）：

- 视频提示词改写那一笔只计入「已消耗」总数，其中模型赠款和退回部分没有拆进对应列。
- 存储上限检查不预占：开关打开后并发上传可能略超上限；台账先查后写、没有唯一约束，同一 key 并发写仍可能记重。两项都只影响用量显示和开关打开后的拦截，开关默认关。
- 总览「生成中」卡片只统计最近 300 条。

## 检查

- PR [#184](https://github.com/pokocat/AIStarEcosystem/pull/184) 的 CI 在 `e978bfce4` 上全绿。第一轮红了三类：web-aiavatar 的 `studio-distribution` 测试（账号接口在模块加载时连带引入 `proto/api`，已改为用到时才加载）、后端 `StudioMediaImportServiceTest`（还在断言旧的配额检查，已改断言新的上限检查），以及 web-music 构建拉 Google 字体失败（与本次改动无关，重跑通过）。
- Mac mini 队列 `df46ba9a6f4b`、`af6ddee9e002` 退出码 0：web-aiavatar 类型检查，`studio-distribution`、账号页、`/me` 三个前端测试文件 6 项，后端 `StudioMediaImportServiceTest` 8 项、`StudioTrashAndGuardTest` 5 项、`StudioAccountHistoryTest` 10 项。
- 合并前本地开发库副本起真后端走查过：任务历史筛选翻页、画布恢复与彻底删除、存储补记、上限拦截（开关打开 / 关闭）。

## 发布

已发布，2026-11-10 01:11（北京时间）。

- main 快进到 `e978bfce4b1007dff3eff54cb8e084eb053b56bf`（PR #184 的提交）。在仓外干净工作区 `../AIStarEcosystem-account-pages` 由 Mac mini 队列 `6e9434145618` 构建，退出码 0；制品 `20261109-account-pages-e978bfce`，参数 `NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`。
- 只发 `server`、`web-aiavatar`。线上 JAR 校验和 `0cc8d61f40eca52d…` 与制品一致，Next build ID `Z9dYILrlj6o-4nqFn9To8ls`。`/opt/ai-star-eco/server/release-manifest.env` 部署脚本不更新，仍写上一版。
- 发布前：账号中心 `id.aibuzz.cn` 可达（200）；线上没有排队或生成中的 IpRun、视频任务、数字人任务和制作计划（最近一次任务 19 分钟前）。
- 同包带上 main 上另外几项尚未发布的改动（视频裂变、真人核验引导、灵感页素材链），它们各自的记录另见。无数据库迁移。
- `deploy-release.sh` 自带的 `verify.sh` 全绿。服务重启约 18 秒，窗口内 23 个 502：6 个部署探测，其余是用户页面的轮询和读余额（画布对话、视频任务、钱包、企业列表），重启后恢复。重启后服务端 0 条 ERROR。
- 线上只读验收（本人账号，未点任何改动操作）：任务历史近 30 天 278 条、消耗 15,723 积分；`task-history`、`storage`、`projects/trash`、`director/works/trash`、`trash/policy` 均 200；回收站列出 96 张画布、6 部导演台作品；设置与安全页显示付款账户与账号中心入口。存储用量第一次打开 360 MB，后台补记历史文件后再打开为 540 MB（日志 `[storage-backfill]`）。
- 两个开关保持默认关闭，未改 `/etc/aistareco/server.env`。
- 回滚：两个服务一起回生产机 `/opt/ai-star-eco/releases/20261109-ai-suggestions-f62ca8ff`（新页面依赖新接口，只回 server 会让账号页报错）。补记写入的 `storage_assets` 统计记录不影响旧版本。
