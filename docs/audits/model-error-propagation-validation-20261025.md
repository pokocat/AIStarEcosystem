# 模型错误原因统一展示

日期：2026-10-25。状态：本地实现，未部署、未重启。延续用户要求，将图片错误修复扩大到所有模型调用；不发起真实付费模型请求，不修改线上任务或客户作品。

## 公共规则

`ProviderErrorMessage` 为唯一的上游消息提取、脱敏与限长入口。HTTP 4xx / 5xx、流式错误、HTTP 成功但明确返回错误的响应、异步任务失败，都保留上游给出的可读原因；没有可读原因时才回退通用提示。可识别的截断 JSON 保留完整的消息字段，HTML / 非结构化网关页不直接展示。

消息清理凭据、签名链接与媒体数据，最多 200 个字符。HTTP 状态、业务错误码、原任务查询、冻结结算和重试规则仍按原协议处理，展示原因不授权重新提交任务。真实追查号链保留。

## 接入范围

| 链路 | 本地修复 |
|---|---|
| 通用文字 / 视觉 | `AiModelInvocationService` 的普通调用、工具调用、流式 HTTP 错误、流中错误、明确的成功响应内错误；`AiChatHttpException` 保留结构化恢复判据 |
| 数字资产多模态 | `DapMultimodalClient` 的模型 HTTP 错误与明确错误响应 |
| 图片 | `JusuanImageClient`、`DramaRenderService`；短剧画布 worker 不再将 429 / 5xx 的具体原因覆盖 |
| 视频 | `MaterialVideoModelClient` 的创建、轮询、素材上传、异步失败、智能优化；受理未知保留上游原因但仍按原规则处理 |
| 配音 / 口型 | `JusuanSpeechClient`、`JusuanLipSyncClient` 的提交、轮询、下载错误；`StudioSpeechWorker` 的异步失败 |
| 音乐 | `MusicGenModelClient` 的 HTTP / 业务错误；`MusicGenWorker` 不再将具体失败原因替换成通用创作建议 |
| 数字人 | `HttpShiliuGateway` 的 HTTP / 业务错误与异步失败；稳定业务码及原有操作引导保留，同时带上脱敏原因 |
| 素材合规 | `HttpModelinkGateway` 共用消息解析，配额 / 删除冲突引导附上具体原因 |
| 前端 | 短剧 `aiErrorMessage` 对模型失败保留服务端消息和追查号，避免把供应商余额不足误当用户积分不足；导演台资产列表直接显示失败原因 |

契约未新增接口或错误码；AGENTS §8.0.1 与 BUSINESS_RULES §4 同步本次用户要求，替代旧的“5xx 只给通用提示”。此前图片专项证据见 [图片拒绝记录](director-image-rejection-validation-20261025.md)。

## 验证

- 22 个后端测试类共 **327 项通过，0 失败 / 0 错误**。覆盖通用解析的各供应商响应形状、脱敏与限长、4xx / 5xx、HTTP 200 内错误、SSE 流中错误、异步失败及计费 / 恢复回归。
- `web-drama/src/lib/ai-error.test.ts`：8 项通过；验证保留模型原因与追查号，并区分服务方配额和用户钱包。导演台资产列表专项组件回归 1 项通过，见图片专项记录。
- `pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract` 通过；契约脚本保留既有 handler / orphan 提醒，未新增接口。
- Java 离线编译随本次交付完成。
- 所有模型响应来自 mock 或本地 HTTP 服务，未调用真实供应商。未做浏览器端到端、真实厂商跨模型实测或发布后验收；本地测试通过不代表线上已经更新。

编译过程中修正了新增多模态下载提示的缺失字符集 import 和一个输入流变量名。第一轮行为回归的 6 项失败来自旧的“隐藏具体错误”与上传标识断言：调整旧提示策略断言，保留上传素材编号和明确队列拒绝的操作引导，同时附上供应商原话。最终 327 项全部通过。
