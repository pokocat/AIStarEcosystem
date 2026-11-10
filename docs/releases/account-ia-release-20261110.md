# 账号区合并为 7 个标签、原文按任务查看 · 发布记录（2026-11-10）

发布号 `20261110-account-ia-f27ed14c`（server + web-aiavatar）。PR [pokocat/AIStarEcosystem#189](https://github.com/pokocat/AIStarEcosystem/pull/189)，设计与规则见 [`docs/aiavatar-account-unification.md`](../aiavatar-account-unification.md) 末节。

## 内容

- 账号区 7 个标签：总览、任务历史、积分、存储（用量 / 回收站）、授权（真人授权 / IP 授权登记 / 明星形象授权）、企业、设置，地址统一在 `/me` 下面。
- 生成原文并进任务历史的抽屉；邀请朋友放到总览；我的名片移到 `/assets/cards`；企业页并入「企业」标签。
- 迁移 V80：`ai_model_usage_record.task_id` + 索引 `idx_aiusage_task`（Java 迁移，表不存在时跳过）。任务历史条目带 `hasModelResult`，`/api/me/model-results` 支持 `taskId`。
- 旧地址跳转：`/studio#/…` 由 `/studio` 页转；`/invitations`、`/enterprise`、`/licenses`、`/model-results`、`/cards`、`/cards/:id/edit` 308 永久重定向。
- 任务历史和企业消费流水不再写「已退回」；全站 antd 危险色改为 `#ad3449`。
- 同时带上线：PR #187（导演台读作品不在行锁内另开连接，前端轮询不叠请求），它在 15:28 那次发布之后合入 main，此前没有单独发布。

## 构建

- 构建提交：main `f27ed14c408e675161eafa39bb6d451a6b158024`，打包前、上传前各 fetch 一次，main 没有再动。
- 仓外干净工作区 `../AIStarEcosystem-account-ia`，本机 devq 构建（`3ce6506acb8b`），参数与上一版线上包相同：`NEXT_PUBLIC_USE_MOCK=0`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`、`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn` 等。核对过 `server.js` 在 `./apps/web-aiavatar/`，jar 内有 `V80__ai_usage_task_id.class`，新路由在包内。
- 校验和：`app.jar` `4f17c0b4…`、`web-aiavatar.tar.gz` `5902fe4d…`。
- 检查：PR CI 26 项全绿（第一次 CI 因 V80 写成 SQL 迁移、空库找不到表而失败，改成 Java 迁移后通过）。
- 线上基线：server + web-aiavatar `20261110-recreation-197b6cfc`，数据库 V79。从基线到本次，接口只新增 `StudioTaskHistoryItem.hasModelResult` 与 `model-results` 的 `taskId` 参数，没有删除或改名；其余前端（admin、studio-admin、web-drama 等）没有改动。

## 发布

- 2026-11-10 21:05（北京时间）：账号中心 200；线上没有排队或运行中的 `ip_run` 和数字人任务，只有 1 条视频已在厂商生成中（重启后接着查）。
- `deploy-release.sh` 退出码 0，`verify ALL GREEN`。V80 21:06:54 执行成功，`task_id` 列和索引已在。
- 重启窗口 21:06:22–21:07:06 共 33 个 502，全是任务进度轮询、钱包和 `/api/config` 的读取；21:08 之后 0 个。重启后 server 日志 0 条 ERROR。

## 线上验收

- curl：6 个旧路径都 308 到新地址；`/me/tasks`、`/me/credits`、`/me/authorization/ip`、`/assets/cards`、`/enterprise/invite` 均 200。
- 内置浏览器、线上账号：`/studio#/membership` 跳到 `/me/credits`，充值套餐与充值记录正常；`/me/tasks?raw=all` 打开「全部原文」，列出真实原文记录、用途显示为中文；任务历史近 30 天 282 条，页面没有「退回」字样。
- **没验**：「查看原文」按钮（发布前的任务没有任务编号，要等新产生的文字任务）；统一账号模式下的总览邀请卡片在电脑宽度下的样子；企业标签。

## 回滚

- server、web-aiavatar 回 `20261110-recreation-197b6cfc`，可以分开回。
- V80 只加一列和一个索引，旧版本不读它，回滚不用改库。回滚 web 后旧地址 `/me/*` 子页会 404（旧版没有这些路由），`/studio#/…` 照旧可用。
