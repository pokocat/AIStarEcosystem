# Seedance 视频提交故障修复（2026-10-31）

## 原因与修复

北京时间 15:15–15:18，4 笔导演台全能参考视频提交被明确拒绝，没有产生上游任务 ID。

| 任务 | 原因 | 冻结积分 | 核实结算 |
| --- | --- | ---: | --- |
| `mvj_c7f1765bef84` | OneToken Seedance 2.5 不支持 `return_last_frame` | 1331 | RELEASED，FREEZE + UNFREEZE，无 SPEND |
| `mvj_005acdd3690b` | 同上 | 1331 | 同上 |
| `mvj_7fc0a921ee51` | OneToken Seedance 2.0 不支持 `return_last_frame` | 880 | 同上 |
| `mvj_4ce35c11f98b` | 火山 Seedance 2.0 Fast 将图 1–3 判为疑似真人素材，`InputImageSensitiveContentDetected.PrivacyInformation` | 660 | 同上 |

平台把 Seedance 原生可选的末帧输出参数用于了兼容网关；OneToken 两条生产端点的 `requestFields` 也显式配置了 `return_last_frame:true`。修复包括两部分：

- 已配置视频规格的 Seedance 端点只发送明确登记的附加字段，不再默认追加 `return_last_frame`；未配置规格的旧原生路径保持原行为。
- 生产仅移除 `ai-98b369eb-b59` / `ai-onetoken-seedance25` 的该附加字段，保留图片、音频参考、时长、清晰度、模型与计价配置。火山 Fast / Mini 保留其显式末帧输出配置。
- 真人参考图被拒绝时使用 `VIDEO_REFERENCE_PERSON_RESTRICTED` 和中文说明，要求更换参考图；原始响应、追踪号仍在后台诊断中保留。不会通过丢弃参考图、自动换模型或重复提交来绕过拒绝。

