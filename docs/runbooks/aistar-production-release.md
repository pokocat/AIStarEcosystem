# AIStar 生产发布与恢复

适用于 2026-11-12 正式切流后的 AIStar。正式 API 经 `api.aibuzz.cn` 和阿里云 ALB 由一台节点承接 100% 流量，另一台为零权重热备。两台 API 连接同一 PostgreSQL、Tair 和杭州业务 OSS。A 独立运行后台调度与 SAU，API 两台均关闭定时后台。节点、正式及演练组、域名和排空参数以 [集群配置](../../infra/cluster/production.json) 为准。

| 变更范围 | 发布入口 |
| --- | --- |
| `server` API | [`infra/scripts/deploy.sh server`](../../infra/scripts/deploy.sh)，默认更新正式备用机并切流，`--plan` 展示计划。 |
| PostgreSQL 结构 | 用迁移角色执行独立的向前兼容 DDL，并验证当前与候选版本；运行账号只做 Flyway 校验，API 滚动不会执行 DDL。 |
| A 上的后台调度、SAU | 独立验收和角色交接。API 滚动不会更新这两个单元；涉及定时任务、领取逻辑或发布驱动时，把相应组件列入发布范围。SAU 真镜像需通过 `prepare_real_runtime.py` 的四个发布驱动导入，`/healthz` 仅作就绪证据。 |
| Studio 成片导出 | A 上的 `aistar-studio-export` 独立运行。首次发布先启动并验证专用进程，再切换会写入导出队列的 API 和后台。 |
| Web、admin、studio-admin | 目标为前端 A/B，发布走独立 ALB 后端组。使用下方前端发布步骤。 |
| 账号中心、军师及其他应用 | 按各自仓库的发布说明处理。账号中心入口在 [aibuzz-id](https://github.com/pokocat/aibuzz-id/blob/main/deploy/README.md)。 |

旧 ECS 上的前端及回环代理为 DNS 缓存和前端回退保留。旧 ECS 禁止作为新发布目标。旧 AIStar API 和旧 SAU 已停用，生产发布与恢复都禁止重新启动它们。历史单机脚本 `deploy-local.sh`、`deploy-release.sh`、`update-and-deploy.sh`、`rollback.sh` 以及旧版 `verify.sh` 均不能用于 AIStar API 正式发布或验收。不要给新入口设置旧部署变量 `DEPLOY_HOST`、`ECS_HOST`、`REMOTE_ROOT` 或 `PUBLIC_BASE`。

## 1. 选定版本与验证制品

1. 先合入远端 `main`，锁定本次发布的准确提交。以两机实际运行 SHA 为基线，核对差异和影响范围，尤其是共享数据库、异步任务、支付、前端 DTO/API 契约。前端和后端存在不兼容变更时，先做过渡兼容或安排协调发布。保留工作区其他任务；干净源码与重任务按根目录 `AGENTS.md` 的 `devq remote` 规则处理。
2. 应用源码或构建输入变化时，在准确的 `main` 提交上运行 [Impersonation CI](../../.github/workflows/impersonation-ci.yml)。可手动触发 `gh workflow run impersonation-ci.yml --ref main`，核对该运行的 `headSha` 和最终结果。下载同次运行的 `verified-backend`，其中有已验收 JAR、工具及 `verified-backend.json`。后端分片、PostgreSQL 18 实库门禁及本次适用的其他检查全部通过后再打包。只有发布脚本或文档变化时，按变更范围验证脚本，并在核对应用源码树、构建输入和制品摘要后复用已验收制品。旧的 `deploy-production.yml` 仅构建传统目录制品。
3. 从与发布 SHA 一致的源码执行以下打包命令。ECS B 使用固定镜像原生打包，通过 SSH 向 A 传输镜像。脚本校验 JAR、镜像归档、镜像配置和双机身份。保留包、`manifest.json`、传输验收结果和 CI run ID。输出目录须为新目录。

   ```bash
   gh run download "$CI_RUN_ID" --name verified-backend --dir "$VERIFIED_BACKEND_DIR"
   python3 infra/scripts/cluster/bundle.py \
     --verified-backend "$VERIFIED_BACKEND_DIR" --output "$NEW_BUNDLE_DIR"
   ```

   `VERIFIED_BACKEND_DIR` 指向包含 `verified-backend.json` 和 `ai-star-eco-server-1.0.0.jar` 的目录。若下载目录保留了层级，先定位这两个文件。发布包使用 `candidate.tar.gz`，`RELEASE_ID` 取打包输出的 `release`（JAR SHA-256 前 16 位）。

## 2. 更新 API 备用机并切流

发布前核对账号中心 OIDC discovery、两个正式 ALB VIP 的严格 TLS 和实际节点身份、两机当前制品、PostgreSQL 结构及运行角色、Tair、SLS 和相关业务依赖。保留上一版可用制品及其数据库兼容证明。对需要演练的变更使用 `--stage` 对应的演练组、演练 PG 与 Tair DB14，使用该组自己的探针和凭据。

更换正式 API JAR 时，默认使用专用账号 `aistar-release-probe`。该账号无后台角色、有效产品开通、手机号或密码。五个产品各有一条 `REVOKED/LEGACY` 记录，防止服务启动时按旧账号规则补开全部产品。发布脚本通过现有 SSH 在生产节点内为固定账号签发 90 秒的普通用户令牌，签名密钥和令牌只在节点内使用。切流前检查当前承流节点的两个 VIP 和备用机的本机端口，切流后再检查两个 VIP。每处都要求就绪 200、登录的 `/api/me` 200 且返回预期账号、匿名的 `/api/me` 401，以及探针账号访问 `/api/admin/auth/me` 得到 403。任一项失败会阻止发布或触发切流回退。此检查覆盖 API 的用户验签、身份查询和后台权限拒绝。

演练环境和需要额外验证后台已登录权限的发布使用显式 `--probe-file`。文件放仓库外，权限 `0600`，`host` 匹配目标域名，提供 `header`、`key`、能读取 `/api/admin/auth/me` 的短期授权 `token` 和预期 `subject_id`。

```bash
./infra/scripts/deploy.sh server --plan
./infra/scripts/deploy.sh server \
  --bundle "$NEW_BUNDLE_DIR/candidate.tar.gz" --release "$RELEASE_ID" \
  --receipt "$NEW_RECEIPT_PATH"
```

首次建档使用 `infra/scripts/cluster/ReleaseProbeAccount.java`。在 devq 编译后，将编译结果临时放到已核对、零权重的正式 API 容器，在容器现有 JDBC 配置下运行 `ReleaseProbeAccount --provision`，再清理临时文件。工具只为固定普通账号建档和补齐缺失的撤销记录。遇到同名冲突、停用、有效开通或权益发放记录会报错。

2026-11-12 已完成正式账号建档及幂等重跑。A、B 的本机检查和 B 承流时两个正式 VIP 的鉴权检查均通过。验收使用当前制品 `1ec009e8a3cd2f32`，ALB 权重为 A0/B100。

脚本持有集群发布锁。它核对 ALB 权重，在两个 VIP 上验证当前承流节点，再准备零权重备用机。从旧的 A50/B50 状态启用本流程时，先确认双机健康，再收敛到 A100/B0。

仅更新 API 容器运行配置时，核对当前承流制品与远端 `main` 的应用源码和构建输入一致。用同一制品加 `--refresh-runtime`，可以省略 `--probe-file`。脚本通过 SSH 调用节点本地受保护的部署接口，核对运行制品、配置及就绪状态，并在两个 VIP 上验证严格 TLS、承流节点、就绪 200 和管理员接口的匿名请求 401。这个入口只能复用当前承流制品。

备用机连续三次确认该机 HTTP 请求、服务端口连接、执行线程和本地执行队列已排空，再更新。ALB 保留原连接的排空窗口，脚本根据实际连接和请求状态决定何时开始更新。脚本校验待更新节点的实际容器已关闭后台调度。共享数据库中的生成任务由独立后台继续处理。数据库迁移停写仍要求所有持久任务排空。

新版备用机通过本机就绪及鉴权后接管 100% 流量，再通过两个 VIP 核对实际节点身份、就绪和鉴权。旧承流机保留原版并进入零权重热备，供下次发布或回退。新版切流验收失败时恢复已验证的原承流机。零权重节点仍处于排空时，可从同一入口续跑。回退前确认旧版兼容当前数据库和已受理写入，再用其已验证制品走同一切流入口。

## 3. Studio 成片导出进程

生产角色按 [systemd 单元模板](../../infra/cluster/aistar-studio-export.service.example) 启动，使用同一批已验收后端镜像的配置 ID。进程监听 `127.0.0.1:18087`。根用户把已核对的生产 API 环境派生到 `/opt/aistar-cluster/control/env-studio-export`（权限 `0600`），设置 `AEP_IPSTUDIO_EXPORT_WORKER=true`、`AEP_BACKGROUND_ENABLED=false`，使用 `/usr/bin/ffmpeg` 和 `/usr/bin/ffprobe`。关闭视频封面回填和启动时的素材种子。给 `/opt/aistar-cluster/state/studio-export-tmp` 配置独立磁盘目录，容器用户为 `10001:10001`。

进程和 FFmpeg 共用 2 核 CPU、2304 MiB 内存和 128 个进程或线程，JVM 堆上限 768 MiB。PostgreSQL 保留提交记录并保护单一导出槽。同一任务异常退出后自动恢复一次。验收检查 `/internal/ready`、实际 cgroup 限额、排队和渲染阶段、OSS 产物可读性及容器 OOM 计数。

更新专用进程前持有集群发布锁，在该机调用受保护的 `POST /internal/deployment` 暂停领取。连续三次确认 `scheduled_active`、`in_flight`、`executor_active`、`executor_queued` 为零后更换镜像，等待新版就绪。仍在等待的记录由新版继续领取。切回早于独立队列的 API 或后台时，保留能处理已受理导出的专用进程，等队列排空后再停。

## 4. 前端发布

2026-11-12 北京时间 10:41，`aiavatar`、`aistar`、`admin`、`drama`、`music`、`celebrity`、`star`、`incubator`、`ipstudio` 的独立 DNS 记录已指向正式 ALB。`aistar` 同时承接 Studio 管理后台，`ipstudio` 保留跳转和原登录回调提示。前端使用独立后端组 `sgp-chl8uqmlza6yjvdmlj`，同样以一台承流、另一台热备的方式发布。两机的 `aistar-front-*` 服务使用已核对的 Next.js standalone 制品及固定运行镜像。前端同域 `/api/`、`/static/` 和 `/cdn/` 通过严格 TLS 到正式 API ALB。前端和 API 组分别记录承流节点。

- 从已验收的 `main` 为目标站构建一次，将 standalone 制品预置到备用机，核对摘要、`BUILD_ID`、环境及各站路径。使用版本目录保留上一版和仍可能被旧页面请求的静态文件。前端和 API 分别发布，按契约兼容性确定先后顺序。
- 在新端口或待发布节点验证页面、静态文件、同域 API、登录、作品及涉及的管理路径。确认原节点覆盖所有前端域名后，等待零权重备用机的连接排空并更新该机。备用机就绪后将前端组 100% 切到新版，核对两个 ALB VIP 的实际节点身份和状态码。原节点保留原版。
- 切流后的 [前端验收](../../infra/scripts/cluster/frontend.py) 分别记录两个 VIP 的实际响应和目标机的 ALB 健康状态。健康查询仍在收敛时继续观察，两个检查均通过后立即完成；等待超时保留最后一次结果供回退排查。
- 普通前端版本回退使用上一版制品和前端后端组。首次切流若需回退，按域名恢复原 DNS。多数域名此前由通配 A 记录承接，`ipstudio` 原有独立 A 记录。保留 DNS 缓存期内的旧前端和代理，旧 API/SAU 继续保持停用。

## 5. 验收与恢复

- 核对两机实际 SHA、release、进程和 ALB 权重。承流机为 100%，原版热备为 0%。在两个 VIP 上记录连续真实请求的 HTTP 结果和节点身份，保留失败样本。核对 SLS 启动与错误日志、OIDC、历史媒体读取和本次受影响的已登录业务。涉及存储时确认两机继续使用原业务 OSS，对原签名 URL 做 Range 和防篡改回归；凭据及完整签名 URL 不进入回执。支付和模型任务按发布范围做签名、状态、隔离回归或单独授权的实测。
- 发布失败时，以已验证的健康节点承流，先核对现场权重、实际返回、异步任务与资金状态。需要回到上一制品时，先确认它兼容当前 PostgreSQL 结构和已接收写入，再用同一滚动入口恢复。双机均无法安全承流时，暂停新写入并保护 PostgreSQL、支付回执和在途任务后恢复。旧 MySQL 与旧 DNS 不能作为回滚目的地。
- 回执记录 `main` 提交、发布范围、CI、JAR/镜像摘要、两机实际版本、双 VIP、ALB 权重、业务验收、SLS 和恢复动作。[首次迁移记录](../aistar-postgresql-cutover.md) 保留从 MySQL 切换的证据，日常发版按本页执行。
