# Studio 项目卡片生产发布 · 2026-10-17

已完成提交、推送及生产部署。发布于 2026-10-18 03:15 UTC（用户时区 America/Los_Angeles 为 2026-10-17 20:15）。

## 范围与制品

- 代码提交 `4ed3ecf95c07e72c8bedcab3e721071871d4582e`，已推送 `origin/codex/unified-ip-studio`。
- 发布 `20261018-project-cards-4ed3ecf9`，只更新 `server,web-aiavatar`；从干净 worktree 构建，原工作区的模型入口、图片压缩、视频样式和供应商排障改动未混入。
- 项目列表使用真实封面／文字摘要和去重内容数量；固定封面可选、可恢复自动，小地图位于「查看流程」。复用项目 PUT 与既有 coverKey，无新表或迁移。
- 保持现网统一登录、正式 ID issuer、企业功能开启；mock/dev-login 关闭。没有修改 `/etc/aistareco/*.env`。
- JAR SHA256：`0d37d3741618361f0954ae0c8b3331e75127efa65be58cb454e35756299750cd`。
- 前端 tar SHA256：`aa19d37313c38625a0589c8e4cb0bd45a5552ef8306e674623869439aaafbaba`。
- 前端 BUILD_ID：`bPJAf6CqTShLYkMy1SmOD`。

## 发布与验收

隔离版本的 workspace 全量类型、admin 类型、Java 17 编译／后端 46 项测试、前端定向 15 项和 API 契约通过。前端首轮并行检查时一条分页测试超过默认 5 秒；单 worker、15 秒上限重跑实际 5.67 秒完成，全部通过。API 契约脚本保留其他模块既有 handler/orphan 警告，新增调用无契约遗漏。正式构建通过，制品内无 `.env*`、本地 fixture 或测试目录。

`deploy-release.sh` 与 `verify.sh` 正常结束、ALL GREEN。两服务 active，线上 JAR／BUILD_ID／三项 release checksum 与制品一致；项目页面 CSS 和两个相关 JS 的公开 HTTPS 响应均 200，SHA256 与本地产物相同。上传暂存目录已清理。主服务从本次启动时间起检测到 0 条 ERROR，启动与 Flyway 校验日志存在；只读 SQL 确认数据库仍 V58。

浏览器使用现有登录会话，在真实 `https://aistar.aibuzz.cn/projects` 验收，没有拦截或伪造 API：

- 通过本人 API 创建临时画布 `IPP-ea872a40`，上传两张程序生成的微小纯色 PNG，添加一份验收说明；真实预览图片加载成功，列表显示「2 张图片 · 1 份文字」。
- 在页面选择封面 A，刷新页面后服务端返回封面仍为 A；docVersion 与 3 个节点保持不变。
- 页面「查看流程」显示真实 3 个节点；恢复自动封面后重新选回默认 B。
- 非画布封面 key 返回 400 `IP_COVER_INVALID`，失败未改文档。
- 390×844 手机网格、列表、封面选择和流程窗口实际通过。临时视口已恢复。
- 验收后通过本人删除 API 软删该临时画布，并确认项目列表回到空态；只读 SQL 确认该行已软删，当前账号钱包与账本均 0 行。没有调用模型、收费生成、发布或修改开通。

两张测试图片保留为上传记录，未进入个人素材库或被其他项目引用；本轮没有执行 OSS 对象删除。原有用户项目未修改。

截图和详细日志位于忽略目录 `.studio-e2e/project-cards-release/`；`production-desktop.jpg`／`production-mobile.jpg` 是真实生产临时验收画布，截图不是用户作品。

## 回退

发布前实际 JAR SHA256 为 `43aafd95dde2a9d7f0b8987734c417e2f2b7ba2c5f7e4431fecadefa63250322`，前端 BUILD_ID 为 `MuXuhnslWgsjOgTqo2LaU`。

备份目录 `/opt/ai-star-eco/backups/20261018-project-cards-4ed3ecf9/`：

- `server.before.jar`：上述旧 JAR。
- `web-aiavatar.before.tar.gz`：旧前端，SHA256 `09c1c2a6434e3ee352a90734b7b87e08e600244f3417542b2b492a7dcbc4f708`。

回退时恢复两份对应制品并重启 `aistareco-server`／`aistareco-web-aiavatar`，保留现有环境配置和数据库。运行版本固定为代码提交 `4ed3ecf9`，后续发布记录提交不代表重新构建。
