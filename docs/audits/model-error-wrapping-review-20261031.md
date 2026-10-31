# 模型错误包装复核

日期：2026-10-31。状态：本地修复与验证完成，随本次提交纳入 main；未部署，未修改生产任务或钱包，未调用真实模型。

## 触发问题与判定依据

原任务 `IPR-3360d7d5` / 追查号 `NXY84JHQV36S` 的生产请求与响应已只读核对。CATech 图片编辑接口返回 HTTP 400，`error.code=content_policy_violation`、`param=""`，原文为“该提示可能违反了关于暴力内容的防护限制”。实际请求带五张参考图。

这个错误码只能证明内容审核拒绝，不能单独证明参考图或提示词违规。原始返回没有审核阶段、具体素材编号或明确字段；同时存在参考图，也不构成“参考图触发”的证据。公开的 [OpenAI 图片生成文档](https://developers.openai.com/api/docs/guides/image-generation#content-moderation)说明提示词与生成图片都有过滤，并为 `moderation_blocked` 提供可选的 `moderation_details.moderation_stage=input|output|unknown`；该通用文档不替代 CATech 自身协议，也不能补出本次返回没有的信息。

## 已确认并修复

| 问题 | 影响 | 修复 |
|---|---|---|
| 图片客户端固定添加“图片未通过审核”，又直接展示上游的“该提示” | 用户容易误以为已定位参考图或提示词 | `ProviderContentModeration` 统一解释专用错误码、明确的 `param`、审核阶段和明确的被拒对象；泛化建议不作为对象证据。未知时明确说明未提供触发对象 |
| 各模型只提取 message，遗漏结构化审核字段；部分异步失败只取单一文本字段 | 专用输入/输出错误码和无 message 的错误无法转成有效提示 | 公共 `ProviderErrorMessage` 保留结构化信息参与用户文案；音乐 `FailureReason` 交给同一入口 |
| 网关顶层 message 先于 `data.error` 等具体错误 | 可能展示“success”或笼统错误而丢失原因 | 优先读取嵌套错误，兼容错误数组；根部具体原因仍优先于普通嵌套消息 |
| 图片、配音和口型遇到 HTTP 200 内的 error 时，原因被替换成“无结果/未确认” | 可读的审核或参数原因丢失 | 保留具体原因；同步图片的最终失败、异步图片的无回执、配音/口型的 BAD_OUTPUT 沿用原分类与恢复路径 |
| 配音和口型的未知 4xx 兜底断言文案/音色、人脸/时长有问题 | 鉴权或协议等其他拒绝也会引导用户反复改素材 | 无具体原因时明确说明未知，指向平台协助 |
| 素材合规将普通 429、所有 limit/exceed 都当成分组配额耗尽 | 请求限流、文件大小限制会被误报为资源容量问题 | 仅明确资源配额证据保留 `DAP_MODELINK_QUOTA_EXCEEDED`；普通 429 使用既有 `DAP_MODELINK_CALL_FAILED`，保留服务不可用状态与限流说明，不指导删除用户作品 |
| 数字人 code=1 把余额/不明额度/配额都当作克隆权益不足，出现 token 就当鉴权失败 | 错误码和处置方向偏离上游原意 | 明确权益不足保留原映射，余额不足用既有 BALANCE 码；其他不明额度/配额回到 CALL_FAILED，完整原话保留内部。只有明确 token 无效/过期等才判鉴权 |
| Studio “下一步”用 BALANCE/INSUFFICIENT 等宽泛匹配钱包问题 | `CLIP_ENGINE_BALANCE_INSUFFICIENT` 等供应商错误会提示客户充值；模型 NOT_FOUND 可能误报用户作品被删 | 复用公共模型/钱包错误码判别；供应商问题按原因处理，待核对用量查看原任务，模型下架提示换模型 |
| 短剧画布通用错误包装写“积分已退回”，任意 ResponseStatusException 写“积分结算失败/没扣费” | 文案在缺少结算依据时做出承诺 | 包装层只描述调用失败、未知原因与查看任务状态；真实结算事务的已有业务说明保留 |
| 只改新任务会留下历史误导文案 | 历史任务、导演台资产和错误详情仍显示旧前缀 | 服务端公共 JSON/SSE 的既有读时保护与共享前端保护同时规范旧前缀；原始记录、用户正文与真实追查号保留 |

未知对象的本次提示为：“本次生成未通过内容审核。服务方提示可能涉及暴力内容。服务方未说明触发对象，请检查参考素材和生成描述。”

## 检查范围

- 通用文字/视觉普通调用、工具调用、流式错误：`AiModelInvocationService`、`AiChatHttpException`、`ProviderErrorMessage`。
- 图片与数字资产多模态：`JusuanImageClient`、`DapMultimodalClient`、`DramaRenderService`、`IpRunWorker`、`DramaCanvasRunWorker`。
- 视频创建、轮询、上传、优化、异步失败：`MaterialVideoModelClient`、`VideoProviderErrorMapper`。真人参考图限制、模型下架、队列满等已知专用映射保留。
- 配音、口型、音乐、数字人及素材合规：`JusuanSpeechClient`、`JusuanLipSyncClient`、`StudioSpeechWorker`、`MusicGenModelClient`/Worker、`HttpShiliuGateway`、`HttpModelinkGateway`。
- 用户出口：`PublicModelErrorAdvice`、任务/作品/SSE 投影、共享 api-client、Studio 弹窗与导演台资产、短剧错误提示；小程序读取服务端错误消息。
- 后台与告警：`ProviderResponseDiagnostics`、`StudioRunErrorLog`、`FeishuModelAlerts`。后台原始响应继续保留供应商原话，通知的“错误原因”为用户可读解释，“服务方返回”为原始证据，不把两者混为同一层。

供应商财务、密钥、签名地址和堆栈的既有过滤规则保留；诊断分类继续读取 `diagnosticReason`，不读取已规范的用户消息。图片/视频/音频的受理与恢复分类不变；素材合规和数字人的错误归类修正复用现有错误码，无代码按这些细分码新增付费重试或结算。未增加模型提交、自动重试或数据迁移。

## 验证

使用 `/Users/donis/.local/bin/devq` 统一排队，检查链串行执行。覆盖原始告警形状、明确参考图/文本/音视频/输出审核、无 message 错误、嵌套/数组错误、HTTP 200 内错误、历史记录重读、真实组件弹窗与资产列表，以及原有退款、恢复和原始告警证据。

最终队列任务 `0b809c8b10bd` 状态 `done`、退出码 `0`：

- 后端 27 个测试类，共 **429 项通过，0 失败、0 错误、0 跳过**。报告均来自本次执行，包含原始响应、任务失败/退款、受理未知/原任务恢复、素材合规轮询和数字人 HTTP 适配器回归。
- 前端 5 个测试文件，共 **42 项通过**：共享客户端错误保护 11 项，Studio/导演台真实组件 22 项，短剧错误提示 9 项。导演台既有测试保留 jsdom 伪元素和 React `act` 提示，退出码为 0。
- 全 workspace 类型检查按 `pnpm -r --workspace-concurrency=1 run typecheck` 串行执行，覆盖原 `typecheck:all` 范围；管理后台类型检查、Java 离线编译、API 契约和 `git diff --check` 全部通过。契约脚本保留既有 handler/orphan 提醒，没有新增接口。
- 错误弹窗的 Impeccable 机械检查返回 `[]`，无命中。按 hook 提示从现有 DESIGN.md 刷新设计侧车叙述，未修改设计令牌或组件样式。
- 提交前按用户再次确认的边界专项复核：`f3ea16523aff` 退出码 0，后端 3 类 41 项、前端共享保护 11 项通过；石榴通用 `code=1` 的余额不足及 `code=2002` 的预扣费/金额原话均不进入用户提示，客户真实钱包提示仍保留。

中间失败轮次均已处理：导演台旧文案断言改为验证规范后的参考图片提示；新增嵌套错误测试补齐数组收尾括号；图片 HTTP 200 回归将 Mockito 响应对象先构造再设置 stub，避免嵌套 stub。未把这些失败轮次当作通过，也未为绕过失败删除用例。

验证明细在 `.studio-e2e/model-error-review-20261031/`，检查脚本 `verify.sh`、后端明细 `backend-results.json`。所有上游响应使用 mock 或本地 HTTP 夹具；没有浏览器端到端、真实厂商跨模型实测或线上发布验收。修复需要发布相应服务后才对线上用户生效。
