# Studio 场景化改版：后端上线、正式站新旧版开关

2026-10-30，Asia/Shanghai。用户要求先发后端，等服务正常再看前端怎么上。

## 发布真值

| 项目 | 结果 |
| --- | --- |
| 合入 main | PR #133 合并为 `80edade0f`（含 `d0a55e4e0`：首页卡片空列表不再多渲染一次） |
| 正式构建 main | `80edade0f2e913ae64586cd5cc2e76623b9d6d85`，仓外干净工作区 `../AIStarEcosystem-release-scene-home` 构建 |
| 服务 / 发布包 | 只发 `server` / `20261030-studio-scene-backend`；正式站 Studio 前端没动，仍是 `20261030-director-version-adopt`（main `97ca7fc28`） |
| server JAR SHA256 | `0249b351fe498eb7a7e146e77da37095570ed7365a211782a6744ec81008c12d`（线上与本地一致） |
| 服务启动 | 09:44:22 重启，09:44:39 启动完成（16.4 秒），NRestarts=0 |
| 数据库 | V72 `ip_project.scene_id`（可空列）09:44:27 执行成功；线上此前最大 V71 |

发布前线上 server 是 `20261030-director-version-adopt`（main `97ca7fc28`），main 在它之后有本次 #133 和 studio-admin 看板（`b985992d7`）。**更正**：`b985992d7` 也改了后端看板接口（`StudioOperationsDashboardService` / DTO：新增消费用户、到账、导演台推进、成功率窗口、供应商异常等，并把 `hourlyOutcomes` 换成 `successWindows` + `outcomeBuckets`），随这次 server 一起上线了；当时写成「不在 server 包里改行为」是错的，见下「Studio 后台」。

## 兼容性

新后端对线上现有前端兼容，改动都是加法：

- 新接口：`GET /api/v1/ip-studio/scenes/home`（公开只读）、`GET /scenes`、`POST /scenes/compose`、`/api/admin/studio/scenes`（运营）。
- 建画布可带 `sceneId`，不带照旧；V72 是可空列。
- 文字任务允许读引用的图片（原来只有创作助手可以）。
- 视频任务结束后立刻唤醒对应的制作计划，不再等 60 秒巡检。

反过来不成立：新前端的首页卡片、AI 图片、AI 视频都依赖新接口，必须先有这版后端。

## 验证

- 发布前：四道门（workspace / admin 类型检查、后端离线编译、API 契约）通过；场景相关后端测试 35 条通过；web-aiavatar 全量 1452 条连跑，修掉首页卡片的偶发问题后连续两遍全过。
- CI：#133 合并时 frontend-tests 只红在 web-drama 一条 main 上原有的测试（同一失败在干净 main 上可复现），这条让 web-aiavatar 的测试在 CI 里被中断、没跑完；backend 同样只红在 main 原有的几条。修复在 PR #134（另一个会话），#134 已全绿，合入 main 后 main 才算完整跑过一遍。

## 线上验收

- 线上 JAR 校验和与构建一致；重启后 0 条 ERROR（同一 grep 在近 24 小时命中 5 条，确认能匹配）。
- Flyway 记录 `72 / success`，`ip_project.scene_id` 列存在；平台配置里没有 `studio.scene-catalog`，用的是包里自带的场景目录。
- `https://aistar.aibuzz.cn/api/v1/ip-studio/scenes/home` 未登录 200，7 张卡（爆款复刻、商品套图、电商带货、同城到店、品牌广告、剧情短片、IP 形象），字段只有标题、说明、落点场景、类型、封面，不带拍法提示词；`/scenes` 与 `/api/admin/studio/scenes` 未登录 401。
- `verify.sh` ALL GREEN；正式站首页与 `/projects` 200。

## 发布窗口

单实例重启，09:43–09:46 nginx 记录 37 个 200、6 个 502、2 个 401、1 个 302。6 个 502 全是部署脚本轮询的 `GET /api/config`（09:44:23–09:44:39），没有用户请求失败。不声称零中断。

## 预览站（aistar-preview.aibuzz.cn）

用户想先看新版前端，按「服务正常后再部署预览前端」做了：

- 同一份 main 构建 web-aiavatar `20261030-studio-scene-preview`（`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭；BUILD_ID `sBIv6jm_WW-hxqC7YHpv2`，tar SHA256 `b88d8f81…4d91`）。
- 独立服务 `aistareco-web-aiavatar-preview`（端口 3113，目录 `/opt/ai-star-eco/web-aiavatar-preview`，环境文件 `/etc/aistareco/web-aiavatar-preview.env` 由正式站那份复制、只改端口），nginx 站点 `/etc/nginx/conf.d/aistar-preview.aibuzz.cn.conf`（`/api` 等反代同一个后端，不带 `/admin`，加 `X-Robots-Tag: noindex`）。用一级子域名，现有泛域名证书覆盖。
- `/`、`/video`、`/image`、`/projects` 200，首页「你想做什么？」7 张卡从新接口读出。nginx 平滑重载后的第一个请求被旧进程按未登记域名回了 404，之后正常。
- **还不能登录**：要在账号中心给 Studio 客户端加回调 `https://aistar-preview.aibuzz.cn/auth/callback`、登出回跳 `https://aistar-preview.aibuzz.cn/`，并在 `ID_CORS_ALLOWED_ORIGINS` 加 `https://aistar-preview.aibuzz.cn`，再重启账号中心（约 7 秒）。用户确认后两个配置已改好、还没重启时，用户提出改做「正式站隐藏入口切换新版」，于是把两份配置从备份（`*.bak-preview-20261030T020428Z`）原样恢复，账号中心全程没有重启，登录没受影响。
- 预览站的去留等用户决定；下线命令见 nginx 站点文件开头的注释。

