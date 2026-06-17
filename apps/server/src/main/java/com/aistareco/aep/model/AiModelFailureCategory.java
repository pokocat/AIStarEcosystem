package com.aistareco.aep.model;

import java.util.Locale;

/** LLM 调用失败原因标准分类。DB 存 enum name，展示层使用 label。 */
public enum AiModelFailureCategory {
    RATE_LIMIT("限速"),
    QUOTA("配额不足"),
    TIMEOUT("超时"),
    AUTH("认证失败"),
    BILLING("余额或欠费"),
    CONTENT_POLICY("内容安全"),
    BAD_RESPONSE("响应格式异常"),
    NETWORK("网络异常"),
    CONFIG("配置错误"),
    PROVIDER_UNAVAILABLE("服务不可用"),
    PROVIDER_ERROR("服务商错误"),
    UNKNOWN("未归类");

    private final String label;

    AiModelFailureCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static AiModelFailureCategory classify(String errorCode, String errorMessage) {
        String text = ((errorCode == null ? "" : errorCode) + " " + (errorMessage == null ? "" : errorMessage))
                .toLowerCase(Locale.ROOT);
        if (text.isBlank()) return UNKNOWN;

        if (containsAny(text, "rpm_limit", "tpm_limit", "rate_limit", "too_many_requests", "http_429", "429")) {
            return RATE_LIMIT;
        }
        if (containsAny(text, "quota", "token_quota", "cost_quota", "insufficient_quota", "exceeded_quota")) {
            return QUOTA;
        }
        if (containsAny(text, "timeout", "timed out", "read timed", "connect timed", "超时")) {
            return TIMEOUT;
        }
        if (containsAny(text, "unauthorized", "forbidden", "invalid_api_key", "invalid key", "http_401", "http_403", "401", "403")) {
            return AUTH;
        }
        if (containsAny(text, "billing", "payment", "balance", "insufficient_balance", "arrears", "欠费", "余额")) {
            return BILLING;
        }
        if (containsAny(text, "content_filter", "content_policy", "safety", "sensitive", "moderation", "敏感", "安全")) {
            return CONTENT_POLICY;
        }
        if (containsAny(text, "json", "parse", "malformed", "bad_response", "invalid response", "响应格式")) {
            return BAD_RESPONSE;
        }
        if (containsAny(text, "unknownhost", "connectexception", "socketexception", "ssl", "network", "connection refused")) {
            return NETWORK;
        }
        if (containsAny(text, "not_configured", "endpoint_model_required", "model_not_allowed", "provider_not_supported", "config")) {
            return CONFIG;
        }
        if (containsAny(text, "http_500", "http_502", "http_503", "http_504", "503", "504", "unavailable", "overloaded")) {
            return PROVIDER_UNAVAILABLE;
        }
        if (text.contains("http_") || text.contains("provider") || text.contains("upstream")) {
            return PROVIDER_ERROR;
        }
        return UNKNOWN;
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }
}
