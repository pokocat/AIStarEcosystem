# Studio 资产批量上传发布（2026-11-12）

本次发布 `web-aiavatar`，应用提交为远端 `main` 的 `aaa1fa08ac0771d048d3840d0a144fa1f51759ac`，发布号 `20261112-studio-asset-batch-aaa1fa08a`。资产主页、素材选择弹窗、资产详情、导演台和人像核验支持多选上传。素材选择弹窗按剩余名额选中成功项，超出名额的文件留在资产库。单个文件失败时报告文件名，继续上传同批其他文件。

## 检查与制品

- Mac mini 的工作区类型检查、Admin 类型检查、Maven 编译和 API 契约检查通过。前端本地验收在模拟接口下选中三张图片，其中一张失败，另两张进入草稿。Mac mini 的 Studio 测试共 2,076 项通过。
- [Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43248096776/attempts/2) 在准确的应用提交上通过。首次后端第 2 分片因 Ubuntu 镜像站无法下载媒体依赖而退出，重跑通过。PostgreSQL 18 实库门禁通过。
- [Studio 生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43248130556) 固定检出应用提交。GitHub 制品归档 SHA-256 为 `67b8fcde5d7444a4a3c440bae2c04af0c44ec73f508ae36de77311e85c9952c7`，`web-aiavatar.tar.gz` SHA-256 为 `fcbd7a91ef0baaa977a261dd8b6092168ac51de6939f4788ecfaefb46f6e88ef`。清单的服务、提交及生产公开配置已核对。
- 切流前 `main` 增加了 API 容器运行配置提交 `e79c1ea8f`。核对两次提交间的 Studio 前端源码、共享依赖和构建输入一致，沿用已验收前端制品。

## 线上验收

- B 在备用端口预验新版页面、静态 JavaScript 和同域 API。保留 A 在线版本及 B 上旧版的静态文件，等待 B 的旧连接排空后启动新版。
- 前端组于 `2026-11-12T15:42:26Z` 完成双 VIP 和 ALB 健康验收。B 以 100% 权重承流，Studio BUILD_ID 为 `Ngc8zeNREnUUz7_uZtKqb`。A 以 0% 权重保留旧版 `1c5144b2b`，BUILD_ID 为 `bY1-g4kJCyk-ScDWpDRgi`。两台 Studio 服务均为 `active`。
- 两个 VIP 共 14 条严格 TLS 路由探测通过，覆盖 Studio 双域名、门店发现、资产页、人像核验、登录回调、Studio 管理后台登录及同域 API。两台节点的 SLS 采集进程在线。新容器有 1 条就绪日志，验收窗口内错误行数为 0。账号中心 discovery 返回生产 issuer。
- 真实登录态打开「门店发现 → 选择门店照片」。发布前文件选择控件为单选，发布后已启用多选，并可同时勾选两张已有资产。验收完成后取消选择。本次线上验收未上传新文件或提交生成任务。

发布只切换前端组。需要回退时，先验证 A 上保留的 Studio 制品和前端入口，再按生产发布手册将前端流量切回 A。
