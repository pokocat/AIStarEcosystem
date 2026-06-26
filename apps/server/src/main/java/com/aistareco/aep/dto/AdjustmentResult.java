package com.aistareco.aep.dto;

/**
 * 调差 / 赠送发起结果（v2 §9.2 maker-checker）。
 *
 * @param pending   true=金额超阈值，已落审批单待复核（未入账）；false=已直接发放
 * @param entry     pending=false 时的账本分录（已发放）
 * @param requestId pending=true 时的审批单 id
 * @param amount    本次积分数
 * @param message   面向运营的提示
 */
public record AdjustmentResult(
        boolean pending,
        LedgerEntryDto entry,
        String requestId,
        long amount,
        String message
) {
    public static AdjustmentResult executed(LedgerEntryDto entry, long amount) {
        return new AdjustmentResult(false, entry, null, amount, "已发放");
    }

    public static AdjustmentResult pending(String requestId, long amount) {
        return new AdjustmentResult(true, null, requestId, amount, "金额超阈值，已提交审批，待财务复核");
    }
}
