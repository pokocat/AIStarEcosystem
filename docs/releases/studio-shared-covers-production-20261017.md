# Studio 统一画布封面生产发布 · 2026-10-17

已提交、推送并部署 server,web-aiavatar。生产启动时间为 2026-10-17 22:54 America/Los_Angeles（2026-10-18 05:54 UTC）。

## 版本与范围

- 部署代码 a4092626（codex/studio-shared-covers-release）。以实际线上前端 79667715 为基线，只叠加统一封面变更，保留线上分组说明、图片压缩和输入控件修复。原工作区其他未提交功能没有混入。
- 发布标识：20261017-studio-covers-a4092626。仅 server、web-aiavatar；统一身份、企业开关及现有生产环境文件不变。没有新迁移，线上仍为 V58。
- 项目/灵感共用人工封面 → 自动图片 → 实际画布缩略图；共用独立上传、选图、恢复自动、失败重试。内置官方模板覆盖仅写平台配置，不复制模板文档。
- 新前端 BUILD_ID：egW_ma2wyqTnbebHd92y1。
- JAR SHA256：4501c0516a06d6ae670bd35632a0f89ca1da6f6558a3c54064480284f76ea6ab。
- 前端 tar SHA256：a91a7db0cfa62f8e665ea8fd493f2f70d69236870c10e8c3b5dd50704b0df70e。

## 验证

- 提交前全 workspace 类型、admin 类型、Java 17 离线编译、API 契约及 diff 检查通过。前端 21 项、服务端 92 项定向测试通过（生产分组基线比前轮多一项模板测试）。标准生产构建成功，制品没有 .env 或本地验收目录。
- 两服务 active；线上 JAR 与 BUILD_ID 精确匹配本次制品。封面 JS 与 CSS 的公开 HTTPS 内容 SHA256 与本地一致。V58 验证成功，本次启动日志未见 ERROR。
- 首轮 verify 的本机 HTTPS 探测因路由超时失败，远端服务及页面实际为 200；使用已验证的 en0 与域名解析参数单独重跑 verify 后 ALL GREEN，没有重复部署。上传暂存目录已清理。
- 使用既有真实生产登录会话，在本人账号创建临时项目 IPP-d84b127d，上传一张微小纯色 PNG 作为画布图片；列表自动图片封面正常。
- 在真实页面上传另一张独立封面，保存后及刷新后均显示上传图且实际加载成功。项目仍只有一个节点，docVersion 保持 07719dad3a665db4，封面没有进入画布。
- 在真实页面恢复自动封面，服务端重新返回原画布图片；非法选图返回 400，画布版本不变。
- 真实灵感页当前 9 张官方模板中，两张有素材模板正常加载图片封面，其余 7 张无图模板显示真实画布缩略图。普通用户不显示官方封面管理按钮；官方管理员/内置模板写权限由服务端与前端定向测试覆盖，未为验收改动现有官方内容。
- 验收后通过本人 DELETE API 软删临时项目。没有调用生成、扣费或修改开通；原有用户项目没有改变。画布源图随软删除项目保留，恢复自动时触发独立封面清理。

本地截图、制品/公网校验及日志位于 .studio-e2e/shared-covers-release/（忽略目录）。production-inspiration.png 为真实线上模板页面，production-upload.png 为临时验收项目。

## 回退

备份：/opt/ai-star-eco/backups/20261017-studio-covers-a4092626/。

- server.before.jar：156cf9fb0451d358d369d42c67a784764272e89b0d58c8af7fd441b805d3b8b4。
- web-aiavatar.before.tar.gz：45939e364aa209acc61ead8ccd0cd413f0e8f65ac30eb258144d7b9f99cdc1c4。旧 BUILD_ID 为 eL9Op7RGvHkqI-pIE7Qfy。

恢复对应制品并重启这两项服务；保持环境配置与数据库不变。后续文档提交不代表重新构建，实际运行代码固定为 a4092626。
