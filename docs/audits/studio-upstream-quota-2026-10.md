# Studio 聚算资源配额拒绝 · 2026-10-23

状态：原因与结算已确认；供应商配额尚未处理。仅只读排查，无新生成、无资产删除、无扩容购买、无服务发布。

生产聚算 `minimax-h3` 视频与 `qwen3-tts` 配音请求返回 HTTP 409，`error.code=personal_asset_quota_exceeded`、`retryable=false`，提示「个人资源空间不足，请清理资源（含回收站）或扩容后重试」。这是供应商资源配额，不是用户在本平台的画布/回收站容量。供应商后台页面控制连接超时，本次尚未核实具体用量与清理范围。

## 原任务与积分

| 类型 | 原任务 | 终态 | 原冻结 | 结算 |
|---|---|---|---:|---|
| 视频 | mvj_0446611226c5 | failed | 320 | 全部释放 |
| 视频 | mvj_4a62a2665005 | failed | 320 | 全部释放 |
| 视频 | mvj_477b53d9295a | failed | 320 | 全部释放 |
| 视频 | mvj_e46890a46bc3 | failed | 320 | 全部释放 |
| 视频 | mvj_fa0bc84f5cd7 | failed | 320 | 全部释放 |
| 配音 | IPR-4bf359d524fe4e6f95b2 | failed | 130 | 全部释放 |
| 配音 | IPR-524dbe6f3beb44679f55 | failed | 130 | 全部释放 |
| 配音 | IPR-9a22174cfcaf4c7cacc2 | failed | 130 | 全部释放 |
| 配音 | IPR-da714135eaeb4212a5b5 | failed | 140 | 全部释放 |

以上 hold 均 RELEASED、remaining_amount=0；账本各 1 FREEZE / 1 UNFREEZE，无 SPEND。五笔视频 external_task_id 均空，供应商明确拒绝，不属于受理未知。追查号 TC2RBSKESPJK 对应 mvj_fa0bc84f5cd7，供应商 requestId req_01a168b2-e82c-78df-b88d-305595ce07ff。

## 后续

需要在聚算账号侧核实并恢复资源配额，不能让用户反复提交，也不能靠删除本平台作品解决。清理前必须核对可删资产范围、我方镜像与在途依赖；扩容需明确容量、价格与付款授权。配额恢复后再明确执行后续制作，不自动重投本轮失败任务。
