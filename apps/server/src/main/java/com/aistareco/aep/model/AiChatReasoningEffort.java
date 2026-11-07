package com.aistareco.aep.model;

import com.aistareco.common.BusinessException;
import java.util.Set;

/** Operator-declared wire option; support is verified per fixed supplier/model, never inferred from its name. */
public final class AiChatReasoningEffort {
    private static final Set<String> VALUES = Set.of("none", "minimal", "low", "medium", "high", "xhigh", "max");
    private AiChatReasoningEffort() {}

    public static String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.trim();
        if (!VALUES.contains(normalized))
            throw BusinessException.badRequest("AI_REASONING_EFFORT_INVALID", "思考强度参数无效");
        return normalized;
    }
}
