# AI 导演台文字积分展示修复（2026-10-26）

## 变更

- 导演台不再在生成剧本、AI 拆集、提取全剧资产、写分镜脚本等文字操作旁展示不确定的积分数字；企业付款选择只说明按实际用量结算。
- 图片、视频等可在提交前确定的报价保持原样。
- 文字任务仍按模型返回的真实输入／输出 Token 结算；受理冻结改为按各任务实际输出上限计算，而不是统一采用文本模型的全局输出上限。
- 一键制作的文字明细不展示积分数字，但服务端预算估算与后台连跑按剧本、拆集、资产提取、分镜脚本各自的输出上限计算。

## 验证与发布

- 代码已合入远端 `main`：`e563cdf838ebbbec81b9ca3dae7b2b27c7767cd7`。
- 从上述干净 `main` 提交构建并发布 `server,web-aiavatar`，发布编号 `20261026-director-text-credit-display`。
- 定向前端用例 5 项通过；`AiChatTokenPricingTest`、`StudioEnterpriseWorkflowTest`、`DirectorSplitTest` 通过；`typecheck:all`、`typecheck:admin`、离线后端编译与 API 契约检查通过。
- web-aiavatar 全量 1293 项中 1291 项通过；2 项既有测试因各自的 `@ai-star-eco/api-client` mock 缺 `publicModelErrorMessage` 失败，与本次导演台改动无关。
- 正式 JAR SHA-256：`81399ff74fad5037785082a19debb93e24e7449bbb076b1b476b8c27f46e4aeb`；web-aiavatar 制品 SHA-256：`4136fd562f6240c8456b2aa5b0e097b866ab1a624fd6cb2aa3607b414d4d6346`。本地、release store 与当前服务制品一致。
- 发布脚本健康检查 `ALL GREEN`；`aistareco-server`、`aistareco-web-aiavatar` 为 active；新服务启动后无 ERROR / Exception。
- `https://aiavatar.aibuzz.cn/director` 与 `/api/config` 均为 HTTP 200；线上静态包仍包含“提取全剧资产”入口，已不包含“约 275 积分”或“最多 275 积分”。
- 未提交真实文字任务，未产生模型调用或积分扣费。
