# 火山方舟 Seedance 2.0 Fast / Mini 生产配置（2026-10-29）

## 结论

- 直连火山方舟（`https://ark.cn-beijing.volces.com/api/v3`）新增两条视频模型：Seedance 2.0 Fast、Seedance 2.0 Mini。画布和 AI 导演台的视频模型下拉里都能选，导演台按「全能参考」使用。
- 只向 `studio` 开放，不影响短剧、明星带货的视频生成。MiniMax H3 仍是默认，OneToken 的 Seedance 2.0 / 2.5 不变。
- 能力沿用已上线的 Seedance 协议与 OneToken 两条的规格：文生视频、首帧生视频、全能参考（参考图最多 9 张、参考音频最多 3 段且总长 ≤15 秒、不开放参考视频），720p，16:9 / 9:16，4–15 秒。
- 售价按 2026-10-26 用户为 Seedance 定的「采购成本加价 60%」：Fast 130 积分/秒，Mini 81 积分/秒。
- 只改生产模型配置，没有发布服务端或前端制品。

## 生效配置

| 产品模型 | 端点 ID | 供应商模型 ID | 供应商成本 | Studio 售价 |
|---|---|---|---:|---:|
| Seedance 2.0 Fast | `ai-1fb0d9ce-d74` | `doubao-seedance-2-0-fast-260128` | 807525 微元/秒 | 130 积分/秒 |
| Seedance 2.0 Mini | `ai-d91e6ae3-6df` | `doubao-seedance-2-0-mini-260615` | 501975 微元/秒 | 81 积分/秒 |

- 端点：`providerType=VOLCENGINE`，`billingMode=PER_SECOND`，`supplierBillingMode=PER_SECOND`；凭据为用户在对话里提供的方舟 API Key，经模型配置服务加密入库，未写入仓库、命令行或日志。
- 视频规格：`adapter=seedance`，提交 `/contents/generations/tasks`、查询 `/contents/generations/tasks/{id}`（接在基础地址后），`requestFields={"return_last_frame":true}`，`responseSpec.failed=["failed","expired","cancelled"]`（方舟超时任务回 `expired`，默认状态识别里没有它，会一直当成处理中直到等待超时）。
- 模型目录路径是 `/api/v3/models`，不是 `/models`：目录路径按站点根解析（`URI.resolve`），而提交、查询路径是接在基础地址后面的，两者口径不同。见 TODO。
- 开放范围：`categories=[video]`、`scope=selected`、`appCodes=[studio]`。候选：启用、`maxDurationSec=15`、`maxRefImages=1`，排序 32 / 33。
- Studio 视频组：`ai-jusuan-minimax-h3`（默认）、`ai-98b369eb-b59`、`ai-onetoken-seedance25`、`ai-1fb0d9ce-d74`、`ai-d91e6ae3-6df`。
- 共享视频矩阵未改：720p 格子仍为 `null`，回落各模型的候选售价。
- 写入方式：模型配置服务短时签名命令（actor `claude-code-donis`），端点先以停用状态建好，开放范围、能力、售价配完后再启用并加入视频组，中途用户看不到未定价的模型。

## 定价

方舟官方价（[模型价格](https://ark.volcengine.com/region:cn-beijing/docs/model-pricing)，480p / 720p，输入不含视频）：Fast 37 元/百万 tokens，Mini 23 元/百万 tokens。参考视频未开放，所以按「不含视频」计。

实测 4 秒 720p 计 87300 tokens = 1280×720×97 帧 ÷ 1024（24fps，比整秒多 1 帧）。按最短 4 秒折算每秒 21825 tokens，作为偏保守的单秒成本：

```text
Fast：21825 × 37 / 1e6 = ¥0.807525/秒 → ×1.6 ×100 = 129.2 → 130 积分/秒
Mini：21825 × 23 / 1e6 = ¥0.501975/秒 → ×1.6 ×100 = 80.3  → 81 积分/秒
```

15 秒的片每秒约 21660 tokens，成本略低，售价不变。

## 验收

供应商（用同一把 Key 直接调方舟，请求体与我方 Seedance 适配器组包一致）：

| 任务 | 模型 | 内容 | 结果 |
|---|---|---|---|
| `cgt-20261030003950-srbmw` | Mini | 文生视频，9:16 | 成功，720×1280，24fps，带 AAC 音轨，87300 tokens |
| `cgt-20261030003951-fm55t` | Fast | 全能参考：1 张参考图 + 1 段 base64 MP3 参考音频，16:9 | 成功，1280×720，87300 tokens |
| `cgt-20261030004225-b5mnc` | Mini | 全能参考：1 张参考图，16:9 | 成功，画面与参考图一致（同一只手与苹果、同样的果园光线），87300 tokens |

- 三条都在约 75 秒内完成，回包含 `content.video_url` 与 `content.last_frame_url`，与 `MaterialVideoModelClient` 的解析位置一致。三条共约 ¥7.6，计在方舟账号上，未经过平台积分。
- 模型配置服务回读：两条端点启用、按秒计费、售价 130 / 81，视频组包含两条新端点、默认仍为 H3；后台连接检测用保存的 Key 读方舟模型目录返回 200。
- 生产站登录态读取：`GET /api/v1/ip-studio/models` 列出 Seedance 2.0 Fast（130 积分/秒）与 Mini（81 积分/秒），4–15 秒、720p、16:9 / 9:16；导演台作品详情的 `videoModels` 列出两条，`mode=omni`、4–15 秒。
- 配置期间服务端 0 条 ERROR。

## 没有验证的

- 没有经平台发起付费生成：我方 worker 的提交、轮询、成片镜像与结算这一整条还没在这两个模型上跑过。线上的 Seedance 适配器此前也从未成功出片（2026-10-20 的三次都因 OneToken 下架模型被拒）。第一条真实生成要盯一下 `[material-video]` 日志。
- 参考音频只测了 base64，我方实际以签名地址交给方舟；音频是否按参考音色说话没有人工听。
- 提示词长度上限沿用 2000 字，未核实方舟的上限；导演台的长提示词若被拒，看厂商原话再调。
- 480p、其他画幅、首尾帧、参考视频都没开放。

## 回滚

改前四张配置表（`ai_model_providers`、`ai_app_endpoint_candidate`、`ai_app_binding`、`aep_platform_configs`）的整表备份：

`/opt/ai-star-eco/backups/ark-seedance-models-20261029T164515Z/model-config.sql`

只撤这两条：用模型配置服务把视频组存回 `["ai-jusuan-minimax-h3","ai-98b369eb-b59","ai-onetoken-seedance25"]`（默认 H3），再把两条端点 `enabled=false`。
