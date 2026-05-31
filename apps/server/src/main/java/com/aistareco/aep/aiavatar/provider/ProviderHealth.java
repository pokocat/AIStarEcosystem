package com.aistareco.aep.aiavatar.provider;

/** Provider 健康状态（任务书 §5 healthcheck()）。 */
public record ProviderHealth(boolean healthy, String message) {
    public static ProviderHealth ok() {
        return new ProviderHealth(true, "ok");
    }

    public static ProviderHealth ok(String message) {
        return new ProviderHealth(true, message);
    }

    public static ProviderHealth down(String message) {
        return new ProviderHealth(false, message);
    }
}
