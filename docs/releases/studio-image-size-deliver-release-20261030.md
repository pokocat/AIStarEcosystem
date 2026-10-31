# 图片尺寸不符照常交付：server 发布

2026-10-30，Asia/Shanghai。用户反馈画布上「图片引擎返回 1448x1086，与所选 768x1024 不符」，要求不管在画布、导演台还是别处，模型返回的图都照常交给用户；同时反映失败的那次也扣了积分。用户确认「合入 main 并发布」。

## 问题与改动

- 10-20 上线的尺寸校验（`wire.requireExactOutputSize`）在结算前把尺寸不符的图判失败。10-20 至 10-30 共 13 次：画布 10 次、导演台 3 次，全部来自 `CATech · GPT Image 2`（`gpt-image-2-1k-pic`）。选 768×1024 时有时回 1448×1086，选 1360×768 时回 1445×1088。
- 改为照常交付：只要返回的是可用图片，就保存并按原价结算一次。尺寸不一致或读不出尺寸（如 WebP）都只记 WARN `[studio-jusuan-image] output size differs`。不拉伸、不裁剪、不重投。画布、导演台、制作计划共用 `JusuanImageClient` 这一处。画布节点先按所选比例占位，图片加载后按真实形状显示。
- 「失败也扣了积分」：生产账本核对，这 13 次都是冻结后原数退回（`FREEZE` / `UNFREEZE` 成对），没有实扣。今天 19:02 和 19:15 两次各冻结 16、几分钟后退回 16，余额回到 757。该用户今天扣过的 3 笔各 16，对应的都是生成成功的图。生成要两三分钟，这期间余额少了冻结的那部分，容易被看成扣费。
- 10-25 曾在 codex `image-size-warning` 工作区写过「改为警告」版本（含界面黄条），从未提交、未上线，由本次取代。界面提示未做，记在 TODO。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 合入 main | `fix/image-size-deliver` 快进推到 main：`83f817348` |
| 正式构建 | main `83f817348e9c8ead492eb88b6ed2808602eb2359`，仓外干净工作区 `../AIStarEcosystem-fix-image-size` 构建 |
| 服务 / 发布包 | 只发 `server` / `20261030-studio-image-size-deliver` |
| server JAR SHA256 | `6b4e735c14af3dde2fef44c6eb724e2f1de2e2fab108e91bf8d5b253df026a0b`，线上与本地一致 |
| 服务启动 | 19:34:53 重启，19:35:12 启动完成（17.9 秒），NRestarts=0；运行中 JAR 已含新日志串、不含旧报错文案 |
| 数据库 | 无新迁移；Flyway 校验 72 个迁移，`No migration necessary` |
| env-check / verify | 均 ALL GREEN |
| 发布前在途任务 | `ip_run` 与 `material_video_job` 进行中均为 0 |

## 同包上线的既有后端改动

线上 server 此前是 `20261030-studio-scene-backend`（`80edade0f`）。main 在它之后还有四处后端改动，用户上午选择「先不发」，这次随包上线了。前端部分今天已经上线，没有数据库迁移；接口契约只有 `adminResetStudioScenes` 的说明文字变化。

- 场景模板「恢复内置」改为写一条带版本号的记录，缓存按内容识别（`0a793e410`）。
- 编导与助手的事实边界，不编品牌年份、检测次数、销量等（`b85ddf948`）。
- 「短剧导演台」的积分流水说明与一条报错文字（`1347fbb59`）。
- 报错里不再显示供应商余额（#134，`12a5692cf`）。

## 重启窗口

nginx 访问日志：19:34:54 至 19:35:10（约 16 秒）共 14 个 502，全是 GET，没有写请求失败。其中 7 个是部署脚本用 curl 探测 `/api/config`；7 个来自 3 个真实用户，都是钱包余额和对话事件或对话快照的读取，页面会重试。19:35:12 之后恢复 200。新进程启动后 ERROR 为 0；窗口内唯一一条 ERROR 来自旧进程关停时（响应已提交，无法渲染错误页），上一版本运行期间也出现过同类 ERROR。

## 验证

- 本机：`JusuanImageClientTest`（30）、`IpRunWorkerTest`（38）、`StudioPlanExecutorTest`（25）、`DirectorImageModelTest`（11）、`DirectorImagePromptFormatTest`（12）全部通过。用例覆盖：请求 768×1024 返回 1448×1086 时任务成功、按真实宽高保存、只结算一次、再次唤醒不重投；WebP 读不出尺寸也交付。server 编译通过。
- main 已手动触发 CI：run 41048955286。
- **没有**用真模型付费出图实测；线上下一次该模型返回横图时，日志里会出现上面的 WARN。

## 回滚

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh ../AIStarEcosystem-release-scene-home/dist/deploy/20261030-studio-scene-backend server
```

本次没有迁移，回滚不涉及数据库。
