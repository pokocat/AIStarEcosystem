# 对标库 / Benchmarks — 成熟支付计费系统教会你的事

设计前对标，但**按计费模型右尺寸**：下面很多机制是订阅 / 自动续费专属的，一次性付费产品别照搬。

| 产品 | 它教会你什么 | 关键机制 / 出处 |
|---|---|---|
| **Stripe Billing** | 到期是状态机不是布尔；锚点对齐默认；proration 行为可配；webhook 不保证有序、需幂等 + 对账 | 8 态 subscription；`billing_cycle_anchor` 默认锚订阅日；`proration_behavior`(create_prorations / none / always_invoice)；Subscription Schedules 编排降级；事件「roughly chronological」需 List API 对账。docs.stripe.com/billing |
| **Stripe Entitlements** | 权益独立于 plan 建模（Feature / Active Entitlement），用 `lookup_key` 门禁，免硬编码 planId | 解耦支持改包装不改码、grandfathering、A/B。docs.stripe.com/billing/entitlements |
| **Lago**（开源） | calendar vs anniversary 的取舍；calendar 要对订阅费按天 prorate 补偿，但**额度仍会泄漏** | `billing_time` 默认 calendar；anniversary 按订阅日全额。docs.getlago.com |
| **OpenMeter**（开源） | 惰性 reset（reset 仅时间标记、读时聚合，天然幂等无 cron）；grant 滚存公式；用量周期与计费周期可分离但建议对齐 | rollover = `MIN(max, MAX(balance, min))`；默认不滚存；`preserveOverageAtReset`。openmeter.io/docs |
| **RevenueCat** | 移动订阅宽限期把「到期后短暂仍有效」内化；信平台 `expiration_date` / `entitlements.active`，别自己推算 | grace period 内仍 active；CANCELLATION ≠ 立即失效，以 EXPIRATION 为准。revenuecat.com/docs |
| **Chargebee / Recurly** | 欠费期 status 仍 **Active**、靠发票 / dunning 驱动——别只读 status 布尔判权益 | dunning 重试窗口；Recurly 真正失效看 `expired`。 |
| **Apple / Google IAP** | 平台用「购买是否仍被 query 返回」天然区分 宽限期(放行) vs account hold(撤销) | billing grace period 3/16/28 天；Google 宽限 + account hold。 |
| **微信支付（WeChat Pay）** | 支付方**不存储、不判断会员有效期**；自动续费门槛高；V3 无 JSAPI 全流程沙箱 | `time_expire` 只是订单支付截止时限；委托代扣 papay 需企业主体 / 交易量 / 类目资质；自建仿真 seam 比官方沙箱可控。pay.weixin.qq.com/doc |
| **Medusa**（开源） | cron / scheduled job 触发周期翻转的代表（与 OpenMeter 惰性形成对比） | 每 5 分钟扫 `current_period_end < now`。medusajs.com |

## 跨产品共识（直接可用的结论）

1. **锚点对齐(anniversary) 是主流默认**，自然月是反模式（额度会泄漏）。
2. **到期不续 = 周期末降级**，非立即（`cancel_at_period_end` 语义）。
3. **升级即时、降级周期末**是跨产品默认。
4. **额度按周期 reset、不滚存**是默认；滚存是显式 opt-in。
5. **惰性判过期 + cron 对账互补**：lazy 保即时一致，cron 兜 webhook 丢失 / 乱序漂移。
6. **权益与 plan 解耦**（快照 / entitlement 对象）→ 改套餐不误伤历史用户。
7. **支付方不管你的会员有效期**——永远商户侧记账。
