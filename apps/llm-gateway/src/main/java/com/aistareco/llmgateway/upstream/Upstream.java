package com.aistareco.llmgateway.upstream;

import java.util.List;

public record Upstream(
        String id,
        String providerType,
        String baseUrl,
        String apiKey,
        List<String> modelPrefixes,
        boolean enabled
) {
    public boolean matches(String model) {
        if (model == null || !enabled) return false;
        for (String prefix : modelPrefixes) {
            if (prefix != null && !prefix.isEmpty() && model.startsWith(prefix)) return true;
        }
        return false;
    }
}
