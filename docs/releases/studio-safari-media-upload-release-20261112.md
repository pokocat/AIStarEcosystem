# Studio 媒体上传修复

2026-11-12 21:50 PST，Studio 前端从 A100/B0 切为 B100/A0。发布号 `20261112-studio-safari-media-9c3ea7ff2`，应用提交 `9c3ea7ff24c241ae6ae598c3f1511e7fba35d076`，发布组件为 `web-aiavatar`。B 的 BUILD_ID 为 `3m1WmGhQkEDzxmz_TnyvH`，A 保留 `gGzj2sz9mXlMOeguZ1whg`，可通过前端 ALB 权重切回 A。

Safari 26.5.2 从同一可触发故障的目录选取 PNG、MP4、WAV 和 112 MiB MP4 时，直接用文件选择器返回的 `File` 组装 multipart 会发出 0 字节请求体。桌面 Chrome 使用相同文件和目录时四次均完整到达。使用 `Blob.slice()`、原文件名和 MIME 类型构造 multipart 后，Safari 四次均完整到达。此写法避免在 JS 堆中复制整段大视频。素材库、画布媒体及封面、导演台图片和音频上传共用该处理。[WebKit 缺陷记录](https://bugs.webkit.org/show_bug.cgi?id=319985)

- Safari 线上旧版复现素材库视频、音频，画布图片，导演台图片、角色参考音频上传返回 500。新版用相同文件和体验账号复验，素材库和画布的 PNG、MP4、WAV，以及导演台角色图片、参考音频均返回 200。画布生成了对应媒体节点，导演台显示图片及音色已设置。112 MiB 视频在本地浏览器与 HTTP 接收端复验。
- Mac mini 92 项测试通过，工作区类型检查、后台类型检查、后端编译及 API 契约检查通过。[完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43374047590)
- 生产包 SHA-256 为 `9666b9660d48a79b2f30f162c0c2039f54833f572e7bdb30dd68e2b913256135`。B 的备用端口预检通过，切流后两组正式 VIP 的路由、静态资源及 ALB 健康检查通过。[生产制品构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43374056284)
