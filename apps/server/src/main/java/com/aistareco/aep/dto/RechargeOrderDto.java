package com.aistareco.aep.dto;

import com.aistareco.aep.model.RechargeOrder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Locale;

/**
 * 充值订单 wire shape。
 * Frontend mirror: packages/types/src/wallet.ts {@code RechargeOrder}。
 * status 出 wire 全小写（pending / paid / rejected / cancelled）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RechargeOrderDto(
        String id,
        String userId,
        String username,
        String displayName,
        String studioName,
        String packageId,
        String packageTag,
        long credits,
        long bonusCredits,
        long priceCents,
        String status,
        String userNote,
        String reviewerId,
        String reviewNote,
        Instant createdAt,
        Instant updatedAt,
        Instant reviewedAt,
        /**
         * v2 §6 在线支付（Jeepay / 影子）可见性：
         * paidVia 入账来源 manual（线下核准）/ jeepay（在线真实）/ shadow（在线影子）；
         * channelPayNo 渠道流水号（对账追溯）；wayCode 支付方式（WX_LITE/ALI_QR…）；
         * payOrderId 支付网关订单号；paidAt 到账时间；sourceApp 来源子应用。
         * NON_NULL：未支付 / 线下无渠道单号的字段自动省略。
         */
        String paidVia,
        String channelPayNo,
        String wayCode,
        String payOrderId,
        Instant paidAt,
        String sourceApp,
        /** v2 §15.5 / D17 退款回收：退款时间 + 实退积分 + 回收分录 id（未退款时三者省略）。 */
        Instant refundedAt,
        Long refundedCredits,
        String refundLedgerEntryId
) {
    public static RechargeOrderDto from(RechargeOrder o) {
        return new RechargeOrderDto(
                o.getId(),
                o.getUserId(),
                o.getUsername(),
                o.getDisplayName(),
                o.getStudioName(),
                o.getPackageId(),
                o.getPackageTag(),
                o.getCredits(),
                o.getBonusCredits(),
                o.getPriceCents(),
                o.getStatus() == null ? null : o.getStatus().name().toLowerCase(Locale.ROOT),
                o.getUserNote(),
                o.getReviewerId(),
                o.getReviewNote(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getReviewedAt(),
                o.getPaidVia(),
                o.getChannelPayNo(),
                o.getWayCode(),
                o.getPayOrderId(),
                o.getPaidAt(),
                o.getSourceApp(),
                o.getRefundedAt(),
                o.getStatus() == RechargeOrder.Status.REFUNDED ? o.getRefundedCredits() : null,
                o.getRefundLedgerEntryId()
        );
    }
}
