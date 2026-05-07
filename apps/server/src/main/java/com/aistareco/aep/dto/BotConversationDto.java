package com.aistareco.aep.dto;

import java.util.List;

/**
 * Frontend mirror: apps/web/src/types/notification.ts {@code BotConversation}.
 */
public record BotConversationDto(
        BotMetaDto bot,
        List<ChatMessageDto> messages
) {}
