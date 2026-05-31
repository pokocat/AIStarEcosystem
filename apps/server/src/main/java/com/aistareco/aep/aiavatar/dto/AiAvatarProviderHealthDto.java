package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 单能力 Provider 健康（任务书 §6 GET /api/health/providers）。
 * 前端据 mode 显示 MOCK 角标，据 engine 标注实现来源（InstantID / TripoSR / MOCK …）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarProviderHealthDto(
        AiAvatarCapability capability,
        String capabilityLabel,
        AiAvatarProviderMode mode,
        boolean healthy,
        String engine,
        String approach,
        String message
) {}
