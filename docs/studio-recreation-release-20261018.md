# Studio 全能创作 · 对话驱动视频复刻（S1/S2/S3）生产发布记录 · 2026-10-18

- 发布：`20261018-studio-recreation-s1s3`，`GIT_SHA=c6f4080899792e63434ac693811a238f1535ef4c`（分支 `release/studio-recreation-20261018` = `dev/ai-video-replacement-skill-27b923` + 合入生产基线 `2f67939a`），服务 `server web-aiavatar admin`，构建参数与前一版相同（`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`）。
- 基线核对：线上此前为 `20261018-studio-demos-layout`（`2f67939a`，在 `codex/studio-demos-layout`），其相对 `codex/unified-ip-studio` 7649dd42 多出画布分组描述与模板复制 groupId 修复；本次先把 `2f67939a` 合进发布分支（唯一代码冲突 `IpDemoTemplateService` 白名单，合并为同时保留 `groupId` 与 `videoMode/vquality/videoCount`），文档冲突取发布分支版本。
- 迁移：Flyway 一次应用 4 个（V60 端点能力开关、V61 对话线程 / 消息 / 事件 / 转向、V62 计划执行、V63 技能表），启动日志 `Successfully applied 4 migrations`；技能 `reference-video-recreation` 由仓内文件 seed 为 v1。重启后 15 分钟内 `-ERROR` 0 条。
- `verify.sh` ALL GREEN；`/api/v1/ip-studio/studio/skills`、`/api/admin/studio/skills` 匿名 401（按预期）；`aiavatar.aibuzz.cn/projects`、`/create` 200。
- 方案与实现：`docs/ip-studio-conversational-video-recreation-plan.md`；实现说明 `apps/server/README.md`「Studio 对话 agent、技能与计划执行」、`apps/web-aiavatar/PRODUCT.md`「2026-10-18 · 全能创作」、`specs/BUSINESS_RULES.md` 同名节。本地 Codex 七轮验收报告与脚本在工作树 `.studio-e2e/`（gitignored）。
- **上线后要做的配置**（后台「AI 模型与 Key」）：给 Studio 文本端点按实际能力勾「支持工具调用 / 支持流式」（默认都按不支持：对话走 JSON 动作协议、整段一次给出，不假流式）；确认 Studio 文本端点有按量售价（否则对话 503 `AI_TOKEN_PRICE_NOT_CONFIGURED`）。
- **未验证**：S0 付费实测（真实供应商换主体 / 创意重写效果、检查可靠性）尚未做，`autoFixChecks` 保持为空；真实供应商流式延迟、企业付款、跨节点租约竞争未在生产验证。

## 上线后第一次真对话暴露的问题与热修（2026-10-18 晚，仅 server）

线上对话模型是聚算 `ai-studio-jusuan-qwen38`（Qwen3.8 27B）：已声明看图，**未**声明流式、工具调用和 `response_format`。S1–S3 此前只用确定性假响应验收，真模型第一次对话连撞三处格式问题，每一处都发生在「要求模型按我们的格式输出」的地方：

| 现象 | 根因 | 热修 |
|---|---|---|
| 助手回复里直接露出 `<tool_call>{...}</tool_call>`，没有执行任何动作 | 解析器只认 `<<<studio-actions>>>` 分隔行，Qwen 习惯写标签形式 | 发布 `20261018-studio-toolcall-tag`（`adb30018`）：同一套回退协议也接受 `<tool_call>` 块（`tool`/`name`、`args`/`arguments`），流式过滤器同样在标签处截断，写不完整的块整批不执行 |
| 「整理制作方案」连续失败，助手最终如实说明方案工具没通过 | 对话里的 `propose_plan` 另写了一份规划输入，只列操作名，漏了各操作 `settings` 字段契约，模型给 recreation 步骤编了 `videoId`/`analysisType`；回复还裹着 ```json 围栏；`questions` 写成 `{question, default}` 对象，校验器只收字符串 | 发布 `20261018-studio-plan-contract`（`237c1134`）：规划输入与执行侧、后台试跑共用 `StudioWorkflowService.skillPlanStageText/skillPlanConstraints/planCapabilities`；新增 `ModelJson` 去围栏解析（执行侧文字任务与后台试跑同样使用）；`questions` 两种写法都收。校验仍然严格，猜错键名照旧被拒并带可操作的原因 |

- 提示词文件**没有改**。`prompt_template` 行首次启动入库后，只有 `PromptTemplateSeeder.SEED_VERSION` 变更才会刷新「没人改过」的行；生产库里 Studio 的 8 条提示词与文件长度一致，`dap.ip_canvas_image` 是运营改过的版本 3，刷新也不会碰它。
- 测试：`ProposePlanToolTest`（用真实回复形状：围栏 + 问题对象 + 正确/猜错的 settings）、`ModelJsonTest`、`StudioPlanValidatorSkillTest` 新增 2 项、`DialogueActionProtocolTest` 新增 4 项。整个 `ipstudio` 包 623 项里只有 3 项失败（`IpVideoModelChoiceWiringTest` 2 项、`StudioAssetCatalogPricingTest` 1 项），在未改动的开发分支上同样失败，与本次无关。
- 两次发布都只动 server，`verify.sh` ALL GREEN，重启后 `-ERROR` 0 条（该 grep 先在近三天日志里验证能命中 13 条）。
