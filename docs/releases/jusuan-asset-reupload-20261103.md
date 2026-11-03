# 聚算素材内容作废后重传修复（2026-11-03）

- 发布：`20261103-jusuan-asset-reupload`，仅 server，构建自 main `0d1e2c483`（线上上一版 `f7e58a31b` 之后 main 只有一条文档提交，无契约改动）。
- 重启前确认无在途 `ip_run`、无未结束的 `material_video_job`。启动 18 秒，Flyway 74 个迁移无新迁移，重启后 0 条 ERROR，`verify.sh` ALL GREEN。

## 现象

AI 导演台片段视频（H3，用户 `2f69d52b…`，任务 `mvj_a0d4f1858734`，追查号 `Y9CQWV5V9LEA`）报「图1上传失败（上游 409）」。聚算原话：
`input_asset_binding_conflict`「input asset is unavailable; reupload does not restore expired or deleted assets」。

## 原因

聚算 `/assets/input` 按内容认素材（响应里的 `reused`）。同一张分镜图之前传过，那份素材过期或被删后，再传同样的字节一律 409，重试多少次都一样。

## 修复

- `InputAssetCopy`：只在 409 `input_asset_binding_conflict` 时，按容器规范加一段不影响画面 / 声音的标记（PNG tEXt、JPEG 注释段、MP4 / MOV / M4A 末尾 free 盒子、WAV 自定义块）换一份新内容，重传一次；其它格式或仍被拒照常报错。
- `DirectorService.pollVideos`：任务刚在独立事务里建好、外层快照还读不到时当作在跑，不再空指针（同一请求 20:14:01 的 500）。
- 测试：`InputAssetCopyTest`（真 PNG / JPEG 解码像素不变）、`MaterialVideoModelClientWireTest` 两条（409 一次后重传成功 / 一直 409 只多传一次）。

## 扣费

视频冻结 434 积分已在失败时全额退回。用户实际被扣的是提示词优化 10 积分（`IPR-1a137de64fbc4ce0ac0a`，按真实用量结算）。

## 未验证

没有用真实素材在线上重放上传；等用户下次点生成时看日志 `素材内容已被厂商作废，换一份新内容重传`。MP3 / WebP 等格式遇到同样的 409 仍会失败。
