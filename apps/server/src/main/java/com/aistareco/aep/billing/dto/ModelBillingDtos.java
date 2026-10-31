package com.aistareco.aep.billing.dto;

import com.aistareco.aep.billing.service.ModelBillingTarget;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Wire mirrors of packages/types/src/model-billing.ts. Internal JSON columns never leave the service. */
public final class ModelBillingDtos {
    private ModelBillingDtos() {}
    public record TargetOption(String id,String label,String channelName,ModelBillingTarget target) {}
    public record UserOption(String id,String displayName,String phone) {}
    public record WalletOption(String id,String userId,String displayName,String phone,String accountType,
                               String enterpriseId,String enterpriseName) {}
    public record EnterpriseOption(String id,String name,String status) {}
    public record Price(String id,String name,ModelBillingTarget target,BigDecimal unitPrice,BigDecimal outputUnitPrice,
                        boolean active,long version,Instant updatedAt) {}
    public record Discount(String id,String name,ModelBillingTarget target,String audience,String audienceId,
                           BigDecimal factor,boolean allowGrants,Instant startsAt,Instant expiresAt,boolean active,
                           long version,Instant updatedAt,String audienceLabel) {}
    public record Campaign(String id,String name,List<ModelBillingTarget> targets,long totalIssueLimit,long perWalletIssueLimit,
                           BigDecimal resourceLimit,BigDecimal perWalletDailyResourceLimit,int maxConcurrentPerWallet,
                           Instant startsAt,Instant expiresAt,boolean active,long version,long issued,
                           BigDecimal resourceReserved,BigDecimal resourceUsed,Instant updatedAt) {}
    public record Grant(String id,String walletId,String campaignId,String campaignName,List<ModelBillingTarget> targets,
                        List<String> targetLabels,boolean campaignActive,long amount,long available,long frozen,long spent,long expired,
                        Instant expiresAt,Instant createdAt) {}
}
