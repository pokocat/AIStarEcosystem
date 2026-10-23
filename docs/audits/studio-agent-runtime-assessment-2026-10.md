# Studio 智能创作：故障修复与 Agent 运行时评估

核对日期：2026-10-23。状态：明确问题已在隔离分支修复，未生产发布；框架替换为建议，未引入新依赖。聚算配额由用户告知已清理，本轮没有重新提交付费任务验证。

## 1. 为什么用户觉得助手无法继续

今天的故障横跨工具、业务状态、运行时与基础设施，不能归因于模型一个因素。

| 线上表现 | 已核实的原因 | 本轮处理 |
|---|---|---|
| 同一用户连续 18 次对话 409 | `aep_error_logs` 全部为 `STUDIO_PRICE_CHANGED`；旧页面授权额度 21，新默认额度 260，服务端要求达到新默认值 | 接受旧上限，按原授权缩减本轮预算，冻结、调用预算、结算共用同一快照 |
| 长剧本重复读取后停止，用户还得说继续 | `read_canvas` 原先宣称读全文，却只返回前 4000 字，无法读余文；重复保护立即结束 | 正文与目录分页，Unicode 字符游标；一次无副作用的重复读取纠正机会，不重放工具 |
| 同一镜头既说已完成，又说缺失 | 对话缺少真实制作状态查询工具；原生视频绑定行受理完成不代表视频完成 | 新增 `read_production_status`，复用画布 `IpProjectService.toRunDto` 原生任务投影，区分旧采用内容与最新重做结果 |
| 重启期间保存 502，重试后可能冲突 | 单实例重启断开 HTTP；保存可能已提交但响应丢失，旧基线再次提交被判 stale | 前端对网络/502/503/504 有界退避重试原快照；服务端仅对内容完全相同的保存认定幂等成功，真正冲突仍阻止 |
| 图片长时间等待后尺寸错误 | 端点为 CATech `gpt-image-2-1k-pic`；正确尺寸参数已发送，返回原图尺寸不符 | 保留真实尺寸校验；未通过拉伸、裁剪或关闭校验假装成功。需供应商合同/修复或验证可用替代端点 |

先前的动作协议兼容、跨制作类型续接、消息送达恢复已在此前版本发布；本轮没有把它们重复算作新修复。故事导入 24000 字上限及媒体格式拒绝目前是明确校验，现有证据不足以判断为错误拒绝。

## 2. 当前是否是 ReAct Agent

有 ReAct 核心，但尚未形成成熟的创作代理。

- `DialogueLoop` 已实现模型 → 动作 → 校验 → 工具 → 结果 → 再推理，支持停止、预算和重复保护。
- `DialogueModels.Real` 已按端点能力支持原生工具调用；不支持的端点使用文本动作协议，线上发生过多种格式错误。不能把“换框架”误当成“端点自动支持原生工具”。
- `DialogueHistory` 已有历史压缩，并保留确认卡和最新计划原文；不是完全没有记忆。但剧本版本、用户刚纠正的约束、目标镜头清单、已交付/待补项还缺统一、可校验的任务状态。
- `StudioDialogueTurnWorker` 的工具执行有持久事件和业务副作用，`StudioPlanExecutionService` 有执行租约；模型循环的上下文仍在内存，超时轮次会失败结算，并非可从每个推理步骤恢复的持久运行时。
- 配音、口型等现成产品能力尚未接成对话工具，提示词明确要求用户自行去节点面板。入口割裂属于能力覆盖问题，框架本身不会补上。

成熟的标准应是：用户说清目标后，系统能查全依据、知道已经完成什么、在授权内完成下一步，失败时保留进度并给可执行的恢复路径。只增加循环次数与 Token 上限无法满足这个标准。

## 3. 框架判断

建议做受控运行时替换验证，首选评估 **AgentScope Java**，LangGraph 作为对照；当前不直接把生产整套换掉。

