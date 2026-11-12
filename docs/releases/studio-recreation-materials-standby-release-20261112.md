# Studio 爆款复刻素材与主备发布记录（2026-11-12）

- 应用提交 `4e48eaffdb883d2b0b0ee1945ddefef2d38fc404`。发布范围为 API、A 上的独立后台调度、Studio 和 Studio 运营后台。应用制品通过三片后端测试、PostgreSQL 18 实库门禁及同次前端检查。[Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43152400792)
- API 制品 `a1d72136f826c001` 的 JAR SHA-256 为 `a1d72136f826c0013b85cddc6c83efb497241c3d4848c564204f5b5af82d403d`，镜像为 `sha256:67c364c825a8e85b471674f6722a8ea2e53e75af13a0c1cb8bb9c97a82b1e5df`。B 通过本机鉴权后，于北京时间 13:29 接管 API。A 保留 `310a63c420b21d49` 并通过热备鉴权。
- A 上的独立后台调度在本机执行排空后切到同一镜像。持久任务保留在共享库，交接时有 7 条生成队列记录。B 的 Studio 和 Studio 运营后台分别运行 `0MKrlnANYmey0G_YgHzgH` 和 `HgxHIZY6ezMPAmeLmiwPq`。前端连接排空用时 4.89 秒，于北京时间 13:32 接管流量。API 与前端组最终均为 A0/B100。
- 切换期间双 VIP 共 558 次严格 HTTPS 探测返回 200，覆盖 API 就绪、爆款复刻页面及 Studio 后台登录页。新版场景目录从两个 VIP 均返回图片上限 18、参考视频必选和声音启用。生产登录态验证了参考视频主区域、商品、人像、道具及环境入口和一段声音的提示。
- 主备脚本补充了排空与切流回归。正式 API 后续根据本机请求、连接及线程计数决定何时更新备用机，并在 VIP 收敛后结束验收。两次脚本检查分别通过 28 项和 30 项测试。数据库迁移和 DNS 变更均无。

北京时间 13:52，前端提交 `c13ff1d303bc12126b9d4e02cb3a38537bc53a36` 将「复刻方式」恢复到表单顶部。编译门与正式构建通过。A 的 Studio 制品为 `lLYNRKHJmmlM9AqnsWO0m`，同时复用了现网运营后台制品 `HgxHIZY6ezMPAmeLmiwPq`。首次切流在双入口验收等待超时后自动回到 B，复用已就绪制品重试成功。前端组权重为 A100/B0，两个公网入口均通过，浏览器登录态确认「复刻方式」位于参考视频上方。
