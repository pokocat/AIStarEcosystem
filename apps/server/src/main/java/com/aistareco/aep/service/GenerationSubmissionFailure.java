package com.aistareco.aep.service;

/** Product policy: no usable submission receipt means failed; keep diagnostics, refund unused credits, retry only on user action. */
public final class GenerationSubmissionFailure {
    private GenerationSubmissionFailure() {}
    public static final String MESSAGE = "生成服务没有返回结果，这次生成失败。未完成部分的积分已退回，可以重新生成。";
    /** Only reasons that change what the customer does next: an unchanged retry would be refused again. */
    private static final java.util.regex.Pattern ACTIONABLE = java.util.regex.Pattern.compile("审核|真人|下架|存储空间满");

    /** The cause itself goes to the logs through {@link #settled}: for a customer it mostly repeated this sentence or named a Java class. */
    public static String message(Throwable cause) {
        return withReason(cause instanceof com.aistareco.common.BusinessException ? cause.getMessage() : null);
    }
    public static String withReason(String reason) {
        return reason != null && ACTIONABLE.matcher(reason).find() ? MESSAGE + " 原因：" + reason : MESSAGE;
    }

    /**
     * ErrorLog / alert cause for a receipt this policy has just closed. It states the settled outcome: the
     * in-flight wording ("请勿重新生成") is stale once the task failed and refunded, and a missing message is omitted
     * rather than printed as "null" (2026-10-29 alerts).
     */
    public static IllegalStateException settled(String situation, String earlierState, Throwable cause) {
        String text = situation + "，已按失败处理并退回未完成部分的冻结积分";
        String earlier = earlierState == null ? "" : earlierState.replaceAll("[；;，,]?\\s*请勿重新生成", "").trim();
        if (!earlier.isEmpty()) text += "。运行中记录的状态：" + earlier;
        return new IllegalStateException(text, cause);
    }
}
