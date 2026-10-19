package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LedgerEntry;

import java.time.Instant;
import java.util.Locale;

public record LedgerEntryDto(
        String id,
        String walletId,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS) String userId,
        /** v0.58：账号登录名 / 昵称（admin 结算中心溯源用；用户自查等场景不填，wire 上省略）。 */
        String username,
        String displayName,
        /** v0.86：账号手机号（admin 财务工作台辨识用户身份；同上 owner 为 null 时省略）。 */
        String phone,
        String type,
        long amount,
        long balanceAfter,
        String description,
        String referenceId,
        String referenceType,
        Instant createdAt,
        String enterpriseId,
        String actorUserId,
        String membershipId,
        String billingAuthorizationId
) {
    /** Compatibility for existing personal-ledger callers. */
    public LedgerEntryDto(String id,String walletId,String userId,String username,String displayName,String phone,
            String type,long amount,long balanceAfter,String description,String referenceId,String referenceType,Instant createdAt) {
        this(id,walletId,userId,username,displayName,phone,type,amount,balanceAfter,description,referenceId,referenceType,createdAt,null,null,null,null);
    }
    public static LedgerEntryDto from(LedgerEntry e) {
        return from(e, null);
    }

    /** admin 视图：附带账号登录名 / 昵称（owner 为 null 时两字段省略，等价旧 shape）。 */
    public static LedgerEntryDto from(LedgerEntry e, AepUser owner) {
        return new LedgerEntryDto(
                e.getId(), e.getWalletId(), e.getUserId(),
                owner != null ? owner.getUsername() : null,
                owner != null ? owner.getDisplayName() : null,
                owner != null ? owner.getPhone() : null,
                lower(e.getEntryType()), e.getAmount(), e.getBalanceAfter(),
                e.getDescription(), e.getReferenceId(), e.getReferenceType(),
                e.getCreatedAt(), e.getEnterpriseId(), e.getActorUserId(), e.getMembershipId(), e.getBillingAuthorizationId()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