服务器磁盘根分区已用 94%（剩约 9 GB），预览包 42 MB。

## 前端：正式站新旧版开关（10:41）

预览站登录要动账号中心，用户改为「正式站加隐藏入口切换新版，用户也可以回到旧版」。

| 项目 | 结果 |
| --- | --- |
| 合入 main | PR #135 合并为 `beef9f87c` |
| 服务 / 发布包 | 只发 `web-aiavatar` / `20261030-studio-ui-switch`（`NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，mock 与开发登录关闭） |
| Studio tar SHA256 | `a3f9dcc36eea34b03ea4169a1bc5398cea7a9bf4f9dfaf398523e5400644b51f` |
| Studio BUILD_ID | `5spvIRdC0zyfaxoC91vJR`（线上与本地一致） |
| 服务启动 | 10:41:56 重启，NRestarts=0，重启后无报错；后端未重启 |

第一次发布在上传那一步 SSH 超时（rsync 没传完，线上没有任何改动），连接恢复后重发成功。10:41–10:43 nginx 记录 20 个 200、1 个 302，没有 502。

- 默认所有人是旧版：顶栏、旧导航（首页 / 项目 / 画布·自由创作 / AI 导演台 / 场景·专项创作 / 灵感 / 资产 / 发行）、带大图的旧首页，与改版前一致。
- 任意页面加 `?ui=new` 进新版（浏览器记住 `aiavatar_ui`）；新版桌面账号菜单与手机「我的」有「回到旧版」，`?ui=old` 也行。见 `docs/studio-scene-creation.md` §10。
- 线上浏览器核对：公开首页默认旧版；`/?ui=new` 后地址参数去掉、首页 7 张场景卡与新导航出现；登录后 `/dashboard` 是左侧导航、页面左侧让出 88px、账号菜单有「回到旧版」；`/dashboard?ui=old` 回到旧版顶栏、记录清掉。核对用的浏览器已切回旧版，没有在任何账号上做操作。
- 本地验证：类型检查、契约门通过；web-aiavatar 全量 1453 条中 1451 过，另 2 条与本改动无关，单独重跑通过（机器负载高时超时）。按用户要求旧版不另加测试。

预览站随后下线：停用并删除 `aistareco-web-aiavatar-preview`、nginx 站点、`/opt/ai-star-eco/web-aiavatar-preview`、预览环境文件与发布目录，账号中心那两份备份（与现行配置一致）一并删除。`aistar-preview.aibuzz.cn` 现在落到 443 默认站（404）。

## Studio 后台（studio-admin，10:46）

**事故**：09:44 的 server 带上了 `b985992d7` 的看板接口改动，其中 `hourlyOutcomes` 被换掉；线上 Studio 后台还是 10-26 版，技术看板对每个模型做 `hourlyOutcomes.map(...)`，接口不再给这个字段后会报错。09:44–10:46 之间技术看板应当打不开（没有线上复现，按代码判断；经营看板与其它页面不读这个字段）。原因是只发 server 前没查 main 上前后端一起改的契约，规约已补进 AGENTS.md「生产发布顺序」。

**处理**：从 main `0cf885c55` 构建并发布 studio-admin `20261030-studio-admin-scenes`（`build-studio-admin-release.sh` 含类型检查与 12 条测试，`deploy-studio-admin-release.sh`），10:46:45 重启，NRestarts=0，无报错；只重启 `aistareco-studio-admin`，没动 server、Studio 前端与 nginx。这一版同时带上看板改版（`b985992d7`）和「运营配置 · 场景模板」页面。

- 线上：`/admin`、`/admin/login`、`/admin/scenes` 200；未登录访问 `/api/admin/studio/scenes`、`/api/admin/studio-operations` 401。
- 没有用线上管理员账号登录核对看板和场景模板页（不使用线上凭据），需要运营登录看一眼。
- 发布脚本成功后不保留旧目录；回到 10-26 版要从 `92d74f05d` 重新构建，且那一版和现在的后端对不上，不建议回退。

## 没有做的

- 运营还没在线上用过场景模板页；线上目前用的是包里自带的场景目录。
- ~~CI：main 上 web-drama 那条原有测试的修复还没合入~~ 已处理：用户确认后合入 PR #134（main `3f013b96f`），在 main 上手动跑 CI（run 40994464471）：backend、frontend-tests、六个 build-and-browser 全部通过。

## 回滚

前端（回到改版前的包，开关一起去掉）：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh ../AIStarEcosystem-release-version-adopt/dist/deploy/20261030-director-version-adopt web-aiavatar
```

后端：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem \
PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
./infra/scripts/deploy-release.sh ../AIStarEcosystem-release-version-adopt/dist/deploy/20261030-director-version-adopt server
```

V72 是可空列，回滚后留着不影响旧代码。
