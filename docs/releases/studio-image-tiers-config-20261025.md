# Studio 图片分档配置 · 生产（2026-10-25）

用户要求：前台可选 GPT Image 2 / GPT Image 2.5，规格 1K / 2K / 4K，自动匹配供应商型号与价格。路由代码（`StudioImageModelRouting`，main `feb6e4e0` 已发布）不变，本次只改生产配置，没有发版、没有改钱包或账本。

## 用户决定

- 「GPT Image 2.5」= `gpt-image-2.5-flare` 系列；原版 `gpt-image-2.5` 不在 Studio 路由里，未接入。
- 售价按**旧积分**（线上钱包未迁移到 1 元 = 100 积分）：GPT Image 2 为 1K/2K 30、4K 40；GPT Image 2.5 为 1K/2K 35、4K 45。1K/2K 共用一个型号，系统里只能同价，与用户定价一致。
- 不做付费出图实测。生产仍是「尺寸不符即失败并退回积分」（`requireExactOutputSize=true`）；「只告警」那版改动在 codex `image-size-warning` 工作区，未提交未发布。
- 界面名改为「GPT Image 2 / GPT Image 2.5」：main `384fb9bb`，**未发布**。同日另一会话发布的 `20261025-model-grants` 构建于 `94afa651`，不含此提交；此后 main 相对线上 server 只多这一处代码改动。发版前前台仍显示 `gpt-image-2` / `gpt-image-2.5-flare`。

## 端点（CATech，`https://ai.aiprox.tech/v1`）

新端点由用户在后台新建并填写密钥（新密钥 `sk-...vH6b`，原端点仍用 `sk-...to46`）；AI 没有接触或写入密钥。用新端点存量密钥只读列模型，6 个图片型号均可见。

| 端点 | 型号 | 档位 | 尺寸 | 供应商成本 | 售价（旧积分/张） |
|---|---|---|---|---|---|
| `ai-abadd123-a06`（原有） | gpt-image-2-1k-pic | 1K / 2K | 原 14 个尺寸 | ¥0.0175/次 | 30 |
| `ai-7398056d-6cf` | gpt-image-2-4k-pic | 4K | 3840×2160、2160×3840 | ¥0.15/次 | 40 |
| `ai-c120fb1f-769` | gpt-image-2.5-flare-1k | 1K / 2K | 同原 14 个尺寸 | ¥0.09/次 | 35 |
| `ai-41444f1b-60a` | gpt-image-2.5-flare-4k | 4K | 3840×2160、2160×3840 | ¥0.17/次 | 45 |

4K 只开两个尺寸：供应商没给 4K 合法尺寸文档，且分档按长边 ≥ 3840 判定，16:9 / 9:16 最稳妥；方图等其他画幅需实测后再加。成本价来自用户提供的供应商控制台截图。

## 执行

经模型配置服务（`/api/service/model-management/v1/command`，短时签名，actor `claude-code-donis`）共 14 条命令，全部成功：3 个新端点写 `imageRequestSpec`（wire 与原端点相同）；4 个端点写供应商成本（`PER_CALL`，unitPriceMicros 17500 / 150000 / 90000 / 170000，仅记账，不影响用户扣费）；3 个新端点访问分类设为 image（范围仍为全部应用）；3 个新端点加入 `DAP_IMAGE` 候选（Studio，maxRefImages 16）；保存 `studio/image` 场景策略（selectable，默认仍为 `ai-abadd123-a06`，四个候选按上表定价，`per_image`）。

改前快照与每步返回：`/opt/ai-star-eco/backups/studio-image-tiers-20261025/`（`scenePolicies.json`、`endpoints.json`〔密钥仅打码〕、`modelAccessCatalog.json`、`candidates-DAP_IMAGE.json`、`step-1..14.json`）。回滚：用 `scenePolicies.json` 里的原策略（只有 `ai-abadd123-a06` 30 积分）重新保存场景策略，并停用三个新候选。

## 验收

- 后台回读：场景状态 `available`，四个候选都可用，价格与上表一致。
- 前台：用户登录态打开画布，页面自己请求的 `GET /api/v1/ip-studio/models` 返回两个系列 `studio-image:gpt-image-2`（`imageResolutionCosts` 1K 30 / 2K 30 / 4K 40）和 `studio-image:gpt-image-2.5-flare`（35 / 35 / 45），各 16 个尺寸（含两个 4K），视频列表不变。
- 未做：任何档位的真实出图、实际供应商返回尺寸、4K 下的结算。首单 4K 若供应商返回尺寸不符，会按现有规则失败并退回积分。
- 飞书成本表：M017–M030、M067–M070 的 AB/AD 已记回执，1195 条公式零错误。
