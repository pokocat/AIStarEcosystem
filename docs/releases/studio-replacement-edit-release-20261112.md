# 元素替换改用模型原生编辑发布（2026-11-12）

生产应用提交为远端 `main` 的 `1c5144b2b0bf0174c69b2cb7e7eb0ba99df6d764`，发布范围为 API、A 上的独立后台调度和 Studio 前端。包含两个提交：

- `d75fa2af2`：元素替换不再拉片，也不再让模型写提示词。分析阶段只剩零积分的「切分原片」，切完由代码直接排出制作计划，每段用提示词库 `stage-recreation-replace-edit` 的同一段提示词交给视频模型编辑。模型能不能编辑原视频写在端点的视频规格里（全能参考模式的 `edit`）。Seedance 2.5 走官方编辑任务（`omni_reference_task_type=edit`、`ratio=adaptive`、`duration=-1`，每段原片最长 30 秒），Seedance 2.0 和 H3 继续用全能参考。做法见 `docs/ip-studio-recreation.md`「元素替换不拉片」。
- `1c5144b2b`（另一个会话）：分段视频的脚本上限提到 32,000 字。

契约只新增可选字段（`VideoStudioModeSpec.edit`、`VideoStudioEditSpec`、分段脚本 `text` 的长度说明），没有删改字段，旧前端和新 API 互相兼容。本次没有数据库结构和 DNS 变更。

## 检查

