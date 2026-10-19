# Studio 节点交互发布 · 2026-10-11

本轮包含直接素材上传与图片节点替换、按类型创作面板、画布素材侧栏、故事板原节点总览与同屏详情，以及文本节点 AI 意图改稿。视频链补齐 Agnes 2.5 请求协议和供应商错误码映射；后者通过 V51 增加 `material_video_job.error_code`。

发布以当时远端分支最新提交为基础，保留已上线的身份与平台管理功能。其他会话未提交编辑没有进入制品，生产候选、价格和并发配置保持现有真值。

本地免费 Agnes 改稿、刷新持久化与并发手改保护证据见统一验证记录 §49。本轮已于 2026-10-11 13:35 UTC 部署，正式入口为 [创作页](https://aistar.aibuzz.cn/create)，`aiavatar.aibuzz.cn` 兼容入口同样通过登录态检查。

提交前全仓 typecheck、admin typecheck、Java 17 离线编译与 API 契约检查通过。后端文本/价格/队列/视频协议与错误投影定向 49 项通过。前端定向 107 项中 106 项通过，一项在进程暂停期间超时，随后单独复核通过（1 项通过、60 项跳过）；不把意外启动后中止的全量运行计为通过。

发布前备份 `/opt/ai-star-eco/backups/20261011-studio-nodes-133000`：完整数据库压缩转储、旧 JAR 与前端包，权限 0700/0600，gzip 检查通过。发布前 Flyway V50，目标错误码字段尚不存在。

## 部署版本与线上验收

- 代码提交：`f8a6b795b6270c147f5a7c6b328dfabe79675453`，已推送 `codex/unified-ip-studio`。
- 发布包：`20261011-studio-nodes-f8a6b795`，服务 `server` / `web-aiavatar`；在独立干净工作树构建。
- BUILD_ID：`gA3ynC0nZeikyHDXpLbvc`；后端 JAR SHA256 `86f8ab844c942359e607a2eda86611469fb1bf5a924be2d75d0d05e341a32f7c`；前端包 SHA256 `dac1ae45386cd6aa667fd33031399d2c5bd270ad0409ea24f02568301baf0a74`，线上与本地一致。
- 生产 OIDC issuer `https://id.aibuzz.cn`、真实接口、mock/开发登录关闭；制品不含环境文件或本地验收 fixture。
- 两服务 active、NRestarts=0，后端 13:35:41 UTC / 前端 13:35:42 UTC 启动；V51 成功，错误码字段实际存在，失败迁移为零。

部署器首次通用探测将 `/admin` 发送到 AiAvatar 域名并得到 404；该域名没有后台页面。没有修改业务路由或重复部署，指定 `/ /login /create /api/config` 后单独 `verify.sh` 全绿。正式 `/create` 200；登录态画布实际加载的 16 个 JS/CSS 与发布包逐字节一致。

Chrome 在既有 `IPP-30fb3d4c` 验证：空白图片显示上传/生成入口，有图节点显示替换入口；故事板显示 1 文本、7 图片、1 视频。文本详情为上方正文预览、底部 AI 意图输入，正式固定文本模型显示聚算 Qwen3.6、2 积分。类型切换保存后显示同类列表与对应创作参数；商品图片表单不再混入生成视频/加入 IP 操作，视频保留文字引用、素材引用与自身参数。底部文本面板位于详情容器内，无溢出。画布素材库侧栏为 340×723px、y132..855，搜索/类型筛选/空状态/底部添加区均可见，没有被画布底部工具遮挡。

数据库读取确认仍为 9 节点、6 连线；没有新建画布或节点、没有手改正文或提交模型任务，显示余额始终 1303。原画布既有图片 403 失败仍按原记录显示，没有重提或修改厂商配置。真实 AI 改稿结果以 §49 的免费 Agnes 本地记录为证；本次线上验收不称为一次新的真实生成。浏览器错误日志为空。

证据：`.studio-e2e/release-20261011-nodes/` 的 `runtime.txt`、`database-acceptance.json`、`http-acceptance.json`、`backup.json` 与 `online-text-composer.png`、`online-asset-sidebar.png`；提交前检查及最终构建/部署/verify 日志同目录保留。整画布分享及对齐文档内其它待办没有作为本次交付宣称。
