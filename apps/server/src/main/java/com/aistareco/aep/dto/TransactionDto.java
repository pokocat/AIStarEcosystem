package com.aistareco.aep.dto;

public record TransactionDto(
        String id,
        String source,
        long amount,
        String date,
        String status,
        String type,
        String userId
) {}
