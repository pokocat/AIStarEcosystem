# Studio 聚算模型配置

2026-10-10，Studio 文本、图片、视频只使用聚算 JusuanHub。模型端点和选择范围继续由后端配置管理，浏览器不持有供应商密钥。短剧、带货与旧数字资产用途的全局默认绑定保持原值。

| 能力 | 开放方式 | 生产端点 | 售价 |
| --- | --- | --- | --- |
| 剧本、分镜、创作助手、剧本修改 | 固定 Qwen3.6 35B A3B，支持看图 | `ai-studio-jusuan-qwen36` | 沿用 2 积分/次 |
| 图片 | 默认 FLUX.2 Klein 4B；可选 LongCat 图片编辑、ERNIE Image | `ai-studio-jusuan-flux` / `ai-studio-jusuan-longcat` / `ai-studio-jusuan-ernie` | 30 积分/张 |
| 视频 | 仅开放已接通的 MiniMax H3 | `ai-jusuan-minimax-h3` | 沿用原价：768p 40 积分/秒、544p 20 积分/秒 |

聚算发布的其他视频服务各有专用入参，未作为通用文生/图生视频候选开放。视频服务列表保留选择机制，后续接通协议后可通过候选配置开放。

## 配置真值

- `ai_model_providers`：单个模型的接入端点，Studio 新端点统一 `https://api.jusuanhub.com/v1`，并发上限 2。复用已有平台 Account API Key 的加密值，不新增或暴露密钥。
- `ai_app_endpoint_candidate`：对应 `DAP_PERSONA`、`DAP_IMAGE` 的启用候选。视频仍复用 `VIDEO_GENERATION` 候选及原有价格。
- `ai.scene-policy.studio.script`：`mode=fixed`，仅含 Qwen3.6。
- `ai.scene-policy.studio.image`：`mode=selectable`，上述三个图片端点各 30 积分/张，默认 FLUX。
- `ipstudio.model-provider`：JSON 字符串 `"jusuan"`，限制 Studio 三类模型的供应商；按 HTTPS 的真实域名 `api.jusuanhub.com` 校验，名称中含 jusuan 不作为依据。

场景模型与售价可在模型运营的 Studio 场景中维护；供应商限制位于平台配置。未设置供应商限制的环境保留原有模型绑定。列表、生成提交、视频报价和模板制作计划均应用同一 Studio 范围。用户提交隐藏模型 ID、旧画布保存的其他供应商模型 ID，在冻结积分前被拒绝；不自动替换用户显式选定的模型。未传模型时使用 Studio 默认，并将实际端点保存到任务快照。

## 聚算图片协议

聚算 `/v1/services` 与 `/v1/models` 只读查询确认三个图片服务均可用，统一采用异步 Job。不能用原来的同步 OpenAI `data[0].url` 读取方式。

1. 本人参考图按原顺序上传 `/assets/input?model=...`，读取 `asset.assetId`，文件 MIME 按实际字节判断。
2. `/images/generations` 使用稳定 `Idempotency-Key=运行ID-image-候选序号` 提交。
3. `/jobs/{id}?model=...` 轮询 queued/running/终态，轮询更新我方心跳，模型端点并发槽在运行期间保持占用。
4. `/assets/{id}/content?model=...` 携带平台密钥下载，确认是图片后存入我方存储；沿用原来的每张成功结算、失败释放未消耗积分规则。上游任务 ID 记录在运行日志和成功用量记录中。

模型差异在冻结前校验：FLUX 提示词最多 500 字、参考图最多 5 张（当前画布通道整体上限 4 张）；LongCat 最多 1200 字、必须一张参考图；ERNIE 最多 2048 字、仅文生图。聚算使用用户原始生成指令，不拼接旧通道较长的英文提示词模板，也不截断用户指令。FLUX 将现有画布尺寸映射至供应商开放尺寸；LongCat 保持参考图画幅，ERNIE 使用对应方向的 720p 档位。

生成不做网络重提，输入上传失败不降级为文生图，任务失败/无图片不冒充完成。当前图片 worker 延续原运行的超时与重启失败释放策略，尚未增加跨进程恢复聚算图片 Job 的机制；同步轮询最大约 30 分钟。此限制不同于已经持久化恢复的配音/口型链。

## 验证

- 聚算账号只读服务发现，确认 Qwen3.6、FLUX、LongCat、ERNIE、H3 可用及请求契约；未产生付费生成。
- 8 个受影响后端测试类，合计 93 项通过，覆盖供应商域名伪装、场景白名单、非聚算提交扣费前拒绝、视频默认端点快照、图片参考资产上传顺序、稳定幂等键、异步轮询、受保护下载、原始提示词与结算。
- 提交前执行 workspace/admin typecheck、后端编译、API 契约门。
- 生产发布与配置验收结果补充在本文件末尾。

## 生产生效记录

- 代码已推送 `codex/unified-ip-studio`，后端运行提交 `8f4f4466a3edf0078c5ab9ef8836fa9747d39121`。
- 发布包 `20261010-studio-jusuan-8f4f4466` 只含 server，不重发前端或账号中心；前端继续使用已发布品牌版。
- 本地制品与远端 JAR SHA256 一致：`5cef60d8ae71e9c62984aa6924ae1c717352e195c1f60ae04adbf516546f6dee`。
- 2026-10-10 17:41 UTC 后端启动，`active`、`NRestarts=0`，Flyway 49 项验证通过；未新增迁移。
- 线上 `/api/v1/ip-studio/models` 验收：仅三个聚算图片候选，FLUX 为唯一默认、30 积分/张，参考图上限分别 4/1/0；视频仅 H3、40 积分/秒。
- 线上 `/studio/capabilities` 验收：文本模式 fixed，唯一 Qwen3.6、supportsVision=true、2 积分/次；图片模式 selectable。
- 线上 `/studio/video-models` 验收：仅 H3，保留四种原生模式、544p/768p 与原价格矩阵。
- 模型端点与配置通过受限 SSH 和后台配置 API 生效；三条配置带 `updatedBy=ops:studio-model-config`。全局默认绑定和 `celebrity.action-pricing` 前后逐字一致。
- 备份位于 `/opt/ai-star-eco/backups/studio-jusuan-models-20261010T174039Z`，目录 0700；旧 JAR、模型/候选/绑定/平台配置 SQL 均为 0600。敏感备份只保留在生产受限目录。
- `verify.sh` 全绿，首页/登录/创作/IP/模板及账号中心公开发现接口正常。未执行真实付费图片、文本或视频生成；异步图片端到端协议由模拟上游覆盖，上线接口与聚算服务发现使用真实请求验收。

本地只读接口证据：`.studio-e2e/jusuan-models/online-models.jsonl`；配置运维脚本位于同目录。制品、证据和脚本均不含明文密钥并且不入 Git。
