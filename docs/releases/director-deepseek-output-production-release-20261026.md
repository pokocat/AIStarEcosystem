# AI 导演台 DeepSeek 剧本截断修复生产发布（2026-10-26）

## 发布结论

- 已从远端 `main` 提交 `aa7bb287d5afb5b84a8d8651415ae4155a9d4c32` 构建并发布 `server`。
- 发布编号：`20261026-director-deepseek-output`。
- AI 导演台的 `script` 任务使用 DeepSeek 时显式发送 `thinking: {"type":"disabled"}`，并把单次输出上限提高到 `100000`。
- 改动只作用于 AI 导演台剧本生成；Studio 对话、导演台其他任务和全能创作助手保持原行为。
- 未重试事故任务，未产生新的模型调用或积分扣费。

## 原因与修复

事故调用的 DeepSeek 输出达到原 `8192` token 上限，并以 `finish_reason=length` 结束；大部分输出预算被推理内容消耗，业务 JSON 因而不完整。

本次修复包含三层约束：

1. AI 导演台 `script` 任务的业务请求预算提高到 `100000`。
2. 只有 DeepSeek 的导演台剧本任务关闭 thinking，避免隐藏推理与剧本正文争抢同一输出预算。
3. DeepSeek 请求适配器校验并转发 thinking 模式；其他供应商携带该参数会被拒绝，避免跨供应商误传。

## 验证

发布前验证：

- `DirectorSplitTest`：13 项通过。
- `StudioWorkflowWorkerJsonTest`：8 项通过。
- `AiModelInvocationServiceTest` 本次新增的 2 个定向用例通过。
- `./mvnw compile -q -o` 通过。
- `pnpm typecheck:all`、`pnpm typecheck:admin` 通过。
- `pnpm check:api-contract` 通过；保留 24 条既有 handler 警告。
- 完整运行 `AiModelInvocationServiceTest` 时仍有 2 条与本次无关的既有断言失败：旧测试期待向用户透传供应商错误，当前主线实现会做隐私屏蔽。本次未扩大范围修改。

线上验证：

- `aistareco-server` 为 active，启动无 ERROR/Exception。
- 正式 JAR SHA-256：`a43ced1b63a7aad1e75054be6c8a53a0d1331616da43ec43e3fc7adf1189d5d4`，与本地发布制品一致。
- `ai-1bd2eefd-d1e`：`default_max_tokens=100000`、`chat_max_output_tokens=100000`、enabled。
- `ai.chat-token-pricing`：该端点 `maxOutputTokens=100000`；`maxInputTokens=65536`、输入单价 `0.59`、输出单价 `2.36` 均未改变；配置版本由 4 升为 5。
- `https://aistar.aibuzz.cn/` 与 `https://aistar.aibuzz.cn/director` 均返回 HTTP 200。
- 发布脚本全量健康检查 `ALL GREEN`，包括后端、本机 API、nginx、MySQL、各 Web 服务与 sau-service。

## 回滚材料

代码可回滚到 `aa7bb287` 的父提交；线上配置更新前的两条数据库记录已存放在服务器 root-only 目录：

`/opt/ai-star-eco/backups/director-deepseek-output-20261026T055909Z`

