# 导演台上架 Seedance 2.0 / 2.5（生产配置，2026-10-29）

## 结论

- 导演台的视频模型下拉现在包含 MiniMax H3、Seedance 2.0、Seedance 2.5，H3 仍为默认。
- 只改了线上两条端点的视频请求规格（`ai_model_providers.video_request_spec_json`），没有换服务端或前端制品、没有迁移、没有重启。
- 没有发起付费视频生成。Seedance 在全能参考下的真实出片效果、耗时和结算要等第一次实际生成来验证（见 TODO.md「AI 导演台」段）。

## 为什么之前看不到

两条 Seedance 端点（`ai-98b369eb-b59`、`ai-onetoken-seedance25`）早已启用、开放给 Studio、在 Studio 视频分组里，画布上一直能选。导演台只收两类模型（`DirectorService.videoChoices`）：

1. 规格里有 `universal_reference_video`（全能参考）模式的，分镜图作图 1、资产图和角色声音一起交给模型；
2. 没有保存视频规格、走旧首帧路径的（`MaterialVideoModelClient.supportsLegacyFirstFrame`）。

Seedance 的规格只登记了 `t2v` / `i2v`，两类都不算，所以被过滤掉。seedance 适配器本身已经支持全能参考（`buildSubmitBody` 的 seedance 分支按 `content[]` 发 `reference_image` / `reference_audio`，单测 `configuredSeedanceSupportsNativeStudioModesAndReferenceWire`），缺的只是规格登记。

## 改动

两条端点的规格在原有 `t2v`、`i2v` 之后追加一个模式，其余字段不变：

| 项 | 取值 |
|---|---|
| 模式 | `universal_reference_video` |
| 参考图 | 最多 9 张，JPEG / PNG / WEBP，单张 ≤ 30 MiB |
| 参考视频 | **0**（不开放：导演台不用，且供应商带视频输入的计价未核实） |
| 参考音频 | 最多 3 段，WAV / MP3，单段 2–15 秒、≤ 15 MiB，合计 ≤ 15 秒 |
| 素材总数 | ≤ 12，至少 1 个图片 |
| 清晰度 / 画幅 | 沿用原规格：720p，16:9、9:16（不含 1:1） |
| 时长 | 沿用原规格：4–15 秒 |

上线前用服务端自己的 `AiVideoRequestSpec.read` 校验了新规格，并用 `MaterialVideoModelClient.buildSubmitBody` 模拟了导演台的典型请求（720p · 9:16 · 分镜图 + 资产图 + 一段声音），请求体为：

```json
{"model":"seedance-2.0","resolution":"720p","content":[{"type":"text","text":"…"},
 {"type":"image_url","image_url":{"url":"<签名地址>"},"role":"reference_image"},
 {"type":"image_url","image_url":{"url":"<签名地址>"},"role":"reference_image"},
 {"type":"audio_url","audio_url":{"url":"<签名地址>"},"role":"reference_audio"}],
 "ratio":"9:16","duration":12}
```

## 计价

共享价表 `celebrity.video-studio-pricing` 的 `universal_reference_video.720p` 为空，按规则回落到各模型候选售价：Seedance 2.0 **94 积分/秒**、Seedance 2.5 **146 积分/秒**（与 t2v / i2v 同价，参考图不另收费）。OneToken 的 720p 采购价按清晰度定、不分模式（见 `docs/runbooks/cost-pricing-feishu.md`），所以沿用 2026-10-26 的「采购成本加价 60%」口径。

## 影响范围

- 导演台：选 Seedance 时按全能参考出片（一段多镜头、带分镜图和声音参考），时长上限 15 秒。
- Studio 画布：Seedance 节点的生成模式也多出「全能参考」一项，同样只能用图片和音频参考。
- 已知限制：作品画幅是 1:1 时选 Seedance 会被明确拒绝（「不支持 1:1 画幅，请在设置中更换画幅或模型」）；角色声音样本是 M4A 时，提交前会提示格式不支持（Seedance 只登记了 WAV / MP3）。

## 验收

- 回读线上两条端点：`enabled=1`，模式为 `["t2v", "i2v", "universal_reference_video"]`，回读 JSON 与上线内容一致并能被 `AiVideoRequestSpec.read` 解析。
- 改动后线上服务 `aistareco-server` 无 ERROR / WARN（日志 grep 先在近 24 小时上自检能命中）。
- 未登录线上导演台查看下拉，未发起付费生成。

## 回滚

改动前的两条端点规格和相关平台配置备份在生产服务器 root-only 目录：

`/opt/ai-star-eco/backups/seedance-director-reference-20261029T114004Z`

回滚即把 `ai_model_providers.before.tsv` 里两条 `video_request_spec_json` 写回原值（只删掉 `universal_reference_video` 这一模式）。
