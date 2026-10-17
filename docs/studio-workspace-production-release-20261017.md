# Studio 工作台生产发布 · 2026-10-17

状态：已生产发布。2026-10-17 08:56 UTC（ECS 16:56 CST）更新后端与 AiAvatar，以下为实际制品和验收范围。

## 范围

- 提交当前分支全部改动，包括界面重构、设计图片与原型、表单聚焦/选择修复、账号邀请关系方案文档。
- 部署 `server,web-aiavatar`。统一账号中心独立仓库不在本轮部署范围；邀请关系文档仍未实现。
- 导航：首页 / 项目 / 画布·自由创作 / 场景·专项创作 / 灵感 / 资产 / 发行。项目恢复大预览画廊，创作页十项能力平铺。
- 场景复用模板画布，资产默认我的 IP，发行复用本人存量账号与发布记录；选品融合、画布投递/草稿、短剧音乐模板与音乐发行等仍为【待建设】。
- 无新数据库迁移，不改变钱包、产品开通或发布任务写权限。

## 基线与配置

生产后端基线 `8e12ce1b`（release `20261016-studio-model-limit-8e12ce1b`）；AiAvatar 基线 `5d345ede`（release `20261016-studio-upload-model-5d345ede`）。后端原 JAR SHA256 `ef4370f1831a62a738adc5659cd9f4cda48c4717f042436c321b9cccb1873ca4`，前端原 BUILD_ID `VCR2X0IihXYWk04ZV8Yjm`。

保留生产构建开关：真实 API、关闭 dev login、身份中心 `https://id.aibuzz.cn`、企业功能开启。未修改 `/etc/aistareco/*.env`，不携带本地 fixture 或隔离后端设置。

## 验证

发布前全仓类型、后台类型、后端编译与 API 契约检查通过；后端模板与路由/开通专项 32 项通过。前端全量 99 个测试文件、769 项通过；正式构建成功。制品校验全部通过，tar 内无 `.env*` 或 `.studio-fixtures`，含 9 张创作图；API rewrite 指向 `127.0.0.1:8080`。线上健康检查、制品核对及模板落库通过，浏览器交互复验受下述网络限制。

本轮不会执行收费生成、绑定真实第三方账号或代发内容；这些平台业务结果不作为已完成验收。

## 制品与回退

- 代码提交：`81778bef93ad0bb4bd5123db5e69f5b43a47fcde`，已推送 `origin/codex/unified-ip-studio`。
- Release：`20261017-studio-workspace-81778bef`，仅 `server web-aiavatar`。
- JAR SHA256：`0eb8b018f742b10efe1f5df5092f9db8d8c21e94c1684e2df9276da3d77e29ff`。
- 前端 tar SHA256：`bc9d386a2adec941a73c8c42a01f4f95875655fcde6771ae8ffe1e7c3f82a380`。
- 前端 BUILD_ID：`WT4aJUxLy96b4Y0K6rW9n`。
- 更新前已备份 `/opt/ai-star-eco/backups/20261017-studio-workspace-before-81778bef/{app.jar,web-aiavatar.tar.gz}`；旧 JAR 校验与基线一致，旧前端备份 SHA256 `e3eebfa96f4972d93bd92c4384c9c229745dc34042dd496aebc1a724c366221a`。回退时使用两份旧制品恢复原服务目录并重启对应单元，不覆盖环境文件。

本机代理把域名解析到 `198.18.*`，常规浏览器连接超时。部署校验进程临时通过 `en0`、指定生产 IP 与原域名连接，HTTPS 仍校验证书；未改系统 DNS、浏览器安全策略或仓库部署脚本。

## 线上验收

- `deploy-release.sh` 正常退出，`verify.sh ALL GREEN`：`/`、`/login`、`/create`、`/projects`、`/scenes`、`/assets`、`/templates`、`/distribution`、账号页、记录页及 `/api/config` 均返回 200；全部既有服务 active，后端本机 API、SAU healthz、中文字体和 Nginx 配置通过。
- 线上实际 JAR SHA256 与上述制品完全一致，前端实际 BUILD_ID 为 `WT4aJUxLy96b4Y0K6rW9n`；远端 release 三项 checksum 全部通过。两服务启动于 16:56:29/30 CST；上传临时目录已清理。
- Flyway 校验 58 项迁移通过，数据库仍 V58、零新迁移；只读 SQL 确认剧情带货与爆款复刻均为 enabled 普通模板，各 4 节点/3 连线。
- 新页面生产 HTML 均可读取；创作与场景的代表图片在线原图 SHA256 与本地制品一致。本人账号与发布任务的匿名 GET 均为 401，未放开匿名权限。
- 本机 Chrome 实际访问显示 `ERR_CONNECTION_TIMED_OUT`，因此本轮未完成生产登录后的交互、非空账号/记录与大卡片视觉复验。此前真实本地桌面/390px 的验收仍见实施记录；不能把 HTTP 200 或制品匹配当作生产交互验收。
- 未执行收费生成、第三方扫码成功绑定或真实代发。选品融合、画布投递/草稿、短剧音乐等待建设标记仍保留。

部署后补录文档单独提交；运行制品仍固定为代码提交 `81778bef`，后续文档提交不代表再次构建部署。
