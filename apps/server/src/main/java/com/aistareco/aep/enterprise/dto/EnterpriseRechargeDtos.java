package com.aistareco.aep.enterprise.dto;

import com.aistareco.aep.model.RechargeOrder;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.time.Instant;
import java.util.Locale;

public final class EnterpriseRechargeDtos {
    private EnterpriseRechargeDtos(){}
    public record RechargeRequest(String clientRequestId,@JsonDeserialize(using=EnterprisePointsDtos.IntegralAmount.class) Long requestedPriceCents,String note) {}
    public record ConfirmRequest(String clientRequestId,@JsonDeserialize(using=EnterprisePointsDtos.IntegralAmount.class) Long priceCents,
            @JsonDeserialize(using=EnterprisePointsDtos.IntegralAmount.class) Long credits,String receiptReference,String note) {}
    public record RefundRequest(String clientRequestId,String previewToken,String reason,String receiptReference) {}
    public record RejectRequest(String reason) {}
    public record WalletSummary(String enterpriseId,String enterpriseName,long unallocated,long allocated,long pending,long spent,long totalBalance) {}
    public record MemberBalance(String memberId,String userId,String displayName,String role,String status,String walletId,
            long totalBalance,long pendingBalance,long rechargeBalance,long giftBalance,long licenseBalance) {}
    public record RefundPreview(String orderId,String enterpriseId,long originalCredits,long originalPriceCents,long reclaimableCredits,
            long refundPriceCents,long memberRecallCredits,long pendingCredits,long spentCredits,String previewToken) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Order(String id,String enterpriseId,String enterpriseName,String initiatorUserId,String initiatorName,String targetWalletId,
            long priceCents,long credits,String status,Instant createdAt,Instant paidAt,Instant reviewedAt,String reviewerName,
            String receiptReference,String note,long refundedCredits,long refundedPriceCents,String refundReceiptReference) {
        public static Order from(RechargeOrder o) {
            return new Order(o.getId(),o.getEnterpriseId(),o.getEnterpriseName(),o.getUserId(),o.getDisplayName(),o.getTargetWalletId(),
                    o.getPriceCents(),o.getCredits(),o.getStatus().name().toLowerCase(Locale.ROOT),o.getCreatedAt(),o.getPaidAt(),o.getReviewedAt(),
                    o.getReviewerId(),o.getReceiptReference(),o.getReviewNote()==null?o.getUserNote():o.getReviewNote(),o.getRefundedCredits(),o.getRefundedPriceCents(),o.getRefundReceiptReference());
        }
    }
}
