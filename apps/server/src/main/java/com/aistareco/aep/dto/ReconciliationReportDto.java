package com.aistareco.aep.dto;

import java.time.Instant;

/**
 * 对账报表（v2 §11）。从不可变账本 + 充值订单重算，断言「现金入账 == RECHARGE 积分发放」（排除影子），
 * 并把积分面负债单列（永不进现金/营收报表）。drift≠0 当即告警（兜 lost update / 漏写账本），
 * <b>不自动消解</b>（守 §8.0）。
 *
 * 单位均为积分（与账本 amount 同口径，分/元换算在展示层）。
 */
public record ReconciliationReportDto(
        // ── 资金面（真实现金，排除影子） ──
        /** Σ 订单 credits（PAID+REFUNDED，非影子）= 历史现金入账的积分总量。 */
        long grossRecharge,
        /** Σ 退款回收 refundedCredits（REFUNDED）= 已现金退款回收的积分。 */
        long refundedReclaimed,
        /** Σ |WITHDRAW| 账本 = 已提现积分。 */
        long withdrawn,
        /** 当前现金背书负债 = grossRecharge − refundedReclaimed − withdrawn。 */
        long netCashCredits,

        // ── 勾稽（订单侧 vs 账本侧，应一致） ──
        /** Σ RECHARGE 账本（非影子）= 账本侧现金事实。 */
        long ledgerRechargeNonShadow,
        /** grossRecharge − ledgerRechargeNonShadow，应为 0；非 0 即 drift 告警。 */
        long drift,
        /** drift == 0。false → 账面不平，需人工排查（绝不自动消解）。 */
        boolean balanced,

        // ── 影子（剔除真实现金勾稽，透明展示） ──
        /** Σ 影子单 credits（paidVia=shadow）= 非真实现金，单列剔除。 */
        long shadowRecharge,

        // ── 积分面负债（平台负债，永不进现金/营收报表） ──
        long giftIssued,
        long adjustNet,
        long licenseGranted,
        /** giftIssued + adjustNet + licenseGranted = 未兑付积分负债。 */
        long creditLiability,

        Instant generatedAt
) {}
