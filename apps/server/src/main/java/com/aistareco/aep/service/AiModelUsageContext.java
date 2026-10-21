package com.aistareco.aep.service;

/** Audit attribution owned by the executing task, independent of servlet authentication. */
public final class AiModelUsageContext {
    private static final ThreadLocal<Attribution> CURRENT = new ThreadLocal<>();
    private AiModelUsageContext() {}

    public record Attribution(String userId, String appCode, String taskId) {}
    public interface Scope extends AutoCloseable { @Override void close(); }

    public static Attribution current() { return CURRENT.get(); }

    /** Bind at the actual execution boundary, including recovery; restore nested scopes on every exit. */
    public static Scope bind(String userId, String appCode, String taskId) {
        Attribution previous = CURRENT.get();
        CURRENT.set(new Attribution(userId, appCode, taskId));
        return () -> {
            if (previous == null) CURRENT.remove(); else CURRENT.set(previous);
        };
    }
}
