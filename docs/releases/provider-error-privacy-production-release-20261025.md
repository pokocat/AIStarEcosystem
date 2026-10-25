# 供应商错误信息隔离：生产发布与 H3 排查（2026-10-25）

用户要求快速上线，并排查客户所说的 H3 无法使用。问题与过滤边界见[审计记录](../audits/provider-financial-error-disclosure-20261025.md)。

## 发布

- 制品版本：`20261025-provider-error-privacy`。
- 构建来源：干净 main `3e45f6e49aa267a27a661793ad7098e32950f68e`，16:52:16 UTC 开始、16:54 UTC 完成。后续其他任务在 16:55:06 UTC 合入 main 的赠款转换功能不属于这份制品；未重置或覆盖它们的代码。
- 服务：server、web-aiavatar、web-drama。后端公共 JSON 错误过滤覆盖其他产品入口；其他前端和 admin 未重新部署。
- 参数：真实 API、OIDC `https://id.aibuzz.cn`、`NEXT_PUBLIC_ENTERPRISE_ENABLED=1`；`SKIP_INSTALL=1`、`SKIP_TYPECHECK=1`，Maven 跳过测试编译和执行。只完成正式制品构建与必要的发布健康检查，未运行测试套件或付费生成验收。
- 部署：16:54:37 UTC 开始上传；单实例 server 重启，进程 PID `2697688` → `2706949`。新进程 16:55:35 启动，16:55:52 完成 Spring 启动，`NRestarts=0`。Flyway 仍为 V69，无新增迁移。

| 制品 | SHA-256 |
|---|---|
| server/app.jar | `1d2fec93ae98a75270ade5eda06bbfe3d786fce7426cd2f9ce5da96aaaddc9fb` |
| web-aiavatar.tar.gz | `fa338b062a1c7baf67e9dc5349c161d06283d0de783d3954bcb21c6f6b846fe3` |
| web-drama.tar.gz | `52d06e536f53449bff7ead080f3c727427167908e98ab1e7955a6bb0899e42e2` |

远端运行 JAR 与两份归档哈希均与本地制品一致。三个 systemd 服务 active。公网 HTTPS 定向生产 IP 检查：aistar 首页、`/api/config`、drama 首页均 200；未登录的 Studio models 返回 401，未放开鉴权。启动后所查日志无 ERROR / Exception。未借用客户身份、修改作品/任务/钱包或重新提交生成。

## 发布访问空档

从 nginx access.log 发布前第 1929475 行之后计数，到 16:56 UTC 检查时有 **44 个 502**（含探测请求与真实访问，非 44 位客户）；首个在 16:55:05 UTC、末个 16:55:51 UTC。每两秒探测 `/api/config` 从 16:55:06 至 16:55:51 失败，16:55:53 起恢复 200；两端首页探测为 200。不能据此描述为不停机发布。

## H3：已定位平台报价授权不匹配

- 数据库最近 H3 任务连续成功；最新 `mvj_b58714ff46e2` 于 15:45:12 UTC 创建、15:50:13 UTC 成功，外部任务 `job_9fc41dc2899b256811e6e444`。只查询现有记录与日志，没有新的供应商调用。
- 16:15:11、16:15:16、16:26:49 UTC，同一项目 `IPP-d395bde4` 的 `/studio-runs` 三次返回 **409 `STUDIO_PRICE_CHANGED`**，原话“价格已变化，请重新确认本次创作费用”。堆栈明确在 `IpRunService.prepareVideo` → `requireApprovedCost`，尚未建视频任务或调用 H3。
- 平台 `celebrity.video-studio-pricing` v5 于 **16:14:04 UTC** 更新，H3 768p 当前每秒 62 积分；候选接入点启用、VIDEO_GENERATION 与 DAP_VIDEO 绑定仍在。
- 该项目错误节点保存的 H3 请求仍为 **8 秒 / maxCost=320**；当前 8 秒售价 **496**。服务端拒绝超出旧授权是正确边界，不能直接补差价或提高客户授权。未确认这就是客户所指的唯一一次故障，也不能用一小时前成功证明厂商此刻所有请求正常。
- 规避：刷新获取新页面及报价，从生成入口重新确认费用。发布前已在 main 的模型报价流程会先查原请求是否受理，对新请求读取服务端报价并让用户确认；本次随 Studio 制品一起发布。未代客户确认或重跑。
- 图片截图中的供应商余额不足另属 `gpt-image-2-1k-pic` 的 HTTP 403 / `insufficient_user_quota`，不能混同为 H3 故障；实际供应商额度仍需运营处理。

## 回滚

发布前 JAR 留在 `/opt/ai-star-eco/releases/20261025-provider-error-privacy-before/server/app.jar`，SHA-256 `a6c565bedee6b1f76f44fbaecbced4c33d189ae63bfc6ff5122232d0a913664a`。需要回滚时复制回 server/app.jar 后重启；前端使用既有发布归档恢复。回滚旧版本会恢复本次修复的错误信息泄露风险，且不改变当前平台售价或客户原授权。
