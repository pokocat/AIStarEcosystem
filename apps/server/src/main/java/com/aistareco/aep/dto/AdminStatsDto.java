package com.aistareco.aep.dto;

public record AdminStatsDto(
        long totalUsers,
        long activeTenants,
        long activeLicenseKeys,
        long totalCreditsIssued,
        long totalProducts,
        long totalAuditEvents
) {}
