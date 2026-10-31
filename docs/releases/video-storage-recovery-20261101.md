# 视频成片补存与等待超时修复

时间均为北京时间。故障告警发生于 2026-10-31，补存与修复验收于 2026-11-01。

## 排查与恢复

检查最近 7 天的 99 笔视频任务及服务日志，并检查全部 312 笔历史视频任务的成功产物地址。恢复前共有 236 笔成功记录，其中 233 笔已在我方 OSS，3 笔仅存 OneToken 临时地址。最近 7 天另有 7 笔 H3 轮询超时记录，均已自动成功、存入 OSS，原冻结 COMMITTED，无需重提或补扣。

3 笔 OneToken 任务均已受理并生成成功；转存下载发生 `Received RST_STREAM: Internal error` 后，旧 worker 保留厂商临时地址并结算，Studio 投影因缺少我方存储 key 显示交付失败。缺少 `require_mirror` 标记使这批 Studio 任务误走了旧业务的外链回退规则。

| 原任务 | 恢复文件大小 | SHA256 |
| --- | ---: | --- |
| `mvj_267af7d3cf7e` | 8441106 | `5d2f2226fb0a6fac9ff203da3b0cab8900379e7a55021c5ef6ec08c9861f5599` |
| `mvj_b2493c2c2816` | 8251039 | `f7ca1b0b144965c104f25bdece7cdac64bdfb45b6517b3765c24a45c7396e17b` |
| `mvj_f554776432b9` | 8117828 | `f008affb21f86dfbe87dd44e6a76e88f4bcc2daa7ae8b862294fe606e1289839` |

只读取原视频地址，过期时只 GET 原供应商任务换取可用成片地址；未发起任何生成请求。三条媒体均为 720×1280、H.264 + AAC、11.071995 秒。媒体经 ffprobe 检查后，以 Content-MD5 校验上传，并从 OSS 完整读回比较 SHA256。上传依据 [OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject) 的完整性校验约定。

最终 key 均为 `media/material-videos/{原任务ID}/video.mp4`，更新任务成片地址并按既有规则登记 `studio / 素材视频` 存储占用。未改客户端拥有的画布文档、原完成时间、积分冻结或账本。三笔各有一次 FREEZE、一次 SPEND，金额各 1331，hold 均 COMMITTED / remaining=0。

生产真实 `/api/v1/ip-studio/runs/{id}` 接口已逐笔核验：HTTP 200、run 与 candidate 均 done / 100%，回传我方 storageKey；对应签名视频 Range 请求全部 HTTP 206，内容为 MP4。验收只用内存中的 60 秒本人只读令牌，未持久化令牌。

恢复前记录、原成片、ffprobe 和 SHA256 结果保存在服务器 root-only `/opt/ai-star-eco/backups/video-storage-recovery-20261031/{任务ID}/`。供应商签名地址与凭据不进入仓库。

## 修复行为

- 单轮视频等待上限默认由 600 秒增至 1800 秒（30 分钟）。超时仍保留原供应商任务和冻结，后台继续查原任务。
- 媒体 GET 使用 HTTP/1.1，下载失败最多尝试三次，每次清理不完整文件；重试不提交生成。
- Studio 由 `app=ipstudio` 强制要求镜像，覆盖没有旧标记的历史活跃任务；新任务也写入 `require_mirror=true`。
- Studio 暂时镜像失败时继续恢复原任务，未交付前不结算，不提前释放原冻结。其余产品原有失败/退款语义保持。
- 已成功但仍存外链的任务可以通过现有管理端 reconcile 补存；不修改原扣费、冻结额和完成时间。已有我方 key 的任务幂等返回。

## 发布基线与范围

发布前线上 JAR SHA256 为 `0429becb9990f7d75701fa604ab3247553b391e3192c1a944d738d8440333429`，与 `20261031-studio-redesign` 归档一致，对应 main `9902d4f6314a806adb86e618909783f25bdda51a`。该版本至本次主线的 DTO / OpenAPI 没有变更，本次不改数据库 schema、接口字段或前端制品。

修复先进入 main，再从干净 main 构建 server。实际构建提交、制品校验和及发布后的验收追加于下方。
