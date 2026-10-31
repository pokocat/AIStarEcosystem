# Studio 改版：server + web-aiavatar 发布

2026-10-31，Asia/Shanghai。用户确认「合并，部署发布」后，#145 在 CI 8 项全过后快进合入 main，从 main 发布 server 与 web-aiavatar。

## 内容

照设计稿「AI 视频与图片页重设计」（claude.ai 设计画布）改，短剧导演台和画布不动：

- **AI 视频 / AI 图片**：一张创作卡，场景名就是切换按钮；编辑框直接生成，「AI 编导」写脚本后「采用脚本」放回编辑框；模型和规格两个胶囊，时长最长 60 秒（超过单段上限交给创作助手分段）；去掉常驻说明。两个页面不分新旧版，直接打开的人都会看到。
- **素材位只从资产库选**：空位是居中图标 + 加号；新文件在选择框里先传进资产库再选中。
- **新版其他页面**（首页、项目、资产、发行、左侧导航）统一设计语言；旧版不变。
- **新版资产页**（只在新版）：全部 / 图片 / 视频 / 音频 / 人物，左边资产库，自带「AI 生成」库与「移到」；人物里我的 IP、角色、授权明星放一起，「用照片建」在资产库建角色。AI 图片 / AI 视频的素材选择框换成按资产库选（默认打开上次用的库）。细节见 `apps/web-aiavatar/README.md` 2026-10-31 两节。
- **服务端**：交给创作助手的视频时长 1–60 秒；素材列表加 `source`、资产对象列表加 `kind` 两个可选筛选参数（不传和以前一样）。
- 同包带上 main 上另一个会话已合入未发布的 `610d5a0e0`（供应商报错说清楚、不带出供应商细节；只改服务端报错处理）。

无数据库迁移。接口改动都是加法（两个可选查询参数，已写进 `specs/openapi.yaml`）。发布前核对 `git diff 3800cc769 9902d4f63 -- 'apps/server/**/dto/**' specs/openapi.yaml`：没有删除或改名的字段。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 正式构建 | main `9902d4f6314a806adb86e618909783f25bdda51a`，仓外干净工作区 `../AIStarEcosystem-release-studio-redesign`（`git worktree add --detach`）构建。先在 #145 的最后一个提交上构建，CI 全绿后 main 快进到同一个提交（`610d5a0e0..9902d4f63`），所以包里的提交就是 main 的提交 |
| CI | #145（run 41205469266）8 项全过：backend、frontend-tests、6 个 build-and-browser |
| 本地门禁 | `typecheck:all`、`typecheck:admin`、`mvnw compile -o`、`check:api-contract` 通过；web-aiavatar 全量 vitest 1534 个里 1 个失败（`studio-workspace.test.tsx` 编辑器保存失败那条），单独跑 3 次、整文件 78/78 都过，本分支和 main 都没改这个文件，判断为全量跑时的时序抖动；CI 的 frontend-tests 通过 |
| 发布包 | `20261031-studio-redesign`（server + web-aiavatar） |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭（`manifest.env` 已核对） |
| server JAR SHA256 | `0429becb9990f7d75701fa604ab3247553b391e3192c1a944d738d8440333429`，线上与本地一致 |
| web-aiavatar tar SHA256 | `c30f2d3e90ca37577b8f3c43d913da4e4ef21ee3cad4f1710e98d4edb606c981`；BUILD_ID `k0rl-oSZ5_imwwffs-W6A`（线上一致） |
| 服务启动 | server 21:34:28 重启、17.6 秒启动完成；web-aiavatar 21:34:29。两个服务 NRestarts=0 |
| 数据库 | 无新迁移；Flyway 校验 72 个迁移，`No migration necessary` |
| env-check / verify | 均 ALL GREEN |
| 发布前在途 | 21:33:41 `ip_run` 未结束 0、`material_video_job` 未结束 0、`ip_plan_execution` 进行中 0 |

## 线上核对

- `/assets`、`/video`、`/image`、`/projects`、`/` 200；`/api/v1/ip-studio/library/materials?source=generated&folder=unfiled` 未登录 401。
- 线上 `/assets` 引用的样式里有本次新加的 `.assets-hub-tabs`、`.assets-tile-move`、`.lmp-lib`、`.asset-thumb-missing`；server JAR 里的 `IpSavedAssetService` 带来源筛选。
- server 重启后 ERROR 0 条（同一 grep 近 24 小时命中 37 条，确认能匹配）。
- 生产机 `/opt/ai-star-eco/server/release-id.txt` 仍写着 `20261030-director-version-adopt`，这个文件部署脚本不更新，以 JAR 校验和为准。

**没有在线上账号里走一遍登录后的流程**（没有用别人的账号操作），也没有触发任何付费生成。登录后的行为以本地真后端验收为准：把 AI 生成的图移进新建的库（AI 生成 159 → 158）、在库里上传、用照片新建人物（正脸成主图），电脑 1440 与手机 375 都截图看过。

## 重启窗口

nginx 访问日志 21:33–21:35：200 共 90 个、307 8 个、502 9 个，502 全在 21:34:28–21:34:45（server 重启的 17 秒里）：6 个是部署脚本探测的 `GET /api/config`，3 个是 `GET /api/me/wallet`（2 个与探测同一出口地址，1 个来自另一个地址），页面会重新读余额。不声称零中断。

## 回滚

server 上一版是 `20261031-seedance-submit-fix-clean`（`3800cc769`），web-aiavatar 上一版是 `20261031-studio-assistant-fixes`（`f3092980c`），都还在生产机 `/opt/ai-star-eco/releases/` 下，取回后用原脚本分别部署：

```bash
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261031-seedance-submit-fix-clean/ dist/deploy/20261031-seedance-submit-fix-clean/
rsync -a -e "ssh -i /Users/donis/dev/aliyun/aiartist.pem" ecs-user@47.98.162.120:/opt/ai-star-eco/releases/20261031-studio-assistant-fixes/ dist/deploy/20261031-studio-assistant-fixes/
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261031-seedance-submit-fix-clean server
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh dist/deploy/20261031-studio-assistant-fixes web-aiavatar
```

服务端新加的两个参数是可选的，前端回滚到旧版不会受影响；只回滚服务端时新版资产页的「AI 生成」库和来源筛选会退化成不筛（旧服务端忽略不认识的参数）。

## 没有做的

新建人物时一起加声音、真人自填授权、「AI 生成」按在哪做的筛、资产库封面和分类数量、新的人物详情页；画布 / 导演台 / 创作助手的选择框没改。见 `TODO.md`。
