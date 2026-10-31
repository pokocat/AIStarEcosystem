# Studio 同步出图读 URL 结果与告警措辞修复 — 2026-10-29

先合入并推送 main（`f6c5bf67e8867e5c01b332635eceb53474685b43`，从 `e4f886ec` 快进），再在仓外干净工作区 `../AIStarEcosystem-image-alerts`（检出即 origin/main，无未提交改动）构建，仅发布 server。

## 起因：2026-10-29 的 4 条飞书告警

| 任务 | 现象 | 根因 |
|---|---|---|
| `IPR-647fba35` | 供应商已出图，平台判 `STUDIO_IMAGE_SUBMISSION_UNKNOWN` 退款，告警写「请勿重新生成」 | 带参考图走 `/images/edits`，请求带 `response_format=b64_json`，供应商仍回 HTTP 200 + `data[0].url`（AWS S3 签名地址）；平台只读 `/data/0/b64_json` |
| `IPR-0e3213ba` `IPR-cfa261cc` `IPR-2f204536` | 2026-10-28 23:36 重启时在途，09:03 才收尾，告警写 `Historical unknown submission: null` | 重启后无回执的同步请求没人收尾，已由 `20261028-image-orphan-recovery`（`fda4e433`）修复并收尾；告警拼了空的原错误信息 |

4 个任务共冻结 103 积分，均已释放，实扣 0；三条旧告警各发一次，无重复。

## 变更

- `JusuanImageClient`：同步结果按配置字段读不到时改读同一层另一种写法（`b64_json` ↔ `url`），日志 `[studio-jusuan-image] result field fallback`。改读到的地址：端点配了 `outputHosts` 按名单，没配允许任意公网 HTTPS（仍拒内网 / 带账号 / 非 443），下载不带我方鉴权头。
- 供应商已答复、同步调用无任务号可恢复：结果不能用（没有图、下载失败、尺寸不符）按已知失败 `STUDIO_IMAGE_PROVIDER_FAILED`，不再记「受理未知」。
- `GenerationSubmissionFailure.settled`：判失败并退款的任务，告警原因写最终结果（「已按失败处理并退回未完成部分的冻结积分」），去掉运行中的「请勿重新生成」，原信息为空不再打印 `null`；图片两处收尾与视频 `failUnconfirmedSubmission` 共用。

同批随 main 上线的 server 改动：AI 导演台全能创作助手后端（`751cffb8`、`e8ece63e`，经 `a65c379a` 合入 main，此前未发布）。只新增节点 `assistant` / `brief` 与写分镜时的 `sourceQuote` 字段，现网前端仍是 `20261028-director-delete`，不调用这些新入口；无迁移、无提示词种子变化。

## 制品与检查

- 发布包 `20261029-image-url-result-alerts`；server JAR SHA256 `f06f62c3d1f72c4227c81855b4aad6d4540deead546ec48192e2919706fc6b10`，本地与线上 `/opt/ai-star-eco/server/app.jar` 一致；已核对 jar 内含新类。
- 后端直接相关 116 项测试通过（`JusuanImageClientTest`、`IpRunWorkerTest`、`FeishuModelAlertsTest`、`AiGenerationQueueDispatcherTest`、`MaterialVideoWorker*Test`），新增 5 项：改读 URL 取回图片、`outputHosts` 仍限制改读地址、没有图按已知失败、两条告警原因措辞。ipstudio / 视频 / 队列 / 告警整组 1572 项中 11 项失败，均在未改动的 main 上同样失败（已记 TODO.md）。
- 发布前后在途检查：发布前没有运行中的图片、视频或队列任务，重启没有打断任何生成。

## 线上验收（2026-10-29 10:52 CST 启动）

- `verify.sh` ALL GREEN；`aistareco-server` active、NRestarts=0；Flyway 校验 70 个迁移，仍为 V69.1，无新迁移。
- 启动后日志 0 条 ERROR（同一 grep 在前一天窗口命中 68 条，确认能命中）。
- 启动后无新告警，无运行中任务。
- 部署脚本未更新 `/opt/ai-star-eco/server/release-id.txt` / `release-sha.txt`，已按实际 JAR 补齐为本版。

**未验证**：改读 URL 的出图路径还没有在线上走过真实生成（需付费出图，未代用户发起）。下一次带参考图出图后查：

```bash
sudo journalctl -u aistareco-server --since "<时间>" | grep -E "result field fallback|IPR-<任务号>"
```

能看到 `used=/data/0/url` 且任务 done、候选有图即为通过。

## 回滚

`deploy-release.sh <20261028-image-orphan-recovery 制品> server`（制品在 ECS `/opt/ai-star-eco/releases/20261028-image-orphan-recovery/`，本机在 Codex 工作区 `~/.codex/worktrees/image-orphan-recovery/AIStarEcosystem/dist/deploy/`）。无迁移，可直接回滚。
