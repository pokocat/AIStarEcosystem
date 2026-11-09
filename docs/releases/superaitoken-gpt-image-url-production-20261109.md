# GPT Image 切换 SuperAIToken 与 URL 返回 · 2026-11-09

## 变更

线上已有四个 GPT Image 接入点保留 ID、模型系列、用户选择与售价，供应商切换为 `https://superaitoken.ai/v1`，Key 只经签名管理命令交给服务端加密保存。

| 端点 | 精确供应商型号 | 参考图协议 |
|---|---|---|
| `ai-abadd123-a06` | `gpt-image-2-1k-pic` | multipart `image[]` / edits |
| `ai-7398056d-6cf` | `gpt-image-2-4k-pic` | multipart `image[]` / edits |
| `ai-c120fb1f-769` | `gpt-image-2.5-flare-1k` | multipart `image[]` / edits |
| `ai-41444f1b-60a` | `gpt-image-2.5-flare-4k` | multipart `image[]` / edits |

各尺寸的 `response_format` 改为 `url`，`wire.resultMode=sync-url`、`outputPointer=/data/0/url`，请求体型号从 `${model}` 取，不再硬编码通用型号。未增建 Sunburst 或更换 Seedream / ERNIE / FLUX 等其他模型。新 Key 的目录中包含全部四个对应型号。

最终四个 GPT 接入点统一使用原生参考图编辑协议：有参考图时 multipart `image[]` 到 `/images/edits`，无参考图时 JSON 到 `/images/generations`，不再在文生图请求里放 `images`。上线首轮真实任务 `IPR-57603fca` 曾以旧 JSON 参考图协议被明确拒绝：HTTP 400 `unexpected_image_input`，供应商原文“当前生图模式不接受参考图或蒙版，请使用图片编辑接口”；cost=0。发布前的 JSON 实测虽然曾返回图片，但不能据此认定参考图正确生效，此次以生产实际拒绝为准校正。

分镜继续按作品画幅生成；GPT Image 2 的 1K/2K 接入点恢复实测通过的 1152×2048，默认竖屏分镜使用该接入点和原有 16 积分，不再因缺少尺寸升到 4K / 55 积分。资产图的比例和用户显式选择保持原规则。

按用户要求，供应商图片结果下载不再按域名、HTTPS、网络地址或端口拦截，支持重定向，下载过程中不发供应商 Key；媒体有效性、大小和超时检查保留。参考图输入校验不变。仅需部署 server；端点随后通过现有签名管理 API 切换，前端无需重发。

## 发布前真实供应商验证

- 原分镜提示词和四张参考图，GPT Image 2 1K/2K、1152×2048：HTTP 200，URL 返回约 29 秒，下载原图尺寸完全一致。
- GPT Image 2.5 1K/2K：保留 multipart 编辑协议、原提示词和四张参考图，HTTP 200，约 86 秒，URL 下载原图 1152×2048。该型号返回 HTTP 地址及非标准端口，促成本次结果下载兼容调整。
- GPT Image 2 4K：原提示词、四张参考图、JSON generations，HTTP 200，约 23 秒，URL 下载原图 2160×3840。
- GPT Image 2.5 4K：原提示词、四张参考图、multipart edits，HTTP 200，约 90 秒，URL 下载原图 2160×3840。
- 原始供应商响应和图片只保存在本地私有验收目录，不提交用户作品或图片到 Git。

## 发布与线上验收

Mac mini 队列检查 `dafec904e7f1` 退出 0：全工作区类型检查（串行）、后台类型检查、Java 离线编译、API 契约检查通过；`JusuanImageClientTest` 36 项、`DirectorImageModelTest` 18 项全部通过，失败 / 错误 / 跳过均为 0；配置迁移的 4 项 Python 测试通过。覆盖返回 URL 的跨域 / HTTP / 非标准端口、重定向且不携 Key，以及三种作品画幅继续使用 2K 接入点和原价。首次测试中的一处 Mockito 嵌套 stub 已修正后全链重新检查。

参考图协议校正后，`c2b739561d40` 重跑上述全部检查退出 0。GitHub PR #176 的前端分片还暴露了既有视频页测试的异步断言竞态：首次受理响应只有 script 步骤，随后轮询才带 assemble，测试却立即同步查询“导出成片”。改为等待该轮询结果，未改生产前端代码；Mini `525a39781e58` 的该文件 16 项测试全部通过。

待完成 main 合入、检查、生产制品部署、配置备份与线上验收后补充 SHA、发布号和结果。
