# Studio 火山人像错误原文发布（2026-11-13）

生产应用提交为 `9bc72c20a2702d7bce14c57ba95c5778b95d17cd`。本次更新 API、独立送审后台和 Studio 前端，并合并发布人像列表、画布视频提示词及配置节点编辑器的通用图片预览。两个发布会话共用同一制品，只执行一次前端切流。

- [完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43385247836) 的 30 项检查全部通过，含 PostgreSQL 18 实库门禁。[Studio 生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43385443185) 固定到同一提交，沿用生产 OIDC 和企业功能开关。前端 `BUILD_ID` 为 `aIvjoEJCzfw8oVEUZ4XbJ`，制品 SHA-256 为 `78113227953502534348cdbda0c280820b2bc08ddc3c1683b5872cdc58aae53d`。
- 北京时间 15:42，迁移角色通过严格 TLS 应用 PostgreSQL V81。Flyway 校验通过，应用角色可读取两张人像表的可空 `ark_error`。V81 只增加字段，历史失败记录保留已有内容。
- 15:43，API 切为 B100/A0。后端制品 `9ae0ceaf58eba579` 的 JAR SHA-256 为 `9ae0ceaf58eba57949830bdfb872836a174d2311c77c5f4e5fdeb8606a0447ea`，镜像为 `sha256:e2635a2cba9a335098b00d39ee76b22dac027c460aba02083ec2fbfd0975386b`，双机归档摘要一致。A 保留 `2b94228e2be32eea` 作为 API 热备，通过本机登录探针。A 的独立送审后台在本机线程排空后交接到同一新版镜像，持久任务留在共享数据库。两机日志采集进程和独立导出进程就绪。
- 15:48，Studio 前端切为 B100/A0，双 VIP 的 14 项路由及 ALB 健康检查通过。已登录的发布测试账号在直连 API 和 Studio 同域代理上共 4 次读到 HTTP 200 及 `status: failed`。返回的 `arkError` 为 `【火山引擎】InvalidParameter.AspectRatioTooLarge Aspect ratio must be between 0.4 and 2.5.`。Chrome 用该 API 回包验收生产素材列表和确认弹窗，在 1440、1280、390 像素宽度下均完整显示，H5 错误码使用模拟响应。发布测试记录已清理，验收未调用方舟送审或付费生成。
- 「修复参考人像弹窗图片放大」会话独立核对两个 VIP 与两个域名，共 16 项画布列表、人像核验、旧静态资源和匿名接口通过。Chrome 1440×900 和 390×844 下，人像列表及画布视频提示词参考图的适应窗口、放大、复位和 Esc 通过。配置节点编辑器通过组件回归，当前没有生产路由。

回退时使用已验收热备，保留向前兼容的 V81，并在原节点接流前核对实际 API、前端和独立后台版本。
