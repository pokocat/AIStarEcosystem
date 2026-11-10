# sun5.5：Sonnet low 生产切换（2026-11-07）

用户要求将线上默认文字模型切回 Sonnet、使用 low effort，随后明确对外名称为 **sun5.5**。本次发布后端参数支持并调整现有端点，没有新建端点或改变用途绑定。

## 发布与配置

- 构建 main：`27351bb9c0ca378f1edf9f7692f2abd508ef72db`。
- 制品：`20261107-sun55-low-27351bb9`，范围仅 `server`。与上一版线上后端 `7c445915bcf8dd49d43cc6179c1264d73c4b3700` 相比，端点 API 只增加可选字段，没有删除或改名，因此没有附带前端发布。
- 2026-11-07 10:47 PST（18:47 UTC）后端启动完成，V77 迁移成功。发布前确认账号中心 discovery HTTP 200，模型端点无排队或运行任务；发布后 `verify.sh ALL GREEN`。
- JAR SHA256：`f2ff15f24435e21fcab3d15f3928574d8608a0b4023a0573a9fe15c6f02cd00b`，Mini 制品、本机取回制品和线上运行文件一致。

| 字段 | 上一配置 | 当前配置 |
|---|---|---|
| 端点 ID | `ai-onetoken-sonnet55` | 保留 |
| 固定上游型号 | `claude-opus-5-5-Kiro` | `claude-sonnet-5-5` |
| 对外别名 | `Orange5.5` | `sun5.5` |
| 内部名称 | `OneToken · Orange5.5` | `OneToken · sun5.5` |
| 思考强度 | 不发送 | `reasoning_effort: low` |

地址、密钥、计费归属、Token 单价、默认输出 64000、输出能力上限 64000、并发 2 和真实流式开关保持原值。为当前 Sonnet 目录项保留看图声明并设置 sun5.5 标签；其他目录项和用途绑定未变。

## 参数支持

V77 新增可空列 `ai_model_providers.chat_reasoning_effort`。管理端点 API 读写字段为 `chatReasoningEffort`，业务实际请求字段为 `reasoning_effort`。普通聊天、流式收齐和编导 turn 共用请求构造；业务 options 不能覆盖这个端点的固定设置。未配置的端点不发送参数。

PUT 省略保持原值，空字符串清空；更换供应商类型、地址或固定型号且没有显式重设时清空，防止将旧型号的验证结论套用到新型号。只校验标准枚举，不声称所有供应商支持全部级别。low 不等于关闭思考。

## 验证

- Mac mini 队列执行全 workspace 串行 typecheck、admin typecheck、API 契约检查，均通过。
- 70 条相关后端回归全部通过，包括两条实际 HTTP 流式路径的参数与用量观测、完整原文保留、固定型号约束、管理端保存/清空/换型号，以及迁移对新库与旧表的行为。
- 生产构建在 Mini 的干净 main 快照完成。按 devq 约定排除环境文件，通过 sparse checkout 保持源码检出干净；本机既有两份告警文档修改保留原状。发布脚本的 package 阶段按既有约定跳过测试，前述回归与下述完整 CI 独立执行，没有以打包代替测试。
- [完整 CI 42402650300](https://github.com/pokocat/AIStarEcosystem/actions/runs/42402650300)：同一 main 提交，后端完整测试与打包、前端测试、六个应用构建与浏览器检查共 8 个 job 全部成功。
- 线上页面的创作助手模型选择器实际显示 **sun5.5 · 默认**。

## 一次真实业务调用

复用本聊天自己的合成商品图和测试草稿 `IPP-9dc5bff3`，通过生产 AI 编导提交修改要求，生成 15 秒、6 镜头的便携水杯脚本，没有生成视频。原版脚本仍在画布，新版另存为「视频脚本 · 修改」。

最初旧页面因画布版本过期在保存阶段被拦截，没有新增 run、模型用量记录或扣费；刷新后才成功受理下列唯一一次模型调用，没有重试付费调用。

| 项目 | 结果 |
|---|---|
| 页面提交 | 2026-11-07 10:50:02.993 PST（18:50:02.993 UTC） |
| Run | `IPR-270735ddfecc451982e2` |
| 追踪号 | `aic-5b0d71a2-c5c4-49` |
| 用量记录 | `aiu-2d1467da-b5ec-45` |
| 实际型号 | `claude-sonnet-5-5` |
| 记录中的实际请求参数 | `reasoning_effort: low` |
| 用量记录耗时 | **39.873 秒** |
| 整体 run | 18:50:03.456–18:50:43.528 UTC，终态 `done` |
| 供应商回报输入 / 输出 Token | 52722 / 4096 |
| 完成原因 | `stop`，无错误码 |
| 原文 | 合法 JSON，完整 2207 字符已保存于既有 `preservedContent`；正文 2002 字符、6 镜头 |
| 结算 | 账本 SPEND 16 积分；冻结 110、释放 94，hold 为 RELEASED、剩余 0 |

该追踪号只有一条成功用量记录。脚本识别了绿色杯身、黄色杯盖和数字 7，六镜头覆盖 0–15 秒；原版关于开盖方向的写法仍被沿用，本次没有替用户改写模型结果。它是带原剧本上下文的修改请求，不能与此前小输入基准的 28.9 秒直接作同正文性能比较。

本地补充证据（生成制品不提交）：`dist/diagnostics/effort-20261107/sun55-online-observation.json`、`sun55-online-response.txt`、`sun55-runtime-verification.jsonl`、`sun55-script-ui.png`、`sun55-model-ui.png`。

## 回滚资料

生产机 `/opt/ai-star-eco/backups/20261107-sun55-low/` 内保留切换前完整端点 SQL 和仅回退本次配置字段的 `rollback-config.sql`，目录 0700、文件 0600，未下载密钥。上一版后端制品仍在 `/opt/ai-star-eco/releases/20261107-empty-output-7c445915/`。V77 是可空附加列，旧版本可忽略；回滚代码前应先清空 effort 并恢复原端点配置。
