package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Frontend mirror: apps/web/src/types/notification.ts {@code BotMeta}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record BotMetaDto(
        String id,
        String name,
        String subtitle,
        String avatarColor,
        String avatarIcon,
        String iconColor
) {}
