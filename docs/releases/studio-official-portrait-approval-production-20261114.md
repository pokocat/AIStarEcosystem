# Studio 官方形象入库与审核盾牌

2026-11-14 16:36（北京时间）完成生产发布。[官方形象](https://aistar.aibuzz.cn/assets?tab=official)的 40 张 4:3 设定图均已在火山项目 `bingbing` 的 AIGC 组审核通过，逐项使用 GetAsset 核对 Active 状态。OneToken 共上传 40 张，同一凭据作用域的 40 个临时回执已读回。约六小时后的再次使用沿用现有链路自动续传。

- 平台共享审核记录按原设定图的存储 key 和素材库查询。只有仍在架的免费平台设定图能复用，个人素材和真人授权仍按用户隔离。使用已审核文件时，Studio 的前置检查和火山视频调用复用同一资产。已用生产制品、生产数据库和两个不同用户身份只读核对全部 40 个引用。
- 三个入口都在人物卡片右下角显示盾牌，分别是官方形象库、视频选角、画布的 IP 人物库。登录线上后，三个入口各实测 40 枚盾牌。卡片继续显示头像，审核状态取实际发送给视频模型的设定图。此次验收没有提交付费视频生成。
- 发布包含共享审核 `b51833d60`、官方卡盾牌 `4b6b73aec` 和画布人物卡盾牌 `04855b2c6`。[主线 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43574531190)通过，PostgreSQL 18 的 80 项检查全部通过。API 和独立后台使用主线 `fc8ddf84d` / `49a829183dc6a72f`，本次没有新迁移。API 两个 VIP 的就绪和鉴权通过，后台排空后换版、就绪且重启数为 0。
- [前端制品](https://github.com/pokocat/AIStarEcosystem/actions/runs/43574401156)从 `04855b2c6` 构建，核对与上线提交的前端及共享构建输入一致。前端 BUILD_ID 为 `NoS9lrSdJbbn5dMf31YZg`。前后端均为 A100/B0，前端两个 VIP 的页面、静态资源和健康检查通过。
- 回退按[生产发布手册](../runbooks/aistar-production-release.md)使用 B 保留的 API `dccdfee3ae3fd32a` 和前端 `GG_gtwXDkJ7aiImMFPUR8`。后台旧配置保存在 A 的 `/opt/aistar-cluster/control/background-before-49a829183dc6a72f.conf`。素材库已审核资产和回执留存。
