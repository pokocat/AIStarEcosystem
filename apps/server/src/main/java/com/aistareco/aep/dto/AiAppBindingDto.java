package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * AI 应用绑定读 DTO（v0.41）。一行对应一个用途（{@code AiModelPurpose}）及其绑定端点。
 * 未绑定时 endpointId/endpointName 为 null。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAppBindingDto(
        String purpose,
        String purposeLabel,
        String endpointId,
        String endpointName,
        Boolean endpointEnabled,
        Instant updatedAt
) {}
