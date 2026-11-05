# 默认文字模型 Sonnet 与编导第 2 版发布（2026-11-05 北京时间）

- 发布：`20261104-sonnet-streaming-editor`，server + web-aiavatar，构建自 main `d43997a18`，在仓外干净工作区 `../AIStarEcosystem-release-sonnet-stream` 构建。无数据库迁移。
- 上一版：server `20261104-voice-reference-format`（`12dc92a04`），web-aiavatar `20261104-image-prompt-operator-template`（`e1605fd34`）。
- 直接推 main，现有工作流只在 PR 或手动触发时运行，本次没有远端 CI。

## 用户能看到的变化

- AI 视频页的编导不再写「还缺」和【待补】，缺的信息直接写出来；只有价格金额、地址、销量排名、获奖认证、检测数据、治病或绝对化功效不凭空写。脚本分六段，时间轴上标明镜头作用、摄影、表演、台词、声音和转场。
- 台词超过每秒 5 字的镜头，页面只提示，不拦截。
- 长文字任务（导演台写剧本、写分镜脚本）不再因为 OneToken 断开非流式连接而失败。
- 默认文字模型已经是 Sonnet 5.5（2026-11-04 当天先改了线上配置），长任务要等本次发布才稳定。
- 生成报错说明了素材要求和下一步，不再出现「HTTP 503」和字段名（main 上 `35c24240a`，本次一起上线）。
- 导演台：角色形态、场景四视图、风格选择、资产大弹窗（main 上 `4f862b0cb` 起，用户确认一起上线）。这些功能此前只在本地用 Agnes 验过。

## 为什么长任务会失败

Sonnet 的思考算在输出里，且关不掉。一部 3 集剧本约 4 万输出 Token，要写 4–5 分钟。OneToken 的非流式连接约 105 秒就断开（EOF），所以这类请求不可能完成。

## 修复

- 端点声明了支持流式时，`AiModelInvocationService.doChat` 改用流式请求，收完再返回普通结果，调用方不用改。
- 流中途断开（`stream_interrupted`、连接断开）自动重发，最多 3 次；超时不重发。重发的那几次 OneToken 可能也计费，这部分不向用户收。
- 线上打开 `ai-onetoken-sonnet55` 的 `chat_supports_streaming`。这是直接改库，在重启前完成。
- 脚本标点写成半角时（`第N镜(…秒)`、`说:`、弯引号），H3 改写前统一转换。提示词也要求全角，转换只作兜底。

选普通版 `claude-sonnet-5-5`，不选 MAX：MAX 不开流式同样被断开（166 秒），稿子更薄，价格也不清楚。

## 发布前检查

- 全工作区类型检查、admin 类型检查、接口契约、web-aiavatar 测试、后端 `**/ipstudio/**/*Test` 与 `Prompt*Test` 子集（统一队列 `8f4dd786f5ea`）。结果有 3 条失败：前端 1 条、后端 2 条，都是 `35c24240a` 改了报错文字后测试还写着旧文字，main 上本来就是红的。改成核对错误码和内部诊断（`d43997a18`），重跑这 3 个测试类全部通过（队列 `86380ad50b3c`）。
- 改完测试后没有重跑全部门禁，只重跑了相关测试类。后端全量测试在本机跑不完，这次仍是子集。
- 契约核对：线上 `12dc92a04` 到本次，`dto` 没有改动，`specs/openapi.yaml` 只有一处说明文字改动，没有删字段或改名，不需要补发其他前端。

## 上线情况

时间都是 UTC（北京时间 = UTC+8）。

- 重启前再查一次：没有进行中的 `ip_run` 和 `material_video_job`。`ip_skill` 没有人工改过的行，新提示词可以自动生效。
- server：23:52:11 开始部署，23:52:58 启动完成（17.6 秒），`NRestarts=0`。线上 JAR SHA256 `eed3659e27f215522050ad05f92e5ae43c89edb65cb192f15dfa8b09a160a969`，与本地一致。
- 重启后 0 条 ERROR。这个 grep 在上一次发布时确认过能命中。
- 提示词自动更新：`base`、`stage-scene-script`、`stage-scene-handoff`、`stage-director-extract`、`stage-director-image-notes`、`stage-director-storyboard` 升到第 2 版，新增 `stage-director-scene-views` 第 1 版。
- web-aiavatar：23:53:18–23:53:50 发布，BUILD_ID `sdKAHVZLhrbRm6al1s9nX`，env-check、verify 全绿。
- 发布窗口有 6 个 502，全部是部署脚本探测 `GET /api/config`（23:52:41–23:52:56）。这次没有碰到用户请求，但单实例重启本身不是零中断。

