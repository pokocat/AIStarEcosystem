# 发布：导演台 H3 分镜图固定为完全保留（20261101-director-h3-storyboard）

2026-11-01，Asia/Shanghai。用户确认「发 server」，只发 server。

## 内容

- 导演台优化稿里，分镜图（图1）的保留关系被模型标成部分保留 / 属性迁移 / 只取大致相似时，校验改回 `fully_preserved` 并只记一笔说明；画布不改（`H3PromptRewrite.validate`，meta `storyboardPicture`，main `8af7ec7bf`）。
- 起因与本机重跑见 `docs/audits/director-h3-cl45-prompt-review-2026-10.md` §5。同一组修复的前两个提交已随 `20261101-studio-prompt-chips` 上线。

## 制品与范围

| 项 | 值 |
|---|---|
| 正式构建 | main `8af7ec7bfede1114484a535fd6915c6bc3d1f9c0`，仓外干净工作区 `../AIStarEcosystem-release-h3-storyboard`（detached 在该提交） |
| 服务 | server |
| 上一版 server | `20261101-studio-prompt-chips`（`1e0ae2b72`，JAR `1fa920e7…`） |
| 本版 server JAR SHA256 | `042fc48bd26dd25d985e30a0ef3efd20fe66e98811777be8495132c7915dc8e9`（线上一致） |
| 契约 | `git diff 1e0ae2b72 8af7ec7bf -- 'apps/server/**/dto/**' specs/openapi.yaml` 为空；server 代码只改 `H3PromptRewrite.java` |
| 迁移 | 无 |

## 发布前后

- 发布前查过两次：`ip_run` 没有排队或运行中的任务，`material_video_job` 没有未结束的任务。
- 10:17:16 重启，10:17:34 启动完成（17 秒）；公网每秒探测 `/api/config`，重启窗口 13 次 502，前后都是 200。
- 启动后 5 分钟内 `aistareco-server` 0 条 ERROR；`verify.sh` 全绿。
- 没有在线上点生成验证这条规则：要等有人在导演台生成 H3 视频时才会走到；本地 cl45 真实改写稿已验证（第 1 次那份 `weak_reference` 改回 `fully_preserved`）。

## 回滚

`deploy-release.sh` 指向生产机 `/opt/ai-star-eco/releases/20261101-studio-prompt-chips`，只回 server。