- [Impersonation CI](https://github.com/pokocat/AIStarEcosystem/actions/runs/43227090729) 30 项一次全部通过，包括后端三组测试和 PostgreSQL 18 实库门禁。同一套检查之前在 `d75fa2af2` 上跑过一轮（[run 43217068900](https://github.com/pokocat/AIStarEcosystem/actions/runs/43217068900)），音乐站浏览器检查因为 CI 机器 apt 下载失败重跑了一次，之后全部通过。远端 main 在那之后进了 `1c5144b2b`，所以改发最新 main，重新跑了这一轮。
- [Studio 生产构建](https://github.com/pokocat/AIStarEcosystem/actions/runs/43227130967) 用发布分支 `claude/release-1c5144b2b0bf`，把检出固定到 `1c5144b2b`，并打开企业功能开关。GitHub 制品摘要、`checksums.sha256` 和清单都核对过：`GIT_SHA` 一致，`SERVICES=web-aiavatar`，`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`，`NEXT_PUBLIC_AUTH_MODE=id`，`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`，`NEXT_PUBLIC_USE_MOCK=0`。
- 发布前在 Mac mini 上跑过 463 条相关后端测试、web-aiavatar 和 types 的类型检查以及接口契约检查。

## 发布

发布前 API 和 Studio 前端都由 B 承流，A 热备。账号中心 discovery 返回 200。切流探针用的管理员令牌由用户在已登录的后台页面里用一次性公钥加密后交给本机，本机解密写成 0600 文件，用完已删除。

- **API**：北京时间 21:47 切到 A100/B0。两个正式 VIP 的严格 TLS、就绪和真实鉴权都通过。A 运行 `1ec009e8a3cd2f32`，B 保留 `60d70c9dd97d9caf`（`6def68db6`），并通过了备用机鉴权。JAR SHA-256 为 `1ec009e8a3cd2f327c1bb6e4e89776b0d96c205b84621f6517de98b47167ac66`，镜像配置为 `sha256:421a1ae9445238554962f61f0e9b4e9834b0527cfb5017d405839f2143c71265`，镜像归档摘要为 `8510bddb00a30abd9d272353c96f12c2aedac9e1a17fba91d3a9d21880e48505`。第一次执行时，脚本开头查 CI 结论连 GitHub 超时，什么都没改；网络恢复后从头重跑。
- **独立后台**：A 上的后台在本机执行线程和队列排空后换成同一镜像，已就绪。交接时共享数据库里还有持久任务（`ip_run` 19、`material_video_job` 3、生成队列 22、制作执行 2），留在原记录里，由新后台接着处理。B 的独立后台保持停用。
- **Studio 前端**：A 先在备用端口预检，并合入了 B 在线版本的静态文件。21:52 切到 A100/B0，连接排空用时 5.07 秒，两个 VIP 的路由检查和 ALB 健康检查都通过。A 的 BUILD_ID 为 `bY1-g4kJCyk-ScDWpDRgi`，前端包 SHA-256 为 `f61a8bc685d7b0c32e17d4c52d38aeed6650f39e50aad84b53fbdb6bf0e282ae`。B 保留 `gGHMk9P2ByLXjK3cC3XLF`。Studio 运营后台仍是 `HgxHIZY6ezMPAmeLmiwPq`。
- **日志**：A 上新版 API 和独立后台各有一条启动成功标记，自启动以来 ERROR 为 0。先确认过这种匹配能命中日志的级别字段：同一段日志里 INFO 288 条、WARN 12 条。

## Seedance 2.5 编辑配置

切流后，在 A（新版 API）上用有审计的模型管理命令，给 OneToken Seedance 2.5（`ai-onetoken-seedance25`）的全能参考模式加上：

```json
"edit": {"minSourceSec": 4, "maxSourceSec": 30, "followSource": true, "requestFields": {"omni_reference_task_type": "edit"}}
```

回读和写入一致，只改了 `videoRequestSpec` 和 `updatedAt`，价格、候选、限额和其他端点都没动。改前配置备份在 A 的 `/opt/aistar-cluster/control/replacement-edit-seedance-before-20261112T135321Z.json`。

线上验收：登录态打开 `/video?scene=recreation&tool=replacement`，页面请求的 `GET /api/v1/ip-studio/studio/video-models` 里，Seedance 2.5 的全能参考模式带着上面的 `edit`；H3、Seedance 2.0、Fast、Mini 没有，都和改前一样。页面上元素替换的「限制」已是新文案。没有提交生成任务，没有扣积分。

## 发布后

- **Seedance 2.5 编辑配置已撤掉**：22:13 第一条 2.5 元素替换（`mvj_6cc48e30a531`）提交时 OneToken 直接拒绝，HTTP 400，原话是 `omni_reference_task_type edit/extend billing is not verified for this model`，也就是 OneToken 还没给这个模型开编辑任务的计费。没有受理，没有扣费。随后用上面的备份，经同一个模型管理命令只恢复 `videoRequestSpec`，回读与备份一致，全能参考模式里不再有 `edit`。现在 2.5 做元素替换走普通全能参考，提示词照样是「编辑视频……」；官方文档说这种请求可能被判成编辑任务而异步失败，还没真跑过。这条任务要用户重新发起。
- **Seedance 2.0 第一次跑通元素替换**：`PEX-13e70c2790ee4fabb089`，15 秒原片按镜头切成 7 秒、8 秒两段，OneToken Seedance 2.0、720p、9:16，每段带视频1（原片）和图1（替换的人物）。前两次失败都在 OneToken 那边：22:25 上传原片时素材库 503（`asset_service_unavailable`）；22:27 两段受理后 22:30 上游 `InternalServiceError`（「provider failure confirmed by administrator」，OneToken 已退款）。两次的冻结都已退回。22:32 系统按分段任务的重试原样重交，22:42、22:44 两段出片，22:44 合成 15 秒成片，按 640 + 560 积分结算（赠送积分）。同一时段另一个用户的分镜复刻也碰到一次素材库 503，自动重试。成片效果还没人看过。

## 没验证的

- 2.5 不带编辑字段做元素替换会不会异步失败；OneToken 什么时候开 2.5 的编辑计费。
- 2.0 成片是不是真把人换了、动作口型和声音有没有保持，以及原片字幕和旧商品名的处理，见 `TODO.md`「爆款复刻三种方式」。
- 带视频输入的供应商成本可能高于现在 2.5 的售价（已有 TODO）。

## 回退

2.5 的 `edit` 已经撤掉（见「发布后」），现在线上没有端点带这个字段，可以直接切回 B。以后再给哪个端点加 `edit`，回退前要先恢复它的视频规格：B 上的旧版读到 `edit` 字段会报「视频规格里有不认识的字段」，用改前备份，经模型管理命令 `endpointSave` 只恢复 `videoRequestSpec`。之后用同一个滚动入口把 API 和前端切回 B 上已验收的原版，独立后台按本机排空状态交接，先核对仍在途的任务。旧版收到元素替换任务时走原来的「拉片 + 写分镜脚本」；新版受理、分析阶段只有「切分原片」的任务，回退后需要重新开始。
