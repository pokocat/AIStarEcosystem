# Studio 首页推荐发布（2026-11-13，太平洋时间）

首页「灵感」按完整发布时间倒序排列。推荐区宽度达到 960 像素显示 5 列，低于 960 像素显示 3 列。卡片继续沿用作品比例。

四条成片从同一账号的资产库核对首帧后发布为官方案例。独立封面取自各自的首帧，案例仅引用成片副本。四条生产播放文件的 SHA-256 与对应原片一致。首页顺序如下。

1. 一张户型图，10秒变你家（`IPD-home-mvj09e67e633ca5`）
2. 连续加班一周的脸，第二天怎么救（`IPD-home-mvj767d3eebccc3`）
3. 她说我老公半夜给欢姐发消息（`IPD-home-mvj7d504355afa9`）
4. 冰柜第三集：我妈来了（`IPD-home-mvjb562d2e4b01a`）

应用提交为 main `ab72d29ff8c058008a1dd438f8e6b22774afbe6f`，发布范围为 `web-aiavatar`。Mac mini 上类型检查、Maven 编译、API 契约检查及 24 条定向测试通过。[主线 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43551293760) 和[生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43551289390)通过。

前端制品 BUILD_ID 为 `FNTQyS1iEuc6CYoJ3u0_x`，SHA-256 为 `1d3a2ff901b5ed7f111d2c2ccacac016d90d4a9b765f9b6106509bfb361e839e`。19:32 前端切至 B100/A0，A 热备保留 `m7j3vIF_2BmjkrH3EnkyX`。双 VIP 页面和静态资源检查及 ALB 健康检查通过，四条案例的封面返回 200、视频 Range 返回 206。登录后的生产首页实测在 1440 像素视口显示 5 列，在 390 像素视口显示 3 列，两种宽度下排序一致。

回执位于 `~/.local/state/aistar-deploy/20261113-studio-home-ab72d29ff.json`。布局可按生产手册切回 A。单条案例可在官方内容管理下线。
