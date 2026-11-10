# 画布删除、付款预计、官方形象与导演台台词修复发布

发布号 `20261110-official-avatars-3992f750`（server + web-aiavatar），构建提交 main `3992f7509dea62bf8622080b99e6318ae9720a55`。同一晚先单独发过一次网页 `20261110-delete-billing-9167e1de`，见下文「发布」。

## 包含

- PR [pokocat/AIStarEcosystem#190](https://github.com/pokocat/AIStarEcosystem/pull/190)：
  - 付款弹窗写的预计和按钮上同一个数，余额只跟预计比，授权上限放悬停提示。之前长视频按钮写约 2,208，弹窗写「本次预计 8,274」并判个人积分不足。
  - 项目页卡片上直接删、选择后批量删；AI 视频页「最近任务」与草稿、AI 图片页「最近」、画布页「⋯」都能删。删除进回收站，可恢复。
  - 服务端普通删除前核对在途任务，还在生成就返回 409 `IP_PROJECT_BUSY`；停在「需处理」或暂停的制作计划可以删。
  - 历史视频任务底部改为「再次生成」「裂变生成」两个按钮。视频裂变里去掉了「自己改」。
- PR [pokocat/AIStarEcosystem#192](https://github.com/pokocat/AIStarEcosystem/pull/192)：官方形象并入资产页，画布与 AI 图片 / AI 视频可直接选用。迁移 V81（`dap_public_avatar.access`）。启动时把随包的 30 张图存进 OSS（`dap_plaza/`），写 10 条官方形象和配置 `dap.builtin-public-avatars.seeded`，只做一次。
- PR [pokocat/AIStarEcosystem#193](https://github.com/pokocat/AIStarEcosystem/pull/193)（`14ecf1d7e`）：导演台里用户自己加的台词，不再被 H3 改写删掉。只改了 server。

## 构建

- 在仓外干净工作区 `../AIStarEcosystem-delete-billing`，用本机 devq 构建（`fdcbc30428f5`）。Mac mini 磁盘只剩 2.4G，远程同步被拒，所以没在 Mac mini 上构建。参数与上一版线上包相同：`NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_ENABLE_DEV_LOGIN=0`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn` 等。
- 校验和：`app.jar` `61c331c61f4d3b96…`、`web-aiavatar.tar.gz` `22fb3c82a13f91f2…`。jar 里有 `V81__dap_public_avatar_access`、种子类和 30 张 `dap/plaza/*.jpg`。网页构建编号 `lDkO35UI_DH9dZWOucebM`。
- main 在打包期间前进了两次（PR 192、PR 193 先后合入）。每次都从新的 main 重新构建，中途作废了一次构建（`1ea3c9e5d0d3`，停在 `96c755cab`）。
- 检查：三个 PR 的 CI 都通过。PR 190 第二次 CI 的「scope」步骤失败，原因是 main 前进后，浅克隆里找不到 PR 的基准提交（`fatal: bad object`），一项测试都没跑；把分支接到最新 main 后重推就通过了。这个 CI 脚本问题另开了任务。
- 契约：从线上基线到本次，PR 192 的 DTO 只在末尾加字段（`StudioIpAsset.access / category` 等），没有删除或改名；PR 190 只给删除接口加了 409；PR 193 没动接口。

## 发布

- 线上基线：server `20261110-keyframes-e6e2de04`，数据库 V80。
- 2026-11-10 23:33（北京时间）：只发 web-aiavatar `20261110-delete-billing-9167e1de`（main `9167e1dee`，只含 PR 190）。当时有用户在做两条长视频，7 段视频排队，所以 server 先不重启。`verify ALL GREEN`，重启窗口 463 个请求、0 个 5xx。
- 2026-11-11 00:17:45–00:18:42：发 server + web-aiavatar `20261110-official-avatars-3992f750`。账号中心 200。当时线上只剩那位用户一条长视频里的 3 段，都卡在真人照片核验（厂商反复返回 `FaceMismatch`），没有交给厂商。用户确认现在就发。
  - `deploy-release.sh` 退出码 0，`env-check` 和 `verify` 都 ALL GREEN。
  - V81 在 00:18:22 执行成功；Tomcat 00:18:35 启动完成。
  - 30 张官方形象图全部上传到 OSS；`dap_public_avatar` 为 PA-01…PA-10，全部 `free`；`dap.builtin-public-avatars.seeded` 已写入。
  - 重启后 server 日志 0 条 ERROR。
  - 502 一共 27 个，都在 00:18:18–00:18:34：`/api/config`、钱包、`assets/sign`、视频任务和画布的读取。之后 109 个请求 0 个 5xx。
  - 那 3 段排队视频和它们的制作计划重启后照旧在队列里，00:19:41 起又被正常拾取。
- 线上只读验收：用本人已登录的浏览器打开项目页（有「选择」）和资产页（有「官方形象」标签），没有点任何改动操作。

## 发布后要知道的

- PR 193：导演台里用户改写过、原来有认不出台词的视频提示词，存下的英文稿会因为指纹变化作废，下次生成会重新改写一次，每段约 7 积分。线上只有 cl128、cl129 两条受影响。cl128（`DW-a7c57fb8a9e44a96906b`）的真实改写加出片核对还没做，记在 TODO「2026-11-10 · 导演台用户自己加的台词被删」。
- 在线上没验证过的：有任务在生成时删除画布被拒绝（只有单测）；付款弹窗（本地账号没有企业，不弹选择框，只有单测）。

## 回滚

- server、web-aiavatar 都回 `20261110-keyframes-e6e2de04`，可以分开回。
- V81 只加一列，旧版本不读它，回滚不用改库。官方形象的 10 条数据和 OSS 文件留着不影响旧版本。
- 只回网页的话，官方形象界面和删除入口一起消失；server 留新版也兼容旧网页。