## 线上验收

两个任务都在线上走真实页面和接口，记在发布账号上（赠送积分），钱包核对一致：4049 − 53 − 9 = 3987，冻结为 0。

**第一次验收失败：OneToken Key 额度用完。** 23:54:56 写长剧本立刻收到 `429 API_KEY_QUOTA_EXHAUSTED`，任务失败，110 积分冻结全部退回，界面显示「生成服务暂时不可用，请稍后再试或联系平台处理」。从 11-04 16:49 改默认模型到这时，线上没有一次 Sonnet 调用成功，文字任务记录里只有这一次失败。额度很可能被本地对比测试用掉一部分（同一个 Key，用量要看 OneToken 控制台）。用户 00:10:26 在后台换了 Key。

| 任务 | 结果 | 用时 | 输入 / 输出 Token | 实扣 |
| --- | --- | --- | --- | --- |
| 导演台写 3 集剧本（`IPR-52f625abb7d34a67a25d`） | 成功，`stream=true`，`finish=stop`，正文 3021 字，带故事大纲 | 376 秒 | 2595 / 49305 | 53 积分（成本约 ¥0.35） |
| AI 视频页编导（`IPR-a41118ea7d3b45c386ce`，口播带货，一张商品图） | 成功，六段齐全，页面显示正常 | 53 秒 | 4876 / 7278 | 9 积分（成本约 ¥0.06） |

- 376 秒远超 OneToken 非流式约 105 秒的上限，修复在线上生效。
- 编导全文没有「待补」「还缺」；没有给价格，脚本明确写了「没有写价格和优惠」。
- 这个脚本读到了商品图的外观和图上的卖点（奶白杯身、木纹盖），说明 Sonnet 的看图路径可用。卖点「12 小时」「316 不锈钢」是否与图上文字一致，没有逐字核对。
- 换 Key 之后到验收结束：0 条 ERROR，0 次流中断，0 次额度报错。
- 长剧本 53 积分比本地估的 38–44 高，这一次输出比本地多约 8000 Token。冻结上限 110 积分足够。
- 测试作品和编导草稿已软删除（`DW-3e687b6db72e4d129fd3`、`IPP-eff66b27`）。

## 未验证

- 重发路径（流被打断后重发成功）只有自动化测试，真实网关上还没走过。
- 没有点「生成视频」：新脚本到成片这一段、H3 改写长度都没验，也没有比较过不同模型脚本的成片效果。
- 没有在线上单独跑创作助手对话、分镜脚本、资产提取。
- 导演台的角色形态、场景四视图、风格选择没有在线上模型上走过，TODO 里原本要求先验。
- 本地有一次单独的流式调用，OneToken 报 `prompt_tokens` 381652，原因不明。输入上限是 200000，如果线上再出现可能触发超限。

## 备份与回滚

- 备份（root-only）：`/opt/ai-star-eco/backups/20261104-sonnet-streaming-editor-20261104T235204Z/`，含 `ip_skill`、`ip_skill_version`、`ai_model_providers`、`ai_app_binding`、`ai_app_endpoint_candidate`（gzip SHA256 `ce0f2b24…`）和上一版 server JAR（SHA256 `3d640317…`）。
- 本次之后，另一会话在 00:26 UTC 发了 web-aiavatar `20261105-prompt-limit-notice`（`d9c50cc4c`），线上前端已不是本版。回滚前先查 `ls -1t /opt/ai-star-eco/releases`。
- 回滚代码：server 回生产机 releases 下 `20261104-voice-reference-format`，web-aiavatar 回 `20261104-image-prompt-operator-template`。两个可以分开回：本次没有接口改动。回 server 之后长文字任务会恢复失败（非流式被断开），除非同时把默认模型改回 Qwen。
- 回默认模型：把 6 个用途（`DAP_PERSONA`、`DAP_VIDEO_PROMPT`、`DRAMA_SCRIPT_DRAFT`、`VIDEO_REF_ANALYSIS`、`APPEARANCE_FORGE`、`GENERAL`）的绑定和 `studio.script` 场景默认改回 `ai-studio-jusuan-qwen38`。发布前的配置在 `/opt/ai-star-eco/backups/20261104-sonnet-default-20261104T164906Z/` 和 `20261104-sonnet-editor-20261104T162012Z/`。
- 提示词：按 `StudioSkillStore` 的规则，回滚 server 后旧 JAR 启动时发现文件变了，且后台没人改过，会把旧内容存成新一版（第 3 版）；后台改过就保留后台的内容。`stage-director-scene-views` 旧 JAR 里没有，这一行会留在库里，旧代码用不到它。这条是读代码得出的，没有实际回滚过。
