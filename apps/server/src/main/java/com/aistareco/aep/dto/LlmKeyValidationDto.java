package com.aistareco.aep.dto;

/** 外部 API Token 校验结果。 */
public record LlmKeyValidationDto(
        boolean ok,
        String reason,
        String keyId,
        String userId,
        String name
) {
    public static LlmKeyValidationDto fail(String reason) {
        return new LlmKeyValidationDto(false, reason, null, null, null);
    }
    public static LlmKeyValidationDto ok(String keyId, String userId, String name) {
        return new LlmKeyValidationDto(true, null, keyId, userId, name);
    }
}
