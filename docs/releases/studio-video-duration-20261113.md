# Studio 视频规格与时长发布（2026-11-13）

- 应用提交 `8621320f51348a9ae33b3b4bd500636829320abb` 已合入 main。[Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43536854470) 30 项通过，含 PostgreSQL 18 迁移门禁。[前端构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43537024919) 固定检出该提交，仅打包 `web-aiavatar`，校验制品 SHA-256 `50d5f13be2ec40c6abcb742dd9b5617861f116147f0a4c7f229a05db0d596c53`。
- 太平洋时间 17:04 完成发布，前端 B100/A0。新版 BUILD_ID `ThfxoCUWhnkb93SQnRcZI`，A 保留上一版 `szaRL4mF2wnFA8WXo9Nr4`。备用机启动后入口探针曾返回 503，未切流。重新核对 B 就绪后切流，双 VIP 共 30 项路由及 ALB 健康检查通过。两个站点保留上一版静态资源。此次发布范围为 Studio 前端。
- Chrome 生产登录态验收使用同一原片、Seedance 2.0、9:16、720P。在 390 px 和 320 px 浏览器宽度下检查规格摘要与展开面板。文字完整，面板没有越出视口。两个入口从跟随原片切到自定义 8 秒后报价下降，切回后恢复原报价。重新打开验收草稿后仍选中自定义 8 秒。验收未提交生成任务。

| 入口 | 跟随原片（15 秒） | 自定义（8 秒） |
| --- | ---: | ---: |
| 爆款复刻 · 分镜复刻 | 约 1,395 积分 | 约 835 积分 |
| 元素替换 | 约 1,233 积分 | 约 673 积分 |
