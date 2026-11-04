# 声音参考格式修复发布（2026-11-04）

- 发布：`20261104-voice-reference-format`，仅 server，构建自 main `12dc92a04`。无数据库迁移，前端未动。
- 上一版：`20261104-image-prompt-operator-template`（`e1605fd34`）。从那一版到本次，DTO 和 OpenAPI 没有改动，不需要补发前端。

## 现象

AI 视频页选 Seedance 2.0 Fast，带一段 M4A 声音样本生成时，弹窗报「参考素材的实际格式不符合所选用途」。同一账号、同一张画布（`IPP-dd5e12fc`）当天报了 7 次，时间在北京时间 15:01–15:02 和 21:12–21:19。全表只有这 7 条。这些请求都停在提交校验，没有建视频任务。

## 原因

资产库收的声音格式比视频模型多：H3 的格式表含 M4A，Seedance 的端点规格只有 WAV 和 MP3。`StudioAudioReference.prepare` 只在声音超过 14.9 秒时才转成 WAV，短音频原样送去校验，于是被拒。

核对过四份素材的文件头：两张 PNG 和一张 JPEG 都符合规则，只有声音是 M4A（AAC，9.856 秒）。

## 修复

- 不是 WAV 或 MP3 的声音，都转成 24 kHz 单声道 WAV 再交给模型，原文件不动。已是 WAV 或 MP3 且不超长的照旧用原文件。
- 转换失败时明确报错，不退回原文件，并写一条服务端日志（`[studio-audio-reference] prepare failed`）。
- 报错改为说明素材类型和模型接受的格式，例如「声音素材的格式当前模型不支持，请换成 WAV、MP3 格式」。

## 验证

- 视频与声音相关的后端测试 183 项，0 失败，3 项跳过。新增用例用真实生成的 M4A，按线上 Seedance 规则校验：转换前被拒，转换后通过。
- `check:api-contract` 通过。本次没有 TS 改动，发布前没有跑 `pnpm typecheck`。
- 用线上那段声音的副本在生产机临时目录试转：9.856 秒 AAC 转成 9.856 秒 WAV，临时文件已删除。这一步是按相同 ffmpeg 参数手动执行的，没有经过线上代码。
- 重启前确认没有进行中的 `ip_run` 和 `material_video_job`。
- 线上 JAR SHA256 `3d6403170ce1d02d538a5aad94e4a8450f7f971e7e880b483c2ca59fb44db8ae`，与本地一致；PID 1510957，`NRestarts=0`，北京时间 21:40:03 启动完成，Flyway 没有新迁移。
- 重启后 0 条 ERROR（同一条 grep 在之前 12 小时命中 23 条，确认能命中）。`verify.sh` ALL GREEN。
- 发布窗口有 9 个 502，时间为 21:39:45–21:40:02：5 个 `GET /api/config`，4 个读取画布对话（`IPP-01a350ca`）。不是零中断。

## 未验证

还没有真实出片：没有替用户重提任务，也没有调用 Seedance，所以 Seedance 对转换后 WAV 的实际处理和成片效果未确认。等用户下次生成时，看任务是否受理，以及转换失败日志有没有出现。

## 回滚

恢复生产机 releases 下 `20261104-image-prompt-operator-template` 的 server JAR。本次无迁移，只回 server 即可；回滚后短 M4A 会恢复原来的报错。
