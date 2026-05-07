package com.aistareco.aep.dto;

/**
 * Frontend mirror: apps/web/src/types/wallet.ts {@code RechargeResponse}.
 *
 * 充值落账后返回最新钱包 + 主分录（recharge 类型）。
 * 如套餐含赠送积分（bonus），赠送的 gift 分录不在此处返回；前端从 wallet.giftBalance 增量观测。
 */
public record RechargeResponseDto(
        WalletDto wallet,
        LedgerEntryDto ledgerEntry
) {}
