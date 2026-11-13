# 导演台人物设定图生产发布（2026-11-14）

用户反馈导演台用上传照片生成的人物设定图和本人对不上。这次发布改了三处：形象参考说明放到出图描述最前面，并以参考图为准；人物设定图只画五格，即全身正面、全身背面和头部正脸、左侧脸、右侧脸；GPT Image 2.5 的人物图改出 4K。方案、对比结论和回滚说明见 [AI 导演台方案](../ai-director-plan.md) 2026-11-14 一节。

- 应用提交为 main `6b9582d6f4f68006b6d24852d81cbc005ea65fe8`，接在另一会话已发布的 `03e056f69`（视频清晰度）之后。[Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43483569220) 28 项全部通过，包括后端三分片和 PostgreSQL 18 实库门禁，Flyway 仍为 V82，无迁移。提交前在 Mac mini 跑了 7 个测试类共 69 条定向测试，全部通过。CI 之后 main 只多了 `c11ced798` 一份发布记录，发布脚本核对过发布提交在远端 main 上，之后没有改应用文件。
- 发布范围为正式 API 和节点 A 的独立后台。导出进程不涉及这次改动，保持 `03e056f69`。制品 `27385795bd0e9ef2`，JAR SHA-256 `27385795bd0e9ef28bf4fbd8ba04680decdd5e1755643e1ba2cf3b31b7c6d687`，镜像配置 `sha256:406ed27a46197105cb5ae7c28fb1e9ae434b46278321e756e10a8d430eff8e54`，A/B 镜像归档 SHA-256 `934f2ad6f929d2d144a5bbd8ac8c8c8ae09fff1e3a60ac1242db9bdcf5bcb7f0` 一致。
- 北京时间 2026-11-14 02:56:47 API 切为 A100/B0。两个正式 VIP 均由 A 响应，就绪、发布探针账号鉴权、匿名 401 和普通账号访问后台 403 都通过。B 热备保留 `03e056f69` / `16f628aca5e90875`。A 的后台连续三次确认本机工作排空后换成新版，就绪通过，重启计数为 0，资源上限不变。发布后两机 API 和新版后台日志中没有错误，两机 SLS 采集进程均运行。
- 提示词库：`stage-director-asset-image` 当前为 v2，`stage-director-image-notes` 当前为 v3，都在新版启动时自动生成，来源为 seed。旧版本仍在库里，已采用的人物图按生成时记录的版本核对，不会被标成需更新。
- 发布前已单独修改线上配置：导演台默认图片模型 `ai.scene-default.studio.director-image` 从 `ai-abadd123-a06`（GPT Image 2）改为 `ai-c120fb1f-769`（GPT Image 2.5），发布后复查仍为 2.5。当时 53 部作品均跟随默认或已选 2.5，没有固定用 GPT Image 2 的。
- 效果依据：发布前用线上用户的参考图，在生产服务器上直接调用线上接入点对比。新提示词配 GPT Image 2.5 的 2K 和 4K 都像照片里的人，旧提示词和 GPT Image 2 都不像。GPT Image 2 的 4K 接入点被厂商关闭，返回 400 `four_k_disabled`，所以该系列人物图仍出 2K。发布后没有在线上页面提交付费出图，新版真实作品效果待用户使用后再看。
- 回退：API 切回 B 的 `16f628aca5e90875`；后台用 A 上保存的 `/opt/aistar-cluster/control/background-before-27385795bd0e9ef2.conf` 恢复。提示词库不跟着回退：旧版代码仍读当前的 v2/v3，参考说明会回到出图描述末尾。如果要完全恢复，在 Studio 后台「提示词与技能」把两条分别回滚到 v1、v2。默认图片模型按需用模型配置命令改回 `ai-abadd123-a06`。回执保存在本机 `/tmp/aistar-director-character-20261114.CQ5H6v/`。
