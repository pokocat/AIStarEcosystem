# 出图并发、排队卡住和导演台默认模型发布（2026-11-05）

只发 `server`（发布号 `20261105-image-queue-concurrency`），从干净的 main `309a3062f` 在仓外工作区构建。无数据库迁移。

## 上线内容

起因：导演台批量出图时最后 3 张排了 47 分钟，重启后才开始。原因和改法见 [ai-endpoint-generation-queue.md](../ai-endpoint-generation-queue.md) 末两节。

- Studio 工作线程从 3 个扩到 24 个。
- 图片调用加了管到正文收完的总时限，线程不会一直被占住。
- 线程全忙时，分发器不再把同一张票反复塞进线程池。
- 提交时收到 429，或错误内容明确说并发、限流、过载，任务回到队列，冻结的积分不动，退避后用新的请求号重交，等满 30 分钟按 `STUDIO_IMAGE_PROVIDER_BUSY` 失败并退积分。只做了图片。
- 导演台可以单独设默认图片模型。

## 同时改的线上配置

发布后用签名命令改的，备份在生产机 `/opt/ai-star-eco/backups/20261105-image-queue-config-20261105T123211Z/`。

| 配置 | 改前 | 改后 |
|---|---|---|
| GPT Image 2.5 1K/2K、2.5 4K、GPT Image 2、2 4K 的并发上限 | 5 | 10 |
| GPT Image 2.5 1K/2K、2.5 4K 的请求超时 | 600 秒 | 900 秒 |
| 导演台默认图片模型（`ai.scene-default.studio.director-image`） | 没有，跟随 Studio 默认 | GPT Image 2（`ai-abadd123-a06`） |

Studio 图片默认仍是 GPT Image 2.5（`ai-c120fb1f-769`）。导演台里没选过模型的作品改用 GPT Image 2，每张从 37 积分变 16 积分；明确选过模型的不变。画布和 AI 图片共用默认，继续用 2.5。

## 窗口与验收

- 发布前查过线上，没有在途的图片、文字、视频任务。
- 20:31:04 重启。502 从 20:31:04 到 20:31:20，共 8 个：6 个 `/api/config`（部署探测）、2 个 `/api/me/wallet`。重启后 0 条 ERROR，`dispatch deferred` 0 条。
- `verify.sh` 全绿。线上 JAR 校验和与构建产物一致（`408f64d3…`）。
- 配置核对：4 个接入点并发都是 10，2.5 两个接入点超时 900 秒，导演台默认已写入，Studio 默认未变。

## 没有验证的

- **真实并发上限没有压测。** 10 是用户定的值，供应商能否同时接 10 个、2.5 会不会更慢，要看上线后的数据。
- **并发拒绝没有真实样本。** 线上 14 天的图片调用没有出现过这类拒绝，判断依据是 429 和常见写法，只测过模拟响应。第一次真遇到时看日志 `[ipstudio] 生成服务因并发拒收`。
- 线上没有实际生成，也没有在页面上打开导演台确认默认模型。
- 服务端跑了 `ipstudio`、`service`、`platform` 三个包 2559 个测试，1 个失败：`MaterialAiE2ETest.aiDraft_invokeFails_surfacesCallError` 期望报错里有「API Key」，现在的报错不提它。这是文案断言，不走这次改的代码，判断是旧问题，没有在 main 上复跑确认。没有跑全量。

## 回滚

- 代码：回到 `20261105-scene-skill-slots`（只回 server）。回滚后导演台的默认模型配置不再被读取，会跟随 Studio 默认（2.5）。
- 配置：并发和超时用 `endpointSave` 改回；导演台默认没有删除命令，用 `directorImageDefaultSave` 改成想要的模型，或在后台平台配置里删除这个键。
