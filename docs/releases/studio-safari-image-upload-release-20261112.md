# Studio Safari 图片上传修复

2026-11-12 21:18 PST，Studio 前端从 B100/A0 切为 A100/B0。发布号 `20261112-studio-safari-upload-07b7abcff`，应用提交 `07b7abcff88973539a94783aa40706fcf99dde42`，只发布 `web-aiavatar`。A 的 BUILD_ID 为 `gGzj2sz9mXlMOeguZ1whg`，B 保留 `9j8O0bMZyKFkW1zBDPwA1`。

Safari 26.5.2 把文件选择器返回的磁盘文件直接放入 `FormData` 时，复现了浏览器发出 0 字节请求体。素材库现在先完成现有图片预处理，再将处理结果读成内存中的 Blob，使用原处理结果的文件名和 MIME 类型发送。视频和音频上传未改动。

- Mac mini 48 项上传相关测试、工作区和后台类型检查、后端编译、API 契约检查通过。[发布制品构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43370055451)通过，包 SHA-256 为 `3516d2013e432b9b78d5df3925080f7ae95ef9e888121575a35855978ae2c832`。
- [完整 CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43370024884)的契约、Studio 两组前端测试与浏览器构建通过。另一项后端导出修复更新 `main` 后，GitHub 取消了旧任务仍在运行的 PostgreSQL 迁移检查。已核对截至 `bc6a2f477` 的差异仅包含后端导出实现和测试，本次前端源码和构建输入相同。
- A 在备用端口通过制品预检，排空后启用新版。21:19 PST 两个正式 VIP 的路由和 ALB 健康检查通过。回退可将前端流量切回仍运行旧版的 B。
- 同一台 Safari 26.5.2、同一体验账号、同一张合成 PNG，旧版 `POST /api/v1/ip-studio/library/uploads` 返回 500，追踪号 `NFAZZVyHtvMAErm9`。切流后返回 200，追踪号 `GCxJF773ArbHHKfa`。页面显示图片已入库，测试图随后从资产列表移除。
