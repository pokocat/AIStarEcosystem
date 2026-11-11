# 爆款复刻检查第 2 版发布

发布号 `20261111-recreation-checks-e39e8776`，只发 server。构建提交是本地 main `e39e8776862e5772a059334fd71cff95e8fd752c`，内容如下：
- 合并了 `dev/recreation-check-review` 的两个提交：`2223a1fb6`、`c3e8043cf`；
- 带上了 origin/main 上的发布记录提交 `f292b3f42`。

发布时这个提交还没推到远端。

## 包含

- **成片检查看得见东西**
  - 按镜头抽帧，每个镜头取开头和结尾。
  - 带上这一步的参考图和提示词，要点改成代码写的逐镜是非题。
  - 参考图按文件内容判断，不是图片的那张不带。
- **重出带上问题**：检查不合格时，把「第N镜：……」这类修改意见接进下一版提示词。
- **开场画面先检查**
  - 出完先检查（步骤 `ck<镜号>`），不合格只重出这一张。
  - 报价放不下页面上限时，按名次省掉这些检查，日志记为 `optional checks dropped`。
- **认出推到头的画面**
  - 拉片后按每秒 30 帧的画面相似度，认出原片里重复剪进来的画面：某一镜推到头，就是后面某一镜的开场。
  - 写分镜脚本和检查时告诉模型「推到这里就是图N」，不多出图。
- **截开场画面的窗口收窄**：只在切镜后 0.12 秒内截，原来是 0.4 秒。
- **检查要点和重出说明放进提示词库**
  - 新增：`stage-recreation-keyframe-check`（第 2 版要点）、`stage-recreation-video-check`（第 2 版要点）、`stage-recreation-redo-note`。
  - 更新：`stage-recreation-compile`、`stage-video-breakdown`。
- 本机离线真跑的结果见 `docs/ip-studio-recreation.md`「真跑一条」。

## 构建

- **在哪构建**：Mac mini 的 devq 远程快照，由主工作目录同步，快照 HEAD 为 `e39e87768`。命令是 `build-release.sh server`。
- **校验和**：`app.jar` sha256 `a87187ef7409c4e0…`。
- **manifest 里的 `NEXT_PUBLIC_ENTERPRISE_ENABLED=0`**：只影响网页包，这次没发网页。
- **检查**
  - 在 Mac mini 上跑了 `typecheck:all`、`typecheck:admin`、`check:api-contract`，以及 17 个相关测试类，退出码 0。
  - 没跑全量测试，也没有 PR CI。
- **契约**
  - server：`CheckSettings` 加了两个可选字段，新增 record `CheckReference`。
  - 类型：检查步骤加了可选的 `optionalRank`；运行请求的 `check` 加了可选的 `sampling` / `references`。
  - 只增不改，网页不用跟着发。
- **迁移**：无，线上仍是 V81。

## 发布

- **基线**：server `20261110-official-avatars-3992f750`，jar `61c331c6…`。账号中心返回 200。
- **发布前的线上状态**
  - 没有在跑的生成任务：`ip_run`、`material_video_job` 都没有未结束的，最近一条任务建于 04:52。
  - 有两个页面在轮询任务，一个已完成，一个已取消。
- **部署过程**（2026-11-11，北京时间）
  - 07:45:31–07:46:34 运行 `deploy-release.sh`，退出码 0，env-check 和 verify 都是 ALL GREEN。
  - 07:46:28 启动完成，用时 17.4 秒。jar 校验和与构建一致。
- **提示词库**：线上这几条都只有仓库入库的版本，没人在后台改过，所以启动时自动更新了。
  - `stage-recreation-compile` 重新入库为库内第 3 版，`stage-video-breakdown` 为库内第 2 版。
  - 三个新环节已入库。
- **5xx 与错误**
  - 07:46:10–07:46:26 共 10 个 502：6 个是部署探测（`/api/config`），4 个来自上面那两个页面的轮询。
  - 之后 0 个 5xx。重启后日志 0 条 ERROR、0 条 WARN。

## 没验证的

线上没有跑真实复刻任务，下面几项都还没看，记在 TODO.md「发布后在线上视频页跑一条」：

- 进入制作时省掉了几个开场画面检查（日志 `optional checks dropped`）；
- 两个检查第 2 版的误判率；
- 自动重出视频时，接进提示词的修改意见能不能用。

## 回滚

- **怎么回**：server 回 `20261110-official-avatars-3992f750`。
- **数据库**：没有迁移，不用改库。
- **提示词库**：旧版本启动时会把它包里的提示词文件再入库为新版本并设为当前，自己会改回来，不用手动处理。