| 候选 | 官方能力与本项目关系 | 需要验证的代价 |
|---|---|---|
| AgentScope Java | JDK 17+，ReActAgent；HarnessAgent 提供上下文压缩、会话持久化、权限工具与流式事件等能力，适合与现有 Java 业务服务集成 | 这些能力是否能保持现有 SSE、取消、计费快照、任务幂等和恢复语义；跨实例恢复不能仅凭 README 认定生产可用 |
| LangGraph | 图状态、checkpoint、持久恢复、人工中断机制清晰 | 主流 Python/JS 运行时引入额外服务与跨语言边界；需要稳定的业务工具 API，以及任务、账本和身份边界 |
| Spring AI Alibaba ReactAgent | 与 Spring 生态接近、基于 Graph Runtime | 官方当前对高级模型驱动 ReAct 推荐 AgentScope；因此不把它作为本次新运行时的首选 |

官方来源（2026-10-23 查阅）：[AgentScope Java](https://github.com/agentscope-ai/agentscope-java)、[AgentScope Java quickstart](https://github.com/agentscope-ai/agentscope-java/blob/main/docs/v2/en/docs/quickstart.md)、[LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)、[Spring AI Alibaba overview](https://java2ai.com/en/docs/overview/)。能力判断来自官方文档；最终优劣必须由本项目同题对照验证，当前尚无对照结果。

## 4. 替换边界与验收

1. 保留当前业务工具、项目权限、版本检查、付款选择、`CreditService`、供应商 Job 查询和制作确认。运行时只负责推理调度、上下文、checkpoint、停止与恢复，不绕过业务规则。
2. 持久任务状态包括目标、来源节点及版本、已确认约束、目标镜头、实际产物、缺失项、当前等待原因。最新用户纠正优先；助手自己的建议不能变成用户已批准的要求。
3. 补齐“查进度、准备配音、打开明确对象、检查缺失素材”等工具。免费准备直接执行；已有授权内继续；新增费用与改变范围仍走现有确认。
4. 同模型、同端点、同工具、同预算分别跑现有循环和新框架，先用确定性故障注入，再小范围真模型验收。影子验证不得调用有副作用的付费工具。
5. 必测：长剧本最后一场被完整使用、出图后转视频、用户改回正确剧本、旧片存在而重做失败、502 丢回执、工具完成后进程退出、同确认重送、任务进行中取消、权限拒绝、预算耗尽、供应商配额不足。
6. 比较用户额外催促次数、端到端完成率、进度陈述正确率、重复付费/重复副作用次数、恢复后完成率、延迟与真实费用。重复扣费和越权执行必须为零；仅聊天文案更自然不算替换成功。

建议顺序：先发布并验证本轮确定性修复；并行排期 HTTP 连续性；随后在独立运行时入口完成上述对照，达标后按测试账号 → 小比例用户 → 全量切换。重启产生 502 是基础设施问题，不会因更换 Agent 框架而消失。

## 5. 本轮本地验证

工作分支 `codex/studio-production-recovery`，基于 main `13ed24aa`，在独立工作树实现，未修改原工作区的 AI director 在途改动。

- 后端 120 项通过：DialogueLoopTest 33、StudioReadToolsTest 3、StudioDialogueServiceTest 23、StudioDialogueIntegrationTest 5、StudioNativeVideoProjectionTest 4、IpProjectServiceTest 47、AiChatTokenPricingTest 5。0 failure / error / skipped。
- 前端 37 项通过：project-sync 31、save-recovery 6，包含 50 秒故障恢复、同快照重试、期间继续编辑后按新基线保存、业务拒绝不重试、离开项目停止重试。既有冲突测试有 React act 警告，断言通过。
- `pnpm typecheck:all`、`pnpm typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract` 通过。契约检查仍报告其他既有模块的 24 个 handler 警告及 285 个 orphan path；本轮没有增加 API 路径。
- 尚未进行真实模型行为验收、浏览器端到端验收或生产部署；未自动重提历史付费任务。未把单测通过描述为用户线上已经恢复。
