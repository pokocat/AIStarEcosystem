# Studio 官方形象扩容生产发布

2026-11-14 15:16（北京时间）完成生产切流和验收。[官方形象](https://aistar.aibuzz.cn/assets?tab=official)现有 40 位免费内置形象，商务专业、生活方式、内容创作、潮流娱乐各 10 位。

- 功能提交为 `1a0f7f0c104520837a0d870f072d75d81c09bf04`，PostgreSQL 测试基线修正为 `452fa9dd001f9269bc083777d0a98754af898ce1`。实际发布的主线应用提交为 `3b6e5c32c08a6c2a714d0f1aa4fbbd5ae10a7977`，包含同期合入的人像核验和视频编辑代码。[完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43568422129)通过，PostgreSQL 18 实库门禁 9 类 80 项全部通过。[Studio standalone 构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43568447533)使用同一应用提交。
- 生产 PostgreSQL 以迁移角色执行 V83，给 `dap_public_avatar` 添加可空的 `three_view_key`。以应用角色确认严格 TLS、读写权限和旧版兼容。新版备用 API 完成入库后才切流。共写入 33 张新头像、40 张合成参考图，并沿用 7 张原头像。逐张校验生产 OSS 的签名 HTTPS 响应、JPEG Range 读取、整图 SHA-256 与应用资源一致，并确认篡改签名被拒绝。
- 前后端各自的 ALB 后端组均为 A100/B0。A 的 API 和独立后台使用 `b84a3bbc49f88c21`，JAR SHA-256 为 `b84a3bbc49f88c219ffbe8258746993030d43a0c22d8bec045bc930a58a2d70e`，镜像配置摘要为 `sha256:ae2c66ac5731a7fc61edf5830651d7570efda5810bd89d585be0777d42e68d20`。后台排空后换版，就绪通过，重启计数为 0。B 保留上一版 API `a3721995a257b425`。双 API VIP 的就绪、普通账号鉴权、匿名 401、后台 403 均通过。
- A 的 Studio 前端为 `20261113-official-avatars-3b6e5c32c`，BUILD_ID 为 `ygy5Kj1e3NW9FKL9Ejow1`，归档 SHA-256 为 `d71b3324edf13a89b6cd1a31eb48ab94a98afbf0b8f9e0ee58426502b2a601e8`。B 保留上一版 BUILD_ID `FNTQyS1iEuc6CYoJ3u0_x`。两个前端 VIP 的路由、静态资源与健康检查通过，共 38 项。
- 登录线上 Studio，验证四个分类各 10 位、三个指定形象已从库和选角弹窗下架，以及 Luna 陆灵的方形预览头像与 1536×1152 合成参考图。视频选角可选中该形象，「使用」按钮可用。保留三个下架形象的历史数据，供旧项目读取。此次验收没有提交付费视频生成。
- 发布窗口两机的 API 和后台错误计数为 0，SLS `aistar-app` 聚合确认有发布后的日志。回退使用 B 的原 API 和前端，按[生产发布手册](../runbooks/aistar-production-release.md)独立恢复流量。V83 已验证兼容旧版，可保留。独立后台回退配置在 A 的 `/opt/aistar-cluster/control/background-before-b84a3bbc49f88c21.conf`，恢复前排空本机工作。
