# Seedance 2.0 三条开放参考视频（2026-11-12，线上配置）

用户要求：火山方舟 Seedance 2.0 Fast / Mini、OneToken Seedance 2.0 都开放参考视频，让爆款复刻的深度复刻、元素替换能选这几个模型；价格先按现有的普通价算。

## 改了什么

- 三条端点（`ai-1fb0d9ce-d74` Fast、`ai-d91e6ae3-6df` Mini、`ai-98b369eb-b59` OneToken 2.0）视频规格里全能参考模式的参考视频，从 `maxCount: 0` 改成与 OneToken Seedance 2.5 相同：最多 3 段、单段 2–15 秒、MP4、≤50 MB。
- 只改了这一项，其余规格、素材库（方舟 `ark-bingbing`、OneToken `onetoken-main`）、限额、价格、候选都没动。
- 入口：签名命令 `endpointSave`（带 id，只传 `videoRequestSpec`）。改前备份 `ai_model_providers`、`ai_app_endpoint_candidate` 到 `/opt/ai-star-eco/backups/seedance20-video-ref-20261112T000319Z`（时间为 UTC，目录名以服务器为准）。

## 价格

没有改。带参考视频的任务按原来的每秒售价算。方舟官方对「输入含视频」另有一档价，比不含视频贵，所以带参考视频的任务我们的成本会高于现在的售价，以后要按含视频的价重新核对（见 TODO）。

## 验收

- 线上 `GET /api/v1/ip-studio/studio/video-models`：五个视频模型（minimax-h3 1 段，其余四条 3 段）都声明了参考视频。
- 线上视频页「爆款复刻 · 元素替换」的模型下拉里出现 minimax-h3、Seedance 2.0、Seedance 2.5、Seedance 2.0 Fast、Seedance 2.0 Mini。
- 没有用这三条模型真实提交过带参考视频的任务。方舟两条：没在官方素材库登记过的参考视频按签名地址交给厂商，和参考图一样，原片里有真人时可能被厂商的人像审核拒绝。

## 回滚

三条端点各发一次 `endpointSave`，把全能参考模式的 `references.video` 改回 `maxCount: 0`、`minDurationSec` / `maxDurationSec` 为 null；或从上面的备份恢复这三行的 `video_request_spec_json`。
