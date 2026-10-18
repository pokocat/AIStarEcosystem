# Studio 视频节点暖白配色发布 · 2026-10-17

已生产发布；洛杉矶日期 2026-10-17，服务启动于 UTC 2026-10-18 03:30:13。

## 范围与校验

- 代码 `2011deda9a96e00eb4fc9867e44f6ae7d1513e28`，已推送 `origin/codex/unified-ip-studio`。
- 仅更新 `web-aiavatar`：视频节点媒体面暖白 `#faf7f0`，标题/状态栏白色，深墨文字与米灰边线，与外围蓝灰画布区分。
- 从本次暂存内容建立隔离目录构建，不包含其他未提交工作。保留真实 API、统一登录、关闭 dev login、企业功能开启；未修改生产环境文件、数据库或钱包。
- 全仓类型、后台类型、后端离线编译与 API 契约检查通过（保留既有 handler 警告）；18 项相关定向测试通过，正式构建成功。
- 拖动反馈仍待定位：本地正常/失败空节点、手形/选择工具及缩小状态可拖动中间区域，不宣称修复尚未复现的线上问题。

## 制品与线上验收

- Release：`20261017-studio-video-warm-1792294137730`。
- 前端包 SHA256：`56a8d1cbf8a12e3f45d03fce56ee071f362a1aaa8c1970eedc4ef0ecbec8e42f`。
- 线上 BUILD_ID：`brRlohQ2YFmi3-70t8zQe`，与包内一致；远端清单及制品校验均通过。包内无 `.env*`、`.studio-fixtures` 或临时节点验收路由。
- `deploy-release.sh` 成功，`verify.sh ALL GREEN`；首页、登录、项目、灵感、创作与 `/api/config` 均返回 200，相关服务 active。
- Chrome 实际打开“灵感 → 爆款复刻”只读模板，视频节点存在 `studio-flow-video-card`，媒体底色为 `rgb(250, 247, 240)`。未创建副本、修改用户画布或调用收费生成。
- 截图：`/Users/donis/.codex/visualizations/2026/10/17/01a14acf-968e-7a03-8a88-0aa9b0bd27b6/studio-video-warm-production.png`。
- 后端启动时间仍为 UTC 03:15:00，本次没有重启后端；上传临时目录已清理。

## 回退

回退包为 `/opt/ai-star-eco/backups/20261017-studio-warm-before-2011deda/web-aiavatar.tar.gz`，其 BUILD_ID 已与更新前实际版本 `bPJAf6CqTShLYkMy1SmOD` 核对。

本记录为发布后文档提交，运行制品仍固定为代码 `2011deda`。
