# AIStar 生产发布与恢复

适用于 2026-11-12 正式切流后的 AIStar。API 经 `api.aibuzz.cn` 和阿里云 ALB 在 A、B 双活，正常权重 A50/B50。两台 API 连接同一 PostgreSQL、Tair 和杭州业务 OSS。A 独立运行后台调度与 SAU，API 两台均关闭定时后台。节点、正式及演练组、域名和排空参数以 [集群配置](../../infra/cluster/production.json) 为准。

| 变更范围 | 发布入口 |
| --- | --- |
| `server` API | [`infra/scripts/deploy.sh server`](../../infra/scripts/deploy.sh)，默认正式双机滚动；`--plan` 只展示计划。 |
| PostgreSQL 结构 | 用迁移角色执行独立的向前兼容 DDL，并验证当前与候选版本；运行账号只做 Flyway 校验，API 滚动不会执行 DDL。 |
| A 上的后台调度、SAU | 独立验收和角色交接。API 滚动不会更新这两个单元；涉及定时任务、领取逻辑或发布驱动时，把相应组件列入发布范围。 |
| Web、admin、studio-admin | 核对组件现行入口和目标后单独发布。仓内 API 滚动入口仅支持 `server`，其他组件尚无本次验收过的双机发布入口；需要先完成该组件发布路径验收。 |
| 账号中心、军师及其他应用 | 按各自仓库的发布说明处理。账号中心入口在 [aibuzz-id](https://github.com/pokocat/aibuzz-id/blob/main/deploy/README.md)。 |

旧 ECS 上的前端及回环代理仍提供服务。旧 AIStar API 和旧 SAU 已停用，生产发布与恢复都禁止重新启动它们。历史单机脚本 `deploy-local.sh`、`deploy-release.sh`、`update-and-deploy.sh`、`rollback.sh` 以及旧版 `verify.sh` 均不能用于 AIStar API 正式发布或验收。不要给新入口设置旧部署变量 `DEPLOY_HOST`、`ECS_HOST`、`REMOTE_ROOT` 或 `PUBLIC_BASE`。

## 1. 选定版本与验证制品

1. 先合入远端 `main`，锁定本次发布的准确提交。以两机实际运行 SHA 为基线，核对差异和影响范围，尤其是共享数据库、异步任务、支付、前端 DTO/API 契约。前端和后端存在不兼容变更时，先做过渡兼容或安排协调发布。保留工作区其他任务；干净源码与重任务按根目录 `AGENTS.md` 的 `devq remote` 规则处理。
2. 在准确的 `main` 提交上运行 [Impersonation CI](../../.github/workflows/impersonation-ci.yml)。可手动触发 `gh workflow run impersonation-ci.yml --ref main`，核对该运行的 `headSha` 和最终结果。下载同次运行的 `verified-backend`，其中有已验收 JAR、工具及 `verified-backend.json`。后端分片、PostgreSQL 18 实库门禁及本次适用的其他检查全部通过后再打包。旧的 `deploy-production.yml` 仅构建传统目录制品。
3. 从与发布 SHA 一致的源码执行以下打包命令。ECS B 使用固定镜像原生打包，通过 SSH 向 A 传输镜像。脚本校验 JAR、镜像归档、镜像配置和双机身份。保留包、`manifest.json`、传输验收结果和 CI run ID。输出目录须为新目录。

   ```bash
   gh run download "$CI_RUN_ID" --name verified-backend --dir "$VERIFIED_BACKEND_DIR"
   python3 infra/scripts/cluster/bundle.py \
     --verified-backend "$VERIFIED_BACKEND_DIR" --output "$NEW_BUNDLE_DIR"
   ```

   `VERIFIED_BACKEND_DIR` 指向包含 `verified-backend.json` 和 `ai-star-eco-server-1.0.0.jar` 的目录。若下载目录保留了层级，先定位这两个文件。发布包使用 `candidate.tar.gz`，`RELEASE_ID` 取打包输出的 `release`（JAR SHA-256 前 16 位）。

## 2. 执行 API 滚动

发布前核对账号中心 OIDC discovery、两个正式 ALB VIP 的严格 TLS 和实际节点身份、两机当前制品、PostgreSQL 结构及运行角色、Tair、SLS 和相关业务依赖。保留上一版可用制品及其数据库兼容证明。对需要演练的变更使用 `--stage` 对应的演练组、演练 PG 与 Tair DB14，使用该组自己的探针和凭据。

探针文件放仓库外，权限 `0600`。正式模式 `host` 为 `api.aibuzz.cn`，按已配置的只读探针提供 `header`、`key`、能读取 `/api/admin/auth/me` 的短期授权 `token` 和预期 `subject_id`。令牌及私钥由现有授权渠道获取，日志、参数和回执只引用文件路径。缺少可用鉴权证据时先补齐。

```bash
./infra/scripts/deploy.sh server --plan
./infra/scripts/deploy.sh server \
  --bundle "$NEW_BUNDLE_DIR/candidate.tar.gz" --release "$RELEASE_ID" \
  --probe-file "$PRODUCTION_PROBE_FILE" --receipt "$NEW_RECEIPT_PATH"
```

脚本锁定集群发布、准备两台机器，并在健康承流节点的两个 VIP 都通过鉴权后才操作另一台。由 A50/B50 开始时，先 A100/B0，等待 B 至少 180 秒且连续三次确认 HTTP 请求、线程和持久工作排空，再更新 B。B100/A0 接管并通过两个 VIP 的真实鉴权后，排空并更新 A。最后恢复 A50/B50，两个 VIP 都要验证到 A 和 B。排空超时或受理状态不明时保留已确认能承流的节点，查明任务状态后再继续。

## 3. 验收与恢复

- 核对两机实际 SHA、release、进程、ALB 健康及 A50/B50；在两个 VIP 上记录连续真实请求的 HTTP 结果和节点身份，保留失败样本。核对 SLS 启动与错误日志、OIDC、历史媒体读取和本次受影响的已登录业务。支付和模型任务按发布范围做签名、状态、隔离回归或单独授权的实测。
- 发布失败时，以已验证的健康节点承流，先核对现场权重、实际返回、异步任务与资金状态。需要回到上一制品时，先确认它兼容当前 PostgreSQL 结构和已接收写入，再用同一滚动入口恢复。双机均无法安全承流时，暂停新写入并保护 PostgreSQL、支付回执和在途任务后恢复。旧 MySQL 与旧 DNS 不能作为回滚目的地。
- 回执记录 `main` 提交、发布范围、CI、JAR/镜像摘要、两机实际版本、双 VIP、ALB 权重、业务验收、SLS 和恢复动作。[首次迁移记录](../aistar-postgresql-cutover.md) 保留从 MySQL 切换的证据，日常发版按本页执行。
