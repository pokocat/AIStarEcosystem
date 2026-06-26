---
name: payment-system-design
description: >
  Design or audit payment / subscription / billing / entitlement systems: plan
  validity & expiry, quota & credit accounting, upgrade/downgrade proration,
  refund and anti-arbitrage risk control (风控), webhook idempotency & concurrency,
  payment-provider (WeChat Pay 微信支付 / Stripe) integration, and testability
  seams. Use when building or reviewing paid plans/套餐, membership validity/有效期,
  token or credit quotas/额度, recharge/充值, proration/折算, refunds/退款, or
  entitlement/权益 enforcement.
---

# 支付系统设计 / Payment System Design

设计**新**系统或审计**现存**付费 / 订阅 / 权益系统时用。它装的是「让一个*看起来*做完的支付系统，变成*真正*兑现用户所付权益」所需的失效模式、设计原则与风控规则。

## 黄金前提（先记住）

**支付方不替你管权益。** 微信 `time_expire` 只是订单支付截止时限、不是会员有效期；Stripe `current_period_end` 也要你自己校验。**有效期、额度、到期一律是商户侧记账。**

## 使用流程

1. **先定计费模型**（§1）——决定你需要哪些机制，避免过度设计。
2. **跑审计目录**（`references/audit-catalog.md`）——这些 bug 在动到钱之前都藏着。
3. **套用设计原则**（§2）与**风控规则**（`references/risk-control.md`）。
4. **套餐变更**走折算 playbook（`references/proration-playbook.md`）。
5. **做实幂等 / 并发**（§3）与**可测性缝**（§4）——离线端到端测不了的支付代码＝不可验证。
6. **产出决策台账文档**（`references/decision-ledger-template.md`），不只是代码。

设计前先对标成熟产品（`references/benchmarks.md`），但**按计费模型右尺寸**——别把 Stripe 的 8 态机套到一次性付费产品上。

## §1 先定计费模型（第一步，决定一切）

| 模型 | 需要的机制 | 不需要的（别上） |
|---|---|---|
| **一次性付费**（买 N 月/年，到期手动再买） | 绝对到期时间 + 惰性判过期 + 商户记账 | dunning / past_due / 扣款重试 / 自动续费 webhook |
| **自动续费订阅** | 上面全部 + webhook 对账 cron + 宽限期 + 完整状态机 | — |
| **用量计费 (metered)** | 计量周期 + reset 锚点 + 滚存(rollover)策略 | — |
| **混合**（订阅额度 + 一次性加购） | 两套正交账户，各自记账，别混 | — |

确认**支付方约束**：能否自动续费？有无沙箱？回调形态与验签方式？退款规则？
（微信：委托代扣 papay 自动续费门槛高——企业主体 / 交易量 / 类目资质 / V3 部分灰度；且 V3 无覆盖 JSAPI 全流程的可用沙箱。）

## §2 核心设计原则

- **P1 绝对到期时间(UTC)**，消费路径上用**服务端可信时间**校验；绝不信客户端 / 回调时间。
- **P2 购买时快照权益**（grandfathering）：消费读快照，**不** live-read 可变套餐定义——否则后台改套餐会**追溯误伤已付费用户**。
- **P3 周期锚定订阅日**(anniversary)，不是自然月——否则月中购买白享半月、年付每月免费续杯。
- **P4 状态机非布尔**：active / expired / grace / locked；能派生就别存。
- **P5 惰性(JIT)判过期是基线**；**有事件流（自动续费 webhook）会漂移时才加 cron 对账**。一次性付费不需要 cron。
- **P6 显式定义「过期态」行为**：硬锁只读 / 回落免费层 / 宽限期——这是产品决策，必须写明并落到一道独立于额度的门禁上。
- **P7 保留已购 plan 引用**（审计 / 续费无损恢复），**派生** effective 权益，别清空 planId。

## §3 幂等与并发（动钱必做）

- **至少一次投递 → 恰好一次处理**：支付方 event / 订单号唯一约束；订单状态机用**条件 update 抢占**(claim) + **提交锚点**（如 `appliedAt`），使部分失败可恢复、重复回调直接跳过。
- **防双花**：消费路径用行锁 / 原子自减 / advisory lock；或事件溯源重算余额。
- **事务边界**：发权益 + 写到期 + 写审计，**同一事务**。
- 按订单串行化回调（per-order advisory lock）。

## §4 可测性缝（否则不可验证）

- **可注入时钟** `now()`：快进到期 / 重置，无需等真实时间。
- **mock 下单模式**：跳过真实支付方 HTTP。
- **沙箱仿真回调端点**：构造合成 notify 直调入账逻辑，绕过验签 / 解密；**真实回调端点保持严格不动**。
- **双控门禁**：环境开关 **且** 管理员鉴权；`生产 && 沙箱开` → 拒绝启动；测试数据打 source / provider 标可清理。
- **E2E 冒烟**：下单 → 仿真回调 → 断言权益 → 快进过期 → 断言锁定 → 重投验幂等。本地 / CI 无支付方可跑。

## 反模式速记（详见 `references/audit-catalog.md`）

永久权益 · 自然月额度泄漏 · live-reference 误伤已购 · 布尔代状态机 · 信客户端时间 · 非幂等发放 · 读判写竞态 · 折算套利 · 退款不回收 · 不可测支付路径。
