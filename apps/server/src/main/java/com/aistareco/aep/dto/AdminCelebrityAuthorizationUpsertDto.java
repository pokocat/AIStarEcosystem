package com.aistareco.aep.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * admin POST/PUT /api/admin/celebrity/star-authorizations[/{id}] 请求体。
 * 字段对齐 apps/web/src/types/celebrity-zone.ts CelebrityAuthorization + 用户/明星 FK。
 *
 * - status 用 wire 字符串（unauthorized / pending / authorized / expired）
 * - id 由 service 生成（uuid）
 */
public record AdminCelebrityAuthorizationUpsertDto(
        String userId,
        String starId,
        String status,
        List<String> scenes,
        LocalDate expireDate,
        Integer availableStyles,
        String pendingNote,
        String applyUrl
) {}
