# 供应商计费信息进入客户端：排查与代码修复（2026-10-25）

状态：已生产发布。用户追加“赶紧快速上线”后，从干净 main `3e45f6e4` 构建并发布 server、web-aiavatar、web-drama，2026-10-25 16:55:53 UTC 恢复服务。见[发布记录](../releases/provider-error-privacy-production-release-20261025.md)。没有修改生产任务/作品/钱包，没有供应商请求或生成重提；按用户要求未执行额外测试、独立类型检查或整套验收，正式制品构建与必要上线健康检查已完成。

## 已确认的问题

截图是导演台资产图片错误，页面显示供应商预扣费失败、账户剩余额度和所需金额。文案与 `JusuanImageClient.rejected` → `ProviderErrorMessage` → worker 持久化错误 → `DirectorService` 资产投影 → `InlineError` 的链路一致。

统一错误展示的边界有误：`ProviderErrorMessage.sanitize` 复用了运营日志的 `ProviderAlertText`。后者只应负责日志/通知中的凭据、签名 URL、媒体等脱敏，保留运营诊断；不能因此把仍含账户余额、配额、预扣费用的文本作为用户消息。此前 AGENTS §8.0.1 和业务规则“具体原因都展示”的说明缺少该边界，已按本次用户要求修正。可操作的素材、参数、审核原因继续保留。

生产当时运行的 JAR 包含该共用类，45分钟服务日志窗口命中同类预扣费/剩余额度文本52行。日志行数不是任务数或客户数。只读按 `预扣费` / `用户剩余额度` 检索持久化错误：

| 位置 | 命中 |
|---|---:|
| `ip_run.error_message` | 13条记录 |
| `director_work` 的资产图片错误消息 | 1个作品 |
| `material_video_job.error_message` | 0条记录 |

这不是所有经营信息泄露的全量统计，只是该截图文案对应的命中。未读取/导出客户剧本、图片、手机号或账户凭据；未修改这些记录。修复发布后通过返回投影过滤历史错误，不需要为隐藏提示而篡改原始诊断或重跑生成。

## 共用逻辑覆盖的链路

| 链路 | 原入口与本轮处置 |
|---|---|
| 文字/视觉/流式 | `AiModelInvocationService` / `AiChatHttpException` 共用消息过滤；视觉内存恢复仍读取结构化原始状态/码，不按新文案改变恢复判断 |
| 图片/短剧图片 | `JusuanImageClient` / `DramaRenderService` 共用源头过滤，不再把供应商余额作为可操作原因 |
| 视频/优化/参考素材上传 | `MaterialVideoModelClient` 共用 message/reason/append；保留明确拒绝、受理未知与幂等规则 |
| 配音/口型 | `JusuanSpeechClient` / `JusuanLipSyncClient` / `StudioSpeechWorker` 共用过滤，原响应仍在诊断中 |
| 音乐 | `MusicGenModelClient` / `MusicGenWorker` 共用过滤 |
| 数字人 | `HttpShiliuGateway` 保留内部原文用于现有容量/权益分类，仅在公开消息出口过滤，错误码/状态不变 |
| 数字资产/合规 | `DapMultimodalClient` / `HttpModelinkGateway` 共用过滤；append 的固定上下文也经过同一边界 |
| 历史任务/作品/HTTP错误 | 新增公共 Jackson JSON 响应 advice，对副本中的错误字段过滤；不改剧本/提示词/聊天正文，不写回数据库 |
| SSE/事件重放 | `StudioDialogueStore.toDto` 对事件错误投影过滤；浏览器传输层也做兜底 |
| 多产品前端 | shared apiFetch、分页请求、ApiError、任务异常展示、Studio 错误中心、导演内联错误及短剧错误友好化统一兜底 |

## 过滤规则与隔离

- 新的真实供应商错误消息：余额、配额、费率/成本、预扣、鉴权/密钥、签名链接、技术堆栈等内部问题改为“生成服务暂时不可用，请稍后再试或联系平台处理。”，不要求客户为供应商账户充值。
- 旧消息：按错误码/服务上下文、预扣费等明确内部标记及金额信息识别；保留我方真实追查号和结构化任务 ID。用户真实 `STUDIO_PAYMENT_REQUIRED` / `PAYMENT_REQUIRED` 及钱包错误仍保留所需积分/当前可用等引导。
- 公开错误对象不返回原响应体、internalDetail、凭据及明确的供应商财务字段。公共 JSON 投影只处理错误字段，普通作品内容不改写。
- `/api/admin/**` 的 JSON 诊断不走客户过滤；错误日志路由由现有 `AepSecurityConfig` 限定 SUPER_ADMIN。`ProviderResponseDiagnostics` / `ProviderAlertText` 继续保留脱敏的完整后台证据，未因 UI 改写而清空。
- 另发现 shared API 客户端在非 JSON 响应时会把 body 前240字符拼进异常详情/浏览器日志；两个解析路径均移除该原文片段，只保留通用提示、状态和内容类型。
- 不因提示改写而变更业务错误码、任务受理状态、冻结结算、恢复和重试条件。没有计费、充值或生成调用。

## 交付与限制

新增公共策略、历史响应隔离、前端兜底，并补充供应商经营信息过滤/我方追查号保留/真实用户钱包不误伤/原始诊断保留的回归用例；相关原有“供应商余额要原样展示”的断言已改为新的边界。按用户要求，这些用例没有执行；正式发布的 JAR、Studio 和短剧端生产构建已成功。

历史数据没有改动；生产服务已更新。实际图片生成失败仍需平台运营处理供应商账户问题，遮挡信息不会恢复上游额度。本轮不执行供应商充值或自动重试。历史记录的错误由新版本在返回/显示时过滤；不必重跑原任务。尚未使用客户登录态实际打开其资产卡片验收。

## 2026-10-29 补充：用例补跑与两处分类回归

上面「这些用例没有执行」的那批，在 main `b985992d7` 上补跑后有 6 个类红着（CI 的 backend / frontend-tests 因此一直是红的），逐个按本轮意图处理：

- **分类回归（改代码）**：石榴网关拿已过滤的 `reason` 去判「权益不足 / 额度不足」，七牛素材合规拿它判分组配额，原话里的这些词已被换成通用句，于是石榴的 `CLIP_ENGINE_CAPACITY_FULL` 退成笼统 502、七牛的 `DAP_MODELINK_QUOTA_EXCEEDED`（503）退成 502。新增 `ProviderErrorMessage.diagnosticReason`（同一套字段查找，保留供应商原话、只做脱敏），两处分类改读它；对外文案照旧过滤。石榴网关另把「分类文案 + 供应商原话」改为只拼过滤后的原因，否则已经说清楚的「数字人克隆权益不足，请联系运营开通后再试」会连同原话一起被换成通用句。
- **web-drama 兜底（改代码）**：`publicModelErrorMessage` 也会拦堆栈（`java.net.…`），短剧端随之把技术报错显示成「生成服务暂时不可用…」，而不是调用方按场景给的兜底文案。现在技术报错仍走调用方兜底（带问题编号），供应商经营信息才用统一说法，两条都不透出原文。
- **断言过时（改测试）**：音乐、通用对话、七牛的用例仍断言 `quota` 原话会显示，改为断言不显示、错误码不变；DAP 的 5xx 用例按 `9d192fbbd`（5xx 也保留可读原因）改写。
- 观察：`budget` 这个词会把 GPU 显存类错误（`visual activation/HBM headroom budget`）也当成经营信息过滤成通用句，见 `TODO.md`。