[火山官方说明](https://docs.volcengine.com/docs/ark/seedance-portrait-asset-guide?lang=en)确认，Seedance 2.0 系列不能直接上传含真人人脸的参考素材，已授权肖像等能力有独立接入路径。本次不扩展真人授权接入。

## 发布范围与验证

仅发布 server，无数据库迁移，无前端 DTO / 接口路径变更。发布前线上 JAR 对应 main `f3092980c`（`20261031-studio-assistant-fixes`），线上 SHA256 与该发布包一致；`release-id.txt` / `release-sha.txt` 仍是旧值，不用它们判断当前版本。

本地回归覆盖 OneToken 两条模型的请求实包（字段彻底缺席、首帧与九张参考图完整保留）、火山显式返回末帧、旧原生路径、真人错误中文说明及单次拒绝、worker 失败释放冻结。

本地 110 项相关测试通过（Wire 34、Body 16、Client 38、ErrorMapper 5、Worker 17）；`pnpm typecheck:all`、`pnpm typecheck:admin`、`./mvnw compile -q -o`、`pnpm check:api-contract` 全部通过。首次前端检查发现依赖未链接，按锁文件安装后重跑通过。

首次发布包 `20261031-seedance-submit-fix` 因本地 `target/classes` 留有旧分支的 `V66__material_video_input_asset.sql`，与现行 Java `V66__ip_run_json_capacity` 重号，Flyway 在执行迁移前拒绝启动。已立即恢复上一版 `20261031-studio-assistant-fixes` JAR；未关闭 Flyway 校验、未改迁移历史。构建脚本改为 `clean package`，重新从干净 main 构建。

## 正式发布与线上验收

| 项目 | 结果 |
| --- | --- |
| 正式构建 | 干净 main `3800cc769becc946933044003a2e89542718ebac`（修复代码 `2b90556d6`，清理构建产物 `3800cc769`） |
| 发布包 / 范围 | `20261031-seedance-submit-fix-clean`，仅 server |
| JAR SHA256 | `4b7db1fe240b2c131f8a436406447c9c18704dfc932197def1a9dea12ae43e84`，本地与线上一致 |
| 配置备份 | 生产 root-only `/opt/ai-star-eco/backups/seedance-submit-fix-20261031/ai_model_providers.before.jsonl`；只备份两条端点规格，不含 API Key |
| 配置变更 | 恰好更新两条 OneToken 端点；`requestFields` 移除 `return_last_frame`，火山 Fast / Mini 的 `true` 保留 |
| 制品迁移检查 | 正式 JAR 72 个迁移，重复版本 0，旧 `V66__material_video_input_asset.sql` 不在包内 |
| 生产启动 | 北京时间 15:30:19 重启、15:30:36 启动完成；PID 226913，NRestarts=0 |
| 数据库 | Flyway 成功校验 72 个迁移，`No migration necessary`；未更改 schema history |
| 线上制品探针 | 通过正式 JAR 的类加载器执行实际 `buildSubmitBody` 并合并当前 DB 的 requestFields：OneToken 两模型字段 ABSENT、火山 Fast / Mini 为 true；实际错误映射类返回 `VIDEO_REFERENCE_PERSON_RESTRICTED` 和中文原因 |
| 环境与路由 | env-check、verify ALL GREEN；首页、登录、`/api/config`、`/director`、模型后台入口 200；服务、MySQL、nginx、sau-service 健康 |
| 契约范围 | 线上基线 `f3092980c` 到正式 main 的 DTO / OpenAPI 没有改动，不需补发前端 |
| 用户任务 | 四笔原任务仍 failed / externalTaskId NULL；4202 积分全部 RELEASED，remaining=0，各只有一笔 FREEZE / UNFREEZE，无 SPEND；没有重提任何客户任务 |
| CI | 直接推 main，当前工作流不自动触发 push CI；未把本地检查冒充远端 CI |

## 独立厂商验证的范围

使用生产已保存的凭据在服务器内存解密，分别给 OneToken 2.0 / 2.5 提交一次 4 秒、720p、9:16 的蓝色陶瓷杯无人物文生视频。没有使用客户素材，没有创建客户业务任务或扣客户积分。请求不含 `return_last_frame`，两条均 HTTP 200 受理，发布时仍为 running；随后按用户要求继续查询原任务，**两条现已 succeeded，成片下载、完整音视频解码和抽帧核验全部通过**。

- 2.0：`sdn_982df3251b4c4f74bcd5565609a398bd`
- 2.5：`sdn_81e10f2134d747c9bb88ff2f896284f6`

### 同日成片终态验收

| 模型 | 受理 / 完成（北京时间） | 任务耗时（含排队） | 实际媒体 | 文件核验 |
| --- | --- | --- | --- | --- |
| OneToken Seedance 2.0 | 15:28:22 / 15:34:56 | 6 分 34 秒 | 720×1280，容器 4.062993 秒，视频 4.041667 秒，H.264 + AAC 双声道 44.1 kHz | HTTP 200 下载，2105664 bytes；完整解码 exit=0、无错误 |
| OneToken Seedance 2.5 | 15:28:25 / 15:36:26 | 8 分 01 秒 | 720×1280，容器 4.086009 秒，视频 4.016667 秒，H.264 + AAC 双声道 44.1 kHz | HTTP 200 下载，3022196 bytes；完整解码 exit=0、无错误 |

- 2.0 成片 SHA256：`d8fa03bbdf4154b7d25bf44d4de769a22dd974681c5e05168e6b6d8294630cfc`，完成文件核验时间 UTC 07:36:38。
- 2.5 成片 SHA256：`2e5832cf9707e83a37cd805f1735f60232b5656c2684e3e1fbde87baf170e2ad`，完成文件核验时间 UTC 07:37:20。
- 两条各抽取约 0.5 / 2 / 3.5 秒画面，人工查看均为木桌上的蓝色陶瓷杯，镜头逐步推近，与无人物测试文案一致。
- 证据保存在生产 root-only 备份目录的 `seedance-2.0/` / `seedance-2.5/`：`poll.json`、`video.mp4`、`ffprobe.json`、`validation.json`、`frames.jpg`。签名视频 URL 不写入仓库或报告。
- 本次验证范围是两条 4 秒、720p、9:16 无人物文生视频的厂商受理到成片链路；没有重提客户失败任务，没有新增生成请求，没有使用客户素材或扣客户积分；不将该结果扩大为真人参考图或平台完整业务链验收。

探针有独立幂等键；后续只查询原 ID，不重新提交。请求与状态保存在上述 root-only 备份目录各模型子目录，不含明文密钥。九张参考图保留和真人错误已通过本地请求实包 / 线上制品探针验证；没有在线上重放客户的九张参考图，也没有重新做真人授权接入。

## 发布窗口与回滚

首次错误包导致北京时间 15:27:45–15:29:08 服务不能就绪，已于 15:28:50 安装上一版 JAR 并重启恢复。正式干净包在 15:30:19–15:30:36 正常重启；nginx 在 15:27–15:30 窗口共 47 个 502（含发布探测，首个 15:27:44、末个 15:30:35）。不声称零中断。

上一版归档为 `/opt/ai-star-eco/releases/20261031-studio-assistant-fixes`，JAR SHA256 `82be706634ffac1df5446a6fa3ef37b9da16e16e695cbade1262efacb1cdd53d`。需要回滚时恢复该 JAR，端点规格按 root-only 备份仅回写对应两条记录；不动钱包、用户任务和其他模型配置。
