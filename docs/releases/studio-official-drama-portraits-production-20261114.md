# Studio 官方形象按更新时间排序与短剧角色扩充

[官方形象库](https://aistar.aibuzz.cn/assets?tab=official)按形象的最后更新时间倒序排列，首次入库使用创建时间。没有更新时间的旧记录使用创建时间。分类与搜索保留同一顺序。线上官方形象库、AI 视频选角和画布 IP 人物库的前 12 位依次为郑建国、陆梅、何小川、唐艳秋、许卫宁、孟书瑶、梁景程、宋宜宁、段明成、顾清禾、周启明、沈知微。分类为家庭长辈、小店经营、医护、都市精英、公务员、教师，每类两位，官方形象共 52 位。北京时间 17:58 核对三个入口各显示 52 枚审核盾牌。

- 新增 `PA-44` 至 `PA-55`，均为平台自制虚拟角色。每位有 800×800 头像，以及 1536×1152 的正面、侧面、背面面部特写和全身设定图。生产 OSS 的 24 张 JPEG 摘要与制品逐张相符，Range 响应均为 206，篡改签名请求被拒绝。视频选角放大预览实测加载设定图。
- 火山项目 `bingbing` 的 AIGC 素材组逐张 GetAsset 回读 12 张设定图的 Active 状态。两个独立身份均通过后台生产制品核对，可复用同一批平台审核引用。OneToken 同一凭据作用域上传并回读 12 个有效临时回执，过期按现有链路刷新。验收未提交视频生成。
- 主线应用提交 `342019e788c293418d21bdd3c76d8ae8b1c84077`，已合入当前 `main)。[主线 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43580787897)重试通过，覆盖三组测试、PostgreSQL 18 实库检查、前端和契约检查。[前端构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43580790230)来自同一应用提交。发布步骤按[生产手册](../runbooks/aistar-production-release.md)执行。
- 正式 API 和 Studio 前端均为 A0/B100。API release `5e3f9327d9f13bc1`，镜像配置摘要 `sha256:ded3d2ee6409d9d8e81d899c294c986d3becbf82082d514b467a9a080ca351ab`，Studio BUILD_ID `ZRwmY2lTGNDiP_qzcGr34`。两个 VIP 的 API 鉴权及前端页面和静态资源检查通过，SLS 日志正常接收，发布期间未发现入库错误。数据库无新迁移，独立后台沿用 `49a829183dc6a72f`，就绪且重启数为 0。
- A 保留上版 API `49a829183dc6a72f` 和前端 `NoS9lrSdJbbn5dMf31YZg`。如需恢复，沿正式主备流程切回对应服务。共享素材与审核记录留存。
