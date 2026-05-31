package com.aistareco.aep.dto;

/** 提现请求体，镜像前端 finance.ts WithdrawalInput { amount, bankCard }。 */
public record WithdrawalRequestDto(
        long amount,
        String bankCard
) {}
