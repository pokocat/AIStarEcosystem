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

正式构建提交、制品校验、配置备份、重启与线上验收结果在发布完成后追加。
