package com.aistareco.aep.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * v3 形象锻造的 Coze 会话入口。
 * 前端先把所有选择拼成最终提示词，再由后端代持 token 发起流式对话。
 */
public record ForgeCozeChatRequest(
        @NotBlank String artistId,
        @NotBlank String prompt
) {}
