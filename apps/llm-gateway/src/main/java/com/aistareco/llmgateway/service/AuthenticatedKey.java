package com.aistareco.llmgateway.service;

/** ApiKeyAuthFilter 把校验通过的 key 信息塞到 reactor context / exchange attribute 里。 */
public record AuthenticatedKey(
        String keyId,
        String userId,
        String name
) {
    public static final String ATTR = "llm-gateway.authenticated-key";
}
