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
- 原生协议校正后补测 GPT Image 2 4K：同一提示词和四张参考图、multipart edits、URL 返回，HTTP 200，约 101 秒，原图 2160×3840。结合下面生产 2K 原片段的真实闭环，四个已发布型号均已通过原生参考图编辑和 URL 下载验证。
- 原始供应商响应和图片只保存在本地私有验收目录，不提交用户作品或图片到 Git。

## 发布与线上验收

Mac mini 队列检查 `dafec904e7f1` 退出 0：全工作区类型检查（串行）、后台类型检查、Java 离线编译、API 契约检查通过；`JusuanImageClientTest` 36 项、`DirectorImageModelTest` 18 项全部通过，失败 / 错误 / 跳过均为 0；配置迁移的 4 项 Python 测试通过。覆盖返回 URL 的跨域 / HTTP / 非标准端口、重定向且不携 Key，以及三种作品画幅继续使用 2K 接入点和原价。首次测试中的一处 Mockito 嵌套 stub 已修正后全链重新检查。

参考图协议校正后，`c2b739561d40` 重跑上述全部检查退出 0。GitHub PR #176 的前端分片还暴露了既有视频页测试的异步断言竞态：首次受理响应只有 script 步骤，随后轮询才带 assemble，测试却立即同步查询“导出成片”。改为等待该轮询结果，未改生产前端代码；Mini `525a39781e58` 的该文件 16 项测试全部通过。

## 已发布制品与配置

- [PR #176](https://github.com/pokocat/AIStarEcosystem/pull/176) 的下载器代码合入 main `f67a83b9406c609acc3ff2eed4a0baa9a08f2de4`，从此干净主线检出在 Mini 构建，任务 `c2f7db19a1b0` 退出 0。发布号 `20261109-superaitoken-images-f67a83b9`，范围仅 `server`。
- 新运行 JAR SHA256：`3224e6257ef680fbaf8cd538037464a983a93258f5c76a1a3de9b20bb7159dac`，与生产运行目录校验一致。打包脚本使用 `-DskipTests clean package`，前述独立测试与编译门已通过，打包不替代测试。
- [PR #177](https://github.com/pokocat/AIStarEcosystem/pull/177) 校正参考图协议，合入 main `b8e695d227b22e1ce5d9b3556147db821cc1f1bc` 后通过签名配置接口发布。相对 `f67a83b9` 无生产 Java / 前端代码变化，无需再次重启。最终 PR 的全部 29 项 GitHub 检查通过。
- 四个已存端点分别用服务端解密后的 Key 执行只读模型目录探测，全部 HTTP 200、6 个可用型号；全部四个精确型号均可见。配置回读一致，场景开放范围及售价配置与切换前相同。
- 生产 `/api/config`、Studio 首页 / 登录 / 项目页及 admin 入口返回 200，`verify.sh` ALL GREEN，服务与 nginx 检查通过。发布前账号中心 discovery 为 200，重启前无活跃图片任务。

## 生产真实分镜闭环

任务 `IPR-4b43497a`，保留原故障任务 `IPR-c91504ce` 的完整用户提示词和同顺序四张参考图，逐项比对均相同。最终使用 `gpt-image-2-1k-pic`、multipart `/images/edits`、`response_format=url`、1152×2048，供应商返回 200。

结果地址是 HTTP + 非标准端口；后端成功下载并镜像到我方 OSS，原图实际 1152×2048。任务于北京时间 **2026-11-09 11:21:54** 进入 `done`，前端显示第 1 版分镜图且自然尺寸一致。只生成该片段一张，没有触发视频生成或改写提示词。

积分核验：一笔 16 积分冻结、一笔 16 积分 SPEND，hold 为 COMMITTED、remaining=0；失败的旧 JSON 测试 cost=0。账号可用积分从 240 变为 224，无重复结算。验收后已显式退出临时附身会话。

线上成功截图和原图证据位于本工作区私有验收目录 `docs/releases/evidence/director-gpt2-board-20261108/`，未提交到 Git。

## 回滚与备份

原运行 JAR 及原密文端点配置保存在生产主机 `/opt/ai-star-eco/backups/20261109-superaitoken-images-f67a83b9/`，目录私有。`server-before.jar` 的 SHA256 为 `3f5f8a6dcc043742d365f683ba529bb81f4c8fd6d662dd5ba6e421aa4eb4daf9`。

原 OneToken 配置及定向回滚 SQL 在 `endpoints/`；原生编辑校正前的 SuperAIToken 配置另保存在 `native-reference-endpoints-b8e695d2/`。回滚 SQL 仅恢复对应端点的名称、地址、型号、密文 Key 和图片规格，不能覆盖用户作品、场景售价或账本。若退回旧下载器，须配套恢复旧端点配置；不可保留会返回 HTTP URL 的新渠道却恢复旧下载限制。全部备份不含新 Key 明文。
