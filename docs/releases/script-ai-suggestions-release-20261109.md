# AI 编导由模型生成修改建议（2026-11-09）

## 行为

编导在同一次模型回复中返回脚本和可选的 `suggestions:[{label,instruction}]`，随该轮脚本节点保存。按钮最多 8 个 Unicode 字符，完整修改意见最多 80 个字符，最多 3 条；空值、错类型、控制字符、超长和重复项独立过滤。没有有效建议时不显示固定兜底，也不重调模型。点击只填入修改意见，主动发送才改稿；采用和生成视频只读取脚本正文。

完整模型原文仍在解析前进入既有任务和用量记录，建议异常不影响脚本交付。通用画布文本及分段脚本的契约不变。

## 发布前验收

- 前端 7 个文件、124 条测试通过；全工作区串行类型检查和后台类型检查通过。
- 后端 5 个测试类、42 条测试通过；离线编译、API 契约检查通过，队列 `767e7e2b5d05` 退出码 0。初次新增断言误把 user 提示词中的规则当成 system 规则，已修正断言并复跑；产品代码无需因此修改。
- 远程 Mini 同步因磁盘满失败，受管理清理被其他服务租约阻止；保留其他任务，改用本机共享队列。`77ccffac90f7` 完成前端检查；`b7afbeb647ce` 准备真实提示词；`4f4ab5f6f305` 完成两次真模型调用和 Java 校验，退出码均已核对。
- 真实模型为生产当前 DAP_PERSONA 绑定的 `gpt-6.1-terra-official`。使用新代码实际拼出的完整提示词，先写首稿，再按模型第一条建议改稿；耗时 28.61 / 30.15 秒，均正常 stop。两轮各 3 条建议，按钮均 4 字，指令 26–28 字，完整脚本及建议未经截断或修补。直接测试供应商接口，不写产品账本、未生成视频。
- 浏览器运行实际 Next 应用，使用上述两份完整真模型回包；本地 API 仅模拟受理、查询与草稿持久化。确认点击后提交数 0、发送后提交数 1，新一轮保留旧回复并替换建议；刷新恢复两轮和最新建议；采用后的正文与第二份真实脚本逐字相等。桌面与 390px 手机无横向溢出，手机按钮高 44px、文字未裁切，临时视口已恢复。
- 原文、长度核对和截图在 [evidence/script-ai-suggestions-20261109](evidence/script-ai-suggestions-20261109/real-model-verification.json)；本地预览不能单独证明线上端到端已生效。

## 正式发布

- main 制品提交：`f62ca8ffe18ce349c132ab61aff8e2b6c6e688e1`，构建时工作树干净、与 origin/main 对齐。发布 `20261109-ai-suggestions-f62ca8ff`，仅 `server,web-aiavatar`。
- 本机队列 `59c9675a581a` 构建退出码 0，制品校验和全部通过。打包脚本按既有流程跳过测试运行；测试已单独通过上述门禁。AUTH_MODE=id，mock / dev-login 关闭，企业功能开启。
- server JAR SHA256：`16117a4ec6a6769138ae988e5773b4cc13384d816c9b07cff2bbe2c2b5031e0e`；前端包 SHA256：`8d8fedb81bf8562e7b1054f90e43e6e8beba31187cd3dd867f249ca48c453f8b`；线上前端 BUILD_ID：`9VPKb8auB21GXKPws_jS1`。线上 JAR 与发布目录逐字节相等。
- 发布前账号中心 discovery 200；`ip_run`、原生视频在途任务均为 0。生产实际旧 server 是 `719ccbfefd2a0c197095568bd1d49bd63a993b4d`（JAR 校验和与该制品一致），旧 release-sha 文件停留在 11 月 5 日，未把它当运行真值。与新 main 的契约差异只有新增可选 suggestions，无删除或改名，故无需扩大服务范围。
- 北京时间 19:47:42 / 19:47:43 分别启动 server / web-aiavatar；server 19:48:00 完成启动，两个服务 NRestarts=0。运行环境检查、发布 verify 均 ALL GREEN，公网首页、登录、视频、项目、config 均 200。两端 release-id / release-sha 和 server release-manifest 已更新。
- `stage-scene-script` 启动时从仓库自动升级为 **v3，active，updated_by=seed**；原 v1 / v2 保留。未手工覆盖后台内容或修改生产环境文件。

## 线上端到端验收

实际浏览器新建「品牌故事 · 界面验收」草稿 `IPP-ed015b49`，只发起一次编导文字调用，不生成视频。真实任务 `IPR-20520f74a60541edbaf4` 已 done，模型 `gpt-6.1-terra-official`，冻结提示词明确记录 stage-scene-script v3；返回 1452 字正文和三条建议「强化开场／调整独白／突出书店」，按钮均 4 字，指令分别 27 / 24 / 32 字。1767 字完整原文已保留，原文内的 suggestions 与结构化输出完全相同。

账本仅一笔 SPEND -3：冻结 110、释放 107，余额从 1613 变成 1610。点击两条建议以及刷新、切换手机视口均未发起第二个任务。刷新后仍恢复该轮真实建议；390px 手机上三按钮均高 44px、无裁切和横向溢出；临时视口已恢复。

[线上任务、原文与账本核对](evidence/script-ai-suggestions-20261109/online-proof.json)。真实账号的截图仅留本机可视化目录，未把右侧私人任务列表提交仓库：`ai-suggestions-production-desktop.jpg`、`ai-suggestions-production-mobile.jpg`。

共享 nginx 日志的部署观察窗口为 UTC 11:47:10–11:50:59：576 请求，其中 16 个 502，发布后已恢复并通过公网验收；该统计包含共享入口全部流量，不能解释成零停机或仅本功能请求。其余 410 个 200、23 个 304、5 个 401、122 个 404。单实例重启仍有短暂读取中断。

上一版制品保留：server `20261109-plan-model-719ccbfe`，web-aiavatar `20261109-script-chat-fe1a75e7`。本次没有数据库迁移。
