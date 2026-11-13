# Studio 确认参考人像大图发布（2026-11-13）

`web-aiavatar` 发布 `20261113-portrait-preview-e9d12d07e`，应用提交 `e9d12d07e4b507fbdbeecc1aa5584c14bb02e7b3`。生成前的人像确认弹窗和人像素材库里的确认弹窗共用 `PortraitGuide`，缩略图现在通过 `ImageLightbox` 打开。大图初始适应窗口，支持缩放和复位，按 Esc 返回确认弹窗。

- Mac mini 提交前编译门、28 项相关用例均通过。[完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43363574227) 及[生产制品构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43363687738) 通过。生产包 `web-aiavatar.tar.gz` SHA-256 为 `49e0b713fc811c6b0be84c64c7b3c6bc6f4f2180b53de2fd18d7c0f91f78e1eb`。
- B 机先在零权重时使用 13093 端口通过预检。保留 A 承流版与 B 原版静态文件。B 排空后启用新版，在接流前和切流后都用 Chrome 打开确认弹窗。2400×3000 的测试图片在 1440×900 和 390×844 视口中完整显示，缩放、复位及 Esc 均通过。浏览器使用模拟账号与人像数据。
- 北京时间 12:18，前端流量切到 B100/A0。12:19 双 VIP 共 20 项路由和 ALB 健康验收通过。新版 BUILD_ID 为 `9j8O0bMZyKFkW1zBDPwA1`，A 保留 `bafa569f4`（`0hRfqxxzlvymTvxLBEamM`）用于回退。切流后抽样页面和旧版静态文件返回 200，匿名人像接口返回预期 401。切流前的本机抽样有两次请求未取到 HTTP 响应，后续恢复。发布范围为 Studio 前端，API 和 Studio 管理后台沿用现有版本。
