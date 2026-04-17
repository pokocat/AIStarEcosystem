package com.aistareco.aep.dto;

public record AdminStatsDto(
        long totalUsers,
        long activeTenants,
        long activeLicenses,
        long totalCreditsIssued,
        long auditEvents
) {}
