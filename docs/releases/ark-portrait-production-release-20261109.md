# Seedance Fast / Mini 官方人像素材库生产发布（2026-11-09）

## 结果

已发布 `20261109-ark-portraits-137b5754`，代码 SHA `137b5754dc59d3de9fcaa86980de68654a233f71`，范围 `server,web-aiavatar`。功能 PR [#178](https://github.com/pokocat/AIStarEcosystem/pull/178)，功能提交 `c492f87f6`。Studio 企业入口构建开关沿用线上值 1；未修改生产环境文件、售价、默认模型或其他端点。

通过现有签名、审计管理命令 `videoAssetLibrarySave` 创建 `ark-bingbing`，项目 `bingbing`，AIGC 组 `group-20261109112741-sqzp2`；配置保存前由新服务真实调用官方 `GetAssetGroup` 验证项目和素材组。AK/SK 加密入库，不出响应或本文。

| 模型 | 端点 | 素材库 | 状态 |
|---|---|---|---|
| Seedance 2.0 Fast | `ai-1fb0d9ce-d74` | `ark-bingbing` | 启用 |
| Seedance 2.0 Mini | `ai-d91e6ae3-6df` | `ark-bingbing` | 启用 |

两个端点均保留官方 `https://ark.cn-beijing.volces.com/api/v3`，API Key 沿用此前已切换的新 Key。更新时携带原有配额字段，避免管理接口的缺省清空语义；完整 DTO 前后比对仅 `assetLibraryId` 改变，其他端点完全一致。[脱敏回读证据](evidence/ark-portraits-20261109/bindings.json)。

## 验证

- 独立工作区基于最新 `origin/main`，未带入原目录里的视频复刻等并行修改。
- Mac mini devq `d40a73a883ae` 退出码 0：9 类后端共 102 项、12 个 workspace 串行 typecheck、API 契约、5 文件 72 项前端测试通过。
- 构建任务 `555f0de95857` 退出码 0，使用 pnpm 10.33.2，生产 server / Studio 包校验和全部通过。发布脚本的后端 package 跳过重复测试；不能把它当作上述测试的替代。
- 功能 PR 的 CI 三个后端分片、其他前端与构建检查通过；核验弹窗集成用例因把表单提交和后台十秒轮询混在一起而超时。后续测试提交 `817e921d8` 将其收敛为查询已经提交的素材再恢复原任务，并等待框架 loading 结束；Mini `e7cd154e79fe` 三项测试 1.53 秒通过。该修正仅测试，不改变发布制品。
- `deploy-release.sh` / `verify.sh` 退出码 0，ALL GREEN。`/`、`/login`、`/assets/verification`、`/api/config` 均 200；systemd 两个目标服务 active。
- MySQL Flyway V78 于北京时间 2026-11-09 13:13:52 成功，新增 `video_asset_person`、`video_asset_portrait` 及素材库加密凭据列；V75 保持不变。
- 运行 JAR SHA256：`b936fdb16a1bd1e1c10b4271a5dfd35dd85f240fff4c6798011fae0fbff13528`；Studio BUILD_ID `EbRQYQr8pm8ZgKwTJmqEw`，与本次制品一致。
- 浏览器在现有登录态打开 [人像核验页](https://aistar.aibuzz.cn/assets/verification)，显示「人像素材」「本人核验」和可用的「添加人像」，本人列表为空，无素材库未开放或接口错误；未创建用户素材、未同意声明、未发起真人核验或视频生成。

## 用户流程与边界

生成前检查先于视频积分冻结；需要声明或本人核验的素材在当前页面处理，全部使用 Ant Design 控件。素材 Active 后继续原操作。官方明确拒绝且无供应商任务号的兜底任务，保留原请求和冻结最多 30 分钟，超时释放；已有供应商任务继续查原任务，不重复生成。

官方虚拟样本入库 Active 与 H5 会话创建先前已真实验证。本人真实刷脸、真人一致性审核和真人成片仍待本人参与，不能以本次部署、登录态空列表或示例预览替代。

## 备份与回滚

发布前备份 `/opt/ai-star-eco/backups/20261109-ark-portrait-before`：数据库结构、模型与素材库配置及 Flyway 记录、原 server JAR、原 Studio 前端；目录 0700、文件 0600。没有把数据库凭据或备份内容传入源码。

若回滚，先用当前管理接口解除这两个端点的 `assetLibraryId`（同时带回原配额字段），再还原备份的 server JAR 和 Studio 包并重启两项服务、重跑 verify。保留 V78 表和已有授权数据，不回滚或篡改迁移历史，不通过重提旧视频任务恢复。已启动的官方任务仍按原记录对账。
