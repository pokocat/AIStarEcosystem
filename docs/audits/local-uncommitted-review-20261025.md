# 主仓与当前工作树未提交改动审查（2026-10-25）

范围经用户确认：`/Users/donis/dev/AIStarEcosystem` 的22项未提交改动，以及 `studio-json-sandbox/AIStarEcosystem` 的4项。其余历史工作树不纳入。只提交合并，不部署、不重启、不调用供应商或重提客户任务。

## 审查结论与整合

- **个人 IP 提示词**：接入6种风格×5种版式、30份正文及2份负面清单；保留矩阵文本和完整输入预览、场景横竖画幅、手动改写保护；演示模式保留完整提示词，不拆成多次收费步骤。React 以文本渲染提示词，不执行模板内容。
- **分集草稿的协议回退风险**：当前工作树草稿把 `reference: string + referenceRev` 改成对象，并使用 `reference.merge` / `splitHint` 等与 main 已合入前端不同的字段；直接覆盖将破坏已有功能。保留 main 的完整分集实现与现有类型、UI、提示词规则、免费标题识别及回归测试，未合入这套重复旧协议。
- **补入草稿中兼容的改进**：采用和放弃分集都必须带匹配的 `pendingSplit.id`，避免无 ID 的旧请求操作最新预览；分集按原稿字符区间切片，保留缩进、空行、CRLF，而非重新拼接被 strip 的行；补充回归测试及契约说明。
- **启动配置不可移植**：将新增导演台预览的个人 `/private/tmp/claude-501/...` 数据库路径改为仓库相对路径；保留预览构建类型路径，去掉 tsconfig 的无关格式改动。
- **已有修复去重**：主仓 JSON 解析器、测试及工作流修复已在 main；不重复覆盖其更新后的上游错误诊断。AGENTS / server README / TODO 保留主线的热修复和分集发布事实，不恢复“未合入”的过期描述。
- **文档**：保留个人 IP 功能说明及 Twick 样式待办；导演运行提示词审阅稿标明历史代码快照，不能当成最新分集协议。Twick 的后置 `@import` 待办仍开放，本轮不额外修改生成器或样式。

## 26项原始文件的处置

| 来源 | 文件 | 处置 |
|---|---|---|
| 主仓 | `.claude/launch.json` | 纳入；修复本机绝对临时目录 |
| 主仓 | `AGENTS.md` | 内容已被 main 更新的说明覆盖，保留 main |
| 主仓 | `TODO.md` | 新增样式待办纳入，保留较新发布/验收状态 |
| 主仓 | `apps/server/README.md` | 保留 main 已有且更新的 JSON 修复说明 |
| 主仓 | `apps/server/.../service/ModelJson.java` | 与 main 相同，不重复提交 |
| 主仓 | `apps/server/.../service/StudioWorkflowWorker.java` | 修复已在 main，保留更新后的诊断逻辑 |
| 主仓 | `apps/server/src/main/resources/studio/skills/image-generation.md` | 纳入个人 IP 完整提示词和画幅/单张约束 |
| 主仓 | `apps/server/.../service/ModelJsonTest.java` | 与 main 相同，不重复提交 |
| 主仓 | `apps/server/.../service/StudioWorkflowWorkerJsonTest.java` | 与 main 相同，不重复提交 |
| 主仓 | `apps/web-aiavatar/src/ip/mocks/studio-dialogue.test.ts` | 纳入完整提示词/版式回归 |
| 主仓 | `apps/web-aiavatar/src/ip/mocks/studio-dialogue.ts` | 纳入，演示模式保留完整指令 |
| 主仓 | `apps/web-aiavatar/src/ip/studio-assistant-starters.test.ts` | 纳入新选项与默认提示词测试 |
| 主仓 | `apps/web-aiavatar/src/ip/studio-assistant-starters.tsx` | 纳入选项、画幅、完整提示词展示 |
| 主仓 | `apps/web-aiavatar/src/ip/studio-assistant.test.tsx` | 纳入发送内容与手动修改保护回归 |
| 主仓 | `apps/web-aiavatar/src/ip/studio-assistant.tsx` | 纳入实际输入文本传递 |
| 主仓 | `apps/web-aiavatar/src/styles/ip-studio-workflow.css` | 纳入局部作用域样式 |
| 主仓 | `apps/web-aiavatar/tsconfig.json` | 纳入预览类型路径；保留原格式 |
| 主仓 | `docs/ip-studio-new-canvas-and-threads.md` | 纳入个人 IP 功能说明 |
| 主仓 | `apps/web-aiavatar/src/ip/personal-ip-prompt-matrix.json` | 纳入矩阵数据，不改写正文 |
| 主仓 | `apps/web-aiavatar/src/ip/personal-ip-prompts.test.ts` | 纳入全部组合与文本摘要校验 |
| 主仓 | `apps/web-aiavatar/src/ip/personal-ip-prompts.ts` | 纳入提示词组合和画幅选择 |
| 主仓 | `docs/prompts/ai-director-runtime-prompts-review-20261024.md` | 纳入；标明历史快照 |
| 当前树 | `apps/server/.../director/DirectorFixtures.java` | 保留 main 已有同协议 fixture |
| 当前树 | `apps/server/.../director/DirectorPrompts.java` | 保留 main 更完整的校验和提示词规则 |
| 当前树 | `apps/server/.../director/DirectorService.java` | 兼容地整合预览身份保护与原稿切片 |
| 当前树 | `apps/server/.../director/DirectorSplit.java` | 不引入与 main 重复且契约不同的旧实现；有用的切片逻辑整合至现有服务 |

另同步 `DirectorSplitTest`、OpenAPI 和业务规则中与上述修复对应的内容。

## 检查状态

- 整合前主仓个人 IP 相关4个测试文件：124项通过。
- 整合后界面5个测试文件：126项通过、1项失败。失败为既有 `older replies show their raw action blocks folded, not as the assistant talking`，在公共 `ready()` 等待 `api.subscribe` 时未满足断言；当时有多份工作树同时运行检查，尚未确认根因，不能认定只是资源争用。
- API 契约检查在上述契约描述补充之前已通过。
- 用户随后明确要求“不要验证了”：立即停止本次仍在运行的后端测试和类型检查，不复跑该失败项，不再启动编译、测试、构建或其他验收。最终整合结果不声明已通过全部检查。

## 原始改动可恢复性

原始内容保存为 Git stash，未删除备份：

- 主仓：`3a1e87188e7bd81e7677fe62c7b1ba21c38dbf8c`，`codex-review-20261025-primary-uncommitted-backup`。
- 当前树：`7e355e37936164504fa54642e721aecce608336e`，`codex-review-20261025-current-uncommitted-backup`。

同时保留 `/tmp/aep-review-uncommitted-20261025/` 文件快照。主仓原有两个不在 main 中的已提交功能不属于本轮未提交差异，不夹带合入 main；原分支及提交保持不变。
