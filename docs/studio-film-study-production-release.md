# 视频解析与拉片：生产发布记录

2026-10-16 02:05 UTC（北京时间 10 月 16 日）。已发布后端和创作工作台。

- 后端运行代码：`35b2fcc0b129518ef07705fb362b030bd4664973`；产物 `20261015-film-study-35b2fcc0`。
- 前端产物：`20261015-film-study-84c2f2d6`，代码 `84c2f2d618c05e321126a564ebf6d59aebfe9300`；后续两次修正仅涉及后端媒体运行时，前端代码未变。
- 以上代码已推送 `codex/unified-ip-studio`。保留企业功能及当前生产后台分页、Prompt 条件保存修复，没有重发 admin。
- 入口：[创作工作台](https://aistar.aibuzz.cn/create)。选择视频节点 → 素材拆解 → 解析 / 拉片；全片报告也可继续拉片。

## 发布内容

解析生成可编辑的全片创作拆解 Markdown。拉片按叙事段落规划时间范围，真实裁切视频、逐段生成 Markdown，再在画布增量落成片段分组。确认后关闭紧凑设置面板，在任务节点看进度；片段可播放，文字共用剧本编辑器保存、导出，刷新恢复原任务。失败继续复用已完成片段及已有裁切。

复用既有 Studio 请求、队列、归属与积分链。没有新增数据库迁移；生产仍为 V58。模型正文只用于串联流程，不做叙事准确度的硬校验。

## 生产依赖与修正

实际媒体探针发现原共享 ffmpeg 是 2018 年版本，不支持 Hypit 的 `fps_mode` 及裁切所需参数。新增 `AEP_STUDIO_RECREATION_MEDIA_BIN=/opt/ai-star-eco/hypit-runtime/bin`，仅解析和拉片子进程使用独立 FFmpeg，其他业务继续使用原运行时。任务受理前执行微型媒体能力探针，不满足要求时在冻结前返回 `STUDIO_HYPIT_UNAVAILABLE`。

独立二进制来自 `ffmpeg-static@5.3.0` 的固定 GitHub 发布资源，实际版本 `7.0.2-static`；SHA256 `e7e7fb30477f717e6f55f9180a70386c62677ef8a4d4d1a5d948f4098aa3eb99`。来源和哈希另存生产 `/opt/ai-star-eco/hypit-runtime/source.json`。未替换共享 `/usr/local/bin/ffmpeg`。

## 验证与边界

- 发布前：106 项前端专项、54 项合并后端回归通过；媒体运行时修正后再跑 10 项解析/拉片测试通过。workspace/admin 类型、API 契约、Hypit 资源一致性、后端与前端正式构建通过。
- 发布后：后端和前端 active；JAR 与发布产物 SHA256 一致（`e74a2080706c3971ef6b92472760ae1f082107cd931e8972f4c7517e777b9edf`），前端 server.js、BUILD_ID、包含解析/拉片入口的 chunk 与产物一致。
- `/`、`/login`、`/create`、`/enterprise`、`/api/config`、后台登录正常，`/projects` 按既有逻辑跳转；主服务、依赖服务、CJK 字体、SAU 和 nginx 检查全部通过。企业开关仍为 true，开发登录仍为 false。
- 生产机直接使用恐龙原片：512 帧，原始时间 0–17.033333 秒，15 个视觉变化候选；真实裁切 4.800 秒，1280×720 H.264/AAC。临时媒体与目录退出时清理。
- 使用生产 JAR 的真实 Java 类单独运行媒体 readiness，结果 `DEPLOYED_JAVA_MEDIA_PREFLIGHT_OK`，确认 Node/Hypit、独立 FFmpeg 和参数能力可用；没有启动第二个业务服务。
- 完整模型→五段裁切→画布增量→播放→编辑保存→刷新→Markdown 导出已在本地恐龙 demo 验收，见[培训手册](training/studio-film-study.md)。本轮生产浏览器上传先受扩展本地文件权限限制，后因当前页面访问限制中止，故未重复完成线上模型/编辑全链实操，不据健康检查宣称已做此项。没有新增生产收费模型调用。

本机首次公网脚本探测遇到 DNS/网络路径超时，固定目标域名到真实生产 IP、保留 HTTPS 主机名与证书校验后，最终 `verify.sh` 全绿。

## 备份与回退

发布前数据库、旧 JAR/前端备份位于生产 `/opt/ai-star-eco/backups/film-study-20261016T015331Z/`，目录仅 root 可读；新增媒体配置前的 `server.env-before` 同目录保存。数据库没有新增迁移，不回退客户数据。若仅撤回本功能，应保留企业账本及已上线后台修复兼容代码，优先关闭入口；恢复旧服务产物前复核企业付款与在途任务兼容性。教学视频保留为本地文件，未上传网站。
