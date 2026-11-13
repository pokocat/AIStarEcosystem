# 微信视频下载发布（2026-11-13）

应用提交 `73689c5f6347b1760c86baea7605eed42ea7ddea` 已合入 `main`。IP Studio 和短剧画布在微信内打开独立视频预览页。用户通过微信右上角菜单打开系统浏览器后，页面自动尝试下载，并保留手动下载按钮。

- **制品与检查**。正式 [CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43412493971) 30 项通过，包含后端三分片和 PostgreSQL 18 实库门禁。[生产前端构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43412715809) 固定检出应用提交，启用生产 OIDC 和企业功能。前端归档 SHA-256 为 `a5471c1c71df195724963124f00a4a13bd2a15ea21bce0a7f8fe54eb0587d504`。
- **API**。北京时间 19:10，B 通过本机就绪及鉴权检查后接管 100% 流量，A 保留 `99cfea744`（`3226e5fbc1e653c3`）作为零权重热备。新版 `680060b2b411c881` 的 JAR SHA-256 为 `680060b2b411c8815171e5bb715ba177b8deee0e0088f535d64e1c700a01c53d`，镜像配置为 `sha256:770676680a606d03973595e56746d803b94d17b80baf29bf54bcdcb2d1c0bdfd`，两机镜像归档 SHA-256 为 `46bb07aa806be84a71375499ccc3a573458e5bd8efb4f1b2ebc2ac9593770039`。运行账号 `aistar_app` 使用 TLS，生产 Flyway 保持 V81，Tair 使用 DB15。
- **前端**。北京时间 19:12，A 上的两个新版本通过备用端口预检、双 VIP 和 ALB 健康检查后接管 100% 流量。`web-aiavatar` 的 BUILD_ID 为 `yb0sRHsI_sDdqhksViAYR`，归档 SHA-256 为 `f1696a8a52414850fa5d2b3822d95980f910d0fa8d7acf396804c1c2fd5f7468`。`web-drama` 的 BUILD_ID 为 `AnS1YIJHDUjBqTnIrmVIF`，归档 SHA-256 为 `09134babf46e7702bb7470b05225026204ca5055a83939b74a4d056749bf7a01`。B 以零权重保留旧版，BUILD_ID 分别为 `aIvjoEJCzfw8oVEUZ4XbJ` 和 `RBxQ-2ORZNIFfH0xAcypH`。新版保留两个旧节点的静态文件，旧版构建清单仍可访问。
- **独立后台**。与生产基线相比，远端 `main` 还包含已合入的 Studio 预算恢复逻辑。A 上 `aistar-background` 暂停领取，在途请求、线程、队列及调度计数连续三次归零后换版，19:13 确认新版就绪。两机 `ilogtail` 均在运行，节点启动日志已核对。
- **业务验收**。两个正式 VIP 上，凭证兑换返回 200，无效凭证返回 410，匿名签发返回 401，已撤销开通的发布探针账号返回 403。真实 OSS 样例的预览和附件链接返回相同的 Range 字节，响应为 206。用微信 UA 在两个线上站点验证了视频预览和右上角指引，用普通 Chrome 验证同一地址自动保存 `下载验收.mp4`。两个下载均为 13,362,580 字节且 SHA-256 一致。使用短期发布探针凭证，真实登录账号的签发及 iOS、Android 微信真机菜单跳转未在本次线上验收执行。
- **切流观察**。696 次公开探测未收到 HTTP 5xx，记录了 5 次客户端未收到 HTTP 响应的传输异常，随后探测恢复。前端预置完成后发生一次 ALB 查询连接中断，重新核对当前权重和已预置制品后继续切流。发布未修改数据库结构和 DNS。

如需回退，先核对热备制品、当前数据库兼容性和已受理工作。先把前端流量切回 B，再用 API 正式发布入口将流量切回 A。独立后台通过排空和校验恢复对应制品。
