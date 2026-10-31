# 模型赠款与折扣：生产发布（2026-10-25）

设计真源：[`docs/model-billing-design.md`](../model-billing-design.md)。

## 发布内容

| 项 | 值 |
|---|---|
| 版本 | `20261025-model-grants` |
| 构建提交 | main `94afa651`（干净工作区 `AIStarEcosystem-main-release` 构建） |
| 服务 | server、web-aiavatar、admin、web-drama |
| 构建参数 | `NEXT_PUBLIC_AUTH_MODE=id`、`NEXT_PUBLIC_ID_ISSUER=https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1` |
| 部署时间 | 2026-10-25 15:08–15:09 UTC（23:08–23:09 CST） |
| 不发布 | web-celebrity（用户要求不管）、web-music、web-star、sau-service |

赠款与折扣只按接入点 ID 匹配：先取最优一条折扣，再扣该接入点未过期的赠款（最早到期先用），不够的扣普通积分。零价接入点一律报 `MODEL_PRICE_NOT_CONFIGURED`，免费只能发模型赠款。

同时随 main 上线、此前没发过的提交：`9d192fbb`（模型报错透传）、`d41a419b`（IP 提示词整合）、`ee8fe3b7` 的 V66（`ip_run` JSON 列容量，线上此前已在线扩容，迁移幂等跳过）。

## 合并时处理

- 与 main 冲突三处：server README、openapi（两边各自新增，均保留）、`IpRunWorkerTest`（取 main 的出图签名、分支的 `commitHold` 用量参数）。
- 迁移撞号：main 已有 `V66__ip_run_json_capacity`，分支迁移顺延为 V67（账务表）、V68（审批单字段）、V69（追加冻结分组）。
- main 新测试按旧签名调 `commitHold`，补用量匹配器；main 的原生下拉框守门测试要求用 `SelectField`，赠款后台两处和 `ai/audit` 一处已替换。

## 发布前检查

- 线上 Flyway 停在 V65；流水表 2436 行（1.5 MB），V67 改列类型为秒级。
- 线上没有启用的零价候选；Studio 出图 30、剧本 2、视频生成区各档均已定价。
- 门禁：`pnpm typecheck:all`、`pnpm typecheck:admin`、`pnpm check:api-contract`、server 编译全绿。
- 测试：web-drama 689 项全过；web-aiavatar 1272 项、admin 32 项在全量并发时有 3 项等待抢跑，单独跑全过，main 上同样。server 宽回归 2133 项，剩余失败都在 main 基线上同样失败：`EnterpriseStudioBillingIntegrationTest` 2 项、`EnterpriseVideoBillingIntegrationTest` 7 项（受理不明改判失败退款后未更新的旧断言），`DapUpstreamMessageTest.serverErrorsStayGeneric` 1 项。赠款集成、迁移、企业报价、企业全流程测试另在 MySQL 8.0 上通过。

## 线上验收

- Flyway V66–V69 成功（23:09:18–19）；`aep_ledger_entries.entry_type` 启动后仍为 `varchar(255)`（启动加宽未改回 ENUM），`credit_adjustment_request.type` 为 `varchar(16)`；新表齐全；流水 2438 行完整。
- 新进程（pid 2679175）启动 20 秒，之后 0 条 ERROR；`/api/me/model-credits`、`/api/admin/model-billing/targets`、Studio 图片报价未登录均返回 401。
- `verify.sh` ALL GREEN。
- **重启窗口约 23:08–23:10 nginx 记到 83 个 502**（单实例重启的已知空档，见 AGENTS「发布期间 HTTP 连续性」）。
- **未做**：登录后台建赠款活动、发赠款、用户报价抵扣的真实链路（需要账号登录，未代为操作）。

## 回滚

在 `AIStarEcosystem-main-release` 里：

```bash
DEPLOY_HOST=ecs-user@47.98.162.120 SSH_KEY=/Users/donis/dev/aliyun/aiartist.pem PUBLIC_BASE=http://47.98.162.120 REMOTE_ROOT=/opt/ai-star-eco \
  ./infra/scripts/deploy-release.sh dist/deploy/20261025-studio-image-resolution server,web-aiavatar
# admin → dist/deploy/20261023-studio-dialogue-recovery admin
# web-drama → dist/deploy/20261023-studio-dialogue-no-continue web-drama
```

回滚后迁移不回退：旧代码读写 VARCHAR 列兼容；旧代码启动时的加宽逻辑会尝试把流水类型改回 ENUM，若已有赠款流水会失败并只打 WARN。
