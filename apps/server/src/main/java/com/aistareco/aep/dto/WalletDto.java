package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Wallet;

import java.time.Instant;

public record WalletDto(
        String id,
        String userId,
        /** v0.58：账号登录名 / 昵称（admin 结算中心钱包快照用；用户自查接口不填，wire 上省略）。 */
        String username,
        String displayName,
        /** v0.86：账号手机号（admin 财务工作台辨识用户身份；同上 owner 为 null 时省略）。 */
        String phone,
        long totalBalance,
        long licenseBalance,
        long rechargeBalance,
        long giftBalance,
        long pendingBalance,
        Instant createdAt,
        Instant updatedAt
) {
    public static WalletDto from(Wallet w) {
        return from(w, null);
    }

    /** admin 视图：附带账号登录名 / 昵称（owner 为 null 时两字段省略，等价旧 shape）。 */
    public static WalletDto from(Wallet w, AepUser owner) {
        return new WalletDto(
                w.getId(), w.getUserId(),
                owner != null ? owner.getUsername() : null,
                owner != null ? owner.getDisplayName() : null,
                owner != null ? owner.getPhone() : null,
                w.getTotalBalance(), w.getLicenseBalance(),
                w.getRechargeBalance(), w.getGiftBalance(),
                w.getPendingBalance(),
                w.getCreatedAt(), w.getUpdatedAt()
        );
    }
}
